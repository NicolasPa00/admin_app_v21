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
        // Conectar WhatsApp (F8-D). Tampoco es de super admin: quien decide si conserva su
        // número o lo dejamos gestionado por EscalApp es el dueño del negocio.
        path: 'canal-whatsapp',
        loadComponent: () =>
          import('./features/canal-whatsapp/canal-whatsapp.component').then(
            (m) => m.CanalWhatsappComponent,
          ),
        canActivate: [adminGuard(['ADMINISTRADOR'])],
        title: 'Conectar WhatsApp',
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
        // Mis pagos: la mensualidad vista por el DUEÑO del negocio. No es de super admin — el
        // backend decide qué negocios le enseña cruzando el token con sus roles.
        path: 'mis-pagos',
        loadComponent: () =>
          import('./features/mis-pagos/mis-pagos.component').then((m) => m.MisPagosComponent),
        canActivate: [adminGuard(['ADMINISTRADOR'])],
        title: 'Mis pagos',
      },
      {
        // Cobranza: lo que nos pagan los inquilinos. Solo super admin — aquí se confirma
        // dinero y se extiende el acceso de un cliente.
        path: 'cobranza',
        loadComponent: () =>
          import('./features/cobranza/cobranza.component').then((m) => m.CobranzaComponent),
        canActivate: [adminGuard()], // solo SUPER ADMINISTRADOR
        title: 'Cobranza',
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
