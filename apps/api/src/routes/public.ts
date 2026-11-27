import { Hono } from "hono";
import {
  checkoutSchema,
  guestSessionSchema,
  releaseSchema,
  reserveSchema,
  slugSchema,
  splitGross,
  VAT_RATE_BP,
  type CheckoutResult,
  type PublicList,
  type PublicListItem,
  type ThemeId,
} from "@bwl/shared";
import type { AppEnv } from "../context";
import type { Executor } from "../db";
import { all, one, placeholders, run, tx } from "../db";
import { audit } from "../lib/audit";
import { newId, randomBase62, randomToken, sha256Hex } from "../lib/crypto";
import { ApiError, conflict, notFound, unauthorized } from "../lib/errors";
import { enforce, ipHash } from "../lib/rateLimit";
import { body, parse } from "../lib/validate";
import { daysUntil, resolveTheme } from "../services/lists";
import { GIFT_BOUGHT, notify, sendWebhook } from "../services/notify";
import { buildReceipt } from "../services/receipts";
import { orderNewEmail, receiptEmail } from "../email/templates";

export const HOLD_MS = 15 * 60_000;
export const pub = new Hono<AppEnv>();

// Rate limit every public endpoint per IP.
pub.use("*", async (c, next) => {
  await enforce(c, "public", 120, 60_000);
  await next();
});

/** Release expired holds (lazy sweep — no cron needed). */
export async function sweepExpired(db: Executor, now: number) {
  await run(db, "UPDATE reservations SET status = 'released' WHERE status = 'held' AND expires_at < ?", [now]);
}

interface SharedList {
  list_id: string;
  name: string;
  description: string;
  birthday: string | null;
  theme_id: ThemeId | "custom";
  custom_theme: string | null;
  first_name: string;
  user_id: string;
}

async function listBySlug(db: Executor, slug: string): Promise<SharedList> {
  const row = await one<SharedList>(
    db,
    `SELECT l.id AS list_id, l.name, l.description, l.birthday, l.theme_id, l.custom_theme, u.first_name, u.id AS user_id
     FROM share_links sl
     JOIN lists l ON l.id = sl.list_id AND l.deleted_at IS NULL
     JOIN users u ON u.id = l.user_id AND u.deleted_at IS NULL AND u.consent_status = 'verified'
     WHERE sl.slug = ? AND sl.enabled = 1 AND sl.revoked_at IS NULL`,
    [slug],
  );
  // Same 404 for "never existed", "sharing turned off" and "deleted" — nothing to enumerate.
  if (!row) throw notFound("list");
  return row;
}

pub.get("/l/:slug", async (c) => {
  const { db, now } = c.var.deps;
  const slug = parse(slugSchema, c.req.param("slug"));
  const session = c.req.query("session");
  const sessionHash = session && guestSessionSchema.safeParse(session).success ? await sha256Hex(session) : null;
  const ts = now();
  await sweepExpired(db, ts);
  const list = await listBySlug(db, slug);
  const rows = await all<{
    li_id: string;
    li_status: "available" | "purchased";
    p_id: string;
    title: string;
    description: string;
    category: PublicListItem["product"]["category"];
    price_agorot: number;
    image_url: string | null;
    stock: number;
    shop_name: string;
    city: string;
    logo_url: string | null;
    r_id: string | null;
    r_expires: number | null;
    r_session: string | null;
  }>(
    db,
    `SELECT li.id AS li_id, li.status AS li_status, p.id AS p_id, p.title, p.description, p.category, p.price_agorot, p.image_url,
            COALESCE(s.quantity, 0) AS stock, sh.name AS shop_name, sh.city, sh.logo_url,
            r.id AS r_id, r.expires_at AS r_expires, r.guest_session_hash AS r_session
     FROM list_items li
     JOIN products p ON p.id = li.product_id
     JOIN shops sh ON sh.id = p.shop_id
     LEFT JOIN stock s ON s.product_id = p.id
     LEFT JOIN reservations r ON r.list_item_id = li.id AND r.status = 'held'
     WHERE li.list_id = ? AND sh.status = 'approved'
     ORDER BY li.status = 'purchased', li.created_at`,
    [list.list_id],
  );
  const result: PublicList = {
    kidFirstName: list.first_name,
    listName: list.name,
    description: list.description,
    themeId: list.theme_id,
    theme: resolveTheme(list.theme_id, list.custom_theme),
    daysToBirthday: daysUntil(list.birthday, ts),
    items: rows.map((r) => {
      const mine = !!r.r_id && !!sessionHash && r.r_session === sessionHash;
      const state: PublicListItem["state"] =
        r.li_status === "purchased" ? "purchased" : r.r_id ? (mine ? "held_by_you" : "held") : "available";
      return {
        id: r.li_id,
        state,
        heldUntil: r.r_id ? Number(r.r_expires) : null,
        reservationId: mine ? r.r_id : null,
        product: {
          id: r.p_id,
          title: r.title,
          description: r.description,
          category: r.category,
          priceAgorot: Number(r.price_agorot),
          imageUrl: r.image_url,
          inStock: Number(r.stock) > 0,
          shop: { name: r.shop_name, city: r.city, logoUrl: r.logo_url },
        },
      };
    }),
  };
  c.header("Cache-Control", "no-store");
  return c.json(result);
});

