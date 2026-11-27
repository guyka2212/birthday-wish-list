// Seed demo data: 3 approved shops (~35 products), 1 admin, demo kid Noa with 2 lists (one shared, one gift already bought).
// Demo passwords are random and saved only to the gitignored apps/api/.env.demo.
//   npm run db:seed      (uses DB_MODE from apps/api/.env)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../apps/api/src/config";
import { createDeps } from "../../apps/api/src/context";
import { createApp } from "../../apps/api/src/app";
import { one, run } from "../../apps/api/src/db";
import { newId, randomBase62 } from "../../apps/api/src/lib/crypto";
import { hashPassword } from "../../apps/api/src/lib/passwords";
import { upsertProducts } from "../../apps/api/src/services/products";
import { SHOPS, img } from "./data";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const apiDir = join(root, "apps", "api");
if (existsSync(join(apiDir, ".env"))) process.loadEnvFile(join(apiDir, ".env"));
process.chdir(apiDir);

// ---- demo credentials (stable across runs) ----
const demoFile = join(apiDir, ".env.demo");
const demo: Record<string, string> = {};
if (existsSync(demoFile)) {
  for (const line of readFileSync(demoFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) demo[m[1]!] = m[2]!;
  }
}
const pw = () => `${randomBase62(10)}7a`;
demo.DEMO_KID_EMAIL ??= "noa.demo@example.com";
demo.DEMO_KID_PASSWORD ??= pw();
demo.DEMO_PARENT_EMAIL ??= "parent.demo@example.com";
demo.DEMO_SHOP_EMAIL ??= "carmel-toys@example.com";
demo.DEMO_SHOP_PASSWORD ??= pw();
demo.DEMO_ADMIN_EMAIL ??= "admin.demo@example.com";
demo.DEMO_ADMIN_PASSWORD ??= pw();
writeFileSync(
  demoFile,
  "# Demo logins created by db/seed/seed.ts — gitignored, do not commit.\n" +
    Object.entries(demo)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") +
    "\n",
);

const config = loadConfig({ ...process.env, AUTO_VERIFY_PARENT: "true" });
const deps = await createDeps(config);
const { db, box } = deps;
const app = createApp(deps);
const now = Date.now();

if (await one(db, "SELECT 1 FROM shops LIMIT 1")) {
  console.log("[seed] data already present — skipping (run `npm run db:reset` for a fresh local DB)");
  process.exit(0);
}

// ---- admin ----
await run(db, "INSERT INTO admins (id, name, email_enc, email_hash, password_hash, created_at) VALUES (?,?,?,?,?,?)", [
  newId(),
  "מנהל/ת המערכת",
  await box.encrypt(demo.DEMO_ADMIN_EMAIL),
  await box.blindIndex(demo.DEMO_ADMIN_EMAIL),
  await hashPassword(demo.DEMO_ADMIN_PASSWORD),
  now,
]);

// ---- shops + products ----
const shopIds: Record<string, string> = {};
for (const s of SHOPS) {
  const id = newId();
  shopIds[s.key] = id;
  const email = s.key === "carmel" ? demo.DEMO_SHOP_EMAIL : `${s.emailLocal}@example.com`;
  const password = s.key === "carmel" ? demo.DEMO_SHOP_PASSWORD : pw();
  await run(
    db,
    `INSERT INTO shops (id, name, slug, business_id_enc, address_enc, city, phone_enc, contact_name, email_enc, email_hash, password_hash,
                        logo_url, brand_color, status, pickup_info, offers_delivery, created_at, updated_at, approved_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'approved',?,?,?,?,?)`,
    [
      id,
      s.name,
      s.key,
      await box.encrypt(s.businessId),
      await box.encrypt(s.address),
      s.city,
      await box.encrypt(s.phone),
      s.contactName,
      await box.encrypt(email),
      await box.blindIndex(email),
      await hashPassword(password),
      img(s.logoEmoji),
      s.brandColor,
      s.pickupInfo,
      s.offersDelivery ? 1 : 0,
      now,
      now,
      now,
    ],
  );
  await upsertProducts(
    db,
    id,
    s.products.map((p) => ({
      sku: p.sku,
      title: p.title,
      description: p.description,
      category: p.category,
      priceAgorot: Math.round(p.price * 100),
      imageUrl: img(p.emoji),
      ageMin: p.ageMin ?? null,
      ageMax: p.ageMax ?? null,
      active: true,
      stock: p.stock,
    })),
    now,
  );
  console.log(`[seed] shop ${s.name}: ${s.products.length} products`);
}

