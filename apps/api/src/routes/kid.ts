import { Hono } from "hono";
import { z } from "zod";
import {
  catalogQuerySchema,
  listCreateSchema,
  listItemAddSchema,
  listUpdateSchema,
  photoUploadSchema,
  profileUpdateSchema,
  QUIZ,
  quizAnswersSchema,
  generateTheme,
  type QuizAnswers,
  type ActivityItem,
  type HomeSummary,
  type KidProfile,
} from "@bwl/shared";
import type { AppEnv, Deps } from "../context";
import { all, one, run, tx } from "../db";
import { audit } from "../lib/audit";
import { requireAuth, revokeAll } from "../lib/auth";
import { newId, randomBase62, randomToken, sha256Hex } from "../lib/crypto";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/passwords";
import { enforce } from "../lib/rateLimit";
import { body, query } from "../lib/validate";
import { searchCatalog, shopsForFilter, trending } from "../services/catalog";
import { nearbyShops } from "../services/nearby";
import { daysUntil, listDetail, listsForUser, ownedList } from "../services/lists";
import { consentEmail } from "../email/templates";

export const kid = new Hono<AppEnv>();
kid.use("*", requireAuth("kid"));

interface UserRow {
  id: string;
  username: string;
  first_name: string;
  email_enc: string;
  avatar: string;
  birthday: string | null;
  locale: "he" | "en";
  consent_status: "pending" | "verified";
  password_hash: string;
  has_photo: number;
  city_enc: string | null;
}

async function loadUser(deps: Deps, id: string): Promise<UserRow> {
  const u = await one<UserRow>(
    deps.db,
    "SELECT id, username, first_name, email_enc, avatar, birthday, locale, consent_status, password_hash, (photo_enc IS NOT NULL) AS has_photo, city_enc FROM users WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
  if (!u) throw unauthorized("account not found");
  return u;
}

async function toProfile(deps: Deps, u: UserRow): Promise<KidProfile> {
  return {
    id: u.id,
    username: u.username,
    firstName: u.first_name,
    email: await deps.box.decrypt(u.email_enc),
    avatar: u.avatar,
    birthday: u.birthday,
    locale: u.locale,
    consentStatus: u.consent_status,
    hasPhoto: !!Number(u.has_photo),
    city: await deps.box.decryptNullable(u.city_enc),
  };
}

/** The shops a kid may shop from: the ones nearest to their city (all shops if no city yet). */
async function kidShops(deps: Deps, userId: string) {
  const row = await one<{ city_enc: string | null }>(deps.db, "SELECT city_enc FROM users WHERE id = ?", [userId]);
  const city = await deps.box.decryptNullable(row?.city_enc);
  const shops = await nearbyShops(deps.db, city);
  return { city, shops, ids: shops.map((s) => s.id), dist: new Map(shops.map((s) => [s.id, s.distanceKm])) };
}

function withDistance<T extends { shop: { id: string } }>(items: T[], dist: Map<string, number | null>) {
  return items.map((p) => ({ ...p, shop: { ...p.shop, distanceKm: dist.get(p.shop.id) ?? null } }));
}

/** Columns to write when a list gets quiz answers (custom theme) or a preset theme. */
function themeColumns(quiz: QuizAnswers | undefined, themeId: string | undefined, firstName: string) {
  if (quiz) return { theme_id: "custom", quiz_answers: JSON.stringify(quiz), custom_theme: JSON.stringify(generateTheme(quiz, firstName)) };
  if (themeId) return { theme_id: themeId, quiz_answers: null, custom_theme: null };
  return null;
}

async function activity(deps: Deps, userId: string, limit = 20): Promise<ActivityItem[]> {
  const rows = await all<{ id: string; kind: string; title: string; body: string; created_at: number; read_at: number | null }>(
    deps.db,
    "SELECT id, kind, title, body, created_at, read_at FROM notifications WHERE recipient_type = 'kid' AND recipient_id = ? ORDER BY created_at DESC LIMIT ?",
    [userId, limit],
  );
  return rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, createdAt: Number(r.created_at), read: !!r.read_at }));
}

// ---------- profile ----------
kid.get("/me", async (c) => c.json(await toProfile(c.var.deps, await loadUser(c.var.deps, c.var.subjectId))));

