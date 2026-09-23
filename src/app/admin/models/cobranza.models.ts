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

/** Una línea del cobro: el plan, o uno de los complementos. La suma es el total. */
export interface LineaFactura {
  tipo: 'plan' | 'complemento';
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface FacturaPendiente {
  id_factura?: number; // no viaja en el portal público: allí se paga por referencia
  referencia: string;
  periodo_inicio: string;
  periodo_fin: string;
  total: number;
  moneda: string;
  /**
   * `renovacion` compra el mes siguiente. `ajuste` es la diferencia por subir de plan a mitad de
   * ciclo: se paga una vez, entra de inmediato y **no mueve la fecha de vencimiento**.
   */
  tipo?: 'renovacion' | 'ajuste';
  /**
   * El plan que cobra ESTA factura, que puede no ser el que el negocio tiene hoy: quien pidió
   * subir de plan tiene un cobro por el plan nuevo mientras sigue usando el viejo. Titular el
   * cobro con el plan de la suscripción mostraba el nombre de un plan con el precio de otro.
   */
  plan?: string;
  lineas?: LineaFactura[];
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
 * Lo que devuelve cambiar de plan o de complementos. `aplica` dice qué pasó:
 *   'ajuste'      → sube: hay un cobro nuevo por la diferencia de los días que faltan, y el
 *                   cambio entra al pagarlo (sin mover el vencimiento)
 *   'renovacion'  → baja o cuesta lo mismo: no se cobra nada hoy y entra al renovar
 *   'sin_cambios' → pidió lo que ya tiene; si había algo pendiente, se canceló
 */
export interface CambioDePlan {
  aplica: 'ajuste' | 'renovacion' | 'sin_cambios' | 'primer_plan';
  cambio?: boolean;
  mensaje?: string;
  referencia?: string | null;
  id_factura?: number;
  total?: number | null;
  moneda?: string;
  /** Lo que pasará a costar al mes cuando el cambio esté aplicado. */
  precio_mensual?: number;
  /** Qué parte del ciclo queda por delante, de 0 a 1. Es lo que multiplica la diferencia. */
  proporcion_restante?: number;
}

/** Un complemento del catálogo con lo que este negocio tiene y lo que dejó pedido. */
export interface ComplementoCliente {
  id_complemento: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  amplia: 'usuarios' | 'cajas' | null;
  cantidad_maxima: number;
  precio: number;
  /** Lo que tiene activo hoy (lo que amplía sus límites). */
  cantidad: number;
  /** Lo que se le cobra: la diferencia con `cantidad` es cortesía. */
  cantidad_facturable: number;
  /** Lo pedido y aún no pagado. `null` = no hay nada pendiente. */
  cantidad_solicitada: number | null;
  cortesia: number;
  subtotal: number;
}

export interface ComplementosDelNegocio {
  moneda: string;
  ciclo: CicloCobro;
  tiene_suscripcion: boolean;
  complementos: ComplementoCliente[];
  total_mensual: number;
  limites: {
    plan: string;
    usuarios: { incluidos: number | null; adicionales: number; total: number | null };
    cajas: { incluidos: number | null; adicionales: number; total: number | null };
  } | null;
}

/** Un negocio que el usuario administra, con lo que debe y cómo puede pagarlo. */
export interface CobroNegocio {
  id_negocio?: number;
  negocio: string;
  /** `null` mientras el negocio no tiene plan (ver `sin_plan`). */
  plan: string | null;
  /**
   * El negocio no tiene ni suscripción de cobro ni ningún plan vigente. Es el único caso en que
   * «Mis pagos» ofrece elegir un PRIMER plan en vez de cambiar el que ya tiene.
   */
  sin_plan?: boolean;
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
  /** Usuarios y cajas extra: lo contratado, lo pedido y lo que suma al cobro. */
  complementos?: ComplementosDelNegocio;
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

/**
 * Un complemento en la ficha de un negocio, tal como lo edita el super-admin.
 *
 * Dos cantidades y no una: `cantidad` es lo que el negocio **puede usar** y
 * `cantidad_facturable` lo que se le **cobra**. La diferencia (`cortesia`) es la vía para
 * regularizar a un cliente que ya venía usando más de lo que su plan incluye sin cobrarle de
 * golpe algo que nunca pactó.
 */
export interface ComplementoNegocio {
  id_complemento: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  amplia: string | null;
  cantidad_maxima: number;
  precio: number;
  cantidad: number;
  cantidad_facturable: number;
  cortesia: number;
  subtotal: number;
}

export interface LimiteRecurso {
  incluidos: number | null;
  adicionales: number;
  total: number | null;
}

export interface LimitesNegocio {
  id_plan: number;
  plan: string;
  usuarios: LimiteRecurso;
  cajas: LimiteRecurso;
}

export interface ComplementosDeNegocio {
  moneda: string;
  ciclo: string;
  tiene_suscripcion: boolean;
  complementos: ComplementoNegocio[];
  total_mensual: number;
  limites: LimitesNegocio | null;
}
