/**
 * La facturación electrónica de las landings, en un solo sitio: la ventana de `/restaurantes`,
 * `/reservas` y `/celulares` vende los mismos paquetes al mismo precio, así que los precios no se
 * escriben tres veces.
 *
 * **Desde 2026-11-14: paquetes del EMISOR PROPIO** (`admin_ws/docs/precios-y-planes.md` §0,
 * «DECIDIDO 2026-11-12»). Reemplazan los tramos S–XL de antes (100 a 2.500 documentos, de $81.999
 * a $162.999) y sus documentos adicionales: con Ilimitada ya no hace falta sumar paquetes. Con
 * asistente cuesta $40.000 más (decidido por el dueño el 2026-11-14).
 *
 * ⚠️ Estos paquetes todavía NO existen en `gener_plan` / `cobranza.cob_precio_plan` (que siguen con
 * S–XL), así que «Adquirir» no los puede vender: el pie de la ventana manda a WhatsApp. Cuando se
 * creen los planes, poner sus códigos en `codigoBase` / `codigoAsistente` y el botón vuelve solo.
 */

export interface TramoFe {
  /** Cómo se llama el paquete en la tabla: «2.500 documentos», «Ilimitada». */
  nombre: string;
  /** La línea de abajo del nombre. */
  detalle: string;
  /** Documentos al mes; `null` = sin tope. La calculadora hace cuentas con ellos. */
  tope: number | null;
  /** Total al mes, sistema + facturación, sin asistente. */
  base: number;
  /** Total al mes con el asistente de WhatsApp. */
  asistente: number;
  /** Los planes de `gener_plan` que vende `/adquirir` (`?plan=<código>`); `null` = aún no existen. */
  codigoBase: string | null;
  codigoAsistente: string | null;
}

export const TRAMOS_FE: TramoFe[] = [
  {
    nombre: '2.500 documentos',
    detalle: 'Al mes, unos 80 al día',
    tope: 2500,
    base: 69999,
    asistente: 109999,
    codigoBase: null,
    codigoAsistente: null,
  },
  {
    nombre: '5.000 documentos',
    detalle: 'Al mes',
    tope: 5000,
    base: 89999,
    asistente: 129999,
    codigoBase: null,
    codigoAsistente: null,
  },
  {
    nombre: '10.000 documentos',
    detalle: 'Al mes',
    tope: 10000,
    base: 119999,
    asistente: 159999,
    codigoBase: null,
    codigoAsistente: null,
  },
  {
    nombre: 'Ilimitada',
    detalle: 'Sin tope de documentos',
    tope: null,
    base: 159999,
    asistente: 199999,
    codigoBase: null,
    codigoAsistente: null,
  },
];

export type PlanFe = 'base' | 'asistente';

/** El nombre del plan como lo lee el cliente. */
export function nombrePlanFe(plan: PlanFe): string {
  return plan === 'asistente' ? 'Plan Empresarial' : 'Emprendedor + Facturación';
}

/** El índice en `TRAMOS_FE` del paquete que le alcanza a `docs` (Ilimitada si ninguno alcanza). */
export function indiceTramoFe(docs: number): number {
  const i = TRAMOS_FE.findIndex((t) => t.tope === null || docs <= t.tope);
  return i === -1 ? TRAMOS_FE.length - 1 : i;
}

/** La cuenta de la calculadora: el paquete que le alcanza a `docs` documentos al mes y el total. */
export function calcularFe(docs: number, plan: PlanFe) {
  const tramo = TRAMOS_FE[indiceTramoFe(docs)];
  return {
    tramo,
    plan: nombrePlanFe(plan),
    total: plan === 'asistente' ? tramo.asistente : tramo.base,
  };
}

/**
 * Lo que resume el pie de la ventana: el paquete elegido en la tabla o en la calculadora (las dos
 * mueven `feTramo`) y con qué plan. `codigo` es `null` mientras el paquete no exista en
 * `gener_plan`: el pie manda a WhatsApp en vez de a comprar un plan con otro precio.
 */
export interface EleccionFe {
  /** «Plan Empresarial · hasta 5.000 documentos al mes». */
  resumen: string;
  total: number;
  codigo: string | null;
}

export function eleccionFe(
  tramoElegido: number,
  plan: PlanFe,
  numero: (valor: number) => string,
): EleccionFe {
  const tramo = TRAMOS_FE[tramoElegido];
  const conAsistente = plan === 'asistente';
  const docs =
    tramo.tope === null ? 'facturación ilimitada' : `hasta ${numero(tramo.tope)} documentos al mes`;
  return {
    resumen: `${nombrePlanFe(plan)} · ${docs}`,
    total: conAsistente ? tramo.asistente : tramo.base,
    codigo: conAsistente ? tramo.codigoAsistente : tramo.codigoBase,
  };
}
