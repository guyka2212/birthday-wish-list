import type { Context, MiddlewareHandler } from "hono";
import type { Db } from "../db";
import { one, run } from "../db";
import { sha256Hex } from "./crypto";
import { tooMany } from "./errors";
import type { AppEnv } from "../context";

/**
 * Fixed-window rate limiter stored in the DB (works across serverless instances).
 * Returns true if the request is allowed.
 */
export async function hit(db: Db, key: string, limit: number, windowMs: number, now: number) {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  await run(
    db,
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1`,
    [key, windowStart],
  );
  const row = await one<{ count: number }>(db, "SELECT count FROM rate_limits WHERE key = ? AND window_start = ?", [key, windowStart]);
  // opportunistic cleanup of old windows (1% of hits)
  if (Math.random() < 0.01) await run(db, "DELETE FROM rate_limits WHERE window_start < ?", [now - 24 * 3600_000]);
  const count = Number(row?.count ?? 1);
  return { allowed: count <= limit, retryAfterSec: Math.ceil((windowStart + windowMs - now) / 1000) };
}

export function clientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    c.req.header("cf-connecting-ip") ||
    "local"
  );
}

export async function ipHash(c: Context): Promise<string> {
  return (await sha256Hex(`ip:${clientIp(c)}`)).slice(0, 32);
}

export async function enforce(c: Context<AppEnv>, bucket: string, limit: number, windowMs: number, extraKey = "") {
  const { db, now } = c.var.deps;
  const key = `${bucket}:${await ipHash(c)}${extraKey ? ":" + extraKey : ""}`;
  const r = await hit(db, key, limit, windowMs, now());
  if (!r.allowed) {
    c.header("Retry-After", String(r.retryAfterSec));
    throw tooMany(r.retryAfterSec);
  }
}

export function rateLimit(bucket: string, limit: number, windowMs: number): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await enforce(c, bucket, limit, windowMs);
    await next();
  };
}
