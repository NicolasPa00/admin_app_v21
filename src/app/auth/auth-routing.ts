import { Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';

/**
 * Rutas del módulo de autenticación.
 *
 * Integración en app.routes.ts:
 *   import { authRoutes } from './auth/auth-routing';
 *   { path: 'auth', children: authRoutes }
 *
 * Lazy-loading: cada componente se carga bajo demanda.
 */
export const authRoutes: Routes = [
  // El login vive en `/login` (app.routes.ts) desde el 2026-10-27. Estas dos se quedan para los
  // enlaces viejos: los correos de bienvenida y recuperación ya enviados llevan `/auth/login`.
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/register/register.component').then(
        (m) => m.RegisterComponent,
      ),
    title: 'Crear cuenta',
  },
  {
    // Vuelta desde una app de negocio (negocio_app, reserva_app…) con un código de un solo uso.
    path: 'callback',
    loadComponent: () =>
      import('./features/callback/callback.component').then(
        (m) => m.CallbackComponent,
      ),
    title: 'Volviendo al panel',
  },
  {
    // Cambio obligatorio de la contraseña temporal (la cédula). Ver CambiarPasswordComponent.
    path: 'cambiar-password',
    canActivate: [authGuard()],
    loadComponent: () =>
      import('./features/cambiar-password/cambiar-password.component').then(
        (m) => m.CambiarPasswordComponent,
      ),
    title: 'Crea tu contraseña',
  },
  {
    // Aceptación de la versión vigente de los Términos y la Política. Ver AceptarTerminosComponent.
    path: 'aceptar-terminos',
    canActivate: [authGuard()],
    loadComponent: () =>
      import('./features/aceptar-terminos/aceptar-terminos.component').then(
        (m) => m.AceptarTerminosComponent,
      ),
    title: 'Términos y tratamiento de datos',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
    title: 'Recuperar contraseña',
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
    title: 'Restablecer contraseña',
  },
];
