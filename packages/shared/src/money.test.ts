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

import { generateTheme, QUIZ, type QuizAnswers } from "./quiz";

describe("quiz theme generator", () => {
  const all = (k: string) => QUIZ.find((q) => q.id === k)!.options.map((o) => o.id);
  it("always produces readable text colors for every color × music combination", () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    const contrast = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
      return (x + 0.05) / (y + 0.05);
    };
    for (const color of all("color")) {
      for (const music of all("music")) {
        const t = generateTheme({ color, music, animal: "cat", hobby: "reading", place: "forest", treat: "cake" } as QuizAnswers, "נועה");
        expect(contrast(t.primary, t.onPrimary)).toBeGreaterThanOrEqual(3); // large/bold text (buttons)
        expect(contrast(t.accent, t.onAccent)).toBeGreaterThanOrEqual(3);
        expect(contrast(t.bg, t.text)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
