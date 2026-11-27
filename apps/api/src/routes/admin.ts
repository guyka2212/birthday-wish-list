import { Hono } from "hono";
import { z } from "zod";
import { loginSchema, refreshSchema, shopDecisionSchema, TEMPLATE_KEYS, TEMPLATE_PLACEHOLDERS, templateUpdateSchema, type AdminShopRow, type OutboxRow } from "@bwl/shared";
import { getTemplate, listTemplates, renderTemplate, SAMPLE_VARS } from "../services/emailTemplates";
import type { AppEnv } from "../context";
import { all, one, run } from "../db";
import { audit } from "../lib/audit";
import { issueTokens, requireAuth, revokeRefresh, rotateRefresh } from "../lib/auth";
import { notFound, unauthorized } from "../lib/errors";
import { dummyVerify, verifyPassword } from "../lib/passwords";
import { enforce, ipHash } from "../lib/rateLimit";
import { body, parse } from "../lib/validate";
import { notify } from "../services/notify";
import { shopDecisionEmail } from "../email/templates";

export const adminAuth = new Hono<AppEnv>();

adminAuth.post("/login", async (c) => {
  const { db, box, config, now } = c.var.deps;
  const input = await body(c, loginSchema);
  const h = await box.blindIndex(input.email);
  await enforce(c, "login", 30, 15 * 60_000);
  await enforce(c, "login-acct", 5, 15 * 60_000, h.slice(0, 16));
  const a = await one<{ id: string; password_hash: string }>(db, "SELECT id, password_hash FROM admins WHERE email_hash = ?", [h]);
  const ok = a ? await verifyPassword(a.password_hash, input.password) : await dummyVerify(input.password);
  if (!ok || !a) throw unauthorized("wrong email or password");
  await audit(db, { actorType: "admin", actorId: a.id, action: "auth.login", ipHash: await ipHash(c) }, now());
  return c.json(await issueTokens(db, config.JWT_SECRET, a.id, "admin", now()));
});

adminAuth.post("/refresh", async (c) => {
  const { db, config, now } = c.var.deps;
  const { refreshToken } = await body(c, refreshSchema);
  return c.json((await rotateRefresh(db, config.JWT_SECRET, "admin", refreshToken, now())).tokens);
});

adminAuth.post("/logout", async (c) => {
  const { refreshToken } = await body(c, refreshSchema);
  await revokeRefresh(c.var.deps.db, refreshToken, c.var.deps.now());
  return c.json({ ok: true });
});

export const admin = new Hono<AppEnv>();
admin.use("*", requireAuth("admin"));

admin.get("/me", async (c) => {
  const a = await one<{ id: string; name: string }>(c.var.deps.db, "SELECT id, name FROM admins WHERE id = ?", [c.var.subjectId]);
  if (!a) throw unauthorized();
  return c.json(a);
});

admin.get("/shops", async (c) => {
  const { db, box } = c.var.deps;
  const status = c.req.query("status");
  const valid = ["pending", "approved", "rejected", "suspended"].includes(status ?? "");
  const rows = await all<{ id: string; name: string; city: string; contact_name: string; email_enc: string; status: AdminShopRow["status"]; created_at: number; products: number }>(
    db,
    `SELECT sh.id, sh.name, sh.city, sh.contact_name, sh.email_enc, sh.status, sh.created_at,
            (SELECT COUNT(*) FROM products p WHERE p.shop_id = sh.id) AS products
     FROM shops sh ${valid ? "WHERE sh.status = ?" : ""} ORDER BY sh.status = 'pending' DESC, sh.created_at DESC`,
    valid ? [status!] : [],
  );
  const items: AdminShopRow[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      contactName: r.contact_name,
      email: await box.decrypt(r.email_enc),
      status: r.status,
      createdAt: Number(r.created_at),
      products: Number(r.products),
    })),
  );
  return c.json({ items });
});

