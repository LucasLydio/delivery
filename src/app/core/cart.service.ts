import { computed, inject, Injectable, signal } from '@angular/core';
import { AppConfigService, MenuItem } from './app-config';

export interface CartLine {
  item: MenuItem;
  quantity: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly config = inject(AppConfigService);
  private readonly quantities = signal<Record<string, number>>(this.readStoredCart());

  readonly count = computed(() => Object.values(this.quantities()).reduce((total, quantity) => total + quantity, 0));
  readonly lines = computed<CartLine[]>(() => this.config.config().menu
    .map(item => ({ item, quantity: this.quantities()[item.id] ?? 0 }))
    .filter(line => line.quantity > 0)
    .map(line => ({ ...line, total: line.item.price * line.quantity })));
  readonly subtotal = computed(() => this.lines().reduce((total, line) => total + line.total, 0));

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
