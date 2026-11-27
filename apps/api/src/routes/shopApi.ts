import { Hono, type MiddlewareHandler } from "hono";
import { productBulkSchema, productInputSchema, stockSyncSchema } from "@bwl/shared";
import type { AppEnv } from "../context";
import { one, run } from "../db";
import { audit } from "../lib/audit";
import { sha256Hex } from "../lib/crypto";
import { forbidden, unauthorized } from "../lib/errors";
import { enforce } from "../lib/rateLimit";
import { body, parse } from "../lib/validate";
import { shopProducts } from "./shop";
import { syncStock, upsertProducts } from "../services/products";

/**
 * Public shop stock API, authenticated with `X-Api-Key: bwl_live_...`.
 * Documented in /openapi.json and on the shop portal's /docs page.
 */
export const shopApi = new Hono<AppEnv>();

const apiKeyAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const { db, now } = c.var.deps;
  await enforce(c, "shop-api", 120, 60_000);
  const key = c.req.header("x-api-key") ?? "";
  if (!/^bwl_live_[A-Za-z0-9]{32}$/.test(key)) throw unauthorized("missing or malformed X-Api-Key");
  const row = await one<{ id: string; shop_id: string; status: string }>(
    db,
    `SELECT k.id, k.shop_id, sh.status FROM shop_api_keys k JOIN shops sh ON sh.id = k.shop_id
     WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
    [await sha256Hex(key)],
  );
  if (!row) throw unauthorized("invalid API key");
  if (row.status !== "approved") throw forbidden("shop_not_approved", "this shop is not approved");
  await run(db, "UPDATE shop_api_keys SET last_used_at = ? WHERE id = ?", [now(), row.id]);
  c.set("subjectId", row.shop_id);
  await next();
};

shopApi.use("*", apiKeyAuth);

shopApi.get("/products", async (c) => c.json({ items: await shopProducts(c.var.deps.db, c.var.subjectId) }));

/** Create or update one product, or many with { products: [...] }. Matched by sku. */
shopApi.post("/products", async (c) => {
  const { db, now } = c.var.deps;
  const raw = await c.req.json().catch(() => null);
  const products = raw && typeof raw === "object" && "products" in raw ? parse(productBulkSchema, raw).products : [parse(productInputSchema, raw)];
  const r = await upsertProducts(db, c.var.subjectId, products, now());
  await audit(db, { actorType: "api_key", actorId: c.var.subjectId, action: "api.products.upsert", meta: r }, now());
  return c.json(r, r.created ? 201 : 200);
});

shopApi.put("/products/:sku", async (c) => {
  const { db, now } = c.var.deps;
  const input = await body(c, productInputSchema.omit({ sku: true }));
  const r = await upsertProducts(db, c.var.subjectId, [{ ...input, sku: c.req.param("sku") }], now());
  await audit(db, { actorType: "api_key", actorId: c.var.subjectId, action: "api.products.put", meta: { sku: c.req.param("sku") } }, now());
  return c.json(r, r.created ? 201 : 200);
});

shopApi.post("/stock/sync", async (c) => {
  const { db, now } = c.var.deps;
  const input = await body(c, stockSyncSchema);
  const r = await syncStock(db, c.var.subjectId, input.items, now());
  await audit(db, { actorType: "api_key", actorId: c.var.subjectId, action: "api.stock.sync", meta: { updated: r.updated, unknown: r.unknownSkus.length } }, now());
  return c.json(r);
});

