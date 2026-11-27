import type { Executor } from "../db";
import { run } from "../db";
import { newId } from "./crypto";

export interface AuditEntry {
  actorType: "kid" | "shop" | "admin" | "guest" | "system" | "api_key";
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  ipHash?: string;
}

/** Append-only audit log. Never put secrets or PII in `meta`. */
export async function audit(db: Executor, e: AuditEntry, now: number) {
  await run(
    db,
    "INSERT INTO audit_log (id, actor_type, actor_id, action, target_type, target_id, meta, ip_hash, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [
      newId(),
      e.actorType,
      e.actorId ?? null,
      e.action,
      e.targetType ?? null,
      e.targetId ?? null,
      e.meta ? JSON.stringify(e.meta).slice(0, 1000) : null,
      e.ipHash ?? null,
      now,
    ],
  );
}
