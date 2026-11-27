# Decisions

Judgment calls made while building, newest at the bottom of each section.

## Platform and repo
- **Kid app stays Kotlin + Compose** (Compose Multiplatform template that was already in the folder, moved to `apps/kid-android`). It's native, smooth, has good RTL support, and gives a real APK from CI. iOS stays possible later through the existing `iosApp` and `shared` modules, but isn't built or tested now.
- **npm workspaces** instead of pnpm, because pnpm isn't installed and npm is enough for 4 JS packages.
- **Public GitHub repo** (the user chose this), so GitHub Pages works on the free plan.
- **TypeScript 6.0**, because typescript-eslint doesn't support TS 7 (the native port) yet.

## Backend
- **API host: Vercel, Node runtime** (the user chose this). Cloudflare's free plan has a 10 ms CPU limit, which rules out Argon2id. Vercel runs normal Node, so `@node-rs/argon2` works.
- **Hono** runs the same app code on Node locally and on Vercel.
- **Local dev uses a local libSQL file.** `DB_MODE=remote` switches to Turso, and tests use in-memory libSQL with the real migrations applied.
- **Reservations expire lazily**: expired holds are released whenever availability is read or written, so no cron job is needed.
- **Rate limiting is stored in the DB** (fixed window per key), because serverless instances don't share memory.
- **One receipt per checkout, one order per shop.** A guest can buy from several shops at once. Each shop sees and moves only its own order through new → preparing → ready/shipped → done, and the bill groups them.
- **Prices are stored in agorot (integers), with VAT included**, as is normal in Israel. The bill shows the 17% VAT inside the total: VAT = total × 17/117.
- **Handwritten OpenAPI 3.1 spec** for the shop API, served at `/openapi.json`. It's small, and writing it by hand keeps the docs readable.
- **Shop webhooks are outbound**: `order.created` and `order.status_changed`, signed with HMAC-SHA256 in the `X-BWL-Signature` header. Stock comes in through the bulk sync endpoint.

## Privacy and security
- **Parental consent:** sign-up needs a parent email. A consent email with a verify link is sent, and until the parent verifies, the list can't be shared publicly. With `AUTO_VERIFY_PARENT=true` (dev and demo only), consent is verified automatically.
- **Encrypted columns** use AES-256-GCM, stored as `v1:<iv>:<ciphertext>`. Email lookups use an HMAC-SHA256 blind index (`email_hash`) so we can find accounts without decrypting.
- **Guest checkout** needs no account. The browser holds a random guest session id, and only its hash is stored.
- **Receipt links** carry a random access token (`/bill/<id>?t=<token>`). Only its hash is stored.

## Notifications and email
- **EmailProvider interface.** The default `OutboxEmailProvider` stores every email in the `email_outbox` table, viewable in the admin view, so nothing is lost before a real provider exists. If `RESEND_API_KEY` is set, `ResendEmailProvider` sends real mail.
- **Kid notifications** go to an in-app activity feed ("someone bought you a gift 🎁", never who or what). The Android app also polls it with WorkManager and shows a local notification. This needs no Firebase account; FCM can be added later.

## Front ends
- **Both sites are Vite + React + TypeScript + Tailwind**, sharing tokens and themes from `packages/shared`.
- **GitHub Pages layout:** guest site at the root (`/birthday-wish-list/`) with clean `/l/<slug>` links through the 404.html SPA fallback, and the shop portal at `/birthday-wish-list/shop/`.
- **PDF download is generated in the browser** with html2pdf, plus a print stylesheet, because the browser lays out Hebrew RTL text correctly.
- **Fonts:** Rubik everywhere, from `@fontsource/rubik` on the web and a bundled TTF (OFL) on Android.
- **English toggle:** included, since adding a second string table was cheap.

## Build and deploy notes (added while building)
- **Local API port is 4000, not 8787.** Windows (Hyper-V) reserves 8702–8801, so binding 8787 fails with EACCES.
- **Product images are OpenMoji SVG illustrations** (CC BY-SA 4.0, credited in the guest-shop footer) on soft gradients. They're colorful, kid-friendly and always load. Real product photos would need licensed images from the shops, who can set `imageUrl` through the API or portal.
- **Tests use temp-file libSQL databases, not `:memory:`.** libSQL write transactions open a new connection, which on `:memory:` would be an empty database.
- **The production API uses `@libsql/client/web`** (HTTPS only, no native SQLite). Argon2id runs natively on Vercel's Linux Node runtime, and a live login takes about 1.4 s cold.
- **Vercel deploys from a copy outside the repo** (see README). Inside the repo, Vercel attaches git metadata and refuses commits whose author isn't on the Vercel team.
- **`AUTO_VERIFY_PARENT=true` in production for now.** Until real email is set up (Resend), consent emails only reach the outbox, so a real parent couldn't click the link. Once `RESEND_API_KEY` is set, switch it to `false` to require real parent approval.
- **Release APK is signed with the debug key** so CI can publish an installable test build. A Play Store release needs a private upload key, which only you should hold.
- **Android token storage keeps the decrypted tokens in memory after the first read.** Decrypting with the Keystore on every request blocked the main thread long enough to cause an ANR on a busy emulator.
- **Home's "active list"** is the list with the nearest party date, falling back to the most recently edited one.
