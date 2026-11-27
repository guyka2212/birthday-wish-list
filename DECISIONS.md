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
- **PDF download is generated in the browser** with html2canvas-pro + jsPDF (split into A4 pages), plus a print stylesheet, because the browser lays out Hebrew RTL text correctly. (html2pdf.js was replaced: its html2canvas crashes on the oklch/oklab colors Tailwind v4 uses.)
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

## Profile photo and theme quiz (feature update)
- **Profile photo at sign-up.** The kid takes one with the camera or picks one from the gallery. Android uses the system photo picker and the camera preview intent, so the app needs neither storage nor camera permissions. The app center-crops and resizes it to a 320×320 JPEG (about 5–40 KB) before upload.
- **The photo is private.** It's stored AES-256-GCM encrypted in `users.photo_enc` and served only to the kid themselves (`GET /kid/me/photo`). It never appears on the public share page, and a test checks that. It's wiped on account deletion. The server checks the file signature (JPEG/PNG/WebP) and a 300 KB limit.
- **The photo is optional but asked for first.** Sign-up opens with "let's add your picture", and the emoji character stays as a fallback for kids or parents who'd rather not share a photo.
- **The guest-shop theme comes from a 6-question quiz** (color, animal, music, hobby, dream place, treat). Generation lives in `packages/shared/src/quiz.ts` and runs on the server, so the app, the API and the website always agree. The app fetches the questions from `GET /kid/quiz` and previews themes with `POST /kid/themes/preview`, so questions can change without an app update.
- **How answers shape the theme:** color sets the palette; rock, hip-hop, electronic or a trip to space make a dark shop, and classical softens it to pastels; the animal becomes the shop emoji; every answer adds confetti; the tagline mixes animal, hobby and music with the kid's first name. Text colors are picked for contrast, and a test checks all color × music combinations meet WCAG levels.
- **Quiz answers aren't public.** The public page gets only the generated theme (colors, emojis, tagline). The 6 preset themes still work for older lists, and a kid can redo the quiz at any time from the theme button on the edit screen.

## Location and stock-check buying (feature update)
- **Only a city is asked for, never a street address,** from a list of 51 Israeli cities with approximate coordinates (`packages/shared/src/cities.ts`). Distances are straight-line (haversine), rounded to whole km.
- **Kids see nearby shops only:** shops within 30 km of their city, and always at least the 2 nearest so small towns never get an empty catalog. The kid's city is encrypted in the DB. Kids who signed up before this feature see all shops plus a "choose your city" nudge on Home.
- **The buyer's city never leaves the browser.** It's saved in localStorage and distances are computed client-side, since shop cities are already public on the share page. Gifts are sorted nearest-first, bought gifts last, with a "closest to you" badge. Each gift on a list belongs to one specific shop, so the page shows how close that shop is rather than switching the gift to another shop.
- **Shops must pick a known city** (validated), so distances always work.
- **"Buy" is now a request to the shop.** The mock payment is still taken at checkout, and the gift is held so nobody else buys it. The order stays `new` ("waiting for stock check") until the shop answers:
  - **In stock:** status `ready` ("set aside for the buyer"). This is when the kid gets "someone bought you a gift 🎁".
  - **Not in stock:** status `cancelled` with `decline_reason = unavailable`. The payment is refunded through the `PaymentProvider`, the shop's stock for that product is set to 0, and the gift goes back on the list.
- **Emails to buyers are sent by the shop with a button.** This is deliberate, so the shop decides when, and can resend. The text comes from admin-editable templates (`set_aside`, `unavailable`) with placeholders: order number, buyer name, kid name, shop name, address, phone, pickup hours, items, total, date, receipt link and list link. Templates are plain text: values and lines are HTML-escaped, line breaks are kept, and https links become clickable, so a template can't inject markup. The shop sees a preview before sending.
- **The receipt token is also stored encrypted** (besides its hash), so the shop's email can include the buyer's receipt link.

## Kid photo in the gift shop, and "פרטי ההזמנה" (update)
- **The kid's photo now shows at the top of their gift shop** (requested by the product owner). Because it's a child's photo on a link that can be shared, each list has a **"show my photo in the shop"** switch in the app's share sheet. It's on by default and the kid or parent can turn it off. The photo is served from `GET /public/l/:slug/photo` only while that list is shared and the switch is on; otherwise it returns 404. The public JSON carries only `kidPhoto: true/false`, never the image data.
- **Only the photo route allows cross-site use** (`Cross-Origin-Resource-Policy: cross-origin`), so the guest site can show it; every other API response stays `same-origin`.
- **"קבלה" is renamed "פרטי ההזמנה"** across the bill page, buyer emails and templates. The default "set aside" template wording is updated by migration 0007, but only if the admin never edited it.
- **Delivery was removed (update):** gifts are picked up from the shop only. Checkout no longer offers delivery or asks for an address, the API rejects `deliveryMethod: delivery`, and the shop portal no longer has the 'offers delivery' option or a 'shipped' status button. Old orders keep whatever they had.
