# Goodside delivery starter

Angular 20 standalone frontend, Express 5 on Netlify Functions, Prisma/PostgreSQL, Redis caching and checkout locking, and an installable PWA starter. The backend includes catalog, customer, address, cart, order, and checkout modules.

## Run locally

Use Node.js 22.12+ (this workspace was built with 22.22.2).

1. Run `npm install`.
2. Copy `.env.example` to `.env`. To use the local database, start `docker compose up -d`, then run `npm run prisma:migrate:dev` to apply the committed migrations.
3. Run `npm run dev` for normal development. Open `http://localhost:4200`; Angular proxies
   `/api/*` to the local Express server on port `3000`.
4. Run `npm run dev:netlify` when checking the main API through Netlify Functions. Open only
   `http://localhost:8888`; port `4200` bypasses the Netlify proxy.
5. Run `npm run dev:netlify:full` when testing SSE or scheduled Functions, and run
   `npm run smoke:dev` in another terminal to verify the active Netlify API boundary.
6. Run `npm run build` and `npm run typecheck:backend` before deployment.

Netlify Dev proxies the Angular server through an empty `dev-static` publish directory. Its launcher
temporarily hides the generated production `_redirects` file because Netlify CLI otherwise applies
the SPA fallback to Angular's virtual assets and `/api` routes. The API-only command bundles one
Function to reduce local CPU use; the full command loads all production Functions.

The UI and `GET /api/health` work without a database. The category and product routes read the migrated catalog tables; Redis is optional and catalog reads fall back to PostgreSQL when it is unavailable. `GET /api/state/latest` returns a null state until snapshots exist. The snapshot route is public in this starter, so store only public state. Customer login, refresh, and private address routes require PostgreSQL and `AUTH_TOKEN_SECRET`. Addresses support an optional validated geolocation pin. Push registration requires PostgreSQL plus a public VAPID key.

## Deploy to Netlify

Connect this repository. `netlify.toml` builds with `npm run build`, publishes `dist/delivery/browser`, bundles `netlify/functions/api.ts`, rewrites `/api/*` to the function, and serves the Angular shell for client routes. Netlify provides HTTPS.

Set `DATABASE_URL` in Netlify to a **pooled** Supabase PostgreSQL URL for function traffic. Use a **direct/session** Supabase URL when running `npm run prisma:migrate:deploy` in a separate authorized deployment step. Do not put database credentials in `public/` or browser configuration. Set `CORS_ORIGIN` only if another origin calls the API. Set `VAPID_PUBLIC_KEY` when push enrollment is ready.

Set `REDIS_URL` to a Redis or TLS Redis URL to cache public catalog responses. Set `CACHE_NAMESPACE` uniquely for each brand and environment sharing Redis. `CATALOG_CURRENCY` defaults to `BRL`. Storage selection lives in `backend/config/storage.ts`: use `STORAGE_PROVIDER=local` with `PRODUCT_IMAGE_BASE_URL` and `LOCAL_PRODUCT_IMAGE_DIRECTORY` during development; use `STORAGE_PROVIDER=supabase` with `SUPABASE_URL` and `SUPABASE_STORAGE_BUCKET` for the production public bucket. Product image records store keys, while the selected adapter derives display URLs. Any catalog write must increment `CatalogRevision.version` in the same database transaction so old cache keys and ETags stop matching.

Set `AUTH_TOKEN_SECRET` to a unique random value of at least 32 characters in each environment. Customer login normalizes names to lowercase ASCII without spaces for comparison and stores phones as Brazilian E.164 values. Access tokens last 15 minutes by default. Refresh tokens are delivered as secure HttpOnly cookies in production, rotate on every use, and are persisted only as SHA-256 hashes.

The Angular authentication client restores the session from the refresh cookie during startup, keeps the short-lived access token only in memory, and attaches it through an HTTP interceptor. Concurrent `401` responses share one refresh request before retrying with the rotated access token. `/cart`, `/orders`, `/addresses`, `/payments`, `/profile`, and `/profile/edit` preserve their requested URL while redirecting anonymous users to `/login`. Profile edits use `PATCH /api/me`; logout revokes the refresh session before local account state is cleared.

The storefront reads products, product details, and categories from the public catalog API. It stores the latest successful catalog snapshot locally for immediate cart estimates and offline browsing. Prices remain integer minor units until display. The catalog interface includes skeleton, empty, unavailable, and offline states.