kid.patch("/me", async (c) => {
  const deps = c.var.deps;
  const { db, box, now } = deps;
  const input = await body(c, profileUpdateSchema);
  const u = await loadUser(deps, c.var.subjectId);
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const set = (col: string, v: string | number | null) => {
    sets.push(`${col} = ?`);
    args.push(v);
  };
  if (input.username !== undefined) set("username", input.username);
  if (input.firstName !== undefined) set("first_name", input.firstName);
  if (input.avatar !== undefined) set("avatar", input.avatar);
  if (input.birthday !== undefined) set("birthday", input.birthday);
  if (input.locale !== undefined) set("locale", input.locale);
  if (input.city !== undefined) set("city_enc", await box.encrypt(input.city));
  if (input.email !== undefined) {
    const h = await box.blindIndex(input.email);
    const taken = await one(db, "SELECT 1 FROM users WHERE email_hash = ? AND id != ?", [h, u.id]);
    if (taken) throw conflict("email_taken", "this email is already registered");
    set("email_enc", await box.encrypt(input.email));
    set("email_hash", h);
  }
  if (input.newPassword) {
    await enforce(c, "pw-change", 5, 15 * 60_000);
    if (!(await verifyPassword(u.password_hash, input.currentPassword ?? ""))) throw unauthorized("current password is wrong");
    set("password_hash", await hashPassword(input.newPassword));
  }
  if (sets.length) {
    set("updated_at", now());
    await run(db, `UPDATE users SET ${sets.join(", ")} WHERE id = ?`, [...args, u.id]);
    await audit(db, { actorType: "kid", actorId: u.id, action: "profile.update", meta: { fields: Object.keys(input).filter((k) => !k.toLowerCase().includes("password")) } }, now());
  }
  return c.json(await toProfile(deps, await loadUser(deps, u.id)));
});

/** Account deletion: wipes personal data, deletes lists and share links, revokes sessions. Receipts keep only the snapshot first name. */
kid.delete("/me", async (c) => {
  const { db, now } = c.var.deps;
  const id = c.var.subjectId;
  const ts = now();
  await tx(db, async (t) => {
    await run(
      t,
      `UPDATE users SET deleted_at = ?, updated_at = ?, username = 'deleted', first_name = '', email_enc = '', email_hash = ?, password_hash = '', birthday = NULL, photo_enc = NULL, city_enc = NULL WHERE id = ?`,
      [ts, ts, `deleted:${id}`, id],
    );
    await run(t, "UPDATE parent_consents SET parent_email_enc = '', parent_email_hash = '' WHERE user_id = ?", [id]);
    await run(t, "UPDATE lists SET deleted_at = ? WHERE user_id = ? AND deleted_at IS NULL", [ts, id]);
    await run(t, "UPDATE share_links SET enabled = 0, revoked_at = ? WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?) AND revoked_at IS NULL", [ts, id]);
    await run(t, "DELETE FROM notifications WHERE recipient_type = 'kid' AND recipient_id = ?", [id]);
    await revokeAll(t, "kid", id, ts);
    await audit(t, { actorType: "kid", actorId: id, action: "account.delete" }, ts);
  });
  return c.json({ ok: true });
});

kid.post("/me/consent/resend", async (c) => {
  const deps = c.var.deps;
  const { db, box, config, mailer, now } = deps;
  await enforce(c, "consent-resend", 3, 3600_000);
  const u = await loadUser(deps, c.var.subjectId);
  if (u.consent_status === "verified") return c.json({ ok: true, consentStatus: "verified" });
  const pc = await one<{ id: string; parent_email_enc: string }>(
    db,
    "SELECT id, parent_email_enc FROM parent_consents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    [u.id],
  );
  if (!pc) throw notFound("parent consent");
  const token = randomToken();
  const ts = now();
  await run(db, "UPDATE parent_consents SET token_hash = ?, expires_at = ? WHERE id = ?", [await sha256Hex(token), ts + 7 * 24 * 3600_000, pc.id]);
  const url = `${config.API_PUBLIC_URL}/auth/kid/consent/verify?token=${token}`;
  await mailer.send(db, { to: await box.decrypt(pc.parent_email_enc), kind: "consent", ...consentEmail(u.first_name, url) }, ts);
  return c.json({ ok: true, consentStatus: "pending" });
});

