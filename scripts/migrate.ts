// Apply db/migrations to the database chosen by apps/api/.env (DB_MODE=local|remote).
//   npm run db:migrate            → apply pending migrations
//   npm run db:migrate -- --reset → drop everything first (local only)
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../apps/api/src/config";
import { createDb } from "../apps/api/src/db";
import { dropAll, migrate } from "../apps/api/src/migrate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, "apps", "api", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.chdir(join(root, "apps", "api")); // so file:local.db resolves next to the API

const config = loadConfig();
const db = createDb(config);
if (process.argv.includes("--reset")) {
  if (config.DB_MODE === "remote" && !process.argv.includes("--yes-really")) {
    console.error("Refusing to reset the remote Turso DB. Pass --yes-really if you mean it.");
    process.exit(1);
  }
  await dropAll(db);
  console.log(`[db] dropped all tables (${config.DB_MODE})`);
}
await migrate(db, join(root, "db", "migrations"), (m) => console.log(`[db] ${m}`));
db.close();
