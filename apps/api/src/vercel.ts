// Vercel (Node.js runtime) entry, using Vercel's Web-standard handler exports (Request → Response).
// Bundled by build.mjs into api/index.mjs. All secrets come from Vercel environment variables.
import { createClient } from "@libsql/client/web";
import type { Db } from "./db";
import { loadConfig } from "./config";
import { createDeps } from "./context";
import { createApp } from "./app";

const config = loadConfig({ ...process.env, DB_MODE: "remote" });
// The /web client talks to Turso over HTTPS only (no native SQLite needed in the function).
const db = createClient({ url: config.TURSO_DATABASE_URL!, authToken: config.TURSO_AUTH_TOKEN }) as unknown as Db;
const app = createApp(await createDeps(config, { db }));

const handler = (req: Request) => app.fetch(req);
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;
