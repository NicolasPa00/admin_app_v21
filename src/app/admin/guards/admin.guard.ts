import { CanActivateFn, Router } from '@angular/router';
import { inject }                from '@angular/core';

import { AuthService }           from '../../auth/data-access/auth.service';

/** Rol que permite ver todo, sin restricción de tipo de negocio. */
export const SUPER_ADMIN_ROL = 'SUPER ADMINISTRADOR';

/**
 * adminGuard — Protege rutas del módulo Admin.
 *
 * Reglas de acceso:
 *   1. Usuario NO autenticado → redirige a /auth/login.
 *   2. Usuario con rol "SUPER ADMINISTRADOR" → acceso completo.
 *   3. Usuario con algún rol en `allowedRoles` → acceso parcial (ve sus tipos).
 *   4. Ninguna condición satisfecha → redirige a /auth/login.
 *
 * @param allowedRoles  Lista de roles adicionales que pueden acceder.
 *                      Si se omite, solo SUPER ADMINISTRADOR tiene acceso.
 *
 * Uso en rutas:
 *   canActivate: [adminGuard()]                         // solo super admin
 *   canActivate: [adminGuard(['ADMINISTRADOR RESTAURANTE', 'CAJERO RESTAURANTE'])]
 */
export function adminGuard(allowedRoles: string[] = []): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router      = inject(Router);

    // 1. Verificar autenticación
    if (!authService.isAuthenticated()) {
      router.navigate(['/auth/login']);
      return false;
    }

    const user = authService.currentUser();
    if (!user) {
      router.navigate(['/auth/login']);
      return false;
    }

    // 2. Recopilar todos los roles del usuario
    const userRoles = [
      ...user.roles_globales.map((r) => r.descripcion),
      ...user.negocios.flatMap((n) => n.roles.map((r) => r.descripcion)),
    ];

    // 3. Super administrador: acceso sin restricción
    if (userRoles.includes(SUPER_ADMIN_ROL)) {
      return true;
    }

    // 4. Roles adicionales permitidos
    const permitted = [SUPER_ADMIN_ROL, ...allowedRoles];
    if (permitted.some((role) => userRoles.includes(role))) {
      return true;
    }

    // 5. Sin acceso
    router.navigate(['/auth/login']);
    return false;
  };
}
