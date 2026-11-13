/**
 * La facturación electrónica de las landings, en un solo sitio: la ventana de `/restaurantes`, la
 * de `/reservas` y la de `/celulares` venden los mismos planes al mismo precio
 * (`precios-y-planes.md` §0), así que los precios no se escriben tres veces.
 *
 * Desde 2026-11-12 son los paquetes del EMISOR PROPIO (ADR-032): un documento ya no nos cuesta por
 * unidad, así que los topes suben (2.500 → ilimitada) y desaparecen los «documentos adicionales»
 * que había que comprarle a Factus. Pasarse del tope un mes nunca frena la facturación: el mes
 * siguiente se pasa al paquete de arriba.
 */

/**
 * El precio TOTAL al mes con facturación electrónica (plan + facturación), por tope de documentos.
 * Los códigos son los planes de `gener_plan` que vende `/adquirir` (`?plan=<código>`): el botón de
 * la ventana lleva directo a comprar el paquete elegido. Las letras S–XL siguen en los códigos y
 * en los nombres de `gener_plan` (los cambia `migrate:planes-emisor-propio` solo de precio).
 */
export interface TramoFe {
  /** La letra del paquete, como en el código del plan (`EMPRESARIAL_S`). */
  paquete: string;
  /** Cómo se llama en la tabla: «2.500 documentos», «Ilimitada». */
  nombre: string;
  /** La línea de debajo: «Hasta 2.500 al mes», «Sin tope». */
  detalle: string;
  base: number;
  asistente: number;
  codigoBase: string;
  codigoAsistente: string;
}

export const TRAMOS_FE: TramoFe[] = [
  { paquete: 'S', nombre: '2.500 documentos', detalle: 'Hasta 2.500 al mes', base: 69999, asistente: 109999, codigoBase: 'EMPRENDEDOR_FE_S', codigoAsistente: 'EMPRESARIAL_S' },
  { paquete: 'M', nombre: '5.000 documentos', detalle: 'Hasta 5.000 al mes', base: 89999, asistente: 129999, codigoBase: 'EMPRENDEDOR_FE_M', codigoAsistente: 'EMPRESARIAL_M' },
  { paquete: 'L', nombre: '10.000 documentos', detalle: 'Hasta 10.000 al mes', base: 119999, asistente: 159999, codigoBase: 'EMPRENDEDOR_FE_L', codigoAsistente: 'EMPRESARIAL_L' },
  { paquete: 'XL', nombre: 'Ilimitada', detalle: 'Sin tope de documentos', base: 159999, asistente: 199999, codigoBase: 'EMPRENDEDOR_FE_XL', codigoAsistente: 'EMPRESARIAL_XL' },
];

export type PlanFe = 'base' | 'asistente';

/** El nombre exacto del plan en la página de compra. */
export function nombrePlanFe(plan: PlanFe): string {
  return plan === 'asistente' ? 'Plan Empresarial' : 'Emprendedor + Facturación';
}

/** Lo que resume el pie de la ventana: el precio que tocó el visitante en la tabla. */
export interface EleccionFe {
  /** «Plan Empresarial · 5.000 documentos». */
  plan: string;
  /** «Hasta 5.000 al mes». */
  detalle: string;
  total: number;
  codigo: string;
}

export function eleccionFe(tramoTabla: number, plan: PlanFe): EleccionFe {
  const tramo = TRAMOS_FE[tramoTabla];
  const conAsistente = plan === 'asistente';
  return {
    plan: `${nombrePlanFe(plan)} · ${tramo.nombre}`,
    detalle: tramo.detalle,
    total: conAsistente ? tramo.asistente : tramo.base,
    codigo: conAsistente ? tramo.codigoAsistente : tramo.codigoBase,
  };
}
