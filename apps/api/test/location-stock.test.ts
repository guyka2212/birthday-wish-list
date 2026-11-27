import { describe, expect, it } from "vitest";
import { hashPassword } from "../src/lib/passwords";
import { guestSession, kidInput, seedShop, setup, sharedList, signupKid, type TestCtx } from "./helpers";

async function shopToken(ctx: TestCtx, email: string) {
  return (await ctx.call("POST", "/auth/shop/login", { email, password: "shoppass123" })).json.accessToken as string;
}

async function adminToken(ctx: TestCtx) {
  await ctx.deps.db.execute({
    sql: "INSERT INTO admins (id, name, email_enc, email_hash, password_hash, created_at) VALUES ('adm1','Admin',?,?,?,0)",
    args: [await ctx.deps.box.encrypt("admin@example.com"), await ctx.deps.box.blindIndex("admin@example.com"), await hashPassword("adminpass1")],
  });
  return (await ctx.call("POST", "/auth/admin/login", { email: "admin@example.com", password: "adminpass1" })).json.accessToken as string;
}

/** shop + shared list + one checked-out order; returns everything a stock-check test needs */
async function orderedGift(ctx: TestCtx) {
  const shop = await seedShop(ctx);
  const { slug, kid } = await sharedList(ctx, [shop.productIds.TEDDY!]);
  const g = guestSession();
  const itemId = (await ctx.call("GET", `/public/l/${slug}`)).json.items[0].id;
  const hold = (await ctx.call("POST", "/public/reservations", { slug, listItemId: itemId, guestSession: g })).json.id;
  const checkout = await ctx.call("POST", "/public/checkout", {
    slug, guestSession: g, reservationIds: [hold], buyerName: "Ruti <b>", buyerEmail: "ruti@example.com", greeting: "מזל טוב",
  });
  const token = await shopToken(ctx, shop.email);
  const order = (await ctx.call("GET", "/shop/orders", undefined, { token })).json.items[0];
  return { shop, slug, kid, token, order, checkout: checkout.json };
}

describe("kid location: only nearby shops", () => {
  it("requires a valid city at sign-up and returns it on the profile", async () => {
    const ctx = await setup();
    expect((await ctx.call("POST", "/auth/kid/signup", { ...kidInput(), city: undefined })).status).toBe(400);
    expect((await ctx.call("POST", "/auth/kid/signup", kidInput({ city: "atlantis" }))).status).toBe(400);
    const kid = await signupKid(ctx, { city: "haifa" });
    const me = await ctx.call("GET", "/kid/me", undefined, { token: kid.accessToken });
    expect(me.json.city).toBe("haifa");
    const raw = String((await ctx.deps.db.execute("SELECT city_enc FROM users")).rows[0]!.city_enc);
    expect(raw).toMatch(/^v1:/); // encrypted
  });

  it("shows shops within 30 km (at least the 2 closest) and hides far ones", async () => {
    const ctx = await setup();
    const haifa = await seedShop(ctx, { city: "חיפה", name: "Haifa Toys", products: [{ sku: "H1", price: 1000, stock: 1 }] });
    const kiryat = await seedShop(ctx, { city: "קרית אתא", name: "Kiryat Ata Toys", products: [{ sku: "K1", price: 1000, stock: 1 }] });
    const telAviv = await seedShop(ctx, { city: "תל אביב", name: "TLV Toys", products: [{ sku: "T1", price: 1000, stock: 1 }] });
    const eilat = await seedShop(ctx, { city: "אילת", name: "Eilat Toys", products: [{ sku: "E1", price: 1000, stock: 1 }] });
    const kid = await signupKid(ctx, { city: "haifa" });
    const t = { token: kid.accessToken };

    const shops = await ctx.call("GET", "/kid/catalog/shops", undefined, t);
    const ids = shops.json.items.map((s: any) => s.id);
    expect(ids).toEqual([haifa.shopId, kiryat.shopId]); // sorted by distance; TLV (~85 km) and Eilat are too far
    expect(shops.json.items[0].distanceKm).toBe(0);
    expect(shops.json.items[1].distanceKm).toBeGreaterThan(5);

    const cat = await ctx.call("GET", "/kid/catalog", undefined, t);
    expect(cat.json.items.map((p: any) => p.shop.id).sort()).toEqual([haifa.shopId, kiryat.shopId].sort());
    expect(cat.json.items[0].shop.distanceKm).not.toBeUndefined();
    // asking for a far shop explicitly still returns nothing from it
    expect((await ctx.call("GET", `/kid/catalog?shopIds=${eilat.shopId}`, undefined, t)).json.items).toHaveLength(0);

    // a kid in Eilat has no shop within 30 km → still sees the 2 nearest
    const far = await signupKid(ctx, { city: "eilat" });
    const farShops = (await ctx.call("GET", "/kid/catalog/shops", undefined, { token: far.accessToken })).json.items.map((s: any) => s.id);
    expect(farShops[0]).toBe(eilat.shopId);
    expect(farShops).toHaveLength(2);

    // moving updates the catalog
    await ctx.call("PATCH", "/kid/me", { city: "tel-aviv" }, t);
    const after = (await ctx.call("GET", "/kid/catalog/shops", undefined, t)).json.items.map((s: any) => s.id);
    expect(after[0]).toBe(telAviv.shopId);
  });
});

