import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AdminCategory } from '../../../../../shared/commerce-contract';
import { AdminApiService } from '../../../core/admin-api.service';
import { apiErrorMessage } from '../../../core/api-error';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './admin-categories.component.html',
  styleUrl: './admin-categories.component.css',
})
export class AdminCategoriesComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly confirmDialog = viewChild.required(ConfirmDialogComponent);

  readonly categories = signal<AdminCategory[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly updatingId = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly activeCount = computed(
    () => this.categories().filter((category) => category.available).length,
  );
  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    sortOrder: [0, [Validators.required, Validators.min(0), Validators.max(100_000)]],
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.categories.set(await this.api.listCategories());
    } catch (error) {
      this.error.set(
        apiErrorMessage(error, 'Não foi possível carregar as categorias. Tente novamente.'),
      );
    } finally {
      this.loading.set(false);
    }
  }

  edit(category: AdminCategory): void {
    this.editingId.set(category.id);
    this.form.setValue({ name: category.name, sortOrder: category.sortOrder });
    this.notice.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', sortOrder: 0 });
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.notice.set(null);
    const input = this.form.getRawValue();
    const editingId = this.editingId();
    try {
      const category = editingId
        ? await this.api.updateCategory(editingId, input)
        : await this.api.createCategory(input);
      this.merge(category);
      this.notice.set(
        editingId ? 'Categoria atualizada.' : 'Categoria criada e disponível no cardápio.',
      );
      this.cancelEdit();
    } catch (error) {
      this.error.set(
        apiErrorMessage(
          error,
          'Não foi possível salvar a categoria. Confira os dados e tente novamente.',
        ),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async toggle(category: AdminCategory): Promise<void> {
    if (this.updatingId()) return;
    if (category.available) {
      const confirmed = await this.confirmDialog().request({
        title: 'Desativar categoria?',
        message: `Os produtos de “${category.name}” deixarão de aparecer no cardápio.`,
        confirmLabel: 'Desativar categoria',
        destructive: true,
      });
      if (!confirmed) return;
    }
    this.updatingId.set(category.id);
    this.error.set(null);
    this.notice.set(null);
    try {
      const updated = await this.api.updateCategory(category.id, {
        available: !category.available,
      });
      this.merge(updated);
      this.notice.set(updated.available ? 'Categoria reativada.' : 'Categoria desativada.');
    } catch (error) {
      this.error.set(
        apiErrorMessage(error, 'Não foi possível alterar a disponibilidade da categoria.'),
      );
    } finally {
      this.updatingId.set(null);
    }
  }

  private merge(category: AdminCategory): void {
    this.categories.update((current) => {
      const next = current.some((item) => item.id === category.id)
        ? current.map((item) => (item.id === category.id ? category : item))
        : [...current, category];
      return next.sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'pt-BR'),
      );
    });
  }
}
