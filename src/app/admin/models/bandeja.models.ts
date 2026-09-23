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
  /**
   * Solo tiene sentido cuando `estado === 'bloqueada'`. Distingue una baja legal por
   * STOP/BAJA ('cliente', irrevocable salvo por un super admin) de un bloqueo que puso el
   * propio negocio ('negocio', que el negocio puede deshacer él mismo). Puede faltar en
   * listados que no lo seleccionan explícitamente.
   */
  bloqueada_por?: 'cliente' | 'negocio' | null;
  /**
   * Reportes ABIERTOS del contacto, no de esta conversación. Ver `ReportesConversacion`.
   * Llega en 0 cuando el entorno todavía no tiene la tabla migrada.
   */
  reportes: number;
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
  reportes: ReportesConversacion;
  /** El catálogo tal como lo valida el backend. Se recibe para no divergir en silencio. */
  motivos: string[];
}

/** Un negocio que TIENE conversaciones. No son todos los del usuario — ver el servicio. */
export interface NegocioConConversaciones {
  id_negocio: number;
  nombre: string | null;
}

export interface BandejaListado {
  disponible: boolean;
  conversaciones: ConversacionBandeja[];
  negocios: NegocioConConversaciones[];
}

export interface RespuestaEncolada {
  id_mensaje: string | null;
  estado_conversacion: string;
  estado_entrega: string;
}

/**
 * Los motivos por los que se puede reportar a alguien.
 *
 * La lista viaja también en el detalle (`motivos`), pero se escribe aquí porque el formulario
 * necesita el texto en español y el orden en que se enseñan — y eso es de esta pantalla, no del
 * backend. `sin_avance` y `automatizado` NO están: los pone el asistente mirando el patrón de la
 * conversación, y una persona no tiene forma de saber cuántos turnos costó nada.
 */
export const MOTIVOS_REPORTE = [
  { valor: 'spam', etiqueta: 'Spam o publicidad' },
  { valor: 'abuso', etiqueta: 'Insultos o acoso' },
  { valor: 'fuera_de_tema', etiqueta: 'Nada que ver con el negocio' },
  { valor: 'contenido_indebido', etiqueta: 'Contenido indebido' },
  { valor: 'otro', etiqueta: 'Otro' },
] as const;

export type MotivoReporte = (typeof MOTIVOS_REPORTE)[number]['valor'];

/** Cómo se lee un motivo, incluidos los dos que solo pone el asistente. */
export const ETIQUETA_MOTIVO: Record<string, string> = {
  spam: 'Spam o publicidad',
  abuso: 'Insultos o acoso',
  fuera_de_tema: 'Nada que ver con el negocio',
  contenido_indebido: 'Contenido indebido',
  sin_avance: 'Mucha charla, ninguna gestión',
  automatizado: 'Mensajes repetidos en serie',
  otro: 'Otro',
};

/**
 * El conteo de reportes.
 *
 * `persona` es el número que importa: los reportes de ese contacto en el negocio, contados por su
 * identidad y no por el hilo, porque la pregunta es «¿esta persona vale la pena?».
 * `conversacion` es cuántos lleva este hilo concreto, y `mio` el motivo del reporte propio
 * — o `null` si no lo he reportado yo, que es lo que decide si el botón ofrece marcar o deshacer.
 */
export interface ReportesConversacion {
  persona: number;
  conversacion: number;
  /** Los que puso el propio asistente al ver el patrón. No bloquean nada; avisan. */
  del_asistente: number;
  mio: string | null;
  ultimo: string | null;
}
