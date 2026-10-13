import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppConfigService } from '../../core/app-config';
import { CartService } from '../../core/cart.service';
import { DishImageComponent } from '../../shared/dish-image.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, DishImageComponent],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
})
export class CartComponent {
  readonly cart = inject(CartService);
  readonly config = inject(AppConfigService);
  readonly cutlery = signal(0);
  readonly checkoutMessage = signal<string | null>(null);

  addCutlery(): void { this.cutlery.update(value => value + 1); }
  removeCutlery(): void { this.cutlery.update(value => Math.max(0, value - 1)); }

  formatPrice(value: number): string {
    const { locale, currency } = this.config.config();
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  }

  checkout(): void {
    this.checkoutMessage.set('Este pedido é uma prévia. Em breve você poderá finalizar a compra.');
  }
}
