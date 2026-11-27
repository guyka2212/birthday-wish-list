import { Hono } from "hono";
import {
  forgotSchema,
  loginSchema,
  orderStatusUpdateSchema,
  productInputSchema,
  productPatchSchema,
  refreshSchema,
  resetSchema,
  shopSignupSchema,
  shopUpdateSchema,
  stockResponseSchema,
  stockSyncSchema,
  formatILS,
  type TemplateKey,
  type OrderStatus,
  type ShopDashboard,
  type ShopOrder,
  type ShopProduct,
  type ShopProfile,
} from "@bwl/shared";
import type { AppEnv, Deps } from "../context";
import type { Executor } from "../db";
import { all, one, run, tx } from "../db";
import { audit } from "../lib/audit";
import { issueTokens, requireAuth, revokeRefresh, rotateRefresh } from "../lib/auth";
import { newId, randomBase62, randomToken, sha256Hex } from "../lib/crypto";
import { ApiError, badRequest, conflict, forbidden, notFound, unauthorized } from "../lib/errors";
import { dummyVerify, hashPassword, verifyPassword } from "../lib/passwords";
import { enforce, ipHash } from "../lib/rateLimit";
import { body } from "../lib/validate";
import { GIFT_BOUGHT, notify, sendWebhook } from "../services/notify";
import { getTemplate, renderTemplate, type TemplateVars } from "../services/emailTemplates";
import { resetEmail, shopPendingEmail } from "../email/templates";
import { resetPassword } from "./kidAuth";
import { upsertProducts, syncStock } from "../services/products";

// ======================= auth =======================
export const shopAuth = new Hono<AppEnv>();

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return `${base || "shop"}-${randomBase62(4).toLowerCase()}`;
}

shopAuth.post("/signup", async (c) => {
  const { db, box, config, mailer, now } = c.var.deps;
  await enforce(c, "shop-signup", 5, 3600_000);
  const input = await body(c, shopSignupSchema);
  const emailHash = await box.blindIndex(input.email);
  if (await one(db, "SELECT 1 FROM shops WHERE email_hash = ?", [emailHash])) throw conflict("email_taken", "this email is already registered");
  const id = newId();
  const ts = now();
  await run(
    db,
    `INSERT INTO shops (id, name, slug, business_id_enc, address_enc, city, phone_enc, contact_name, email_enc, email_hash, password_hash,
                        logo_url, pickup_info, offers_delivery, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?)`,
    [
      id,
      input.name,
      slugify(input.name),
      await box.encrypt(input.businessId),
      await box.encrypt(input.address),
      input.city,
      await box.encrypt(input.phone),
      input.contactName,
      await box.encrypt(input.email),
      emailHash,
      await hashPassword(input.password),
      input.logoUrl ?? null,
      input.pickupInfo ?? null,
      input.offersDelivery ? 1 : 0,
      ts,
      ts,
    ],
  );
  await audit(db, { actorType: "shop", actorId: id, action: "shop.signup", ipHash: await ipHash(c) }, ts);
  // tell the admins
  const admins = await all<{ id: string; email_enc: string }>(db, "SELECT id, email_enc FROM admins");
  for (const a of admins) {
    await notify(db, { recipientType: "admin", recipientId: a.id, kind: "shop_pending", title: "חנות חדשה ממתינה", body: input.name, refId: id }, ts);
    await mailer.send(db, { to: await box.decrypt(a.email_enc), kind: "shop_pending", ...shopPendingEmail(input.name, `${config.PUBLIC_SHOP_URL}/admin`) }, ts);
  }
  return c.json(await issueTokens(db, config.JWT_SECRET, id, "shop", ts), 201);
});

shopAuth.post("/login", async (c) => {
  const { db, box, config, now } = c.var.deps;
  const input = await body(c, loginSchema);
  const emailHash = await box.blindIndex(input.email);
  await enforce(c, "login", 30, 15 * 60_000);
  await enforce(c, "login-acct", 5, 15 * 60_000, emailHash.slice(0, 16));
  const shop = await one<{ id: string; password_hash: string; status: string }>(db, "SELECT id, password_hash, status FROM shops WHERE email_hash = ?", [emailHash]);
  const ok = shop ? await verifyPassword(shop.password_hash, input.password) : await dummyVerify(input.password);
  if (!ok || !shop) throw unauthorized("wrong email or password");
  if (shop.status === "suspended") throw forbidden("shop_suspended", "this shop is suspended");
  await audit(db, { actorType: "shop", actorId: shop.id, action: "auth.login", ipHash: await ipHash(c) }, now());
  return c.json(await issueTokens(db, config.JWT_SECRET, shop.id, "shop", now()));
});

