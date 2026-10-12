import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppConfigService, MenuItem } from '../../core/app-config';
import { CartService } from '../../core/cart.service';
import { DishImageComponent } from '../../shared/dish-image.component';

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

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
  readonly category = signal('all');
  readonly categories = computed(() => [
    { id: 'all', label: 'Todas' },
    ...new Map(this.config.config().menu.map(item => [item.categoryId, { id: item.categoryId, label: item.category }])).values(),
  ]);
  readonly visibleMenu = computed(() => this.config.config().menu.filter(item => {
    const matchesCategory = this.category() === 'all' || item.categoryId === this.category();
    const text = normalizeSearch(`${item.name} ${item.description}`);
    return matchesCategory && text.includes(normalizeSearch(this.query().trim()));
  }));
  add(item: MenuItem): void {
    this.cart.add(item.id);
  }

  formatPrice(value: number): string {
    const { locale, currency } = this.config.config();
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  }

}
