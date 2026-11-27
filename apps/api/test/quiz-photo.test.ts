import { describe, expect, it } from "vitest";
import { seedShop, setup, signupKid } from "./helpers";

const answers = { color: "blue", animal: "dolphin", music: "rock", hobby: "football", place: "sea", treat: "pizza" };
// 1×1 transparent PNG and a tiny JPEG header
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString("base64");

describe("theme quiz", () => {
  it("serves the questions and previews a theme generated from the answers", async () => {
    const ctx = await setup();
    const kid = await signupKid(ctx);
    const t = { token: kid.accessToken };
    const quiz = await ctx.call("GET", "/kid/quiz", undefined, t);
    expect(quiz.json.questions.map((q: any) => q.id)).toEqual(["color", "animal", "music", "hobby", "place", "treat"]);
    const preview = await ctx.call("POST", "/kid/themes/preview", { quiz: answers }, t);
    expect(preview.status).toBe(200);
    expect(preview.json.id).toBe("custom");
    expect(preview.json.emoji).toBe("🐬");
    expect(preview.json.dark).toBe(true); // rock → moody dark shop
    expect(preview.json.nameHe).toBe("העולם של נועה");
    expect(preview.json.confetti).toContain("⚽");
    expect(preview.json.confetti).toContain("🍕");
    // same answers → same theme
    expect((await ctx.call("POST", "/kid/themes/preview", { quiz: answers }, t)).json).toEqual(preview.json);
    // bad answers are rejected
    expect((await ctx.call("POST", "/kid/themes/preview", { quiz: { ...answers, animal: "dragon" } }, t)).status).toBe(400);
  });

  it("creates a list with a quiz theme, and the public shop renders it without any private data", async () => {
    const ctx = await setup();
    const { productIds } = await seedShop(ctx);
    const kid = await signupKid(ctx);
    const t = { token: kid.accessToken };
    const list = await ctx.call("POST", "/kid/lists", { name: "My party", quiz: answers }, t);
    expect(list.status).toBe(201);
    expect(list.json.themeId).toBe("custom");
    expect(list.json.theme.emoji).toBe("🐬");
    expect(list.json.quiz).toEqual(answers);

    await ctx.call("POST", `/kid/lists/${list.json.id}/items`, { productId: productIds.TEDDY }, t);
    await ctx.call("PUT", "/kid/me/photo", { photo: PNG }, t);
    const share = await ctx.call("POST", `/kid/lists/${list.json.id}/share`, {}, t);
    const pub = await ctx.call("GET", `/public/l/${share.json.share.slug}`);
    expect(pub.json.theme.id).toBe("custom");
    expect(pub.json.theme.primary).toMatch(/^#[0-9A-F]{6}$/i);
    const text = JSON.stringify(pub.json);
    expect(text).not.toContain(PNG.slice(0, 20)); // the photo never leaks to the public page
    expect(text).not.toContain("quiz");
    expect(text).not.toContain("photo");

    // redo the quiz → new theme; pick a preset → custom theme cleared
    const redo = await ctx.call("PATCH", `/kid/lists/${list.json.id}`, { quiz: { ...answers, animal: "unicorn", music: "pop" } }, t);
    expect(redo.json.theme.emoji).toBe("🦄");
    expect(redo.json.theme.dark).toBe(false);
    const preset = await ctx.call("PATCH", `/kid/lists/${list.json.id}`, { themeId: "space" }, t);
    expect(preset.json.themeId).toBe("space");
    expect(preset.json.quiz).toBeNull();
  });
});

describe("profile photo", () => {
  it("uploads, reads back and deletes a photo, stored encrypted", async () => {
    const ctx = await setup();
    const kid = await signupKid(ctx);
    const t = { token: kid.accessToken };
    expect((await ctx.call("GET", "/kid/me", undefined, t)).json.hasPhoto).toBe(false);
    expect((await ctx.call("GET", "/kid/me/photo", undefined, t)).status).toBe(404);

    expect((await ctx.call("PUT", "/kid/me/photo", { photo: JPEG }, t)).status).toBe(200);
    expect((await ctx.call("GET", "/kid/me", undefined, t)).json.hasPhoto).toBe(true);
    const got = await ctx.call("GET", "/kid/me/photo", undefined, t);
    expect(got.json).toEqual({ contentType: "image/jpeg", photo: JPEG });
    const raw = String((await ctx.deps.db.execute("SELECT photo_enc FROM users")).rows[0]!.photo_enc);
    expect(raw).toMatch(/^v1:/);
    expect(raw).not.toContain(JPEG);

    expect((await ctx.call("DELETE", "/kid/me/photo", undefined, t)).json.hasPhoto).toBe(false);
    expect((await ctx.call("GET", "/kid/me", undefined, t)).json.hasPhoto).toBe(false);
  });

  it("rejects non-images, oversized photos and other users", async () => {
    const ctx = await setup();
    const kid = await signupKid(ctx);
    const t = { token: kid.accessToken };
    const notImage = await ctx.call("PUT", "/kid/me/photo", { photo: Buffer.from("<script>alert(1)</script>").toString("base64") }, t);
    expect(notImage.json.error.code).toBe("photo_type");
    const big = Buffer.alloc(310 * 1024, 1);
    big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
    expect((await ctx.call("PUT", "/kid/me/photo", { photo: big.toString("base64") }, t)).status).toBe(400);
    expect((await ctx.call("PUT", "/kid/me/photo", { photo: "not base64 !!" }, t)).status).toBe(400);
    expect((await ctx.call("GET", "/kid/me/photo")).status).toBe(401);
  });
});
