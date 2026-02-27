import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

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
