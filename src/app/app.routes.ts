import { Routes } from '@angular/router';

import { authRoutes } from './auth/auth-routing';

export const routes: Routes = [
  // Módulo de autenticación — /auth/login, /auth/register, etc.
  { path: 'auth', children: authRoutes },

  // Redirigir raíz a login (ajustar a /dashboard cuando exista)
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },

  // Wildcard — redirige rutas desconocidas
  { path: '**', redirectTo: 'auth/login' },
];
