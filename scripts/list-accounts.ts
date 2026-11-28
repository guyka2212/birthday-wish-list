// Read-only: list shops, kids and admins in the database chosen by apps/api/.env, to spot test accounts.
// Usage: DB_MODE=remote npx tsx scripts/list-accounts.ts
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../apps/api/src/config";
import { all, createDb } from "../apps/api/src/db";
import { createCryptoBox } from "../apps/api/src/lib/crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, "apps", "api", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const config = loadConfig(process.env);
const db = createDb(config);
const box = await createCryptoBox(config.ENCRYPTION_KEY, config.BLIND_INDEX_KEY);
const day = (t: number) => new Date(Number(t)).toISOString().slice(0, 16).replace("T", " ");

const shops = await all<{ id: string; name: string; city: string; status: string; email_enc: string; created_at: number; products: number; orders: number }>(
  db,
  `SELECT sh.id, sh.name, sh.city, sh.status, sh.email_enc, sh.created_at,
     (SELECT COUNT(*) FROM products p WHERE p.shop_id = sh.id) AS products,
     (SELECT COUNT(*) FROM orders o WHERE o.shop_id = sh.id) AS orders
   FROM shops sh ORDER BY sh.created_at`,
);
console.log("SHOPS");
for (const s of shops) console.log([s.id, s.name, s.city, s.status, await box.decrypt(s.email_enc), day(s.created_at), `products=${s.products}`, `orders=${s.orders}`].join(" | "));

const kids = await all<{ id: string; username: string; first_name: string; email_enc: string; created_at: number; deleted_at: number | null; lists: number }>(
  db,
  `SELECT u.id, u.username, u.first_name, u.email_enc, u.created_at, u.deleted_at,
     (SELECT COUNT(*) FROM lists l WHERE l.user_id = u.id) AS lists
   FROM users u ORDER BY u.created_at`,
);
console.log("KIDS");
for (const k of kids) console.log([k.id, k.username, k.first_name, await box.decrypt(k.email_enc), day(k.created_at), k.deleted_at ? "DELETED" : "", `lists=${k.lists}`].join(" | "));

const admins = await all<{ id: string; name: string; email_enc: string }>(db, "SELECT id, name, email_enc FROM admins");
console.log("ADMINS");
for (const a of admins) console.log([a.id, a.name, await box.decrypt(a.email_enc)].join(" | "));
