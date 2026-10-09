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

/** Rol de caja en un negocio. Ya no abre WhatsApp aquí; ver `veWhatsapp`. */
export const CAJERO_ROL = 'CAJERO';
/** La feature del plan que trae WhatsApp (ver `intelligence/core/features.js`). */
export const FEATURE_WHATSAPP_PLAN = 'asistente_ia';

/**
 * ¿Ve la vista de WhatsApp de ESTE panel? **Solo el super administrador** (2026-10-08).
 *
 * Hasta esa fecha entraban también el ADMINISTRADOR del negocio y su CAJERO, porque la Bandeja
 * del asistente vivía aquí y era el único sitio donde se podía contestar. Ya no: la Bandeja está
 * en `negocio_app` (`/conversaciones`), que es donde vive la operación del inquilino, y allá
 * los permisos salen de `gener_nivel` como los de cualquier otra vista.
 *
 * Lo que queda aquí es otra cosa con la misma pantalla: **seguimiento interno**. Un super admin
 * mira a la vez todos los inquilinos —qué conversaciones escalan, cómo se está portando el
 * asistente, qué negocios lo están usando— y eso es trabajo nuestro, no del cliente.
 *
 * El backend no cambió ni hacía falta: `/intelligence/bandeja/*` siempre acotó por
 * `alcanceDeNegocios()`, que para un super admin es «todos» y para cualquier otro «los suyos».
 * Este guard decide qué puerta se ofrece, no a qué datos se llega.
 */
export function veWhatsapp(user: User | null | undefined): boolean {
  return esSuperAdmin(user);
}

/** Protege `/admin/whatsapp` con `veWhatsapp`. Misma forma que `adminGuard`. */
export function whatsappGuard(): CanActivateFn {
  return () => {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
    const authService = inject(AuthService);
    const router = inject(Router);
    if (!authService.isAuthenticated() || !authService.currentUser()) {
      router.navigate(['/auth/login']);
      return false;
    }
    if (veWhatsapp(authService.currentUser())) return true;
    router.navigate(['/admin/dashboard']);
    return false;
  };
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