admin.post("/shops/:id/decision", async (c) => {
  const { db, box, config, mailer, now } = c.var.deps;
  const { decision } = await body(c, shopDecisionSchema);
  const s = await one<{ id: string; name: string; email_enc: string }>(db, "SELECT id, name, email_enc FROM shops WHERE id = ?", [c.req.param("id")]);
  if (!s) throw notFound("shop");
  const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "suspended";
  const ts = now();
  await run(db, `UPDATE shops SET status = ?, updated_at = ?, approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END WHERE id = ?`, [status, ts, status, ts, s.id]);
  await audit(db, { actorType: "admin", actorId: c.var.subjectId, action: "shop.decision", targetType: "shop", targetId: s.id, meta: { status } }, ts);
  await notify(db, { recipientType: "shop", recipientId: s.id, kind: "shop_decision", title: status === "approved" ? "החנות אושרה! 🎉" : "עדכון סטטוס חנות", body: status, refId: s.id }, ts);
  if (status !== "suspended") {
    await mailer.send(db, { to: await box.decrypt(s.email_enc), kind: "shop_decision", ...shopDecisionEmail(s.name, status === "approved", config.PUBLIC_SHOP_URL) }, ts);
  }
  return c.json({ ok: true, status });
});

admin.get("/outbox", async (c) => {
  const rows = await all<{ id: string; to_hint: string; subject: string; kind: string; provider: string; status: string; created_at: number; html: string }>(
    c.var.deps.db,
    "SELECT id, to_hint, subject, kind, provider, status, created_at, html FROM email_outbox ORDER BY created_at DESC LIMIT 50",
  );
  const items: OutboxRow[] = rows.map((r) => ({ id: r.id, toHint: r.to_hint, subject: r.subject, kind: r.kind, provider: r.provider, status: r.status, createdAt: Number(r.created_at), html: r.html }));
  return c.json({ items });
});

// ---- email templates the shops send to buyers ("set aside" / "not in stock") ----
admin.get("/templates", async (c) => c.json({ items: await listTemplates(c.var.deps.db), placeholders: TEMPLATE_PLACEHOLDERS }));

admin.put("/templates/:key", async (c) => {
  const { db, now } = c.var.deps;
  const key = parse(z.enum(TEMPLATE_KEYS), c.req.param("key"));
  const input = await body(c, templateUpdateSchema);
  const ts = now();
  await run(db, "UPDATE email_templates SET subject = ?, body = ?, updated_at = ?, updated_by = ? WHERE key = ?", [input.subject, input.body, ts, c.var.subjectId, key]);
  await audit(db, { actorType: "admin", actorId: c.var.subjectId, action: "template.update", targetType: "email_template", targetId: key }, ts);
  return c.json(await getTemplate(db, key));
});

/** Preview a (possibly unsaved) template with sample order data. */
admin.post("/templates/preview", async (c) => {
  const input = await body(c, templateUpdateSchema);
  const r = renderTemplate(input, SAMPLE_VARS);
  return c.json({ subject: r.subject, html: r.html });
});

admin.get("/stats", async (c) => {
  const db = c.var.deps.db;
  const q = async (sql: string) => Number((await one<{ n: number }>(db, sql))?.n ?? 0);
  return c.json({
    kids: await q("SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL"),
    lists: await q("SELECT COUNT(*) AS n FROM lists WHERE deleted_at IS NULL"),
    shops: await q("SELECT COUNT(*) AS n FROM shops WHERE status = 'approved'"),
    pendingShops: await q("SELECT COUNT(*) AS n FROM shops WHERE status = 'pending'"),
    orders: await q("SELECT COUNT(*) AS n FROM orders"),
    salesAgorot: await q("SELECT COALESCE(SUM(total_agorot),0) AS n FROM orders WHERE status != 'cancelled'"),
  });
});

