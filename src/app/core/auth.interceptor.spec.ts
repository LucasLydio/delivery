import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import type { CustomerSession } from '../../../shared/commerce-contract';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const firstSession: CustomerSession = {
  customer: { id: 'customer-1', name: 'Ana Lima', email: null, phone: '(11) 9 8765-4321' },
  accessToken: 'expired-token', accessTokenExpiresAt: '2026-10-13T15:00:00.000Z',
};
const refreshedSession = { ...firstSession, accessToken: 'refreshed-token' };

describe('authInterceptor', () => {
  let auth: AuthService;
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('refreshes once after 401 and retries with the rotated access token', fakeAsync(() => {
    void auth.login({ name: 'Ana Lima', phone: '(11) 9 8765-4321' });
    http.expectOne('/api/auth/login').flush(firstSession);
    tick();

    let result: unknown;
    client.get('/api/me').subscribe(value => { result = value; });
    const failed = http.expectOne('/api/me');
    expect(failed.request.headers.get('authorization')).toBe('Bearer expired-token');
    failed.flush({ error: 'Invalid or expired access token' }, { status: 401, statusText: 'Unauthorized' });
    tick();

    http.expectOne('/api/auth/refresh').flush(refreshedSession);
    tick();
    const retried = http.expectOne('/api/me');
    expect(retried.request.headers.get('authorization')).toBe('Bearer refreshed-token');
    retried.flush(refreshedSession.customer);
    tick();
    expect(result).toEqual(refreshedSession.customer);
  }));
});

