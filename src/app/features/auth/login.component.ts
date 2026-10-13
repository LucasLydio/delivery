import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AppConfigService } from '../../core/app-config';
import { AuthService } from '../../core/auth.service';
import { formatBrazilianPhoneInput } from '../../core/phone';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly builder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly config = inject(AppConfigService);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.builder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), Validators.pattern(/^[\p{L}\s]+$/u)]],
    phone: ['', [Validators.required, Validators.pattern(/^\(\d{2}\) 9 \d{4}-\d{4}$/)]],
  });

  constructor() {
    if (this.auth.authenticated()) void this.router.navigateByUrl(this.safeReturnUrl());
  }

  formatPhone(event: Event): void {
    this.form.controls.phone.setValue(formatBrazilianPhoneInput((event.target as HTMLInputElement).value));
  }

  async submit(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    try {
      await this.auth.login(this.form.getRawValue());
      await this.router.navigateByUrl(this.safeReturnUrl());
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Não foi possível entrar. Confira seus dados e tente novamente.'));
    } finally {
      this.submitting.set(false);
    }
  }

  private safeReturnUrl(): string {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return value?.startsWith('/') && !value.startsWith('//') ? value : '/profile';
  }
}

