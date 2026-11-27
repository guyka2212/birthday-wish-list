# 🎁 Birthday Wish List · רשימת משאלות ליום הולדת

Kids build birthday wish lists from real products that local shops have in stock. They share a link, and family and friends buy from the list in a themed gift shop. Shops connect their stock through an API and fulfil the orders.

| Part | Folder | Stack |
|---|---|---|
| Kid app (Android) | `apps/kid-android` | Kotlin, Compose Multiplatform, RTL Hebrew |
| Guest gift shop + bill page | `apps/web-guest` | Vite, React, TypeScript, Tailwind |
| Shop portal + admin + API docs | `apps/web-shop` | Vite, React, TypeScript, Tailwind |
| Backend API | `apps/api` | Hono, zod, libSQL client, Argon2id, JWT |
| Shared types, schemas, themes, VAT | `packages/shared` | TypeScript, zod |
| Database schema | `db/migrations` | SQL migrations for Turso (libSQL) |

## Architecture

```
 Android kid app            web-guest (GitHub Pages)        web-shop (GitHub Pages)
 Compose · RTL · he/en      themed gift shop · bill/PDF     shop dashboard · admin · docs
        \                            |                               /
         \_____ HTTPS JSON ── JWT · guest session · X-Api-Key ______/
                                     |
                     apps/api — Hono on Vercel (Node runtime)
       auth · lists · catalog · share links · reservations (15 min) · checkout
       PaymentProvider (fake) · EmailProvider (outbox | Resend) · AES-256-GCM
       Argon2id · rate limiting · CORS allowlist · audit log
                                     |
                         Turso / libSQL  (token only on the server)
```

The browser and the phone never see the Turso token. All data goes through the API.

## Run everything locally (one command)

```bash
npm install
cp apps/api/.env.example apps/api/.env   # then fill in the secrets (see the file)
npm run db:reset                         # migrate and seed the local database
npm run dev                              # API :4000 · guest :5173 · shop :5174
```

- Local dev uses a local libSQL file (`apps/api/local.db`). Set `DB_MODE=remote` in `.env` to use Turso.
- Android: open `apps/kid-android` in Android Studio and run `androidApp`, or run `./gradlew :androidApp:installDebug`. Debug builds call `http://10.0.2.2:4000` (the API on your PC).

## Tests and checks

```bash
npm test            # API critical paths (sign-up, lists, share, reserve, checkout, stock sync)
npm run lint
npm run typecheck
cd apps/kid-android && ./gradlew test assembleDebug
```

## Build order (how this was built)

DB → API → kid app → guest shop → shop portal → bill page → deploy. See [DECISIONS.md](DECISIONS.md) for every judgment call.

## Security summary

- Passwords use Argon2id. Access JWTs last 15 minutes, with rotating refresh tokens stored hashed.
- Shop API keys are shown once, stored as SHA-256 and can be rotated.
- Emails, phone numbers, addresses and business IDs are encrypted with AES-256-GCM in the app. Lookups use an HMAC blind index.
- Every input is validated with zod, all SQL is parameterized, and logins and public pages are rate-limited. CORS is limited to the known front-end origins.
- Public share pages show only the kid's first name, the list and the theme. Slugs are 22 random base62 characters.
- `.env*` files are gitignored, and a pre-commit secret scan runs (`scripts/secret-scan.mjs`).
