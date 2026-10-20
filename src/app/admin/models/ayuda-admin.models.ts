import { CapituloTema, NivelTema, ProveedorVideo, VideoTema } from '../../ayuda/ayuda.models';

/**
 * Tipos del CRUD del Centro de ayuda (solo super admin).
 *
 * Son los de lectura pública más lo que el panel necesita y el visitante no ve: `estado`, los
 * contadores de trabajo pendiente y la lista de `capitulos` en edición. Ver
 * `admin_ws/docs/centro-de-ayuda.md`.
 */

export interface AyudaAplicativoAdmin {
  id_aplicativo: number;
  clave: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  tipo_negocio_nombre: string | null;
  orden: number;
  estado: string;
  total_modulos: number;
}

export interface AyudaModuloAdmin {
  id_modulo: number;
  id_aplicativo: number;
  clave: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  /** Rutas del frontend que caen en este módulo: es lo que resuelve el botón «?». */
  rutas: string[];
  orden: number;
  estado: string;
  total_temas: number;
}

/** Un tema en el listado del panel. */
export interface AyudaTemaLista {
  id_tema: number;
  id_modulo: number;
  clave: string;
  titulo: string;
  resumen: string | null;
  nivel: NivelTema;
  proveedor: ProveedorVideo | null;
  video_ref: string | null;
  duracion_seg: number | null;
  plan_minimo: string | null;
  requiere_flag: string | null;
  visibilidad: 'publico' | 'autenticado';
  version_grabacion: string | null;
  fecha_revision: string | null;
  orden: number;
  estado: string;
  modulo_clave: string;
  modulo_nombre: string;
  app_clave: string;
  app_nombre: string;
  total_capitulos: number;
}

/** Un tema completo en edición. `capitulos` viaja DENTRO: se guardan en la misma petición. */
export interface AyudaTemaAdmin extends AyudaTemaLista {
  cuerpo: string | null;
  palabras_clave: string[];
  miniatura_url: string | null;
  video: VideoTema | null;
  capitulos: (CapituloTema & { estado?: string })[];
}

/**
 * El panel de «qué grabar».
 *
 * `sin_resultado` es la lista más valiosa: son búsquedas de clientes reales que no encontraron
 * nada, agrupadas y contadas. Es el backlog de contenido escrito por los propios usuarios.
 */
export interface AyudaMetricas {
  dias: number;
  sin_resultado: { termino: string; veces: number; ultima: string }[];
  mas_buscado: { termino: string; veces: number }[];
  mas_visto: {
    id_tema: number;
    titulo: string;
    modulo_nombre: string;
    app_clave: string;
    vistas: number;
  }[];
  votos_negativos: {
    id_tema: number;
    titulo: string;
    modulo_nombre: string;
    app_clave: string;
    no_sirvio: number;
    sirvio: number;
  }[];
  resumen: {
    modulos_vacios?: number;
    temas_sin_video?: number;
    temas_sin_revisar?: number;
    temas_activos?: number;
  };
}

/** Un capítulo mientras se edita en el panel, antes de tener id. */
export interface CapituloEnEdicion {
  id_capitulo?: number;
  titulo: string;
  t_inicio_seg: number;
  cuerpo: string | null;
}
