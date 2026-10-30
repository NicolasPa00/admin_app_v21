/** Lo que el asistente sabe y no está en la base: visitas, capacitación, promociones, preguntas. */
export type TipoConocimiento = 'servicio' | 'promocion' | 'pregunta' | 'dato';

export interface EntradaConocimiento {
  id_conocimiento: number;
  tipo: TipoConocimiento;
  titulo: string;
  contenido: string;
  palabras_clave: string | null;
  /** `YYYY-MM-DD`. Obligatoria en las promociones: vencida, el asistente deja de verla. */
  vigente_hasta: string | null;
  activo: boolean;
  orden: number;
  vencida: boolean;
  fecha_actualizacion: string;
}

export type DatosConocimiento = Pick<
  EntradaConocimiento,
  'tipo' | 'titulo' | 'contenido' | 'palabras_clave' | 'vigente_hasta' | 'activo' | 'orden'
>;

export interface ConfigAsistenteEscalapp {
  correos_aviso: string[];
  url_sitio: string;
  fecha_actualizacion: string | null;
}

export interface ResumenAsistenteEscalapp {
  negocio: { id_negocio: number; nombre: string };
  /** `null` = el número todavía no está conectado a este negocio. */
  numero: { numero_e164: string | null; estado: 'A' | 'I' } | null;
  config: ConfigAsistenteEscalapp;
  cifras: {
    conversaciones_7d: number;
    esperando: number;
    conocimiento_vigente: number;
    conocimiento_total: number;
  };
}
