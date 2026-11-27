import { getTheme, type ListDetail, type ListSummary, type QuizAnswers, type Theme, type ThemeId } from "@bwl/shared";
import type { Executor } from "../db";
import { all, one } from "../db";
import { notFound } from "../lib/errors";
import { PRODUCT_COLS, PRODUCT_JOIN, toCatalogProduct, type ProductRow } from "./catalog";

interface ListRow {
  id: string;
  name: string;
  description: string;
  birthday: string | null;
  theme_id: ThemeId | "custom";
  quiz_answers: string | null;
  custom_theme: string | null;
  created_at: number;
  updated_at: number;
  item_count: number;
  purchased_count: number;
  slug: string | null;
  share_enabled: number | null;
}

const LIST_SELECT = `
  SELECT l.id, l.name, l.description, l.birthday, l.theme_id, l.quiz_answers, l.custom_theme, l.created_at, l.updated_at,
    (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS item_count,
    (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id AND li.status = 'purchased') AS purchased_count,
    sl.slug, sl.enabled AS share_enabled
  FROM lists l
  LEFT JOIN share_links sl ON sl.list_id = l.id AND sl.revoked_at IS NULL`;

export function shareUrl(guestBase: string, slug: string) {
  return `${guestBase.replace(/\/$/, "")}/l/${slug}`;
}

/** Preset theme, or the quiz-generated one stored on the list. */
export function resolveTheme(themeId: string, customTheme: string | null): Theme {
  if (themeId === "custom" && customTheme) {
    try {
      return JSON.parse(customTheme) as Theme;
    } catch {
      /* fall through */
    }
  }
  return getTheme(themeId);
}

function toSummary(r: ListRow, guestBase: string): ListSummary {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    birthday: r.birthday,
    themeId: r.theme_id,
    theme: resolveTheme(r.theme_id, r.custom_theme),
    quiz: r.quiz_answers ? (JSON.parse(r.quiz_answers) as QuizAnswers) : null,
    itemCount: Number(r.item_count),
    purchasedCount: Number(r.purchased_count),
    share: r.slug ? { slug: r.slug, enabled: !!Number(r.share_enabled), url: shareUrl(guestBase, r.slug) } : null,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

export async function listsForUser(db: Executor, userId: string, guestBase: string) {
  const rows = await all<ListRow>(db, `${LIST_SELECT} WHERE l.user_id = ? AND l.deleted_at IS NULL ORDER BY l.updated_at DESC`, [userId]);
  return rows.map((r) => toSummary(r, guestBase));
}

export async function ownedList(db: Executor, userId: string, listId: string, guestBase: string) {
  const r = await one<ListRow>(db, `${LIST_SELECT} WHERE l.id = ? AND l.user_id = ? AND l.deleted_at IS NULL`, [listId, userId]);
  if (!r) throw notFound("list");
  return toSummary(r, guestBase);
}

export async function listDetail(db: Executor, userId: string, listId: string, guestBase: string): Promise<ListDetail> {
  const summary = await ownedList(db, userId, listId, guestBase);
  const items = await all<ProductRow & { li_id: string; li_status: "available" | "purchased" }>(
    db,
    `SELECT li.id AS li_id, li.status AS li_status, ${PRODUCT_COLS} ${PRODUCT_JOIN.replace("FROM products p", "FROM list_items li JOIN products p ON p.id = li.product_id")}
     WHERE li.list_id = ? ORDER BY li.created_at`,
    [listId],
  );
  return {
    ...summary,
    items: items.map((r) => ({ id: r.li_id, status: r.li_status, product: toCatalogProduct(r) })),
  };
}

/** Days until the next occurrence of a YYYY-MM-DD date (0 = today), in Israel time. */
export function daysUntil(date: string | null, now: number): number | null {
  if (!date) return null;
  const [, m, d] = date.split("-").map(Number);
  if (!m || !d) return null;
  const todayStr = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const [ty, tm, td] = todayStr.split("-").map(Number) as [number, number, number];
  const today = Date.UTC(ty, tm - 1, td);
  let next = Date.UTC(ty, m - 1, d);
  if (next < today) next = Date.UTC(ty + 1, m - 1, d);
  return Math.round((next - today) / 86_400_000);
}
