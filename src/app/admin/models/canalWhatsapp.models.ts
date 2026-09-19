/**
 * Estado del canal de WhatsApp de un negocio (F8-D).
 *
 * Espejo de lo que devuelve `GET /admin/negocios/:id_negocio/canal-whatsapp`. Ver
 * `admin_ws/docs/embedded-signup.md`.
 */

/** `'manual'`: número gestionado por EscalApp. `'embedded_signup'`: número propio del cliente. */
export type OrigenCanal = 'manual' | 'embedded_signup';

export interface EstadoCanalWhatsapp {
  conectado: boolean;
  origen: OrigenCanal | null;
  numeroE164: string | null;
  estado: string | null;
}

/**
 * Lo que entrega el evento `WA_EMBEDDED_SIGNUP`/`FINISH` del SDK de Meta en el navegador.
 *
 * `numeroE164` casi nunca viene (probado 2026-09-19: el backend lo resuelve aparte con la Graph
 * API) — se manda igual por si acaso. `businessId` sí viene siempre; no es un dato de seguridad
 * (el `wabaId` real lo verifica el backend contra el token, nunca se toma de aquí), así que
 * confiar en lo que manda el navegador para este campo es aceptable.
 */
export interface DatosEmbeddedSignup {
  code: string;
  phoneNumberId: string;
  numeroE164?: string | null;
  businessId?: string | null;
}

export interface ConexionCanalWhatsapp {
  idExterno: string;
  numeroE164: string | null;
  wabaId: string;
}
