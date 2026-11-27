import { formatILS, TEMPLATE_PLACEHOLDERS, type EmailTemplate, type TemplateKey } from "@bwl/shared";
import type { Executor } from "../db";
import { all, one } from "../db";
import { esc, layout } from "../email/templates";

export type TemplateVars = Record<(typeof TEMPLATE_PLACEHOLDERS)[number], string>;

export async function getTemplate(db: Executor, key: TemplateKey): Promise<EmailTemplate> {
  const r = await one<{ key: TemplateKey; subject: string; body: string; updated_at: number }>(
    db,
    "SELECT key, subject, body, updated_at FROM email_templates WHERE key = ?",
    [key],
  );
  if (!r) throw new Error(`missing email template ${key}`);
  return { key: r.key, subject: r.subject, body: r.body, updatedAt: Number(r.updated_at) };
}

export async function listTemplates(db: Executor): Promise<EmailTemplate[]> {
  const rows = await all<{ key: TemplateKey; subject: string; body: string; updated_at: number }>(db, "SELECT * FROM email_templates ORDER BY key ASC");
  return rows.map((r) => ({ key: r.key, subject: r.subject, body: r.body, updatedAt: Number(r.updated_at) }));
}

const fill = (text: string, vars: Partial<TemplateVars>, transform: (v: string) => string) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name: string) => (name in vars ? transform(vars[name as keyof TemplateVars] ?? "") : m));

/**
 * Renders an admin template. The admin writes plain text (not HTML): every value and every line is escaped,
 * line breaks are kept, and https links become clickable — so a template can't inject markup or scripts.
 */
export function renderTemplate(t: { subject: string; body: string }, vars: Partial<TemplateVars>) {
  const subject = fill(t.subject, vars, (v) => v).replace(/[\r\n]+/g, " ").slice(0, 250);
  const text = fill(t.body, vars, (v) => v);
  const html = esc(text)
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1C7FD1">$1</a>')
    .replace(/\n/g, "<br>");
  return { subject, text, html: layout(subject, `<div style="font-size:16px;line-height:1.7">${html}</div>`) };
}

export const SAMPLE_VARS: TemplateVars = {
  orderNumber: "BWL-261127-AB12C-1",
  buyerName: "סבתא רותי",
  kidName: "נועה",
  shopName: "צעצועי הכרמל",
  shopAddress: "רחוב הנביאים 12, חיפה",
  shopPhone: "04-8123456",
  pickupInfo: "א׳–ה׳ 10:00–19:00",
  items: "• ערכת ציור בצבעי מים — " + formatILS(8900),
  total: formatILS(8900),
  date: "27.11.2026",
  receiptLink: "https://example.com/bill/…",
  listLink: "https://example.com/l/…",
};
