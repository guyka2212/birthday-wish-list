import { describe, expect, it } from "vitest";
import { guestSession, seedShop, setup, sharedList } from "./helpers";

const buyer = { buyerName: "סבתא רותי", buyerEmail: "grandma@example.com", greeting: "מזל טוב!" };

describe("reservations and checkout", () => {
  it("holds an item for 15 minutes; a second guest is blocked; the hold expires", async () => {
    const ctx = await setup();
    const { productIds } = await seedShop(ctx);
    const { slug } = await sharedList(ctx, [productIds.TEDDY!]);
    const g1 = guestSession();
    const g2 = guestSession();
    const page = await ctx.call("GET", `/public/l/${slug}`);
    const itemId = page.json.items[0].id;

    const r1 = await ctx.call("POST", "/public/reservations", { slug, listItemId: itemId, guestSession: g1 });
    expect(r1.status).toBe(201);
    expect(r1.json.expiresAt - ctx.clock.t).toBe(15 * 60_000);

    const r2 = await ctx.call("POST", "/public/reservations", { slug, listItemId: itemId, guestSession: g2 });
    expect(r2.status).toBe(409);
    expect(r2.json.error.code).toBe("already_held");

    const asG1 = await ctx.call("GET", `/public/l/${slug}?session=${g1}`);
    expect(asG1.json.items[0].state).toBe("held_by_you");
    expect(asG1.json.items[0].reservationId).toBe(r1.json.id);
    const asG2 = await ctx.call("GET", `/public/l/${slug}?session=${g2}`);
    expect(asG2.json.items[0].state).toBe("held");
    expect(asG2.json.items[0].reservationId).toBeNull();

    ctx.clock.t += 15 * 60_000 + 1;
    const r3 = await ctx.call("POST", "/public/reservations", { slug, listItemId: itemId, guestSession: g2 });
    expect(r3.status).toBe(201);
  });

  it("checks out: VAT 17% included, stock decremented, item gifted, kid notified without spoilers, emails sent", async () => {
    const ctx = await setup();
    const { productIds } = await seedShop(ctx);
    const { slug, kid, listId } = await sharedList(ctx, [productIds.TEDDY!, productIds.BALL!]);
    const g = guestSession();
    const items = (await ctx.call("GET", `/public/l/${slug}`)).json.items;
    const holds = [];
    for (const it of items) holds.push((await ctx.call("POST", "/public/reservations", { slug, listItemId: it.id, guestSession: g })).json.id);

    const res = await ctx.call("POST", "/public/checkout", { slug, guestSession: g, reservationIds: holds, ...buyer, deliveryMethod: "pickup" });
    expect(res.status).toBe(201);
    expect(res.json.receiptNumber).toMatch(/^BWL-\d{6}-[A-Z0-9]{5}$/);

    const bill = await ctx.call("GET", `/public/receipts/${res.json.receiptId}?t=${res.json.accessToken}`);
    expect(bill.status).toBe(200);
    expect(bill.json.totalAgorot).toBe(16_700); // 117 + 50
    expect(bill.json.vatAgorot).toBe(2_426); // 167 × 17/117 = 24.26
    expect(bill.json.subtotalAgorot + bill.json.vatAgorot).toBe(bill.json.totalAgorot);
    expect(bill.json.kidFirstName).toBe("נועה");
    expect(bill.json.greeting).toBe("מזל טוב!");
    expect(bill.json.buyerEmailMasked).toBe("g***@e***.com");
    expect(bill.json.payment.provider).toBe("fake");
    expect(bill.json.orders).toHaveLength(1);
    expect(bill.json.orders[0].shop.address).toBe("Herzl 1");

    // bad token
    expect((await ctx.call("GET", `/public/receipts/${res.json.receiptId}?t=${"x".repeat(43)}`)).status).toBe(401);

    const stock = (await ctx.deps.db.execute({ sql: "SELECT quantity FROM stock WHERE product_id = ?", args: [productIds.TEDDY!] })).rows[0]!;
    expect(Number(stock.quantity)).toBe(2);

    const after = await ctx.call("GET", `/public/l/${slug}`);
    expect(after.json.items.every((i: any) => i.state === "purchased")).toBe(true);

    const detail = await ctx.call("GET", `/kid/lists/${listId}`, undefined, { token: kid.accessToken });
    expect(detail.json.purchasedCount).toBe(2);
    const home = await ctx.call("GET", "/kid/me/home", undefined, { token: kid.accessToken });
    expect(home.json.activity[0].kind).toBe("gift_bought");
    expect(JSON.stringify(home.json.activity)).not.toContain("סבתא");
    expect(JSON.stringify(home.json.activity)).not.toContain("Product TEDDY");

    const kinds = (await ctx.deps.db.execute("SELECT kind FROM email_outbox ORDER BY created_at")).rows.map((r) => r.kind);
    expect(kinds).toContain("receipt");
    expect(kinds).toContain("order_new");

    // can't buy twice
    const again = await ctx.call("POST", "/public/reservations", { slug, listItemId: items[0].id, guestSession: guestSession() });
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe("already_purchased");
  });

  it("rejects checkout with someone else's or an expired hold", async () => {
    const ctx = await setup();
    const { productIds } = await seedShop(ctx);
    const { slug } = await sharedList(ctx, [productIds.TEDDY!]);
    const g = guestSession();
    const itemId = (await ctx.call("GET", `/public/l/${slug}`)).json.items[0].id;
    const hold = (await ctx.call("POST", "/public/reservations", { slug, listItemId: itemId, guestSession: g })).json.id;

    const thief = await ctx.call("POST", "/public/checkout", { slug, guestSession: guestSession(), reservationIds: [hold], ...buyer });
    expect(thief.status).toBe(409);

    ctx.clock.t += 16 * 60_000;
    const late = await ctx.call("POST", "/public/checkout", { slug, guestSession: g, reservationIds: [hold], ...buyer });
    expect(late.status).toBe(409);
    expect(late.json.error.code).toBe("reservation_invalid");
  });

  it("won't reserve out-of-stock items and requires an address for delivery", async () => {
    const ctx = await setup();
    const { productIds } = await seedShop(ctx);
    const { slug } = await sharedList(ctx, [productIds.GONE!, productIds.BALL!]);
    const items = (await ctx.call("GET", `/public/l/${slug}`)).json.items;
    const gone = items.find((i: any) => !i.product.inStock);
    expect((await ctx.call("POST", "/public/reservations", { slug, listItemId: gone.id, guestSession: guestSession() })).json.error.code).toBe("out_of_stock");

    const g = guestSession();
    const ball = items.find((i: any) => i.product.inStock);
    const hold = (await ctx.call("POST", "/public/reservations", { slug, listItemId: ball.id, guestSession: g })).json.id;
    const noAddr = await ctx.call("POST", "/public/checkout", { slug, guestSession: g, reservationIds: [hold], ...buyer, deliveryMethod: "delivery" });
    expect(noAddr.status).toBe(400);
  });

  it("sends a signed order.created webhook to the shop", async () => {
    const ctx = await setup();
    const { productIds } = await seedShop(ctx, { webhookUrl: "https://shop.example.com/hook" });
    const { slug } = await sharedList(ctx, [productIds.BALL!]);
    const g = guestSession();
    const itemId = (await ctx.call("GET", `/public/l/${slug}`)).json.items[0].id;
    const hold = (await ctx.call("POST", "/public/reservations", { slug, listItemId: itemId, guestSession: g })).json.id;
    await ctx.call("POST", "/public/checkout", { slug, guestSession: g, reservationIds: [hold], ...buyer });
    expect(ctx.sent).toHaveLength(1);
    expect(ctx.sent[0]!.url).toBe("https://shop.example.com/hook");
    expect(ctx.sent[0]!.headers["X-BWL-Signature"]).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(JSON.parse(ctx.sent[0]!.body).event).toBe("order.created");
  });
});
