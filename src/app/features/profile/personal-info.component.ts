import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { formatBrazilianPhoneInput } from '../../core/phone';

@Component({
  selector: 'app-personal-info',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './personal-info.component.html',
  styleUrl: './personal-info.component.css',
})
export class PersonalInfoComponent {
  private readonly builder = inject(FormBuilder);
  readonly auth = inject(AuthService);
  readonly saved = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  private readonly current = this.auth.customer();
  readonly form = this.builder.nonNullable.group({
    name: [
      this.current?.name ?? '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(80),
        Validators.pattern(/^[\p{L}\s]+$/u),
      ],
    ],
    email: [this.current?.email ?? '', [Validators.email, Validators.maxLength(254)]],
    phone: [
      this.current?.phone ?? '',
      [Validators.required, Validators.pattern(/^\(\d{2}\) 9 \d{4}-\d{4}$/)],
    ],
  });

  initials(): string {
    return this.form.controls.name.value
      .split(/\s+/)
      .slice(0, 2)
      .map((value) => value[0])
      .join('')
      .toUpperCase();
  }

  formatPhone(event: Event): void {
    this.form.controls.phone.setValue(
      formatBrazilianPhoneInput((event.target as HTMLInputElement).value),
    );
  }

  async save(): Promise<void> {
    this.saved.set(false);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    try {
      await this.auth.updateCustomer({
        name: value.name,
        phone: value.phone,
        email: value.email.trim() || null,
      });
      this.saved.set(true);
      this.form.markAsPristine();
    } catch (error) {
      this.error.set(
        apiErrorMessage(error, 'Não foi possível salvar seus dados. Tente novamente.'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
