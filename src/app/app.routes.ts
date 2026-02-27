import { Routes } from '@angular/router';

import { authRoutes }  from './auth/auth-routing';
import { adminRoutes } from './admin/admin-routing';

export const routes: Routes = [
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

  // Ruta raíz → login
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },

  // Wildcard — redirige rutas desconocidas
  { path: '**', redirectTo: 'auth/login' },
];
