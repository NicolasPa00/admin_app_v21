import { Routes } from '@angular/router';

import { authRoutes } from './auth/auth-routing';
import { adminRoutes } from './admin/admin-routing';

export const routes: Routes = [
  // Landing page pública
  {
    path: '',
    loadComponent: () => import('./landing/landing.component').then((m) => m.LandingComponent),
    pathMatch: 'full',
    title: 'EscalApp — Centraliza y escala tu negocio',
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
