import { diaBogota, hoyBogota, sumarPeriodo } from './vigencia';

/**
 * En qué punto del vencimiento está el plan de un negocio, en palabras de la consola.
 *
 * La **fecha de vencimiento** es la que manda: cuando el negocio paga, la fecha se corre y el
 * estado cambia solo. Por eso no hay un campo «pagado»: un plan al día es un plan pagado.
 *
 *   AL_DIA      dentro de fechas, con más de DIAS_AVISO_VENCIMIENTO días por delante
 *   POR_VENCER  dentro de fechas, pero vence pronto
 *   GRACIA      venció; sigue entrando DIAS_GRACIA_PLAN días más, con aviso de pago
 *   VENCIDO     venció y se acabó la gracia: acceso bloqueado
 *   PENDIENTE   tiene plan, pero su fecha de inicio aún no llega: acceso bloqueado
 *   SIN_PLAN    no tiene plan: acceso bloqueado
 *
 * El estado lo calcula el backend (`planHelper.getPlanesActivosPorNegocio`); aquí solo se
 * traduce. Si llega sin `estado` (backend anterior), se deduce de las fechas.
 */

/** Días de acceso después del vencimiento. Espejo de `DIAS_GRACIA_PLAN` del backend. */
export const DIAS_GRACIA_PLAN = 5;

/** A partir de cuántos días restantes un plan al día pasa a «por vencer». */
export const DIAS_AVISO_VENCIMIENTO = 7;

export type ClaveVencimiento =
  | 'AL_DIA'
  | 'POR_VENCER'
  | 'GRACIA'
  | 'VENCIDO'
  | 'PENDIENTE'
  | 'SIN_PLAN';

export type TonoVencimiento = 'success' | 'warning' | 'error' | 'info';

/** Lo mínimo que hace falta de un plan para evaluarlo. */
export interface PlanConVencimiento {
  fecha_inicio: string | null;
  fecha_fin: string | null;
  dias_restantes?: number | null;
  estado?: 'ACTIVO' | 'GRACIA' | 'VENCIDO' | 'SIN_PLAN' | 'PENDIENTE';
  dias_gracia_restantes?: number | null;
  fecha_limite_gracia?: string | null;
}

export interface Vencimiento {
  clave: ClaveVencimiento;
  etiqueta: string;
  tono: TonoVencimiento;
  /** ¿Se deja entrar a administrar? En GRACIA sí, pero con aviso. */
  puedeEntrar: boolean;
  /** ¿Hay que avisar al usuario antes de entrar (o en vez de entrar)? */
  requiereAviso: boolean;
  /** Días de calendario (Bogotá) `'YYYY-MM-DD'`, o `''`. */
  inicio: string;
  fin: string;
  limiteGracia: string;
  /** Según la clave: días restantes, días de gracia o días para iniciar. */
  dias: number | null;
}

/** Opciones para un filtro por vencimiento, en el orden en que se leen. */
export const OPCIONES_VENCIMIENTO: ReadonlyArray<{ clave: ClaveVencimiento; nombre: string }> = [
  { clave: 'AL_DIA', nombre: 'Al día' },
  { clave: 'POR_VENCER', nombre: 'Por vencer' },
  { clave: 'GRACIA', nombre: 'Vencidos con plazo' },
  { clave: 'VENCIDO', nombre: 'Vencidos sin acceso' },
  { clave: 'PENDIENTE', nombre: 'Por iniciar' },
  { clave: 'SIN_PLAN', nombre: 'Sin plan' },
];

function diasEntre(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Estado del backend, o deducido de las fechas si no vino. */
function estadoDe(plan: PlanConVencimiento): NonNullable<PlanConVencimiento['estado']> {
  if (plan.estado) return plan.estado;
  const ahora = Date.now();
  const inicio = plan.fecha_inicio ? new Date(plan.fecha_inicio).getTime() : null;
  const fin = plan.fecha_fin ? new Date(plan.fecha_fin).getTime() : null;
  if (inicio !== null && inicio > ahora) return 'PENDIENTE';
  if (fin === null || fin >= ahora) return 'ACTIVO';
  return fin + DIAS_GRACIA_PLAN * 86400000 > ahora ? 'GRACIA' : 'VENCIDO';
}

export function evaluarVencimiento(plan: PlanConVencimiento | null | undefined): Vencimiento {
  if (!plan) {
    return {
      clave: 'SIN_PLAN', etiqueta: 'Sin plan', tono: 'error',
      puedeEntrar: false, requiereAviso: true,
      inicio: '', fin: '', limiteGracia: '', dias: null,
    };
  }

  const inicio = diaBogota(plan.fecha_inicio);
  const fin = diaBogota(plan.fecha_fin);
  const limiteGracia = plan.fecha_limite_gracia
    ? diaBogota(plan.fecha_limite_gracia)
    : fin ? sumarPeriodo(fin, { dias: DIAS_GRACIA_PLAN }) : '';
  const base = { inicio, fin, limiteGracia };

  switch (estadoDe(plan)) {
    case 'ACTIVO': {
      const dias = plan.dias_restantes ?? (fin ? diasEntre(hoyBogota(), fin) + 1 : null);
      if (dias !== null && dias <= DIAS_AVISO_VENCIMIENTO) {
        return {
          ...base, clave: 'POR_VENCER', etiqueta: `Vence en ${plural(dias, 'día', 'días')}`,
          tono: 'warning', puedeEntrar: true, requiereAviso: false, dias,
        };
      }
      return {
        ...base, clave: 'AL_DIA', etiqueta: fin ? 'Al día' : 'Sin vencimiento',
        tono: 'success', puedeEntrar: true, requiereAviso: false, dias,
      };
    }
    case 'GRACIA': {
      // «En gracia» es vocabulario de cobranza, no del dueño de un restaurante: para él el plan
      // está vencido y lo que importa es cuántos días le quedan (decisión del usuario, 2026-09-15).
      const dias = plan.dias_gracia_restantes ?? null;
      return {
        ...base, clave: 'GRACIA',
        etiqueta: dias !== null ? `Vencido · ${plural(dias, 'día', 'días')} de plazo` : 'Vencido · con plazo',
        tono: 'warning', puedeEntrar: true, requiereAviso: true, dias,
      };
    }
    case 'VENCIDO':
      return {
        ...base, clave: 'VENCIDO', etiqueta: 'Vencido', tono: 'error',
        puedeEntrar: false, requiereAviso: true, dias: null,
      };
    case 'PENDIENTE':
      return {
        ...base, clave: 'PENDIENTE', etiqueta: 'Por iniciar', tono: 'info',
        puedeEntrar: false, requiereAviso: true,
        dias: inicio ? diasEntre(hoyBogota(), inicio) : null,
      };
    default:
      return {
        ...base, clave: 'SIN_PLAN', etiqueta: 'Sin plan', tono: 'error',
        puedeEntrar: false, requiereAviso: true, dias: null,
      };
  }
}
