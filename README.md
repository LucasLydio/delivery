# Goodside delivery starter

Angular 20 standalone frontend, Netlify Functions TypeScript API, Prisma/PostgreSQL, and an installable PWA starter. The first screen is a sample menu and install experience; checkout, accounts, orders, payment, and notification sending are future product work.

## Run locally

Use Node.js 22.12+ (this workspace was built with 22.22.2).

1. Run `npm install`.
2. Copy `.env.example` to `.env`. To use the local database, start `docker compose up -d`, then run `npm run prisma:migrate:dev -- --name init`. The committed initial migration is also ready for deployment.
3. Run `npm run dev:netlify`. Open `http://localhost:8888` for the Angular app and `/api/*` Functions.
4. Run `npm run build` and `npm run typecheck:backend` before deployment.

The UI and `GET /api/health` work without a database. `GET /api/state/latest` returns a null state until snapshots exist. The snapshot route is public in this starter, so store only public state until authentication is added. Push registration requires PostgreSQL plus a public VAPID key.

## Deploy to Netlify

Connect this repository. `netlify.toml` builds with `npm run build`, publishes `dist/delivery/browser`, bundles `netlify/functions/api.ts`, rewrites `/api/*` to the function, and serves the Angular shell for client routes. Netlify provides HTTPS.

Set `DATABASE_URL` in Netlify to a **pooled** Supabase PostgreSQL URL for function traffic. Use a **direct/session** Supabase URL when running `npm run prisma:migrate:deploy` in a separate authorized deployment step. Do not put database credentials in `public/` or browser configuration. Set `CORS_ORIGIN` only if another origin calls the API. Set `VAPID_PUBLIC_KEY` when push enrollment is ready.

Do not run production migrations automatically during a normal site build. Review their SQL and run them as a separate deploy step. Backend route details are in [BACKEND.md](BACKEND.md).

## White label settings

Edit `public/app-config.json` to change the brand name, accent, currency, locale, temporary sample menu, and WebSocket gateway URL. The [commerce data contract](docs/commerce-data-contract.md) defines the future catalog API and cached cart preview; the sample menu will move out of this file when that API is built. Edit `public/manifest.webmanifest` and `src/index.html` for the installed app name and metadata. Regenerate or replace the PNG icons in `public/icons/` for the new brand. Components and API routes do not contain customer branding.

Menu items are illustrative local data. The basket is a UI preview and deliberately has no checkout action.

## UI routes

- `/` — mobile menu, search, categories, featured dish, and shared cart state.
- `/product/:id` — food details, options, quantity, and add to cart.
- `/cart` — editable order summary, address, payment preview, and checkout handoff.
- `/profile` — customer account menu.
- `/profile/edit` — validated personal information form saved on this device.

The generated transparent food sheet is `public/images/menu-dishes.png`. Product quadrant positions live in `public/app-config.json`, so replacement brands can supply another four-item sheet or replace the image component with catalog URLs later.

## Realtime and notifications

The app fetches `/api/state/latest` on launch, when it becomes visible again, and after a WebSocket reconnect or `state_changed` event. With `realtimeUrl` configured, it reconnects with bounded exponential backoff, sends an **application-level** `ping` every 60 seconds while visible, and expects `pong` within 15 seconds. It closes the socket when hidden. Browser JavaScript cannot send WebSocket protocol ping frames, so the external gateway must implement this message contract. Netlify Functions cannot host persistent WebSocket connections. Without a gateway URL, the app still performs HTTP catch-up.

The PWA uses Angular's service worker, real PNG icons, and one Install action. Safari offers Home Screen instructions; browsers that fire `beforeinstallprompt` get the native prompt. Notifications are offered only when a public VAPID key and browser support exist. On iOS, the app must be opened from its Home Screen icon. Enabled status requires an actual browser `PushSubscription` **and** successful backend registration; permission alone is insufficient. Registration is currently scoped to an anonymous install UUID. Add accounts and authorization before delivering private messages. The project does not yet include a Web Push sender or any order event that would send notifications.

Test installation and background push on real iPhone and Android devices before claiming cross-platform delivery. The starter has not had physical-device verification.

## Structure

- `src/app/features/home`: initial page and component-owned menu state.
- `src/app/core`: public brand config, API calls, realtime lifecycle, push subscription.
- `src/app/shared`: install action.
- `backend/app.ts`: framework-neutral request routing and error policy.
- `backend/modules`, `backend/infra`, `backend/prisma`: backend feature, database client, schema and migration.
- `netlify/functions/api.ts`: thin Netlify adapter.
