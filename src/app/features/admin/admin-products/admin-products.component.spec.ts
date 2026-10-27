import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AdminProduct } from '../../../../../shared/commerce-contract';
import { AdminApiService } from '../../../core/admin-api.service';
import { AdminProductsComponent } from './admin-products.component';

registerLocaleData(localePt);

describe('AdminProductsComponent accessibility', () => {
  const product: AdminProduct = {
    id: 'product-1',
    slug: 'file-de-frango',
    name: 'Filé de frango',
    description: 'Prato executivo',
    categoryId: 'category-1',
    categoryName: 'Executivos',
    basePriceMinor: 2990,
    currency: 'BRL',
    available: true,
    sortOrder: 10,
    images: [],
    optionGroups: [],
  };

  let api: jasmine.SpyObj<AdminApiService>;
  let resolveProducts!: (products: AdminProduct[]) => void;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminApiService>('AdminApiService', [
      'listProducts',
      'updateProduct',
    ]);
    api.listProducts.and.returnValue(
      new Promise<AdminProduct[]>((resolve) => {
        resolveProducts = resolve;
      }),
    );

    await TestBed.configureTestingModule({
      imports: [AdminProductsComponent],
      providers: [provideRouter([]), { provide: AdminApiService, useValue: api }],
    }).compileComponents();
  });

  it('exposes busy state and contextual names for repeated product actions', async () => {
    const fixture = TestBed.createComponent(AdminProductsComponent);
    fixture.detectChanges();

    const page = fixture.nativeElement.querySelector('.products-page') as HTMLElement;
    expect(page.getAttribute('aria-busy')).toBe('true');

    resolveProducts([product]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(page.hasAttribute('aria-busy')).toBeFalse();
    expect(
      fixture.nativeElement.querySelector('a[aria-label="Editar produto Filé de frango"]'),
    ).not.toBeNull();

    const toggleButton = fixture.nativeElement.querySelector(
      'button[aria-label="Desativar produto Filé de frango"]',
    ) as HTMLButtonElement;
    expect(toggleButton).not.toBeNull();
    expect(toggleButton.disabled).toBeFalse();

    fixture.componentInstance.updatingId.set(product.id);
    fixture.detectChanges();

    expect(page.getAttribute('aria-busy')).toBe('true');
    expect(toggleButton.getAttribute('aria-label')).toBe('Atualizando produto Filé de frango');
    expect(toggleButton.disabled).toBeTrue();
  });
});
