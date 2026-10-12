import type { CartDraft, CartPreview, CartPreviewLine, CatalogSnapshot } from './commerce-contract';

/** Calculates an estimate from one cached catalog snapshot without making a request. */
export function calculateCartPreview(catalog: CatalogSnapshot, draft: CartDraft): CartPreview {
  const products = new Map(catalog.products.map(product => [product.id, product]));
  const lines: CartPreview['lines'] = [];
  let subtotalMinor = 0;
  let needsReview = false;

  for (const item of draft.items) {
    const product = products.get(item.productId);
    if (!product || !product.available || product.currency !== catalog.currency ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      needsReview = true;
      continue;
    }

    const selected = new Set(item.selectedOptionIds);
    if (selected.size !== item.selectedOptionIds.length) {
      needsReview = true;
      continue;
    }

    let optionTotalMinor = 0;
    let validOptions = true;
    const selectedOptions: CartPreviewLine['selectedOptions'] = [];
    for (const group of product.optionGroups) {
      const chosen = group.options.filter(option => selected.has(option.id));
      if (chosen.length < group.minSelections || chosen.length > group.maxSelections ||
          chosen.some(option => !option.available)) validOptions = false;
      for (const option of chosen) {
        selected.delete(option.id);
        optionTotalMinor += option.priceDeltaMinor;
        selectedOptions.push({ id: option.id, name: option.name, priceDeltaMinor: option.priceDeltaMinor });
      }
    }

    const unitPriceMinor = product.basePriceMinor + optionTotalMinor;
    const lineTotalMinor = unitPriceMinor * item.quantity;
    if (!validOptions || selected.size > 0 || !Number.isSafeInteger(unitPriceMinor) ||
        unitPriceMinor < 0 || !Number.isSafeInteger(lineTotalMinor) ||
        !Number.isSafeInteger(subtotalMinor + lineTotalMinor)) {
      needsReview = true;
      continue;
    }

    lines.push({ itemId: item.id, productId: product.id, name: product.name,
      quantity: item.quantity, selectedOptions, unitPriceMinor, lineTotalMinor });
    subtotalMinor += lineTotalMinor;
  }

  return { kind: 'estimate', catalogVersion: catalog.version, currency: catalog.currency,
    lines, subtotalMinor, needsReview };
}

/** Converts legacy demo decimal prices to minor units. API prices already use integers. */
export function demoPriceToMinor(price: number, currency: string, locale: string): number {
  const fractionDigits = new Intl.NumberFormat(locale, { style: 'currency', currency })
    .resolvedOptions().maximumFractionDigits ?? 2;
  return Math.round(price * 10 ** fractionDigits);
}

export function minorToMajor(amountMinor: number, currency: string, locale: string): number {
  const fractionDigits = new Intl.NumberFormat(locale, { style: 'currency', currency })
    .resolvedOptions().maximumFractionDigits ?? 2;
  return amountMinor / 10 ** fractionDigits;
}
