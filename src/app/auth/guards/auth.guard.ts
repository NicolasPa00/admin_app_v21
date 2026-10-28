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
 * se redirige a /login.
 *
 * @param allowedRoles — Roles permitidos. Si no se proporcionan,
 *                        cualquier usuario autenticado tiene acceso.
 */
export function authGuard(allowedRoles?: string[]): CanActivateFn {
  return (_route, state) => {
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
      router.navigate(['/login']);
      return false;
    }

    // Con la contraseña temporal (la cédula) solo se puede ir a cambiarla: el backend tampoco
    // deja hacer nada más (403 DEBE_CAMBIAR_PASSWORD).
    // Después, aceptar la versión vigente de los Términos y la Política (salvo entrando como otro
    // usuario: un super admin no acepta por nadie). AuthService.destinoTrasEntrar ordena las dos.
    const destino = authService.destinoTrasEntrar();
    if (destino !== '/admin/dashboard' && !state.url.startsWith(destino)) {
      router.navigate([destino]);
      return false;
    }

    // ¿Tiene un rol permitido?
    if (allowedRoles && allowedRoles.length > 0) {
      const user = authService.currentUser();
      if (!user) {
        router.navigate(['/login']);
        return false;
      }
      // Recopilar todas las descripciones de rol (globales + por negocio)
      const allRoles = [
        ...user.roles_globales.map((r) => r.descripcion),
        ...user.negocios.flatMap((n) => n.roles.map((r) => r.descripcion)),
      ];
      if (!allowedRoles.some((role) => allRoles.includes(role))) {
        router.navigate(['/login']);
        return false;
      }
    }

    return true;
  };
}
