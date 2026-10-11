import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppConfigService, MenuItem } from '../../core/app-config';
import { CartService } from '../../core/cart.service';
import { DishImageComponent } from '../../shared/dish-image.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, RouterLink, DishImageComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  readonly config = inject(AppConfigService);
  readonly cart = inject(CartService);
  readonly query = signal('');
  readonly category = signal('All');
  readonly categories = computed(() => ['All', ...new Set(this.config.config().menu.map(item => item.category))]);
  readonly visibleMenu = computed(() => this.config.config().menu.filter(item => {
    const matchesCategory = this.category() === 'All' || item.category === this.category();
    const text = `${item.name} ${item.description}`.toLowerCase();
    return matchesCategory && text.includes(this.query().trim().toLowerCase());
  }));
  add(item: MenuItem): void {
    this.cart.add(item.id);
  }

  formatPrice(value: number): string {
    const { locale, currency } = this.config.config();
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  }

}
