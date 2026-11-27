import type { InStatement } from "@libsql/client";
import type { ProductInput } from "@bwl/shared";
import type { Executor } from "../db";
import { all, one, run } from "../db";
import { newId } from "../lib/crypto";

/** Insert or update products by (shop, sku). Returns counts. Stock is set only when provided. */
export async function upsertProducts(db: Executor, shopId: string, products: ProductInput[], now: number) {
  let created = 0;
  let updated = 0;
  for (const p of products) {
    const existing = await one<{ id: string }>(db, "SELECT id FROM products WHERE shop_id = ? AND external_sku = ?", [shopId, p.sku]);
    let id = existing?.id;
    if (id) {
      await run(
        db,
        `UPDATE products SET title = ?, description = ?, category = ?, price_agorot = ?, image_url = ?, age_min = ?, age_max = ?, active = ?, updated_at = ?
         WHERE id = ?`,
        [p.title, p.description ?? "", p.category, p.priceAgorot, p.imageUrl ?? null, p.ageMin ?? null, p.ageMax ?? null, p.active === false ? 0 : 1, now, id],
      );
      updated++;
    } else {
      id = newId();
      await run(
        db,
        `INSERT INTO products (id, shop_id, external_sku, title, description, category, price_agorot, image_url, age_min, age_max, active, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, shopId, p.sku, p.title, p.description ?? "", p.category, p.priceAgorot, p.imageUrl ?? null, p.ageMin ?? null, p.ageMax ?? null, p.active === false ? 0 : 1, now, now],
      );
      await run(db, "INSERT INTO stock (product_id, quantity, updated_at) VALUES (?,?,?)", [id, p.stock ?? 0, now]);
      created++;
      continue;
    }
    if (p.stock !== undefined) {
      await run(
        db,
        "INSERT INTO stock (product_id, quantity, updated_at) VALUES (?,?,?) ON CONFLICT(product_id) DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at",
        [id, p.stock, now],
      );
    }
  }
  return { created, updated };
}

/** Bulk stock sync by SKU. Unknown SKUs are reported back, not created. */
export async function syncStock(db: Executor, shopId: string, items: Array<{ sku: string; quantity: number }>, now: number) {
  // one read + one batched write, so large syncs stay fast over the network
  const rows = await all<{ id: string; external_sku: string }>(db, "SELECT id, external_sku FROM products WHERE shop_id = ?", [shopId]);
  const bySku = new Map(rows.map((r) => [r.external_sku, r.id]));
  const unknownSkus: string[] = [];
  const stmts: InStatement[] = [];
  for (const it of items) {
    const id = bySku.get(it.sku);
    if (!id) {
      unknownSkus.push(it.sku);
      continue;
    }
    stmts.push({
      sql: "INSERT INTO stock (product_id, quantity, updated_at) VALUES (?,?,?) ON CONFLICT(product_id) DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at",
      args: [id, it.quantity, now],
    });
  }
  if (stmts.length) await ("commit" in db ? db.batch(stmts) : db.batch(stmts, "write"));
  return { updated: stmts.length, unknownSkus };
}