shopAuth.post("/refresh", async (c) => {
  const { db, config, now } = c.var.deps;
  const { refreshToken } = await body(c, refreshSchema);
  return c.json((await rotateRefresh(db, config.JWT_SECRET, "shop", refreshToken, now())).tokens);
});

shopAuth.post("/logout", async (c) => {
  const { refreshToken } = await body(c, refreshSchema);
  await revokeRefresh(c.var.deps.db, refreshToken, c.var.deps.now());
  return c.json({ ok: true });
});

shopAuth.post("/forgot", async (c) => {
  const { db, box, config, mailer, now } = c.var.deps;
  await enforce(c, "forgot", 5, 3600_000);
  const { email } = await body(c, forgotSchema);
  const shop = await one<{ id: string }>(db, "SELECT id FROM shops WHERE email_hash = ?", [await box.blindIndex(email)]);
  if (shop) {
    const token = randomToken();
    const ts = now();
    await run(db, "INSERT INTO password_resets (id, subject_type, subject_id, token_hash, expires_at, created_at) VALUES (?,?,?,?,?,?)", [
      newId(),
      "shop",
      shop.id,
      await sha256Hex(token),
      ts + 3600_000,
      ts,
    ]);
    await mailer.send(db, { to: email, kind: "reset", ...resetEmail(`${config.PUBLIC_SHOP_URL}/reset?token=${token}`) }, ts);
  }
  return c.json({ ok: true });
});

shopAuth.post("/reset", async (c) => {
  await enforce(c, "reset", 10, 3600_000);
  const input = await body(c, resetSchema);
  await resetPassword(c.var.deps, "shop", input.token, input.password);
  return c.json({ ok: true });
});

// ======================= dashboard (JWT) =======================
export const shop = new Hono<AppEnv>();
shop.use("*", requireAuth("shop"));

interface ShopRow {
  id: string;
  name: string;
  slug: string;
  email_enc: string;
  business_id_enc: string;
  address_enc: string;
  city: string;
  phone_enc: string;
  contact_name: string;
  logo_url: string | null;
  brand_color: string;
  status: ShopProfile["status"];
  pickup_info: string | null;
  offers_delivery: number;
  webhook_url: string | null;
}

export async function loadShopProfile(deps: Deps, id: string): Promise<ShopProfile> {
  const s = await one<ShopRow>(deps.db, "SELECT * FROM shops WHERE id = ?", [id]);
  if (!s) throw unauthorized("shop not found");
  const key = await one<{ prefix: string }>(deps.db, "SELECT prefix FROM shop_api_keys WHERE shop_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1", [id]);
  const { box } = deps;
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    email: await box.decrypt(s.email_enc),
    businessId: await box.decrypt(s.business_id_enc),
    address: await box.decrypt(s.address_enc),
    city: s.city,
    phone: await box.decrypt(s.phone_enc),
    contactName: s.contact_name,
    logoUrl: s.logo_url,
    brandColor: s.brand_color,
    status: s.status,
    pickupInfo: s.pickup_info,
    offersDelivery: !!Number(s.offers_delivery),
    webhookUrl: s.webhook_url,
    apiKeyPrefix: key?.prefix ?? null,
  };
}

async function requireApproved(deps: Deps, shopId: string) {
  const s = await one<{ status: string }>(deps.db, "SELECT status FROM shops WHERE id = ?", [shopId]);
  if (s?.status !== "approved") throw forbidden("shop_not_approved", "this shop is waiting for approval");
}

shop.get("/me", async (c) => c.json(await loadShopProfile(c.var.deps, c.var.subjectId)));

