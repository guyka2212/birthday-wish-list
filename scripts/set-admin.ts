// Set (or replace) the system admin's login. Credentials come from env vars, never from files:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run admin:set            (local DB)
//   DB_MODE=remote ADMIN_EMAIL=... ADMIN_PASSWORD='...' npm run admin:set         (Turso)
// The password is stored only as an Argon2id hash; the email is AES-256-GCM encrypted. All admin sessions are revoked.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emailSchema, passwordSchema } from "@bwl/shared";
import { loadConfig } from "../apps/api/src/config";
import { createDb, one, run } from "../apps/api/src/db";
import { createCryptoBox, newId } from "../apps/api/src/lib/crypto";
import { hashPassword, verifyPassword } from "../apps/api/src/lib/passwords";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, "apps", "api", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.chdir(join(root, "apps", "api"));

const email = emailSchema.safeParse(process.env.ADMIN_EMAIL ?? "");
const password = passwordSchema.safeParse(process.env.ADMIN_PASSWORD ?? "");
if (!email.success || !password.success) {
  console.error("Set ADMIN_EMAIL (valid email) and ADMIN_PASSWORD (8+ chars, letters and digits).");
  process.exit(1);
}

const config = loadConfig();
const db = createDb(config);
const box = await createCryptoBox(config.ENCRYPTION_KEY, config.BLIND_INDEX_KEY);
const now = Date.now();
const emailHash = await box.blindIndex(email.data);
const passwordHash = await hashPassword(password.data);

const existing = await one<{ id: string }>(db, "SELECT id FROM admins ORDER BY created_at LIMIT 1");
const clash = await one<{ id: string }>(db, "SELECT id FROM admins WHERE email_hash = ?", [emailHash]);
if (clash && clash.id !== existing?.id) {
  console.error("Another admin already uses this email.");
  process.exit(1);
}
let id = existing?.id;
if (id) {
  await run(db, "UPDATE admins SET email_enc = ?, email_hash = ?, password_hash = ? WHERE id = ?", [await box.encrypt(email.data), emailHash, passwordHash, id]);
} else {
  id = newId();
  await run(db, "INSERT INTO admins (id, name, email_enc, email_hash, password_hash, created_at) VALUES (?,?,?,?,?,?)", [
    id, "מנהל/ת המערכת", await box.encrypt(email.data), emailHash, passwordHash, now,
  ]);
}
await run(db, "UPDATE refresh_tokens SET revoked_at = ? WHERE subject_type = 'admin' AND revoked_at IS NULL", [now]);
await run(db, "INSERT INTO audit_log (id, actor_type, actor_id, action, created_at) VALUES (?,?,?,?,?)", [newId(), "system", null, "admin.credentials_set", now]);

// self-check (local hash verification only — no login request is made)
const row = await one<{ password_hash: string; email_enc: string }>(db, "SELECT password_hash, email_enc FROM admins WHERE id = ?", [id]);
const ok = !!row && (await verifyPassword(row.password_hash, password.data)) && (await box.decrypt(row.email_enc)) === email.data;
console.log(`[admin] ${existing ? "updated" : "created"} on ${config.DB_MODE} DB — check ${ok ? "OK" : "FAILED"}; admin sessions revoked`);
db.close();
process.exit(ok ? 0 : 1);