kid.get("/me/home", async (c) => {
  const deps = c.var.deps;
  const u = await loadUser(deps, c.var.subjectId);
  const lists = await listsForUser(deps.db, u.id, deps.config.PUBLIC_GUEST_URL);
  // "Active" = the list whose party date comes soonest; otherwise the most recently edited one.
  const ts = deps.now();
  const dated = lists
    .map((l) => ({ l, d: daysUntil(l.birthday, ts) }))
    .filter((x): x is { l: (typeof lists)[number]; d: number } => x.d != null)
    .sort((a, b) => a.d - b.d);
  const activeList = dated[0]?.l ?? lists[0] ?? null;
  const items = await activity(deps, u.id, 10);
  const unread = await one<{ n: number }>(
    deps.db,
    "SELECT COUNT(*) AS n FROM notifications WHERE recipient_type = 'kid' AND recipient_id = ? AND read_at IS NULL",
    [u.id],
  );
  const result: HomeSummary = {
    profile: await toProfile(deps, u),
    activeList,
    daysToBirthday: daysUntil(activeList?.birthday ?? u.birthday, deps.now()),
    trending: await (async () => { const near = await kidShops(deps, u.id); return withDistance(await trending(deps.db, 10, near.ids), near.dist); })(),
    activity: items,
    unread: Number(unread?.n ?? 0),
  };
  return c.json(result);
});

kid.get("/me/activity", async (c) => {
  const since = Number(c.req.query("since") ?? 0) || 0;
  const items = (await activity(c.var.deps, c.var.subjectId, 50)).filter((a) => a.createdAt > since);
  return c.json({ items });
});

kid.post("/me/activity/read", async (c) => {
  const { db, now } = c.var.deps;
  await run(db, "UPDATE notifications SET read_at = ? WHERE recipient_type = 'kid' AND recipient_id = ? AND read_at IS NULL", [now(), c.var.subjectId]);
  return c.json({ ok: true });
});

// ---------- profile photo (private: only the kid sees it, never the public share page) ----------
const MAX_PHOTO_BYTES = 300 * 1024;
function photoKind(b: Buffer): "jpeg" | "png" | "webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

kid.put("/me/photo", async (c) => {
  const { db, box, now } = c.var.deps;
  await enforce(c, "photo", 20, 3600_000);
  const { photo } = await body(c, photoUploadSchema);
  const bytes = Buffer.from(photo, "base64");
  if (bytes.length > MAX_PHOTO_BYTES) throw badRequest("photo_too_large", "photo must be under 300 KB");
  const kind = photoKind(bytes);
  if (!kind) throw badRequest("photo_type", "photo must be a JPEG, PNG or WebP image");
  await run(db, "UPDATE users SET photo_enc = ?, updated_at = ? WHERE id = ?", [await box.encrypt(`${kind}:${photo}`), now(), c.var.subjectId]);
  await audit(db, { actorType: "kid", actorId: c.var.subjectId, action: "profile.photo_set", meta: { kind, bytes: bytes.length } }, now());
  return c.json({ ok: true, hasPhoto: true });
});

kid.get("/me/photo", async (c) => {
  const { db, box } = c.var.deps;
  const row = await one<{ photo_enc: string | null }>(db, "SELECT photo_enc FROM users WHERE id = ?", [c.var.subjectId]);
  if (!row?.photo_enc) throw notFound("photo");
  const [kind, data] = (await box.decrypt(row.photo_enc)).split(":", 2) as [string, string];
  c.header("Cache-Control", "private, no-store");
  return c.json({ contentType: `image/${kind}`, photo: data });
});

kid.delete("/me/photo", async (c) => {
  const { db, now } = c.var.deps;
  await run(db, "UPDATE users SET photo_enc = NULL, updated_at = ? WHERE id = ?", [now(), c.var.subjectId]);
  return c.json({ ok: true, hasPhoto: false });
});

// ---------- theme quiz ----------
kid.get("/quiz", (c) => c.json({ questions: QUIZ }));

/** Live preview while the kid answers: returns the theme these answers would create. */
kid.post("/themes/preview", async (c) => {
  const deps = c.var.deps;
  const u = await loadUser(deps, c.var.subjectId);
  const { quiz } = await body(c, z.object({ quiz: quizAnswersSchema }));
  return c.json(generateTheme(quiz, u.first_name));
});

