import { useState } from "react";
import { formatILS, type AdminShopStats } from "@bwl/shared";
import { adminApi } from "../lib/api";
import { Badge, Card, Empty, ErrorBox, Loading, useLoad } from "../components/ui";

const PERIODS = [7, 30, 90, 365] as const;
const ils = (a: number) => formatILS(a, "he");
const dateHe = (ts: number | string | null) => (ts ? new Date(ts).toLocaleDateString("he-IL") : "—");

/** Fill in days with no orders so the bars sit on a true time axis. */
function fillDays(byDay: AdminShopStats["byDay"], days: number) {
  const map = new Map(byDay.map((d) => [d.day, d]));
  const out: AdminShopStats["byDay"] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i)).toISOString().slice(0, 10);
    out.push(map.get(d) ?? { day: d, orders: 0, salesAgorot: 0 });
  }
  return out;
}

function SalesChart({ data, days }: { data: AdminShopStats["byDay"]; days: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = fillDays(data, Math.min(days, 90));
  const max = Math.max(1, ...rows.map((r) => r.salesAgorot));
  const h = hover != null ? rows[hover] : null;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-extrabold">מכירות לפי יום</h3>
        <p className="min-h-6 text-sm text-ink-soft" aria-live="polite">
          {h ? (
            <>
              <b className="text-ink">{dateHe(h.day)}</b> · {ils(h.salesAgorot)} · {h.orders} הזמנות
            </>
          ) : (
            `שיא יומי: ${ils(max)}`
          )}
        </p>
      </div>
      <div className="relative h-40 border-b border-black/10" role="img" aria-label={`מכירות לפי יום, ${rows.length} ימים אחרונים`} onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-black/5" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-black/5" />
        <div className="relative flex h-full items-end gap-[2px]">
          {rows.map((r, i) => (
            <button
              key={r.day}
              type="button"
              className="flex h-full flex-1 items-end focus:outline-none"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              aria-label={`${dateHe(r.day)}: ${ils(r.salesAgorot)}, ${r.orders} הזמנות`}
            >
              <span
                className={`block w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-sky-deep" : "bg-sky"} ${r.salesAgorot === 0 ? "opacity-0" : ""}`}
                style={{ height: `${Math.max(2, (r.salesAgorot / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-soft">
        <span>{dateHe(rows[0]!.day)}</span>
        <span>היום</span>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-bold text-sky-deep">הצגה כטבלה</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-ink-soft">
              <th className="text-start">יום</th>
              <th className="text-start">הזמנות</th>
              <th className="text-start">מכירות</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => r.orders)
              .map((r) => (
                <tr key={r.day}>
                  <td>{dateHe(r.day)}</td>
                  <td>{r.orders}</td>
                  <td>{ils(r.salesAgorot)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}

export function AdminStats() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const s = useLoad(() => adminApi.shopStats(days), [days]);
  if (s.loading && !s.data) return <Loading />;
  if (s.error) return <ErrorBox error={s.error} onRetry={s.reload} />;
  const d = s.data!;
  const tiles: Array<[string, string, string]> = [
    ["💰", "סה״כ מכירות", ils(d.totals.salesAgorot)],
    ["📅", `מכירות ב-${d.days} ימים`, ils(d.totals.periodSalesAgorot)],
    ["🛍️", "הזמנות", String(d.totals.orders)],
    ["🧾", "ממוצע להזמנה", ils(d.totals.avgOrderAgorot)],
    ["🔎", "ממתינות לבדיקת מלאי", String(d.totals.waitingForStock)],
    ["↩️", "בוטלו / לא במלאי", String(d.totals.cancelled)],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="תקופה">
        <span className="font-bold">תקופה:</span>
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setDays(p)}
            aria-pressed={days === p}
            className={`btn-press rounded-full px-3 py-1.5 text-sm font-bold ${days === p ? "bg-ink text-white" : "bg-white"}`}
          >
            {p === 365 ? "שנה" : `${p} ימים`}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([e, l, v]) => (
          <Card key={l} className="p-4">
            <p className="text-xs text-ink-soft">
              {e} {l}
            </p>
            <p className="text-xl font-extrabold">{v}</p>
          </Card>
        ))}
      </div>
      <SalesChart data={d.byDay} days={d.days} />
      <Card className="overflow-x-auto">
        <h3 className="mb-3 text-lg font-extrabold">מכירות לפי חנות</h3>
        {!d.shops.length ? (
          <Empty emoji="🏪" title="אין עדיין חנויות" />
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-ink-soft">
                {["חנות", "סטטוס", "מוצרים (במלאי)", "הזמנות", "מכירות", `ב-${d.days} ימים`, "ממתינות", "בוטלו", "הזמנה אחרונה"].map((h) => (
                  <th key={h} className="p-2 text-start font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.shops.map((r) => (
                <tr key={r.id} className="border-b border-black/5 last:border-0">
                  <td className="p-2">
                    <p className="font-bold">{r.name}</p>
                    <p className="text-xs text-ink-soft">
                      {r.city}
                      {r.chainNo != null && <span className="ms-2 rounded-full bg-sky-soft px-2 py-0.5 font-bold text-ink">רשת #{r.chainNo}</span>}
                    </p>
                  </td>
                  <td className="p-2">
                    <Badge status={r.status} />
                  </td>
                  <td className="p-2">
                    {r.products} ({r.inStock})
                  </td>
                  <td className="p-2">{r.orders}</td>
                  <td className="p-2 font-extrabold">{ils(r.salesAgorot)}</td>
                  <td className="p-2">
                    {ils(r.periodSalesAgorot)} · {r.periodOrders}
                  </td>
                  <td className="p-2">{r.waitingForStock ? <b>⏳ {r.waitingForStock}</b> : 0}</td>
                  <td className="p-2">{r.cancelled}</td>
                  <td className="p-2">{dateHe(r.lastOrderAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-ink-soft">המכירות לא כוללות הזמנות שבוטלו. סניפים עם אותו ח.פ מסומנים באותו מספר רשת.</p>
      </Card>
      <Card>
        <h3 className="mb-3 text-lg font-extrabold">המתנות הנמכרות ביותר ({d.days} ימים)</h3>
        {!d.topProducts.length ? (
          <Empty emoji="🎁" title="עוד אין מכירות בתקופה הזו" />
        ) : (
          <ol className="flex flex-col gap-2">
            {d.topProducts.map((p, i) => (
              <li key={`${p.title}-${p.shop}`} className="flex items-center justify-between gap-3 rounded-2xl bg-sky-soft/50 px-3 py-2">
                <span>
                  <b>{i + 1}.</b> {p.title} <span className="text-xs text-ink-soft">· {p.shop}</span>
                </span>
                <span className="whitespace-nowrap font-bold">
                  {p.sold} × · {ils(p.salesAgorot)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
