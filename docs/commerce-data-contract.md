# Commerce data contract (step 5.1)

The TypeScript wire types are in [`shared/commerce-contract.ts`](../shared/commerce-contract.ts). They are the boundary between the Angular app and the Netlify API. The current sample menu in `public/app-config.json` remains available until the catalog API exists; it is **not** the future product source. `app-config.json` will retain only public white-label branding, locale, currency, and realtime settings after that migration.

## Rules

- Money sent by the API is an integer in the currency's minor units (`1250` means BRL 12.50). Product and option prices, subtotals, fees, taxes, and totals use the same currency. The backend validates safe integer ranges and computes every confirmed amount from current database values. The client formats amounts for display with the configured locale and currency.
- Product and option IDs are opaque. A cart line has its own stable ID so the same product with different options can appear twice. Quantity is an integer from 1 to 99. Selected option IDs are unique within a line; the backend checks group minimums, maximums, availability, and ownership by that product.
- Catalog responses carry a version and fetch time. Product images carry a storage key and display URL; the key is the durable database value. The URL can change when the storage adapter changes.
- Customer, address, and order data belong behind authenticated or scoped API routes. They must not be placed in the public app configuration or the service worker's public cache.
- Orders hold immutable snapshots of item names, selected options, prices, and the selected or overridden delivery location. Payment state changes create persisted order events.

## Proposed API exchange for the next steps

| Request | Response or purpose |
| --- | --- |
| `GET /api/products` | `CatalogSnapshot` (or paged equivalent), with `ETag` based on `version` |
| `GET /api/products/:id` | `CatalogProduct`, including option groups and images |
| `GET /api/me`, `PATCH /api/me` | `Customer` profile |
| `POST /api/auth/login` | Find or create a customer using normalized name and Brazilian mobile phone; issue an access token and HttpOnly refresh cookie |
| `POST /api/auth/refresh`, `DELETE /api/auth/logout` | Rotate or revoke the first-party refresh session |
| `GET /api/me/addresses`, `POST /api/me/addresses` | List or create authenticated customer addresses |
| `PATCH /api/me/addresses/:id`, `DELETE /api/me/addresses/:id` | Update or delete only an address owned by the authenticated customer |
| `PATCH /api/me/addresses/:id/default` | Atomically select the customer's only default address |
| `GET /api/cart` | Authenticated customer's `CartDraft`, or an empty draft |
| `PUT /api/cart` | Replace the complete authenticated cart using its expected revision |
| `DELETE /api/cart` | Remove the authenticated customer's server cart |
| `POST /api/cart/quote` | Reprice the synchronized cart from current product and option records |
| `POST /api/checkout/quote` | Authoritative quote using the current cart, location, payment method, and optional coupon |
| `POST /api/checkout` | Idempotent order creation; requires `X-Idempotency-Key` |
| `GET /api/orders`, `GET /api/orders/:id` | Authenticated order history and details |
| `GET /api/orders/events?after=:cursor` | Catch up persisted order notifications |
| `GET /api/order-events` | Authenticated SSE stream with `Last-Event-ID` replay |
| `POST /api/webhooks/mercado-pago` | Signed Mercado Pago Order reconciliation |

## Cached cart preview

The app will keep a catalog snapshot and the user's cart selections locally. Quantity and option changes recalculate an **estimate** immediately from those cached values. This calculation is pure and makes no HTTP request; [`calculateCartPreview`](../shared/cart-preview.ts) defines its behavior. A missing product, unavailable option, invalid selection, or currency mismatch sets `needsReview`; the UI must not show its partial subtotal as a payable total.

When the product API is added, cache public catalog data in IndexedDB and use its version/`ETag` to revalidate on launch and when the installed app becomes visible after a reasonable stale interval (initial target: five minutes). The draft can remain in local storage because it contains only product IDs, option IDs, and quantities. Debounce server cart synchronization (initial target: 500 ms after edits) and reconcile with the returned revision. Do not send a request for every `+` or `−` tap. If an offline or stale preview is shown, label it as an estimate.

At checkout, flush pending synchronization and make one authoritative quote request against current products, option rules, location, payment fee, coupon, and configured delivery pricing. If the server changes an amount or rejects an item, display the differences and require review. A quote expires and is not payment authorization. Brazilian catalog prices are treated as tax inclusive, so `taxMinor` is zero. On reconnect, refresh the catalog and cart once, then recompute the preview.

`PUT /api/cart` sends the complete local selection draft after the 500 ms frontend debounce. A `409` response includes `details.currentCart`; the client must reconcile that server revision rather than silently overwriting changes made by another session. Cart rows contain product IDs, option IDs, and quantities only. Private cart responses are never stored in Redis or a public service-worker cache.

The current starter already keeps quantities in `delivery-cart` local storage and computes the preview without API calls. Its sample prices are decimals, so the transition adapter converts them to integer minor units before multiplying. The later catalog API will provide integer prices directly.

## Address location pin

An address can include an optional `locationPin` captured by browser geolocation or selected on a map:

```json
{
  "latitude": -23.561684,
  "longitude": -46.655981,
  "accuracyMeters": 12.5
}
```

Latitude, longitude, and accuracy are validated by both the API and PostgreSQL. Coordinates are private customer data and are never stored in Redis or a public service-worker cache. The browser must request geolocation permission only after a customer action and should allow manual address entry when permission is unavailable.

## Persistence model (step 5.2)

The versioned Prisma migrations include catalog, customer, address, cart, order, coupon, delivery pricing, refresh session, and order event records. Product media rows keep storage keys and metadata only. A catalog write must increment the singleton `CatalogRevision` row in the same transaction as the change so the API can invalidate Redis keys and ETags.

Carts keep product and option IDs, quantities, a revision, and an owner. A cart has exactly one customer ID or hashed guest token. It does not persist a trusted price; the server reprices current catalog rows. Orders snapshot items, options, totals, payment method, delivery location, coupon, and provider state. Supported states cover pending payment, confirmed, failed, and cancelled. Coupons accept 5, 10, 15, 20, 25, 30, or 50 percent.

Currency and country code are required database values rather than hardcoded defaults. Future API writes must take them from trusted server-side brand configuration, currently BRL and BR for this deployment. Customer authentication uses a normalized name plus a unique Brazilian mobile number. Access tokens are short lived; opaque refresh tokens rotate and are stored only as SHA-256 hashes. Guest checkout policy remains open before order writes are implemented. This migration does not create a payment or notification delivery model.

## White-label scope

This contract assumes one brand per deployment, matching the existing public config. If multiple brands share a database or Storage bucket, add a tenant/brand identifier to every business record and image key **before** creating those tables. Customer authentication and whether final checkout permits guests must also be chosen before customer and order writes are implemented.
