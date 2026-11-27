import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { auth, ApiError } from "../lib/api";
import { CITIES } from "@bwl/shared";
import { Button, Card, Field, inputClass } from "../components/ui";

const errText = (e: unknown) =>
  e instanceof ApiError
    ? e.code === "network"
      ? "אין חיבור לשרת"
      : e.code === "email_taken"
        ? "המייל כבר רשום"
        : e.code === "rate_limited"
          ? "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות"
          : e.status === 401
            ? "מייל או סיסמה שגויים"
            : e.code === "validation_failed"
              ? fieldErrors(e.details)
              : e.message
    : "שגיאה";

/** What to fix, per field, in plain Hebrew (the API returns the field names that failed). */
const FIELD_HELP: Record<string, string> = {
  name: "שם החנות: לפחות 2 תווים",
  businessId: "ח.פ / עוסק מורשה: 9 ספרות (מותר עם מקפים או רווחים), למשל 514839201",
  address: "כתובת: לפחות 5 תווים",
  city: "עיר: בחרו עיר מהרשימה",
  phone: "טלפון: מספר תקין, למשל 04-8123456",
  contactName: "איש/אשת קשר: לפחות 2 תווים",
  email: "מייל: כתובת מייל תקינה",
  password: "סיסמה: לפחות 8 תווים, עם אותיות ומספרים",
  logoUrl: "קישור ללוגו: קישור מלא שמתחיל ב-https:// (או להשאיר ריק)",
  pickupInfo: "שעות איסוף: עד 200 תווים",
  webhookUrl: "Webhook: קישור שמתחיל ב-https://",
  title: "שם המוצר: חובה",
  sku: "SKU: אותיות, ספרות, נקודה, מקף או קו תחתון",
  priceAgorot: "מחיר: מספר חיובי",
};

function fieldErrors(details: unknown): string {
  const fields = [...new Set(((details as Array<{ path: string }> | undefined) ?? []).map((d) => d.path.split(".")[0] ?? ""))].filter(Boolean);
  if (!fields.length) return "חלק מהשדות לא מולאו נכון";
  return "צריך לתקן: " + fields.map((f) => FIELD_HELP[f] ?? f).join(" · ");
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-sky to-bg p-4">
      <Card className="w-full max-w-lg">
        <p className="text-sm font-bold text-sky-deep">🏪 פורטל החנויות · רשימת משאלות</p>
        <h1 className="mb-4 mt-1 text-2xl font-extrabold">{title}</h1>
        {children}
      </Card>
    </div>
  );
}

function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <input className={inputClass} type={show ? "text" : "password"} value={value} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="btn-press min-w-11 rounded-xl bg-sky-soft" onClick={() => setShow(!show)} aria-label={show ? "להסתיר סיסמה" : "להציג סיסמה"}>
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

export function LoginPage({ role = "shop" as "shop" | "admin" }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.login(role, email.trim(), password);
      nav(role === "admin" ? "/admin" : "/");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell title={role === "admin" ? "כניסת מנהל/ת" : "כניסה לחנות"}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="מייל">
          <input className={inputClass} type="email" dir="ltr" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="סיסמה">
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
        {error && <p role="alert" className="font-bold text-danger">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "…" : "כניסה"}</Button>
        {role === "shop" && (
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <Link className="font-bold text-sky-deep" to="/signup">חנות חדשה? להרשמה</Link>
            <Link className="text-ink-soft" to="/forgot">שכחתי סיסמה</Link>
          </div>
        )}
      </form>
    </Shell>
  );
}

