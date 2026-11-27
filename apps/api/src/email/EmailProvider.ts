import type { Executor } from "../db";
import { run } from "../db";
import { maskEmail, newId, type CryptoBox } from "../lib/crypto";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  kind: string; // consent | reset | receipt | order_new | shop_pending | shop_decision
}

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<{ ok: boolean; error?: string }>;
}

/** Dev/default provider: nothing leaves the server; the message is only recorded in email_outbox. */
export class OutboxOnlyProvider implements EmailProvider {
  readonly name = "outbox";
  async send(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

/** Real email through Resend (https://resend.com) when RESEND_API_KEY is configured. */
export class ResendProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private apiKey: string,
    private from: string,
  ) {}
  async send(msg: EmailMessage) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: this.from, to: [msg.to], subject: msg.subject, html: msg.html }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { ok: false, error: `resend ${res.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "send failed" };
    }
  }
}

/** Sends via the provider and always records the message (recipient encrypted) in email_outbox. */
export class Mailer {
  constructor(
    private provider: EmailProvider,
    private box: CryptoBox,
  ) {}

  async send(db: Executor, msg: EmailMessage, now: number) {
    const r = await this.provider.send(msg);
    await run(
      db,
      "INSERT INTO email_outbox (id, to_enc, to_hint, subject, html, kind, provider, status, error, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        newId(),
        await this.box.encrypt(msg.to),
        maskEmail(msg.to),
        msg.subject,
        msg.html,
        msg.kind,
        this.provider.name,
        r.ok ? (this.provider.name === "outbox" ? "stored" : "sent") : "failed",
        r.ok ? null : (r.error ?? "unknown"),
        now,
      ],
    );
    return r.ok;
  }
}