Authenticated cart routes persist product selections with optimistic revisions and reprice them from PostgreSQL before checkout. `CART_DELIVERY_FEE_MINOR` defaults to zero and `CART_QUOTE_TTL_SECONDS` defaults to 300 seconds. The Angular demo cart remains local until its login flow can supply an access token; when connected, batch changes after the documented 500 ms debounce.

Checkout supports Pix and tokenized cards through Mercado Pago, pay on delivery, and pay at the store. Configure `SHOP_LATITUDE`, `SHOP_LONGITUDE`, `LIMIT_KM`, `FEE_PER_KM`, and `MERCADO_PAGO_FEE_PERCENT`; the `DeliveryPricingSetting` row with ID `main` overrides the distance limit and per-kilometer fee. Set `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_PUBLIC_KEY`, and `MERCADO_PAGO_WEBHOOK_SECRET` in Netlify. Redis is required for checkout locks. The browser sends a unique `X-Idempotency-Key` for each checkout intent and sends only a Mercado Pago one-time card token, never raw card data.

Configure the Mercado Pago Order webhook URL as `/api/webhooks/mercado-pago`. `expire-orders` runs every minute, verifies pending orders with Mercado Pago, and cancels eligible unpaid orders after `UNPAID_ORDER_TIMEOUT_MINUTES`. Order changes are persisted before delivery through `/api/order-events` (SSE) or `GET /api/orders/events?after=<event-id>`. The SSE function closes after about 50 seconds; clients reconnect with the last event ID and keep received notifications in IndexedDB until the user clears the local notification list.

Do not run production migrations automatically during a normal site build. Review their SQL and run them as a separate deploy step. Backend route details are in [BACKEND.md](BACKEND.md).

## White label settings

Edit `public/app-config.json` to change the brand name, accent, currency, locale, and realtime URL. Product and category content comes from PostgreSQL through the catalog API. Edit `public/manifest.webmanifest` and `src/index.html` for the installed app name and metadata. Regenerate or replace the PNG icons in `public/icons/` for the new brand. Components and API routes do not contain customer branding.

## UI routes

- `/` — mobile menu, search, categories, featured dish, and shared cart state.
- `/product/:id` — food details, options, quantity, and add to cart.
- `/cart` — editable order summary, address, payment preview, and checkout handoff.
- `/profile` — customer account menu.
- `/profile/edit` — validated personal information form saved on this device.

Product images use URLs produced by the selected local or Supabase storage adapter. Missing and failed images use `public/images/products/product-placeholder.webp`.

Backend tests: `npm run test:backend` automatically discovers fast tests named `*.spec.ts`. `npm run test:backend:db` discovers database tests named `*.db.test.ts` and runs them against **local PostgreSQL only**; each database test must isolate and clean up its own state. These commands are separate from Angular's `npm test`.

## Realtime and notifications

The existing frontend still uses its initial state catch-up service. The order backend now exposes persisted SSE events and an HTTP event replay endpoint; connecting those to the authenticated frontend notification center is the next frontend module.

The PWA uses Angular's service worker, real PNG icons, and one Install action. Safari offers Home Screen instructions; browsers that fire `beforeinstallprompt` get the native prompt. Notifications are offered only when a public VAPID key and browser support exist. On iOS, the app must be opened from its Home Screen icon. Enabled status requires an actual browser `PushSubscription` **and** successful backend registration; permission alone is insufficient. Registration is currently scoped to an anonymous install UUID. Add accounts and authorization before delivering private messages. The project does not yet include a Web Push sender or any order event that would send notifications.

Test installation and background push on real iPhone and Android devices before claiming cross-platform delivery. The starter has not had physical-device verification.

## Structure

- `src/app/features/home`: catalog page, local filters, and request state presentation.
- `src/app/core`: public brand config, catalog cache, authentication, API calls, realtime lifecycle, and push subscription.
- `src/app/shared`: install action.
- `backend/app.ts`: Express configuration and global middleware.
- `backend/routes.ts`: composition root that imports every module router.
- `backend/modules`: feature modules split into repository, service, controller, and routes.
- `backend/shared`: reusable exceptions, HTTP responses, status values, and middleware.
- `backend/utils`: shared request, async-handler, and search behavior.
- `backend/infra`, `backend/prisma`: database/cache adapters, schema, and migrations.
- `netlify/functions/api.ts`: thin Netlify adapter.
