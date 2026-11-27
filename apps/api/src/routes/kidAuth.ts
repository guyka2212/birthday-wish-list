import { Hono } from "hono";
import { forgotSchema, kidSignupSchema, loginSchema, refreshSchema, resetSchema } from "@bwl/shared";
import type { AppEnv } from "../context";
import { one, run, tx } from "../db";
import { audit } from "../lib/audit";
import { issueTokens, revokeAll, revokeRefresh, rotateRefresh } from "../lib/auth";
import { newId, randomToken, sha256Hex } from "../lib/crypto";
import { conflict, unauthorized } from "../lib/errors";
import { dummyVerify, hashPassword, verifyPassword } from "../lib/passwords";
import { enforce, ipHash } from "../lib/rateLimit";
import { body } from "../lib/validate";
import { consentDonePage, consentEmail, resetEmail } from "../email/templates";

const CONSENT_TTL = 7 * 24 * 3600_000;
const RESET_TTL = 3600_000;

export const kidAuth = new Hono<AppEnv>();

kidAuth.post("/signup", async (c) => {
  const { db, box, config, mailer, now } = c.var.deps;
  await enforce(c, "signup", 10, 3600_000);
  const input = await body(c, kidSignupSchema);
  const emailHash = await box.blindIndex(input.email);
  const ts = now();

  if (await one(db, "SELECT 1 FROM users WHERE email_hash = ?", [emailHash])) {
    throw conflict("email_taken", "this email is already registered");
  }

  const userId = newId();
  const consentToken = randomToken();
  const autoVerify = config.AUTO_VERIFY_PARENT;
  const passwordHash = await hashPassword(input.password);

  await tx(db, async (t) => {
    await run(
      t,
      `INSERT INTO users (id, username, first_name, email_enc, email_hash, password_hash, birthday, avatar, locale, consent_status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        userId,
        input.username,
        input.firstName,
        await box.encrypt(input.email),
        emailHash,
        passwordHash,
        input.birthday ?? null,
        input.avatar ?? "🦄",
        input.locale ?? "he",
        autoVerify ? "verified" : "pending",
        ts,
        ts,
      ],
    );
    await run(
      t,
      `INSERT INTO parent_consents (id, user_id, parent_email_enc, parent_email_hash, token_hash, verified_at, expires_at, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        newId(),
        userId,
        await box.encrypt(input.parentEmail),
        await box.blindIndex(input.parentEmail),
        await sha256Hex(consentToken),
        autoVerify ? ts : null,
        ts + CONSENT_TTL,
        ts,
      ],
    );
    await audit(t, { actorType: "kid", actorId: userId, action: "auth.signup", ipHash: await ipHash(c) }, ts);
  });

  const verifyUrl = `${config.API_PUBLIC_URL}/auth/kid/consent/verify?token=${consentToken}`;
  await mailer.send(db, { to: input.parentEmail, kind: "consent", ...consentEmail(input.firstName, verifyUrl) }, ts);

  const tokens = await issueTokens(db, config.JWT_SECRET, userId, "kid", ts);
  return c.json({ ...tokens, consentStatus: autoVerify ? "verified" : "pending" }, 201);
});

kidAuth.get("/consent/verify", async (c) => {
  const { db, now } = c.var.deps;
  await enforce(c, "consent", 30, 3600_000);
  const token = c.req.query("token") ?? "";
  const ts = now();
  const row = token.length >= 20
    ? await one<{ id: string; user_id: string; expires_at: number; verified_at: number | null }>(
        db,
        "SELECT id, user_id, expires_at, verified_at FROM parent_consents WHERE token_hash = ?",
        [await sha256Hex(token)],
      )
    : undefined;
  const ok = !!row && !row.verified_at && Number(row.expires_at) > ts;
  if (ok) {
    await run(db, "UPDATE parent_consents SET verified_at = ? WHERE id = ?", [ts, row.id]);
    await run(db, "UPDATE users SET consent_status = 'verified', updated_at = ? WHERE id = ?", [ts, row.user_id]);
    await audit(db, { actorType: "guest", action: "consent.verified", targetType: "user", targetId: row.user_id }, ts);
  }
  return c.html(consentDonePage(ok), ok ? 200 : 400);
});