shop.patch("/me", async (c) => {
  const deps = c.var.deps;
  const { db, box, now } = deps;
  const input = await body(c, shopUpdateSchema);
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const set = (col: string, v: string | number | null) => {
    sets.push(`${col} = ?`);
    args.push(v);
  };
  if (input.name !== undefined) set("name", input.name);
  if (input.address !== undefined) set("address_enc", await box.encrypt(input.address));
  if (input.city !== undefined) set("city", input.city);
  if (input.phone !== undefined) set("phone_enc", await box.encrypt(input.phone));
  if (input.contactName !== undefined) set("contact_name", input.contactName);
  if (input.logoUrl !== undefined) set("logo_url", input.logoUrl);
  if (input.pickupInfo !== undefined) set("pickup_info", input.pickupInfo);
  if (input.offersDelivery !== undefined) set("offers_delivery", input.offersDelivery ? 1 : 0);
  let webhookSecret: string | undefined;
  if (input.webhookUrl !== undefined) {
    set("webhook_url", input.webhookUrl);
    if (input.webhookUrl) {
      webhookSecret = `whsec_${randomBase62(32)}`;
      set("webhook_secret_enc", await box.encrypt(webhookSecret));
    } else set("webhook_secret_enc", null);
  }
  if (sets.length) {
    set("updated_at", now());
    await run(db, `UPDATE shops SET ${sets.join(", ")} WHERE id = ?`, [...args, c.var.subjectId]);
    await audit(db, { actorType: "shop", actorId: c.var.subjectId, action: "shop.update" }, now());
  }
  // the webhook signing secret is shown once, right after it's created
  return c.json({ ...(await loadShopProfile(deps, c.var.subjectId)), webhookSecret });
});

shop.get("/dashboard", async (c) => {
  const deps = c.var.deps;
  const { db, now } = deps;
  const id = c.var.subjectId;
  const t = await one<{ sales: number; orders: number; open: number }>(
    db,
    `SELECT COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_agorot END), 0) AS sales,
            COUNT(*) AS orders,
            SUM(CASE WHEN status IN ('new','preparing','ready','shipped') THEN 1 ELSE 0 END) AS open
     FROM orders WHERE shop_id = ?`,
    [id],
  );
  const p = await one<{ active: number; low: number }>(
    db,
    `SELECT SUM(CASE WHEN p.active = 1 THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN p.active = 1 AND COALESCE(s.quantity,0) <= 2 THEN 1 ELSE 0 END) AS low
     FROM products p LEFT JOIN stock s ON s.product_id = p.id WHERE p.shop_id = ?`,
    [id],
  );
  const since = now() - 13 * 86_400_000;
  const days = await all<{ day: string; sales: number }>(
    db,
    `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, SUM(total_agorot) AS sales
     FROM orders WHERE shop_id = ? AND status != 'cancelled' AND created_at >= ? GROUP BY day ORDER BY day`,
    [id, since],
  );
  const salesByDay: ShopDashboard["salesByDay"] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now() - i * 86_400_000).toISOString().slice(0, 10);
    salesByDay.push({ day, salesAgorot: Number(days.find((d) => d.day === day)?.sales ?? 0) });
  }
  const result: ShopDashboard = {
    shop: await loadShopProfile(deps, id),
    totals: {
      salesAgorot: Number(t?.sales ?? 0),
      orders: Number(t?.orders ?? 0),
      openOrders: Number(t?.open ?? 0),
      productsActive: Number(p?.active ?? 0),
      lowStock: Number(p?.low ?? 0),
    },
    salesByDay,
  };
  return c.json(result);
});

// ---- products ----
export async function shopProducts(db: Executor, shopId: string): Promise<ShopProduct[]> {
  const rows = await all<{
    id: string;
    external_sku: string;
    title: string;
    description: string;
    category: ShopProduct["category"];
    price_agorot: number;
    image_url: string | null;
    age_min: number | null;
    age_max: number | null;
    active: number;
    quantity: number;
    updated_at: number;
  }>(
    db,
    `SELECT p.*, COALESCE(s.quantity, 0) AS quantity FROM products p LEFT JOIN stock s ON s.product_id = p.id
     WHERE p.shop_id = ? ORDER BY p.title COLLATE NOCASE`,
    [shopId],
  );
  return rows.map((r) => ({
    id: r.id,
    sku: r.external_sku,
    title: r.title,
    description: r.description,
    category: r.category,
    priceAgorot: Number(r.price_agorot),
    imageUrl: r.image_url,
    ageMin: r.age_min == null ? null : Number(r.age_min),
    ageMax: r.age_max == null ? null : Number(r.age_max),
    active: !!Number(r.active),
    stock: Number(r.quantity),
    updatedAt: Number(r.updated_at),
  }));
}

shop.get("/products", async (c) => c.json({ items: await shopProducts(c.var.deps.db, c.var.subjectId) }));

