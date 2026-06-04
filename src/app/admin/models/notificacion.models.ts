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
