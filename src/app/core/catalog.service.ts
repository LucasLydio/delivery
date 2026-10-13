import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  CatalogCategory,
  CatalogProduct,
  CatalogSnapshot,
  CategorySnapshot,
} from '../../../shared/commerce-contract';

const CATALOG_CACHE_KEY = 'delivery-catalog-v1';
const CATEGORY_CACHE_KEY = 'delivery-categories-v1';

function readCache<T>(key: string, valid: (value: unknown) => boolean): T | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return valid(value) ? value as T : null;
  } catch {
    return null;
  }
}

function isCatalog(value: unknown): boolean {
  return !!value && typeof value === 'object' && Array.isArray((value as CatalogSnapshot).products);
}

function isCategories(value: unknown): boolean {
  return !!value && typeof value === 'object' && Array.isArray((value as CategorySnapshot).categories);
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private request: Promise<void> | null = null;
  private readonly cachedCatalog = readCache<CatalogSnapshot>(CATALOG_CACHE_KEY, isCatalog);
  private readonly cachedCategories = readCache<CategorySnapshot>(CATEGORY_CACHE_KEY, isCategories);

  readonly catalog = signal<CatalogSnapshot | null>(this.cachedCatalog);
  readonly categories = signal<CatalogCategory[]>(this.cachedCategories?.categories ?? []);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly offline = signal(typeof navigator !== 'undefined' && !navigator.onLine);
  readonly error = signal<string | null>(null);
  readonly usingCachedData = signal(!!this.cachedCatalog);
  readonly products = computed(() => this.catalog()?.products ?? []);

  async load(force = false): Promise<void> {
    if (this.request) return this.request;
    if (this.loaded() && !force) return;
    this.request = this.fetchCatalog().finally(() => { this.request = null; });
    return this.request;
  }

  async retry(): Promise<void> {
    await this.load(true);
  }

  async product(id: string): Promise<CatalogProduct | null> {
    const existing = this.products().find(product => product.id === id || product.slug === id);
    if (existing) return existing;
    try {
      const product = await firstValueFrom(
        this.http.get<CatalogProduct>(`/api/products/${encodeURIComponent(id)}`),
      );
      return product;
    } catch (error) {
      this.captureFailure(error);
      return null;
    }
  }

  private async fetchCatalog(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.offline.set(typeof navigator !== 'undefined' && !navigator.onLine);

    if (this.offline()) {
      this.usingCachedData.set(!!this.catalog());
      this.loaded.set(true);
      this.loading.set(false);
      return;
    }

    const [catalogResult, categoryResult] = await Promise.allSettled([
      firstValueFrom(this.http.get<CatalogSnapshot>('/api/products')),
      firstValueFrom(this.http.get<CategorySnapshot>('/api/categories')),
    ]);

    if (catalogResult.status === 'fulfilled') {
      this.catalog.set(catalogResult.value);
      localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogResult.value));
      this.usingCachedData.set(false);
    } else {
      this.captureFailure(catalogResult.reason);
      this.usingCachedData.set(!!this.catalog());
    }

    if (categoryResult.status === 'fulfilled') {
      this.categories.set(categoryResult.value.categories);
      localStorage.setItem(CATEGORY_CACHE_KEY, JSON.stringify(categoryResult.value));
    } else if (!this.categories().length && this.catalog()) {
      this.categories.set(this.deriveCategories(this.catalog()!.products));
    }

    this.loaded.set(true);
    this.loading.set(false);
  }

  private captureFailure(error: unknown): void {
    const unavailable = error instanceof HttpErrorResponse && error.status === 0;
    this.offline.set(unavailable || (typeof navigator !== 'undefined' && !navigator.onLine));
    this.error.set(this.offline()
      ? 'Sem conexão com a internet.'
      : 'Não foi possível carregar o cardápio agora.');
  }

  private deriveCategories(products: CatalogProduct[]): CatalogCategory[] {
    const values = new Map<string, CatalogCategory>();
    for (const product of products) {
      const current = values.get(product.categoryId);
      values.set(product.categoryId, {
        id: product.categoryId,
        slug: product.categoryId,
        name: product.categoryName,
        sortOrder: current?.sortOrder ?? values.size,
        availableProductCount: (current?.availableProductCount ?? 0) + Number(product.available),
      });
    }
    return [...values.values()];
  }
}
