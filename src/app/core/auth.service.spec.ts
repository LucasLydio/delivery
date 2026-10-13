import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CustomerSession } from '../../../shared/commerce-contract';
import { AuthService } from './auth.service';

const session: CustomerSession = {
  customer: { id: 'customer-1', name: 'Ana Lima', email: null, phone: '(11) 9 8765-4321' },
  accessToken: 'access-token-1',
  accessTokenExpiresAt: '2026-10-13T15:15:00.000Z',
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps the access token in memory after login', async () => {
    const result = service.login({ name: 'Ana Lima', phone: '(11) 9 8765-4321' });
    const request = http.expectOne('/api/auth/login');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.body).toEqual({ name: 'Ana Lima', phone: '(11) 9 8765-4321' });
    request.flush(session);
    await result;
    expect(service.accessToken()).toBe('access-token-1');
    expect(service.customer()).toEqual(session.customer);
    expect(service.authenticated()).toBeTrue();
  });

  it('shares one refresh request between concurrent callers', async () => {
    const first = service.refreshAccessToken();
    const second = service.refreshAccessToken();
    const requests = http.match('/api/auth/refresh');
    expect(requests.length).toBe(1);
    expect(requests[0].request.withCredentials).toBeTrue();
    requests[0].flush(session);
    expect(await first).toBe('access-token-1');
    expect(await second).toBe('access-token-1');
  });
});

