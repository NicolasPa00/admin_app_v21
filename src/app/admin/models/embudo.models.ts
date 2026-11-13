/**
 * Espejo de `GET /admin/estadisticas/embudo` (admin_ws · app_admin_api/services/embudoService.js).
 */
export type EtapaEmbudo = 'registrado' | 'configurado' | 'venta' | 'pago';

export type EstadoEmbudo =
  | 'en_prueba'
  | 'prueba_vencida'
  | 'cliente'
  | 'cliente_vencido'
  | 'cortesia'
  | 'baja';

export interface NegocioEmbudo {
  id_negocio: number;
  nombre: string;
  rubro: string | null;
  fecha_registro: string | null;
  etapa: EtapaEmbudo;
  estado: EstadoEmbudo;
  alerta: string | null;
  configurado: boolean;
  n_tx: number;
  tx_7d: number;
  dias_a_primera_venta: number | null;
  ultima_tx: string | null;
  dias_sin_uso: number | null;
  n_pagos: number;
  total_pagado: number;
  primer_pago: string | null;
  plan: string | null;
  plan_vence: string | null;
  dias_prueba: number | null;
}

export interface KpisEmbudo {
  registrados: number;
  configurados: number;
  pct_configurados: number;
  con_venta: number;
  pct_con_venta: number;
  venta_en_7_dias: number;
  pct_venta_en_7_dias: number;
  pagaron: number;
  pct_pagaron: number;
  mediana_dias_a_primera_venta: number | null;
  con_alerta: number;
}

export interface CohorteEmbudo {
  mes: string;
  registrados: number;
  configurados: number;
  con_venta: number;
  pagaron: number;
}

export interface Embudo {
  kpis: KpisEmbudo;
  por_estado: Partial<Record<EstadoEmbudo, number>>;
  cohortes: CohorteEmbudo[];
  negocios: NegocioEmbudo[];
}
