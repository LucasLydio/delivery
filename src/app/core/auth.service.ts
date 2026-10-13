import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import type { Customer, CustomerSession } from '../../../shared/commerce-contract';

export interface LoginInput { name: string; phone: string }
export interface UpdateCustomerInput { name?: string; phone?: string; email?: string | null }
export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly accessTokenState = signal<string | null>(null);
  private refreshPromise?: Promise<string>;
  private restorePromise?: Promise<void>;

  readonly customer = signal<Customer | null>(null);
  readonly status = signal<AuthStatus>('restoring');
  readonly authenticated = computed(() => this.status() === 'authenticated' && this.customer() !== null);

  restore(): Promise<void> {
    if (!this.restorePromise) {
      this.restorePromise = this.refreshAccessToken(5_000)
        .then(() => undefined)
        .catch(() => this.clear());
    }
    return this.restorePromise;
  }

  async login(input: LoginInput): Promise<Customer> {
    const session = await firstValueFrom(this.http.post<CustomerSession>('/api/auth/login', input, { withCredentials: true }));
    this.apply(session);
    return session.customer;
  }

  refreshAccessToken(timeoutMs?: number): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;
    const request = this.http.post<CustomerSession>('/api/auth/refresh', {}, { withCredentials: true });
    const response = timeoutMs ? request.pipe(timeout({ first: timeoutMs })) : request;
    this.refreshPromise = firstValueFrom(response)
      .then(session => { this.apply(session); return session.accessToken; })
      .catch(error => { this.clear(); throw error; })
      .finally(() => { this.refreshPromise = undefined; });
    return this.refreshPromise;
  }

  async updateCustomer(input: UpdateCustomerInput): Promise<Customer> {
    const customer = await firstValueFrom(this.http.patch<Customer>('/api/me', input, { withCredentials: true }));
    this.customer.set(customer);
    return customer;
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.delete<void>('/api/auth/logout', { withCredentials: true }));
    this.clear();
  }

  accessToken(): string | null { return this.accessTokenState(); }

  clear(): void {
    this.accessTokenState.set(null);
    this.customer.set(null);
    this.status.set('anonymous');
  }

  private apply(session: CustomerSession): void {
    this.accessTokenState.set(session.accessToken);
    this.customer.set(session.customer);
    this.status.set('authenticated');
  }
}

