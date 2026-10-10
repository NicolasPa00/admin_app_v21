/**
 * Cartera — el libro de caja de EscalApp (super admin). Contrato de `/admin/cartera/*`
 * (admin_ws · docs/cartera.md).
 */

export type TipoMovimiento = 'ingreso' | 'egreso' | 'transferencia';
export type OrigenMovimiento = 'manual' | 'cobranza' | 'recarga_ia';
export type TipoCuenta = 'banco' | 'pasarela' | 'billetera' | 'efectivo' | 'tarjeta';

export interface CuentaCartera {
  id_cuenta: number;
  codigo: string | null;
  nombre: string;
  tipo: TipoCuenta;
  moneda: string;
  aplica_gmf: boolean;
  /** A qué pasarela está atada (recibe sus cobros). No se puede desactivar. */
  pasarela: string | null;
  saldo_inicial: number;
  fecha_saldo: string | null;
  nota: string | null;
  estado: 'A' | 'I';
  orden: number;
}

export interface CategoriaCartera {
  id_categoria: number;
  codigo: string;
  nombre: string;
  tipo: 'ingreso' | 'egreso';
  /** La llena la plataforma sola (mensualidades, IA): no se puede desactivar. */
  sistema: boolean;
  estado: 'A' | 'I';
}

export interface TarifaPasarela {
  pasarela: string;
  nombre: string;
  porcentaje: number;
  fijo: number;
  fijo_moneda: 'COP' | 'USD';
  iva_pct: number;
  retencion_pct: number;
  nota: string | null;
}

export interface CatalogosCartera {
  cuentas: CuentaCartera[];
  categorias: CategoriaCartera[];
  tarifas: TarifaPasarela[];
  trm: { valor: number; vigente_desde: string } | null;
  tasa_gmf: number;
}

export interface MovimientoCartera {
  id_movimiento: number;
  tipo: TipoMovimiento;
  fecha: string;
  id_categoria: number | null;
  categoria: string | null;
  id_cuenta: number;
  cuenta: string;
  id_cuenta_destino: number | null;
  cuenta_destino: string | null;
  tercero: string | null;
  id_negocio: number | null;
  negocio: string | null;
  descripcion: string | null;
  soporte: string | null;
  moneda: string;
  monto: number;
  tasa_cop: number | null;
  /** null = falta la tasa: se ve pero no suma. */
  monto_cop: number | null;
  comision: number;
  iva_comision: number;
  retencion: number;
  iva: number;
  gmf: number;
  exento_gmf: boolean;
  estimado: boolean;
  origen: OrigenMovimiento;
  referencia_factura: string | null;
  estado: 'A' | 'E';
  motivo_anulacion: string | null;
}

/** Lo que se manda al crear o editar. */
export interface MovimientoInput {
  tipo: TipoMovimiento;
  fecha: string;
  id_cuenta: number | null;
  id_cuenta_destino: number | null;
  id_categoria: number | null;
  tercero: string | null;
  descripcion: string | null;
  soporte: string | null;
  moneda: string;
  monto: number | null;
  tasa_cop: number | null;
  comision: number | null;
  iva_comision: number | null;
  retencion: number | null;
  iva: number | null;
  /** null = que lo calcule el servidor desde la cuenta. */
  gmf: number | null;
  exento_gmf: boolean;
}

export interface CifrasCartera {
  ingresos: number;
  egresos: number;
  comisiones_pasarela: number;
  comisiones_bancarias: number;
  iva_comisiones: number;
  comisiones: number;
  gmf: number;
  gmf_deducible: number;
  retenciones: number;
  iva_compras: number;
  resultado: number;
  caja_neta: number;
  margen: number | null;
  n_ingresos: number;
  n_egresos: number;
  estimados: number;
  sin_tasa: number;
}

export interface TotalCategoria {
  id_categoria: number;
  nombre: string;
  total: number;
  movimientos: number;
}

export interface MesCartera {
  mes: string;
  ingresos: number;
  egresos: number;
  costos_financieros: number;
  retenciones: number;
  resultado: number;
}

export interface ResumenCartera {
  rango: { desde: string; hasta: string };
  cifras: CifrasCartera;
  ingresos_por_categoria: TotalCategoria[];
  egresos_por_categoria: TotalCategoria[];
  ingresos_por_tercero: { tercero: string; total: number; movimientos: number }[];
  por_mes: MesCartera[];
  cuentas: { id_cuenta: number; nombre: string; tipo: TipoCuenta; aplica_gmf: boolean; estado: 'A' | 'I'; saldo: number }[];
  saldo_total: number;
  por_cobrar: { total: number; facturas: number; negocios: number };
  sincronizacion: { mensualidades: number; recargas: number; anulados: number };
}

export interface FiltrosCartera {
  desde: string;
  hasta: string;
  tipo?: TipoMovimiento | '';
  id_cuenta?: number | null;
  id_categoria?: number | null;
  origen?: OrigenMovimiento | '';
  q?: string;
  anulados?: boolean;
}