export function SignupPage() {
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", businessId: "", address: "", city: "", phone: "", contactName: "", email: "", password: "", logoUrl: "", pickupInfo: "", offersDelivery: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.signup({ ...f, logoUrl: f.logoUrl || undefined, pickupInfo: f.pickupInfo || undefined });
      nav("/");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell title="הרשמת חנות חדשה">
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="שם החנות"><input className={inputClass} value={f.name} onChange={set("name")} required /></Field>
        <Field label="ח.פ / עוסק מורשה" hint="9 ספרות, אפשר עם מקפים (למשל 51-483920-1)"><input className={inputClass} inputMode="numeric" dir="ltr" value={f.businessId} onChange={set("businessId")} required /></Field>
        <Field label="כתובת"><input className={inputClass} value={f.address} onChange={set("address")} required /></Field>
        <Field label="עיר" hint="בחרו מהרשימה — כך ילדים וקונים יראו כמה החנות קרובה אליהם"><input className={inputClass} list="bwl-cities" value={f.city} onChange={set("city")} required /><datalist id="bwl-cities">{CITIES.map((c) => <option key={c.id} value={c.he} />)}</datalist></Field>
        <Field label="טלפון"><input className={inputClass} dir="ltr" type="tel" value={f.phone} onChange={set("phone")} required /></Field>
        <Field label="איש/אשת קשר"><input className={inputClass} value={f.contactName} onChange={set("contactName")} required /></Field>
        <Field label="מייל"><input className={inputClass} dir="ltr" type="email" autoComplete="username" value={f.email} onChange={set("email")} required /></Field>
        <Field label="סיסמה" hint="לפחות 8 תווים, אותיות ומספרים"><PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" /></Field>
        <Field label="קישור ללוגו (לא חובה)"><input className={inputClass} dir="ltr" type="url" value={f.logoUrl} onChange={set("logoUrl")} /></Field>
        <Field label="שעות איסוף (לא חובה)"><input className={inputClass} value={f.pickupInfo} onChange={set("pickupInfo")} placeholder="א׳–ה׳ 10:00–19:00" /></Field>
        <label className="flex items-center gap-2 font-bold sm:col-span-2"><input type="checkbox" checked={f.offersDelivery} onChange={set("offersDelivery")} /> החנות מציעה משלוחים</label>
        {error && <p role="alert" className="font-bold text-danger sm:col-span-2">{error}</p>}
        <Button type="submit" disabled={busy} className="sm:col-span-2">{busy ? "…" : "להרשמה"}</Button>
        <p className="text-sm text-ink-soft sm:col-span-2">אחרי ההרשמה נבדוק ונאשר את החנות. עד אז המוצרים לא יוצגו לילדים. <Link to="/login" className="font-bold text-sky-deep">כבר רשומים?</Link></p>
      </form>
    </Shell>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <Shell title="איפוס סיסמה">
      {sent ? (
        <p className="font-bold text-mint">אם המייל רשום, שלחנו קישור לאיפוס 📬</p>
      ) : (
        <form onSubmit={async (e) => { e.preventDefault(); await auth.forgot(email.trim()).catch(() => {}); setSent(true); }} className="flex flex-col gap-4">
          <Field label="מייל"><input className={inputClass} dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Button type="submit">לשלוח קישור</Button>
        </form>
      )}
      <Link to="/login" className="mt-4 block text-sm font-bold text-sky-deep">חזרה לכניסה</Link>
    </Shell>
  );
}

export function ResetPage() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  return (
    <Shell title="בחירת סיסמה חדשה">
      {state === "done" ? (
        <p className="font-bold text-mint">הסיסמה עודכנה ✔ <Link to="/login" className="text-sky-deep">לכניסה</Link></p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await auth.reset(params.get("token") ?? "", password);
              setState("done");
            } catch (err) {
              setError(errText(err));
            }
          }}
          className="flex flex-col gap-4"
        >
          <Field label="סיסמה חדשה" hint="לפחות 8 תווים, אותיות ומספרים"><PasswordInput value={password} onChange={setPassword} autoComplete="new-password" /></Field>
          {error && <p role="alert" className="font-bold text-danger">{error}</p>}
          <Button type="submit">לשמור</Button>
        </form>
      )}
    </Shell>
  );
}

export { errText };
