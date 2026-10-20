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
  // El callback de SSO vive del `?code=` de la URL y solo hace algo en el navegador.
  {
    path: 'auth/callback',
    renderMode: RenderMode.Client,
  },
  // La compra depende de los parámetros de la URL y de dos consultas al API: no hay HTML
  // estático que valga, y el que se prerenderizaba chocaba al hidratar.
  {
    path: 'adquirir',
    renderMode: RenderMode.Client,
  },
  // El panel es privado y cada pantalla depende de la sesión, que el servidor no tiene: al
  // prerenderizar, las consultas fallaban y el HTML salía armado con la vista equivocada
  // (WhatsApp mostraba una bandeja vacía que el primer clic reemplazaba). Solo en el navegador.
  {
    path: 'admin',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/**',
    renderMode: RenderMode.Client,
  },
  // ── Centro de ayuda ───────────────────────────────────────────────────────────────────────
  //
  // `Client`, y conviene dejar escrito por qué, porque la tentación es `Prerender`: la página es
  // pública y se querría indexada.
  //
  // El problema es cómo se despliega esta app. Solo se sube `dist/.../browser` a Caddy como
  // estático; el `server/` que genera el build NO se despliega, así que `Server` no existe como
  // opción —no hay Node delante— y `Prerender` **hornea el contenido en el momento del build**.
  // Con un catálogo que el super admin edita desde `/admin/ayuda`, eso significaría que publicar
  // un tutorial exige recompilar y volver a subir el frontend. Justamente lo que el panel existe
  // para evitar.
  //
  // Además `:app/:modulo/:tema` son rutas con parámetros: prerenderizarlas pediría un
  // `getPrerenderParams` que consulte el API durante el build, atando la compilación a que la
  // base de datos esté accesible.
  //
  // Así que el SEO queda pendiente y es una decisión consciente, no un olvido. Lo que sí se gana
  // ya —y es el motivo de fondo para que esto sea público— es que se lee SIN sesión: con la
  // contraseña olvidada, la prueba vencida o el plan caducado, que es cuando más falta hace.
  // Cuando el contenido se estabilice se puede prerenderizar la portada y los temas más vistos
  // con `getPrerenderParams`, sin mover nada de lo demás.
  {
    path: 'ayuda',
    renderMode: RenderMode.Client,
  },
  {
    path: 'ayuda/**',
    renderMode: RenderMode.Client,
  },
  // Resto de rutas → prerenderizar estáticamente
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
