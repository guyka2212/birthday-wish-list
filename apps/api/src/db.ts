import { createClient, type Client, type InArgs, type Row, type Transaction } from "@libsql/client";
import type { Config } from "./config";

export type Db = Client;
export type Executor = Client | Transaction;

export function createDb(config: Config): Db {
  if (config.DB_MODE === "remote") {
    return createClient({ url: config.TURSO_DATABASE_URL!, authToken: config.TURSO_AUTH_TOKEN });
  }
  if (config.DB_MODE === "memory") return createClient({ url: ":memory:" });
  return createClient({ url: config.LOCAL_DB_URL });
}

/** Parameterized query helpers — the only way the app talks to the DB. */
export async function all<T = Row>(db: Executor, sql: string, args: InArgs = []): Promise<T[]> {
  const rs = await db.execute({ sql, args });
  return rs.rows as unknown as T[];
}

export async function one<T = Row>(db: Executor, sql: string, args: InArgs = []): Promise<T | undefined> {
  const rs = await db.execute({ sql, args });
  return rs.rows[0] as unknown as T | undefined;
}

export async function run(db: Executor, sql: string, args: InArgs = []): Promise<number> {
  const rs = await db.execute({ sql, args });
  return rs.rowsAffected;
}

/** Run `fn` inside a write transaction; commits on success, rolls back on error. */
export async function tx<T>(db: Db, fn: (t: Transaction) => Promise<T>): Promise<T> {
  const t = await db.transaction("write");
  try {
    const result = await fn(t);
    await t.commit();
    return result;
  } catch (err) {
    try {
      await t.rollback();
    } catch {
      /* already closed */
    }
    throw err;
  } finally {
    t.close();
  }
}

export function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(",");
}
