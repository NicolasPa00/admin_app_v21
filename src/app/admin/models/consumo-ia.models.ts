/**
 * Contrato de `GET /admin/consumo-ia` (admin_ws: consumoIaController) — vista «Terceros».
 *
 * Lo de OpenAI va en USD y en días UTC (como los cuenta OpenAI). Lo de WhatsApp (`whatsapp`)
 * va en la moneda de cada cuenta de Meta (COP hoy) y en días de Colombia. `terceros` junta las
 * dos en pesos con la TRM del día.
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
  whatsapp: ConsumoWhatsapp | null;
  aviso_whatsapp: { code: string; mensaje: string } | null;
  trm: { valor: number; vigente_desde: string } | null;
  terceros: {
    openai_mes_usd: number;
    openai_mes_cop: number | null;
    whatsapp_mes_cop: number | null;
    total_mes_cop: number | null;
  };
}

/** Quién le paga a Meta: la cuenta de EscalApp o la del propio cliente (Embedded Signup). */
export type PagadorWhatsapp = 'escalapp' | 'cliente';

export interface NumeroWhatsapp {
  /** Enmascarado: `+57 ··· 8196`. */
  telefono: string;
  id_negocio: number | null;
  negocio: string | null;
  mensajes_mes: number;
  /** Mensajes de servicio del mes: los que gastan la asignación gratis. */
  servicio_mes: number;
  cobrados_mes: number;
  costo_mes: number;
  gratis_limite: number;
}

export interface CuentaWhatsapp {
  nombre: string;
  paga: PagadorWhatsapp;
  id_negocio: number | null;
  moneda: string | null;
  error: string | null;
  mensajes_periodo: number;
  costo_periodo: number;
  mensajes_mes: number;
  costo_mes: number;
  numeros: NumeroWhatsapp[];
  por_categoria: Array<{ categoria: string; tipo: string; mensajes: number; costo: number }>;
}

export interface ConsumoWhatsapp {
  consultado_en: string;
  cuentas: CuentaWhatsapp[];
  serie: Array<{ fecha: string; escalapp: number; clientes: number }>;
  totales: {
    mensajes_periodo: number;
    costo_escalapp_mes_cop: number;
    costo_escalapp_periodo_cop: number;
    costo_clientes_mes_cop: number;
    moneda_sin_convertir: boolean;
  };
}

export interface NuevoMovimientoIa {
  tipo: TipoMovimientoIa;
  monto_usd: number;
  /** `yyyy-MM-ddTHH:mm` en hora de Colombia, o vacío para «ahora». */
  fecha?: string | null;
  nota?: string | null;
}