/** Hold an item for 15 minutes so two guests can't buy the same gift. */
pub.post("/reservations", async (c) => {
  const { db, now } = c.var.deps;
  await enforce(c, "reserve", 20, 10 * 60_000);
  const input = await body(c, reserveSchema);
  const ts = now();
  await sweepExpired(db, ts);
  const list = await listBySlug(db, input.slug);
  const item = await one<{ id: string; status: string; stock: number }>(
    db,
    `SELECT li.id, li.status, COALESCE(s.quantity,0) AS stock FROM list_items li
     LEFT JOIN stock s ON s.product_id = li.product_id WHERE li.id = ? AND li.list_id = ?`,
    [input.listItemId, list.list_id],
  );
  if (!item) throw notFound("gift");
  if (item.status === "purchased") throw conflict("already_purchased", "this gift was already bought");
  if (Number(item.stock) <= 0) throw conflict("out_of_stock", "this gift is out of stock right now");

  const sessionHash = await sha256Hex(input.guestSession);
  const existing = await one<{ id: string; guest_session_hash: string; expires_at: number }>(
    db,
    "SELECT id, guest_session_hash, expires_at FROM reservations WHERE list_item_id = ? AND status = 'held'",
    [item.id],
  );
  if (existing) {
    if (existing.guest_session_hash !== sessionHash) {
      throw conflict("already_held", "someone else is buying this gift right now", { heldUntil: Number(existing.expires_at) });
    }
    // same guest: extend the hold
    await run(db, "UPDATE reservations SET expires_at = ? WHERE id = ?", [ts + HOLD_MS, existing.id]);
    return c.json({ id: existing.id, listItemId: item.id, expiresAt: ts + HOLD_MS });
  }
  const id = newId();
  try {
    await run(db, "INSERT INTO reservations (id, list_item_id, guest_session_hash, status, expires_at, created_at) VALUES (?,?,?,'held',?,?)", [
      id,
      item.id,
      sessionHash,
      ts + HOLD_MS,
      ts,
    ]);
  } catch (e) {
    // unique index uq_reservations_active lost the race
    if (String(e).includes("UNIQUE")) throw conflict("already_held", "someone else is buying this gift right now");
    throw e;
  }
  return c.json({ id, listItemId: item.id, expiresAt: ts + HOLD_MS }, 201);
});

pub.post("/reservations/release", async (c) => {
  const { db } = c.var.deps;
  const input = await body(c, releaseSchema);
  await run(db, "UPDATE reservations SET status = 'released' WHERE id = ? AND guest_session_hash = ? AND status = 'held'", [
    input.reservationId,
    await sha256Hex(input.guestSession),
  ]);
  return c.json({ ok: true });
});

class CheckoutAbort extends ApiError {}

