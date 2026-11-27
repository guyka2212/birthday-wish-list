import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { Button, Field, inputClass, LangToggle, Message } from "../components/ui";

const SHOP_PORTAL = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/shop/`;

export function Landing() {
  const { t } = useI18n();
  useTheme("unicorn");
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <LangToggle className="absolute end-4 top-4" />
      <div className="animate-float text-7xl" aria-hidden>
        🎁🎈
      </div>
      <h1 className="text-4xl font-extrabold">{t.landingTitle}</h1>
      <p className="text-lg opacity-85">{t.landingBody}</p>
      <a href={SHOP_PORTAL} className="btn-press rounded-2xl bg-t-primary px-6 py-3 font-bold text-t-on-primary shadow-lg">
        🏪 {t.forShops}
      </a>
    </div>
  );
}

export function NotFound() {
  const { t } = useI18n();
  useTheme("unicorn");
  return <Message emoji="🔍" title={t.notFoundTitle} body={t.notFoundBody} />;
}

/** Password reset page for kids (the email link opens here). */
export function ResetPage() {
  const { t } = useI18n();
  useTheme("ocean");
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const type = params.get("type") === "shop" ? "shop" : "kid";
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8 || !/\d/.test(password) || !/[A-Za-z֐-׿]/.test(password)) {
      setError(t.passwordRules);
      return;
    }
    setState("busy");
    setError(null);
    try {
      await api.resetPassword(type, token, password);
      setState("done");
    } catch (err) {
      setError((err as ApiError).message);
      setState("idle");
    }
  }

  if (state === "done") return <Message emoji="✅" title={t.resetDone} />;
  return (
    <form onSubmit={submit} className="mx-auto mt-16 flex max-w-sm flex-col gap-4 rounded-card bg-white p-6 text-ink shadow-xl" noValidate>
      <h1 className="text-2xl font-extrabold">🔑 {t.resetTitle}</h1>
      <Field label={t.newPassword} error={error ?? undefined} hint={t.passwordRules}>
        <div className="flex gap-2">
          <input className={inputClass} type={show ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="btn-press min-w-12 rounded-2xl bg-sky-soft text-xl" onClick={() => setShow(!show)} aria-label={show ? "hide" : "show"}>
            {show ? "🙈" : "👁️"}
          </button>
        </div>
      </Field>
      <Button type="submit" disabled={state === "busy" || !token}>
        {t.save}
      </Button>
    </form>
  );
}
