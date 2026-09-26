import { CanActivateFn, Router }  from '@angular/router';
import { inject, PLATFORM_ID }    from '@angular/core';
import { isPlatformBrowser }      from '@angular/common';

import { AuthService }            from '../../auth/data-access/auth.service';
import { User }                   from '../../auth/models/auth.models';

/** Rol que permite ver todo, sin restricción de tipo de negocio. */
export const SUPER_ADMIN_ROL = 'SUPER ADMINISTRADOR';

/** El dueño del negocio. Es el único rol de negocio que entra a WhatsApp, Facturación y Mis pagos. */
export const ADMINISTRADOR_ROL = 'ADMINISTRADOR';

const normalizar = (rol: string): string => rol.trim().toUpperCase();

/** Todos los roles del usuario: los globales y los que tiene en cada uno de sus negocios. */
export function rolesDeUsuario(user: User | null | undefined): string[] {
  if (!user) return [];
  return [
    ...(user.roles_globales ?? []).map((r) => normalizar(r.descripcion)),
    ...(user.negocios ?? []).flatMap((n) => (n.roles ?? []).map((r) => normalizar(r.descripcion))),
  ];
}

export function esSuperAdmin(user: User | null | undefined): boolean {
  return rolesDeUsuario(user).includes(SUPER_ADMIN_ROL);
}

/**
 * ¿Es administrador? El super administrador cuenta, y quien es ADMINISTRADOR en algún negocio.
 * Cualquier otro rol (cajero, mesero, domiciliario…) solo ve Inicio y Configuración: esta es la
 * única definición, la usan el menú y los guards para que no puedan discrepar.
 */
export function esAdministrador(user: User | null | undefined): boolean {
  const roles = rolesDeUsuario(user);
  return roles.includes(SUPER_ADMIN_ROL) || roles.includes(ADMINISTRADOR_ROL);
}

/**
 * adminGuard — Protege rutas del módulo Admin.
 *
 * Reglas de acceso:
 *   1. Usuario NO autenticado → redirige a /auth/login.
 *   2. Usuario con rol "SUPER ADMINISTRADOR" → acceso completo.
 *   3. Usuario con algún rol en `allowedRoles` → acceso parcial (ve sus tipos).
 *   4. Ninguna condición satisfecha → redirige a /admin/dashboard (tiene sesión, pero no permiso).
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

    // El token vive solo en localStorage: en el servidor (SSR) nunca existe, así que este guard
    // vería "no autenticado" hasta a un usuario con sesión real y lo mandaría al login en cada
    // recarga o link directo. La seguridad real la da el backend en cada petición; aquí se deja
    // pasar el render del servidor y el chequeo real queda para el cliente ya hidratado.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return true;
    }

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

    // 2. Recopilar todos los roles del usuario (sin importar mayúsculas ni espacios)
    const userRoles = rolesDeUsuario(user);

    // 3. Super administrador: acceso sin restricción
    if (userRoles.includes(SUPER_ADMIN_ROL)) {
      return true;
    }

    // 4. Roles adicionales permitidos
    const permitted = [SUPER_ADMIN_ROL, ...allowedRoles].map(normalizar);
    if (permitted.some((role) => userRoles.includes(role))) {
      return true;
    }

    // 5. Sin acceso. Tiene sesión, así que el login no es el sitio: se le devuelve al Inicio, que
    //    sí puede ver. (Antes lo mandaba al login, y una persona con sesión rebotaba sin explicación.)
    router.navigate(['/admin/dashboard']);
    return false;
  };
}
