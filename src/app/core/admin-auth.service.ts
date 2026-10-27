import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import type { StaffSession, StaffUser } from '../../../shared/commerce-contract';

export interface AdminLoginInput {
  email: string;
  password: string;
}
export type AdminAuthStatus = 'idle' | 'restoring' | 'anonymous' | 'authenticated';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);
  private readonly accessTokenState = signal<string | null>(null);
  private refreshPromise?: Promise<string>;
  private restorePromise?: Promise<void>;

  readonly user = signal<StaffUser | null>(null);
  readonly status = signal<AdminAuthStatus>('idle');
  readonly authenticated = computed(
    () => this.status() === 'authenticated' && this.user() !== null,
  );

  restore(): Promise<void> {
    if (this.authenticated()) return Promise.resolve();
    if (!this.restorePromise) {
      this.status.set('restoring');
      this.restorePromise = this.refreshAccessToken(5_000)
        .then(() => undefined)
        .catch(() => this.clear())
        .finally(() => {
          this.restorePromise = undefined;
        });
    }
    return this.restorePromise;
  }

  async login(input: AdminLoginInput): Promise<StaffUser> {
    const session = await firstValueFrom(
      this.http.post<StaffSession>('/api/admin/auth/login', input, { withCredentials: true }),
    );
    this.apply(session);
    return session.user;
  }

  refreshAccessToken(timeoutMs?: number): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;
    const request = this.http.post<StaffSession>(
      '/api/admin/auth/refresh',
      {},
      { withCredentials: true },
    );
    const response = timeoutMs ? request.pipe(timeout({ first: timeoutMs })) : request;
    this.refreshPromise = firstValueFrom(response)
      .then((session) => {
        this.apply(session);
        return session.accessToken;
      })
      .catch((error) => {
        this.clear();
        throw error;
      })
      .finally(() => {
        this.refreshPromise = undefined;
      });
    return this.refreshPromise;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete<void>('/api/admin/auth/logout', { withCredentials: true }),
      );
    } finally {
      this.clear();
    }
  }

  accessToken(): string | null {
    return this.accessTokenState();
  }

  clear(): void {
    this.accessTokenState.set(null);
    this.user.set(null);
    this.status.set('anonymous');
  }

  private apply(session: StaffSession): void {
    this.accessTokenState.set(session.accessToken);
    this.user.set(session.user);
    this.status.set('authenticated');
  }
}
