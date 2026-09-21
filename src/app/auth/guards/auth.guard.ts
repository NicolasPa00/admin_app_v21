import { CanActivateFn, Router } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { AuthService } from '../data-access/auth.service';

/**
 * Guard funcional que protege rutas autenticadas.
 *
 * Uso básico (cualquier usuario autenticado):
 *   canActivate: [authGuard()]
 *
 * Uso con roles (solo admin o manager):
 *   canActivate: [authGuard(['admin', 'manager'])]
 *
 * Si el usuario no está autenticado o no tiene el rol requerido,
 * se redirige a /auth/login.
 *
 * @param allowedRoles — Roles permitidos. Si no se proporcionan,
 *                        cualquier usuario autenticado tiene acceso.
 */
export function authGuard(allowedRoles?: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // El token vive solo en localStorage, que no existe durante el render en el servidor.
    // Si el guard evaluara aquí, SIEMPRE vería "no autenticado" — así tenga sesión real el
    // navegador — y una recarga (F5) o un link directo devolverían al login sin aviso. La
    // seguridad real la sigue dando el backend en cada petición (JWT + rol); aquí solo se deja
    // pasar el render del servidor y se deja el chequeo real al cliente, ya hidratado.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return true;
    }

    // ¿Está autenticado?
    if (!authService.isAuthenticated()) {
      router.navigate(['/auth/login']);
      return false;
    }

    // ¿Tiene un rol permitido?
    if (allowedRoles && allowedRoles.length > 0) {
      const user = authService.currentUser();
      if (!user) {
        router.navigate(['/auth/login']);
        return false;
      }
      // Recopilar todas las descripciones de rol (globales + por negocio)
      const allRoles = [
        ...user.roles_globales.map((r) => r.descripcion),
        ...user.negocios.flatMap((n) => n.roles.map((r) => r.descripcion)),
      ];
      if (!allowedRoles.some((role) => allRoles.includes(role))) {
        router.navigate(['/auth/login']);
        return false;
      }
    }

    return true;
  };
}
