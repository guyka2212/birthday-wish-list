import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useI18n } from "../lib/i18n";

export function Button({ variant = "accent", className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "accent" | "primary" | "soft" | "ghost" }) {
  const styles = {
    accent: "bg-t-accent text-t-on-accent shadow-lg shadow-black/10",
    primary: "bg-t-primary text-t-on-primary shadow-lg shadow-black/10",
    soft: "bg-white/80 text-ink border border-black/10",
    ghost: "bg-transparent text-current underline-offset-4 hover:underline",
  }[variant];
  return (
    <button
      {...rest}
      className={`btn-press inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="size-12 animate-spin rounded-full border-4 border-t-primary border-t-transparent" />
      <span className="text-sm opacity-80">{label ?? t.loading}</span>
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-72 animate-pulse rounded-card bg-white/50" />
      ))}
    </div>
  );
}

export function Message({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="animate-pop mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="animate-float text-6xl" aria-hidden>
        {emoji}
      </div>
      <h2 className="text-2xl font-extrabold">{title}</h2>
      {body && <p className="text-lg opacity-80">{body}</p>}
      {action}
    </div>
  );
}

export function LangToggle({ className = "" }: { className?: string }) {
  const { t, lang, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === "he" ? "en" : "he")}
      className={`btn-press rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-ink shadow ${className}`}
      aria-label={lang === "he" ? "Switch to English" : "החלפה לעברית"}
    >
      🌐 {t.language}
    </button>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-bold">{label}</span>
      {children}
      {hint && !error && <span className="text-sm opacity-70">{hint}</span>}
      {error && (
        <span role="alert" className="text-sm font-bold text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-2xl border-2 border-black/10 bg-white px-4 py-3 text-base text-ink outline-none focus:border-t-primary";
