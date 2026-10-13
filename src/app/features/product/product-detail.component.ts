import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { CatalogProduct, ProductOption, ProductOptionGroup } from '../../../../shared/commerce-contract';
import { minorToMajor } from '../../../../shared/cart-preview';
import { AppConfigService } from '../../core/app-config';
import { CartService } from '../../core/cart.service';
import { CatalogService } from '../../core/catalog.service';
import { DishImageComponent } from '../../shared/dish-image.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, DishImageComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css',
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly config = inject(AppConfigService);
  readonly catalog = inject(CatalogService);
  readonly cart = inject(CartService);
  readonly quantity = signal(1);
  readonly added = signal(false);
  readonly loading = signal(true);
  readonly item = signal<CatalogProduct | null>(null);
  readonly selections = signal<Record<string, string[]>>({});
  readonly validSelections = computed(() => this.item()?.optionGroups.every(group => {
    const count = this.selections()[group.id]?.length ?? 0;
    return count >= group.minSelections && count <= group.maxSelections;
  }) ?? false);
  readonly totalMinor = computed(() => {
    const product = this.item();
    if (!product) return 0;
    const selected = new Set(Object.values(this.selections()).flat());
    const optionTotal = product.optionGroups.flatMap(group => group.options)
      .filter(option => selected.has(option.id)).reduce((sum, option) => sum + option.priceDeltaMinor, 0);
    return (product.basePriceMinor + optionTotal) * this.quantity();
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.catalog.load();
      this.item.set(await this.catalog.product(id));
    }
    this.loading.set(false);
  }

  increment(): void { this.quantity.update(value => Math.min(20, value + 1)); }
  decrement(): void { this.quantity.update(value => Math.max(1, value - 1)); }

  isSelected(groupId: string, optionId: string): boolean {
    return this.selections()[groupId]?.includes(optionId) ?? false;
  }

  toggleOption(group: ProductOptionGroup, option: ProductOption): void {
    if (!option.available) return;
    this.selections.update(current => {
      const selected = current[group.id] ?? [];
      let next: string[];
      if (selected.includes(option.id)) next = selected.filter(id => id !== option.id);
      else if (group.maxSelections === 1) next = [option.id];
      else if (selected.length < group.maxSelections) next = [...selected, option.id];
      else return current;
      return { ...current, [group.id]: next };
    });
    this.added.set(false);
  }

  addToCart(): void {
    const product = this.item();
    if (!product || !this.validSelections()) return;
    this.cart.add(product.id, this.quantity(), Object.values(this.selections()).flat());
    this.added.set(true);
  }

  formatPrice(valueMinor: number): string {
    const { locale, currency } = this.config.config();
    return new Intl.NumberFormat(locale, { style: 'currency', currency })
      .format(minorToMajor(valueMinor, currency, locale));
  }
}
