import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { formatILS, type ReceiptView } from "@bwl/shared";
import { api, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { Button, LangToggle, Message, Spinner } from "../components/ui";

/** Itemized, printable bill with VAT 17% and a PDF download. */
export default function BillPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const location = useLocation();
  const justPaid = (location.state as { justPaid?: boolean } | null)?.justPaid;
  const { t, lang } = useI18n();
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const billRef = useRef<HTMLDivElement>(null);
  useTheme("unicorn");

  const load = useCallback(async () => {
    setError(null);
    try {
      setReceipt(await api.receipt(id, token));
    } catch (e) {
      setError(e as ApiError);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function downloadPdf() {
    if (!billRef.current || !receipt) return;
    setPdfBusy(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf()
        .set({
          margin: 10,
          filename: `receipt-${receipt.number}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(billRef.current)
        .save();
    } finally {
      setPdfBusy(false);
    }
  }

  if (error) {
    return <Message emoji="🧾" title={error.status === 401 ? t.invalidReceipt : t.errorTitle} body={error.code === "network" ? t.network : undefined} action={error.status !== 401 && <Button onClick={load}>{t.retry}</Button>} />;
  }
  if (!receipt) return <Spinner />;

  const fmt = (a: number) => formatILS(a, lang);
  const date = new Date(receipt.createdAt).toLocaleString(lang === "he" ? "he-IL" : "en-IL", { timeZone: "Asia/Jerusalem", dateStyle: "long", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        {justPaid ? (
          <div className="animate-pop">
            <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{receipt.orders.some((o) => o.status === "new") ? t.thanksPending : t.thanks}</h1>
            {receipt.orders.some((o) => o.status === "new") && <p className="mt-1 max-w-xl text-ink-soft">{t.thanksPendingBody}</p>}
          </div>
        ) : (
          <span />
        )}
        <LangToggle />
      </div>

      <div ref={billRef} className="print-card rounded-card bg-white p-6 text-ink shadow-2xl shadow-black/10 sm:p-10" dir={lang === "he" ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-dashed border-sky-soft pb-6">
          <div>
            <p className="text-sm font-bold text-ink-soft">🎁 Birthday Wish List</p>
            <h2 className="text-3xl font-extrabold">{t.receipt}</h2>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-soft">{t.orderNo}</dt>
            <dd className="font-bold" dir="ltr">{receipt.number}</dd>
            <dt className="text-ink-soft">{t.date}</dt>
            <dd className="font-bold">{date}</dd>
            <dt className="text-ink-soft">{t.buyer}</dt>
            <dd className="font-bold">{receipt.buyerName}</dd>
            <dt className="text-ink-soft">{t.forList}</dt>
            <dd className="font-bold">
              {receipt.kidFirstName} · {receipt.listName}
            </dd>
          </dl>
        </div>

        {receipt.orders.map((o) => (
          <section key={o.number} className="border-b border-sky-soft py-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-extrabold">🏪 {o.shop.name}</h3>
              <span className="rounded-full bg-sky-soft px-3 py-1 text-xs font-bold" dir="ltr">
                {o.number} · {t.orderStatus[o.status]}
              </span>
            </div>
            <table className="w-full text-start">
              <thead>
                <tr className="text-sm text-ink-soft">
                  <th className="pb-2 text-start font-medium">{t.item}</th>
                  <th className="pb-2 text-end font-medium">{t.price}</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((i, idx) => (
                  <tr key={idx} className="border-t border-sky-soft/70">
                    <td className="py-2">
                      {i.title}
                      {i.quantity > 1 ? ` ×${i.quantity}` : ""}
                    </td>
                    <td className="py-2 text-end font-bold">{fmt(i.priceAgorot * i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-sm text-ink-soft">
              {receipt.deliveryMethod === "pickup" ? (
                <>
                  📍 {t.pickupAt}
                  {o.shop.name}: {o.shop.address}, {o.shop.city} · ☎ <span dir="ltr">{o.shop.phone}</span>
                  {o.shop.pickupInfo ? ` · 🕒 ${o.shop.pickupInfo}` : ""}
                </>
              ) : (
                <>
                  🚚 {t.deliveryTo}: {receipt.deliveryAddress}
                </>
              )}
            </p>
          </section>
        ))}

        <dl className="ms-auto mt-6 grid max-w-xs grid-cols-[1fr_auto] gap-y-2">
          <dt className="text-ink-soft">{t.subtotal}</dt>
          <dd className="text-end">{fmt(receipt.subtotalAgorot)}</dd>
          <dt className="text-ink-soft">{t.vat(receipt.vatRateBp / 100)}</dt>
          <dd className="text-end">{fmt(receipt.vatAgorot)}</dd>
          <dt className="border-t-2 border-ink pt-2 text-xl font-extrabold">{t.totalPaid}</dt>
          <dd className="border-t-2 border-ink pt-2 text-end text-xl font-extrabold">{fmt(receipt.totalAgorot)}</dd>
          <dt className="text-xs text-ink-soft">{t.payment}</dt>
          <dd className="text-end text-xs text-ink-soft" dir="ltr">
            {receipt.payment.provider} · {receipt.payment.reference}
          </dd>
        </dl>

        {receipt.greeting && (
          <div className="mt-8 rounded-2xl bg-gradient-to-br from-[#fff3c4] to-[#ffd6ec] p-5">
            <p className="mb-1 font-extrabold">💌 {t.greetingCard}</p>
            <p className="whitespace-pre-wrap text-lg">{receipt.greeting}</p>
          </div>
        )}
      </div>

      <div className="no-print mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => window.print()}>🖨️ {t.print}</Button>
        <Button variant="primary" onClick={downloadPdf} disabled={pdfBusy}>
          📄 {pdfBusy ? t.loading : t.downloadPdf}
        </Button>
      </div>
      <p className="no-print mt-4 text-center text-sm opacity-75">📧 {t.emailSent(receipt.buyerEmailMasked)}</p>
    </div>
  );
}
