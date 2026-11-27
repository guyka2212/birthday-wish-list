import type { Executor } from "../db";
import { run } from "../db";
import { hmacHex, newId } from "../lib/crypto";
import type { Deps } from "../context";

export async function notify(
  db: Executor,
  n: { recipientType: "kid" | "shop" | "admin"; recipientId: string; kind: string; title: string; body: string; refId?: string },
  now: number,
) {
  await run(
    db,
    "INSERT INTO notifications (id, recipient_type, recipient_id, kind, title, body, ref_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [newId(), n.recipientType, n.recipientId, n.kind, n.title, n.body, n.refId ?? null, now],
  );
}

/** Kid-facing gift notification. Deliberately never says who bought or what — it's a surprise. */
export const GIFT_BOUGHT = {
  kind: "gift_bought",
  title: "מישהו קנה לך מתנה! 🎁",
  body: "אחת המתנות ברשימה שלך נקנתה. מה זה? נגלה ביום ההולדת 🤫",
};

/**
 * Sends a signed webhook to a shop. Signature: X-BWL-Signature: t=<unix>,v1=<hmac_sha256(secret, `${t}.${body}`)>.
 * Best effort with a short timeout; failures are swallowed (and could be retried by a queue later).
 */
export async function sendWebhook(deps: Deps, url: string, secret: string, event: string, data: unknown) {
  const t = Math.floor(deps.now() / 1000);
  const payload = JSON.stringify({ id: newId(), event, createdAt: deps.now(), data });
  const sig = await hmacHex(secret, `${t}.${payload}`);
  try {
    const res = await deps.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-BWL-Event": event, "X-BWL-Signature": `t=${t},v1=${sig}` },
      body: payload,
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
