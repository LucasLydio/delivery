import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppConfigService } from '../../core/app-config';
import { CartService } from '../../core/cart.service';
import { DishImageComponent } from '../../shared/dish-image.component';
import { demoPriceToMinor, minorToMajor } from '../../../../shared/cart-preview';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, DishImageComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css',
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  readonly config = inject(AppConfigService);
  readonly cart = inject(CartService);
  readonly quantity = signal(1);
  readonly added = signal(false);
  readonly item = computed(() => this.config.config().menu.find(item => item.id === this.route.snapshot.paramMap.get('id')) ?? null);
  readonly total = computed(() => {
    const { currency, locale } = this.config.config();
    const priceMinor = demoPriceToMinor(this.item()?.price ?? 0, currency, locale);
    return minorToMajor(priceMinor * this.quantity(), currency, locale);
  });

  increment(): void { this.quantity.update(value => Math.min(20, value + 1)); }
  decrement(): void { this.quantity.update(value => Math.max(1, value - 1)); }
  addToCart(): void {
    const item = this.item();
    if (!item) return;
    this.cart.add(item.id, this.quantity());
    this.added.set(true);
  }
  formatPrice(value: number): string {
    const { locale, currency } = this.config.config();
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  }
}
