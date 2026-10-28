/**
 * La facturación electrónica de las landings, en un solo sitio: la ventana de `/restaurantes` y la
 * de `/reservas` venden los mismos planes al mismo precio (`precios-y-planes.md` §9: Reserva cuesta
 * lo mismo que Restaurante), así que los precios no se escriben dos veces.
 */

/**
 * El precio TOTAL al mes con facturación electrónica (plan + facturación), por tope de documentos.
 * Los códigos son los planes de `gener_plan` que vende `/adquirir` (`?plan=<código>`): el botón de
 * la ventana lleva directo a comprar el tramo elegido.
 */
export interface TramoFe {
  /** La letra del paquete, como en el nombre del plan («Emprendedor + Facturación S»). */
  paquete: string;
  /** Documentos al mes. Números y no textos: la calculadora de adicionales hace cuentas con ellos. */
  tope: number;
  base: number;
  asistente: number;
  codigoBase: string;
  codigoAsistente: string;
}

export const TRAMOS_FE: TramoFe[] = [
  { paquete: 'S', tope: 100, base: 81999, asistente: 117999, codigoBase: 'EMPRENDEDOR_FE_S', codigoAsistente: 'EMPRESARIAL_S' },
  { paquete: 'M', tope: 500, base: 101999, asistente: 132999, codigoBase: 'EMPRENDEDOR_FE_M', codigoAsistente: 'EMPRESARIAL_M' },
  { paquete: 'L', tope: 1200, base: 121999, asistente: 147999, codigoBase: 'EMPRENDEDOR_FE_L', codigoAsistente: 'EMPRESARIAL_L' },
  { paquete: 'XL', tope: 2500, base: 141999, asistente: 162999, codigoBase: 'EMPRENDEDOR_FE_XL', codigoAsistente: 'EMPRESARIAL_XL' },
];

/**
 * Documentos adicionales al mes, para quien pasa del paquete XL. Se suman al plan y se cobran con él.
 *
 * Cada paquete tiene precio por SU PROPIA compra en Factus (paquete individual, lista de
 * `facturacion-electronica.md` §8.2), porque cuando a un cliente se le acaba la bolsa no se
 * «amplía»: se compra otra y se suman. Peor caso, el adicional lleno durante un año:
 *
 * | Adicional | Al año | Paquete Factus que lo cubre | Costo/mes | Precio | Margen |
 * |---|---|---|---|---|---|
 * | +500 | 6.000 | 10.000 · $390.000 | $32.500 | $54.999 | 41 % |
 * | +1.000 | 12.000 | 15.000 · $440.000 | $36.667 | $64.999 | 44 % |
 * | +2.500 | 30.000 | 35.000 · $820.000 | $68.333 | $114.999 | 41 % |
 *
 * Como cada uno se cubre solo, cualquier combinación también: comprar una bolsa más grande que
 * cubra la suma nunca cuesta más que comprarlas por separado.
 */
export interface PaqueteExtraFe {
  docs: number;
  precio: number;
}

export const PAQUETES_EXTRA_FE: PaqueteExtraFe[] = [
  { docs: 500, precio: 54999 },
  { docs: 1000, precio: 64999 },
  { docs: 2500, precio: 114999 },
];

export type PlanFe = 'base' | 'asistente';

/** El nombre exacto del plan en la página de compra. */
export function nombrePlanFe(plan: PlanFe): string {
  return plan === 'asistente' ? 'Plan Empresarial' : 'Emprendedor + Facturación';
}

/** La combinación más barata de adicionales que cubre `faltan` documentos al mes. */
function combinarExtrasFe(faltan: number): { cantidades: number[]; precio: number } {
  let mejor = { cantidades: PAQUETES_EXTRA_FE.map(() => 0), precio: 0 };
  if (faltan <= 0) return mejor;
  const [chico, medio, grande] = PAQUETES_EXTRA_FE;
  mejor = { ...mejor, precio: Infinity };
  for (let g = 0; g <= Math.ceil(faltan / grande.docs); g++) {
    for (let m = 0; m <= Math.ceil(faltan / medio.docs); m++) {
      for (let c = 0; c <= Math.ceil(faltan / chico.docs); c++) {
        const docs = g * grande.docs + m * medio.docs + c * chico.docs;
        if (docs < faltan) continue;
        const precio = g * grande.precio + m * medio.precio + c * chico.precio;
        if (precio < mejor.precio) mejor = { cantidades: [c, m, g], precio };
      }
    }
  }
  return mejor;
}

/**
 * La cuenta de la calculadora: el paquete que le alcanza a `docs` documentos al mes, los
 * adicionales que le faltan («2 × +2.500 y +500», vacío si no hacen falta) y el total al mes con
 * el plan elegido. `numero` es el formateador de la página, para que las cifras salgan iguales.
 */
export function calcularFe(docs: number, plan: PlanFe, numero: (valor: number) => string) {
  const tramo = TRAMOS_FE.find((t) => docs <= t.tope) ?? TRAMOS_FE[TRAMOS_FE.length - 1];
  const extra = combinarExtrasFe(docs - tramo.tope);
  const adicionales = PAQUETES_EXTRA_FE.map((p, i) => ({ docs: p.docs, cantidad: extra.cantidades[i] }))
    .filter((p) => p.cantidad > 0)
    .reverse()
    .map((p) => `${p.cantidad > 1 ? `${p.cantidad} × ` : ''}+${numero(p.docs)}`)
    .join(' y ');
  return {
    tramo,
    adicionales,
    plan: nombrePlanFe(plan),
    total: (plan === 'asistente' ? tramo.asistente : tramo.base) + extra.precio,
  };
}