shop.post("/products", async (c) => {
  const { db, now } = c.var.deps;
  const input = await body(c, productInputSchema);
  if (await one(db, "SELECT 1 FROM products WHERE shop_id = ? AND external_sku = ?", [c.var.subjectId, input.sku])) {
    throw conflict("sku_taken", "a product with this SKU already exists");
  }
  await upsertProducts(db, c.var.subjectId, [input], now());
  await audit(db, { actorType: "shop", actorId: c.var.subjectId, action: "product.create", meta: { sku: input.sku } }, now());
  const items = await shopProducts(db, c.var.subjectId);
  return c.json(items.find((p) => p.sku === input.sku), 201);
});

shop.patch("/products/:id", async (c) => {
  const { db, now } = c.var.deps;
  const input = await body(c, productPatchSchema);
  const p = await one<{ id: string; external_sku: string }>(db, "SELECT id, external_sku FROM products WHERE id = ? AND shop_id = ?", [
    c.req.param("id"),
    c.var.subjectId,
  ]);
  if (!p) throw notFound("product");
  const ts = now();
  const map: Record<string, string> = {
    title: "title",
    description: "description",
    category: "category",
    priceAgorot: "price_agorot",
    imageUrl: "image_url",
    ageMin: "age_min",
    ageMax: "age_max",
  };
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  for (const [k, col] of Object.entries(map)) {
    const v = (input as Record<string, string | number | null | undefined>)[k];
    if (v !== undefined) {
      sets.push(`${col} = ?`);
      args.push(v);
    }
  }
  if (input.active !== undefined) {
    sets.push("active = ?");
    args.push(input.active ? 1 : 0);
  }
  if (sets.length) await run(db, `UPDATE products SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`, [...args, ts, p.id]);
  if (input.stock !== undefined) {
    await run(db, "INSERT INTO stock (product_id, quantity, updated_at) VALUES (?,?,?) ON CONFLICT(product_id) DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at", [
      p.id,
      input.stock,
      ts,
    ]);
  }
  await audit(db, { actorType: "shop", actorId: c.var.subjectId, action: "product.update", meta: { sku: p.external_sku } }, ts);
  return c.json((await shopProducts(db, c.var.subjectId)).find((x) => x.id === p.id));
});

shop.delete("/products/:id", async (c) => {
  // soft-delete: hide from the catalog (it may be on lists / in past orders)
  const { db, now } = c.var.deps;
  const n = await run(db, "UPDATE products SET active = 0, updated_at = ? WHERE id = ? AND shop_id = ?", [now(), c.req.param("id"), c.var.subjectId]);
  if (!n) throw notFound("product");
  return c.json({ ok: true });
});

shop.post("/stock/sync", async (c) => {
  const { db, now } = c.var.deps;
  const input = await body(c, stockSyncSchema);
  return c.json(await syncStock(db, c.var.subjectId, input.items, now()));
});

// ---- orders ----
export async function shopOrders(deps: Deps, shopId: string, status?: string): Promise<ShopOrder[]> {
  const { db, box } = deps;
  const rows = await all<{
    id: string;
    number: string;
    status: OrderStatus;
    total_agorot: number;
    created_at: number;
    updated_at: number;
    receipt_number: string;
    buyer_name: string;
    kid_first_name: string;
    greeting: string | null;
    delivery_method: "pickup" | "delivery";
    delivery_address_enc: string | null;
    decline_reason: string | null;
    responded_at: number | null;
    buyer_notified_at: number | null;
    buyer_notified_count: number;
  }>(
    db,
    `SELECT o.id, o.number, o.status, o.total_agorot, o.created_at, o.updated_at, r.number AS receipt_number, r.buyer_name,
            r.kid_first_name, r.greeting, r.delivery_method, r.delivery_address_enc,
            o.decline_reason, o.responded_at, o.buyer_notified_at, o.buyer_notified_count
     FROM orders o JOIN receipts r ON r.id = o.receipt_id
     WHERE o.shop_id = ? ${status ? "AND o.status = ?" : ""} ORDER BY o.created_at DESC LIMIT 200`,
    status ? [shopId, status] : [shopId],
  );
  const items = await all<{ order_id: string; title_snapshot: string; price_agorot: number; quantity: number; sku: string }>(
    db,
    `SELECT oi.order_id, oi.title_snapshot, oi.price_agorot, oi.quantity, p.external_sku AS sku
     FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id WHERE o.shop_id = ?`,
    [shopId],
  );
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      number: r.number,
      receiptNumber: r.receipt_number,
      status: r.status,
      totalAgorot: Number(r.total_agorot),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
      buyerName: r.buyer_name,
      kidFirstName: r.kid_first_name,
      greeting: r.greeting,
      deliveryMethod: r.delivery_method,
      deliveryAddress: await box.decryptNullable(r.delivery_address_enc),
      items: items
        .filter((i) => i.order_id === r.id)
        .map((i) => ({ title: i.title_snapshot, sku: i.sku, priceAgorot: Number(i.price_agorot), quantity: Number(i.quantity) })),
      declineReason: r.decline_reason,
      respondedAt: r.responded_at == null ? null : Number(r.responded_at),
      buyerNotifiedAt: r.buyer_notified_at == null ? null : Number(r.buyer_notified_at),
      buyerNotifiedCount: Number(r.buyer_notified_count ?? 0),
    })),
  );
}

