import { Routes } from '@angular/router';

/**
 * Rutas del Centro de ayuda — **públicas**, hermanas de `/terminos` y `/pagar`.
 *
 * Ver `admin_ws/docs/centro-de-ayuda.md`. No van bajo `/admin` a propósito: ahí estarían detrás
 * de `adminGuard` y en `RenderMode.Client`, y las dos cosas son fatales para esto. La ayuda hace
 * más falta cuando NO se puede entrar (contraseña olvidada, prueba vencida, plan caducado), y
 * una página pública se prerenderiza y se indexa.
 *
 * El orden importa: `buscar` e `ir` van ANTES de `:app`, o `/ayuda/buscar` se interpretaría como
 * el aplicativo llamado «buscar».
 */
export const ayudaRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./ayuda-shell.component').then((m) => m.AyudaShellComponent),
    children: [
      {
        path: 'buscar',
        loadComponent: () =>
          import('./ayuda-buscar.component').then((m) => m.AyudaBuscarComponent),
        title: 'Buscar en el centro de ayuda — EscalApp',
      },
      {
        // La puerta de la ayuda contextual: a donde apunta el botón «?» de cada vertical. Resuelve
        // ruta → módulo contra el API y redirige. Ver `ayuda-ir.component.ts`.
        path: 'ir',
        loadComponent: () => import('./ayuda-ir.component').then((m) => m.AyudaIrComponent),
        title: 'Ayuda — EscalApp',
      },
      {
        // Los tres niveles del catálogo los atiende un solo componente: es una misma superficie
        // con tres profundidades y el catálogo ya está cacheado entre ellas.
        path: '',
        loadComponent: () =>
          import('./ayuda-explorar.component').then((m) => m.AyudaExplorarComponent),
        title: 'Centro de ayuda — EscalApp',
      },
      {
        path: ':app',
        loadComponent: () =>
          import('./ayuda-explorar.component').then((m) => m.AyudaExplorarComponent),
        title: 'Tutoriales — Centro de ayuda de EscalApp',
      },
      {
        path: ':app/:modulo',
        loadComponent: () =>
          import('./ayuda-explorar.component').then((m) => m.AyudaExplorarComponent),
        title: 'Tutoriales — Centro de ayuda de EscalApp',
      },
      {
        path: ':app/:modulo/:tema',
        loadComponent: () =>
          import('./ayuda-tema.component').then((m) => m.AyudaTemaComponent),
        title: 'Tutorial — Centro de ayuda de EscalApp',
      },
    ],
  },
];
