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
  /** El número sigue también en la app WhatsApp Business del celular (coexistencia). */
  coexistencia?: boolean;
}

/**
 * Qué camino de Embedded Signup abrió el dueño:
 *   - `'coexistencia'`: ya usa WhatsApp Business en su celular y quiere conservarlo.
 *   - `'nuevo'`: un número que no está en ninguna app de WhatsApp.
 * Es una pista para el backend: si Meta dice otra cosa del número (`is_on_biz_app`), manda Meta.
 */
export type ModoConexion = 'coexistencia' | 'nuevo';

/**
 * Lo que se manda al canjear. `phoneNumberId` puede faltar: en coexistencia el evento del SDK
 * puede no traerlo, y el backend lo descubre en la WABA que concedió el token (y verifica contra
 * esa lista el que sí venga). `numeroE164` casi nunca viene; `businessId` no es dato de seguridad.
 */
export interface DatosEmbeddedSignup {
  code: string;
  modo: ModoConexion;
  phoneNumberId?: string | null;
  numeroE164?: string | null;
  businessId?: string | null;
}

/**
 * Un `postMessage` de la ventana de Meta (`type: 'WA_EMBEDDED_SIGNUP'`). Eventos que importan:
 * `FINISH` (número nuevo), `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` (coexistencia),
 * `FINISH_ONLY_WABA` (terminó sin número) y `CANCEL` (con `current_step` o `error_message`).
 */
export interface EventoEmbeddedSignup {
  type: 'WA_EMBEDDED_SIGNUP';
  event: string;
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    business_id?: string;
    display_phone_number?: string;
    current_step?: string;
    error_message?: string;
    error_id?: string;
    session_id?: string;
  };
}

export interface ConexionCanalWhatsapp {
  idExterno: string;
  numeroE164: string | null;
  wabaId: string;
  coexistencia: boolean;
  sincronizacion: { contactos: boolean; historial: boolean } | null;
}
