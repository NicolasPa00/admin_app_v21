/**
 * Modelos de Cobranza — el cobro de NUESTRAS mensualidades.
 *
 * Espejo de `cobranza.*` en admin_ws. Ver `admin_ws/docs/cobro-mensualidades.md`.
 *
 * ⚠️ Los importes viajan como **string** (son DECIMAL en PostgreSQL). Se tipan como
 * `string | number` a propósito, para que nadie los sume sin pasarlos por `Number()`.
 */

import { PlanConVencimiento } from '../../core/utils/estado-plan';

export type EstadoSuscripcion = 'trial' | 'activa' | 'en_gracia' | 'suspendida' | 'cancelada';
export type EstadoFactura = 'pendiente' | 'pagada' | 'fallida' | 'anulada';
export type CicloCobro = 'mensual' | 'anual';

/** Una fila de la cartera: un negocio, cómo paga y cuánto debe. */
export interface FilaCartera {
  id_suscripcion: number;
  id_negocio: number;
  negocio: string;
  email_contacto: string | null;
  id_plan: number;
  plan: string;
  ciclo: CicloCobro;
  moneda: string;
  pasarela: string;
  estado: EstadoSuscripcion;
  proximo_cobro: string | null;
  es_retenedor: boolean;
  /** Hasta cuándo tiene acceso, según general.gener_negocio_plan. */
  plan_hasta: string | null;
  facturas_pendientes: number;
  deuda: string | number;
  pendiente_desde: string | null;
}

export interface Factura {
  id_factura: number;
  id_suscripcion: number;
  id_negocio: number;
  referencia: string;
  periodo_inicio: string;
  periodo_fin: string;
  moneda: string;
  subtotal: string | number;
  impuestos: string | number;
  total: string | number;
  estado: EstadoFactura;
  pasarela: string;
  fecha_pago: string | null;
  comision_pasarela: string | number;
  retencion_declarada: string | number;
  neto_recibido: string | number | null;
  medio_pago_texto: string | null;
  numero_factura: string | null;
  cufe: string | null;
  nota: string | null;
}

export interface Suscripcion {
  id_suscripcion: number;
  id_negocio: number;
  id_plan: number;
  ciclo: CicloCobro;
  moneda: string;
  pasarela: string;
  estado: EstadoSuscripcion;
  proximo_cobro: string | null;
  dia_cobro: number | null;
  reintentos: number;
  es_retenedor: boolean;
  notas: string | null;
}

export interface PasarelaDisponible {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  monedas: string[];
  soporta_recurrente: boolean;
}

/** Lo que devuelve GET /cobranza/mi-suscripcion. */
export interface ResumenCobro {
  suscripcion: Suscripcion | null;
  /** null cuando no hay precio configurado para esa moneda (el caso de Chile hasta fijarlo). */
  precio: number | null;
  facturas: Factura[];
  pasarelas: PasarelaDisponible[];
  pais: string;
}

/**
 * Ingresos de un mes. `facturado` y `neto` van separados porque su diferencia son las
 * comisiones y las retenciones — lo que descuadra el banco.
 */
export interface IngresoMes {
  mes: string;
  pagadas: number;
  pendientes: number;
  facturado: string | number;
  neto: string | number;
  comisiones: string | number;
  retenciones: string | number;
}

/**
 * El desenlace de cobrar por pasarela.
 *
 * `pendiente` **no es un fallo**: con un checkout alojado (dLocal) significa que el cobro está
 * creado y el cliente tiene que pagarlo en `urlPago`. Tratarlo como éxito sería dar por cobrado
 * lo que nadie ha pagado.
 */
export interface CobroResultado {
  estado: 'aprobada' | 'pendiente' | 'rechazada';
  factura: Factura;
  urlPago: string | null;
  mensaje?: string | null;
}

// ── Pagos del cliente (Mis pagos y portal público /pagar) ─────────────────────────────

export type CodigoPasarela = 'manual' | 'dlocal' | 'wompi';

export interface FacturaPendiente {
  id_factura?: number; // no viaja en el portal público: allí se paga por referencia
  referencia: string;
  periodo_inicio: string;
  periodo_fin: string;
  total: number;
  moneda: string;
}

/** Un plan que el cliente puede elegir y pagar. Los gratuitos no llegan aquí. */
export interface PlanDisponible {
  id_plan: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  moneda: string;
  ciclo: CicloCobro;
}

/**
 * Lo que devuelve elegir plan. `aplica` dice cuándo se nota el cambio:
 *   'ahora'          → había un cobro pendiente y quedó por el valor del plan nuevo
 *   'proximo_cobro'  → el plan vigente sigue; el plan nuevo se cobra en la próxima mensualidad
 */
export interface CambioDePlan {
  aplica: 'ahora' | 'proximo_cobro';
  id_plan_solicitado: number;
  plan_solicitado: string;
  total?: number;
  moneda?: string;
}

/** Un negocio que el usuario administra, con lo que debe y cómo puede pagarlo. */
export interface CobroNegocio {
  id_negocio?: number;
  negocio: string;
  plan: string;
  /** Plan que está pagando hoy. */
  id_plan?: number;
  ciclo?: CicloCobro;
  /** Plan elegido y aún no pagado: manda sobre `plan` en el próximo cobro. */
  id_plan_solicitado?: number | null;
  plan_solicitado?: string | null;
  /** Planes entre los que puede cambiar, con precio en su moneda. */
  planes?: PlanDisponible[];
  estado?: EstadoSuscripcion;
  moneda?: string;
  /**
   * Vigencia del plan del negocio (solo con sesión; el portal público no la recibe). Es la que
   * dice si está al día — no `estado`, que es de la suscripción de cobro y no ve el vencimiento.
   */
  vigencia?: PlanConVencimiento | null;
  facturas: FacturaPendiente[];
  pasarelas: PasarelaElegible[];
}

/**
 * Una pasarela entre las que el cliente elige.
 *
 * `recomendada` la calcula el BACKEND a partir del país del negocio (Wompi en Colombia, dLocal
 * fuera). No se deduce aquí: el frontend no conoce el país, y duplicar la regla es garantizar que
 * un día digan cosas distintas.
 */
export interface PasarelaElegible {
  codigo: CodigoPasarela;
  nombre: string;
  recomendada?: boolean;
}

/**
 * Lo que devuelve iniciar un pago: o un link al checkout de la pasarela, o las instrucciones de
 * transferencia. Nunca un «pagado»: eso lo confirma la pasarela después.
 */
export interface InicioPago {
  estado: 'aprobada' | 'pendiente' | 'rechazada';
  pasarela: CodigoPasarela;
  referencia: string;
  total: number;
  moneda: string;
  urlPago: string | null;
  /**
   * Id de la transacción en la pasarela. Se guarda antes de salir al checkout para poder
   * confirmar la vuelta: Wompi la devuelve en la URL (`?id=`), pero dLocal no devuelve nada.
   */
  idExterno?: string | null;
  instrucciones?: string;
  mensaje?: string | null;
}

/** Lo que se teclea al confirmar una transferencia. Nada de esto se calcula: se constata. */
export interface PagoManual {
  fecha_pago?: string | null;
  medio_pago_texto?: string | null;
  comision_pasarela?: number;
  retencion_declarada?: number;
  numero_factura?: string | null;
  nota?: string | null;
}
