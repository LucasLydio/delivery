# Commerce data contract (step 5.1)

The TypeScript wire types are in [`shared/commerce-contract.ts`](../shared/commerce-contract.ts). They are the boundary between the Angular app and the Netlify API. The current sample menu in `public/app-config.json` remains available until the catalog API exists; it is **not** the future product source. `app-config.json` will retain only public white-label branding, locale, currency, and realtime settings after that migration.

## Rules

- Money sent by the API is an integer in the currency's minor units (`1250` means USD 12.50). Product and option prices, subtotals, fees, taxes, and totals use the same currency. The backend validates safe integer ranges and computes every confirmed amount from current database values. The client formats amounts for display with the configured locale and currency.
- Product and option IDs are opaque. A cart line has its own stable ID so the same product with different options can appear twice. Quantity is an integer from 1 to 99. Selected option IDs are unique within a line; the backend checks group minimums, maximums, availability, and ownership by that product.
- Catalog responses carry a version and fetch time. Product images carry a storage key and display URL; the key is the durable database value. The URL can change when the storage adapter changes.
- Customer, address, and order data belong behind authenticated or scoped API routes. They must not be placed in the public app configuration or the service worker's public cache.
- Order drafts hold snapshots of item names, selected options, prices, and delivery address once checkout behavior is defined. Payment status and final order transitions are outside this step.

## Proposed API exchange for the next steps

| Request | Response or purpose |
| --- | --- |
| `GET /api/products` | `CatalogSnapshot` (or paged equivalent), with `ETag` based on `version` |
| `GET /api/products/:id` | `CatalogProduct`, including option groups and images |
| `GET /api/me`, `PATCH /api/me` | `Customer` profile |
| `GET /api/me/addresses`, address mutations | `Address` records scoped to the customer |
| `GET /api/cart`, cart mutations | `CartDraft` and a server revision; writes may be batched |
| `POST /api/cart/quote` | `CartQuote` after validation and repricing; send the draft, catalog version, and chosen address |
| Order draft routes | `OrderDraft`; creation rules wait for checkout behavior |

## Cached cart preview

The app will keep a catalog snapshot and the user's cart selections locally. Quantity and option changes recalculate an **estimate** immediately from those cached values. This calculation is pure and makes no HTTP request; [`calculateCartPreview`](../shared/cart-preview.ts) defines its behavior. A missing product, unavailable option, invalid selection, or currency mismatch sets `needsReview`; the UI must not show its partial subtotal as a payable total.

When the product API is added, cache public catalog data in IndexedDB and use its version/`ETag` to revalidate on launch and when the installed app becomes visible after a reasonable stale interval (initial target: five minutes). The draft can remain in local storage because it contains only product IDs, option IDs, and quantities. Debounce server cart synchronization (initial target: 500 ms after edits) and reconcile with the returned revision. Do not send a request for every `+` or `−` tap. If an offline or stale preview is shown, label it as an estimate.

At checkout, make **one** quote request against current products, option rules, address, fees, and tax. If the server changes any amount or rejects an item, display the differences and require review before any future order placement. A quote expires and is not itself payment authorization. On reconnect, refresh the catalog and cart once, then recompute the preview. These are the only planned automatic refreshes; no fixed-interval cart polling is needed.

The current starter already keeps quantities in `delivery-cart` local storage and computes the preview without API calls. Its sample prices are decimals, so the transition adapter converts them to integer minor units before multiplying. The later catalog API will provide integer prices directly.

## White-label scope

This contract assumes one brand per deployment, matching the existing public config. If multiple brands share a database or Storage bucket, add a tenant/brand identifier to every business record and image key **before** creating those tables. Customer authentication and whether final checkout permits guests must also be chosen before customer and order writes are implemented.
