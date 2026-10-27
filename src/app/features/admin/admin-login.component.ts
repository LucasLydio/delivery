import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuthService } from '../../core/admin-auth.service';
import { apiErrorMessage } from '../../core/api-error';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css',
})
export class AdminLoginComponent implements OnInit {
  private readonly builder = inject(FormBuilder);
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly restoring = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.builder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  async ngOnInit(): Promise<void> {
    await this.auth.restore();
    this.restoring.set(false);
    if (this.auth.authenticated()) await this.router.navigateByUrl(this.safeReturnUrl());
  }

  async submit(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    try {
      await this.auth.login(this.form.getRawValue());
      await this.router.navigateByUrl(this.safeReturnUrl());
    } catch (error) {
      this.error.set(
        apiErrorMessage(error, 'Não foi possível entrar. Confira o e-mail e a senha.'),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  private safeReturnUrl(): string {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return value?.startsWith('/admin') && value !== '/admin/login' && !value.startsWith('//')
      ? value
      : '/admin/orders';
  }
}
