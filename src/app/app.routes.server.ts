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
  // La compra depende de los parámetros de la URL y de dos consultas al API: no hay HTML
  // estático que valga, y el que se prerenderizaba chocaba al hidratar.
  {
    path: 'adquirir',
    renderMode: RenderMode.Client,
  },
  // Resto de rutas → prerenderizar estáticamente
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
