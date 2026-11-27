import type { CatalogProduct, Category } from "@bwl/shared";
import type { Executor } from "../db";
import { all, placeholders } from "../db";

/** Columns needed to build a CatalogProduct. Join products p, stock s, shops sh. */
export const PRODUCT_COLS = `
  p.id AS p_id, p.title AS p_title, p.description AS p_description, p.category AS p_category,
  p.price_agorot AS p_price, p.image_url AS p_image, p.age_min AS p_age_min, p.age_max AS p_age_max,
  COALESCE(s.quantity, 0) AS p_stock,
  sh.id AS sh_id, sh.name AS sh_name, sh.city AS sh_city, sh.logo_url AS sh_logo, sh.brand_color AS sh_color`;

export const PRODUCT_JOIN = `
  FROM products p
  JOIN shops sh ON sh.id = p.shop_id
  LEFT JOIN stock s ON s.product_id = p.id`;

export interface ProductRow {
  p_id: string;
  p_title: string;
  p_description: string;
  p_category: Category;
  p_price: number;
  p_image: string | null;
  p_age_min: number | null;
  p_age_max: number | null;
  p_stock: number;
  sh_id: string;
  sh_name: string;
  sh_city: string;
  sh_logo: string | null;
  sh_color: string;
}

export function toCatalogProduct(r: ProductRow): CatalogProduct {
  const stock = Number(r.p_stock);
  return {
    id: r.p_id,
    title: r.p_title,
    description: r.p_description,
    category: r.p_category,
    priceAgorot: Number(r.p_price),
    imageUrl: r.p_image,
    ageMin: r.p_age_min == null ? null : Number(r.p_age_min),
    ageMax: r.p_age_max == null ? null : Number(r.p_age_max),
    stock,
    inStock: stock > 0,
    shop: { id: r.sh_id, name: r.sh_name, city: r.sh_city, logoUrl: r.sh_logo, brandColor: r.sh_color },
  };
}

export interface CatalogFilter {
  q?: string;
  shopIds?: string[];
  categories?: Category[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  limit: number;
  offset: number;
}

export async function searchCatalog(db: Executor, f: CatalogFilter) {
  const where = ["sh.status = 'approved'", "p.active = 1"];
  const args: (string | number)[] = [];
  if (f.q) {
    // escape LIKE wildcards in user input
    const like = `%${f.q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR sh.name LIKE ? ESCAPE '\\')");
    args.push(like, like, like);
  }
  if (f.shopIds?.length) {
    where.push(`sh.id IN (${placeholders(f.shopIds.length)})`);
    args.push(...f.shopIds);
  }
  if (f.categories?.length) {
    where.push(`p.category IN (${placeholders(f.categories.length)})`);
    args.push(...f.categories);
  }
  if (f.minPrice != null) {
    where.push("p.price_agorot >= ?");
    args.push(f.minPrice);
  }
  if (f.maxPrice != null) {
    where.push("p.price_agorot <= ?");
    args.push(f.maxPrice);
  }
  if (f.inStockOnly) where.push("COALESCE(s.quantity, 0) > 0");

  const rows = await all<ProductRow>(
    db,
    `SELECT ${PRODUCT_COLS} ${PRODUCT_JOIN} WHERE ${where.join(" AND ")}
     ORDER BY (COALESCE(s.quantity,0) > 0) DESC, p.title COLLATE NOCASE LIMIT ? OFFSET ?`,
    [...args, f.limit, f.offset],
  );
  return rows.map(toCatalogProduct);
}

export async function trending(db: Executor, limit = 10, shopIds?: string[]) {
  const shopFilter = shopIds ? `AND sh.id IN (${placeholders(Math.max(shopIds.length, 1))})` : "";
  const rows = await all<ProductRow>(
    db,
    `SELECT ${PRODUCT_COLS}, (SELECT COUNT(*) FROM list_items li WHERE li.product_id = p.id) AS popularity
     ${PRODUCT_JOIN}
     WHERE sh.status = 'approved' AND p.active = 1 AND COALESCE(s.quantity,0) > 0 ${shopFilter}
     ORDER BY popularity DESC, p.updated_at DESC LIMIT ?`,
    [...(shopIds ? (shopIds.length ? shopIds : [""]) : []), limit],
  );
  return rows.map(toCatalogProduct);
}

export async function shopsForFilter(db: Executor) {
  return all<{ id: string; name: string; city: string; logo_url: string | null; brand_color: string; products: number }>(
    db,
    `SELECT sh.id, sh.name, sh.city, sh.logo_url, sh.brand_color,
            (SELECT COUNT(*) FROM products p WHERE p.shop_id = sh.id AND p.active = 1) AS products
     FROM shops sh WHERE sh.status = 'approved' ORDER BY sh.name`,
  );
}
