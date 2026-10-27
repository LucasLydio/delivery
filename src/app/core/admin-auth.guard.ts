import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

export const adminAuthGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  await auth.restore();
  return auth.authenticated()
    ? true
    : router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
};
