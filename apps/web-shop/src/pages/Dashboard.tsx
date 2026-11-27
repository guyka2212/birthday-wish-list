import { useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORIES, CATEGORY_LABELS, formatILS, type Category, type ShopOrder, type ShopProduct } from "@bwl/shared";
import { shopApi } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorBox, Field, inputClass, Loading, useLoad } from "../components/ui";
import { errText } from "./Auth";

export function DashboardPage() {
  const { data, error, loading, reload } = useLoad(() => shopApi.dashboard());
  const orders = useLoad(() => shopApi.orders());
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} onRetry={reload} />;
  const max = Math.max(1, ...data.salesByDay.map((d) => d.salesAgorot));
  const t = data.totals;
  return (
    <div className="flex flex-col gap-5">
      {data.shop.status !== "approved" && (
        <Card className="border-2 border-sun bg-sun/10">
          <p className="text-lg font-extrabold">⏳ החנות ממתינה לאישור</p>
          <p className="text-ink-soft">אפשר כבר להוסיף מוצרים. הם יוצגו לילדים אחרי שצוות המערכת יאשר את החנות.</p>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["💰", "סך מכירות", formatILS(t.salesAgorot)],
          ["🧾", "הזמנות", t.orders],
          ["📦", "הזמנות פתוחות", t.openOrders],
          ["🧸", "מוצרים פעילים", t.productsActive],
          ["⚠️", "מלאי נמוך (≤2)", t.lowStock],
        ].map(([e, l, v]) => (
          <Card key={String(l)}>
            <p className="text-2xl" aria-hidden>{e}</p>
            <p className="text-sm text-ink-soft">{l}</p>
            <p className="text-2xl font-extrabold">{v}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="mb-4 text-lg font-extrabold">מכירות ב-14 הימים האחרונים</h2>
        <div className="flex h-40 items-end gap-1.5" role="img" aria-label="גרף מכירות יומי">
          {data.salesByDay.map((d) => (
            <div key={d.day} className="group relative flex-1">
              <div className="rounded-t-lg bg-gradient-to-t from-sky to-mint" style={{ height: `${Math.max(3, (d.salesAgorot / max) * 150)}px` }} title={`${d.day}: ${formatILS(d.salesAgorot)}`} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">הזמנות אחרונות</h2>
          <Link to="/orders" className="font-bold text-sky-deep">לכל ההזמנות ←</Link>
        </div>
        {orders.loading ? <Loading /> : orders.data?.length ? (
          <ul className="divide-y divide-sky-soft">
            {orders.data.slice(0, 5).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-bold" dir="ltr">{o.number}</span>
                <span>{o.items.map((i) => i.title).join(", ")}</span>
                <span className="font-bold">{formatILS(o.totalAgorot)}</span>
                <Badge status={o.status} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty emoji="🛍️" title="עוד אין הזמנות" body="כשאורח יקנה מתנה מהחנות, היא תופיע כאן." />
        )}
      </Card>
    </div>
  );
}

const NEXT: Record<string, Array<[string, string]>> = {
  new: [["preparing", "להתחיל הכנה"], ["cancelled", "ביטול"]],
  preparing: [["ready", "מוכנה לאיסוף"], ["shipped", "נשלחה"], ["cancelled", "ביטול"]],
  ready: [["done", "נאספה ✓"]],
  shipped: [["done", "נמסרה ✓"]],
};
const FLOW = ["new", "preparing", "ready", "done"];

export function OrdersPage() {
  const [filter, setFilter] = useState("");
  const { data, setData, error, loading, reload } = useLoad(() => shopApi.orders(filter || undefined), [filter]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function move(o: ShopOrder, status: string) {
    if (status === "cancelled" && !confirm("לבטל את ההזמנה? המתנה תחזור לרשימה ולמלאי.")) return;
    setBusy(o.id);
    setErr(null);
    try {
      const updated = await shopApi.setOrderStatus(o.id, status);
      setData((data ?? []).map((x) => (x.id === o.id ? updated : x)));
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        {["", "new", "preparing", "ready", "shipped", "done", "cancelled"].map((s) => (
          <button key={s} role="tab" aria-selected={filter === s} onClick={() => setFilter(s)} className={`btn-press rounded-full px-4 py-2 text-sm font-bold ${filter === s ? "bg-sky-deep text-white" : "bg-white"}`}>
            {s === "" ? "הכל" : <Badge status={s} />}
          </button>
        ))}
      </div>
      {err && <ErrorBox error={new Error(err)} />}
      {loading ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : !data?.length ? (
        <Card><Empty emoji="📭" title="אין הזמנות כאן" /></Card>
      ) : (
        data.map((o) => (
          <Card key={o.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-extrabold" dir="ltr">{o.number}</p>
                <p className="text-sm text-ink-soft">{new Date(o.createdAt).toLocaleString("he-IL")} · קונה: {o.buyerName} · עבור {o.kidFirstName}</p>
              </div>
              <Badge status={o.status} />
            </div>
            <ol className="my-3 flex items-center gap-1 text-xs font-bold" aria-label="סטטוס">
              {FLOW.map((s, i) => {
                const reached = FLOW.indexOf(o.status === "shipped" ? "ready" : o.status) >= i && o.status !== "cancelled";
                return (
                  <li key={s} className="flex flex-1 items-center gap-1">
                    <span className={`flex size-7 items-center justify-center rounded-full ${reached ? "bg-mint text-white" : "bg-sky-soft"}`}>{i + 1}</span>
                    <span className="hidden sm:inline">{s === "ready" && o.status === "shipped" ? "נשלחה" : { new: "חדשה", preparing: "בהכנה", ready: "מוכנה", done: "הושלמה" }[s]}</span>
                    {i < FLOW.length - 1 && <span className={`h-1 flex-1 rounded ${reached ? "bg-mint" : "bg-sky-soft"}`} />}
                  </li>
                );
              })}
            </ol>
            <ul className="mb-3 text-sm">
              {o.items.map((i, idx) => (
                <li key={idx} className="flex justify-between border-b border-sky-soft py-1">
                  <span>{i.title} <span className="text-ink-soft" dir="ltr">({i.sku})</span></span>
                  <span className="font-bold">{formatILS(i.priceAgorot * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm">{o.deliveryMethod === "pickup" ? "🏪 איסוף מהחנות" : `🚚 משלוח: ${o.deliveryAddress}`}</p>
            {o.greeting && <p className="mt-2 rounded-xl bg-sun/15 p-3 text-sm">💌 {o.greeting}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-lg font-extrabold">{formatILS(o.totalAgorot)}</span>
              <div className="flex flex-wrap gap-2">
                {(NEXT[o.status] ?? []).map(([s, label]) => (
                  <Button key={s} variant={s === "cancelled" ? "danger" : "sun"} disabled={busy === o.id} onClick={() => move(o, s)}>{label}</Button>
                ))}
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

type Draft = { id?: string; sku: string; title: string; description: string; category: Category; price: string; imageUrl: string; stock: string; active: boolean };
const emptyDraft: Draft = { sku: "", title: "", description: "", category: "toys", price: "", imageUrl: "", stock: "0", active: true };

export function ProductsPage() {
  const { data, setData, error, loading, reload } = useLoad(() => shopApi.products());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setErr(null);
    const payload = {
      title: draft.title,
      description: draft.description,
      category: draft.category,
      priceAgorot: Math.round(Number(draft.price) * 100),
      imageUrl: draft.imageUrl || null,
      stock: Number(draft.stock),
      active: draft.active,
    };
    try {
      const saved = draft.id ? await shopApi.updateProduct(draft.id, payload) : await shopApi.createProduct({ ...payload, sku: draft.sku });
      setData(draft.id ? (data ?? []).map((p) => (p.id === saved.id ? saved : p)) : [saved, ...(data ?? [])]);
      setDraft(null);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setSaving(false);
    }
  }

  async function quickStock(p: ShopProduct, stock: number) {
    try {
      const saved = await shopApi.updateProduct(p.id, { stock });
      setData((data ?? []).map((x) => (x.id === p.id ? saved : x)));
    } catch (e) {
      setErr(errText(e));
    }
  }

  const list = (data ?? []).filter((p) => !q || p.title.includes(q) || p.sku.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className={`${inputClass} max-w-xs`} placeholder="🔍 חיפוש לפי שם או SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש" />
        <Button onClick={() => setDraft({ ...emptyDraft })}>➕ מוצר חדש</Button>
        <Link to="/api" className="text-sm font-bold text-sky-deep">או לסנכרן מלאי דרך ה-API ←</Link>
      </div>
      {err && <ErrorBox error={new Error(err)} />}
      {loading ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : !list.length ? (
        <Card><Empty emoji="🧸" title="אין מוצרים עדיין" body="הוסיפו מוצר ידנית או חברו את המלאי דרך ה-API." /></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-sky-soft text-start">
              <tr>
                {["", "מוצר", "SKU", "קטגוריה", "מחיר", "מלאי", "סטטוס", ""].map((h, i) => <th key={i} className="p-3 text-start">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={`border-t border-sky-soft ${p.active ? "" : "opacity-50"}`}>
                  <td className="p-2">{p.imageUrl ? <img src={p.imageUrl} alt="" className="size-10 object-contain" /> : CATEGORY_LABELS[p.category].emoji}</td>
                  <td className="p-2 font-bold">{p.title}</td>
                  <td className="p-2" dir="ltr">{p.sku}</td>
                  <td className="p-2">{CATEGORY_LABELS[p.category].he}</td>
                  <td className="p-2">{formatILS(p.priceAgorot)}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <button className="btn-press size-8 rounded-lg bg-sky-soft" aria-label={`הורדת מלאי ${p.title}`} onClick={() => quickStock(p, Math.max(0, p.stock - 1))}>−</button>
                      <span className={`w-8 text-center font-bold ${p.stock <= 2 ? "text-danger" : ""}`}>{p.stock}</span>
                      <button className="btn-press size-8 rounded-lg bg-sky-soft" aria-label={`הוספת מלאי ${p.title}`} onClick={() => quickStock(p, p.stock + 1)}>+</button>
                    </div>
                  </td>
                  <td className="p-2">{p.active ? "פעיל" : "מוסתר"}</td>
                  <td className="p-2">
                    <Button variant="ghost" onClick={() => setDraft({ id: p.id, sku: p.sku, title: p.title, description: p.description, category: p.category, price: String(p.priceAgorot / 100), imageUrl: p.imageUrl ?? "", stock: String(p.stock), active: p.active })}>עריכה</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {draft && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setDraft(null)}>
          <Card className="max-h-[90dvh] w-full max-w-lg overflow-y-auto">
            <div role="dialog" aria-modal="true" aria-label="מוצר" onClick={(e) => e.stopPropagation()} className="flex flex-col gap-3">
              <h2 className="text-xl font-extrabold">{draft.id ? "עריכת מוצר" : "מוצר חדש"}</h2>
              <Field label="SKU (מק״ט)"><input className={inputClass} dir="ltr" value={draft.sku} disabled={!!draft.id} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></Field>
              <Field label="שם המוצר"><input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
              <Field label="תיאור"><textarea className={inputClass} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="קטגוריה">
                  <select className={inputClass} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c].emoji} {CATEGORY_LABELS[c].he}</option>)}
                  </select>
                </Field>
                <Field label="מחיר ₪ (כולל מע״מ)"><input className={inputClass} type="number" min="0" step="0.01" dir="ltr" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></Field>
                <Field label="מלאי"><input className={inputClass} type="number" min="0" dir="ltr" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} /></Field>
                <label className="flex items-end gap-2 pb-3 font-bold"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> מוצג לילדים</label>
              </div>
              <Field label="קישור לתמונה"><input className={inputClass} type="url" dir="ltr" value={draft.imageUrl} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} /></Field>
              {err && <p role="alert" className="font-bold text-danger">{err}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="soft" onClick={() => setDraft(null)}>ביטול</Button>
                <Button onClick={save} disabled={saving}>{saving ? "…" : "לשמור"}</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