describe("buy = stock request to the shop", () => {
  it("holds the gift, waits for the shop, then 'in stock' sets it aside and tells the kid", async () => {
    const ctx = await setup();
    const { token, order, slug, kid, checkout } = await orderedGift(ctx);
    expect(order.status).toBe("new");
    expect(order.respondedAt).toBeNull();
    // gift is held: nobody else can buy it, and the bill shows it's waiting for the shop
    expect((await ctx.call("GET", `/public/l/${slug}`)).json.items[0].state).toBe("purchased");
    const bill = await ctx.call("GET", `/public/receipts/${checkout.receiptId}?t=${checkout.accessToken}`);
    expect(bill.json.orders[0].status).toBe("new");
    // no kid notification yet
    expect((await ctx.call("GET", "/kid/me/home", undefined, { token: kid.accessToken })).json.activity).toHaveLength(0);
    // email can't be sent before answering
    expect((await ctx.call("POST", `/shop/orders/${order.id}/notify-buyer`, {}, { token })).status).toBe(400);

    const yes = await ctx.call("POST", `/shop/orders/${order.id}/stock`, { inStock: true }, { token });
    expect(yes.json.status).toBe("ready");
    expect(yes.json.respondedAt).not.toBeNull();
    expect((await ctx.call("POST", `/shop/orders/${order.id}/stock`, { inStock: false }, { token })).status).toBe(409); // answered once
    const home = await ctx.call("GET", "/kid/me/home", undefined, { token: kid.accessToken });
    expect(home.json.activity[0].kind).toBe("gift_bought");
    expect(JSON.stringify(home.json.activity)).not.toContain("Ruti");
  });

  it("the shop sends the buyer the admin's 'set aside' template with the order details, safely escaped", async () => {
    const ctx = await setup();
    const { token, order } = await orderedGift(ctx);
    await ctx.call("POST", `/shop/orders/${order.id}/stock`, { inStock: true }, { token });

    const preview = await ctx.call("GET", `/shop/orders/${order.id}/email-preview`, undefined, { token });
    expect(preview.json.template).toBe("set_aside");
    expect(preview.json.text).toContain(order.number);
    expect(preview.json.text).toContain("Ruti <b>");
    expect(preview.json.text).toContain("/bill/");

    const sent = await ctx.call("POST", `/shop/orders/${order.id}/notify-buyer`, {}, { token });
    expect(sent.json.buyerNotifiedCount).toBe(1);
    expect(sent.json.buyerNotifiedAt).not.toBeNull();
    const mail = (await ctx.deps.db.execute("SELECT subject, html, to_hint, kind FROM email_outbox WHERE kind = 'order_set_aside'")).rows[0]!;
    expect(String(mail.to_hint)).toBe("r***@e***.com");
    expect(String(mail.subject)).toContain(order.number);
    const html = String(mail.html);
    expect(html).toContain("Ruti &lt;b&gt;"); // buyer name is escaped, not rendered as HTML
    expect(html).toContain("Product TEDDY");
    expect(html).toMatch(/<a href="http:\/\/localhost:5173\/bill\/|\/bill\//);
    // can resend
    expect((await ctx.call("POST", `/shop/orders/${order.id}/notify-buyer`, {}, { token })).json.buyerNotifiedCount).toBe(2);
  });

  it("'not in stock' cancels, refunds, puts the gift back on the list and uses the 'unavailable' template", async () => {
    const ctx = await setup();
    const { token, order, slug, shop } = await orderedGift(ctx);
    const no = await ctx.call("POST", `/shop/orders/${order.id}/stock`, { inStock: false }, { token });
    expect(no.json.status).toBe("cancelled");
    expect(no.json.declineReason).toBe("unavailable");
    const page = await ctx.call("GET", `/public/l/${slug}`);
    expect(page.json.items[0].state).toBe("available");
    expect(page.json.items[0].product.inStock).toBe(false); // shop said it has none
    const stock = (await ctx.deps.db.execute({ sql: "SELECT quantity FROM stock WHERE product_id = ?", args: [shop.productIds.TEDDY!] })).rows[0]!;
    expect(Number(stock.quantity)).toBe(0);
    const refunds = (await ctx.deps.db.execute("SELECT amount_agorot FROM payments WHERE status = 'refunded'")).rows;
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0]!.amount_agorot)).toBe(11_700);

    expect((await ctx.call("GET", `/shop/orders/${order.id}/email-preview`, undefined, { token })).json.template).toBe("unavailable");
    await ctx.call("POST", `/shop/orders/${order.id}/notify-buyer`, {}, { token });
    const mail = (await ctx.deps.db.execute("SELECT html FROM email_outbox WHERE kind = 'order_unavailable'")).rows[0]!;
    expect(String(mail.html)).toContain(`/l/${slug}`); // link back to the list to pick another gift
  });

  it("another shop can't answer or email someone else's order", async () => {
    const ctx = await setup();
    const { order } = await orderedGift(ctx);
    const other = await seedShop(ctx);
    const t = { token: await shopToken(ctx, other.email) };
    expect((await ctx.call("POST", `/shop/orders/${order.id}/stock`, { inStock: true }, t)).status).toBe(404);
    expect((await ctx.call("POST", `/shop/orders/${order.id}/notify-buyer`, {}, t)).status).toBe(404);
  });
});

