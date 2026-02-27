import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Rutas con parámetros dinámicos → renderizar en el servidor bajo demanda (SSR),
  // no prerenderizar (requeriría getPrerenderParams).
  {
    path: 'admin/tipos-negocio/:tipoId/roles',
    renderMode: RenderMode.Server,
  },
  {
    path: 'dashboard/negocio/:tipoId',
    renderMode: RenderMode.Server,
  },
  // Resto de rutas → prerenderizar estáticamente
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