// ---- demo kid via the real API (exercises signup, lists, share, reserve, checkout) ----
async function call<T = unknown>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await app.request(path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as T;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const nextMonth = new Date(now + 23 * 86_400_000).toISOString().slice(0, 10);
const signup = await call<{ accessToken: string }>("POST", "/auth/kid/signup", {
  username: "נועה הקוסמת",
  firstName: "נועה",
  email: demo.DEMO_KID_EMAIL,
  password: demo.DEMO_KID_PASSWORD,
  parentEmail: demo.DEMO_PARENT_EMAIL,
  birthday: "2016-" + nextMonth.slice(5),
  avatar: "🦄",
});
const token = signup.accessToken;

const pid = async (sku: string) => (await one<{ id: string }>(db, "SELECT id FROM products WHERE external_sku = ?", [sku]))!.id;

const bday = await call<{ id: string }>("POST", "/kid/lists", {
  name: "יום הולדת 10 🎂",
  description: "המתנות שהכי בא לי ליום ההולדת העשירי!",
  birthday: nextMonth,
  themeId: "unicorn",
}, token);
for (const sku of ["CT-UNICORN", "SV-PAINT", "ST-LEGO-CASTLE", "CT-SCIENCE", "SV-HP-SET", "ST-ROLLER", "CT-WAND", "SV-CRAYONS"]) {
  await call("POST", `/kid/lists/${bday.id}/items`, { productId: await pid(sku) }, token);
}
const shared = await call<{ share: { slug: string; url: string } }>("POST", `/kid/lists/${bday.id}/share`, {}, token);

const hanukkah = await call<{ id: string }>("POST", "/kid/lists", {
  name: "מתנות לחנוכה 🕎",
  description: "רעיונות קטנים לחנוכה",
  themeId: "space",
}, token);
for (const sku of ["SV-TELESCOPE", "ST-LEGO-ROCKET", "SV-SPACE-BOOK"]) {
  await call("POST", `/kid/lists/${hanukkah.id}/items`, { productId: await pid(sku) }, token);
}

// one gift already bought by "grandma" so the app shows progress + activity
const guest = randomBase62(32);
const pub = await call<{ items: Array<{ id: string; product: { title: string } }> }>("GET", `/public/l/${shared.share.slug}`);
const paint = pub.items.find((i) => i.product.title.includes("צבעי מים"))!;
const res = await call<{ id: string }>("POST", "/public/reservations", { slug: shared.share.slug, listItemId: paint.id, guestSession: guest });
await call("POST", "/public/checkout", {
  slug: shared.share.slug,
  guestSession: guest,
  reservationIds: [res.id],
  buyerName: "סבתא רותי",
  buyerEmail: "grandma.demo@example.com",
  greeting: "נועה יקרה, מזל טוב! שתמשיכי לצייר ולחלום 💖",
  deliveryMethod: "pickup",
});

await run(db, "DELETE FROM rate_limits");
await run(db, "UPDATE users SET updated_at = ? WHERE email_hash = ?", [now, await box.blindIndex(demo.DEMO_KID_EMAIL)]);

console.log(`[seed] demo kid ready, shared list: ${shared.share.url}`);
console.log(`[seed] demo logins saved to apps/api/.env.demo`);
db.close();