shop.get("/orders", async (c) => {
  const status = c.req.query("status");
  if (status && !["new", "preparing", "ready", "shipped", "done", "cancelled"].includes(status)) throw badRequest("bad_status", "unknown status");
  return c.json({ items: await shopOrders(c.var.deps, c.var.subjectId, status) });
});

// "new" orders go through the stock check (POST /orders/:id/stock) instead of a plain status change.
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  new: ["cancelled"],
  preparing: ["ready", "shipped", "cancelled"],
  ready: ["done"],
  shipped: ["done"],
  done: [],
  cancelled: [],
};

shop.patch("/orders/:id", async (c) => {
  const deps = c.var.deps;
  const { db, box, now } = deps;
  const { status } = await body(c, orderStatusUpdateSchema);
  const o = await one<{ id: string; number: string; status: OrderStatus; webhook_url: string | null; webhook_secret_enc: string | null }>(
    db,
    "SELECT o.id, o.number, o.status, sh.webhook_url, sh.webhook_secret_enc FROM orders o JOIN shops sh ON sh.id = o.shop_id WHERE o.id = ? AND o.shop_id = ?",
    [c.req.param("id"), c.var.subjectId],
  );
  if (!o) throw notFound("order");
  if (!NEXT[o.status].includes(status)) throw badRequest("bad_transition", `can't move an order from ${o.status} to ${status}`);
  const ts = now();
  await tx(db, async (t) => {
    await run(t, "UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", [status, ts, o.id]);
    if (status === "cancelled") {
      // put the gift back on the list and back in stock
      const items = await all<{ list_item_id: string; product_id: string; quantity: number }>(t, "SELECT list_item_id, product_id, quantity FROM order_items WHERE order_id = ?", [o.id]);
      for (const i of items) {
        await run(t, "UPDATE stock SET quantity = quantity + ?, updated_at = ? WHERE product_id = ?", [i.quantity, ts, i.product_id]);
        await run(t, "UPDATE list_items SET status = 'available', purchased_at = NULL WHERE id = ?", [i.list_item_id]);
      }
    }
    await audit(t, { actorType: "shop", actorId: c.var.subjectId, action: "order.status", targetType: "order", targetId: o.id, meta: { from: o.status, to: status } }, ts);
  });
  if (o.webhook_url && o.webhook_secret_enc) {
    await sendWebhook(deps, o.webhook_url, await box.decrypt(o.webhook_secret_enc), "order.status_changed", { orderNumber: o.number, from: o.status, status });
  }
  return c.json((await shopOrders(deps, c.var.subjectId)).find((x) => x.id === o.id));
});

