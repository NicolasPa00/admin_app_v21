import { Routes }    from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from '../auth/guards/auth.guard';

/**
 * Rutas del módulo Admin.
 *
 * Integración en app.routes.ts:
 *   import { adminRoutes } from './admin/admin-routing';
 *   { path: 'admin', children: adminRoutes }
 *
 * Rutas disponibles:
 *   /admin/dashboard               → AdminDashboardComponent
 *   /dashboard/negocio/:tipoId     → placeholder (reemplazar con el módulo de negocio)
 */
export const adminRoutes: Routes = [
  {
    // Shell con sidebar + header; envuelve todas las vistas de /admin.
    path: '',
    loadComponent: () =>
      import('./layout/admin-layout.component').then(
        (m) => m.AdminLayoutComponent,
      ),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
        canActivate: [authGuard()],
        title: 'Panel de administración',
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./features/usuarios/usuarios.component').then(
            (m) => m.UsuariosComponent,
          ),
        canActivate: [adminGuard()], // solo SUPER ADMINISTRADOR
        title: 'Usuarios del sistema',
      },
      {
        path: 'negocios',
        loadComponent: () =>
          import('./features/negocios/negocios.component').then(
            (m) => m.NegociosComponent,
          ),
        canActivate: [adminGuard()], // solo SUPER ADMINISTRADOR
        title: 'Negocios',
      },
      {
        path: 'registrar',
        loadComponent: () =>
          import('./features/registrar/registrar.component').then(
            (m) => m.RegistrarComponent,
          ),
        canActivate: [adminGuard()], // solo SUPER ADMINISTRADOR
        title: 'Tipos de negocio',
      },
      {
        path: 'personas',
        loadComponent: () =>
          import('./features/personas/personas.component').then(
            (m) => m.PersonasComponent,
          ),
        canActivate: [adminGuard()], // solo SUPER ADMINISTRADOR
        title: 'Ficha 360',
      },
      {
        // Bandeja: las conversaciones del asistente para el DUEÑO del negocio, con respuesta
        // humana. A diferencia de la Consola, no es de super admin — el alcance lo decide el
        // backend cruzando el usuario del token contra sus negocios.
        path: 'bandeja',
        loadComponent: () =>
          import('./features/bandeja/bandeja.component').then((m) => m.BandejaComponent),
        canActivate: [adminGuard(['ADMINISTRADOR'])],
        title: 'Conversaciones',
      },
      {
        // Datos fiscales (FE-1). NO es de super admin: es la pantalla del DUEÑO del negocio,
        // que es quien conoce su RUT y quien declara si su negocio está registrado.
        path: 'facturacion',
        loadComponent: () =>
          import('./features/facturacion/facturacion.component').then(
            (m) => m.FacturacionComponent,
          ),
        canActivate: [adminGuard(['ADMINISTRADOR'])],
        title: 'Facturación electrónica',
      },
      {
        // Intelligence Console (F5-E): la Observabilidad del asistente, solo lectura.
        path: 'intelligence',
        loadComponent: () =>
          import('./features/intelligence/intelligence.component').then(
            (m) => m.IntelligenceComponent,
          ),
        canActivate: [adminGuard()], // solo SUPER ADMINISTRADOR
        title: 'Intelligence',
      },
      {
        path: 'auditoria',
        loadComponent: () =>
          import('./features/auditoria/auditoria.component').then(
            (m) => m.AuditoriaComponent,
          ),
        canActivate: [adminGuard()], // solo SUPER ADMINISTRADOR
        title: 'Auditoría',
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./features/configuracion/configuracion.component').then(
            (m) => m.ConfiguracionComponent,
          ),
        canActivate: [authGuard()],
        title: 'Configuración',
      },
      {
        path: 'tipos-negocio/:tipoId/roles',
        // TODO: Reemplazar con el componente real de detalle de roles
        loadComponent: () =>
          import('./features/admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
        canActivate: [adminGuard()],
        title: 'Roles del tipo de negocio',
      },
    ],
  },
];
