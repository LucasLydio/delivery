import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { CatalogProduct } from '../../../../shared/commerce-contract';
import { minorToMajor } from '../../../../shared/cart-preview';
import { AppConfigService } from '../../core/app-config';
import { CartService } from '../../core/cart.service';
import { CatalogService } from '../../core/catalog.service';
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
export class HomeComponent implements OnInit {
  readonly config = inject(AppConfigService);
  readonly cart = inject(CartService);
  readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  readonly query = signal('');
  readonly category = signal('all');
  readonly featured = computed(() => this.catalog.products().find(product => product.available) ?? null);
  readonly visibleMenu = computed(() => this.catalog.products().filter(item => {
    const matchesCategory = this.category() === 'all' || item.categoryId === this.category();
    const text = normalizeSearch(`${item.name} ${item.description} ${item.categoryName}`);
    return item.available && matchesCategory && text.includes(normalizeSearch(this.query().trim()));
  }));

  ngOnInit(): void { void this.catalog.load(); }
  add(item: CatalogProduct): void {
    if (item.optionGroups.some(group => group.minSelections > 0)) {
      void this.router.navigate(['/product', item.id]);
      return;
    }
    this.cart.add(item.id);
  }

  formatPrice(valueMinor: number): string {
    const { locale, currency } = this.config.config();
    return new Intl.NumberFormat(locale, { style: 'currency', currency })
      .format(minorToMajor(valueMinor, currency, locale));
  }
}