// ---- stock check: the shop confirms the gift is in stock (and sets it aside) or declines ----
shop.post("/orders/:id/stock", async (c) => {
  const deps = c.var.deps;
  const { db, box, payments, now } = deps;
  const { inStock } = await body(c, stockResponseSchema);
  const o = await one<{
    id: string; number: string; status: OrderStatus; total_agorot: number; receipt_id: string; list_id: string; user_id: string;
    webhook_url: string | null; webhook_secret_enc: string | null;
  }>(
    db,
    `SELECT o.id, o.number, o.status, o.total_agorot, o.receipt_id, r.list_id, l.user_id, sh.webhook_url, sh.webhook_secret_enc
     FROM orders o JOIN shops sh ON sh.id = o.shop_id JOIN receipts r ON r.id = o.receipt_id JOIN lists l ON l.id = r.list_id
     WHERE o.id = ? AND o.shop_id = ?`,
    [c.req.param("id"), c.var.subjectId],
  );
  if (!o) throw notFound("order");
  if (o.status !== "new") throw conflict("already_answered", "this order was already answered");
  const ts = now();
  let refundRef: string | null = null;
  if (!inStock) {
    const pay = await one<{ provider_ref: string }>(db, "SELECT provider_ref FROM payments WHERE receipt_id = ? AND status = 'succeeded' LIMIT 1", [o.receipt_id]);
    if (pay) {
      await payments.refund(pay.provider_ref, Number(o.total_agorot));
      refundRef = pay.provider_ref;
    }
  }
  await tx(db, async (t) => {
    if (inStock) {
      await run(t, "UPDATE orders SET status = 'ready', responded_at = ?, updated_at = ? WHERE id = ?", [ts, ts, o.id]);
      // the gift is really on its way now — tell the kid (never who or what)
      await notify(t, { recipientType: "kid", recipientId: o.user_id, ...GIFT_BOUGHT, refId: o.list_id }, ts);
    } else {
      await run(t, "UPDATE orders SET status = 'cancelled', decline_reason = 'unavailable', responded_at = ?, updated_at = ? WHERE id = ?", [ts, ts, o.id]);
      const items = await all<{ list_item_id: string; product_id: string }>(t, "SELECT list_item_id, product_id FROM order_items WHERE order_id = ?", [o.id]);
      for (const i of items) {
        // the shop has none: mark it out of stock and put the gift back on the kid's list
        await run(t, "UPDATE stock SET quantity = 0, updated_at = ? WHERE product_id = ?", [ts, i.product_id]);
        await run(t, "UPDATE list_items SET status = 'available', purchased_at = NULL WHERE id = ?", [i.list_item_id]);
      }
      if (refundRef) {
        await run(t, "INSERT INTO payments (id, receipt_id, provider, provider_ref, amount_agorot, status, created_at) VALUES (?,?,?,?,?,'refunded',?)", [
          newId(), o.receipt_id, payments.name, refundRef, o.total_agorot, ts,
        ]);
      }
    }
    await audit(t, { actorType: "shop", actorId: c.var.subjectId, action: inStock ? "order.set_aside" : "order.unavailable", targetType: "order", targetId: o.id }, ts);
  });
  if (o.webhook_url && o.webhook_secret_enc) {
    await sendWebhook(deps, o.webhook_url, await box.decrypt(o.webhook_secret_enc), "order.status_changed", {
      orderNumber: o.number, from: "new", status: inStock ? "ready" : "cancelled",
    });
  }
  return c.json((await shopOrders(deps, c.var.subjectId)).find((x) => x.id === o.id));
});

