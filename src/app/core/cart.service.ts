import { computed, inject, Injectable, signal } from '@angular/core';
import { AppConfigService, MenuItem } from './app-config';
import { calculateCartPreview, demoPriceToMinor, minorToMajor } from '../../../shared/cart-preview';
import type { CartDraft, CatalogSnapshot } from '../../../shared/commerce-contract';

export interface CartLine {
  item: MenuItem;
  quantity: number;
  totalMinor: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly config = inject(AppConfigService);
  private readonly quantities = signal<Record<string, number>>(this.readStoredCart());

  readonly count = computed(() => Object.values(this.quantities()).reduce((total, quantity) => total + quantity, 0));
  private readonly demoCatalog = computed<CatalogSnapshot>(() => {
    const { menu, currency, locale } = this.config.config();
    return {
      version: 'demo-menu-v1',
      fetchedAt: new Date(0).toISOString(),
      currency,
      products: menu.map(item => ({
        id: item.id, slug: item.id, name: item.name, description: item.description,
        categoryId: item.categoryId, categoryName: item.category,
        basePriceMinor: demoPriceToMinor(item.price, currency, locale), currency,
        available: true, images: [], optionGroups: [],
      })),
    };
  });
  private readonly draft = computed<CartDraft>(() => ({
    id: null, revision: null,
    items: Object.entries(this.quantities()).map(([productId, quantity]) => ({
      id: productId, productId, quantity, selectedOptionIds: [],
    })),
  }));
  readonly preview = computed(() => calculateCartPreview(this.demoCatalog(), this.draft()));
  readonly lines = computed<CartLine[]>(() => {
    const menu = new Map(this.config.config().menu.map(item => [item.id, item]));
    const { currency, locale } = this.config.config();
    return this.preview().lines.flatMap(line => {
      const item = menu.get(line.productId);
      return item ? [{ item, quantity: line.quantity, totalMinor: line.lineTotalMinor,
        total: minorToMajor(line.lineTotalMinor, currency, locale) }] : [];
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

  add(itemId: string, amount = 1): void {
    this.set(itemId, this.quantity(itemId) + amount);
  }

  decrement(itemId: string): void {
    this.set(itemId, this.quantity(itemId) - 1);
  }

  remove(itemId: string): void {
    this.set(itemId, 0);
  }

  clear(): void {
    this.quantities.set({});
    this.persist();
  }

  private set(itemId: string, quantity: number): void {
    this.quantities.update(current => {
      const next = { ...current };
      if (quantity > 0) next[itemId] = Math.min(99, quantity);
      else delete next[itemId];
      return next;
    });
    this.persist();
  }

  private persist(): void {
    localStorage.setItem('delivery-cart', JSON.stringify(this.quantities()));
  }

  private readStoredCart(): Record<string, number> {
    try {
      const parsed = JSON.parse(localStorage.getItem('delivery-cart') ?? '{}') as Record<string, unknown>;
      return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'number' && value > 0 && value <= 99)) as Record<string, number>;
    } catch {
      return {};
    }
  }
}