describe("admin email templates", () => {
  it("lists, previews and edits templates; edits are used by the next email; markup is escaped", async () => {
    const ctx = await setup();
    const admin = { token: await adminToken(ctx) };
    const list = await ctx.call("GET", "/admin/templates", undefined, admin);
    expect(list.json.items.map((t: any) => t.key).sort()).toEqual(["set_aside", "unavailable"]);
    expect(list.json.placeholders).toContain("orderNumber");

    const preview = await ctx.call("POST", "/admin/templates/preview", { subject: "Hi {{buyerName}}", body: "Order {{orderNumber}} <script>x</script>" }, admin);
    expect(preview.json.subject).toBe("Hi סבתא רותי");
    expect(preview.json.html).toContain("BWL-261127-AB12C-1");
    expect(preview.json.html).toContain("&lt;script&gt;");
    expect(preview.json.html).not.toContain("<script>");

    const saved = await ctx.call("PUT", "/admin/templates/set_aside", { subject: "Ready! {{orderNumber}}", body: "Dear {{buyerName}}, pick up at {{shopName}}" }, admin);
    expect(saved.json.subject).toBe("Ready! {{orderNumber}}");
    expect((await ctx.call("PUT", "/admin/templates/nope", { subject: "a", body: "b" }, admin)).status).toBe(400);

    const { token, order } = await orderedGift(ctx);
    await ctx.call("POST", `/shop/orders/${order.id}/stock`, { inStock: true }, { token });
    await ctx.call("POST", `/shop/orders/${order.id}/notify-buyer`, {}, { token });
    const mail = (await ctx.deps.db.execute("SELECT subject, html FROM email_outbox WHERE kind = 'order_set_aside'")).rows[0]!;
    expect(String(mail.subject)).toBe(`Ready! ${order.number}`);
    expect(String(mail.html)).toContain("pick up at Test Toys");

    // shops and kids can't touch templates
    expect((await ctx.call("GET", "/admin/templates", undefined, { token })).status).toBe(401);
  });
});
