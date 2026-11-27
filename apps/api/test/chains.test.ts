import { describe, expect, it } from "vitest";
import { hashPassword } from "../src/lib/passwords";
import { guestSession, seedShop, setup, sharedList, signupKid, type TestCtx } from "./helpers";

const CHAIN = "514839201";

async function adminToken(ctx: TestCtx) {
  await ctx.deps.db.execute({
    sql: "INSERT INTO admins (id, name, email_enc, email_hash, password_hash, created_at) VALUES ('adm1','Admin',?,?,?,0)",
    args: [await ctx.deps.box.encrypt("admin@example.com"), await ctx.deps.box.blindIndex("admin@example.com"), await hashPassword("adminpass1")],
  });
  return (await ctx.call("POST", "/auth/admin/login", { email: "admin@example.com", password: "adminpass1" })).json.accessToken as string;
}

async function chain(ctx: TestCtx) {
  const haifa = await seedShop(ctx, { city: "חיפה", name: "Toy Chain Haifa", businessId: CHAIN, products: [{ sku: "LEGO", price: 10_000, stock: 2 }] });
  const tlv = await seedShop(ctx, { city: "תל אביב", name: "Toy Chain TLV", businessId: CHAIN, products: [{ sku: "LEGO", price: 9_500, stock: 1 }] });
  const other = await seedShop(ctx, { city: "קרית אתא", name: "Other Toys", products: [{ sku: "LEGO", price: 8_000, stock: 5 }] });
  return { haifa, tlv, other };
}