kidAuth.post("/login", async (c) => {
  const { db, box, config, now } = c.var.deps;
  const input = await body(c, loginSchema);
  const emailHash = await box.blindIndex(input.email);
  await enforce(c, "login", 30, 15 * 60_000); // per IP
  await enforce(c, "login-acct", 5, 15 * 60_000, emailHash.slice(0, 16)); // per IP + account
  const user = await one<{ id: string; password_hash: string }>(
    db,
    "SELECT id, password_hash FROM users WHERE email_hash = ? AND deleted_at IS NULL",
    [emailHash],
  );
  const ok = user ? await verifyPassword(user.password_hash, input.password) : await dummyVerify(input.password);
  const ts = now();
  if (!ok || !user) {
    await audit(db, { actorType: "kid", action: "auth.login_failed", ipHash: await ipHash(c) }, ts);
    throw unauthorized("wrong email or password");
  }
  await audit(db, { actorType: "kid", actorId: user.id, action: "auth.login", ipHash: await ipHash(c) }, ts);
  return c.json(await issueTokens(db, config.JWT_SECRET, user.id, "kid", ts));
});

kidAuth.post("/refresh", async (c) => {
  const { db, config, now } = c.var.deps;
  await enforce(c, "refresh", 60, 15 * 60_000);
  const { refreshToken } = await body(c, refreshSchema);
  const { tokens } = await rotateRefresh(db, config.JWT_SECRET, "kid", refreshToken, now());
  return c.json(tokens);
});

kidAuth.post("/logout", async (c) => {
  const { db, now } = c.var.deps;
  const { refreshToken } = await body(c, refreshSchema);
  await revokeRefresh(db, refreshToken, now());
  return c.json({ ok: true });
});

kidAuth.post("/forgot", async (c) => {
  const { db, box, config, mailer, now } = c.var.deps;
  await enforce(c, "forgot", 5, 3600_000);
  const { email } = await body(c, forgotSchema);
  const user = await one<{ id: string }>(db, "SELECT id FROM users WHERE email_hash = ? AND deleted_at IS NULL", [
    await box.blindIndex(email),
  ]);
  if (user) {
    const ts = now();
    const token = randomToken();
    await run(db, "INSERT INTO password_resets (id, subject_type, subject_id, token_hash, expires_at, created_at) VALUES (?,?,?,?,?,?)", [
      newId(),
      "kid",
      user.id,
      await sha256Hex(token),
      ts + RESET_TTL,
      ts,
    ]);
    const url = `${config.PUBLIC_GUEST_URL}/reset?type=kid&token=${token}`;
    await mailer.send(db, { to: email, kind: "reset", ...resetEmail(url) }, ts);
  }
  // Same answer either way, so this can't be used to discover accounts.
  return c.json({ ok: true });
});

kidAuth.post("/reset", async (c) => {
  await enforce(c, "reset", 10, 3600_000);
  const input = await body(c, resetSchema);
  await resetPassword(c.var.deps, "kid", input.token, input.password);
  return c.json({ ok: true });
});

export async function resetPassword(
  deps: AppEnv["Variables"]["deps"],
  typ: "kid" | "shop" | "admin",
  token: string,
  password: string,
) {
  const { db, now } = deps;
  const ts = now();
  const row = await one<{ id: string; subject_id: string; expires_at: number; used_at: number | null }>(
    db,
    "SELECT id, subject_id, expires_at, used_at FROM password_resets WHERE token_hash = ? AND subject_type = ?",
    [await sha256Hex(token), typ],
  );
  if (!row || row.used_at || Number(row.expires_at) < ts) throw unauthorized("reset link is invalid or expired");
  const table = typ === "kid" ? "users" : typ === "shop" ? "shops" : "admins";
  const hash = await hashPassword(password);
  await tx(db, async (t) => {
    await run(t, "UPDATE password_resets SET used_at = ? WHERE id = ?", [ts, row.id]);
    await run(t, `UPDATE ${table} SET password_hash = ? WHERE id = ?`, [hash, row.subject_id]);
    await revokeAll(t, typ, row.subject_id, ts);
    await audit(t, { actorType: typ, actorId: row.subject_id, action: "auth.password_reset" }, ts);
  });
}
