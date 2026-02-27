import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../data-access/auth.service';

/**
 * Interceptor funcional de autenticación.
 *
 * 1. Adjunta `Authorization: Bearer <token>` a peticiones protegidas.
 * 2. En 401 llama a logout() y propaga el error (sin refresh — el JWT dura 24h).
 */

const PUBLIC_URLS = [
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
];

function isPublicUrl(url: string): boolean {
  return PUBLIC_URLS.some((pub) => url.includes(pub));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  if (isPublicUrl(req.url)) {
    return next(req);
  }

  const token = authService.getAccessToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        authService.logout();
      }
      return throwError(() => error);
    }),
  );
};