describe("shop chains (same business ID = branches)", () => {
  it("a kid sees only the closest branch of a chain", async () => {
    const ctx = await setup();
    const { haifa, tlv, other } = await chain(ctx);
    const kidHaifa = await signupKid(ctx, { city: "haifa" });
    const ids = (await ctx.call("GET", "/kid/catalog/shops", undefined, { token: kidHaifa.accessToken })).json.items.map((s: any) => s.id);
    expect(ids).toContain(haifa.shopId);
    expect(ids).toContain(other.shopId);
    expect(ids).not.toContain(tlv.shopId);

    const kidTlv = await signupKid(ctx, { city: "tel-aviv" });
    const ids2 = (await ctx.call("GET", "/kid/catalog/shops", undefined, { token: kidTlv.accessToken })).json.items.map((s: any) => s.id);
    expect(ids2[0]).toBe(tlv.shopId);
    expect(ids2).not.toContain(haifa.shopId);
  });

  it("older shops without a chain key are back-filled from the encrypted business ID", async () => {
    const ctx = await setup();
    const { tlv } = await chain(ctx);
    await ctx.deps.db.execute("UPDATE shops SET business_id_hash = NULL");
    const kid = await signupKid(ctx, { city: "haifa" });
    const ids = (await ctx.call("GET", "/kid/catalog/shops", undefined, { token: kid.accessToken })).json.items.map((s: any) => s.id);
    expect(ids).not.toContain(tlv.shopId);
    const nulls = (await ctx.deps.db.execute("SELECT COUNT(*) AS n FROM shops WHERE business_id_hash IS NULL")).rows[0]!.n;
    expect(Number(nulls)).toBe(0);
  });

  it("a buyer can get the same gift at another branch; the order goes to that branch", async () => {
    const ctx = await setup();
    const { haifa, tlv, other } = await chain(ctx);
    const { slug } = await sharedList(ctx, [haifa.productIds.LEGO!]);
    const pub = (await ctx.call("GET", `/public/l/${slug}`)).json;
    const item = pub.items[0];
    // only branches of the same chain with the same SKU — not a different business that sells the same SKU
    expect(item.product.branches).toEqual([{ productId: tlv.productIds.LEGO, priceAgorot: 9_500, inStock: true, shop: { name: "Toy Chain TLV", city: "תל אביב" } }]);
    expect(JSON.stringify(item.product.branches)).not.toContain(other.productIds.LEGO!);

    const g = guestSession();
    // a product from another business is refused
    const bad = await ctx.call("POST", "/public/reservations", { slug, listItemId: item.id, guestSession: g, productId: other.productIds.LEGO });
    expect(bad.status).toBe(400);
    expect(bad.json.error.code).toBe("bad_branch");

    const hold = await ctx.call("POST", "/public/reservations", { slug, listItemId: item.id, guestSession: g, productId: tlv.productIds.LEGO });
    expect(hold.status).toBe(201);
    const mine = (await ctx.call("GET", `/public/l/${slug}?session=${g}`)).json.items[0];
    expect(mine.heldProductId).toBe(tlv.productIds.LEGO);

    const checkout = await ctx.call("POST", "/public/checkout", {
      slug, guestSession: g, reservationIds: [hold.json.id], buyerName: "Ruti", buyerEmail: "ruti@example.com", greeting: "מזל טוב",
    });
    expect(checkout.status).toBe(201);
    const orders = await ctx.deps.db.execute("SELECT shop_id, total_agorot FROM orders");
    expect(orders.rows).toHaveLength(1);
    expect(orders.rows[0]!.shop_id).toBe(tlv.shopId);
    expect(Number(orders.rows[0]!.total_agorot)).toBe(9_500);
  });

  it("refuses a branch that is out of stock", async () => {
    const ctx = await setup();
    const haifa = await seedShop(ctx, { city: "חיפה", businessId: CHAIN, products: [{ sku: "X", price: 1000, stock: 1 }] });
    const tlv = await seedShop(ctx, { city: "תל אביב", businessId: CHAIN, products: [{ sku: "X", price: 1000, stock: 0 }] });
    const { slug } = await sharedList(ctx, [haifa.productIds.X!]);
    const item = (await ctx.call("GET", `/public/l/${slug}`)).json.items[0];
    expect(item.product.branches[0].inStock).toBe(false);
    const r = await ctx.call("POST", "/public/reservations", { slug, listItemId: item.id, guestSession: guestSession(), productId: tlv.productIds.X });
    expect(r.status).toBe(409);
  });

  it("admin shop stats show sales per shop; /health never shows money", async () => {
    const ctx = await setup();
    const { haifa } = await chain(ctx);
    const { slug } = await sharedList(ctx, [haifa.productIds.LEGO!]);
    const g = guestSession();
    const item = (await ctx.call("GET", `/public/l/${slug}`)).json.items[0];
    const hold = (await ctx.call("POST", "/public/reservations", { slug, listItemId: item.id, guestSession: g })).json.id;
    await ctx.call("POST", "/public/checkout", { slug, guestSession: g, reservationIds: [hold], buyerName: "Ruti", buyerEmail: "ruti@example.com", greeting: "" });

    expect((await ctx.call("GET", "/admin/shop-stats")).status).toBe(401);
    const token = await adminToken(ctx);
    const s = (await ctx.call("GET", "/admin/shop-stats", undefined, { token })).json;
    expect(s.totals.orders).toBe(1);
    expect(s.totals.salesAgorot).toBe(10_000);
    const row = s.shops.find((x: any) => x.id === haifa.shopId);
    expect(row.salesAgorot).toBe(10_000);
    expect(row.waitingForStock).toBe(1);
    expect(row.chainNo).toBe(1);
    expect(s.topProducts[0].sold).toBe(1);
    expect(s.byDay).toHaveLength(1);

    const json = await ctx.call("GET", "/health/json");
    expect(json.status).toBe(200);
    expect(json.json.status).toBe("ok");
    expect(json.json.counts.approvedShops).toBe(3);
    expect(JSON.stringify(json.json)).not.toMatch(/agorot|sales|ruti/i);
    const html = await ctx.app.request("/health");
    expect(html.status).toBe(200);
    expect(html.headers.get("content-type")).toContain("text/html");
    const text = await html.text();
    expect(text).toContain("System status");
    expect(json.json.database.tables).toBeGreaterThan(10);
    expect(json.json.database.rowsByTable.shops).toBe(3);
    expect(text).not.toContain("Ruti");
  });
});
