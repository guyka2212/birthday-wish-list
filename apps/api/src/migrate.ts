import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "@libsql/client";

/** Applies db/migrations/NNNN_*.sql in order, recording each in schema_migrations. Idempotent. */
export async function migrate(db: Client, migrationsDir: string, log: (msg: string) => void = () => {}) {
  await db.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`);
  const done = new Set((await db.execute("SELECT version FROM schema_migrations")).rows.map((r) => String(r.version)));
  const files = readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    // executeMultiple runs the whole file; we wrap it in a transaction for atomicity.
    await db.executeMultiple(`BEGIN;\n${sql}\nINSERT INTO schema_migrations (version, applied_at) VALUES ('${file}', ${Date.now()});\nCOMMIT;`);
    log(`applied ${file}`);
    applied++;
  }
  if (!applied) log("database is up to date");
  return applied;
}

/** Drops every app table (used by `npm run db:reset` on local dev only). */
export async function dropAll(db: Client) {
  const tables = (await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).rows.map((r) =>
    String(r.name),
  );
  await db.execute("PRAGMA foreign_keys = OFF");
  for (const t of tables) await db.execute(`DROP TABLE IF EXISTS "${t}"`);
  await db.execute("PRAGMA foreign_keys = ON");
}
