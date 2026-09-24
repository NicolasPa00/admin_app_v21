export interface Notificacion {
  id_notificacion: number;
  id_negocio: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha_creacion: string;
  fecha_lectura: string | null;
}

export interface NotificacionesResponse {
  success: boolean;
  data: Notificacion[];
}

export interface ContadorNoLeidasResponse {
  success: boolean;
  data: { total: number };
}

/** Una conversación que espera a una persona (escalada y sin atender). Se deriva al leer. */
export interface ConversacionEsperando {
  id_conversacion: string;
  id_negocio: number;
  negocio: string | null;
  persona: string | null;
  telefono_e164: string | null;
  id_externo: string;
  ultimo_mensaje_en: string;
  ultimo_texto: string | null;
}

export interface EsperandoRespuesta {
  /** Cuántas hay en total; `conversaciones` trae solo las más recientes. */
  total: number;
  conversaciones: ConversacionEsperando[];
}

export interface EsperandoRespuestaResponse {
  success: boolean;
  data: EsperandoRespuesta;
}
