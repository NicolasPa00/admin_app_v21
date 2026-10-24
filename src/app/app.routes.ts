import { Routes } from '@angular/router';

import { authRoutes } from './auth/auth-routing';
import { adminRoutes } from './admin/admin-routing';
import { ayudaRoutes } from './ayuda/ayuda-routing';
import { adminGuard } from './admin/guards/admin.guard';

export const routes: Routes = [
  // Landing page pública
  {
    path: '',
    loadComponent: () => import('./landing/landing.component').then((m) => m.LandingComponent),
    pathMatch: 'full',
    // SIN `title` a propósito: lo pone `SeoService` desde el componente, junto al resto de los
    // metadatos. El `title` de la ruta lo aplica el router DESPUÉS de que el componente se
    // construya, así que tenerlo en los dos sitios no es redundancia — es el de la ruta pisando
    // al del servicio, que es justo lo que pasaba: la página salía con el titular viejo y con la
    // descripción nueva. `DefaultTitleStrategy` no toca el título cuando la ruta no lo declara.
  },

  // La página del motor de restaurante. Sin `title` por el mismo motivo que la de arriba: lo pone
  // `SeoService` en el constructor del componente, que es lo que exige el prerender.
  {
    path: 'restaurantes',
    loadComponent: () =>
      import('./landing/restaurantes/restaurantes.component').then((m) => m.RestaurantesComponent),
  },

  // Documentos legales públicos — SIN guardia a propósito: quien quiere ejercer sus derechos
  // como titular de datos no tiene por qué tener cuenta, y una política de privacidad que exige
  // iniciar sesión para leerla no cumple su función. Se prerenderizan como estáticas.
  {
    path: 'terminos',
    loadComponent: () => import('./legal/legal-page.component').then((m) => m.LegalPageComponent),
    data: { documento: 'terminos' },
    title: 'Términos y Condiciones — EscalApp',
  },
  {
    path: 'privacidad',
    loadComponent: () => import('./legal/legal-page.component').then((m) => m.LegalPageComponent),
    data: { documento: 'privacidad' },
    title: 'Política de Tratamiento de Datos — EscalApp',
  },
  {
    // Meta exige una URL de instrucciones de eliminación de datos para publicar la app, y es un
    // campo distinto del de la política de privacidad. La ruta es propia por eso, y porque quien
    // busca borrar sus datos no debería tener que leerse una política entera para encontrarlo.
    path: 'eliminacion-datos',
    loadComponent: () => import('./legal/legal-page.component').then((m) => m.LegalPageComponent),
    data: { documento: 'eliminacion' },
    title: 'Cómo eliminar tus datos — EscalApp',
  },

  // Compra de un plan — SIN guardia: quien compra todavía no tiene cuenta. La vista crea el
  // usuario y el negocio (apagados) y los enciende cuando la pasarela confirma el pago.
  // Es una ruta y no un modal porque a mitad del flujo el visitante se va al checkout de la
  // pasarela: la vuelta tiene que ser una URL con la referencia.
  {
    path: 'adquirir',
    loadComponent: () =>
      import('./adquirir/adquirir-page.component').then((m) => m.AdquirirPageComponent),
    title: 'Adquiere tu plan — EscalApp',
  },

  // Portal de pagos — SIN guardia a propósito: exigir login para pagar es la forma más eficaz de
  // que no paguen. Con el número de identificación del administrador se consulta y se paga.
  // Se prerenderiza como estática; los datos llegan después, desde el navegador.
  {
    path: 'pagar',
    loadComponent: () => import('./pagos/pagar-page.component').then((m) => m.PagarPageComponent),
    title: 'Paga tu mensualidad — EscalApp',
  },

  // Centro de ayuda. Está DISEÑADO para ser público —la ayuda hace más falta justo cuando no se
  // puede entrar: contraseña olvidada, prueba vencida, plan caducado— pero se estrena cerrado al
  // equipo de EscalApp mientras el catálogo esté a medio grabar: un centro con tres tutoriales y
  // treinta y nueve módulos vacíos enseña que no hay nada, y eso es peor que no enseñar nada.
  //
  // Para abrirlo al público hay que deshacer TRES cosas, y están juntas a propósito:
  //   1. este `canActivate`,
  //   2. las rutas de lectura en `PUBLIC_URLS` del `authInterceptor` (volver a declararlas),
  //   3. `AYUDA_PUBLICA=true` en el `.env` del servidor (eso es lo único que no se despliega).
  // Está escrito en `admin_ws/docs/centro-de-ayuda.md`, sección «Cómo se abre al público».
  { path: 'ayuda', canActivate: [adminGuard()], children: ayudaRoutes },

  // Módulo de autenticación — /auth/login, /auth/register, etc.
  { path: 'auth', children: authRoutes },

  // Módulo Admin — /admin/dashboard, /admin/tipos-negocio/:id/roles
  { path: 'admin', children: adminRoutes },

  // Alias: redirigir /dashboard → /admin/dashboard
  { path: 'dashboard', redirectTo: 'admin/dashboard', pathMatch: 'full' },

  // Ruta de negocio (placeholder hasta crear el módulo de detalle)
  {
    path: 'dashboard/negocio/:tipoId',
    loadComponent: () =>
      import('./admin/features/admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent,
      ),
    title: 'Detalle del negocio',
  },

  // Ruta raíz → landing
  { path: '', redirectTo: '', pathMatch: 'full' },

  // Wildcard — redirige rutas desconocidas a la landing
  { path: '**', redirectTo: '' },
];
