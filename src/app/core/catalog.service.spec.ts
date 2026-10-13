import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CatalogSnapshot, CategorySnapshot } from '../../../shared/commerce-contract';
import { CatalogService } from './catalog.service';

const catalog: CatalogSnapshot = {
  version: '2', fetchedAt: '2026-10-13T00:00:00.000Z', currency: 'BRL',
  products: [{
    id: 'product-1', slug: 'poke', name: 'Poke', description: 'Fresco',
    categoryId: 'category-1', categoryName: 'Pratos', basePriceMinor: 2590,
    currency: 'BRL', available: true, images: [], optionGroups: [],
  }],
};
const categories: CategorySnapshot = {
  version: '2', fetchedAt: '2026-10-13T00:00:00.000Z',
  categories: [{ id: 'category-1', slug: 'pratos', name: 'Pratos', sortOrder: 1, availableProductCount: 1 }],
};

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads and caches products and categories from the API', async () => {
    const loading = service.load();
    http.expectOne('/api/products').flush(catalog);
    http.expectOne('/api/categories').flush(categories);
    await loading;

    expect(service.products()[0].name).toBe('Poke');
    expect(service.categories()[0].name).toBe('Pratos');
    expect(service.usingCachedData()).toBeFalse();
    expect(localStorage.getItem('delivery-catalog-v1')).toContain('product-1');
  });

  it('keeps the cached catalog when the network is unavailable', async () => {
    localStorage.setItem('delivery-catalog-v1', JSON.stringify(catalog));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);

    const loading = service.load();
    http.expectOne('/api/products').error(new ProgressEvent('network'));
    http.expectOne('/api/categories').error(new ProgressEvent('network'));
    await loading;

    expect(service.products()[0].id).toBe('product-1');
    expect(service.offline()).toBeTrue();
    expect(service.usingCachedData()).toBeTrue();
  });
});