pub.post("/checkout", async (c) => {
  const deps = c.var.deps;
  const { db, box, config, mailer, payments, now } = deps;
  await enforce(c, "checkout", 10, 10 * 60_000);
  const input = await body(c, checkoutSchema);
  const ts = now();
  await sweepExpired(db, ts);
  const list = await listBySlug(db, input.slug);
  const sessionHash = await sha256Hex(input.guestSession);
  const ids = [...new Set(input.reservationIds)];

  const lines = await all<{
    r_id: string;
    li_id: string;
    product_id: string;
    title: string;
    price_agorot: number;
    shop_id: string;
    shop_name: string;
    stock: number;
    webhook_url: string | null;
    webhook_secret_enc: string | null;
    shop_email_enc: string;
  }>(
    db,
    `SELECT r.id AS r_id, li.id AS li_id, p.id AS product_id, p.title, p.price_agorot, sh.id AS shop_id, sh.name AS shop_name,
            COALESCE(s.quantity,0) AS stock, sh.webhook_url, sh.webhook_secret_enc, sh.email_enc AS shop_email_enc
     FROM reservations r
     JOIN list_items li ON li.id = r.list_item_id
     JOIN products p ON p.id = li.product_id
     JOIN shops sh ON sh.id = p.shop_id
     LEFT JOIN stock s ON s.product_id = p.id
     WHERE r.id IN (${placeholders(ids.length)}) AND r.status = 'held' AND r.guest_session_hash = ?
       AND r.expires_at >= ? AND li.list_id = ? AND li.status = 'available'`,
    [...ids, sessionHash, ts, list.list_id],
  );
  if (lines.length !== ids.length) {
    const ok = new Set(lines.map((l) => l.r_id));
    throw conflict("reservation_invalid", "some holds expired or the gift was already bought — please refresh", {
      invalid: ids.filter((i) => !ok.has(i)),
    });
  }
  const outOfStock = lines.filter((l) => Number(l.stock) <= 0);
  if (outOfStock.length) throw conflict("out_of_stock", "a gift went out of stock", { items: outOfStock.map((l) => l.li_id) });

  const total = lines.reduce((s, l) => s + Number(l.price_agorot), 0);
  const { subtotal, vat } = splitGross(total, VAT_RATE_BP);
  const receiptId = newId();
  const receiptNumber = `BWL-${new Date(ts).toISOString().slice(2, 10).replace(/-/g, "")}-${randomBase62(5).toUpperCase()}`;
  const accessToken = randomToken();

  // 1) charge (mock). A real provider would confirm a hosted payment here; we never handle card data.
  const charge = await payments.charge({
    amountAgorot: total,
    currency: "ILS",
    description: `Birthday gift for ${list.first_name} (${receiptNumber})`,
    idempotencyKey: receiptId,
    buyerEmail: input.buyerEmail,
  });
  if (!charge.ok) throw new ApiError(402, "payment_failed", charge.failureReason ?? "payment failed");

  // 2) commit everything atomically; if anything raced us, roll back and refund.
  const byShop = new Map<string, typeof lines>();
  for (const l of lines) byShop.set(l.shop_id, [...(byShop.get(l.shop_id) ?? []), l]);
  const orderIds: Array<{ id: string; number: string; shopId: string; total: number; lines: typeof lines }> = [];
  try {
    await tx(db, async (t) => {
      await run(
        t,
        `INSERT INTO receipts (id, number, list_id, kid_first_name, buyer_name, buyer_email_enc, greeting, delivery_method, delivery_address_enc,
                               subtotal_agorot, vat_agorot, total_agorot, vat_rate_bp, access_token_hash, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          receiptId,
          receiptNumber,
          list.list_id,
          list.first_name,
          input.buyerName,
          await box.encrypt(input.buyerEmail),
          input.greeting || null,
          input.deliveryMethod,
          input.deliveryMethod === "delivery" ? await box.encrypt(input.deliveryAddress!) : null,
          subtotal,
          vat,
          total,
          VAT_RATE_BP,
          await sha256Hex(accessToken),
          ts,
        ],
      );
      let n = 1;
      for (const [shopId, shopLines] of byShop) {
        const orderId = newId();
        const number = `${receiptNumber}-${n++}`;
        const orderTotal = shopLines.reduce((s, l) => s + Number(l.price_agorot), 0);
        await run(t, "INSERT INTO orders (id, receipt_id, shop_id, number, status, total_agorot, created_at, updated_at) VALUES (?,?,?,?,'new',?,?,?)", [
          orderId,
          receiptId,
          shopId,
          number,
          orderTotal,
          ts,
          ts,
        ]);
        for (const l of shopLines) {
          const stockOk = await run(t, "UPDATE stock SET quantity = quantity - 1, updated_at = ? WHERE product_id = ? AND quantity >= 1", [ts, l.product_id]);
          if (stockOk !== 1) throw new CheckoutAbort(409, "out_of_stock", `"${l.title}" just went out of stock`);
          const itemOk = await run(t, "UPDATE list_items SET status = 'purchased', purchased_at = ? WHERE id = ? AND status = 'available'", [ts, l.li_id]);
          if (itemOk !== 1) throw new CheckoutAbort(409, "already_purchased", `"${l.title}" was just bought by someone else`);
          const resOk = await run(t, "UPDATE reservations SET status = 'converted' WHERE id = ? AND status = 'held'", [l.r_id]);
          if (resOk !== 1) throw new CheckoutAbort(409, "reservation_invalid", "your hold expired — please try again");
          await run(t, "INSERT INTO order_items (id, order_id, list_item_id, product_id, title_snapshot, price_agorot, quantity) VALUES (?,?,?,?,?,?,1)", [
            newId(),
            orderId,
            l.li_id,
            l.product_id,
            l.title,
            l.price_agorot,
          ]);
        }
        await notify(t, { recipientType: "shop", recipientId: shopId, kind: "order_new", title: `הזמנה חדשה ${number}`, body: shopLines.map((l) => l.title).join(", "), refId: orderId }, ts);
        orderIds.push({ id: orderId, number, shopId, total: orderTotal, lines: shopLines });
      }
      await run(t, "INSERT INTO payments (id, receipt_id, provider, provider_ref, amount_agorot, status, created_at) VALUES (?,?,?,?,?,'succeeded',?)", [
        newId(),
        receiptId,
        charge.provider,
        charge.reference,
        total,
        ts,
      ]);
      await notify(t, { recipientType: "kid", recipientId: list.user_id, ...GIFT_BOUGHT, refId: list.list_id }, ts);
      await audit(t, { actorType: "guest", action: "checkout.complete", targetType: "receipt", targetId: receiptId, meta: { items: lines.length, total }, ipHash: await ipHash(c) }, ts);
    });
  } catch (e) {
    await payments.refund(charge.reference, total);
    throw e;
  }

  // 3) after commit: emails + webhooks (best effort, short timeouts)
  const receipt = await buildReceipt(deps, receiptId);
  const billPath = `/bill/${receiptId}?t=${accessToken}`;
  const billUrl = `${config.PUBLIC_GUEST_URL.replace(/\/$/, "")}${billPath}`;
  await mailer.send(db, { to: input.buyerEmail, kind: "receipt", ...receiptEmail(receipt, billUrl) }, ts);
  await Promise.allSettled(
    orderIds.map(async (o) => {
      const first = o.lines[0]!;
      await mailer.send(
        db,
        { to: await box.decrypt(first.shop_email_enc), kind: "order_new", ...orderNewEmail(first.shop_name, o.number, o.lines.map((l) => l.title), o.total, `${config.PUBLIC_SHOP_URL}/orders`) },
        ts,
      );
      if (first.webhook_url && first.webhook_secret_enc) {
        await sendWebhook(deps, first.webhook_url, await box.decrypt(first.webhook_secret_enc), "order.created", {
          orderNumber: o.number,
          status: "new",
          totalAgorot: o.total,
          items: o.lines.map((l) => ({ productId: l.product_id, title: l.title, priceAgorot: Number(l.price_agorot), quantity: 1 })),
          deliveryMethod: input.deliveryMethod,
        });
      }
    }),
  );

  const result: CheckoutResult = { receiptId, receiptNumber, accessToken, billPath };
  return c.json(result, 201);
});

pub.get("/receipts/:id", async (c) => {
  const deps = c.var.deps;
  const id = c.req.param("id");
  const t = c.req.query("t") ?? "";
  const row = await one<{ access_token_hash: string }>(deps.db, "SELECT access_token_hash FROM receipts WHERE id = ?", [id]);
  if (!row || t.length < 20 || row.access_token_hash !== (await sha256Hex(t))) throw unauthorized("invalid receipt link");
  c.header("Cache-Control", "no-store");
  return c.json(await buildReceipt(deps, id));
});

