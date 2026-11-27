import { Hono } from "hono";
import { loginSchema, refreshSchema, shopDecisionSchema, type AdminShopRow, type OutboxRow } from "@bwl/shared";
import type { AppEnv } from "../context";
import { all, one, run } from "../db";
import { audit } from "../lib/audit";
import { issueTokens, requireAuth, revokeRefresh, rotateRefresh } from "../lib/auth";
import { notFound, unauthorized } from "../lib/errors";
import { dummyVerify, verifyPassword } from "../lib/passwords";
import { enforce, ipHash } from "../lib/rateLimit";
import { body } from "../lib/validate";
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
