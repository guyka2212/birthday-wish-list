import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { loadConfig } from "../src/config";
import { createDeps, type Deps } from "../src/context";
import { createApp } from "../src/app";
import { migrate } from "../src/migrate";
import { run } from "../src/db";
import { newId, randomBase62 } from "../src/lib/crypto";
import { hashPassword } from "../src/lib/passwords";
import { upsertProducts } from "../src/services/products";

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "db", "migrations");

export interface TestCtx {
  deps: Deps;
  app: ReturnType<typeof createApp>;
  clock: { t: number };
  sent: Array<{ url: string; body: string; headers: Record<string, string> }>;
  call: <T = any>(method: string, path: string, body?: unknown, opts?: { token?: string; headers?: Record<string, string> }) => Promise<{ status: number; json: T }>;
}

export async function setup(env: Record<string, string> = {}): Promise<TestCtx> {
  const config = loadConfig({
    NODE_ENV: "test",
    DB_MODE: "memory",
    JWT_SECRET: randomBytes(48).toString("base64"),
    ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    BLIND_INDEX_KEY: randomBytes(32).toString("base64"),
    ALLOWED_ORIGINS: "http://localhost:5173",
    PUBLIC_GUEST_URL: "http://localhost:5173",
    AUTO_VERIFY_PARENT: "true",
    ...env,
  });
  const clock = { t: Date.UTC(2026, 10, 27, 10, 0, 0) };
  const sent: TestCtx["sent"] = [];
  // a temp file (not :memory:) so libSQL transactions share the same database
  const db = createClient({ url: `file:${join(tmpdir(), `bwl-test-${randomBase62(10)}.db`).split("\\").join("/")}` });
  await migrate(db, MIGRATIONS);
  const deps = await createDeps(config, {
    db,
    now: () => clock.t,
    fetch: (async (url: string, init: RequestInit) => {
      sent.push({ url: String(url), body: String(init.body), headers: init.headers as Record<string, string> });
      return new Response("ok");
    }) as unknown as typeof fetch,
  });
  const app = createApp(deps);
  let ipCounter = 0;
  const call: TestCtx["call"] = async (method, path, body, opts = {}) => {
    const res = await app.request(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": opts.headers?.["x-forwarded-for"] ?? `10.0.0.${++ipCounter % 250}`,
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...opts.headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = text;
    try {
      json = JSON.parse(text);
    } catch {
      /* html */
    }
    return { status: res.status, json };
  };
  return { deps, app, clock, sent, call };
}

/** Insert an approved shop with products. Returns ids. */
export async function seedShop(
  ctx: TestCtx,
  opts: { status?: string; email?: string; password?: string; webhookUrl?: string; city?: string; name?: string; products?: Array<{ sku: string; price: number; stock: number }> } = {},
) {
  const { db, box } = ctx.deps;
  const id = newId();
  const email = opts.email ?? `shop-${randomBase62(6)}@example.com`;
  const now = ctx.clock.t;
  await run(
    db,
    `INSERT INTO shops (id, name, slug, business_id_enc, address_enc, city, phone_enc, contact_name, email_enc, email_hash, password_hash, status, webhook_url, webhook_secret_enc, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      opts.name ?? "Test Toys",
      `test-${randomBase62(5)}`,
      await box.encrypt("514839201"),
      await box.encrypt("Herzl 1"),
      opts.city ?? "Haifa",
      await box.encrypt("04-1234567"),
      "Dana",
      await box.encrypt(email),
      await box.blindIndex(email),
      await hashPassword(opts.password ?? "shoppass123"),
      opts.status ?? "approved",
      opts.webhookUrl ?? null,
      opts.webhookUrl ? await box.encrypt("whsec_test") : null,
      now,
      now,
    ],
  );
  const products = opts.products ?? [
    { sku: "TEDDY", price: 11_700, stock: 3 },
    { sku: "BALL", price: 5_000, stock: 1 },
    { sku: "GONE", price: 2_000, stock: 0 },
  ];
  await upsertProducts(
    db,
    id,
    products.map((p) => ({ sku: p.sku, title: `Product ${p.sku}`, description: "", category: "toys" as const, priceAgorot: p.price, active: true, stock: p.stock })),
    now,
  );
  const ids: Record<string, string> = {};
  for (const p of products) {
    const r = await db.execute({ sql: "SELECT id FROM products WHERE shop_id = ? AND external_sku = ?", args: [id, p.sku] });
    ids[p.sku] = String(r.rows[0]!.id);
  }
  return { shopId: id, email, productIds: ids };
}

export const kidInput = (over: Record<string, unknown> = {}) => ({
  username: "Noa the Great",
  firstName: "נועה",
  email: `noa-${randomBase62(6)}@example.com`,
  password: "secret123",
  parentEmail: "mom@example.com",
  birthday: "2016-12-20",
  city: "haifa",
  ...over,
});

export async function signupKid(ctx: TestCtx, over: Record<string, unknown> = {}) {
  const input = kidInput(over);
  const r = await ctx.call<{ accessToken: string; refreshToken: string }>("POST", "/auth/kid/signup", input);
  if (r.status !== 201) throw new Error(`signup failed ${r.status} ${JSON.stringify(r.json)}`);
  return { ...r.json, input };
}

/** Kid with a shared list containing the given products. */
export async function sharedList(ctx: TestCtx, productIds: string[]) {
  const kid = await signupKid(ctx);
  const list = await ctx.call<{ id: string }>("POST", "/kid/lists", { name: "My birthday", themeId: "space", birthday: "2026-12-20" }, { token: kid.accessToken });
  for (const p of productIds) await ctx.call("POST", `/kid/lists/${list.json.id}/items`, { productId: p }, { token: kid.accessToken });
  const share = await ctx.call<{ share: { slug: string } }>("POST", `/kid/lists/${list.json.id}/share`, {}, { token: kid.accessToken });
  return { kid, listId: list.json.id, slug: share.json.share.slug };
}

export const guestSession = () => randomBase62(32);