/** Builds the admin template + values for an answered order. */
async function orderEmail(deps: Deps, shopId: string, orderId: string) {
  const { db, box, config } = deps;
  const o = await one<{
    id: string; number: string; status: OrderStatus; decline_reason: string | null; total_agorot: number; created_at: number;
    buyer_name: string; buyer_email_enc: string; kid_first_name: string; receipt_id: string; access_token_enc: string | null; list_id: string;
    shop_name: string; address_enc: string; city: string; phone_enc: string; pickup_info: string | null;
  }>(
    db,
    `SELECT o.id, o.number, o.status, o.decline_reason, o.total_agorot, o.created_at, r.buyer_name, r.buyer_email_enc, r.kid_first_name,
            r.id AS receipt_id, r.access_token_enc, r.list_id, sh.name AS shop_name, sh.address_enc, sh.city, sh.phone_enc, sh.pickup_info
     FROM orders o JOIN receipts r ON r.id = o.receipt_id JOIN shops sh ON sh.id = o.shop_id WHERE o.id = ? AND o.shop_id = ?`,
    [orderId, shopId],
  );
  if (!o) throw notFound("order");
  const key: TemplateKey | null =
    o.status === "cancelled" && o.decline_reason === "unavailable" ? "unavailable" : o.status === "new" || o.status === "cancelled" ? null : "set_aside";
  if (!key) throw badRequest("not_answered", "check the stock first (in stock / not in stock)");
  const items = await all<{ title_snapshot: string; price_agorot: number; quantity: number }>(
    db, "SELECT title_snapshot, price_agorot, quantity FROM order_items WHERE order_id = ?", [o.id],
  );
  const slug = await one<{ slug: string }>(db, "SELECT slug FROM share_links WHERE list_id = ? AND enabled = 1 AND revoked_at IS NULL LIMIT 1", [o.list_id]);
  const guest = config.PUBLIC_GUEST_URL.replace(/\/$/, "");
  const token = await box.decryptNullable(o.access_token_enc);
  const vars: TemplateVars = {
    orderNumber: o.number,
    buyerName: o.buyer_name,
    kidName: o.kid_first_name,
    shopName: o.shop_name,
    shopAddress: `${await box.decrypt(o.address_enc)}, ${o.city}`,
    shopPhone: await box.decrypt(o.phone_enc),
    pickupInfo: o.pickup_info ?? "",
    items: items.map((i) => `• ${i.title_snapshot}${i.quantity > 1 ? " ×" + i.quantity : ""} — ${formatILS(i.price_agorot * i.quantity)}`).join("\n"),
    total: formatILS(Number(o.total_agorot)),
    date: new Date(Number(o.created_at)).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" }),
    receiptLink: token ? `${guest}/bill/${o.receipt_id}?t=${token}` : "",
    listLink: slug ? `${guest}/l/${slug.slug}` : "",
  };
  const template = await getTemplate(db, key);
  return { order: o, key, rendered: renderTemplate(template, vars), to: await box.decrypt(o.buyer_email_enc) };
}

/** What the buyer email will look like, so the shop sees it before pressing send. */
shop.get("/orders/:id/email-preview", async (c) => {
  const { key, rendered } = await orderEmail(c.var.deps, c.var.subjectId, c.req.param("id"));
  return c.json({ template: key, subject: rendered.subject, text: rendered.text });
});

/** The shop presses "send email to buyer": the admin's template filled with this order's details. */
shop.post("/orders/:id/notify-buyer", async (c) => {
  const deps = c.var.deps;
  const { db, mailer, now } = deps;
  await enforce(c, "notify-buyer", 30, 3600_000);
  const { order, key, rendered, to } = await orderEmail(deps, c.var.subjectId, c.req.param("id"));
  const ts = now();
  const ok = await mailer.send(db, { to, subject: rendered.subject, html: rendered.html, kind: `order_${key}` }, ts);
  if (!ok) throw new ApiError(502, "email_failed", "the email could not be sent, try again");
  await run(db, "UPDATE orders SET buyer_notified_at = ?, buyer_notified_count = buyer_notified_count + 1, updated_at = ? WHERE id = ?", [ts, ts, order.id]);
  await audit(db, { actorType: "shop", actorId: c.var.subjectId, action: "order.notify_buyer", targetType: "order", targetId: order.id, meta: { template: key } }, ts);
  return c.json((await shopOrders(deps, c.var.subjectId)).find((x) => x.id === order.id));
});

// ---- API key ----
shop.post("/api-key/rotate", async (c) => {
  const deps = c.var.deps;
  const { db, now } = deps;
  await requireApproved(deps, c.var.subjectId);
  await enforce(c, "key-rotate", 10, 3600_000);
  const key = `bwl_live_${randomBase62(32)}`;
  const ts = now();
  await tx(db, async (t) => {
    await run(t, "UPDATE shop_api_keys SET revoked_at = ? WHERE shop_id = ? AND revoked_at IS NULL", [ts, c.var.subjectId]);
    await run(t, "INSERT INTO shop_api_keys (id, shop_id, prefix, key_hash, created_at) VALUES (?,?,?,?,?)", [
      newId(),
      c.var.subjectId,
      key.slice(0, 13),
      await sha256Hex(key),
      ts,
    ]);
    await audit(t, { actorType: "shop", actorId: c.var.subjectId, action: "api_key.rotate" }, ts);
  });
  // shown exactly once; only the hash is stored
  return c.json({ apiKey: key, prefix: key.slice(0, 13) }, 201);
});

shop.get("/notifications", async (c) => {
  const rows = await all(c.var.deps.db, "SELECT id, kind, title, body, ref_id, read_at, created_at FROM notifications WHERE recipient_type = 'shop' AND recipient_id = ? ORDER BY created_at DESC LIMIT 30", [c.var.subjectId]);
  return c.json({ items: rows });
});