// ---------- catalog ----------
// Kids only see shops near their city (within NEARBY_RADIUS_KM, at least the 2 closest).
kid.get("/catalog", async (c) => {
  const f = query(c, catalogQuerySchema);
  const near = await kidShops(c.var.deps, c.var.subjectId);
  const shopIds = f.shopIds ? f.shopIds.filter((id) => near.ids.includes(id)) : near.ids;
  const items = shopIds.length ? await searchCatalog(c.var.deps.db, { ...f, shopIds }) : [];
  return c.json({ items: withDistance(items, near.dist), city: near.city });
});
kid.get("/catalog/trending", async (c) => {
  const near = await kidShops(c.var.deps, c.var.subjectId);
  return c.json({ items: withDistance(await trending(c.var.deps.db, 12, near.ids), near.dist) });
});
kid.get("/catalog/shops", async (c) => {
  const near = await kidShops(c.var.deps, c.var.subjectId);
  const rows = (await shopsForFilter(c.var.deps.db)).filter((r) => near.ids.includes(r.id));
  return c.json({
    city: near.city,
    items: rows
      .map((r) => ({ id: r.id, name: r.name, city: r.city, logoUrl: r.logo_url, brandColor: r.brand_color, products: Number(r.products), distanceKm: near.dist.get(r.id) ?? null }))
      .sort((x, y) => (x.distanceKm ?? 1e9) - (y.distanceKm ?? 1e9)),
  });
});

// ---------- lists ----------
kid.get("/lists", async (c) => c.json({ items: await listsForUser(c.var.deps.db, c.var.subjectId, c.var.deps.config.PUBLIC_GUEST_URL) }));

kid.post("/lists", async (c) => {
  const { db, config, now } = c.var.deps;
  const input = await body(c, listCreateSchema);
  const count = await one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM lists WHERE user_id = ? AND deleted_at IS NULL", [c.var.subjectId]);
  if (Number(count?.n ?? 0) >= 20) throw badRequest("too_many_lists", "you can have up to 20 lists");
  const id = newId();
  const ts = now();
  const user = await loadUser(c.var.deps, c.var.subjectId);
  const theme = themeColumns(input.quiz, input.themeId, user.first_name)!;
  await run(db, "INSERT INTO lists (id, user_id, name, description, birthday, theme_id, quiz_answers, custom_theme, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", [
    id,
    c.var.subjectId,
    input.name,
    input.description,
    input.birthday ?? null,
    theme.theme_id,
    theme.quiz_answers,
    theme.custom_theme,
    ts,
    ts,
  ]);
  await audit(db, { actorType: "kid", actorId: c.var.subjectId, action: "list.create", targetType: "list", targetId: id }, ts);
  return c.json(await listDetail(db, c.var.subjectId, id, config.PUBLIC_GUEST_URL), 201);
});

kid.get("/lists/:id", async (c) =>
  c.json(await listDetail(c.var.deps.db, c.var.subjectId, c.req.param("id"), c.var.deps.config.PUBLIC_GUEST_URL)),
);

kid.patch("/lists/:id", async (c) => {
  const { db, config, now } = c.var.deps;
  const listId = c.req.param("id");
  await ownedList(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL);
  const input = await body(c, listUpdateSchema);
  const map: Record<string, string> = { name: "name", description: "description", birthday: "birthday" };
  const sets: string[] = [];
  const args: (string | null)[] = [];
  for (const [k, col] of Object.entries(map)) {
    const v = (input as Record<string, string | null | undefined>)[k];
    if (v !== undefined) {
      sets.push(`${col} = ?`);
      args.push(v);
    }
  }
  const theme = themeColumns(input.quiz, input.themeId, (await loadUser(c.var.deps, c.var.subjectId)).first_name);
  if (theme) {
    for (const [col, v] of Object.entries(theme)) {
      sets.push(`${col} = ?`);
      args.push(v);
    }
  }
  if (sets.length) await run(db, `UPDATE lists SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`, [...args, now(), listId]);
  return c.json(await listDetail(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL));
});

kid.delete("/lists/:id", async (c) => {
  const { db, config, now } = c.var.deps;
  const listId = c.req.param("id");
  await ownedList(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL);
  const ts = now();
  await tx(db, async (t) => {
    await run(t, "UPDATE lists SET deleted_at = ? WHERE id = ?", [ts, listId]);
    await run(t, "UPDATE share_links SET enabled = 0, revoked_at = ? WHERE list_id = ? AND revoked_at IS NULL", [ts, listId]);
    await audit(t, { actorType: "kid", actorId: c.var.subjectId, action: "list.delete", targetType: "list", targetId: listId }, ts);
  });
  return c.json({ ok: true });
});

