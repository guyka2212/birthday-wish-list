import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CATEGORY_LABELS, formatILS, type PublicList, type PublicListItem } from "@bwl/shared";
import { api, ApiError, guestSession } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { Button, Field, inputClass, LangToggle, Message, SkeletonGrid } from "../components/ui";

type Load = { kind: "loading" } | { kind: "error"; error: ApiError } | { kind: "ready"; list: PublicList };

export default function ShopPage() {
  const { slug = "" } = useParams();
  const { t, lang } = useI18n();
  const session = useMemo(() => guestSession(), []);
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [cartOpen, setCartOpen] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const theme = useTheme(state.kind === "ready" ? state.list.themeId : "unicorn");

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setState({ kind: "loading" });
      try {
        setState({ kind: "ready", list: await api.list(slug, session) });
      } catch (e) {
        if (!silent || (e instanceof ApiError && e.status === 404)) setState({ kind: "error", error: e as ApiError });
      }
    },
    [slug, session],
  );

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 20_000); // see other guests' holds and purchases
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const cart = state.kind === "ready" ? state.list.items.filter((i) => i.state === "held_by_you") : [];

  async function buy(item: PublicListItem) {
    setBusyItem(item.id);
    try {
      await api.reserve(slug, item.id, session);
      await load(true);
      setCartOpen(true);
    } catch (e) {
      const err = e as ApiError;
      setToast(err.code === "already_held" ? t.conflictTaken : err.code === "network" ? t.network : err.message);
      await load(true);
    } finally {
      setBusyItem(null);
    }
  }

  async function remove(item: PublicListItem) {
    if (!item.reservationId) return;
    await api.release(item.reservationId, session).catch(() => {});
    await load(true);
  }

  if (state.kind === "loading") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 h-40 animate-pulse rounded-card bg-white/40" />
        <SkeletonGrid />
      </div>
    );
  }
  if (state.kind === "error") {
    const nf = state.error.status === 404 || state.error.status === 400;
    return (
      <Message
        emoji={nf ? "🔍" : "🙈"}
        title={nf ? t.notFoundTitle : t.errorTitle}
        body={nf ? t.notFoundBody : state.error.code === "network" ? t.network : state.error.message}
        action={!nf && <Button onClick={() => load()}>{t.retry}</Button>}
      />
    );
  }

  const list = state.list;
  return (
    <div className="min-h-dvh pb-32">
      {/* themed header */}
      <header className="relative overflow-hidden bg-t-primary text-t-on-primary">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {theme.confetti.map((e, i) => (
            <span
              key={i}
              className="animate-float absolute text-3xl opacity-70 sm:text-5xl"
              style={{ insetInlineStart: `${(i * 17 + 5) % 95}%`, top: `${(i * 29 + 10) % 80}%`, animationDelay: `${i * 0.6}s` }}
            >
              {e}
            </span>
          ))}
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col gap-3 px-4 pb-10 pt-6">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold">🎁 Birthday Wish List</span>
            <LangToggle />
          </div>
          <div className="mt-4 text-6xl" aria-hidden>
            {theme.emoji}
          </div>
          <h1 className="text-3xl font-extrabold sm:text-5xl">{t.wishlistOf(list.kidFirstName)}</h1>
          <p className="text-xl font-bold opacity-95">{list.listName}</p>
          {list.description && <p className="max-w-2xl text-lg opacity-90">{list.description}</p>}
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-t-accent px-4 py-1.5 font-bold text-t-on-accent">{lang === "he" ? theme.taglineHe : theme.taglineEn}</span>
            {list.daysToBirthday != null && <span className="rounded-full bg-white/20 px-4 py-1.5 font-bold">🎂 {t.daysLeft(list.daysToBirthday)}</span>}
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-6xl px-4">
        {list.items.length === 0 ? (
          <div className="rounded-card bg-t-card p-6">
            <Message emoji="🎈" title={t.emptyList} />
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {list.items.map((item, i) => (
              <ProductCard key={item.id} item={item} index={i} busy={busyItem === item.id} onBuy={() => buy(item)} onOpenCart={() => setCartOpen(true)} />
            ))}
          </ul>
        )}
        <p className="mt-10 text-center text-sm opacity-70">🔒 {t.privacy}</p>
        <p className="mt-2 text-center text-xs opacity-50">
          Illustrations: <a className="underline" href="https://openmoji.org" target="_blank" rel="noreferrer">OpenMoji</a> (CC BY-SA 4.0)
        </p>
      </main>

      {cart.length > 0 && !cartOpen && (
        <div className="no-print fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <Button className="animate-pop w-full max-w-md text-lg" onClick={() => setCartOpen(true)}>
            🛒 {t.cart} ({cart.length}) · {formatILS(cart.reduce((s, i) => s + i.product.priceAgorot, 0), lang)}
          </Button>
        </div>
      )}

      {cartOpen && <CartDrawer list={list} cart={cart} slug={slug} session={session} onClose={() => setCartOpen(false)} onRemove={remove} onChanged={() => load(true)} />}

      {toast && (
        <div role="alert" className="animate-pop fixed inset-x-0 top-4 z-50 mx-auto w-fit max-w-[90vw] rounded-2xl bg-ink px-5 py-3 font-bold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function ProductCard({ item, index, busy, onBuy, onOpenCart }: { item: PublicListItem; index: number; busy: boolean; onBuy: () => void; onOpenCart: () => void }) {
  const { t, lang } = useI18n();
  const p = item.product;
  const unavailable = item.state === "purchased" || item.state === "held" || !p.inStock;
  const cat = CATEGORY_LABELS[p.category];
  return (
    <li
      className={`animate-pop flex flex-col overflow-hidden rounded-card bg-t-card shadow-xl shadow-black/10 ${item.state === "purchased" ? "opacity-75" : ""}`}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="relative flex aspect-square items-center justify-center bg-gradient-to-br from-white to-sky-soft p-6">
        {p.imageUrl ? (
          <img src={p.imageUrl} alt="" loading="lazy" className={`size-full object-contain ${!p.inStock && item.state !== "purchased" ? "grayscale" : ""}`} />
        ) : (
          <span className="text-6xl">{cat.emoji}</span>
        )}
        <span className="absolute start-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ink">
          {cat.emoji} {lang === "he" ? cat.he : cat.en}
        </span>
        {item.state === "purchased" && (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-mint px-3 py-1.5 text-center font-extrabold text-white">{t.gifted}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-lg font-bold leading-snug">{p.title}</h3>
        <p className="text-sm opacity-75">{t.shopBy(p.shop.name, p.shop.city)}</p>
        <p className="mt-auto pt-2 text-2xl font-extrabold">{formatILS(p.priceAgorot, lang)}</p>
        {item.state === "held_by_you" ? (
          <Button variant="primary" onClick={onOpenCart}>
            {t.inCart}
          </Button>
        ) : (
          <Button disabled={unavailable || busy} onClick={onBuy} aria-label={`${t.buy} – ${p.title}`}>
            {busy ? "…" : item.state === "purchased" ? t.gifted : item.state === "held" ? `⏳ ${t.held}` : !p.inStock ? t.outOfStock : t.buy}
          </Button>
        )}
      </div>
    </li>
  );
}

function useCountdown(until: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!until) return null;
  const left = Math.max(0, until - now);
  return { left, label: `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}` };
}

function CartDrawer({
  list,
  cart,
  slug,
  session,
  onClose,
  onRemove,
  onChanged,
}: {
  list: PublicList;
  cart: PublicListItem[];
  slug: string;
  session: string;
  onClose: () => void;
  onRemove: (i: PublicListItem) => void;
  onChanged: () => void;
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const soonest = cart.length ? Math.min(...cart.map((c) => c.heldUntil ?? Infinity)) : null;
  const countdown = useCountdown(soonest && Number.isFinite(soonest) ? soonest : null);
  const total = cart.reduce((s, i) => s + i.product.priceAgorot, 0);
  const [form, setForm] = useState({ buyerName: "", buyerEmail: "", greeting: "", deliveryMethod: "pickup" as "pickup" | "delivery", deliveryAddress: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (countdown && countdown.left === 0) onChanged();
  }, [countdown, onChanged]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.buyerName.trim().length < 2) errs.buyerName = t.required;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.buyerEmail.trim())) errs.buyerEmail = t.invalidEmail;
    if (form.deliveryMethod === "delivery" && form.deliveryAddress.trim().length < 5) errs.deliveryAddress = t.required;
    setErrors(errs);
    if (Object.keys(errs).length || !cart.length) return;
    setPaying(true);
    setServerError(null);
    try {
      const r = await api.checkout({
        slug,
        guestSession: session,
        reservationIds: cart.map((c) => c.reservationId!),
        buyerName: form.buyerName.trim(),
        buyerEmail: form.buyerEmail.trim(),
        greeting: form.greeting.trim() || undefined,
        deliveryMethod: form.deliveryMethod,
        deliveryAddress: form.deliveryMethod === "delivery" ? form.deliveryAddress.trim() : undefined,
      });
      navigate(r.billPath, { state: { justPaid: true } });
    } catch (e) {
      const err = e as ApiError;
      setServerError(err.code === "network" ? t.network : err.code === "reservation_invalid" ? t.holdExpired : err.message);
      onChanged();
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="no-print fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t.cart}
        className="animate-pop flex h-full w-full max-w-md flex-col overflow-y-auto bg-white text-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 px-5 py-4 backdrop-blur">
          <h2 className="text-2xl font-extrabold">🛒 {t.cart}</h2>
          <button onClick={onClose} className="btn-press size-11 rounded-full bg-sky-soft text-xl" aria-label={t.close}>
            ✕
          </button>
        </div>
        {cart.length === 0 ? (
          <Message emoji="🧺" title={t.cartEmpty} />
        ) : (
          <div className="flex flex-col gap-4 px-5 pb-8">
            {countdown && (
              <p className="rounded-2xl bg-sun/30 px-4 py-3 font-bold" aria-live="polite">
                ⏳ {t.holdNote(countdown.label)}
              </p>
            )}
            <ul className="flex flex-col gap-3">
              {cart.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-sky-soft/60 p-3">
                  {c.product.imageUrl && <img src={c.product.imageUrl} alt="" className="size-14 rounded-xl bg-white object-contain p-1" />}
                  <div className="flex-1">
                    <p className="font-bold">{c.product.title}</p>
                    <p className="text-sm text-ink-soft">{c.product.shop.name}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-extrabold">{formatILS(c.product.priceAgorot, lang)}</p>
                    <button onClick={() => onRemove(c)} className="text-sm font-bold text-danger underline">
                      {t.remove}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="flex justify-between text-xl font-extrabold">
              <span>{t.total}</span>
              <span>{formatILS(total, lang)}</span>
            </p>

            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <Field label={t.buyerName} error={errors.buyerName}>
                <input className={inputClass} autoComplete="name" value={form.buyerName} maxLength={60} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} />
              </Field>
              <Field label={t.buyerEmail} error={errors.buyerEmail}>
                <input className={inputClass} type="email" autoComplete="email" dir="ltr" value={form.buyerEmail} maxLength={254} onChange={(e) => setForm({ ...form, buyerEmail: e.target.value })} />
              </Field>
              <Field label={t.greeting}>
                <textarea className={`${inputClass} min-h-24`} placeholder={t.greetingPh} value={form.greeting} maxLength={500} onChange={(e) => setForm({ ...form, greeting: e.target.value })} />
              </Field>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 font-bold">{t.delivery}</legend>
                {(["pickup", "delivery"] as const).map((m) => (
                  <label key={m} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 ${form.deliveryMethod === m ? "border-t-primary bg-sky-soft" : "border-black/10"}`}>
                    <input type="radio" name="delivery" checked={form.deliveryMethod === m} onChange={() => setForm({ ...form, deliveryMethod: m })} />
                    {m === "pickup" ? `🏪 ${t.pickup}` : `🚚 ${t.shipping}`}
                  </label>
                ))}
              </fieldset>
              {form.deliveryMethod === "delivery" && (
                <Field label={t.address} error={errors.deliveryAddress}>
                  <input className={inputClass} autoComplete="street-address" value={form.deliveryAddress} maxLength={200} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} />
                </Field>
              )}
              <p className="rounded-2xl bg-mint/15 px-4 py-3 text-sm font-bold">💳 {t.mockPayment}</p>
              {serverError && (
                <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 font-bold text-danger">
                  {serverError}
                </p>
              )}
              <Button type="submit" disabled={paying} className="text-lg">
                {paying ? t.paying : t.pay(formatILS(total, lang))}
              </Button>
            </form>
            <p className="text-center text-xs text-ink-soft">{t.wishlistOf(list.kidFirstName)}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
