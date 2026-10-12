/** JSON contracts shared by the Angular app and the Netlify API.
 * Amounts are integer minor currency units (cents for USD); timestamps are ISO 8601 UTC.
 * IDs and catalog versions are opaque strings. Never derive a payable amount from browser data.
 */
export type MinorAmount = number;

export interface BrandConfig {
  brandName: string;
  tagline: string;
  accentColor: string;
  currency: string;
  locale: string;
  realtimeUrl: string | null;
}

export interface ProductImage {
  key: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface ProductOption {
  id: string;
  name: string;
  priceDeltaMinor: MinorAmount;
  available: boolean;
}

export interface ProductOptionGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: ProductOption[];
}

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  basePriceMinor: MinorAmount;
  currency: string;
  available: boolean;
  images: ProductImage[];
  optionGroups: ProductOptionGroup[];
}

/** The cached copy is used for instant previews; version changes invalidate its prices. */
export interface CatalogSnapshot {
  version: string;
  fetchedAt: string;
  currency: string;
  products: CatalogProduct[];
}

export interface CartItemInput {
  /** Stable client-generated ID distinguishes two lines with different choices. */
  id: string;
  productId: string;
  quantity: number;
  selectedOptionIds: string[];
}

/** Persist only selections locally. Cached catalog data supplies preview prices. */
export interface CartDraft {
  id: string | null;
  revision: string | null;
  items: CartItemInput[];
}

export interface CartPreviewLine {
  itemId: string;
  productId: string;
  name: string;
  quantity: number;
  selectedOptions: { id: string; name: string; priceDeltaMinor: MinorAmount }[];
  unitPriceMinor: MinorAmount;
  lineTotalMinor: MinorAmount;
}

export interface CartPreview {
  kind: 'estimate';
  catalogVersion: string;
  currency: string;
  lines: CartPreviewLine[];
  subtotalMinor: MinorAmount;
  /** Missing/unavailable items or invalid options require a fresh catalog before checkout. */
  needsReview: boolean;
}

/** Returned by the server after repricing and validating a draft. */
export interface CartQuote {
  kind: 'confirmed';
  cartRevision: string;
  currency: string;
  lines: CartPreviewLine[];
  subtotalMinor: MinorAmount;
  deliveryFeeMinor: MinorAmount;
  taxMinor: MinorAmount;
  totalMinor: MinorAmount;
  expiresAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface Address {
  id: string;
  customerId: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  countryCode: string;
  deliveryInstructions: string | null;
  isDefault: boolean;
}

/** Order creation and payable states will be finalized with checkout behavior. */
export interface OrderDraft {
  id: string;
  status: 'draft';
  customerId: string | null;
  currency: string;
  items: CartPreviewLine[];
  deliveryAddress: Omit<Address, 'id' | 'customerId' | 'isDefault'> | null;
  subtotalMinor: MinorAmount;
  createdAt: string;
  updatedAt: string;
}
