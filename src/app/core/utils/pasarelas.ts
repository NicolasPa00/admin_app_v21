/**
 * Identidad visual de las pasarelas y memoria del pago en curso.
 *
 * Vive en `core/utils` porque lo comparten dos vistas con **sistemas de tokens distintos**:
 * `/pagar` (landing, `--es-*`) y «Mis pagos» (consola, `--color-*`). Lo único común es el dato —
 * marca, color, descripción—; cada vista lo pinta con sus propios tokens. Los colores de marca
 * son de terceros, así que van literales: no son tokens nuestros ni deben serlo.
 */

import { CodigoPasarela } from '../../admin/models/cobranza.models';

export interface MarcaPasarela {
  /** Nombre comercial, tal como lo escribe la propia empresa. */
  marca: string;
  /** Los medios que el cliente reconoce. Acompaña a la marca, no la sustituye. */
  medios: string;
  /** Color corporativo, para el distintivo cuando no hay logo. */
  color: string;
  /** Archivo en `public/images/`. Si no existe, la vista cae al distintivo de texto. */
  logo: string;
}

const MARCAS: Record<CodigoPasarela, MarcaPasarela> = {
  wompi: {
    marca: 'Wompi',
    medios: 'PSE, Nequi, Bancolombia o tarjeta',
    color: '#3C00A0',
    logo: 'logo-wompi.svg',
  },
  dlocal: {
    marca: 'dLocal Go',
    medios: 'Tarjeta y medios locales de tu país',
    color: '#1A1F36',
    logo: 'logo-dlocal.svg',
  },
  manual: {
    marca: 'Transferencia bancaria',
    medios: 'Te damos los datos de la cuenta',
    color: '#4B5563',
    logo: 'logo-transferencia.svg',
  },
};

export function marcaDe(codigo: CodigoPasarela, nombreFallback = ''): MarcaPasarela {
  return MARCAS[codigo] ?? { marca: nombreFallback || codigo, medios: '', color: '#4B5563', logo: '' };
}

// ── Memoria del pago en curso ────────────────────────────────────────────────────────────

/**
 * Qué pago quedó abierto antes de salir al checkout.
 *
 * Existe por una diferencia entre pasarelas: **Wompi vuelve con `?id=<transacción>` y dLocal no
 * vuelve con nada**. Sin esto, quien paga con dLocal regresa a una página que no tiene forma de
 * saber qué consultar, y el pago se queda «pendiente» a la vista aunque haya sido aprobado.
 *
 * `sessionStorage` y no `localStorage`: esto vale para la vuelta del checkout, no para mañana.
 * Muere con la pestaña, que es exactamente su vida útil.
 */
const CLAVE = 'escalapp:pago-en-curso';

export interface PagoEnCurso {
  pasarela: CodigoPasarela;
  idExterno: string;
  referencia: string;
}

export function recordarPago(pago: PagoEnCurso): void {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(pago));
  } catch {
    // Modo privado o almacenamiento bloqueado: se pierde la confirmación inmediata, pero el
    // webhook cierra igual la factura. No es motivo para romper el pago.
  }
}

/** Lee y BORRA: una vuelta del checkout se confirma una vez, no en cada recarga. */
export function tomarPagoEnCurso(): PagoEnCurso | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    sessionStorage.removeItem(CLAVE);
    const p = JSON.parse(crudo) as PagoEnCurso;
    return p?.pasarela && p?.idExterno ? p : null;
  } catch {
    return null;
  }
}
