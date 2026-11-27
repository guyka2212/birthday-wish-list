import { describe, expect, it } from "vitest";
import { kidInput, setup, signupKid } from "./helpers";

describe("kid sign-up and login", () => {
  it("signs up, stores the email encrypted, and sends a parent consent email", async () => {
    const ctx = await setup({ AUTO_VERIFY_PARENT: "false" });
    const input = kidInput();
    const r = await ctx.call("POST", "/auth/kid/signup", input);
    expect(r.status).toBe(201);
    expect(r.json.accessToken).toBeTruthy();
    expect(r.json.consentStatus).toBe("pending");

    const row = (await ctx.deps.db.execute("SELECT email_enc, password_hash FROM users")).rows[0]!;
    expect(String(row.email_enc)).toMatch(/^v1:/);
    expect(String(row.email_enc)).not.toContain(input.email);
    expect(String(row.password_hash)).toMatch(/^\$argon2id\$/);

    const mail = (await ctx.deps.db.execute("SELECT kind, to_hint, html FROM email_outbox")).rows;
    expect(mail).toHaveLength(1);
    expect(mail[0]!.kind).toBe("consent");
    expect(String(mail[0]!.to_hint)).toBe("m***@e***.com");
  });

  it("blocks sharing until the parent verifies, then allows it", async () => {
    const ctx = await setup({ AUTO_VERIFY_PARENT: "false" });
    const kid = await signupKid(ctx);
    const list = await ctx.call("POST", "/kid/lists", { name: "B-day" }, { token: kid.accessToken });
    const denied = await ctx.call("POST", `/kid/lists/${list.json.id}/share`, {}, { token: kid.accessToken });
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe("consent_required");

    const html = String((await ctx.deps.db.execute("SELECT html FROM email_outbox WHERE kind = 'consent'")).rows[0]!.html);
    const token = html.match(/token=([A-Za-z0-9]+)/)![1];
    const verify = await ctx.call("GET", `/auth/kid/consent/verify?token=${token}`);
    expect(verify.status).toBe(200);
    const again = await ctx.call("GET", `/auth/kid/consent/verify?token=${token}`);
    expect(again.status).toBe(400); // single use

    const ok = await ctx.call("POST", `/kid/lists/${list.json.id}/share`, {}, { token: kid.accessToken });
    expect(ok.status).toBe(200);
    expect(ok.json.share.slug).toMatch(/^[A-Za-z0-9]{22}$/);
  });

  it("rejects duplicate emails and weak input", async () => {
    const ctx = await setup();
    const kid = await signupKid(ctx);
    const dup = await ctx.call("POST", "/auth/kid/signup", kidInput({ email: kid.input.email.toUpperCase() }));
    expect(dup.status).toBe(409);
    const weak = await ctx.call("POST", "/auth/kid/signup", kidInput({ password: "short" }));
    expect(weak.status).toBe(400);
    expect(weak.json.error.code).toBe("validation_failed");
    const noParent = await ctx.call("POST", "/auth/kid/signup", { ...kidInput(), parentEmail: "nope" });
    expect(noParent.status).toBe(400);
  });

  it("logs in, refreshes with rotation, and detects refresh-token reuse", async () => {
    const ctx = await setup();
    const kid = await signupKid(ctx);
    const login = await ctx.call("POST", "/auth/kid/login", { email: kid.input.email, password: kid.input.password });
    expect(login.status).toBe(200);
    const me = await ctx.call("GET", "/kid/me", undefined, { token: login.json.accessToken });
    expect(me.json.email).toBe(kid.input.email.toLowerCase());

    const r1 = await ctx.call("POST", "/auth/kid/refresh", { refreshToken: login.json.refreshToken });
    expect(r1.status).toBe(200);
    const reuse = await ctx.call("POST", "/auth/kid/refresh", { refreshToken: login.json.refreshToken });
    expect(reuse.status).toBe(401);
    // reuse revoked the whole family, so the newest token is dead too
    const r2 = await ctx.call("POST", "/auth/kid/refresh", { refreshToken: r1.json.refreshToken });
    expect(r2.status).toBe(401);
  });

  it("expires access tokens after 15 minutes", async () => {
    const ctx = await setup();
    const kid = await signupKid(ctx);
    expect((await ctx.call("GET", "/kid/me", undefined, { token: kid.accessToken })).status).toBe(200);
    // jose checks real time, so verify the token's own exp claim
    const payload = JSON.parse(Buffer.from(kid.accessToken.split(".")[1]!, "base64url").toString());
    expect(payload.exp - payload.iat).toBe(15 * 60);
    expect(payload.aud).toBe("kid");
  });

  it("rate-limits repeated failed logins for one account", async () => {
    const ctx = await setup();
    const kid = await signupKid(ctx);
    const headers = { "x-forwarded-for": "203.0.113.9" };
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      codes.push((await ctx.call("POST", "/auth/kid/login", { email: kid.input.email, password: "wrong-pass1" }, { headers })).status);
    }
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes[5]).toBe(429);
  });

  it("forgot/reset password works without revealing whether an email exists", async () => {
    const ctx = await setup();
    const kid = await signupKid(ctx);
    expect((await ctx.call("POST", "/auth/kid/forgot", { email: "nobody@example.com" })).json).toEqual({ ok: true });
    expect((await ctx.call("POST", "/auth/kid/forgot", { email: kid.input.email })).json).toEqual({ ok: true });
    const html = String((await ctx.deps.db.execute("SELECT html FROM email_outbox WHERE kind = 'reset'")).rows[0]!.html);
    const token = html.match(/token=([A-Za-z0-9]+)/)![1];
    expect((await ctx.call("POST", "/auth/kid/reset", { token, password: "newpass456" })).status).toBe(200);
    expect((await ctx.call("POST", "/auth/kid/login", { email: kid.input.email, password: kid.input.password })).status).toBe(401);
    expect((await ctx.call("POST", "/auth/kid/login", { email: kid.input.email, password: "newpass456" })).status).toBe(200);
    expect((await ctx.call("POST", "/auth/kid/reset", { token, password: "again789x" })).status).toBe(401); // single use
  });

  it("deletes the account and wipes personal data", async () => {
    const ctx = await setup();
    const kid = await signupKid(ctx);
    expect((await ctx.call("DELETE", "/kid/me", undefined, { token: kid.accessToken })).status).toBe(200);
    const row = (await ctx.deps.db.execute("SELECT email_enc, first_name, deleted_at FROM users")).rows[0]!;
    expect(row.email_enc).toBe("");
    expect(row.first_name).toBe("");
    expect(row.deleted_at).not.toBeNull();
    expect((await ctx.call("GET", "/kid/me", undefined, { token: kid.accessToken })).status).toBe(401);
    expect((await ctx.call("POST", "/auth/kid/login", { email: kid.input.email, password: kid.input.password })).status).toBe(401);
  });
});
