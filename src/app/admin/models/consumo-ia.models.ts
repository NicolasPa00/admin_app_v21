/**
 * Contrato de `GET /admin/consumo-ia` (admin_ws: consumoIaController).
 *
 * Todos los importes en USD. Los días son días UTC, como los cuenta OpenAI.
 */

export type VentanaConsumo = 7 | 30 | 90;
export type TipoMovimientoIa = 'SALDO' | 'RECARGA';

export interface SaldoIa {
  saldo_partida: number;
  fecha_partida: string;
  recargas_posteriores: number;
  gasto_desde_partida: number;
  saldo_estimado: number;
  promedio_diario_7d: number;
  dias_restantes: number | null;
}

export interface MovimientoIa {
  id_recarga: number;
  tipo: TipoMovimientoIa;
  monto_usd: number;
  fecha: string;
  nota: string | null;
  creado_en?: string;
  registrado_por?: string | null;
}

export interface PuntoConsumo {
  fecha: string;
  /** null cuando OpenAI no contestó. */
  oficial: number | null;
  interno: number;
}

export interface ConsumoNegocio {
  id_negocio: number;
  negocio: string | null;
  costo_usd: number;
  llamadas: number;
  conversaciones: number;
  costo_por_conversacion: number;
}

export interface ConsumoModelo {
  proveedor: string;
  modelo: string;
  costo_usd: number;
  llamadas: number;
  tokens_entrada: number;
  tokens_salida: number;
  tokens_cache_lectura: number;
}

export interface ConsumoIa {
  periodo: { dias: VentanaConsumo; desde: string; hasta: string };
  fuente_saldo: 'oficial' | 'interno';
  aviso_oficial: { code: string; mensaje: string } | null;
  consultado_en: string | null;
  saldo: SaldoIa | null;
  promedio_diario_7d: number;
  resumen: {
    hoy: number;
    mes: number;
    periodo_oficial: number | null;
    periodo_interno: number;
    proyeccion_mes: number;
  };
  serie: PuntoConsumo[];
  por_concepto: Array<{ concepto: string; usd: number }>;
  por_negocio: ConsumoNegocio[];
  por_modelo: ConsumoModelo[];
  conversaciones: { con_ia: number; costo_promedio: number };
  turnos: { total: number; con_ia: number; sin_ia: number; humano: number };
  movimientos: MovimientoIa[];
}

export interface NuevoMovimientoIa {
  tipo: TipoMovimientoIa;
  monto_usd: number;
  /** `yyyy-MM-ddTHH:mm` en hora de Colombia, o vacío para «ahora». */
  fecha?: string | null;
  nota?: string | null;
}
