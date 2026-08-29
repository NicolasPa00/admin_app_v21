/**
 * Bandeja — las conversaciones del asistente vistas por el dueño del negocio.
 *
 * Es deliberadamente **más pobre** que `intelligence.models.ts`: la Consola enseña turnos,
 * pasos, invocaciones, tokens y costo porque su usuario es el desarrollador depurando. Aquí el
 * usuario es el dueño de una barbería, y lo único que necesita saber es quién le escribió, qué
 * dijo, y si puede contestarle ahora.
 */

/** Estado en el que una persona tomó la conversación y el bot dejó de contestar (ADR-023). */
export const ESTADO_ESCALADA = 'handoff_humano';

export interface ConversacionBandeja {
  id_conversacion: string;
  id_negocio: number;
  estado: string;
  canal: string;
  /** El teléfono en el canal. Es el respaldo cuando la persona no está identificada. */
  id_externo: string;
  creado_en: string;
  ultimo_mensaje_en: string | null;
  negocio: string | null;
  persona: string | null;
  telefono_e164: string | null;
  /** El bot dejó de contestar aquí y espera a una persona. La única urgencia de esta pantalla. */
  escalada: boolean;
  ultimo_texto: string | null;
}

export interface MensajeBandeja {
  id_mensaje: string;
  direccion: 'entrante' | 'saliente';
  canal: string;
  contenido: string;
  /**
   * Solo lo traen los salientes. `pendiente` es un mensaje aceptado que **todavía no ha
   * salido**, y `fallido` uno que Meta rechazó: la diferencia importa y por eso se pinta.
   */
  estado_entrega: string | null;
  enviado_en: string | null;
  entregado_en: string | null;
  creado_en: string;
}

/**
 * La ventana de 24 h de WhatsApp.
 *
 * Es la regla de negocio más restrictiva del sistema y la que más sorprende: pasadas 24 h desde
 * el último mensaje de la persona, Meta **rechaza** el texto libre. La pantalla la enseña antes
 * de que alguien escriba un párrafo, no después.
 */
export interface VentanaBandeja {
  abierta: boolean;
  ultimo_entrante_en: string | null;
  expira_en: string | null;
}

export interface ConversacionBandejaDetalle {
  disponible: boolean;
  conversacion: ConversacionBandeja;
  mensajes: MensajeBandeja[];
  ventana: VentanaBandeja;
}

export interface BandejaListado {
  disponible: boolean;
  conversaciones: ConversacionBandeja[];
}

export interface RespuestaEncolada {
  id_mensaje: string | null;
  estado_conversacion: string;
  estado_entrega: string;
}
