/**
 * Tipos del Centro de ayuda — espejo de lo que devuelve `app_ayuda_api`.
 *
 * Ver `admin_ws/docs/centro-de-ayuda.md`. Los nombres de campo van en `snake_case` porque son
 * los de la respuesta del API tal cual: renombrarlos aquí obligaría a un mapeo en cada servicio
 * y a recordar dos vocabularios para lo mismo.
 */

/** Dónde vive el video. El frontend NUNCA construye la URL: la manda resuelta el backend. */
export type ProveedorVideo = 'youtube' | 'bunny' | 'archivo';

export type NivelTema = 'basico' | 'intermedio' | 'avanzado';

/**
 * El video ya resuelto por el backend (`ayudaService.resolverVideo`).
 *
 * `embed_url` llega lista. El día que se cambie de proveedor de video, este objeto es la única
 * frontera: se toca el backend y el adaptador del reproductor, y ningún otro componente se
 * enteran.
 */
export interface VideoTema {
  proveedor: ProveedorVideo;
  ref: string;
  embed_url: string;
  miniatura: string | null;
}

/** Un paso dentro de un tema, con el segundo del video en el que empieza. */
export interface CapituloTema {
  id_capitulo: number;
  titulo: string;
  t_inicio_seg: number;
  cuerpo: string | null;
  orden: number;
}

/** Un tema tal como viaja en un listado: sin `cuerpo`, que puede ser kilobytes. */
export interface TemaResumen {
  id_tema: number;
  clave: string;
  titulo: string;
  resumen: string | null;
  nivel: NivelTema;
  proveedor: ProveedorVideo | null;
  duracion_seg: number | null;
  miniatura_url?: string | null;
  plan_minimo: string | null;
  requiere_flag: string | null;
  /** Etiqueta ya redactada por el backend («Disponible en el plan Avanzado»), o null. */
  requisito: string | null;
}

/** Un tema completo, listo para pintar. */
export interface TemaDetalle extends TemaResumen {
  cuerpo: string | null;
  palabras_clave: string[];
  visibilidad: 'publico' | 'autenticado';
  version_grabacion: string | null;
  fecha_revision: string | null;
  video: VideoTema | null;
  capitulos: CapituloTema[];
  id_modulo: number;
  modulo_clave: string;
  modulo_nombre: string;
  modulo_icono: string | null;
  id_aplicativo: number;
  app_clave: string;
  app_nombre: string;
  app_icono: string | null;
  anterior: { id_tema: number; clave: string; titulo: string } | null;
  siguiente: { id_tema: number; clave: string; titulo: string } | null;
}

export interface ModuloAyuda {
  id_modulo: number;
  clave: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  rutas: string[];
  total_temas: number;
  total_videos: number;
  temas: TemaResumen[];
}

export interface AplicativoAyuda {
  id_aplicativo: number;
  clave: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  orden: number;
  total_temas: number;
  total_videos: number;
  modulos: ModuloAyuda[];
}

/**
 * Un resultado de búsqueda. Puede ser un tema entero o un CAPÍTULO, y en ese caso trae
 * `t_inicio_seg`: el enlace lleva al segundo exacto en el que se explica eso.
 */
export interface ResultadoBusqueda {
  clase: 'tema' | 'capitulo';
  id_tema: number;
  id_capitulo: number | null;
  tema_clave: string;
  tema_titulo: string;
  modulo_clave: string;
  modulo_nombre: string;
  app_clave: string;
  app_nombre: string;
  app_icono: string | null;
  titulo: string;
  /** Con `<mark>` alrededor de lo que coincidió, cuando el resultado es un capítulo. */
  extracto: string | null;
  t_inicio_seg: number | null;
  proveedor: ProveedorVideo | null;
  duracion_seg: number | null;
  nivel: NivelTema;
  requisito: string | null;
  rango: number;
  /** La ruta canónica, armada por el backend para que salga de un solo sitio. */
  url: string;
}

export interface RespuestaBusqueda {
  termino: string;
  total: number;
  resultados: ResultadoBusqueda[];
}

/** Lo que contesta `/ayuda/contexto`: la ayuda de la vista en la que está el usuario. */
export interface ContextoAyuda {
  app: string;
  ruta: string;
  modulo: {
    id_modulo: number;
    clave: string;
    nombre: string;
    descripcion: string | null;
    icono: string | null;
    ruta_coincidente: string;
  } | null;
  url?: string;
  temas: (TemaResumen & { url: string })[];
}

/** Envoltorio estándar del backend (`app_core/helpers/respuesta.js`). */
export interface Respuesta<T> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
  errors?: unknown[];
}
