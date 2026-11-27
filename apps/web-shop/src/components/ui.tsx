import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function Button({ variant = "sun", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "sun" | "sky" | "soft" | "danger" | "ghost" }) {
  const s = {
    sun: "bg-sun text-ink shadow-md shadow-sun/30",
    sky: "bg-sky-deep text-white shadow-md shadow-sky/30",
    soft: "bg-sky-soft text-sky-deep",
    danger: "bg-danger/10 text-danger",
    ghost: "bg-transparent text-sky-deep hover:underline",
  }[variant];
  return <button {...rest} className={`btn-press inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2 font-bold disabled:opacity-50 ${s} ${className}`} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white p-5 shadow-lg shadow-sky/10 ${className}`}>{children}</div>;
}

export const inputClass = "min-h-11 w-full rounded-xl border-2 border-sky-soft bg-white px-3 py-2 outline-none focus:border-sky";

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-ink-soft">{hint}</span>}
      {error && (
        <span role="alert" className="text-xs font-bold text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export function Loading() {
  return (
    <div role="status" className="flex flex-col gap-3 py-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-sky-soft" />
      ))}
      <span className="sr-only">טוען…</span>
    </div>
  );
}

export function Empty({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className="text-5xl" aria-hidden>
        {emoji}
      </div>
      <p className="text-lg font-bold">{title}</p>
      {body && <p className="text-ink-soft">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? (("code" in error && error.code === "network") ? "אין חיבור לשרת" : error.message) : String(error);
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger/10 p-4 font-bold text-danger">
      <span>⚠️ {msg}</span>
      {onRetry && (
        <Button variant="danger" onClick={onRetry}>
          לנסות שוב
        </Button>
      )}
    </div>
  );
}

/** Tiny data hook with loading / error / reload. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, setData, error, loading, reload: () => setN((x) => x + 1) };
}

export const STATUS_LABEL: Record<string, string> = {
  new: "ממתינה לבדיקת מלאי",
  preparing: "בהכנה",
  ready: "שמורה בצד ללקוח",
  shipped: "נשלחה",
  done: "הושלמה",
  cancelled: "בוטלה",
  pending: "ממתינה לאישור",
  approved: "מאושרת",
  rejected: "נדחתה",
  suspended: "מושעית",
};

export const STATUS_COLOR: Record<string, string> = {
  new: "bg-sun/40",
  preparing: "bg-sky-soft",
  ready: "bg-mint/20",
  shipped: "bg-mint/20",
  done: "bg-black/5",
  cancelled: "bg-danger/10 text-danger",
  pending: "bg-sun/40",
  approved: "bg-mint/20",
  rejected: "bg-danger/10 text-danger",
  suspended: "bg-danger/10 text-danger",
};

export function Badge({ status }: { status: string }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLOR[status] ?? "bg-black/5"}`}>{STATUS_LABEL[status] ?? status}</span>;
}
