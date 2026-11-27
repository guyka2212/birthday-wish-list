import { useEffect, useRef, useState } from "react";
import type { EmailTemplate } from "@bwl/shared";
import { adminApi } from "../lib/api";
import { Button, Card, ErrorBox, Field, inputClass, Loading, useLoad } from "../components/ui";
import { errText } from "./Auth";

const TITLES: Record<string, { title: string; hint: string }> = {
  set_aside: { title: "✓ המתנה שמורה בצד", hint: "נשלח כשהחנות מאשרת שיש במלאי ושמה את המתנה בצד" },
  unavailable: { title: "✗ המתנה לא במלאי", hint: "נשלח כשהחנות מסמנת שאין במלאי (ההזמנה בוטלה והתשלום הוחזר)" },
};

const PLACEHOLDER_LABELS: Record<string, string> = {
  orderNumber: "מספר הזמנה",
  buyerName: "שם הקונה",
  kidName: "שם הילד/ה",
  shopName: "שם החנות",
  shopAddress: "כתובת החנות",
  shopPhone: "טלפון החנות",
  pickupInfo: "שעות איסוף",
  items: "רשימת הפריטים",
  total: "סה״כ",
  date: "תאריך ההזמנה",
  receiptLink: "קישור לפרטי ההזמנה",
  listLink: "קישור לרשימה",
};

/** Admin: edit the emails shops send buyers, with placeholders and a live preview. */
export function TemplatesEditor() {
  const { data, error, loading, reload } = useLoad(() => adminApi.templates());
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <div className="flex flex-col gap-5">
      <Card className="text-sm text-ink-soft">
        החנויות שולחות את המיילים האלה לקונים בלחיצת כפתור. אפשר לשלב פרטים מההזמנה עם המשתנים — לחצו על משתנה כדי להוסיף אותו במקום הסמן.
        הטקסט נשלח כמו שהוא (שורות נשמרות, קישורים הופכים ללחיצים).
      </Card>
      {data.items.map((t) => (
        <TemplateCard key={t.key} template={t} placeholders={data.placeholders} />
      ))}
    </div>
  );
}

function TemplateCard({ template, placeholders }: { template: EmailTemplate; placeholders: string[] }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [html, setHtml] = useState<string | null>(null);
  const [saved, setSaved] = useState<number>(template.updatedAt);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocus = useRef<"subject" | "body">("body");
  const dirty = subject !== template.subject || body !== template.body;

  // live preview (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      if (!subject.trim() || !body.trim()) return;
      adminApi.previewTemplate({ subject, body }).then((r) => setHtml(r.html)).catch(() => {});
    }, 400);
    return () => clearTimeout(id);
  }, [subject, body]);

  function insert(name: string) {
    const token = `{{${name}}}`;
    if (lastFocus.current === "subject") return setSubject((s) => s + token);
    const el = bodyRef.current;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await adminApi.saveTemplate(template.key, { subject, body });
      template.subject = r.subject;
      template.body = r.body;
      setSaved(r.updatedAt);
      setMsg("נשמר ✓ — המייל הבא שחנות תשלח ישתמש בנוסח הזה");
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const info = TITLES[template.key] ?? { title: template.key, hint: "" };
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold">{info.title}</h2>
          <p className="text-sm text-ink-soft">{info.hint}</p>
        </div>
        <span className="text-xs text-ink-soft">{saved ? `עודכן ${new Date(saved).toLocaleString("he-IL")}` : "נוסח ברירת מחדל"}</span>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="משתנים">
        {placeholders.map((p) => (
          <button key={p} type="button" onClick={() => insert(p)} className="btn-press rounded-full bg-sky-soft px-3 py-1 text-xs font-bold text-sky-deep">
            + {PLACEHOLDER_LABELS[p] ?? p} <span dir="ltr" className="opacity-60">{`{{${p}}}`}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Field label="נושא">
            <input className={inputClass} value={subject} maxLength={200} onFocus={() => (lastFocus.current = "subject")} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="תוכן המייל">
            <textarea ref={bodyRef} className={`${inputClass} min-h-80 leading-relaxed`} value={body} maxLength={5000} onFocus={() => (lastFocus.current = "body")} onChange={(e) => setBody(e.target.value)} />
          </Field>
          {err && <p role="alert" className="font-bold text-danger">{err}</p>}
          {msg && <p className="font-bold text-mint">{msg}</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy || !dirty}>{busy ? "…" : "לשמור"}</Button>
            {dirty && <Button variant="soft" onClick={() => { setSubject(template.subject); setBody(template.body); }}>לבטל שינויים</Button>}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">תצוגה מקדימה (עם פרטי הזמנה לדוגמה)</p>
          {html ? <iframe title={`preview-${template.key}`} sandbox="" srcDoc={html} className="h-[28rem] w-full rounded-2xl border border-sky-soft bg-white" /> : <Loading />}
        </div>
      </div>
    </Card>
  );
}
