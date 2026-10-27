import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { AdminProduct } from '../../../../../shared/commerce-contract';
import { AdminApiService } from '../../../core/admin-api.service';
import { apiErrorMessage } from '../../../core/api-error';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

type AvailabilityFilter = 'all' | 'active' | 'disabled';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, RouterLink, ConfirmDialogComponent],
  templateUrl: './admin-products.component.html',
  styleUrl: './admin-products.component.css',
})
export class AdminProductsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly confirmDialog = viewChild.required(ConfirmDialogComponent);
  readonly products = signal<AdminProduct[]>([]);
  readonly loading = signal(true);
  readonly updatingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly search = signal('');
  readonly availability = signal<AvailabilityFilter>('all');
  readonly category = signal('all');
  readonly categories = computed(() => [
    ...new Map(
      this.products().map((product) => [product.categoryId, product.categoryName]),
    ).entries(),
  ]);
  readonly filteredProducts = computed(() => {
    const search = this.search().trim().toLocaleLowerCase('pt-BR');
    return this.products().filter((product) => {
      const matchesText =
        !search ||
        `${product.name} ${product.categoryName}`.toLocaleLowerCase('pt-BR').includes(search);
      const matchesCategory = this.category() === 'all' || product.categoryId === this.category();
      const matchesAvailability =
        this.availability() === 'all' || product.available === (this.availability() === 'active');
      return matchesText && matchesCategory && matchesAvailability;
    });
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.products.set(await this.api.listProducts());
    } catch (error) {
      this.error.set(
        apiErrorMessage(error, 'Não foi possível carregar os produtos. Tente novamente.'),
      );
    } finally {
      this.loading.set(false);
    }
  }

  async toggle(product: AdminProduct): Promise<void> {
    if (this.updatingId()) return;
    if (product.available) {
      const confirmed = await this.confirmDialog().request({
        title: 'Desativar produto?',
        message: `“${product.name}” deixará de aparecer no cardápio.`,
        confirmLabel: 'Desativar produto',
        destructive: true,
      });
      if (!confirmed) return;
    }
    this.updatingId.set(product.id);
    this.error.set(null);
    this.notice.set(null);
    try {
      const updated = await this.api.updateProduct(product.id, { available: !product.available });
      this.products.update((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      this.notice.set(updated.available ? 'Produto reativado.' : 'Produto desativado.');
    } catch (error) {
      this.error.set(
        apiErrorMessage(error, 'Não foi possível alterar a disponibilidade do produto.'),
      );
    } finally {
      this.updatingId.set(null);
    }
  }

  imageUrl(product: AdminProduct): string {
    return product.images[0]?.url ?? '/images/products/product-placeholder.webp';
  }
}