kid.post("/lists/:id/items", async (c) => {
  const { db, config, now } = c.var.deps;
  const listId = c.req.param("id");
  const list = await ownedList(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL);
  if (list.itemCount >= 60) throw badRequest("list_full", "a list can have up to 60 gifts");
  const { productId } = await body(c, listItemAddSchema);
  const p = await one(db, "SELECT 1 FROM products p JOIN shops sh ON sh.id = p.shop_id WHERE p.id = ? AND p.active = 1 AND sh.status = 'approved'", [productId]);
  if (!p) throw notFound("product");
  const ts = now();
  await run(db, "INSERT INTO list_items (id, list_id, product_id, created_at) VALUES (?,?,?,?) ON CONFLICT(list_id, product_id) DO NOTHING", [
    newId(),
    listId,
    productId,
    ts,
  ]);
  await run(db, "UPDATE lists SET updated_at = ? WHERE id = ?", [ts, listId]);
  return c.json(await listDetail(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL), 201);
});

kid.delete("/lists/:id/items/:productId", async (c) => {
  const { db, config, now } = c.var.deps;
  const listId = c.req.param("id");
  await ownedList(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL);
  const item = await one<{ id: string; status: string }>(db, "SELECT id, status FROM list_items WHERE list_id = ? AND product_id = ?", [
    listId,
    c.req.param("productId"),
  ]);
  if (!item) throw notFound("list item");
  if (item.status === "purchased") throw conflict("already_purchased", "this gift was already bought and can't be removed");
  await run(db, "DELETE FROM reservations WHERE list_item_id = ?", [item.id]);
  await run(db, "DELETE FROM list_items WHERE id = ?", [item.id]);
  await run(db, "UPDATE lists SET updated_at = ? WHERE id = ?", [now(), listId]);
  return c.json(await listDetail(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL));
});

// ---------- sharing ----------
async function requireConsent(deps: Deps, userId: string) {
  const u = await loadUser(deps, userId);
  if (u.consent_status !== "verified") throw forbidden("consent_required", "a parent needs to approve the account before sharing");
}

/** Enable sharing (creates a link if none) */
kid.post("/lists/:id/share", async (c) => {
  const deps = c.var.deps;
  const { db, config, now } = deps;
  const listId = c.req.param("id");
  const list = await ownedList(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL);
  await requireConsent(deps, c.var.subjectId);
  const ts = now();
  if (list.share) {
    await run(db, "UPDATE share_links SET enabled = 1 WHERE list_id = ? AND revoked_at IS NULL", [listId]);
  } else {
    await run(db, "INSERT INTO share_links (id, list_id, slug, enabled, created_at) VALUES (?,?,?,1,?)", [newId(), listId, randomBase62(22), ts]);
  }
  await audit(db, { actorType: "kid", actorId: c.var.subjectId, action: "share.enable", targetType: "list", targetId: listId }, ts);
  return c.json(await ownedList(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL));
});

/** New link; the old URL stops working immediately */
kid.post("/lists/:id/share/regenerate", async (c) => {
  const deps = c.var.deps;
  const { db, config, now } = deps;
  const listId = c.req.param("id");
  await ownedList(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL);
  await requireConsent(deps, c.var.subjectId);
  const ts = now();
  await tx(db, async (t) => {
    await run(t, "UPDATE share_links SET enabled = 0, revoked_at = ? WHERE list_id = ? AND revoked_at IS NULL", [ts, listId]);
    await run(t, "INSERT INTO share_links (id, list_id, slug, enabled, created_at) VALUES (?,?,?,1,?)", [newId(), listId, randomBase62(22), ts]);
    await audit(t, { actorType: "kid", actorId: c.var.subjectId, action: "share.regenerate", targetType: "list", targetId: listId }, ts);
  });
  return c.json(await ownedList(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL));
});

/** Turn sharing off (link kept so it can be turned back on) */
kid.delete("/lists/:id/share", async (c) => {
  const { db, config, now } = c.var.deps;
  const listId = c.req.param("id");
  await ownedList(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL);
  await run(db, "UPDATE share_links SET enabled = 0 WHERE list_id = ? AND revoked_at IS NULL", [listId]);
  await audit(db, { actorType: "kid", actorId: c.var.subjectId, action: "share.disable", targetType: "list", targetId: listId }, now());
  return c.json(await ownedList(db, c.var.subjectId, listId, config.PUBLIC_GUEST_URL));
});
