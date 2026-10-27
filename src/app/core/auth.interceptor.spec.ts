import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import type { CustomerSession, StaffSession } from '../../../shared/commerce-contract';
import { AdminAuthService } from './admin-auth.service';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const firstSession: CustomerSession = {
  customer: { id: 'customer-1', name: 'Ana Lima', email: null, phone: '(11) 9 8765-4321' },
  accessToken: 'expired-token',
  accessTokenExpiresAt: '2026-10-13T15:00:00.000Z',
};
const refreshedSession = { ...firstSession, accessToken: 'refreshed-token' };
const firstAdminSession: StaffSession = {
  user: {
    id: 'user-1',
    name: 'Gerente',
    email: 'gerente@loja.com.br',
    profile: 'MANAGER',
    createdAt: '2026-10-27T15:00:00.000Z',
    updatedAt: '2026-10-27T15:00:00.000Z',
  },
  accessToken: 'expired-admin-token',
  accessTokenExpiresAt: '2026-10-27T15:15:00.000Z',
};
const refreshedAdminSession = { ...firstAdminSession, accessToken: 'refreshed-admin-token' };

describe('authInterceptor', () => {
  let auth: AuthService;
  let adminAuth: AdminAuthService;
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    adminAuth = TestBed.inject(AdminAuthService);
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('refreshes once after 401 and retries with the rotated access token', fakeAsync(() => {
    void auth.login({ name: 'Ana Lima', phone: '(11) 9 8765-4321' });
    http.expectOne('/api/auth/login').flush(firstSession);
    tick();

    let result: unknown;
    client.get('/api/me').subscribe((value) => {
      result = value;
    });
    const failed = http.expectOne('/api/me');
    expect(failed.request.headers.get('authorization')).toBe('Bearer expired-token');
    failed.flush(
      { error: 'Invalid or expired access token' },
      { status: 401, statusText: 'Unauthorized' },
    );
    tick();

    http.expectOne('/api/auth/refresh').flush(refreshedSession);
    tick();
    const retried = http.expectOne('/api/me');
    expect(retried.request.headers.get('authorization')).toBe('Bearer refreshed-token');
    retried.flush(refreshedSession.customer);
    tick();
    expect(result).toEqual(refreshedSession.customer);
  }));

  it('keeps public catalog requests anonymous so shared caches can reuse them', fakeAsync(() => {
    void auth.login({ name: 'Ana Lima', phone: '(11) 9 8765-4321' });
    http.expectOne('/api/auth/login').flush(firstSession);
    tick();

    client.get('/api/products?q=prato').subscribe();
    const catalog = http.expectOne('/api/products?q=prato');
    expect(catalog.request.headers.has('authorization')).toBeFalse();
    expect(catalog.request.withCredentials).toBeFalse();
    catalog.flush({ version: '1', fetchedAt: '', currency: 'BRL', products: [] });
    tick();
  }));

  it('uses the isolated staff session for admin requests and refreshes it after 401', fakeAsync(() => {
    void adminAuth.login({ email: 'gerente@loja.com.br', password: 'Senha123!' });
    http.expectOne('/api/admin/auth/login').flush(firstAdminSession);
    tick();

    client.get('/api/admin/orders').subscribe();
    const failed = http.expectOne('/api/admin/orders');
    expect(failed.request.headers.get('authorization')).toBe('Bearer expired-admin-token');
    failed.flush(
      { error: 'Invalid or expired access token' },
      { status: 401, statusText: 'Unauthorized' },
    );
    tick();

    http.expectOne('/api/admin/auth/refresh').flush(refreshedAdminSession);
    tick();
    const retried = http.expectOne('/api/admin/orders');
    expect(retried.request.headers.get('authorization')).toBe('Bearer refreshed-admin-token');
    retried.flush({ items: [], nextCursor: null });
    tick();
  }));
});
