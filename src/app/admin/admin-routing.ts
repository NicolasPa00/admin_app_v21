import { Routes }    from '@angular/router';
import { adminGuard, whatsappGuard } from './guards/admin.guard';
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
        //
        // Ya no tiene entrada propia en el menú: vive dentro de «WhatsApp» (ver abajo). La ruta
        // vieja redirige para no romper enlaces guardados.
        path: 'bandeja',
        redirectTo: 'whatsapp',
        pathMatch: 'full',
      },
      {
        // WhatsApp: una sola entrada. Sin número conectado enseña cómo activarlo; con número,
        // las conversaciones. `whatsapp/numero` es siempre la gestión del número.
        path: 'whatsapp',
        loadComponent: () =>
          import('./features/whatsapp/whatsapp.component').then((m) => m.WhatsappComponent),
        // Administrador, o cajero si el plan de su negocio incluye WhatsApp (2026-10-04).
        canActivate: [whatsappGuard()],
        title: 'WhatsApp',
      },
      {
        path: 'whatsapp/numero',
        loadComponent: () =>
          import('./features/canal-whatsapp/canal-whatsapp.component').then(
            (m) => m.CanalWhatsappComponent,
          ),
        canActivate: [adminGuard(['ADMINISTRADOR'])],
        title: 'Tu número de WhatsApp',
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
        // Ruta vieja: ahora es `whatsapp/numero`.
        path: 'canal-whatsapp',
        redirectTo: 'whatsapp/numero',
        pathMatch: 'full',
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
        // Terceros: lo que se les paga a OpenAI (IA) y a Meta (WhatsApp), saldo y recargas.
        // Solo super admin — esos costos son de EscalApp, no del cliente.
        path: 'terceros',
        loadComponent: () =>
          import('./features/consumo-ia/consumo-ia.component').then((m) => m.ConsumoIaComponent),
        canActivate: [adminGuard()], // solo SUPER ADMINISTRADOR
        title: 'Consumo de terceros',
      },
      {
        // Nombre con el que nació (2026-10-04), antes de sumar WhatsApp.
        path: 'consumo-ia',
        redirectTo: 'terceros',
        pathMatch: 'full',
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
        // Cartera: el libro de caja de EscalApp como empresa — lo que entra (las mensualidades
        // llegan solas), lo que sale, las comisiones de las pasarelas y el 4x1000. Solo super
        // admin: son las cuentas de los dueños, no de un inquilino.
        path: 'cartera',
        loadComponent: () =>
          import('./features/cartera/cartera.component').then((m) => m.CarteraComponent),
        canActivate: [adminGuard()], // solo SUPER ADMINISTRADOR
        title: 'Cartera',
      },
      {
        // Estadísticas: «EscalApp en números», el recorrido completo de la plataforma. Es la
        // vista que se abre delante de un interesado, y solo el super admin la ve: cruza las
        // cifras de todos los inquilinos.
        path: 'estadisticas',
        loadComponent: () =>
          import('./features/estadisticas/estadisticas.component').then(
            (m) => m.EstadisticasComponent,
          ),
        canActivate: [adminGuard()], // solo SUPER ADMINISTRADOR
        title: 'Estadísticas de la plataforma',
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
