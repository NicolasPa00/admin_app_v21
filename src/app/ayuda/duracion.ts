/**
 * Formateo de segundos para el Centro de ayuda.
 *
 * Está aparte y no en un pipe porque lo usan tanto plantillas como el panel de administración
 * (donde «marcar aquí» tiene que enseñar el tiempo capturado al instante, dentro de un formulario).
 */

/**
 * Una marca de tiempo de video: `2:15`, o `1:02:15` si pasa de la hora.
 *
 * Los segundos van siempre a dos cifras: `2:5` se lee como «dos y cinco» y no como «dos
 * minutos y cinco segundos».
 */
export function marcaTiempo(segundos: number | null | undefined): string {
  const total = Math.max(0, Math.floor(segundos ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dos = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
}

/**
 * La duración como se lee en una tarjeta: `4 min`.
 *
 * Redondea hacia arriba y nunca enseña «0 min»: un video de 40 segundos es «1 min», porque lo
 * que la persona quiere saber no es el dato exacto, es si le va a costar un rato.
 */
export function duracionLegible(segundos: number | null | undefined): string | null {
  if (!segundos || segundos <= 0) return null;
  if (segundos < 60) return '1 min';
  return `${Math.ceil(segundos / 60)} min`;
}

/** `'2:15'` o `'135'` a segundos. Lo usa el panel al pegar una marca a mano. */
export function aSegundos(texto: string): number {
  const partes = String(texto).trim().split(':').map((p) => Number(p) || 0);
  if (partes.length === 1) return Math.max(0, Math.floor(partes[0]));
  if (partes.length === 2) return Math.max(0, partes[0] * 60 + partes[1]);
  return Math.max(0, partes[0] * 3600 + partes[1] * 60 + partes[2]);
}
