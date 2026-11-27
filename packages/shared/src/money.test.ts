import { describe, expect, it } from "vitest";
import { formatILS, splitGross, vatFromGross } from "./money";

describe("money", () => {
  it("extracts 17% VAT from a VAT-inclusive total", () => {
    expect(vatFromGross(11_700)).toBe(1_700); // ₪117 → ₪17 VAT
    expect(splitGross(11_700)).toEqual({ total: 11_700, vat: 1_700, subtotal: 10_000 });
  });
  it("rounds to the agora and subtotal + vat always equals total", () => {
    for (const g of [1, 99, 4_990, 12_345, 99_999]) {
      const s = splitGross(g);
      expect(s.subtotal + s.vat).toBe(g);
    }
  });
  it("formats shekels", () => {
    expect(formatILS(4990, "en")).toContain("49.90");
  });
});
