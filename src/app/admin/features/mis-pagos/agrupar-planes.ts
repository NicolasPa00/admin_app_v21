import { PlanDisponible } from '../../models/cobranza.models';

/**
 * Los planes de la base, vistos como los ve el cliente: TRES planes.
 *
 * `gener_plan` guarda una fila por cada combinación que se vende (Básico, Avanzado, «Emprendedor
 * + Facturación» S/M/L/XL, «Plan Empresarial» S/M/L/XL…). Esa separación es de la empresa —cada
 * fila tiene su precio, sus límites y sus características— y no se toca. Lo que el cliente
 * entiende son CUATRO planes; en los dos que llevan facturación electrónica elige además el
 * paquete de documentos.
 *
 * ## Se agrupa por `codigo`, nunca por nombre
 *
 * El nombre es un rótulo que alguien puede corregir mañana; el código es estable. La única tabla
 * que sabe qué código es qué es `CODIGOS`, aquí abajo.
 *
 * ## El precio sale de la fila, nunca de una cuenta
 *
 * Este módulo no suma ni calcula ningún precio: cada opción apunta a su fila real de `PlanDisponible`
 * y de ahí se lee. Elegir tarjeta + paquete es marcar el `id_plan` de esa fila, así que
 * todo lo que ya existía (simulación del prorrateo, guardar) sigue igual.
 *
 * ## Lo que no se reconoce no desaparece
 *
 * Un plan con un código que no está en `CODIGOS` (uno nuevo en la base, o sin código) va a `otros`,
 * y la pantalla lo enseña aparte. Esconderlo sería vender un plan que nadie ve.
 */

export type FamiliaId = 'basico' | 'avanzado' | 'emprendedor-fe' | 'empresarial';

/** Paquete de facturación electrónica: documentos al mes. Ver `docs/precios-y-planes.md` §3. */
export type Tramo = 'S' | 'M' | 'L' | 'XL';

export const TRAMOS: readonly Tramo[] = ['S', 'M', 'L', 'XL'];

/** Lo que significa cada paquete, en lenguaje de cliente (mismos rangos que la landing). */
export const DOCUMENTOS_POR_TRAMO: Record<Tramo, string> = {
  S: 'hasta 100 documentos al mes',
  M: 'hasta 500 documentos al mes',
  L: 'hasta 1.200 documentos al mes',
  XL: 'hasta 2.500 documentos al mes',
};

/** Si el plan lleva facturación electrónica: `obligatoria` = hay que elegir un paquete. */
export type Facturacion = 'obligatoria' | 'no';

interface InfoFamilia {
  id: FamiliaId;
  titulo: string;
  /** Una línea de qué incluye. Es el texto de la landing, no uno nuevo. */
  incluye: string;
  facturacion: Facturacion;
}

/** Las cuatro tarjetas, en el orden de la landing (`TARJETAS_PLAN`): por precio de entrada. */
export const FAMILIAS: readonly InfoFamilia[] = [
  {
    id: 'basico',
    titulo: 'Básico',
    incluye: 'Todo lo esencial para operar tu negocio desde el primer día.',
    facturacion: 'no',
  },
  {
    id: 'avanzado',
    titulo: 'Avanzado (WhatsApp)',
    incluye: 'El sistema completo y un asistente que atiende tu WhatsApp por ti.',
    facturacion: 'no',
  },
  {
    id: 'emprendedor-fe',
    titulo: 'Emprendedor + Facturación',
    incluye: 'Todo el Plan Básico y tus facturas electrónicas ante la DIAN.',
    facturacion: 'obligatoria',
  },
  {
    id: 'empresarial',
    titulo: 'Empresarial',
    incluye: 'Todo junto: el sistema, el asistente de IA y la facturación electrónica.',
    facturacion: 'obligatoria',
  },
];

/**
 * LA tabla de mapeo: `gener_plan.codigo` → tarjeta y paquete de facturación.
 * `tramo: null` = sin facturación. Un plan nuevo se añade aquí, en una línea.
 */
