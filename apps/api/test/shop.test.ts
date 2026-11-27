import { describe, expect, it } from "vitest";
import { guestSession, seedShop, setup, sharedList } from "./helpers";

async function shopLogin(ctx: Awaited<ReturnType<typeof setup>>, email: string, password = "shoppass123") {
  const r = await ctx.call("POST", "/auth/shop/login", { email, password });
  expect(r.status).toBe(200);
  return r.json.accessToken as string;
}

describe("shop portal and stock API", () => {
  it("signs up as pending, gets approved by an admin, then can create an API key", async () => {
    const ctx = await setup();
    const signup = await ctx.call("POST", "/auth/shop/signup", {
      name: "חנות הצעצועים",
      businessId: "514839201",
      address: "הרצל 10, חיפה",
      city: "חיפה",
      phone: "04-8123456",
      contactName: "דנה",
      email: "newshop@example.com",
      password: "shoppass123",
    });
    expect(signup.status).toBe(201);
    const token = signup.json.accessToken;
    const me = await ctx.call("GET", "/shop/me", undefined, { token });
    expect(me.json.status).toBe("pending");
    expect(me.json.businessId).toBe("514839201");
    const raw = (await ctx.deps.db.execute("SELECT business_id_enc, phone_enc, address_enc FROM shops")).rows[0]!;
    for (const v of Object.values(raw)) expect(String(v)).toMatch(/^v1:/);

    expect((await ctx.call("POST", "/shop/api-key/rotate", {}, { token })).status).toBe(403);

    // admin approves
    const { hashPassword } = await import("../src/lib/passwords");
    await ctx.deps.db.execute({
      sql: "INSERT INTO admins (id, name, email_enc, email_hash, password_hash, created_at) VALUES ('adm1','Admin',?,?,?,0)",
      args: [await ctx.deps.box.encrypt("admin@example.com"), await ctx.deps.box.blindIndex("admin@example.com"), await hashPassword("adminpass1")],
    });
    const admin = (await ctx.call("POST", "/auth/admin/login", { email: "admin@example.com", password: "adminpass1" })).json.accessToken;
    const pending = await ctx.call("GET", "/admin/shops?status=pending", undefined, { token: admin });
    expect(pending.json.items).toHaveLength(1);
    expect((await ctx.call("POST", `/admin/shops/${me.json.id}/decision`, { decision: "approve" }, { token: admin })).json.status).toBe("approved");
    // shop token can't call admin routes
    expect((await ctx.call("GET", "/admin/shops", undefined, { token })).status).toBe(401);

    const key = await ctx.call("POST", "/shop/api-key/rotate", {}, { token });
    expect(key.status).toBe(201);
    expect(key.json.apiKey).toMatch(/^bwl_live_[A-Za-z0-9]{32}$/);
    const stored = (await ctx.deps.db.execute("SELECT key_hash FROM shop_api_keys")).rows[0]!;
    expect(String(stored.key_hash)).not.toContain(key.json.apiKey);
    expect(String(stored.key_hash)).toHaveLength(64);
  });

  it("stock API: upsert products, bulk stock sync, rejects bad keys, rotation revokes the old key", async () => {
    const ctx = await setup();
    const { email } = await seedShop(ctx);
    const token = await shopLogin(ctx, email);
    const key = (await ctx.call("POST", "/shop/api-key/rotate", {}, { token })).json.apiKey;
    const h = { headers: { "x-api-key": key } };

    expect((await ctx.call("GET", "/api/shop/products")).status).toBe(401);
    expect((await ctx.call("GET", "/api/shop/products", undefined, { headers: { "x-api-key": `bwl_live_${"A".repeat(32)}` } })).status).toBe(401);

    const one = await ctx.call("POST", "/api/shop/products", { sku: "NEW-1", title: "Kite", category: "toys", priceAgorot: 4990, stock: 7 }, h);
    expect(one.status).toBe(201);
    expect(one.json).toEqual({ created: 1, updated: 0 });
    const bulk = await ctx.call("POST", "/api/shop/products", { products: [
      { sku: "NEW-1", title: "Kite XL", category: "toys", priceAgorot: 5990 },
      { sku: "NEW-2", title: "Book", category: "books", priceAgorot: 3900, stock: 2 },
    ] }, h);
    expect(bulk.json).toEqual({ created: 1, updated: 1 });
    const put = await ctx.call("PUT", "/api/shop/products/NEW-3", { title: "Lego", category: "lego", priceAgorot: 19900, stock: 1 }, h);
    expect(put.status).toBe(201);
    const bad = await ctx.call("POST", "/api/shop/products", { sku: "x y", title: "", category: "cars", priceAgorot: -1 }, h);
    expect(bad.status).toBe(400);

    const sync = await ctx.call("POST", "/api/shop/stock/sync", { items: [{ sku: "NEW-1", quantity: 0 }, { sku: "TEDDY", quantity: 42 }, { sku: "NOPE", quantity: 3 }] }, h);
    expect(sync.json).toEqual({ updated: 2, unknownSkus: ["NOPE"] });
    const list = await ctx.call("GET", "/api/shop/products", undefined, h);
    const bySku = Object.fromEntries(list.json.items.map((p: any) => [p.sku, p]));
    expect(bySku["NEW-1"].stock).toBe(0);
    expect(bySku["NEW-1"].title).toBe("Kite XL");
    expect(bySku.TEDDY.stock).toBe(42);

    // kids see the new stock immediately
    const kid = await ctx.call("POST", "/auth/kid/signup", { username: "kid1", firstName: "Kid", email: "k1@example.com", password: "secret123", parentEmail: "p@example.com" });
    const cat = await ctx.call("GET", "/kid/catalog?q=Kite", undefined, { token: kid.json.accessToken });
    expect(cat.json.items[0].inStock).toBe(false);

    const rotated = (await ctx.call("POST", "/shop/api-key/rotate", {}, { token })).json.apiKey;
    expect((await ctx.call("GET", "/api/shop/products", undefined, h)).status).toBe(401);
    expect((await ctx.call("GET", "/api/shop/products", undefined, { headers: { "x-api-key": rotated } })).status).toBe(200);
  });

  it("sees incoming orders and moves them through the status flow; cancel restocks", async () => {
    const ctx = await setup();
    const { email, productIds } = await seedShop(ctx);
    const { slug } = await sharedList(ctx, [productIds.TEDDY!]);
    const g = guestSession();
    const itemId = (await ctx.call("GET", `/public/l/${slug}`)).json.items[0].id;
    const hold = (await ctx.call("POST", "/public/reservations", { slug, listItemId: itemId, guestSession: g })).json.id;
    await ctx.call("POST", "/public/checkout", { slug, guestSession: g, reservationIds: [hold], buyerName: "Ruti", buyerEmail: "r@example.com" });

    const token = await shopLogin(ctx, email);
    const orders = await ctx.call("GET", "/shop/orders", undefined, { token });
    expect(orders.json.items).toHaveLength(1);
    const o = orders.json.items[0];
    expect(o.status).toBe("new");
    expect(o.kidFirstName).toBe("נועה");
    expect(o.items[0].sku).toBe("TEDDY");

    expect((await ctx.call("PATCH", `/shop/orders/${o.id}`, { status: "done" }, { token })).status).toBe(400);
    expect((await ctx.call("PATCH", `/shop/orders/${o.id}`, { status: "preparing" }, { token })).json.status).toBe("preparing");
    expect((await ctx.call("PATCH", `/shop/orders/${o.id}`, { status: "ready" }, { token })).json.status).toBe("ready");
    expect((await ctx.call("PATCH", `/shop/orders/${o.id}`, { status: "done" }, { token })).json.status).toBe("done");

    const dash = await ctx.call("GET", "/shop/dashboard", undefined, { token });
    expect(dash.json.totals.salesAgorot).toBe(11_700);
    expect(dash.json.totals.orders).toBe(1);
    expect(dash.json.salesByDay).toHaveLength(14);

    // another shop can't touch this order
    const other = await seedShop(ctx);
    const otherToken = await shopLogin(ctx, other.email);
    expect((await ctx.call("PATCH", `/shop/orders/${o.id}`, { status: "cancelled" }, { token: otherToken })).status).toBe(404);
  });

  it("cancelling a new order puts the gift back on the list and in stock", async () => {
    const ctx = await setup();
    const { email, productIds } = await seedShop(ctx);
    const { slug } = await sharedList(ctx, [productIds.BALL!]);
    const g = guestSession();
    const itemId = (await ctx.call("GET", `/public/l/${slug}`)).json.items[0].id;
    const hold = (await ctx.call("POST", "/public/reservations", { slug, listItemId: itemId, guestSession: g })).json.id;
    await ctx.call("POST", "/public/checkout", { slug, guestSession: g, reservationIds: [hold], buyerName: "Ruti", buyerEmail: "r@example.com" });
    const token = await shopLogin(ctx, email);
    const o = (await ctx.call("GET", "/shop/orders", undefined, { token })).json.items[0];
    await ctx.call("PATCH", `/shop/orders/${o.id}`, { status: "cancelled" }, { token });
    const page = await ctx.call("GET", `/public/l/${slug}`);
    expect(page.json.items[0].state).toBe("available");
    expect(page.json.items[0].product.inStock).toBe(true);
  });
});
