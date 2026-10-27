import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const authEndpoint = /^\/api\/auth\/(?:login|refresh|logout)(?:\?|$)/;
const anonymousGetEndpoint = /^\/api\/(?:products|categories)(?:[\/?]|$)/;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  if (!request.url.startsWith('/api/')) return next(request);
  const anonymousGet = request.method === 'GET' && anonymousGetEndpoint.test(request.url);
  if (anonymousGet) return next(request.clone({ withCredentials: false, headers: request.headers.delete('authorization') }));
  const failedToken = auth.accessToken();
  const authenticatedRequest = failedToken && !authEndpoint.test(request.url)
    ? request.clone({ withCredentials: true, setHeaders: { authorization: `Bearer ${failedToken}` } })
    : request.clone({ withCredentials: true });

  return next(authenticatedRequest).pipe(catchError(error => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401 || authEndpoint.test(request.url) || !failedToken) {
      return throwError(() => error);
    }
    const currentToken = auth.accessToken();
    const token = currentToken && currentToken !== failedToken
      ? Promise.resolve(currentToken)
      : auth.refreshAccessToken();
    return from(token).pipe(
      switchMap(accessToken => next(request.clone({
        withCredentials: true,
        setHeaders: { authorization: `Bearer ${accessToken}` },
      }))),
      catchError(refreshError => throwError(() => refreshError)),
    );
  }));
};