export const CODIGOS: Readonly<Record<string, { familia: FamiliaId; tramo: Tramo | null }>> = {
  BASICO: { familia: 'basico', tramo: null },
  EMPRENDEDOR_FE_S: { familia: 'emprendedor-fe', tramo: 'S' },
  EMPRENDEDOR_FE_M: { familia: 'emprendedor-fe', tramo: 'M' },
  EMPRENDEDOR_FE_L: { familia: 'emprendedor-fe', tramo: 'L' },
  EMPRENDEDOR_FE_XL: { familia: 'emprendedor-fe', tramo: 'XL' },
  AVANZADO: { familia: 'avanzado', tramo: null },
  EMPRESARIAL_S: { familia: 'empresarial', tramo: 'S' },
  EMPRESARIAL_M: { familia: 'empresarial', tramo: 'M' },
  EMPRESARIAL_L: { familia: 'empresarial', tramo: 'L' },
  EMPRESARIAL_XL: { familia: 'empresarial', tramo: 'XL' },
};

/** Una combinación que se puede contratar: su fila real y su paquete (`null` = sin facturación). */
export interface OpcionPlan {
  plan: PlanDisponible;
  tramo: Tramo | null;
}

export interface TarjetaPlan extends InfoFamilia {
  /** Solo las combinaciones con precio para este negocio, sin facturación primero y luego S…XL. */
  opciones: OpcionPlan[];
}

export interface PlanesAgrupados {
  tarjetas: TarjetaPlan[];
  /** Planes con un código que no se reconoce: se enseñan aparte, nunca se pierden. */
  otros: PlanDisponible[];
}

const ORDEN_TRAMO = (t: Tramo | null): number => (t === null ? -1 : TRAMOS.indexOf(t));

/**
 * Agrupa los planes que devuelve el backend.
 * Una tarjeta sin ninguna opción con precio (p. ej. Empresarial en Chile) no aparece.
 */
export function agruparPlanes(planes: readonly PlanDisponible[] | null | undefined): PlanesAgrupados {
  const porFamilia = new Map<FamiliaId, OpcionPlan[]>();
  const otros: PlanDisponible[] = [];

  for (const plan of planes ?? []) {
    const mapa = plan.codigo ? CODIGOS[plan.codigo] : undefined;
    if (!mapa) {
      otros.push(plan);
      continue;
    }
    const lista = porFamilia.get(mapa.familia) ?? [];
    lista.push({ plan, tramo: mapa.tramo });
    porFamilia.set(mapa.familia, lista);
  }

  const tarjetas = FAMILIAS.flatMap((f) => {
    const opciones = (porFamilia.get(f.id) ?? []).sort(
      (a, b) => ORDEN_TRAMO(a.tramo) - ORDEN_TRAMO(b.tramo),
    );
    return opciones.length ? [{ ...f, opciones }] : [];
  });

  return { tarjetas, otros };
}

/** La familia a la que pertenece un plan, o `null` si no se reconoce. */
export function familiaDe(plan: PlanDisponible | undefined): FamiliaId | null {
  return (plan?.codigo && CODIGOS[plan.codigo]?.familia) || null;
}

/**
 * La opción con la que se enseña una tarjeta.
 *
 * Manda, en este orden: el plan marcado (si es de esta tarjeta), lo que el cliente eligió antes
 * en esta misma tarjeta, su plan actual (si es de esta tarjeta) y, por último, la primera opción.
 */
export function opcionInicial(
  tarjeta: TarjetaPlan,
  { idPlanMarcado, idPlanActual, tramoLocal }: {
    idPlanMarcado: number | null;
    idPlanActual: number | null;
    tramoLocal?: Tramo | null | undefined;
  },
): OpcionPlan {
  const porId = (id: number | null) => tarjeta.opciones.find((o) => o.plan.id_plan === id);
  const local =
    tramoLocal === undefined ? undefined : tarjeta.opciones.find((o) => o.tramo === tramoLocal);
  return porId(idPlanMarcado) ?? local ?? porId(idPlanActual) ?? tarjeta.opciones[0];
}
