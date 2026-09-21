import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EMPTY, catchError, throwError } from 'rxjs';

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
  // Portal de pagos sin sesión (/pagar). Declararlo aquí evita que un visitante con una sesión
  // vieja en el navegador reciba un logout forzado por consultar lo que debe.
  '/publico/',
];

function isPublicUrl(url: string): boolean {
  return PUBLIC_URLS.some((pub) => url.includes(pub));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  if (isPublicUrl(req.url)) {
    return next(req);
  }

  const token = authService.getAccessToken();

  // En el servidor nunca hay token, así que una llamada protegida SIEMPRE fallaría con 401 —
  // y ese error queda horneado en el HTML que el usuario ve antes de que el cliente hidrate con
  // el token real (la pantalla "nace" mostrando el error, aunque la sesión sí sea válida). No
  // vale la pena enviarla: la petición real la hace el navegador, ya con el token puesto.
  if (!isBrowser && !token) {
    return EMPTY;
  }

  const authReq = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
        withCredentials: true, // ← Permite CORS con backend HTTP
      })
    : req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // En el servidor nunca hay token (vive solo en localStorage), así que cualquier llamada
      // protegida durante el render inicial responde 401 sin que eso diga nada sobre si el
      // navegador tiene o no una sesión real. Cerrar sesión aquí sería el mismo bug del guard:
      // expulsar a un usuario autenticado en cada recarga. Se deja el cierre de sesión para
      // cuando el 401 llega de una petición real del navegador, ya hidratado.
      if (error.status === 401 && isBrowser) {
        authService.logout();
      }
      return throwError(() => error);
    }),
  );
};
