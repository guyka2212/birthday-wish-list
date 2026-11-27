/**
 * Payment abstraction. The app never sees card numbers: a real provider (e.g. Stripe, Tranzila, Meshulam, PayPlus)
 * would hand the guest a hosted payment page / tokenized element, and we'd only receive a reference.
 */
export interface ChargeRequest {
  amountAgorot: number;
  currency: "ILS";
  description: string;
  /** idempotency key so retries don't double-charge */
  idempotencyKey: string;
  buyerEmail: string;
}

export interface ChargeResult {
  ok: boolean;
  provider: string;
  reference: string;
  failureReason?: string;
}

export interface PaymentProvider {
  readonly name: string;
  charge(req: ChargeRequest): Promise<ChargeResult>;
  refund(reference: string, amountAgorot: number): Promise<{ ok: boolean }>;
}

/** Always-succeeds mock. Swap for a real provider by implementing PaymentProvider and wiring it in context.ts. */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";
  private seen = new Map<string, ChargeResult>();

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    const prior = this.seen.get(req.idempotencyKey);
    if (prior) return prior;
    if (!Number.isInteger(req.amountAgorot) || req.amountAgorot <= 0) {
      return { ok: false, provider: this.name, reference: "", failureReason: "invalid amount" };
    }
    const result = { ok: true, provider: this.name, reference: `fake_${req.idempotencyKey.slice(0, 16)}` };
    this.seen.set(req.idempotencyKey, result);
    return result;
  }

  async refund(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
