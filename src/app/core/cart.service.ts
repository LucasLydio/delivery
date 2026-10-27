import { computed, inject, Injectable, signal } from '@angular/core';
import { AppConfigService } from './app-config';
import { CatalogService } from './catalog.service';
import { calculateCartPreview, minorToMajor } from '../../../shared/cart-preview';
import type { CartDraft, CatalogSnapshot } from '../../../shared/commerce-contract';
import type { CatalogProduct } from '../../../shared/commerce-contract';

export interface CartLine {
  item: CatalogProduct;
  quantity: number;
  totalMinor: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly config = inject(AppConfigService);
  private readonly catalog = inject(CatalogService);
  private readonly quantities = signal<Record<string, number>>(this.readStoredCart());
  private readonly selectedOptions = signal<Record<string, string[]>>(this.readStoredOptions());

  readonly count = computed(() =>
    Object.values(this.quantities()).reduce((total, quantity) => total + quantity, 0),
  );
  private readonly activeCatalog = computed<CatalogSnapshot>(
    () =>
      this.catalog.catalog() ?? {
        version: 'unavailable',
        fetchedAt: new Date(0).toISOString(),
        currency: this.config.config().currency,
        products: [],
      },
  );
  private readonly draft = computed<CartDraft>(() => ({
    id: null,
    revision: null,
    items: Object.entries(this.quantities()).map(([productId, quantity]) => ({
      id: productId,
      productId,
      quantity,
      selectedOptionIds: this.selectedOptions()[productId] ?? [],
    })),
  }));
  readonly preview = computed(() => calculateCartPreview(this.activeCatalog(), this.draft()));
  readonly lines = computed<CartLine[]>(() => {
    const menu = new Map(this.catalog.products().map((item) => [item.id, item]));
    const { currency, locale } = this.config.config();
    return this.preview().lines.flatMap((line) => {
      const item = menu.get(line.productId);
      return item
        ? [
            {
              item,
              quantity: line.quantity,
              totalMinor: line.lineTotalMinor,
              total: minorToMajor(line.lineTotalMinor, currency, locale),
            },
          ]
        : [];
    });
  });
  readonly subtotalMinor = computed(() => this.preview().subtotalMinor);
  readonly subtotal = computed(() => {
    const { currency, locale } = this.config.config();
    return minorToMajor(this.subtotalMinor(), currency, locale);
  });

  quantity(itemId: string): number {
    return this.quantities()[itemId] ?? 0;
  }

  add(itemId: string, amount = 1, selectedOptionIds?: string[]): void {
    if (selectedOptionIds)
      this.selectedOptions.update((current) => ({ ...current, [itemId]: selectedOptionIds }));
    this.set(itemId, this.quantity(itemId) + amount);
  }

  decrement(itemId: string): void {
    this.set(itemId, this.quantity(itemId) - 1);
  }

  remove(itemId: string): void {
    this.selectedOptions.update((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
    this.set(itemId, 0);
  }

  clear(): void {
    this.quantities.set({});
    this.selectedOptions.set({});
    this.persist();
  }

  private set(itemId: string, quantity: number): void {
    if (quantity <= 0) {
      this.selectedOptions.update((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    }
    this.quantities.update((current) => {
      const next = { ...current };
      if (quantity > 0) next[itemId] = Math.min(99, quantity);
      else delete next[itemId];
      return next;
    });
    this.persist();
  }

  private persist(): void {
    localStorage.setItem('delivery-cart', JSON.stringify(this.quantities()));
    localStorage.setItem('delivery-cart-options', JSON.stringify(this.selectedOptions()));
  }

  private readStoredCart(): Record<string, number> {
    try {
      const parsed = JSON.parse(localStorage.getItem('delivery-cart') ?? '{}') as Record<
        string,
        unknown
      >;
      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([, value]) => typeof value === 'number' && value > 0 && value <= 99,
        ),
      ) as Record<string, number>;
    } catch {
      return {};
    }
  }

  private readStoredOptions(): Record<string, string[]> {
    try {
      const parsed = JSON.parse(localStorage.getItem('delivery-cart-options') ?? '{}') as Record<
        string,
        unknown
      >;
      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([, value]) =>
            Array.isArray(value) && value.every((option) => typeof option === 'string'),
        ),
      ) as Record<string, string[]>;
    } catch {
      return {};
    }
  }
}
