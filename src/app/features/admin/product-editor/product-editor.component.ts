import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  AdminCategory,
  AdminProduct,
  AdminProductOption,
  AdminProductOptionGroup,
} from '../../../../../shared/commerce-contract';
import { AdminApiService } from '../../../core/admin-api.service';
import { apiErrorMessage } from '../../../core/api-error';

const pricePattern = /^\d+(?:[.,]\d{1,2})?$/;

export function parsePriceToMinor(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!pricePattern.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function formatMinor(minor: number): string {
  return (minor / 100).toFixed(2).replace('.', ',');
}

@Component({
  selector: 'app-product-editor',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './product-editor.component.html',
  styleUrl: './product-editor.component.css',
})
export class ProductEditorComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly productId = this.route.snapshot.paramMap.get('id');
  readonly product = signal<AdminProduct | null>(null);
  readonly categories = signal<AdminCategory[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly editingGroupId = signal<string | null>(null);
  readonly optionGroupId = signal<string | null>(null);
  readonly editingOptionId = signal<string | null>(null);

  readonly productForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    description: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(1000)]],
    categoryId: ['', Validators.required],
    price: ['', [Validators.required, Validators.pattern(pricePattern)]],
    sortOrder: [0, [Validators.required, Validators.min(0), Validators.max(100_000)]],
  });
  readonly groupForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    minSelections: [0, [Validators.required, Validators.min(0), Validators.max(20)]],
    maxSelections: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
    sortOrder: [0, [Validators.required, Validators.min(0), Validators.max(100_000)]],
  });
  readonly optionForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    price: ['0,00', [Validators.required, Validators.pattern(pricePattern)]],
    sortOrder: [0, [Validators.required, Validators.min(0), Validators.max(100_000)]],
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [categories, product] = await Promise.all([
        this.api.listCategories(),
        this.productId ? this.api.getProduct(this.productId) : Promise.resolve(null),
      ]);
      this.categories.set(categories);
      this.product.set(product);
      if (product)
        this.productForm.setValue({
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          price: formatMinor(product.basePriceMinor),
          sortOrder: product.sortOrder,
        });
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Não foi possível carregar o editor do produto.'));
    } finally {
      this.loading.set(false);
    }
  }

  async saveProduct(): Promise<void> {
    if (this.productForm.invalid || this.saving()) {
      this.productForm.markAllAsTouched();
      return;
    }
    const raw = this.productForm.getRawValue();
    const basePriceMinor = parsePriceToMinor(raw.price);
    if (basePriceMinor === null) return;
    this.saving.set(true);
    this.clearMessages();
    try {
      const input = {
        name: raw.name,
        description: raw.description,
        categoryId: raw.categoryId,
        basePriceMinor,
        sortOrder: raw.sortOrder,
      };
      const updated = this.productId
        ? await this.api.updateProduct(this.productId, input)
        : await this.api.createProduct(input);
      this.product.set(updated);
      if (!this.productId) {
        await this.router.navigate(['/admin/products', updated.id]);
      } else {
        this.notice.set('Produto atualizado.');
      }
    } catch (error) {
      this.error.set(
        apiErrorMessage(
          error,
          'Não foi possível salvar o produto. Confira os dados e tente novamente.',
        ),
      );
    } finally {
      this.saving.set(false);
    }
  }

  newGroup(): void {
    this.editingGroupId.set('new');
    this.groupForm.reset({ name: '', minSelections: 0, maxSelections: 1, sortOrder: 0 });
  }
  editGroup(group: AdminProductOptionGroup): void {
    this.editingGroupId.set(group.id);
    this.groupForm.setValue({
      name: group.name,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      sortOrder: group.sortOrder,
    });
  }
  cancelGroup(): void {
    this.editingGroupId.set(null);
  }

  async saveGroup(): Promise<void> {
    const product = this.product();
    if (!product || this.groupForm.invalid || this.saving()) {
      this.groupForm.markAllAsTouched();
      return;
    }
    const input = this.groupForm.getRawValue();
    if (input.maxSelections < input.minSelections) {
      this.error.set('O máximo de escolhas precisa ser maior ou igual ao mínimo.');
      return;
    }
    this.saving.set(true);
    this.clearMessages();
    try {
      const groupId = this.editingGroupId();
      const updated =
        groupId && groupId !== 'new'
          ? await this.api.updateOptionGroup(groupId, input)
          : await this.api.createOptionGroup(product.id, input);
      this.product.set(updated);
      this.editingGroupId.set(null);
      this.notice.set(
        groupId === 'new' ? 'Grupo de opções criado.' : 'Grupo de opções atualizado.',
      );
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Não foi possível salvar o grupo de opções.'));
    } finally {
      this.saving.set(false);
    }
  }

  newOption(groupId: string): void {
    this.optionGroupId.set(groupId);
    this.editingOptionId.set('new');
    this.optionForm.reset({ name: '', price: '0,00', sortOrder: 0 });
  }
  editOption(groupId: string, option: AdminProductOption): void {
    this.optionGroupId.set(groupId);
    this.editingOptionId.set(option.id);
    this.optionForm.setValue({
      name: option.name,
      price: formatMinor(option.priceDeltaMinor),
      sortOrder: option.sortOrder,
    });
  }
  cancelOption(): void {
    this.optionGroupId.set(null);
    this.editingOptionId.set(null);
  }

  async saveOption(): Promise<void> {
    const groupId = this.optionGroupId();
    if (!groupId || this.optionForm.invalid || this.saving()) {
      this.optionForm.markAllAsTouched();
      return;
    }
    const raw = this.optionForm.getRawValue();
    const priceDeltaMinor = parsePriceToMinor(raw.price);
    if (priceDeltaMinor === null) return;
    this.saving.set(true);
    this.clearMessages();
    try {
      const optionId = this.editingOptionId();
      const input = { name: raw.name, priceDeltaMinor, sortOrder: raw.sortOrder };
      const updated =
        optionId && optionId !== 'new'
          ? await this.api.updateProductOption(optionId, input)
          : await this.api.createProductOption(groupId, input);
      this.product.set(updated);
      this.cancelOption();
      this.notice.set(optionId === 'new' ? 'Opção criada.' : 'Opção atualizada.');
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Não foi possível salvar a opção.'));
    } finally {
      this.saving.set(false);
    }
  }

  async toggleOption(option: AdminProductOption): Promise<void> {
    if (this.saving()) return;
    if (option.available && !window.confirm(`Desativar a opção “${option.name}”?`)) return;
    this.saving.set(true);
    this.clearMessages();
    try {
      this.product.set(
        await this.api.updateProductOption(option.id, { available: !option.available }),
      );
      this.notice.set(option.available ? 'Opção desativada.' : 'Opção reativada.');
    } catch (error) {
      this.error.set(
        apiErrorMessage(error, 'Não foi possível alterar a disponibilidade da opção.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }
}
