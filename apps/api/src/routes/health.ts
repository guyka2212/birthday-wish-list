import os from "node:os";
import { Hono } from "hono";
import type { AppEnv, Deps } from "../context";
import { all, one } from "../db";

/** Per-instance counters (a serverless instance lives for minutes to hours). */
const BOOT_AT = Date.now();
let requestsServed = 0;

const DAY = 86_400_000;

/**
 * Everything worth knowing about the service at a glance.
 * Public endpoint, so: no money figures and no personal data — only operational status and counts.
 */
async function healthReport(deps: Deps) {
  const { db, config, mailer, payments, now } = deps;
  const started = performance.now();
  requestsServed++;
  const coldStart = requestsServed === 1;

  // ---- database reachability + latency ----
  let dbOk = true;
  let dbError: string | null = null;
  const t0 = performance.now();
  try {
    await db.execute("SELECT 1");
  } catch (e) {
    dbOk = false;
    dbError = e instanceof Error ? e.message.slice(0, 160) : "db error";
  }
  const pingMs = Math.round(performance.now() - t0);

  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    if (!dbOk) return fallback;
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  // ---- database stats ----
  const migrations = await safe(() => all<{ version: string }>(db, "SELECT version FROM schema_migrations ORDER BY version"), []);
  const tables = await safe(
    () => all<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' AND name NOT LIKE '_cf_%' ORDER BY name"),
    [],
  );
  const tq0 = performance.now();
  const rowCounts = tables.length
    ? await safe(
        () => all<{ t: string; n: number }>(db, tables.map((t) => `SELECT '${t.name.replace(/'/g, "")}' AS t, COUNT(*) AS n FROM "${t.name.replace(/"/g, "")}"`).join(" UNION ALL ")),
        [],
      )
    : [];
  const queryMs = Math.round(performance.now() - tq0);
  const pageCount = await safe(async () => Number((await one<{ page_count: number }>(db, "PRAGMA page_count"))?.page_count ?? 0), 0);
  const pageSize = await safe(async () => Number((await one<{ page_size: number }>(db, "PRAGMA page_size"))?.page_size ?? 0), 0);
  const indexes = await safe(async () => Number((await one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index'"))?.n ?? 0), 0);

  // ---- app + activity counts (one round trip) ----
  const ts = now();
  const counts = await safe(
    async () =>
      (await one<Record<string, number>>(
        db,
        `SELECT
          (SELECT COUNT(*) FROM shops WHERE status = 'approved') AS approvedShops,
          (SELECT COUNT(*) FROM shops WHERE status = 'pending') AS pendingShops,
          (SELECT COUNT(DISTINCT COALESCE(business_id_hash, id)) FROM shops WHERE status = 'approved') AS shopChains,
          (SELECT COUNT(*) FROM products WHERE active = 1) AS activeProducts,
          (SELECT COUNT(*) FROM products p JOIN stock s ON s.product_id = p.id WHERE p.active = 1 AND s.quantity > 0) AS productsInStock,
          (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS kids,
          (SELECT COUNT(*) FROM lists WHERE deleted_at IS NULL) AS lists,
          (SELECT COUNT(*) FROM share_links WHERE enabled = 1 AND revoked_at IS NULL) AS sharedLists,
          (SELECT COUNT(*) FROM list_items) AS wishedGifts,
          (SELECT COUNT(*) FROM list_items WHERE status = 'purchased') AS giftedGifts,
          (SELECT COUNT(*) FROM reservations WHERE status = 'held' AND expires_at > ?) AS activeHolds,
          (SELECT COUNT(*) FROM orders WHERE created_at > ?) AS orders24h,
          (SELECT COUNT(*) FROM orders WHERE created_at > ?) AS orders7d,
          (SELECT COUNT(*) FROM orders WHERE status = 'new') AS waitingForStockCheck,
          (SELECT COUNT(*) FROM users WHERE created_at > ?) AS signups7d,
          (SELECT COUNT(*) FROM email_outbox WHERE status = 'sent' AND created_at > ?) AS emailsSent24h,
          (SELECT COUNT(*) FROM email_outbox WHERE status = 'failed' AND created_at > ?) AS emailsFailed24h,
          (SELECT COUNT(*) FROM email_outbox) AS emailsTotal,
          (SELECT COUNT(*) FROM refresh_tokens WHERE revoked_at IS NULL AND expires_at > ?) AS activeSessions`,
        [ts, ts - DAY, ts - 7 * DAY, ts - 7 * DAY, ts - DAY, ts - DAY, ts],
      )) ?? {},
    {} as Record<string, number>,
  );
  const n = (k: string) => (counts[k] == null ? null : Number(counts[k]));

  const mem = process.memoryUsage();
  const mb = (b: number) => Math.round((b / 1024 / 1024) * 10) / 10;
  return {
    status: dbOk ? "ok" : "degraded",
    time: new Date(ts).toISOString(),
    responseMs: Math.round(performance.now() - started),
    service: {
      name: "Birthday Wish List API",
      environment: config.NODE_ENV,
      host: process.env.VERCEL ? "Vercel (serverless)" : "local",
      region: process.env.VERCEL_REGION ?? "local",
      commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null,
    },
    server: {
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
      cpus: os.cpus().length,
      instanceUptimeSec: Math.round((Date.now() - BOOT_AT) / 1000),
      coldStart,
      requestsServedByInstance: requestsServed,
      memoryMb: { rss: mb(mem.rss), heapUsed: mb(mem.heapUsed), heapTotal: mb(mem.heapTotal) },
      loadAvg: os.loadavg().map((x) => Math.round(x * 100) / 100),
    },
    database: {
      ok: dbOk,
      engine: config.DB_MODE === "remote" ? "Turso (libSQL, cloud)" : `libSQL (${config.DB_MODE})`,
      pingMs,
      statsQueryMs: queryMs,
      sizeKb: pageCount && pageSize ? Math.round((pageCount * pageSize) / 1024) : null,
      tables: tables.length,
      indexes,
      migrationsApplied: migrations.length,
      latestMigration: migrations.at(-1)?.version ?? null,
      totalRows: rowCounts.reduce((a, r) => a + Number(r.n), 0),
      rowsByTable: Object.fromEntries(rowCounts.map((r) => [r.t, Number(r.n)])),
      error: dbError,
    },
    email: { provider: mailer.providerName, sent24h: n("emailsSent24h"), failed24h: n("emailsFailed24h"), total: n("emailsTotal") },
    payments: { provider: payments.name },
    counts: {
      approvedShops: n("approvedShops"),
      pendingShops: n("pendingShops"),
      shopChains: n("shopChains"),
      activeProducts: n("activeProducts"),
      productsInStock: n("productsInStock"),
      kids: n("kids"),
      lists: n("lists"),
      sharedLists: n("sharedLists"),
      wishedGifts: n("wishedGifts"),
      giftedGifts: n("giftedGifts"),
    },
    activity: {
      activeHolds: n("activeHolds"),
      orders24h: n("orders24h"),
      orders7d: n("orders7d"),
      waitingForStockCheck: n("waitingForStockCheck"),
      signups7d: n("signups7d"),
      activeSessions: n("activeSessions"),
    },
  };
}

type Report = Awaited<ReturnType<typeof healthReport>>;

const esc = (v: unknown) => String(v ?? "—").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const fmtNum = (v: number | null) => (v == null ? "—" : v.toLocaleString("en-US"));
function fmtUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}
const speed = (ms: number) => (ms < 150 ? "good" : ms < 600 ? "warn" : "bad");

function page(r: Report) {
  const ok = r.status === "ok";
  const tile = (label: string, value: string, emoji: string) =>
    `<div class="tile"><div class="e">${emoji}</div><div class="v">${esc(value)}</div><div class="l">${esc(label)}</div></div>`;
  const row = (label: string, value: unknown, tone?: "good" | "warn" | "bad") =>
    `<div class="row"><span>${esc(label)}</span><b class="${tone ?? ""}">${esc(value)}</b></div>`;
  const heapPct = Math.min(100, Math.round((r.server.memoryMb.heapUsed / Math.max(1, r.server.memoryMb.heapTotal)) * 100));
  const tableRows = Object.entries(r.database.rowsByTable).sort((a, b) => b[1] - a[1]);
  const maxRows = Math.max(1, ...tableRows.map(([, v]) => v));
  const size = r.database.sizeKb == null ? "—" : r.database.sizeKb > 2048 ? `${(r.database.sizeKb / 1024).toFixed(1)} MB` : `${r.database.sizeKb} KB`;
  return `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="30"><title>${ok ? "🟢" : "🔴"} System status · Birthday Wish List</title>
<style>
:root{--sky:#3FA9F5;--deep:#1C7FD1;--ink:#1D2B4F;--soft:#5B6A8A;--bg:#F2F8FF;--line:#e3ecf7;--card:#fff;--tile:#F2F8FF;--good:#1a9e6c;--warn:#b7791f;--bad:#d64045}
@media (prefers-color-scheme:dark){:root{--deep:#7cc4ff;--ink:#E6EEFA;--soft:#9AABC8;--bg:#0E1726;--line:#22324a;--card:#16233a;--tile:#1c2c47;--good:#3ccf95;--warn:#e0a43c;--bad:#ff6b6f}}
*{box-sizing:border-box}body{margin:0;font-family:Rubik,system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink)}
header{background:linear-gradient(90deg,#3FA9F5,#5BC0FF);color:#fff;padding:28px 16px 64px}
.wrap{max-width:1040px;margin:0 auto}h1{margin:0;font-size:28px}.sub{opacity:.92;margin-top:4px}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.badge{display:inline-flex;align-items:center;gap:8px;background:#fff;color:#1D2B4F;padding:7px 14px;border-radius:999px;font-weight:700;font-size:14px}
.dot{width:11px;height:11px;border-radius:50%;background:${ok ? "#2BC48A" : "#E5484D"};box-shadow:0 0 0 4px ${ok ? "#2bc48a33" : "#e5484d33"}}
main{max-width:1040px;margin:-44px auto 32px;padding:0 16px;display:grid;gap:16px}
.card{background:var(--card);border-radius:22px;padding:18px 20px;box-shadow:0 8px 24px #3fa9f51a;min-width:0}.card h2{margin:0 0 10px;font-size:17px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.tile{background:var(--tile);border-radius:16px;padding:12px}.tile .e{font-size:20px}.tile .v{font-size:24px;font-weight:800;font-variant-numeric:tabular-nums}.tile .l{font-size:12.5px;color:var(--soft)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:16px}
.row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--line);font-size:14.5px}.row:last-child{border:0}.row b{font-variant-numeric:tabular-nums;text-align:end;overflow-wrap:anywhere}
.good{color:var(--good)}.warn{color:var(--warn)}.bad{color:var(--bad)}
.meter{height:8px;border-radius:99px;background:var(--line);overflow:hidden;margin:2px 0 8px}.meter>i{display:block;height:100%;background:var(--sky);border-radius:99px}
.trow{display:grid;grid-template-columns:minmax(90px,170px) 1fr 56px;align-items:center;gap:10px;font-size:13.5px;padding:3px 0}
.trow .bar{height:8px;border-radius:0 4px 4px 0;background:var(--sky);min-width:2px}.trow code{color:var(--soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.trow span{text-align:end;font-variant-numeric:tabular-nums}
a{color:var(--deep)}footer{text-align:center;color:var(--soft);font-size:13px;margin-bottom:24px}
</style></head><body>
<header><div class="wrap"><h1>🎁 System status</h1><div class="sub">Birthday Wish List API · auto-refreshes every 30 seconds</div>
<div class="badges"><span class="badge"><span class="dot"></span>${ok ? "All systems operational" : "Degraded: database unreachable"}</span>
<span class="badge">⚡ ${r.responseMs} ms</span><span class="badge">🌍 ${esc(r.service.region)}</span><span class="badge">🗄️ ${esc(r.database.latestMigration)}</span></div></div></header>
<main>
<section class="card"><h2>📊 At a glance</h2><div class="tiles">
${tile("Approved shops", fmtNum(r.counts.approvedShops), "🏪")}${tile("Shop chains", fmtNum(r.counts.shopChains), "🔗")}${tile("Pending shops", fmtNum(r.counts.pendingShops), "⏳")}
${tile("Active products", fmtNum(r.counts.activeProducts), "🧸")}${tile("In stock", fmtNum(r.counts.productsInStock), "📦")}${tile("Kids", fmtNum(r.counts.kids), "🧒")}
${tile("Wish lists", fmtNum(r.counts.lists), "📝")}${tile("Shared lists", fmtNum(r.counts.sharedLists), "📤")}${tile("Gifts wished", fmtNum(r.counts.wishedGifts), "⭐")}${tile("Gifts given", fmtNum(r.counts.giftedGifts), "🎉")}
</div></section>
<div class="grid">
<section class="card"><h2>🖥️ Server</h2>
${row("Host", r.service.host)}${row("Environment", r.service.environment)}${row("Region", r.service.region)}${row("Commit", r.service.commit)}
${row("Node.js", r.server.node)}${row("Platform", r.server.platform)}${row("CPUs", r.server.cpus)}
${row("Instance uptime", fmtUptime(r.server.instanceUptimeSec))}${row("Cold start", r.server.coldStart ? "yes (first request)" : "no (warm)", r.server.coldStart ? "warn" : "good")}
${row("Requests on this instance", fmtNum(r.server.requestsServedByInstance))}${row("Response time", `${r.responseMs} ms`, speed(r.responseMs))}
${row("Memory (RSS)", `${r.server.memoryMb.rss} MB`)}${row("Heap used", `${r.server.memoryMb.heapUsed} / ${r.server.memoryMb.heapTotal} MB (${heapPct}%)`)}
<div class="meter" title="heap used ${heapPct}%"><i style="width:${heapPct}%"></i></div>
${row("Load average (1/5/15 min)", r.server.loadAvg.join(" · "))}${row("Server time (UTC)", r.time)}</section>
<section class="card"><h2>🗄️ Database</h2>
${row("Status", r.database.ok ? "Connected ✓" : "Unreachable ✗", r.database.ok ? "good" : "bad")}${row("Engine", r.database.engine)}
${row("Ping", `${r.database.pingMs} ms`, speed(r.database.pingMs))}${row("Stats query", `${r.database.statsQueryMs} ms`, speed(r.database.statsQueryMs))}
${row("Size", size)}${row("Tables / indexes", `${r.database.tables} / ${r.database.indexes}`)}${row("Total rows", fmtNum(r.database.totalRows))}
${row("Migrations applied", r.database.migrationsApplied)}${row("Latest migration", r.database.latestMigration)}
${r.database.error ? row("Error", r.database.error, "bad") : ""}</section>
<section class="card"><h2>📈 Activity</h2>
${row("Gifts on hold right now", fmtNum(r.activity.activeHolds))}${row("Orders · last 24 h", fmtNum(r.activity.orders24h))}${row("Orders · last 7 days", fmtNum(r.activity.orders7d))}
${row("Waiting for a shop's stock check", fmtNum(r.activity.waitingForStockCheck), r.activity.waitingForStockCheck ? "warn" : "good")}
${row("New kids · last 7 days", fmtNum(r.activity.signups7d))}${row("Signed-in sessions", fmtNum(r.activity.activeSessions))}</section>
<section class="card"><h2>📧 Email &amp; payments</h2>
${row("Email provider", r.email.provider === "smtp" ? "Gmail SMTP ✓" : r.email.provider === "outbox" ? "Outbox only (not sending)" : r.email.provider, r.email.provider === "outbox" ? "warn" : "good")}
${row("Sent · last 24 h", fmtNum(r.email.sent24h))}${row("Failed · last 24 h", fmtNum(r.email.failed24h), r.email.failed24h ? "bad" : "good")}${row("Emails all time", fmtNum(r.email.total))}
${row("Payment provider", r.payments.provider === "fake" ? "Mock (demo, no real charges)" : r.payments.provider)}</section>
</div>
<section class="card"><h2>🧮 Rows per table</h2>
${tableRows.map(([t, v]) => `<div class="trow"><code>${esc(t)}</code><div class="bar" style="width:${Math.max(0.5, (v / maxRows) * 100)}%"></div><span>${fmtNum(v)}</span></div>`).join("") || "<p>—</p>"}
</section>
<footer>Machine-readable: <a href="/health/json">/health/json</a> · Public page: counts only, no money or personal data</footer>
</main></body></html>`;
}

export const health = new Hono<AppEnv>();
health.get("/json", async (c) => {
  const r = await healthReport(c.var.deps);
  c.header("Cache-Control", "no-store");
  return c.json(r, r.status === "ok" ? 200 : 503);
});
health.get("/", async (c) => {
  const r = await healthReport(c.var.deps);
  c.header("Cache-Control", "no-store");
  // the page has inline styles; relax the API's strict CSP for this route only
  c.header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
  return c.html(page(r), r.status === "ok" ? 200 : 503);
});