/** Per-shop sales and activity for the admin dashboard (money stays admin-only; never on /health). */
admin.get("/shop-stats", async (c) => {
  const { db, now } = c.var.deps;
  const days = Math.min(Math.max(Number(c.req.query("days") ?? 30) || 30, 1), 365);
  const since = now() - days * 86_400_000;
  const shops = await all<{
    id: string; name: string; city: string; status: string; chain: string | null; products: number; in_stock: number;
    orders: number; sales: number; cancelled: number; waiting: number; ready: number; done: number; last_order: number | null; sales_period: number; orders_period: number;
  }>(
    db,
    `SELECT sh.id, sh.name, sh.city, sh.status, sh.business_id_hash AS chain,
       (SELECT COUNT(*) FROM products p WHERE p.shop_id = sh.id AND p.active = 1) AS products,
       (SELECT COUNT(*) FROM products p JOIN stock s ON s.product_id = p.id WHERE p.shop_id = sh.id AND p.active = 1 AND s.quantity > 0) AS in_stock,
       COUNT(o.id) AS orders,
       COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_agorot END), 0) AS sales,
       COALESCE(SUM(o.status = 'cancelled'), 0) AS cancelled,
       COALESCE(SUM(o.status = 'new'), 0) AS waiting,
       COALESCE(SUM(o.status = 'ready'), 0) AS ready,
       COALESCE(SUM(o.status = 'done'), 0) AS done,
       MAX(o.created_at) AS last_order,
       COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.created_at > ? THEN o.total_agorot END), 0) AS sales_period,
       COALESCE(SUM(o.created_at > ?), 0) AS orders_period
     FROM shops sh LEFT JOIN orders o ON o.shop_id = sh.id
     GROUP BY sh.id ORDER BY sales DESC, sh.name`,
    [since, since],
  );
  // label branches of the same chain (same business ID) so the admin can see them together
  const chainSize = new Map<string, number>();
  for (const s of shops) if (s.chain) chainSize.set(s.chain, (chainSize.get(s.chain) ?? 0) + 1);
  const chainNo = new Map<string, number>();
  for (const s of shops) if (s.chain && (chainSize.get(s.chain) ?? 0) > 1 && !chainNo.has(s.chain)) chainNo.set(s.chain, chainNo.size + 1);

  const byDay = await all<{ day: string; orders: number; sales: number }>(
    db,
    `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, COUNT(*) AS orders,
            COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_agorot END), 0) AS sales
     FROM orders WHERE created_at > ? GROUP BY day ORDER BY day`,
    [since],
  );
  const top = await all<{ title: string; shop: string; sold: number; sales: number }>(
    db,
    `SELECT oi.title_snapshot AS title, sh.name AS shop, SUM(oi.quantity) AS sold, SUM(oi.price_agorot * oi.quantity) AS sales
     FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN shops sh ON sh.id = o.shop_id
     WHERE o.status != 'cancelled' AND o.created_at > ?
     GROUP BY oi.title_snapshot, sh.id ORDER BY sold DESC, sales DESC LIMIT 10`,
    [since],
  );
  const items = shops.map((s) => ({
    id: s.id,
    name: s.name,
    city: s.city,
    status: s.status,
    chainNo: s.chain ? chainNo.get(s.chain) ?? null : null,
    products: Number(s.products),
    inStock: Number(s.in_stock),
    orders: Number(s.orders),
    salesAgorot: Number(s.sales),
    cancelled: Number(s.cancelled),
    waitingForStock: Number(s.waiting),
    ready: Number(s.ready),
    done: Number(s.done),
    lastOrderAt: s.last_order == null ? null : Number(s.last_order),
    periodSalesAgorot: Number(s.sales_period),
    periodOrders: Number(s.orders_period),
  }));
  const sum = (k: "orders" | "salesAgorot" | "cancelled" | "waitingForStock" | "periodSalesAgorot" | "periodOrders") => items.reduce((a, s) => a + s[k], 0);
  const completed = sum("orders") - sum("cancelled");
  return c.json({
    days,
    totals: {
      shops: items.length,
      orders: sum("orders"),
      salesAgorot: sum("salesAgorot"),
      cancelled: sum("cancelled"),
      waitingForStock: sum("waitingForStock"),
      periodOrders: sum("periodOrders"),
      periodSalesAgorot: sum("periodSalesAgorot"),
      avgOrderAgorot: completed > 0 ? Math.round(sum("salesAgorot") / completed) : 0,
    },
    shops: items,
    byDay: byDay.map((d) => ({ day: d.day, orders: Number(d.orders), salesAgorot: Number(d.sales) })),
    topProducts: top.map((t) => ({ title: t.title, shop: t.shop, sold: Number(t.sold), salesAgorot: Number(t.sales) })),
  });
});
