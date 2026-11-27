// Local dev server: `npm run dev` (from the repo root runs API + both websites).
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { createDeps } from "./context";
import { createApp } from "./app";
import { migrate } from "./migrate";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = join(here, "..", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig();
const deps = await createDeps(config);
if (config.DB_MODE === "local") {
  // keep the local DB schema current automatically
  await migrate(deps.db, join(here, "..", "..", "..", "db", "migrations"), (m) => console.log(`[db] ${m}`));
}
const app = createApp(deps);

serve({ fetch: app.fetch, port: config.PORT, hostname: "0.0.0.0" }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port} (db: ${config.DB_MODE})`);
});
