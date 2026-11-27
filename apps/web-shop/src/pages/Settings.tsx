import { TemplatesEditor } from "./Templates";
import { useState } from "react";
import { API_URL, adminApi, shopApi } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorBox, Field, inputClass, Loading, useLoad } from "../components/ui";
import { errText } from "./Auth";

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button variant="soft" onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}>
      {done ? "הועתק ✓" : "📋 העתקה"}
    </Button>
  );
}

function Code({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre dir="ltr" className="overflow-x-auto rounded-2xl bg-ink p-4 text-start text-xs leading-relaxed text-sky-soft"><code>{children}</code></pre>
      <div className="absolute end-2 top-2"><Copy text={children} /></div>
    </div>
  );
}

/** API key (shown once), webhook settings and shop profile. */
export function ApiPage() {
  const me = useLoad(() => shopApi.me());
  const [newKey, setNewKey] = useState<string | null>(null);
  const [webhook, setWebhook] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (me.loading) return <Loading />;
  if (me.error || !me.data) return <ErrorBox error={me.error} onRetry={me.reload} />;
  const shop = me.data;
  const approved = shop.status === "approved";

  async function rotate() {
    if (shop.apiKeyPrefix && !confirm("ליצור מפתח חדש? המפתח הקודם יפסיק לעבוד מיד.")) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await shopApi.rotateKey();
      setNewKey(r.apiKey);
      me.setData({ ...shop, apiKeyPrefix: r.prefix });
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveWebhook() {
    setErr(null);
    try {
      const r = await shopApi.updateMe({ webhookUrl: (webhook ?? shop.webhookUrl ?? "").trim() || null });
      setSecret(r.webhookSecret ?? null);
      me.setData(r);
      setWebhook(null);
    } catch (e) {
      setErr(errText(e));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {err && <ErrorBox error={new Error(err)} />}
      <Card>
        <h2 className="text-xl font-extrabold">🔑 מפתח API</h2>
        <p className="mb-3 text-ink-soft">משמש לסנכרון מוצרים ומלאי מהקופה או מהאתר שלכם. המפתח מוצג פעם אחת בלבד ונשמר אצלנו מוצפן (hash).</p>
        {!approved ? (
          <p className="font-bold text-ink-soft">⏳ אפשר ליצור מפתח אחרי אישור החנות.</p>
        ) : (
          <>
            {shop.apiKeyPrefix && !newKey && <p className="mb-3">מפתח פעיל: <code dir="ltr" className="rounded bg-sky-soft px-2 py-1">{shop.apiKeyPrefix}…</code></p>}
            {newKey && (
              <div className="mb-3 rounded-2xl border-2 border-sun bg-sun/10 p-4">
                <p className="mb-2 font-extrabold">שמרו את המפתח עכשיו — לא נציג אותו שוב:</p>
                <div className="flex flex-wrap items-center gap-2"><code dir="ltr" className="break-all rounded bg-white px-2 py-1">{newKey}</code><Copy text={newKey} /></div>
              </div>
            )}
            <Button onClick={rotate} disabled={busy}>{shop.apiKeyPrefix ? "🔄 החלפת מפתח" : "✨ יצירת מפתח"}</Button>
          </>
        )}
      </Card>
      <Card>
        <h2 className="text-xl font-extrabold">🔔 Webhook (לא חובה)</h2>
        <p className="mb-3 text-ink-soft">נשלח אליכם POST על הזמנה חדשה ועל שינוי סטטוס, חתום ב-HMAC.</p>
        <div className="flex flex-wrap gap-2">
          <input className={`${inputClass} max-w-md`} dir="ltr" type="url" placeholder="https://your-shop.example/hooks/bwl" value={webhook ?? shop.webhookUrl ?? ""} onChange={(e) => setWebhook(e.target.value)} />
          <Button variant="sky" onClick={saveWebhook}>לשמור</Button>
        </div>
        {secret && (
          <div className="mt-3 rounded-2xl border-2 border-sun bg-sun/10 p-4">
            <p className="mb-2 font-extrabold">סוד החתימה (מוצג פעם אחת):</p>
            <div className="flex flex-wrap items-center gap-2"><code dir="ltr" className="break-all rounded bg-white px-2 py-1">{secret}</code><Copy text={secret} /></div>
          </div>
        )}
      </Card>
      <DocsSection />
    </div>
  );
}

export function DocsSection() {
  const key = "bwl_live_YOUR_KEY_HERE";
  return (
    <Card>
      <h2 className="text-xl font-extrabold">📘 תיעוד ה-API</h2>
      <p className="mb-4 text-ink-soft">
        כתובת בסיס: <code dir="ltr" className="rounded bg-sky-soft px-2">{API_URL}</code> · מפרט OpenAPI מלא:{" "}
        <a className="font-bold text-sky-deep underline" href={`${API_URL}/openapi.json`} target="_blank" rel="noreferrer">openapi.json</a>. מחירים באגורות כולל מע״מ (₪149.90 = 14990). מגבלה: 120 בקשות לדקה.
      </p>
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="mb-2 font-extrabold">יצירה/עדכון של מוצר (לפי SKU)</h3>
          <Code>{`curl -X POST ${API_URL}/api/shop/products \\
  -H "X-Api-Key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"sku":"LEGO-60380","title":"לגו סיטי – מרכז העיר","category":"lego","priceAgorot":49990,"stock":4,"imageUrl":"https://example.com/lego.jpg"}'`}</Code>
        </section>
        <section>
          <h3 className="mb-2 font-extrabold">הרבה מוצרים בבת אחת (עד 500)</h3>
          <Code>{`curl -X POST ${API_URL}/api/shop/products \\
  -H "X-Api-Key: ${key}" -H "Content-Type: application/json" \\
  -d '{"products":[{"sku":"BALL-5","title":"כדורגל","category":"sports","priceAgorot":11900,"stock":10},
                   {"sku":"KITE-1","title":"עפיפון","category":"toys","priceAgorot":5900,"stock":3}]}'`}</Code>
        </section>
        <section>
          <h3 className="mb-2 font-extrabold">החלפת מוצר לפי SKU</h3>
          <Code>{`curl -X PUT ${API_URL}/api/shop/products/KITE-1 \\
  -H "X-Api-Key: ${key}" -H "Content-Type: application/json" \\
  -d '{"title":"עפיפון קשת","category":"toys","priceAgorot":6900,"stock":5}'`}</Code>
        </section>
        <section>
          <h3 className="mb-2 font-extrabold">סנכרון מלאי מרוכז (עד 1000 SKU)</h3>
          <Code>{`curl -X POST ${API_URL}/api/shop/stock/sync \\
  -H "X-Api-Key: ${key}" -H "Content-Type: application/json" \\
  -d '{"items":[{"sku":"BALL-5","quantity":7},{"sku":"KITE-1","quantity":0}]}'
# → {"updated":2,"unknownSkus":[]}`}</Code>
        </section>
        <section>
          <h3 className="mb-2 font-extrabold">רשימת המוצרים שלכם</h3>
          <Code>{`curl ${API_URL}/api/shop/products -H "X-Api-Key: ${key}"`}</Code>
        </section>
        <section>
          <h3 className="mb-2 font-extrabold">אימות Webhook (Node.js)</h3>
          <Code>{`import crypto from "node:crypto";
// header: X-BWL-Signature: t=<unix>,v1=<hex>
function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto.createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  return fresh && crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}`}</Code>
        </section>
        <section className="text-sm text-ink-soft">
          <h3 className="mb-1 font-extrabold text-ink">שגיאות</h3>
          <p>כל שגיאה מוחזרת כ-JSON: <code dir="ltr">{`{"error":{"code":"...","message":"..."}}`}</code>. 400 נתונים לא תקינים · 401 מפתח חסר/שגוי · 403 חנות לא מאושרת · 429 יותר מדי בקשות.</p>
        </section>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const me = useLoad(() => shopApi.me());
  const [f, setF] = useState<Record<string, string | boolean> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (me.loading) return <Loading />;
  if (me.error || !me.data) return <ErrorBox error={me.error} onRetry={me.reload} />;
  const s = me.data;
  const v = f ?? { name: s.name, address: s.address, city: s.city, phone: s.phone, contactName: s.contactName, logoUrl: s.logoUrl ?? "", pickupInfo: s.pickupInfo ?? "", offersDelivery: s.offersDelivery };
  const field = (k: string, label: string, ltr = false) => (
    <Field label={label}>
      <input className={inputClass} dir={ltr ? "ltr" : undefined} value={String(v[k] ?? "")} onChange={(e) => setF({ ...v, [k]: e.target.value })} />
    </Field>
  );
  async function save() {
    setErr(null);
    setMsg(null);
    try {
      const r = await shopApi.updateMe({ ...v, logoUrl: (v.logoUrl as string) || null, pickupInfo: (v.pickupInfo as string) || null });
      me.setData(r);
      setF(null);
      setMsg("נשמר ✓");
    } catch (e) {
      setErr(errText(e));
    }
  }
  return (
    <Card className="flex max-w-2xl flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold">פרטי החנות</h2>
        <Badge status={s.status} />
      </div>
      <p className="text-sm text-ink-soft">ח.פ: <span dir="ltr">{s.businessId}</span> · מייל: <span dir="ltr">{s.email}</span></p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {field("name", "שם החנות")}
        {field("contactName", "איש/אשת קשר")}
        {field("address", "כתובת")}
        {field("city", "עיר")}
        {field("phone", "טלפון", true)}
        {field("logoUrl", "קישור ללוגו", true)}
        {field("pickupInfo", "שעות איסוף")}
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={!!v.offersDelivery} onChange={(e) => setF({ ...v, offersDelivery: e.target.checked })} /> משלוחים</label>
      </div>
      {err && <p role="alert" className="font-bold text-danger">{err}</p>}
      {msg && <p className="font-bold text-mint">{msg}</p>}
      <Button onClick={save} className="self-start">לשמור</Button>
    </Card>
  );
}

/** Admin: approve new shops and peek at the email outbox. */
export function AdminPage() {
  const [tab, setTab] = useState<"pending" | "all" | "templates" | "outbox">("pending");
  const stats = useLoad(() => adminApi.stats());
  const shops = useLoad(() => (tab === "pending" || tab === "all" ? adminApi.shops(tab === "pending" ? "pending" : undefined) : Promise.resolve([])), [tab]);
  const outbox = useLoad(() => (tab === "outbox" ? adminApi.outbox() : Promise.resolve([])), [tab]);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function decide(id: string, d: "approve" | "reject" | "suspend") {
    setErr(null);
    try {
      await adminApi.decide(id, d);
      shops.reload();
      stats.reload();
    } catch (e) {
      setErr(errText(e));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {stats.data && (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {Object.entries({ kids: "ילדים", lists: "רשימות", shops: "חנויות", pendingShops: "ממתינות", orders: "הזמנות", salesAgorot: "מכירות ₪" }).map(([k, l]) => (
            <Card key={k} className="p-3">
              <p className="text-xs text-ink-soft">{l}</p>
              <p className="text-xl font-extrabold">{k === "salesAgorot" ? Math.round((stats.data![k] ?? 0) / 100) : stats.data![k]}</p>
            </Card>
          ))}
        </div>
      )}
      <div className="flex gap-2" role="tablist">
        {([["pending", "ממתינות לאישור"], ["all", "כל החנויות"], ["templates", "תבניות מייל"], ["outbox", "תיבת דואר יוצא"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`btn-press rounded-full px-4 py-2 font-bold ${tab === k ? "bg-sky-deep text-white" : "bg-white"}`}>{l}</button>
        ))}
      </div>
      {err && <ErrorBox error={new Error(err)} />}
      {tab === "templates" ? (
        <TemplatesEditor />
      ) : tab !== "outbox" ? (
        shops.loading ? <Loading /> : shops.error ? <ErrorBox error={shops.error} onRetry={shops.reload} /> : !shops.data?.length ? (
          <Card><Empty emoji="🎉" title="אין חנויות שממתינות" /></Card>
        ) : (
          shops.data.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-extrabold">{s.name} <Badge status={s.status} /></p>
                <p className="text-sm text-ink-soft">{s.city} · {s.contactName} · <span dir="ltr">{s.email}</span> · {s.products} מוצרים · {new Date(s.createdAt).toLocaleDateString("he-IL")}</p>
              </div>
              <div className="flex gap-2">
                {s.status !== "approved" && <Button onClick={() => decide(s.id, "approve")}>✓ לאשר</Button>}
                {s.status === "pending" && <Button variant="danger" onClick={() => decide(s.id, "reject")}>לדחות</Button>}
                {s.status === "approved" && <Button variant="danger" onClick={() => decide(s.id, "suspend")}>להשעות</Button>}
              </div>
            </Card>
          ))
        )
      ) : outbox.loading ? <Loading /> : !outbox.data?.length ? (
        <Card><Empty emoji="📭" title="עוד לא נשלחו מיילים" /></Card>
      ) : (
        outbox.data.map((m) => (
          <Card key={m.id}>
            <button className="flex w-full flex-wrap items-center justify-between gap-2 text-start" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id}>
              <span className="font-bold">{m.subject}</span>
              <span className="text-sm text-ink-soft" dir="ltr">{m.toHint} · {m.kind} · {m.provider}/{m.status} · {new Date(m.createdAt).toLocaleString("he-IL")}</span>
            </button>
            {open === m.id && <iframe title={m.subject} sandbox="" srcDoc={m.html} className="mt-3 h-96 w-full rounded-2xl border border-sky-soft" />}
          </Card>
        ))
      )}
    </div>
  );
}
