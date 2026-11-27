import { SignJWT, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Executor } from "../db";
import { one, run } from "../db";
import { newId, randomToken, sha256Hex } from "./crypto";
import { unauthorized } from "./errors";
import type { AppEnv } from "../context";

export type SubjectType = "kid" | "shop" | "admin";
export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const ISSUER = "bwl-api";

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signAccess(secret: string, sub: string, typ: SubjectType): Promise<string> {
  return new SignJWT({ typ })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience(typ)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(key(secret));
}

export async function verifyAccess(secret: string, token: string, typ: SubjectType): Promise<string> {
  const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER, audience: typ, algorithms: ["HS256"] });
  if (payload.typ !== typ || !payload.sub) throw new Error("wrong token type");
  return payload.sub;
}

export async function issueTokens(db: Executor, secret: string, sub: string, typ: SubjectType, now: number) {
  const refreshToken = randomToken();
  await run(
    db,
    "INSERT INTO refresh_tokens (id, subject_type, subject_id, token_hash, expires_at, created_at) VALUES (?,?,?,?,?,?)",
    [newId(), typ, sub, await sha256Hex(refreshToken), now + REFRESH_TTL_MS, now],
  );
  return { accessToken: await signAccess(secret, sub, typ), refreshToken, expiresIn: ACCESS_TTL_SEC };
}

/** Rotate a refresh token: the old one is revoked, a new pair is issued. Reuse of a revoked token revokes the whole family. */
export async function rotateRefresh(db: Executor, secret: string, typ: SubjectType, refreshToken: string, now: number) {
  const hash = await sha256Hex(refreshToken);
  const row = await one<{ id: string; subject_id: string; expires_at: number; revoked_at: number | null }>(
    db,
    "SELECT id, subject_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ? AND subject_type = ?",
    [hash, typ],
  );
  if (!row) throw unauthorized("invalid refresh token");
  if (row.revoked_at) {
    // token reuse → likely stolen: revoke every session of this subject
    await run(db, "UPDATE refresh_tokens SET revoked_at = ? WHERE subject_type = ? AND subject_id = ? AND revoked_at IS NULL", [
      now,
      typ,
      row.subject_id,
    ]);
    throw unauthorized("refresh token reused");
  }
  if (row.expires_at < now) throw unauthorized("refresh token expired");
  await run(db, "UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?", [now, row.id]);
  return { subjectId: row.subject_id, tokens: await issueTokens(db, secret, row.subject_id, typ, now) };
}

export async function revokeRefresh(db: Executor, refreshToken: string, now: number) {
  await run(db, "UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL", [
    now,
    await sha256Hex(refreshToken),
  ]);
}

export async function revokeAll(db: Executor, typ: SubjectType, sub: string, now: number) {
  await run(db, "UPDATE refresh_tokens SET revoked_at = ? WHERE subject_type = ? AND subject_id = ? AND revoked_at IS NULL", [
    now,
    typ,
    sub,
  ]);
}

/** Bearer-token middleware; puts the subject id on `c.var.subjectId`. */
export function requireAuth(typ: SubjectType): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const h = c.req.header("authorization");
    if (!h?.startsWith("Bearer ")) throw unauthorized();
    try {
      const sub = await verifyAccess(c.var.deps.config.JWT_SECRET, h.slice(7), typ);
      c.set("subjectId", sub);
    } catch {
      throw unauthorized("invalid or expired access token");
    }
    await next();
  };
}
