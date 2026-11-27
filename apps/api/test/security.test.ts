import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCryptoBox, maskEmail, randomBase62 } from "../src/lib/crypto";
import { setup } from "./helpers";

describe("security basics", () => {
  it("AES-256-GCM round-trips, uses a fresh IV each time, and detects tampering", async () => {
    const box = await createCryptoBox(randomBytes(32).toString("base64"), randomBytes(32).toString("base64"));
    const a = await box.encrypt("noa@example.com");
    const b = await box.encrypt("noa@example.com");
    expect(a).not.toBe(b);
    expect(await box.decrypt(a)).toBe("noa@example.com");
    const [v, iv, ct] = a.split(":");
    const flipped = `${v}:${iv}:${ct!.slice(0, -2)}${ct!.endsWith("A") ? "B" : "A"}${ct!.slice(-1)}`;
    await expect(box.decrypt(flipped)).rejects.toThrow();
    expect(await box.blindIndex("Noa@Example.com ")).toBe(await box.blindIndex("noa@example.com"));
  });

  it("random slugs are base62 and unique", () => {
    const s = new Set(Array.from({ length: 2000 }, () => randomBase62(22)));
    expect(s.size).toBe(2000);
    for (const x of s) expect(x).toMatch(/^[A-Za-z0-9]{22}$/);
    expect(maskEmail("noa@gmail.com")).toBe("n***@g***.com");
  });

  it("CORS allows only known origins", async () => {
    const ctx = await setup();
    const ok = await ctx.app.request("/health", { headers: { Origin: "http://localhost:5173" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const evil = await ctx.app.request("/health", { headers: { Origin: "https://evil.example.com" } });
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("sets security headers and returns JSON errors", async () => {
    const ctx = await setup();
    const r = await ctx.app.request("/nope");
    expect(r.status).toBe(404);
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("strict-transport-security")).toContain("max-age");
    expect(await r.json()).toEqual({ error: { code: "not_found", message: "route not found" } });
  });

  it("rate-limits the public share page per IP", async () => {
    const ctx = await setup();
    const headers = { "x-forwarded-for": "198.51.100.7" };
    let last = 0;
    for (let i = 0; i < 125; i++) last = (await ctx.call("GET", "/public/l/aaaaaaaaaaaaaaaaaaaaaa", undefined, { headers })).status;
    expect(last).toBe(429);
  });

  it("rejects non-JSON and oversized bodies", async () => {
    const ctx = await setup();
    const bad = await ctx.app.request("/auth/kid/login", { method: "POST", body: "{not json", headers: { "Content-Type": "application/json" } });
    expect(bad.status).toBe(400);
    const huge = await ctx.app.request("/auth/kid/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.co", password: "x".repeat(600_000) }),
      headers: { "Content-Type": "application/json" },
    });
    expect(huge.status).toBe(413);
  });
});
