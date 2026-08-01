/**
 * Modelos de la Ficha 360 — `platform.persona_negocio`.
 *
 * Ojo con el vocabulario: la entidad es **Persona**, no "Cliente". ADR-006 descartó
 * `CustomerRoot` precisamente porque el humano no siempre es cliente (puede ser un lead
 * o un no-show). "Ficha 360 del Cliente" es el nombre de producto que se muestra al
 * usuario; el modelo de dominio se llama persona.
 */

/** Fila del listado: identidad + resumen mínimo para pintar la tabla. */
export interface PersonaResumen {
  id_persona_negocio: string;
  id_negocio: number;
  negocio: string;
  nombre_mostrado: string | null;
  telefono_e164: string | null;
  creado_en: string;
  pedidos: number;
  total_gastado: string;
  ultimo_pedido: string | null;
}

export interface PersonasPage {
  personas: PersonaResumen[];
  total: number;
  limit: number;
  offset: number;
}

export interface PersonaDetalle {
  id_persona_negocio: string;
  id_negocio: number;
  negocio: string;
  /**
   * FK al nivel global `platform.persona`. Hoy es SIEMPRE null y es correcto que lo sea:
   * el nivel global se modela pero no se puebla hasta que exista el Portal del Cliente
   * (ADR-006, ADR-025). No es un dato que falte.
   */
  id_persona: string | null;
  nombre_mostrado: string | null;
  telefono_e164: string | null;
  notas: string | null;
  etiquetas: string[];
  consentimiento_mensajeria: boolean;
  creado_en: string;
}

export interface ActividadRestaurante {
  pedidos: number;
  pedidos_pagados: number;
  total_gastado: string;
  ticket_promedio: string;
  primer_pedido: string | null;
  ultimo_pedido: string | null;
}

/**
 * Actividad por vertical. Hoy solo `restaurante` aporta datos: la medición del
 * 2026-07-31 confirmó que gym, parqueadero, tienda y reserva están vacías en
 * producción. Las demás llegan en `null` — la ficha debe distinguir "sin actividad"
 * de "esta vertical todavía no se agrega".
 */
export interface ActividadPersona {
  restaurante: ActividadRestaurante | null;
  reserva: null;
  gym: null;
  parqueadero: null;
  tienda: null;
}

export interface PedidoResumen {
  id_orden: number;
  numero_orden: string;
  fecha_creacion: string;
  total: string;
  estado: string;
  estado_pago: string;
  tipo_pedido: string;
}

export interface Ficha360 {
  persona: PersonaDetalle;
  actividad: ActividadPersona;
  ultimos_pedidos: PedidoResumen[];
}

export interface PersonasFiltros {
  id_negocio?: number | null;
  q?: string;
  limit?: number;
  offset?: number;
}
