/**
 * Intelligence Console (F5-E) — tipos de la superficie de Observabilidad.
 *
 * Espejan tal cual lo que devuelve `admin_ws/app_admin_api/controllers/intelligenceConsolaController`.
 * Nada se calcula aquí que el backend no calcule ya: la tasa de resolución y el ratio
 * determinista vienen hechos a propósito, para que la consola y cualquier informe futuro
 * respondan **el mismo número**.
 */

/** Una fila del listado: lo justo para decidir qué conversación abrir. */
export interface ConversacionResumen {
  id_conversacion: string;
  id_negocio: number;
  negocio: string | null;
  canal: string;
  id_externo: string;
  estado: string;
  tarea_actual: string | null;
  creado_en: string;
  ultimo_mensaje_en: string | null;
  turnos: number;
  turnos_con_error: number;
  reintentos: number;
  /** `determinista` mientras no haya IA. En F6 aparecerá `llm`. */
  nivel: string | null;
  mensajes: number;
  /** En F5 siempre 0. Se muestra igual: es un resultado, no un hueco. */
  costo_usd: number | string;
}

export interface ConversacionesPage {
  conversaciones: ConversacionResumen[];
  total: number;
  limit: number;
  offset: number;
}

export interface ConversacionesFiltros {
  /** Índice abierto para que el servicio pueda recorrerlo al construir los HttpParams. */
  [clave: string]: string | number | undefined;
  id_negocio?: number | string;
  canal?: string;
  estado?: string;
  con_error?: 'true' | 'false';
  desde?: string;
  hasta?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

/** El «porqué» de una decisión: lo que la FSM registró en el Ledger. */
export interface PasoLedger {
  secuencia: number;
  tipo: string;
  decision: string | null;
  motivo: Record<string, unknown> | null;
  latencia_ms: number | null;
}

/** El «qué hizo»: una capacidad ejecutada de verdad, con sus argumentos. */
export interface InvocacionLedger {
  capacidad: string;
  vertical: string | null;
  argumentos: Record<string, unknown> | null;
  resultado: 'ok' | 'error' | 'denegado';
  error_codigo: string | null;
  dry_run: boolean;
  latencia_ms: number | null;
}

export interface TurnoLedger {
  id_turno: string;
  secuencia: number;
  nivel: string | null;
  estado: string;
  resultado: string | null;
  error_codigo: string | null;
  error_detalle: string | null;
  intentos: number;
  latencia_ms: number | null;
  creado_en: string;
  terminado_en: string | null;
  pasos: PasoLedger[];
  invocaciones: InvocacionLedger[];
  costo_usd: number | string;
}

export interface MensajeLedger {
  id_mensaje: string;
  id_turno: string | null;
  direccion: 'entrante' | 'saliente';
  canal: string;
  contenido: string;
  /** Los menús viajan aquí, nunca numerados dentro del texto (ADR-017). */
  opciones: { id: string; etiqueta: string }[] | null;
  estado_entrega: string | null;
  intentos_entrega: number | null;
  enviado_en: string | null;
  entregado_en: string | null;
  creado_en: string;
}

export interface ConversacionDetalle {
  conversacion: ConversacionResumen & {
    variables: Record<string, unknown> | null;
    tarea_datos: Record<string, unknown> | null;
    persona: string | null;
    telefono_e164: string | null;
    cerrado_en: string | null;
  };
  mensajes: MensajeLedger[];
  turnos: TurnoLedger[];
}

/** Las doce preguntas de ADR-022, hasta donde F5 puede responderlas. */
export interface Metricas {
  ventana_dias: number | null;
  conversaciones: { conversaciones: number; activas: number; negocios: number };
  turnos: {
    turnos: number;
    resueltos: number;
    con_error: number;
    handoff: number;
    deterministas: number;
    con_llm: number;
    reintentos: number;
    latencia_media_ms: number;
    latencia_p95_ms: number;
  };
  /** `null` cuando no hay turnos en la ventana: dividir por cero pinta «NaN%». */
  tasa_resolucion: number | null;
  ratio_determinista: number | null;
  capacidades: {
    capacidad: string;
    vertical: string | null;
    invocaciones: number;
    errores: number;
    latencia_media_ms: number;
  }[];
  costos: {
    id_negocio: number;
    negocio: string | null;
    modelo: string | null;
    proveedor: string | null;
    costo_usd: number | string;
    tokens_entrada: string | number;
    tokens_salida: string | number;
  }[];
  costo_total_usd: number;
}
