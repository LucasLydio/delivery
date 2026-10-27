import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AdminProduct } from '../../../../../shared/commerce-contract';
import { AdminApiService } from '../../../core/admin-api.service';
import { ProductEditorComponent, parsePriceToMinor } from './product-editor.component';

registerLocaleData(localePt);

describe('parsePriceToMinor', () => {
  it('converts Brazilian decimal values to integer cents', () => {
    expect(parsePriceToMinor('29,90')).toBe(2990);
    expect(parsePriceToMinor('10')).toBe(1000);
    expect(parsePriceToMinor('0,05')).toBe(5);
  });

  it('rejects invalid or over-precise values', () => {
    expect(parsePriceToMinor('12,999')).toBeNull();
    expect(parsePriceToMinor('-1')).toBeNull();
    expect(parsePriceToMinor('produto')).toBeNull();
  });
});

describe('ProductEditorComponent accessibility', () => {
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
    optionGroups: [
      {
        id: 'group-1',
        name: 'Acompanhamentos',
        minSelections: 0,
        maxSelections: 2,
        sortOrder: 10,
        options: [
          {
            id: 'option-1',
            name: 'Batata frita',
            priceDeltaMinor: 500,
            available: true,
            sortOrder: 10,
          },
        ],
      },
    ],
  };

  let api: jasmine.SpyObj<AdminApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminApiService>('AdminApiService', ['listCategories']);
    api.listCategories.and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [ProductEditorComponent],
      providers: [provideRouter([]), { provide: AdminApiService, useValue: api }],
    }).compileComponents();
  });

  it('exposes busy, expanded and contextual action states', async () => {
    const fixture = TestBed.createComponent(ProductEditorComponent);
    fixture.detectChanges();

    const page = fixture.nativeElement.querySelector('.editor-page') as HTMLElement;
    expect(page.getAttribute('aria-busy')).toBe('true');

    await fixture.whenStable();
    fixture.componentInstance.product.set(product);
    fixture.detectChanges();

    expect(page.hasAttribute('aria-busy')).toBeFalse();

    const editGroupButton = fixture.nativeElement.querySelector(
      'button[aria-label="Editar grupo Acompanhamentos"]',
    ) as HTMLButtonElement;
    expect(editGroupButton.getAttribute('aria-controls')).toBe('option-group-editor');
    expect(editGroupButton.getAttribute('aria-expanded')).toBe('false');

    editGroupButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(editGroupButton.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('#option-group-editor')).not.toBeNull();
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('#option-group-editor input[formControlName="name"]'),
    );

    const addOptionButton = fixture.nativeElement.querySelector(
      'button[aria-label="Adicionar opção ao grupo Acompanhamentos"]',
    ) as HTMLButtonElement;
    expect(addOptionButton.getAttribute('aria-controls')).toBe('option-editor-group-1');

    const editOptionButton = fixture.nativeElement.querySelector(
      'button[aria-label="Editar opção Batata frita"]',
    ) as HTMLButtonElement;
    expect(editOptionButton.getAttribute('aria-controls')).toBe('option-editor-group-1');

    editOptionButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const optionNameInput = fixture.nativeElement.querySelector(
      '#option-editor-group-1 input[formControlName="name"]',
    ) as HTMLInputElement;
    expect(document.activeElement).toBe(optionNameInput);

    fixture.componentInstance.saving.set(true);
    fixture.detectChanges();

    expect(page.getAttribute('aria-busy')).toBe('true');
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Atualizando opção Batata frita"]'),
    ).not.toBeNull();
  });
});
