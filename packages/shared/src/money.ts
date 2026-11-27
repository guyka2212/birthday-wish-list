// Money helpers. All amounts are integer agorot (1 ₪ = 100 agorot), VAT included.
export const VAT_RATE_BP = 1700; // 17% in basis points (Israel)

/** VAT contained in a VAT-inclusive total: total × rate / (1 + rate), rounded to the agora. */
export function vatFromGross(grossAgorot: number, rateBp: number = VAT_RATE_BP): number {
  return Math.round((grossAgorot * rateBp) / (10_000 + rateBp));
}

export function splitGross(grossAgorot: number, rateBp: number = VAT_RATE_BP) {
  const vat = vatFromGross(grossAgorot, rateBp);
  return { total: grossAgorot, vat, subtotal: grossAgorot - vat };
}

export function formatILS(agorot: number, locale: "he" | "en" = "he"): string {
  return new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: agorot % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(agorot / 100);
}
