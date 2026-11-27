import { describe, expect, it } from "vitest";
import { seedShop, setup, sharedList, signupKid } from "./helpers";

describe("lists, catalog and sharing", () => {
  it("creates a list, adds and removes products, and shows live stock", async () => {
    const ctx = await setup();
    const { productIds } = await seedShop(ctx);
    const kid = await signupKid(ctx);
    const t = { token: kid.accessToken };
    const created = await ctx.call("POST", "/kid/lists", { name: "יום הולדת 10", description: "yay", themeId: "dinosaurs", birthday: "2026-12-20" }, t);
    expect(created.status).toBe(201);
    expect(created.json.themeId).toBe("dinosaurs");

    await ctx.call("POST", `/kid/lists/${created.json.id}/items`, { productId: productIds.TEDDY }, t);
    const withGone = await ctx.call("POST", `/kid/lists/${created.json.id}/items`, { productId: productIds.GONE }, t);
    expect(withGone.json.items).toHaveLength(2);
    expect(withGone.json.items.find((i: any) => i.product.id === productIds.GONE).product.inStock).toBe(false);

    // adding twice is a no-op
    const dup = await ctx.call("POST", `/kid/lists/${created.json.id}/items`, { productId: productIds.TEDDY }, t);
    expect(dup.json.items).toHaveLength(2);

    const removed = await ctx.call("DELETE", `/kid/lists/${created.json.id}/items/${productIds.GONE}`, undefined, t);
    expect(removed.json.items).toHaveLength(1);

    const lists = await ctx.call("GET", "/kid/lists", undefined, t);
    expect(lists.json.items[0].itemCount).toBe(1);
  });

  it("searches and filters the catalog by text, shop, category and price", async () => {
    const ctx = await setup();
    const a = await seedShop(ctx);
    await seedShop(ctx, { products: [{ sku: "OTHER", price: 99_000, stock: 1 }] });
    await seedShop(ctx, { status: "pending", products: [{ sku: "HIDDEN", price: 100, stock: 5 }] });
    const kid = await signupKid(ctx);
    const t = { token: kid.accessToken };
    const all = await ctx.call("GET", "/kid/catalog", undefined, t);
    expect(all.json.items).toHaveLength(4); // pending shop is hidden
    expect(all.json.items.at(-1).inStock).toBe(false); // out-of-stock sorted last
    const byShop = await ctx.call("GET", `/kid/catalog?shopIds=${a.shopId}`, undefined, t);
    expect(byShop.json.items).toHaveLength(3);
    const byPrice = await ctx.call("GET", "/kid/catalog?minPrice=4000&maxPrice=20000&inStockOnly=true", undefined, t);
    expect(byPrice.json.items.map((p: any) => p.priceAgorot).sort()).toEqual([11_700, 5_000].sort());
    const byText = await ctx.call("GET", "/kid/catalog?q=TEDDY", undefined, t);
    expect(byText.json.items).toHaveLength(1);
    const wildcard = await ctx.call("GET", "/kid/catalog?q=%25", undefined, t);
    expect(wildcard.json.items).toHaveLength(0); // % is escaped, not a wildcard
    const shops = await ctx.call("GET", "/kid/catalog/shops", undefined, t);
    expect(shops.json.items).toHaveLength(2);
  });

  it("only the owner can see or edit a list", async () => {
    const ctx = await setup();
    const a = await signupKid(ctx);
    const b = await signupKid(ctx);
    const list = await ctx.call("POST", "/kid/lists", { name: "Mine" }, { token: a.accessToken });
    expect((await ctx.call("GET", `/kid/lists/${list.json.id}`, undefined, { token: b.accessToken })).status).toBe(404);
    expect((await ctx.call("DELETE", `/kid/lists/${list.json.id}`, undefined, { token: b.accessToken })).status).toBe(404);
    expect((await ctx.call("GET", "/kid/lists")).status).toBe(401);
  });

  it("public share page shows only first name, list and theme — no private data", async () => {
    const ctx = await setup();
    const { productIds } = await seedShop(ctx);
    const { slug, kid } = await sharedList(ctx, [productIds.TEDDY!]);
    const r = await ctx.call("GET", `/public/l/${slug}`);
    expect(r.status).toBe(200);
    expect(r.json.kidFirstName).toBe("נועה");
    expect(r.json.themeId).toBe("space");
    expect(r.json.items).toHaveLength(1);
    const text = JSON.stringify(r.json);
    expect(text.toLowerCase()).not.toContain(kid.input.email.toLowerCase());
    expect(text).not.toContain("Noa the Great"); // username
    expect(text).not.toContain("2016"); // birth year / age
    expect(text).not.toContain("mom@example.com");
    expect(Object.keys(r.json).sort()).toEqual(["daysToBirthday", "description", "items", "kidFirstName", "listName", "theme", "themeId"]);
  });

  it("regenerating the link kills the old URL; turning sharing off hides the page", async () => {
    const ctx = await setup();
    const { productIds } = await seedShop(ctx);
    const { slug, kid, listId } = await sharedList(ctx, [productIds.TEDDY!]);
    const t = { token: kid.accessToken };
    const regen = await ctx.call("POST", `/kid/lists/${listId}/share/regenerate`, {}, t);
    const newSlug = regen.json.share.slug;
    expect(newSlug).not.toBe(slug);
    expect((await ctx.call("GET", `/public/l/${slug}`)).status).toBe(404);
    expect((await ctx.call("GET", `/public/l/${newSlug}`)).status).toBe(200);

    await ctx.call("DELETE", `/kid/lists/${listId}/share`, undefined, t);
    expect((await ctx.call("GET", `/public/l/${newSlug}`)).status).toBe(404);
    const back = await ctx.call("POST", `/kid/lists/${listId}/share`, {}, t);
    expect(back.json.share.slug).toBe(newSlug);
    expect((await ctx.call("GET", `/public/l/${newSlug}`)).status).toBe(200);

    await ctx.call("DELETE", `/kid/lists/${listId}`, undefined, t);
    expect((await ctx.call("GET", `/public/l/${newSlug}`)).status).toBe(404);
  });

  it("rejects malformed slugs", async () => {
    const ctx = await setup();
    expect((await ctx.call("GET", "/public/l/1")).status).toBe(400);
    expect((await ctx.call("GET", "/public/l/aaaaaaaaaaaaaaaaaaaaaa")).status).toBe(404);
  });
});
