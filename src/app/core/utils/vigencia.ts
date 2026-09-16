/**
 * Fechas de vigencia de un plan, calculadas igual que en el backend.
 *
 * La consola enseña «inicia X · termina Y» antes de guardar. Si esta cuenta se separa de la del
 * backend (`resolverVigencia` / `sumarPeriodo` en `app_core/dao/negocioDao.js`), la pantalla
 * prometería una fecha y la base guardaría otra — justo lo que la vista previa quiere evitar.
 * Cambiar una obliga a cambiar la otra.
 *
 * Todo trabaja con fechas de calendario `'YYYY-MM-DD'` en hora de Bogotá, nunca con horas: el
 * inicio es un día completo desde las 00:00 y el fin un día completo hasta las 23:59.
 */

/** Días que dura la prueba de un negocio sin plan pagado. */
export const DIAS_PRUEBA = 7;

/** Hoy en Bogotá, `'YYYY-MM-DD'`. */
export function hoyBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

/** El día de calendario (Bogotá) de una fecha ISO que llega del backend. */
export function diaBogota(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(iso));
}

/**
 * Suma meses y/o días a `'YYYY-MM-DD'`. Al sumar meses el día se recorta al último del mes
 * destino (31-ene + 1 mes = 28-feb). UTC se usa solo como contenedor, sin horas.
 */
export function sumarPeriodo(fecha: string, { meses = 0, dias = 0 } = {}): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const mesDestino = m - 1 + meses;
  const ultimoDia = new Date(Date.UTC(y, mesDestino + 1, 0)).getUTCDate();
  const base = new Date(Date.UTC(y, mesDestino, Math.min(d, ultimoDia)));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** ¿Es una fecha `'YYYY-MM-DD'` bien formada? */
export function esDiaValido(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [y, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/**
 * El rango que tendrá la vigencia: plan pagado → `meses` desde el inicio; prueba → DIAS_PRUEBA.
 * `null` mientras falte algo para calcularlo.
 */
export function vigenciaPrevista(opts: {
  inicio: string;
  prueba: boolean;
  meses?: number | string | null;
}): { inicio: string; fin: string } | null {
  if (!esDiaValido(opts.inicio)) return null;
  if (opts.prueba) return { inicio: opts.inicio, fin: sumarPeriodo(opts.inicio, { dias: DIAS_PRUEBA }) };

  const meses = Number(opts.meses);
  if (!Number.isInteger(meses) || meses < 1 || meses > 60) return null;
  return { inicio: opts.inicio, fin: sumarPeriodo(opts.inicio, { meses }) };
}

/** `'2026-09-14'` → «lun, 14 sept 2026». */
export function formatearDia(fecha: string): string {
  if (!esDiaValido(fecha)) return '—';
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
