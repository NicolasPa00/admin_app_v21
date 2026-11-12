import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ElementRef,
  PLATFORM_ID,
  inject,
  signal,
  computed,
  input,
  output,
  effect,
  untracked,
  viewChild,
} from '@angular/core';
import { PersonalidadAsistenteComponent, PersonalidadAsistente } from './personalidad-asistente/personalidad-asistente';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import {
  MessageSquare, Send, Loader2, AlertCircle, Bot, Clock, TriangleAlert, RefreshCw, Inbox,
  Search, X, Check, Building2, CheckCheck, BotMessageSquare, Ban, BellOff,
  Flag, ShieldAlert, MessageCircle, User, FileText, Settings, Smartphone, Pause, Play, ChartColumn,
  ClipboardList, MousePointerClick, Reply, Sparkles, Download, Lock,
  // Los de Ajustes, el historial de análisis y la vista previa del saludo (2026-11-03).
  Bike, History, Info, Package, RotateCcw, ShoppingBag, Wallet, ChevronDown, ListChecks,
  // Archivos, respuestas rápidas y barra de 24 h (2026-11-10).
  Paperclip, Timer, Plus, Pencil, Trash2, ImageIcon, ChevronUp,
  // La flecha de volver del chat a pantalla completa y el visor de fotos y videos (2026-11-11).
  ArrowLeft, ChevronLeft, ChevronRight,
} from '../../../core/icons/phosphor';

import { BandejaService } from '../../data-access/bandeja.service';
import { PantallaAnchaService } from '../../../core/services/pantalla-ancha.service';
import { ModalCabeceraComponent } from '../../../shared/modal-cabecera/modal-cabecera.component';
import { ToastService } from '../../../shared/toast/toast.service';
import {
  ConversacionBandeja,
  ConfiguracionReactivacion,
  DiagnosticoAsistente,
  RecomendacionesAsistente,
  InformeAsistente,
  AnalisisResumido,
  CupoIaNegocio,
  ConversacionBandejaDetalle,
  MensajeBandeja,
  CitaMensaje,
  RetomadaAsistente,
  NegocioConConversaciones,
  ReportesConversacion,
  PreparacionAsistente,
  RespuestaRapida,
} from '../../models/bandeja.models';
import { LoadingState } from '../../models/admin.models';

/** Las pestañas de la ventana «Tu asistente». */
type PestanaAsistente = 'revision' | 'ajustes' | 'informe';

/** Un archivo del cliente, ya traído (o no) para pintarlo en el hilo. */
type EstadoArchivo =
  | { estado: 'cargando' }
  | { estado: 'listo'; url: string }
  | { estado: 'error'; mensaje: string };

/** Una línea del hilo: un mensaje, o el aviso de que el asistente retomó la conversación. */
type ItemHilo =
  | { tipo: 'msg'; clave: string; fecha: number; m: MensajeBandeja }
  | { tipo: 'retomo'; clave: string; fecha: number; r: RetomadaAsistente }
  | { tipo: 'dia'; clave: string; fecha: number; texto: string };

/** El día de una fecha en Bogotá, `AAAA-MM-DD`: lo que decide si dos mensajes son del mismo día. */
const DIA_BOGOTA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const DIA_EN_LETRAS = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/**
 * «Hoy», «Ayer» o «Sábado 17 de octubre», como el separador de WhatsApp. Sin él, una conversación
 * que vuelve al día siguiente se lee como si todo fuera de la misma noche (Zona Burger, 2026-10-18).
 */
function textoDelDia(fecha: number, ahora = Date.now()): string {
  const dia = DIA_BOGOTA.format(fecha);
  if (dia === DIA_BOGOTA.format(ahora)) return 'Hoy';
  if (dia === DIA_BOGOTA.format(ahora - 24 * 3600 * 1000)) return 'Ayer';
  const texto = DIA_EN_LETRAS.format(fecha).replace(',', '');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}


/**
 * BandejaComponent — donde el negocio contesta cuando el asistente no supo.
 *
 * ## El problema que resuelve
 *
 * El handoff funcionaba desde F7: el bot reconoce que no sabe, dice honestamente cuándo habrá
 * alguien, y se calla. Lo que faltaba era **el otro lado de esa promesa**. El número está
 * conectado a la Cloud API, así que deja de funcionar en la app de WhatsApp del móvil: el dueño
 * no puede coger el teléfono y responder.
 *
 * ## Por qué se parece a WhatsApp, y hasta dónde
 *
 * Se copia **la forma**, no los colores: dos paneles, la lista a la izquierda con avatar y
 * último mensaje, el hilo a la derecha, burbujas con la hora dentro. Quien use esto ya sabe
 * usar WhatsApp y no debería tener que aprender otra cosa.
 *
 * Lo que **no** se copia es el verde. La paleta es dinámica por inquilino (`--color-primary` y
 * mezclas con `color-mix`): un verde fijo se vería mal en el negocio que elija otro color, y
 * además esto no es WhatsApp — es el panel de EscalApp.
 *
 * ## Las tres cosas que esta pantalla hace y una consola normal no haría
 *
 * 1. **Separa por negocio.** Un dueño con dos locales tiene dos números y dos conversaciones
 *    distintas con el mismo cliente. Mezclarlas sería contestarle a uno creyendo que es el
 *    otro. Las pastillas las da el backend y solo trae **los negocios que tienen
 *    conversaciones**: con los de la sesión salía una por cada negocio del usuario
 *    —parqueadero, gimnasio, tienda—, y ninguno de ésos va a tener nunca una.
 * 2. **Las escaladas primero y marcadas.** La pregunta no es «qué es lo último» sino «qué me
 *    está esperando».
 * 3. **La ventana de 24 h se enseña ANTES de escribir**, y también en la lista. Es la regla más
 *    restrictiva de WhatsApp: pasado ese plazo Meta rechaza el texto libre. Enterarse después de
 *    redactar un párrafo es la peor forma de descubrirlo.
 * 4. **Se puede reportar a quien usa el asistente para nada.** Desde que el Nivel 4 contesta,
 *    cada turno cuesta dinero y el número del negocio es público: quien descubre que al otro
 *    lado hay un modelo tiene barra libre. El conteo va por **contacto**, no por conversación —
 *    esa gente vuelve a escribir en otro hilo—, y el asistente también reporta cuando ve el
 *    patrón (`intelligence/engine/reporteAutomatico.js`). Reportar **no bloquea a nadie**: es
 *    una opinión con autor y fecha, y bloquear sigue siendo una decisión de una persona.
 *
 * ## Por qué se refresca sondeando y no con un canal de eventos
 *
 * Se miró SSE y se descartó por dos medidas, no por gusto. El proxy lleva `encode gzip zstd`
 * sobre la API: una respuesta en streaming saldría **bufferizada**, así que «en vivo» exigiría
 * tocar el Caddyfile. Y el servidor es **1 vCPU con 955 MB**, donde una conexión abierta por
 * pestaña de admin cuesta más que una petición cada cinco segundos.
 *
 * Cinco segundos, para dos o tres personas mirando, es indistinguible de un push — y el
 * Channel Gateway ya sondea la base cada segundo, así que esto no cambia la naturaleza de nada.
 * Cuando haya cien negocios conectados, esta decisión se vuelve a mirar; hoy sería
 * infraestructura para un problema que no existe.
 *
 * Tres cosas que el refresco automático NO puede hacer, y que son la mitad del trabajo:
 * pisar lo que estás escribiendo, moverte el scroll mientras lees algo de más arriba, y seguir
 * consumiendo servidor con la pestaña en segundo plano.
 *
 * Y «enviado» no se dice hasta que lo está: el backend encola y entrega el Channel Gateway con
 * reintentos, así que un envío aceptado nace `pendiente` y se pinta «enviando…».
 *
 * ## «Atendida» y «el bot no vuelve» son dos cosas distintas
 *
 * El botón de marcar atendida quita la conversación de lo que espera **sin** devolvérsela al
 * asistente: eso último lo prohíbe ADR-023, y sigue prohibido. Hace falta porque no todo lo que
 * el bot escala se resuelve por el chat — se llama al cliente, o se le atiende en el local—, y
 * sin él la única forma de vaciar la lista era escribirle a alguien que ya no lo necesitaba.
 */
/**
 * Cada cuánto se mira si hay algo nuevo en el chat abierto. La lista se refresca cada DOS latidos.
 * Desde 2026-11-10 el chat abierto va más rápido (3 s, antes 5): ya no se trae entero en cada
 * latido sino los últimos 60 mensajes, así que mirar más seguido cuesta menos que antes.
 */
const REFRESCO_MS = 3000;

/** Cuántas conversaciones trae la lista. */
const LIMITE_LISTA = 60;

/** La ventana de WhatsApp para contestar con texto libre. */
const VENTANA_MS = 24 * 3600 * 1000;

type NivelVentana = 'holgada' | 'media' | 'urgente' | 'cerrada';

/** Verde con más de 6 h, ámbar entre 1 y 6 h, rojo en la última hora. */
function nivelVentana(restanteMs: number): NivelVentana {
  if (restanteMs <= 0) return 'cerrada';
  if (restanteMs < 3600000) return 'urgente';
  if (restanteMs < 6 * 3600000) return 'media';
  return 'holgada';
}

/** 66.120.000 ms → «18 h 22 min». */
function textoRestante(ms: number): string {
  if (ms <= 0) return 'Cerrada';
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  if (h === 0) return `${Math.max(1, min)} min`;
  return `${h} h ${String(min % 60).padStart(2, '0')} min`;
}

/** Cómo se dice en la lista lo que no es texto. */
const ETIQUETA_ARCHIVO: Record<string, string> = {
  image: '📷 Foto',
  video: '🎥 Video',
  audio: '🎤 Audio',
  document: '📄 Documento',
  sticker: '💟 Sticker',
  location: '📍 Ubicación',
  contacts: '👤 Contacto',
  reaction: '👍 Reacción',
};

/** Lo que WhatsApp acepta al ENVIAR, y su tope en MB. Igual que `ARCHIVOS_PERMITIDOS` del backend. */
const ARCHIVOS_WHATSAPP: Record<string, { tipo: string; max: number }> = {
  'image/jpeg': { tipo: 'image', max: 5 },
  'image/png': { tipo: 'image', max: 5 },
  'video/mp4': { tipo: 'video', max: 16 },
  'video/3gpp': { tipo: 'video', max: 16 },
  'audio/aac': { tipo: 'audio', max: 16 },
  'audio/amr': { tipo: 'audio', max: 16 },
  'audio/mpeg': { tipo: 'audio', max: 16 },
  'audio/mp4': { tipo: 'audio', max: 16 },
  'audio/ogg': { tipo: 'audio', max: 16 },
  'application/pdf': { tipo: 'document', max: 16 },
  'application/msword': { tipo: 'document', max: 16 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { tipo: 'document', max: 16 },
  'application/vnd.ms-excel': { tipo: 'document', max: 16 },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { tipo: 'document', max: 16 },
  'application/vnd.ms-powerpoint': { tipo: 'document', max: 16 },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { tipo: 'document', max: 16 },
  'text/plain': { tipo: 'document', max: 16 },
};

/** Los emojis del selector, por grupo. Los más usados en un chat de ventas primero. */
const EMOJIS: { grupo: string; lista: string[] }[] = [
  { grupo: 'Frecuentes', lista: ['😊', '🙌', '👍', '🙏', '❤️', '😂', '😉', '👌', '✅', '🔥', '🎉', '🤝', '👋', '😍', '🥰', '💯'] },
  { grupo: 'Caras', lista: ['😀', '😃', '😄', '😁', '😅', '🤣', '🙂', '😇', '😌', '😋', '😎', '🤩', '🥳', '🤗', '🤔', '🤭', '😐', '😶', '🙄', '😏', '😮', '😯', '😲', '😴', '🤤', '😪', '😕', '😟', '🙁', '😢', '😭', '😤', '😡', '🥺', '😱', '🤯'] },
  { grupo: 'Manos', lista: ['👍', '👎', '👏', '🙌', '👐', '🤲', '🙏', '✌️', '🤞', '🤟', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🖐️', '👊', '💪'] },
  { grupo: 'Negocio', lista: ['📱', '💻', '⌚', '🎧', '🔋', '🔌', '📦', '🚚', '🛵', '🏍️', '🛒', '🏪', '💵', '💳', '🧾', '📍', '🕐', '📅', '📞', '✉️', '🎁', '🏷️', '🔧', '🛠️'] },
  { grupo: 'Comida', lista: ['🍔', '🍟', '🍕', '🌭', '🌮', '🥪', '🍗', '🍖', '🥗', '🍝', '🍣', '🍩', '🍰', '🍦', '☕', '🥤', '🍺', '🧃'] },
  { grupo: 'Símbolos', lista: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💖', '✨', '⭐', '🌟', '⚡', '💥', '✔️', '❌', '⚠️', '❗', '❓', '➡️', '⬅️', '🔝', '🆕', '🆗', '💲'] },
];

/**
 * Los íconos que pinta la Bandeja. Tiene su PROPIO proveedor y, como LUCIDE_ICONS es `multi`, el
 * más cercano tapa al de la app: un ícono que no esté aquí no sale aunque exista en
 * `core/icons/phosphor` (y Angular corta el render). Exportado para que
 * `bandeja.iconos.spec.ts` lo compare con la plantilla.
 */
export const ICONOS_BANDEJA = {
  MessageSquare, Send, Loader2, AlertCircle, Bot, Clock, TriangleAlert,
  RefreshCw, Inbox, Search, X, Check, Building2, CheckCheck, BotMessageSquare, Ban, BellOff,
  Flag, ShieldAlert, MessageCircle, User, FileText, Settings, Smartphone, Pause, Play, ChartColumn,
  ClipboardList, MousePointerClick, Reply, Sparkles, Download, Lock,
  Bike, History, Info, Package, RotateCcw, ShoppingBag, Wallet, ChevronDown, ListChecks,
  Paperclip, Timer, Plus, Pencil, Trash2, ImageIcon, ChevronUp, ArrowLeft, ChevronLeft, ChevronRight,
};

@Component({
  selector: 'app-bandeja',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, DecimalPipe, LucideAngularModule, ModalCabeceraComponent, PersonalidadAsistenteComponent],
  // `viewProviders` y no `providers`: los `providers` también los ven los hijos PROYECTADOS
  // (<ng-content>), y como LUCIDE_ICONS es multi, un ícono declarado por quien proyecta (el botón
  // «Tu número» de WhatsApp) se buscaba aquí, no lo encontraba y cortaba el render de la bandeja.
  viewProviders: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider(ICONOS_BANDEJA),
    },
  ],
  // Tocar fuera del panel de emojis lo cierra, como cualquier menú (2026-11-11).
  host: {
    '(document:pointerdown)': 'alTocarFuera($event)',
    '(document:keydown.escape)': 'emojisAbierto.set(false)',
  },
  templateUrl: './bandeja.component.html',
  // Dos hojas: la de siempre y la del compositor/ventana de 24 h (2026-11-10, traídas de
  // restaurante_app el 2026-11-11), cada una bajo el tope de tamaño que el build pone por archivo.
  styleUrls: ['./bandeja.component.scss', './bandeja-chat.scss'],
})
export class BandejaComponent implements OnInit, OnDestroy {
  private readonly service = inject(BandejaService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly pantallaAncha = inject(PantallaAnchaService);
  private readonly toast = inject(ToastService);
  /** ¿Esta instancia tiene pedido el ancho completo al layout? Para soltarlo una sola vez. */
  private anchoPedido = false;
  private temporizador: ReturnType<typeof setInterval> | null = null;

  /** El contenedor del hilo. Se necesita para bajarlo, no para leerlo. */
  private readonly cajaMensajes = viewChild<ElementRef<HTMLElement>>('mensajes');

  readonly estado = signal<LoadingState>('idle');
  readonly error = signal<string | null>(null);
  /** El esquema `intelligence` no está migrado en este entorno. No es una avería. */
  readonly sinModulo = signal(false);

  readonly conversaciones = signal<ConversacionBandeja[]>([]);
  readonly soloEscaladas = signal(false);
  readonly busqueda = signal('');

  /**
   * Negocio activo, o `null` para «todos».
   *
   * Se filtra **en el servidor**, no aquí: la lista viene con un límite, y filtrar después de
   * recortar enseñaría menos conversaciones de las que hay.
   */
  readonly negocioActivo = signal<number | null>(null);

  /**
   * Negocio fijado por quien contiene la bandeja (la vista WhatsApp, que ya eligió negocio
   * arriba). Con él se filtra desde la primera carga y se esconden las pastillas: dos
   * selectores de negocio en la misma pantalla se contradirían.
   */
  readonly negocioFijo = input<number | null>(null);
  /**
   * La pantalla de WhatsApp pide aquí el botón «Gestionar número» (2026-10-02): antes ocupaba una
   * fila entera encima de la Bandeja, y con un solo negocio esa fila no tenía nada más.
   */
  readonly mostrarGestionarNumero = input(false);
  /**
   * El asistente comercial de EscalApp (2026-10-29) usa esta misma bandeja, pero sus ajustes viven
   * en sus propias pestañas: la ventana de «Configuración del asistente» (tiempos, domicilio) y la
   * revisión «Al asistente le faltan datos» son de restaurante y reserva, y allí no significan nada.
   */
  readonly sinAjustesDeNegocio = input(false);
  /** Conversación que se abre al cargar: el enlace del correo que avisa a los asesores. */
  readonly conversacionInicial = input<string | null>(null);
  private conversacionInicialAbierta = false;
  readonly gestionarNumero = output<void>();

  readonly detalle = signal<ConversacionBandejaDetalle | null>(null);

  // ── Archivos de los clientes (fotos, stickers, audios…) ──
  // Se guardan aquí como URL `blob:` por id de mensaje: el hilo se recarga cada pocos segundos y
  // no hay que volver a pedírselos al servidor (que a su vez se los pide a Meta). Se liberan al
  // cambiar de conversación. El archivo nunca se guarda en el servidor (decisión del dueño).
  readonly archivos = signal<Record<string, EstadoArchivo>>({});
  readonly estadoDetalle = signal<LoadingState>('idle');

  /**
   * Se está trayendo un chat que todavía no se ve (2026-11-11): se pinta un esqueleto en vez de la
   * pantalla en blanco —o, en escritorio, en vez del chat ANTERIOR, que hacía creer que el clic no
   * había hecho nada—. La fila de la lista da el nombre mientras tanto.
   */
  readonly cargandoChat = computed(() => {
    const id = this.abierta();
    if (!id || this.estadoDetalle() !== 'loading') return null;
    if (this.detalle()?.conversacion.id_conversacion === id) return null;
    return this.conversaciones().find((c) => c.id_conversacion === id) ?? null;
  });
  readonly abierta = signal<string | null>(null);

  // ── Mejoras pedidas por AYM (2026-11-10) ─────────────────────────────────────────────────
  // Barra de 24 h con contador, hilo por páginas, archivos, emojis y respuestas rápidas («/»).
  // ⚠️ Viven igual en restaurante_app y catalogo_app: un cambio aquí va también a la otra.

  /** El reloj de la pantalla: mueve los contadores de 24 h sin pedir nada al servidor. */
  readonly ahora = signal(Date.now());
  private reloj: ReturnType<typeof setInterval> | null = null;
  private ticks = 0;
  private readonly alVolverALaPestana = (): void => {
    if (!document.hidden) this.refrescar();
  };

  /** Hay mensajes más viejos que los que se ven (el hilo llega de a 60). */
  readonly hayAnteriores = signal(false);
  readonly cargandoAnteriores = signal(false);

  /** Mensajes que se ven ya en el hilo pero el servidor todavía no confirmó (texto o archivo). */
  readonly locales = signal<MensajeBandeja[]>([]);

  /**
   * La ventana de 24 h del chat abierto, en vivo. Se calcula con el reloj de la pantalla a partir
   * de lo que dijo el servidor, así el contador baja solo y el botón se apaga en el minuto exacto.
   */
  readonly ventanaViva = computed(() => {
    const v = this.detalle()?.ventana;
    const expira = v?.expira_en ? Date.parse(v.expira_en) : NaN;
    if (!v || Number.isNaN(expira)) return { abierta: false, restanteMs: 0, fraccion: 0, nivel: 'cerrada' as NivelVentana };
    const restanteMs = Math.max(0, expira - this.ahora());
    return {
      abierta: restanteMs > 0,
      restanteMs,
      fraccion: Math.min(1, restanteMs / VENTANA_MS),
      nivel: nivelVentana(restanteMs),
    };
  });

  /** «Quedan 18 h 32 min» para el chat abierto. */
  readonly textoVentana = computed(() => textoRestante(this.ventanaViva().restanteMs));

  /** La ventana de una fila de la lista, o `null` si ya está cerrada (no se pinta nada). */
  ventanaDeLista(c: ConversacionBandeja): { texto: string; nivel: NivelVentana; fraccion: number } | null {
    if (!c.ultimo_entrante_en) return null;
    const restanteMs = Date.parse(c.ultimo_entrante_en) + VENTANA_MS - this.ahora();
    if (!(restanteMs > 0)) return null;
    return {
      texto: restanteMs >= 3600000 ? `${Math.floor(restanteMs / 3600000)} h` : `${Math.max(1, Math.floor(restanteMs / 60000))} min`,
      nivel: nivelVentana(restanteMs),
      fraccion: Math.min(1, restanteMs / VENTANA_MS),
    };
  }

  /** La vista previa de la lista: «📷 Foto» en vez de «[image]», y «Tú: » si lo último fue nuestro. */
  vistaPrevia(c: ConversacionBandeja): string {
    const tipo = c.ultimo_tipo ?? '';
    const texto = (c.ultimo_texto ?? '').trim();
    // «[image]» es como se guarda un archivo sin pie: se traduce aunque no venga `ultimo_tipo`.
    const marcado = /^\[(\w+)\]$/.exec(texto)?.[1];
    const delArchivo = ETIQUETA_ARCHIVO[tipo] ?? (marcado ? ETIQUETA_ARCHIVO[marcado] : undefined);
    const cuerpo = delArchivo && (!texto || marcado) ? delArchivo : this.sinMarcas(texto);
    if (!cuerpo) return '—';
    return c.ultimo_direccion === 'saliente' ? `Tú: ${cuerpo}` : cuerpo;
  }

  /** Trae los 60 mensajes anteriores sin mover lo que se está leyendo. */
  cargarAnteriores(): void {
    const d = this.detalle();
    const primero = d?.mensajes[0];
    if (!d || !primero || this.cargandoAnteriores()) return;
    const id = d.conversacion.id_conversacion;
    const caja = this.cajaMensajes()?.nativeElement;
    const altoAntes = caja?.scrollHeight ?? 0;
    this.cargandoAnteriores.set(true);
    this.service.getMensajesAnteriores(id, primero.creado_en).subscribe({
      next: ({ mensajes, hay_anteriores }) => {
        this.cargandoAnteriores.set(false);
        const actual = this.detalle();
        if (!actual || actual.conversacion.id_conversacion !== id) return;
        const ya = new Set(actual.mensajes.map((m) => m.id_mensaje));
        this.detalle.set({ ...actual, mensajes: [...mensajes.filter((m) => !ya.has(m.id_mensaje)), ...actual.mensajes] });
        this.hayAnteriores.set(hay_anteriores);
        this.pedirArchivos(id, mensajes);
        // Lo nuevo entra ARRIBA: se corre el scroll lo mismo que creció, y el mensaje que se
        // estaba leyendo no se mueve.
        setTimeout(() => {
          if (caja) caja.scrollTop += caja.scrollHeight - altoAntes;
        });
      },
      error: () => {
        this.cargandoAnteriores.set(false);
        this.toast.error('No se pudieron traer los mensajes anteriores.');
      },
    });
  }

  // ── Archivos para enviar ──

  /** El archivo elegido y su vista previa, mientras se escribe el pie. */
  readonly adjunto = signal<{ archivo: File; url: string | null; tipo: string } | null>(null);
  private readonly selectorArchivo = viewChild<ElementRef<HTMLInputElement>>('selectorArchivo');
  readonly aceptaArchivos = Object.keys(ARCHIVOS_WHATSAPP).join(',');

  elegirArchivo(): void {
    this.selectorArchivo()?.nativeElement.click();
  }

  alElegirArchivo(ev: Event): void {
    const entrada = ev.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (archivo) this.adjuntar(archivo);
  }

  /** Pegar una captura (Ctrl+V) la adjunta, como en WhatsApp Web. */
  alPegar(ev: ClipboardEvent): void {
    const archivo = Array.from(ev.clipboardData?.files ?? [])[0];
    if (!archivo) return;
    ev.preventDefault();
    this.adjuntar(archivo);
  }

  /** Soltar un archivo sobre el chat lo adjunta. */
  alSoltar(ev: DragEvent): void {
    const archivo = ev.dataTransfer?.files?.[0];
    if (!archivo) return;
    ev.preventDefault();
    if (this.ventanaViva().abierta) this.adjuntar(archivo);
  }

  /** Comprueba tipo y tamaño ANTES de subir: WhatsApp los rechazaría igual, pero tarde. */
  adjuntar(archivo: File): void {
    const regla = ARCHIVOS_WHATSAPP[(archivo.type || '').toLowerCase()];
    if (!regla) {
      this.errorEnvio.set('WhatsApp no acepta ese tipo de archivo. Fotos en JPG o PNG, videos en MP4, y documentos PDF, Word, Excel o PowerPoint.');
      return;
    }
    if (archivo.size > regla.max * 1024 * 1024) {
      this.errorEnvio.set(`Ese archivo pesa demasiado: WhatsApp acepta hasta ${regla.max} MB para este tipo.`);
      return;
    }
    this.quitarAdjunto();
    this.errorEnvio.set(null);
    const url = regla.tipo === 'image' || regla.tipo === 'video' ? URL.createObjectURL(archivo) : null;
    this.adjunto.set({ archivo, url, tipo: regla.tipo });
  }

  quitarAdjunto(): void {
    const a = this.adjunto();
    if (a?.url) URL.revokeObjectURL(a.url);
    this.adjunto.set(null);
  }

  tamanoLegible(bytes: number): string {
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  // ── Emojis ──

  readonly emojisAbierto = signal(false);
  readonly emojis = EMOJIS;
  private readonly cajaTexto = viewChild<ElementRef<HTMLTextAreaElement>>('cajaTexto');

  alternarEmojis(): void {
    this.emojisAbierto.update((v) => !v);
    this.rapidasAbierto.set(false);
  }

  /** Un toque fuera del panel de emojis (y de su botón) lo cierra. */
  alTocarFuera(ev: Event): void {
    if (!this.emojisAbierto()) return;
    const t = ev.target as Element | null;
    if (t?.closest?.('.bdj__emojis, [data-abre-emojis]')) return;
    this.emojisAbierto.set(false);
  }

  /**
   * Devuelve el cursor a la caja de escribir. Tras enviar, la persona suele seguir escribiendo
   * (2026-11-11): antes la caja se deshabilitaba mientras salía el mensaje y perdía el foco, y en
   * el celular se cerraba el teclado.
   */
  private enfocarCaja(): void {
    setTimeout(() => this.cajaTexto()?.nativeElement.focus());
  }

  /** Mete el emoji donde está el cursor, no al final. */
  ponerEmoji(emoji: string): void {
    this.insertarEnCursor(emoji);
  }

  private insertarEnCursor(texto: string): void {
    const caja = this.cajaTexto()?.nativeElement;
    const actual = this.borrador();
    const inicio = caja?.selectionStart ?? actual.length;
    const fin = caja?.selectionEnd ?? actual.length;
    this.borrador.set(actual.slice(0, inicio) + texto + actual.slice(fin));
    setTimeout(() => {
      if (!caja) return;
      caja.focus();
      caja.selectionStart = caja.selectionEnd = inicio + texto.length;
    });
  }

  // ── Respuestas rápidas («/atajo») ──

  readonly respuestasRapidas = signal<RespuestaRapida[]>([]);
  readonly rapidasAbierto = signal(false);
  readonly rapidaMarcada = signal(0);
  /** Se cerró la lista con Escape: no vuelve a abrirse hasta que cambie lo escrito. */
  private readonly rapidasDescartadas = signal<string | null>(null);

  /** Lo que va después de «/» mientras se escribe el atajo, o `null` si no se está escribiendo uno. */
  private readonly consultaRapida = computed(() => {
    const m = /^\/([^\s]*)$/.exec(this.borrador());
    return m ? m[1].toLowerCase() : null;
  });

  /** Las sugerencias: las que empiezan por lo escrito primero, después las que lo contienen. */
  readonly sugerenciasRapidas = computed<RespuestaRapida[]>(() => {
    const q = this.consultaRapida();
    const todas = this.respuestasRapidas();
    if (this.rapidasAbierto()) return todas;
    if (q === null || this.rapidasDescartadas() === this.borrador()) return [];
    const empieza = todas.filter((r) => r.atajo.startsWith(q));
    const contiene = todas.filter((r) => !r.atajo.startsWith(q) && (r.atajo.includes(q) || r.texto.toLowerCase().includes(q)));
    return [...empieza, ...contiene].slice(0, 8);
  });

  readonly mostrandoRapidas = computed(
    () => this.rapidasAbierto() || (this.consultaRapida() !== null && this.rapidasDescartadas() !== this.borrador()),
  );

  alternarRapidas(): void {
    this.rapidasAbierto.update((v) => !v);
    this.emojisAbierto.set(false);
    this.rapidaMarcada.set(0);
  }

  /** Pone el texto guardado en la caja, con {nombre} ya cambiado por el del cliente. */
  usarRapida(r: RespuestaRapida): void {
    const c = this.detalle()?.conversacion;
    const nombre = c ? this.primerNombre(c) : '';
    const texto = r.texto.replace(/\{nombre\}/gi, nombre).replace(/\s+([,.!?])/g, '$1');
    this.borrador.set(texto);
    this.rapidasAbierto.set(false);
    this.rapidaMarcada.set(0);
    setTimeout(() => {
      const caja = this.cajaTexto()?.nativeElement;
      if (!caja) return;
      caja.focus();
      caja.selectionStart = caja.selectionEnd = texto.length;
    });
  }

  /** ↑ ↓ eligen, Enter o Tab ponen, Escape cierra. Devuelve si la tecla se usó aquí. */
  private teclaEnRapidas(e: KeyboardEvent): boolean {
    if (!this.mostrandoRapidas()) return false;
    const lista = this.sugerenciasRapidas();
    if (e.key === 'Escape') {
      this.rapidasAbierto.set(false);
      this.rapidasDescartadas.set(this.borrador());
      return true;
    }
    if (!lista.length) return false;
    if (e.key === 'ArrowDown') {
      this.rapidaMarcada.update((i) => (i + 1) % lista.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      this.rapidaMarcada.update((i) => (i - 1 + lista.length) % lista.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      this.usarRapida(lista[Math.min(this.rapidaMarcada(), lista.length - 1)]);
      return true;
    }
    return false;
  }

  alTeclear(ev: KeyboardEvent): void {
    if (this.teclaEnRapidas(ev)) {
      ev.preventDefault();
      return;
    }
    if (ev.key === 'Escape') this.emojisAbierto.set(false);
  }

  private cargarRapidas(): void {
    const id = this.negocioConfig();
    if (id === null) return;
    this.service.getRespuestasRapidas(id).subscribe({
      next: (lista) => this.respuestasRapidas.set(lista),
      error: () => this.respuestasRapidas.set([]),
    });
  }

  // La ventana para crear y editar las respuestas rápidas.
  readonly gestionRapidas = signal(false);
  readonly rapidaEditando = signal<number | null>(null);
  readonly rapidaAtajo = signal('');
  readonly rapidaTexto = signal('');
  readonly guardandoRapida = signal(false);
  readonly errorRapida = signal<string | null>(null);

  abrirGestionRapidas(): void {
    this.rapidasAbierto.set(false);
    this.nuevaRapida();
    this.gestionRapidas.set(true);
  }

  cerrarGestionRapidas(): void {
    if (this.guardandoRapida()) return;
    this.gestionRapidas.set(false);
  }

  nuevaRapida(): void {
    this.rapidaEditando.set(null);
    this.rapidaAtajo.set('');
    this.rapidaTexto.set('');
    this.errorRapida.set(null);
  }

  editarRapida(r: RespuestaRapida): void {
    this.rapidaEditando.set(r.id_respuesta);
    this.rapidaAtajo.set(r.atajo);
    this.rapidaTexto.set(r.texto);
    this.errorRapida.set(null);
  }

  guardarRapida(): void {
    const id = this.negocioConfig();
    const atajo = this.rapidaAtajo().trim().replace(/^\/+/, '');
    const texto = this.rapidaTexto().trim();
    if (id === null || !atajo || !texto) {
      this.errorRapida.set('Escribe el atajo y el mensaje.');
      return;
    }
    this.guardandoRapida.set(true);
    this.errorRapida.set(null);
    this.service.guardarRespuestaRapida(id, { atajo, texto }, this.rapidaEditando()).subscribe({
      next: () => {
        this.guardandoRapida.set(false);
        this.nuevaRapida();
        this.cargarRapidas();
      },
      error: (err) => {
        this.guardandoRapida.set(false);
        this.errorRapida.set(err?.error?.message ?? 'No se pudo guardar la respuesta rápida.');
      },
    });
  }

  eliminarRapida(r: RespuestaRapida): void {
    const id = this.negocioConfig();
    if (id === null) return;
    this.service.eliminarRespuestaRapida(id, r.id_respuesta).subscribe({
      next: () => {
        if (this.rapidaEditando() === r.id_respuesta) this.nuevaRapida();
        this.cargarRapidas();
      },
      error: (err) => this.errorRapida.set(err?.error?.message ?? 'No se pudo eliminar.'),
    });
  }

  /** El primer nombre del cliente para «{nombre}»: el guardado, o el de su perfil si es un nombre. */
  primerNombre(c: ConversacionBandeja): string {
    const fuente = this.tieneNombre(c) ? c.persona! : (c.perfil_nombre ?? '');
    const palabra = fuente.trim().split(/\s+/)[0] ?? '';
    return /^[\p{L}][\p{L}'.-]*$/u.test(palabra) ? palabra : '';
  }

  // ── El asistente vuelve solo (ADR-023, Enmienda 2) ────────────────────────────────────────
  //
  // Decisión EXPLÍCITA del negocio: pasados N minutos desde la última intervención de una persona,
  // el siguiente mensaje del cliente lo atiende el asistente. «Nunca» (0) es el valor de fábrica.
  // La configuración es por NEGOCIO, así que solo se enseña cuando hay un negocio determinado.

  /** El negocio de la configuración: el fijado, el filtrado, o el único que hay. */
  readonly negocioConfig = computed<number | null>(
    () =>
      this.negocioFijo() ??
      this.negocioActivo() ??
      (this.negocios().length === 1 ? this.negocios()[0].id_negocio : null),
  );
  readonly config = signal<ConfiguracionReactivacion | null>(null);
  /** Lo que se está editando; `config` es lo guardado. */
  readonly autoNunca = signal(true);
  readonly autoMinutos = signal(30);
  readonly guardandoConfig = signal(false);

  readonly autoSucio = computed(() => {
    const c = this.config();
    if (!c) return false;
    return (this.autoNunca() ? 0 : this.autoMinutos()) !== c.reactivar_asistente_min;
  });
  readonly autoValido = computed(() => {
    if (this.autoNunca()) return true;
    const m = this.autoMinutos();
    return Number.isInteger(m) && m >= 1 && m <= 1440;
  });

  // ── Tiempo estimado de entrega ──
  // Lo que el asistente contesta a «¿cuánto se demora?»: «de 40 a 60 minutos», o «unos 45» si solo
  // hay mínimo. Vacío = el negocio no lo ha dicho y el asistente no inventa ninguno.
  readonly tiempoMin = signal<number | null>(null);
  readonly tiempoMax = signal<number | null>(null);
  readonly guardandoTiempo = signal(false);
  // Tiempo de un pedido para recoger: aparte del de entrega, que incluye el camino.
  readonly recogerMin = signal<number | null>(null);
  readonly recogerMax = signal<number | null>(null);
  readonly guardandoRecoger = signal(false);

  // ── Valor del domicilio ──
  // Un rango («entre $7.000 y $9.000») y una nota corta («Fuera de la ciudad, desde $10.000»).
  // Reemplaza cargar el precio barrio por barrio, que era tedioso. Vacío = el asistente no dice
  // ningún valor.
  readonly domicilioMin = signal<number | null>(null);
  readonly domicilioMax = signal<number | null>(null);
  readonly domicilioNota = signal('');
  readonly guardandoDomicilio = signal(false);
  readonly domicilioSucio = computed(() => {
    const c = this.config();
    if (!c) return false;
    return (
      this.domicilioMin() !== (c.domicilio_valor_min ?? null) ||
      this.domicilioMax() !== (c.domicilio_valor_max ?? null) ||
      this.domicilioNota().trim() !== (c.domicilio_nota ?? '').trim()
    );
  });
  readonly domicilioValido = computed(() => {
    const min = this.domicilioMin();
    const max = this.domicilioMax();
    const pesos = (n: number) => Number.isInteger(n) && n >= 0 && n <= 10_000_000;
    if (this.domicilioNota().length > 200) return false;
    if (min === null) return max === null; // sin mínimo no hay máximo
    if (!pesos(min)) return false;
    return max === null || (pesos(max) && max >= min);
  });

  // ── Lo que le falta al asistente para atender bien ──
  // Revisión que hace el backend (horario, carta, tiempo de entrega, pagos…). Se abre sola la
  // primera vez que el negocio entra con algo pendiente —justo después de conectar el número—, y
  // se puede cerrar: no vuelve a abrirse sola en esa sesión para ese negocio.
  readonly preparacion = signal<PreparacionAsistente | null>(null);
  readonly prepAbierta = signal(false);
  readonly puntosPendientes = computed(
    () => this.preparacion()?.puntos.filter((p) => p.estado !== 'ok') ?? [],
  );
  readonly puntosListos = computed(
    () => this.preparacion()?.puntos.filter((p) => p.estado === 'ok').length ?? 0,
  );

  // ── Información libre para el asistente ──
  // Pagos, Nequi, valor del domicilio…: lo que ninguna tabla dice y el cliente pregunta. El
  // asistente la lee con `consultar_info_negocio`. Vacío = no se le dice nada extra.
  readonly infoAbierta = signal(false);
  /** La ventana «Configuración del asistente» (vuelve tras, entrega, domicilio, info). */
  readonly configAbierta = signal(false);
  readonly infoTexto = signal('');
  readonly guardandoInfo = signal(false);

  // ── Diagnóstico a fondo de la carta (2026-10-05) ─────────────────────────────────────────
  readonly diagnostico = signal<DiagnosticoAsistente | null>(null);
  readonly diagnosticando = signal(false);

  /** Revisa la carta a fondo. Bajo demanda: hace decenas de búsquedas en el servidor. */
  revisarCartaAFondo(): void {
    const id = this.negocioConfig();
    if (id === null || this.diagnosticando()) return;
    this.diagnosticando.set(true);
    this.service.getDiagnostico(id).subscribe({
      next: (d) => {
        this.diagnosticando.set(false);
        if (this.negocioConfig() !== id) return;
        this.diagnostico.set(d);
        this.anteriorRevision.set(null);
        this.cargarHistorialAnalisis(id, { soloLista: true });
      },
      error: (err) => {
        this.diagnosticando.set(false);
        this.toast.errorHttp(err, 'No se pudo revisar la carta.');
      },
    });
  }

  // ── Informe con las conversaciones reales (fase 3 del diagnóstico) ───────────────────────
  readonly informeAbierto = signal(false);
  readonly informe = signal<InformeAsistente | null>(null);
  readonly cargandoInforme = signal(false);
  readonly informeDias = signal(7);

  /** Abre el panel y, la primera vez, pide el informe. */
  alternarInforme(): void {
    this.informeAbierto.update((v) => !v);
    if (this.informeAbierto() && !this.informe()) this.cargarInforme(this.informeDias());
  }

  cargarInforme(dias: number): void {
    const id = this.negocioConfig();
    if (id === null || this.cargandoInforme()) return;
    this.informeDias.set(dias);
    this.cargandoInforme.set(true);
    this.service.getInforme(id, dias).subscribe({
      next: (r) => {
        this.cargandoInforme.set(false);
        if (this.negocioConfig() === id) this.informe.set(r);
      },
      error: (err) => {
        this.cargandoInforme.set(false);
        this.toast.errorHttp(err, 'No se pudo generar el informe.');
      },
    });
  }

  /** «+12 %» / «−8 %» frente al periodo anterior; vacío si no había con qué comparar. */
  variacion(actual: number, anterior: number): string {
    if (!anterior) return '';
    const p = Math.round((100 * (actual - anterior)) / anterior);
    return p === 0 ? 'igual que antes' : `${p > 0 ? '+' : '−'}${Math.abs(p)} % frente al periodo anterior`;
  }

  // ── Recomendaciones con IA (fase 2 del diagnóstico) ──────────────────────────────────────
  readonly recomendaciones = signal<RecomendacionesAsistente | null>(null);
  readonly recomendando = signal(false);
  /** Cómo se dice cada acción en la pantalla. */
  readonly ACCION_TEXTO: Record<string, string> = {
    renombrar: 'Cambiar el nombre',
    separar: 'Separar',
    describir: 'Añadir descripción',
    revisar_precio: 'Revisar el precio',
    ocultar: 'Ocultar',
    otro: 'Revisar',
  };

  /** Le pide a la IA el arreglo concreto de la carta. Solo recomienda: nada cambia. */
  pedirRecomendaciones(forzar = false): void {
    const id = this.negocioConfig();
    if (id === null || this.recomendando()) return;
    this.recomendando.set(true);
    this.service.pedirRecomendaciones(id, forzar).subscribe({
      next: (r) => {
        this.recomendando.set(false);
        if (this.negocioConfig() !== id) return;
        this.recomendaciones.set(r);
        this.anteriorIa.set(null);
        if (r?.cupo_ia) this.cupoIa.set(r.cupo_ia);
        this.cargarHistorialAnalisis(id, { soloLista: true });
      },
      error: (err) => {
        this.recomendando.set(false);
        this.toast.errorHttp(err, 'No se pudieron generar las recomendaciones.');
      },
    });
  }

  // ── Historial de análisis y cupo de IA (2026-11-03) ─────────────────────────────────────
  // La revisión a fondo y el análisis con IA se guardan en el servidor: al abrir «¿Está listo?»
  // se ve el último de cada uno, y la lista de los anteriores. Antes se perdían al cerrar la
  // ventana, aunque el de IA ya se había pagado.
  readonly historialAnalisis = signal<AnalisisResumido[]>([]);
  readonly cupoIa = signal<CupoIaNegocio | null>(null);
  /** Si se está mirando un análisis anterior (no el último), cuál. */
  readonly anteriorRevision = signal<AnalisisResumido | null>(null);
  readonly anteriorIa = signal<AnalisisResumido | null>(null);
  readonly historialAbierto = signal(false);
  readonly abriendoAnalisis = signal<number | null>(null);

  /**
   * Sin cupo de IA del mes no se puede analizar. El tope de lecturas AL DÍA es solo de la carga
   * de la carta, así que aquí no cuenta.
   */
  readonly sinCupoIa = computed(() => {
    const c = this.cupoIa();
    return !!c && !c.disponible && (c.motivo === 'mes' || c.motivo === 'plataforma');
  });

  /** `soloLista`: refresca la lista y el cupo sin pisar lo que está en pantalla. */
  cargarHistorialAnalisis(idNegocio: number, { soloLista = false } = {}): void {
    this.service.getHistorialAnalisis(idNegocio).subscribe({
      next: (h) => {
        if (!h || this.negocioConfig() !== idNegocio) return;
        this.historialAnalisis.set(h.historial);
        this.cupoIa.set(h.cupo_ia);
        if (soloLista) return;
        if (h.ultima_revision) this.diagnostico.set(h.ultima_revision);
        if (h.ultimo_ia) this.recomendaciones.set(h.ultimo_ia);
        this.anteriorRevision.set(null);
        this.anteriorIa.set(null);
      },
      // Quien no es administrador no tiene historial (404): la pantalla sigue como antes.
      error: () => undefined,
    });
  }

  /** Abre un análisis anterior en su sección («Viendo el análisis del …»). */
  verAnalisis(a: AnalisisResumido): void {
    const id = this.negocioConfig();
    if (id === null || this.abriendoAnalisis() !== null) return;
    this.abriendoAnalisis.set(a.id_analisis);
    this.service.getAnalisis(id, a.id_analisis).subscribe({
      next: (r) => {
        this.abriendoAnalisis.set(null);
        if (!r || this.negocioConfig() !== id) return;
        const ultimo = this.historialAnalisis().find((x) => x.tipo === a.tipo);
        const esElUltimo = ultimo?.id_analisis === a.id_analisis;
        if (a.tipo === 'revision') {
          this.diagnostico.set(r);
          this.anteriorRevision.set(esElUltimo ? null : a);
        } else {
          this.recomendaciones.set(r);
          this.anteriorIa.set(esElUltimo ? null : a);
        }
        this.historialAbierto.set(false);
      },
      error: (err) => {
        this.abriendoAnalisis.set(null);
        this.toast.errorHttp(err, 'No se pudo abrir ese análisis.');
      },
    });
  }

  /** Vuelve al último análisis de ese tipo. */
  volverAlUltimo(tipo: 'revision' | 'ia'): void {
    const ultimo = this.historialAnalisis().find((x) => x.tipo === tipo);
    if (ultimo) this.verAnalisis(ultimo);
  }

  /** «3 nov., 10:20 p. m.» (la fecha viene en hora de Bogotá, sin zona). */
  fechaAnalisis(valor: string | null | undefined): string {
    if (!valor) return '';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '';
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(fecha);
  }

  /** La línea de cada análisis en la lista del historial. */
  resumenAnalisis(a: AnalisisResumido): string {
    if (a.tipo === 'revision') {
      const n = a.resumen.pendientes ?? 0;
      return n === 0 ? 'Revisión de la carta · sin puntos por mejorar' : `Revisión de la carta · ${n} ${n === 1 ? 'punto' : 'puntos'} por mejorar`;
    }
    const c = a.resumen.cambios ?? 0;
    return `Análisis con IA · ${c} ${c === 1 ? 'cambio propuesto' : 'cambios propuestos'}`;
  }

  // ── Personalidad del asistente (2026-11-03) ─────────────────────────────────────────────
  /** El nombre del negocio de los ajustes, para la vista previa del saludo. */
  readonly nombreNegocioConfig = computed(() => {
    const id = this.negocioConfig();
    return this.negocios().find((n) => n.id_negocio === id)?.nombre ?? '';
  });

  personalidadGuardada(p: PersonalidadAsistente | null): void {
    const c = this.config();
    if (c) this.config.set({ ...c, asistente_personalidad: p });
    this.toast.exito(
      p ? 'Listo: así se presentará el asistente desde el próximo saludo.' : 'El asistente vuelve a presentarse como siempre.',
    );
  }

  personalidadFallo(err: unknown): void {
    this.toast.errorHttp(err, 'No se pudo guardar cómo se presenta el asistente.');
  }

  // ── Inventario (2026-10-07) ─────────────────────────────────────────────────────────────
  // Que el asistente mire las existencias es una decisión aparte de controlar inventario en
  // caja: se puede tener una encendida y la otra no, en cualquier combinación.
  readonly cambiandoStock = signal(false);
  readonly miraStock = computed(() => this.config()?.asistente_mira_stock === true);
  /** El control de caja, solo para avisar de cómo se combinan. */
  readonly cajaControlaInventario = computed(() => this.config()?.controla_inventario === true);

  alternarMiraStock(activo: boolean): void {
    const c = this.config();
    if (!c || !c.puede_editar || this.cambiandoStock()) return;
    this.cambiandoStock.set(true);
    this.service.guardarMiraStock(c.id_negocio, activo).subscribe({
      next: (r) => {
        this.cambiandoStock.set(false);
        this.config.set({ ...c, asistente_mira_stock: r?.asistente_mira_stock ?? activo });
        this.toast.exito(
          activo
            ? 'El asistente tendrá en cuenta el inventario.'
            : 'El asistente ya no tendrá en cuenta el inventario.',
        );
      },
      error: (err) => {
        this.cambiandoStock.set(false);
        // El interruptor vuelve a como estaba: se repinta desde la configuración.
        this.config.set({ ...c });
        this.toast.errorHttp(err, 'No se pudo cambiar el ajuste de inventario.');
      },
    });
  }

  // ── Pausa de emergencia (2026-10-04: Zona Burger sin papas) ─────────────────────────────
  readonly cambiandoPausa = signal(false);
  readonly pausado = computed(() => this.config()?.asistente_pausado === true);

  /** Pausa o reanuda el asistente de este negocio. Un clic: es para emergencias. */
  alternarPausa(): void {
    const c = this.config();
    if (!c || !c.puede_editar || this.cambiandoPausa()) return;
    const pausar = !this.pausado();
    this.cambiandoPausa.set(true);
    this.service.pausarAsistente(c.id_negocio, pausar).subscribe({
      next: (r) => {
        this.cambiandoPausa.set(false);
        this.config.set({
          ...c,
          asistente_pausado: r?.asistente_pausado ?? pausar,
          asistente_pausado_en: r?.asistente_pausado_en ?? null,
        });
        this.toast.exito(
          pausar
            ? 'Asistente en pausa: no le contesta a nadie. Los mensajes te llegan aquí.'
            : 'El asistente volvió a contestar.',
        );
      },
      error: (err) => {
        this.cambiandoPausa.set(false);
        this.toast.errorHttp(err, 'No se pudo cambiar la pausa del asistente.');
      },
    });
  }
  readonly infoSucia = computed(() => {
    const c = this.config();
    if (!c) return false;
    return this.infoTexto().trim() !== (c.info_asistente ?? '').trim();
  });

  readonly tiempoSucio = computed(() => {
    const c = this.config();
    if (!c) return false;
    return (
      this.tiempoMin() !== (c.tiempo_estimado_min ?? null) ||
      this.tiempoMax() !== (c.tiempo_estimado_max ?? null)
    );
  });
  readonly recogerSucio = computed(() => {
    const c = this.config();
    if (!c) return false;
    return (
      this.recogerMin() !== (c.tiempo_recoger_min ?? null) ||
      this.recogerMax() !== (c.tiempo_recoger_max ?? null)
    );
  });
  readonly recogerValido = computed(() => {
    const min = this.recogerMin();
    const max = this.recogerMax();
    const entero = (n: number) => Number.isInteger(n) && n >= 1 && n <= 600;
    if (min === null) return max === null;
    if (!entero(min)) return false;
    return max === null || (entero(max) && max >= min);
  });
  readonly tiempoValido = computed(() => {
    const min = this.tiempoMin();
    const max = this.tiempoMax();
    const entero = (n: number) => Number.isInteger(n) && n >= 1 && n <= 600;
    if (min === null) return max === null; // sin mínimo no hay máximo
    if (!entero(min)) return false;
    return max === null || (entero(max) && max >= min);
  });

  /** Recarga la configuración cada vez que cambia el negocio en pantalla. */
  private readonly recargaConfig = effect(() => {
    const id = this.negocioConfig();
    untracked(() => this.cargarConfig(id));
  });

  /** El conteo, con ceros mientras no hay conversación abierta o el entorno no lo tiene. */
  readonly reportes = computed<ReportesConversacion>(
    () =>
      this.detalle()?.reportes ?? {
        persona: 0,
        conversacion: 0,
        del_asistente: 0,
        mio: null,
        ultimo: null,
      },
  );

  readonly borrador = signal('');
  readonly enviando = signal(false);
  /** Error del envío, separado del de la lista: son dos fallos con dos remedios distintos. */
  readonly errorEnvio = signal<string | null>(null);

  // ── Bloquear un número (moderación del propio negocio, no un STOP legal) ──
  /** El clic en «Bloquear» abre esta confirmación en vez de bloquear al toque. */
  readonly confirmandoBloqueo = signal(false);
  readonly motivoBloqueo = signal('');
  readonly bloqueando = signal(false);
  readonly errorBloqueo = signal<string | null>(null);

  /**
   * Los negocios que TIENEN conversaciones, tal como los devuelve el backend.
   *
   * Antes salían de la sesión, y eso ponía una pastilla por cada negocio del usuario —
   * parqueadero, gimnasio, tienda—, ninguno de los cuales va a tener nunca una conversación.
   * Eran filtros que no filtran nada.
   */
  readonly negocios = signal<NegocioConConversaciones[]>([]);
  readonly variosNegocios = computed(
    () => this.negocioFijo() === null && this.negocios().length > 1,
  );

  readonly escaladas = computed(() => this.conversaciones().filter((c) => c.escalada).length);

  /** La búsqueda sí es local: filtra lo que ya está en pantalla, como la de WhatsApp. */
  // ── Conversaciones que esperan respuesta y YA se abrieron ──
  // Pedido del dueño (2026-10-02): el recuadro de «espera respuesta» se quita al ABRIR la
  // conversación, sin tener que contestar. Se recuerda el último mensaje visto: si el cliente
  // vuelve a escribir, `ultimo_mensaje_en` cambia y el recuadro vuelve. Es una comodidad de quien
  // mira (localStorage, por navegador): no cambia «Esperan respuesta» para nadie más.
  private static readonly CLAVE_VISTAS = 'bandeja_vistas_v1';
  private static readonly MAX_VISTAS = 300;
  readonly vistas = signal<Record<string, string>>(this.leerVistas());

  /** ¿Lleva el recuadro? Espera respuesta, estamos en «Todos» y no se ha abierto desde su último mensaje. */
  recuadroEspera(c: ConversacionBandeja): boolean {
    if (!c.escalada || this.soloEscaladas()) return false;
    const visto = this.vistas()[c.id_conversacion];
    return !visto || visto !== String(c.ultimo_mensaje_en ?? c.creado_en);
  }

  private marcarVista(c: ConversacionBandeja): void {
    const marca = String(c.ultimo_mensaje_en ?? c.creado_en);
    if (this.vistas()[c.id_conversacion] === marca) return;
    const nuevas = { ...this.vistas(), [c.id_conversacion]: marca };
    // Tope: las más viejas se olvidan (el orden de inserción de un objeto se conserva).
    const claves = Object.keys(nuevas);
    for (const k of claves.slice(0, Math.max(0, claves.length - BandejaComponent.MAX_VISTAS))) delete nuevas[k];
    this.vistas.set(nuevas);
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(BandejaComponent.CLAVE_VISTAS, JSON.stringify(nuevas));
    } catch {
      /* Sin almacenamiento: el recuadro vuelve a salir al recargar. */
    }
  }

  private leerVistas(): Record<string, string> {
    if (!isPlatformBrowser(this.platformId)) return {};
    try {
      const v = JSON.parse(localStorage.getItem(BandejaComponent.CLAVE_VISTAS) ?? '{}');
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  }

  readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const lista = q
      ? this.conversaciones().filter((c) =>
          `${this.quien(c)} ${c.perfil_nombre ?? ''} ${c.id_externo} ${c.ultimo_texto ?? ''}`.toLowerCase().includes(q),
        )
      : this.conversaciones();
    // Por fecha, como siempre: anclar arriba las que esperan respuesta se probó y se retiró el
    // mismo día (2026-10-02) — muchas «esperaban» solo un «gracias». Se distinguen por el recuadro.
    return lista;
  });

  readonly puedeEnviar = computed(
    () =>
      !this.enviando() &&
      (this.borrador().trim().length > 0 || this.adjunto() !== null) &&
      this.ventanaViva().abierta,
  );

  private cargarConfig(idNegocio: number | null): void {
    if (idNegocio === null) {
      this.config.set(null);
      this.diagnostico.set(null);
      this.recomendaciones.set(null);
      this.historialAnalisis.set([]);
      this.cupoIa.set(null);
      this.informe.set(null);
      this.informeAbierto.set(false);
      this.preparacion.set(null);
      this.prepAbierta.set(false);
      return;
    }
    if (!this.sinAjustesDeNegocio()) this.cargarPreparacion(idNegocio, true);
    this.diagnostico.set(null);
    this.recomendaciones.set(null);
    // El historial de análisis es de los mismos ajustes del negocio: sin ellos no hay nada que leer.
    if (!this.sinAjustesDeNegocio()) this.cargarHistorialAnalisis(idNegocio);
    this.service.getConfiguracion(idNegocio).subscribe({
      next: (c) => {
        // El negocio pudo cambiar mientras la respuesta venía.
        if (this.negocioConfig() !== idNegocio) return;
        this.config.set(c);
        if (c) {
          this.autoNunca.set(c.reactivar_asistente_min === 0);
          this.autoMinutos.set(c.reactivar_asistente_min > 0 ? c.reactivar_asistente_min : 30);
          this.tiempoMin.set(c.tiempo_estimado_min ?? null);
          this.tiempoMax.set(c.tiempo_estimado_max ?? null);
          this.recogerMin.set(c.tiempo_recoger_min ?? null);
          this.recogerMax.set(c.tiempo_recoger_max ?? null);
          this.infoTexto.set(c.info_asistente ?? '');
          this.domicilioMin.set(c.domicilio_valor_min ?? null);
          this.domicilioMax.set(c.domicilio_valor_max ?? null);
          this.domicilioNota.set(c.domicilio_nota ?? '');
        }
      },
      error: () => this.config.set(null),
    });
  }

  private claveVistaPrep(idNegocio: number): string {
    return `escalapp.preparacion.vista.${idNegocio}`;
  }

  /** `abrirSiFalta`: al entrar al negocio, se abre sola si hay algo pendiente y no se cerró antes. */
  cargarPreparacion(idNegocio: number, abrirSiFalta = false): void {
    this.service.getPreparacion(idNegocio).subscribe({
      next: (p) => {
        if (this.negocioConfig() !== idNegocio) return;
        this.preparacion.set(p);
        if (!abrirSiFalta || !p || p.pendientes === 0) return;
        let yaVista = false;
        if (isPlatformBrowser(this.platformId)) {
          try {
            yaVista = sessionStorage.getItem(this.claveVistaPrep(idNegocio)) === '1';
          } catch {
            yaVista = false;
          }
        }
        if (!yaVista) this.prepAbierta.set(true);
      },
      error: () => this.preparacion.set(null),
    });
  }

  cerrarPreparacion(): void {
    this.prepAbierta.set(false);
    const id = this.negocioConfig();
    if (id === null || !isPlatformBrowser(this.platformId)) return;
    try {
      sessionStorage.setItem(this.claveVistaPrep(id), '1');
    } catch {
      /* sin almacenamiento: solo se vuelve a abrir al recargar */
    }
  }

  /** Tras guardar algo aquí mismo, la lista se pone al día. */
  private refrescarPreparacion(): void {
    const id = this.negocioConfig();
    if (id !== null) this.cargarPreparacion(id);
  }

  guardarInfo(): void {
    const c = this.config();
    if (!c || !this.infoSucia() || this.guardandoInfo()) return;

    const texto = this.infoTexto().trim();
    this.guardandoInfo.set(true);
    this.service.guardarInfoAsistente(c.id_negocio, texto || null).subscribe({
      next: () => {
        this.guardandoInfo.set(false);
        this.config.set({ ...c, info_asistente: texto || null });
        this.infoTexto.set(texto);
        this.refrescarPreparacion();
        this.toast.exito(
          texto
            ? 'El asistente ya puede usar esta información con tus clientes.'
            : 'Se borró la información para el asistente.',
        );
      },
      error: (err) => {
        this.guardandoInfo.set(false);
        this.toast.errorHttp(err, 'No se pudo guardar la información para el asistente.');
      },
    });
  }

  guardarTiempo(): void {
    const c = this.config();
    if (!c || !this.tiempoSucio() || !this.tiempoValido() || this.guardandoTiempo()) return;

    const min = this.tiempoMin();
    const max = min === null ? null : this.tiempoMax();
    this.guardandoTiempo.set(true);
    this.service.guardarTiempoEstimado(c.id_negocio, min, max).subscribe({
      next: () => {
        this.guardandoTiempo.set(false);
        this.config.set({ ...c, tiempo_estimado_min: min, tiempo_estimado_max: max });
        this.tiempoMax.set(max);
        this.refrescarPreparacion();
        this.toast.exito(
          min === null
            ? 'El asistente ya no dará un tiempo estimado de entrega.'
            : max !== null && max > min
              ? `El asistente dirá que el pedido tarda de ${min} a ${max} minutos.`
              : `El asistente dirá que el pedido tarda unos ${min} minutos.`,
        );
      },
      error: (err) => {
        this.guardandoTiempo.set(false);
        this.toast.errorHttp(err, 'No se pudo guardar el tiempo estimado.');
      },
    });
  }

  guardarRecoger(): void {
    const c = this.config();
    if (!c || !this.recogerSucio() || !this.recogerValido() || this.guardandoRecoger()) return;

    const min = this.recogerMin();
    const max = min === null ? null : this.recogerMax();
    this.guardandoRecoger.set(true);
    this.service.guardarTiempoRecoger(c.id_negocio, min, max).subscribe({
      next: () => {
        this.guardandoRecoger.set(false);
        this.config.set({ ...c, tiempo_recoger_min: min, tiempo_recoger_max: max });
        this.recogerMax.set(max);
        this.toast.exito(
          min === null
            ? 'Para recoger, el asistente dirá el mismo tiempo que para la entrega.'
            : max !== null && max > min
              ? `El asistente dirá que un pedido para recoger tarda de ${min} a ${max} minutos.`
              : `El asistente dirá que un pedido para recoger tarda unos ${min} minutos.`,
        );
      },
      error: (err) => {
        this.guardandoRecoger.set(false);
        this.toast.errorHttp(err, 'No se pudo guardar el tiempo para recoger.');
      },
    });
  }

  guardarDomicilio(): void {
    const c = this.config();
    if (!c || !this.domicilioSucio() || !this.domicilioValido() || this.guardandoDomicilio()) return;

    const min = this.domicilioMin();
    // Un «máximo» igual al mínimo no es un rango: se guarda como valor único.
    const maxCrudo = min === null ? null : this.domicilioMax();
    const max = maxCrudo !== null && maxCrudo === min ? null : maxCrudo;
    const nota = this.domicilioNota().trim() || null;
    this.guardandoDomicilio.set(true);
    this.service.guardarDomicilio(c.id_negocio, min, max, nota).subscribe({
      next: () => {
        this.guardandoDomicilio.set(false);
        this.config.set({
          ...c,
          domicilio_valor_min: min,
          domicilio_valor_max: max,
          domicilio_nota: nota,
        });
        this.domicilioMax.set(max);
        this.domicilioNota.set(nota ?? '');
        this.refrescarPreparacion();
        const pesos = (n: number) => `$${n.toLocaleString('es-CO')}`;
        this.toast.exito(
          min === null && !nota
            ? 'El asistente ya no dirá el valor del domicilio.'
            : min === null
              ? 'El asistente dirá tu nota sobre el domicilio.'
              : max !== null
                ? `El asistente dirá que el domicilio vale entre ${pesos(min)} y ${pesos(max)}.`
                : `El asistente dirá que el domicilio vale desde ${pesos(min)}.`,
        );
      },
      error: (err) => {
        this.guardandoDomicilio.set(false);
        this.toast.errorHttp(err, 'No se pudo guardar el valor del domicilio.');
      },
    });
  }

  guardarConfig(): void {
    const c = this.config();
    if (!c || !this.autoSucio() || !this.autoValido() || this.guardandoConfig()) return;

    const minutos = this.autoNunca() ? 0 : this.autoMinutos();
    this.guardandoConfig.set(true);
    this.service.guardarConfiguracion(c.id_negocio, minutos).subscribe({
      next: () => {
        this.guardandoConfig.set(false);
        this.config.set({ ...c, reactivar_asistente_min: minutos });
        this.refrescarPreparacion();
        this.detalle.update((d) =>
          d && d.conversacion.id_negocio === c.id_negocio
            ? { ...d, conversacion: { ...d.conversacion, reactivar_asistente_min: minutos } }
            : d,
        );
        this.toast.exito(
          minutos === 0
            ? 'El asistente ya no volverá solo a las conversaciones que atienda una persona.'
            : `El asistente volverá solo ${minutos} min después de la última respuesta de una persona.`,
        );
      },
      error: (err) => {
        this.guardandoConfig.set(false);
        this.toast.errorHttp(err, 'No se pudo guardar la configuración.');
      },
    });
  }

  /**
   * Lo que se le dice a quien lleva una conversación sobre cuándo vuelve el asistente. El plazo
   * corre desde la última vez que una persona intervino, y solo se cumple si el CLIENTE escribe:
   * el asistente nunca le habla solo a quien no escribió.
   */
  avisoRetorno(c: ConversacionBandeja): string {
    const min = c.reactivar_asistente_min ?? 0;
    if (min === 0) return 'El asistente no volverá solo.';
    if (!c.humano_ultimo_en) {
      return `El asistente volverá ${min} min después de que respondas o la marques atendida, si el cliente escribe.`;
    }
    const vuelve = new Date(new Date(c.humano_ultimo_en).getTime() + min * 60_000);
    if (vuelve.getTime() <= Date.now()) {
      return 'El plazo ya se cumplió: si el cliente escribe, lo atiende el asistente.';
    }
    const hora = vuelve.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    return `El asistente vuelve a las ${hora} si el cliente escribe.`;
  }

  /** El hilo: los mensajes y, en su sitio, los momentos en que el asistente retomó. */
  readonly lineaDeTiempo = computed<ItemHilo[]>(() => {
    const d = this.detalle();
    if (!d) return [];
    const items: ItemHilo[] = [
      ...d.mensajes.map(
        (m): ItemHilo => ({ tipo: 'msg', clave: `m-${m.id_mensaje}`, fecha: Date.parse(m.creado_en), m }),
      ),
      ...(d.retomadas ?? []).map(
        (r, i): ItemHilo => ({ tipo: 'retomo', clave: `r-${i}-${r.fecha}`, fecha: Date.parse(r.fecha), r }),
      ),
      ...this.locales().map(
        (m): ItemHilo => ({ tipo: 'msg', clave: m.id_mensaje, fecha: Date.parse(m.creado_en), m }),
      ),
    ];
    items.sort((a, b) => a.fecha - b.fecha);
    // Un separador cada vez que cambia el día (en Bogotá), antes del primer mensaje de ese día.
    const conDias: ItemHilo[] = [];
    let diaAnterior = '';
    for (const it of items) {
      if (Number.isNaN(it.fecha)) {
        conDias.push(it);
        continue;
      }
      const dia = DIA_BOGOTA.format(it.fecha);
      if (dia !== diaAnterior) {
        conDias.push({ tipo: 'dia', clave: `d-${dia}`, fecha: it.fecha, texto: textoDelDia(it.fecha) });
        diaAnterior = dia;
      }
      conDias.push(it);
    }
    return conDias;
  });

  textoRetomada(r: RetomadaAsistente): string {
    return r.origen === 'automatico'
      ? 'automático, por el plazo del negocio'
      : `manual${r.quien ? ', por ' + r.quien : ''}`;
  }

  ngOnInit(): void {
    const fijo = this.negocioFijo();
    if (fijo !== null) this.negocioActivo.set(fijo);
    this.cargar();

    // En SSR no hay `document` ni sentido en sondear: la página se pinta una vez y se manda.
    if (!isPlatformBrowser(this.platformId)) return;
    // Dos paneles necesitan el ancho: el layout aparta el menú mientras la bandeja esté a la vista.
    this.pantallaAncha.pedir();
    this.anchoPedido = true;
    this.temporizador = setInterval(() => this.refrescar(), REFRESCO_MS);
    // El reloj de los contadores de 24 h: cada 30 s basta para un contador en minutos.
    this.reloj = setInterval(() => this.ahora.set(Date.now()), 30000);
    // Al volver a la pestaña se refresca enseguida, sin esperar al siguiente latido.
    document.addEventListener('visibilitychange', this.alVolverALaPestana);
    this.cargarRapidas();
  }

  ngOnDestroy(): void {
    this.liberarArchivos();
    if (this.temporizador) clearInterval(this.temporizador);
    if (this.reloj) clearInterval(this.reloj);
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('visibilitychange', this.alVolverALaPestana);
    }
    this.quitarAdjunto();
    if (this.anchoPedido) this.pantallaAncha.soltar();
  }

  /**
   * El latido: trae lo nuevo sin que se note.
   *
   * «Sin que se note» es literal y es lo que más cuidado tiene. No pone la lista en estado de
   * carga —parpadearía cada cinco segundos—, no toca el borrador, y no mueve el scroll salvo
   * que ya estuvieras abajo del todo.
   *
   * Se para con la pestaña en segundo plano: nadie está mirando, y el servidor es de 1 vCPU.
   * También mientras se envía un mensaje, para no recargar el hilo a mitad.
   */
  private refrescar(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (document.hidden) return;
    if (this.enviando()) return;

    this.ahora.set(Date.now());
    const abierta = this.abierta();
    if (abierta) this.cargarHilo(abierta, true);
    // La lista cada dos latidos (6 s): lo urgente es el chat que se está mirando.
    if (!abierta || this.ticks++ % 2 === 0) this.cargar(true);
  }

  cargar(silencioso = false): void {
    if (!silencioso) this.estado.set('loading');
    this.error.set(null);

    this.service
      .getConversaciones({
        solo_escaladas: this.soloEscaladas(),
        id_negocio: this.negocioActivo() ?? undefined,
        // 60 y no 30: la búsqueda filtra lo que llegó, y con 30 un chat de ayer ya no aparecía.
        limite: LIMITE_LISTA,
      })
      .subscribe({
        next: (data) => {
          this.sinModulo.set(!data.disponible);
          this.conversaciones.set(data.conversaciones);
          this.abrirLaInicial(data.conversaciones);
          // Solo cuando se ven todos: filtrando por uno, la consulta ya viene acotada y
          // quedaría una sola pastilla, sin forma de volver.
          if (this.negocioActivo() === null && !this.soloEscaladas()) {
            this.negocios.set(data.negocios ?? []);
          }
          this.estado.set('success');
        },
        error: () => {
          // Un fallo del latido no rompe la pantalla: lo que ya está sigue en pie y se
          // reintenta en cinco segundos. Solo la carga inicial puede dejarla en error.
          if (silencioso) return;
          this.error.set('No se pudieron cargar las conversaciones.');
          this.estado.set('error');
        },
      });
  }

  /** Una sola vez: después manda la persona. Fuera de la lista (vieja), se abre igual por su id. */
  private abrirLaInicial(lista: ConversacionBandeja[]): void {
    const id = this.conversacionInicial();
    if (!id || this.conversacionInicialAbierta) return;
    this.conversacionInicialAbierta = true;
    const enLista = lista.find((c) => c.id_conversacion === id);
    if (enLista) {
      this.abrir(enLista);
    } else {
      this.abierta.set(id);
      this.cargarHilo(id);
    }
  }

  filtrarPorNegocio(idNegocio: number | null): void {
    if (this.negocioActivo() === idNegocio) return;
    this.negocioActivo.set(idNegocio);
    this.cerrar();
    this.cargar();
  }

  alternarEscaladas(): void {
    this.soloEscaladas.update((v) => !v);
    this.cerrar();
    this.cargar();
  }

  abrir(conversacion: ConversacionBandeja): void {
    this.cerrarVisor();
    if (this.abierta() !== conversacion.id_conversacion) this.liberarArchivos();
    this.marcarVista(conversacion);
    this.abierta.set(conversacion.id_conversacion);
    this.errorEnvio.set(null);
    this.borrador.set('');
    this.quitarAdjunto();
    this.locales.set([]);
    this.hayAnteriores.set(false);
    this.emojisAbierto.set(false);
    this.rapidasAbierto.set(false);
    // Cambiar de conversación con el modal de reporte abierto lo dejaría apuntando a otra
    // persona. Se cierra siempre.
    this.confirmandoBloqueo.set(false);
    this.motivoBloqueo.set('');
    this.errorBloqueo.set(null);
    this.cargarHilo(conversacion.id_conversacion);
  }

  private cargarHilo(id: string, silencioso = false, alTerminar?: () => void): void {
    if (!silencioso) this.estadoDetalle.set('loading');

    // Si ya estabas abajo del todo, seguirás abajo al llegar lo nuevo. Si habías subido a leer
    // algo, no se te mueve: el margen de 40px es para el scroll que no cae en el píxel exacto.
    const caja = this.cajaMensajes()?.nativeElement;
    const pegadoAbajo =
      !silencioso || !caja || caja.scrollHeight - caja.scrollTop - caja.clientHeight < 40;

    this.service.getConversacion(id).subscribe({
      next: (data) => {
        // La conversación pudo cerrarse mientras la petición volvía.
        if (this.abierta() !== id) return;
        if (data) {
          // El servidor manda los 60 últimos. Si ya se habían pedido mensajes más viejos, se
          // conservan: el refresco no puede «olvidar» lo que se estaba leyendo arriba.
          const previo = this.detalle();
          const primero = data.mensajes[0];
          if (silencioso && previo?.conversacion.id_conversacion === id && primero) {
            const viejos = previo.mensajes.filter((m) => m.creado_en < primero.creado_en);
            if (viejos.length) data = { ...data, mensajes: [...viejos, ...data.mensajes] };
          } else {
            this.hayAnteriores.set(Boolean(data.hay_anteriores));
          }
        }
        this.detalle.set(data);
        this.estadoDetalle.set('success');
        this.pedirArchivos(id, data?.mensajes ?? []);
        if (pegadoAbajo) this.alFinal();
        alTerminar?.();
      },
      error: () => {
        alTerminar?.();
        if (silencioso) return;
        this.errorEnvio.set('No se pudo abrir la conversación.');
        this.estadoDetalle.set('error');
      },
    });
  }

  /** Lo que se carga solo al abrir el chat. Un documento puede ser grande: ése, al tocarlo. */
  private static readonly SE_MUESTRAN = new Set(['image', 'sticker', 'audio', 'video']);

  /** Pide los archivos que falten. Solo en el navegador: en SSR no hay `URL.createObjectURL`. */
  private pedirArchivos(idConversacion: string, mensajes: MensajeBandeja[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    for (const m of mensajes) {
      if (!m.media || this.archivos()[m.id_mensaje]) continue;
      if (!BandejaComponent.SE_MUESTRAN.has(m.media.tipo)) continue;
      this.cargarArchivo(idConversacion, m.id_mensaje);
    }
  }

  private cargarArchivo(idConversacion: string, idMensaje: string, alTerminar?: (url: string) => void): void {
    this.archivos.update((a) => ({ ...a, [idMensaje]: { estado: 'cargando' } }));
    this.service.archivoDeMensaje(idConversacion, idMensaje).subscribe({
      next: (blob) => {
        // Si en el camino se cambió de conversación, el archivo ya no se pinta: se suelta.
        if (this.abierta() !== idConversacion) return;
        const url = URL.createObjectURL(blob);
        this.archivos.update((a) => ({ ...a, [idMensaje]: { estado: 'listo', url } }));
        alTerminar?.(url);
      },
      error: (err: { status?: number }) => {
        if (this.abierta() !== idConversacion) return;
        const mensaje =
          err?.status === 410
            ? 'Ya no está disponible: WhatsApp guarda los archivos 7 días.'
            : err?.status === 413
              ? 'Es demasiado grande para mostrarlo aquí.'
              : 'No se pudo cargar el archivo.';
        this.archivos.update((a) => ({ ...a, [idMensaje]: { estado: 'error', mensaje } }));
      },
    });
  }

  /** La URL ya cargada de un archivo, o `null`. */
  urlArchivo(m: MensajeBandeja): string | null {
    const a = this.archivos()[m.id_mensaje];
    return a?.estado === 'listo' ? a.url : null;
  }

  /** El aviso de un archivo que no se pudo traer, o `null`. */
  errorArchivo(m: MensajeBandeja): string | null {
    const a = this.archivos()[m.id_mensaje];
    return a?.estado === 'error' ? a.mensaje : null;
  }

  cargandoArchivo(m: MensajeBandeja): boolean {
    return this.archivos()[m.id_mensaje]?.estado === 'cargando';
  }

  // ── Visor de fotos y videos (2026-11-11) ──────────────────────────────────────────────────
  // Como WhatsApp: la foto o el video se abre ENCIMA del chat, en grande y con fondo oscuro, y
  // no en otra pestaña (que en la tableta sacaba a la persona de la app). Es un <dialog> modal:
  // el navegador da el foco atrapado, el Escape y la capa superior —por encima del chat a pantalla
  // completa, que ya es `position: fixed`—, sin pelear con z-index.

  private readonly visorDialogo = viewChild<ElementRef<HTMLDialogElement>>('visor');
  /** El mensaje cuya foto o video se está viendo, o `null`. */
  readonly visorId = signal<string | null>(null);

  /** La URL que se puede pintar de un archivo: la local mientras sube, o la ya traída. */
  urlDeMedio(m: MensajeBandeja): string | null {
    return m.local?.url || this.urlArchivo(m);
  }

  /** Las fotos y videos del chat ya cargados, en orden: lo que recorren las flechas del visor. */
  readonly medios = computed(() =>
    this.lineaDeTiempo().flatMap((it) =>
      it.tipo === 'msg' &&
      !it.m.eliminado &&
      ['image', 'sticker', 'video'].includes(it.m.media?.tipo ?? '') &&
      this.urlDeMedio(it.m)
        ? [it.m]
        : [],
    ),
  );
  readonly visorIndice = computed(() => this.medios().findIndex((m) => m.id_mensaje === this.visorId()));
  readonly visorActual = computed(() => this.medios()[this.visorIndice()] ?? null);

  verMedio(m: MensajeBandeja): void {
    this.visorId.set(m.id_mensaje);
    const d = this.visorDialogo()?.nativeElement;
    if (d && !d.open) d.showModal();
  }

  cerrarVisor(): void {
    const d = this.visorDialogo()?.nativeElement;
    if (d?.open) d.close();
    this.visorId.set(null);
  }

  /** La anterior (-1) o la siguiente (+1). En los extremos no da la vuelta: así se sabe dónde acaba. */
  moverVisor(paso: number): void {
    const lista = this.medios();
    const i = this.visorIndice() + paso;
    if (i >= 0 && i < lista.length) this.visorId.set(lista[i].id_mensaje);
  }

  alTeclearVisor(ev: KeyboardEvent): void {
    if (ev.key === 'ArrowLeft') this.moverVisor(-1);
    else if (ev.key === 'ArrowRight') this.moverVisor(1);
    else return;
    ev.preventDefault();
  }

  /** Un toque en lo oscuro (fuera de la foto y de los botones) cierra, como en WhatsApp. */
  alClicVisor(ev: MouseEvent): void {
    const t = ev.target as HTMLElement | null;
    if (t && (t === ev.currentTarget || t.classList.contains('bdj-visor__escena'))) this.cerrarVisor();
  }

  /** El nombre con que se descarga: el del archivo si lo trae, o uno por su tipo. */
  nombreDescarga(m: MensajeBandeja): string {
    if (m.media?.nombre) return m.media.nombre;
    const ext = (m.media?.mime ?? '').split('/')[1]?.split(';')[0] || (m.media?.tipo === 'video' ? 'mp4' : 'jpg');
    return `${m.media?.tipo === 'video' ? 'video' : 'foto'}-${m.creado_en.slice(0, 10)}.${ext}`;
  }

  /** Un documento se trae al tocarlo y se abre en otra pestaña. */
  abrirDocumento(m: MensajeBandeja): void {
    const id = this.abierta();
    if (!id || !isPlatformBrowser(this.platformId)) return;
    const ya = this.urlArchivo(m);
    if (ya) {
      window.open(ya, '_blank', 'noopener');
      return;
    }
    this.cargarArchivo(id, m.id_mensaje, (url) => window.open(url, '_blank', 'noopener'));
  }

  /** Qué es, en palabras, para los avisos («Cargando la foto…»). */
  nombreDeArchivo(tipo: string): string {
    return (
      { image: 'la foto', sticker: 'el sticker', audio: 'el audio', video: 'el video', document: 'el documento' }[
        tipo
      ] ?? 'el archivo'
    );
  }

  private liberarArchivos(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    for (const a of Object.values(this.archivos())) {
      if (a.estado === 'listo') URL.revokeObjectURL(a.url);
    }
    this.archivos.set({});
  }

  /**
   * Baja el hilo hasta el último mensaje.
   *
   * Una conversación se abre por donde va, no por donde empezó: con veinte mensajes, abrir
   * arriba obliga a arrastrar hasta abajo cada vez solo para ver de qué se está hablando.
   *
   * El `setTimeout` no es un adorno: en el momento del `next` las burbujas todavía no están
   * pintadas, así que `scrollHeight` valdría lo que medía el contenedor vacío. Se espera al
   * siguiente ciclo, cuando ya hay algo que medir.
   */
  private alFinal(): void {
    setTimeout(() => {
      const caja = this.cajaMensajes()?.nativeElement;
      if (caja) caja.scrollTop = caja.scrollHeight;
    });
  }

  /**
   * «Ya me ocupé de esto», sin escribir nada.
   *
   * No devuelve la conversación al asistente — eso sigue prohibido por ADR-023. Solo deja de
   * contar como pendiente.
   */
  atender(): void {
    const actual = this.detalle();
    if (!actual) return;

    this.service.atender(actual.conversacion.id_conversacion).subscribe({
      next: () => {
        this.detalle.set({
          ...actual,
          conversacion: { ...actual.conversacion, escalada: false },
        });
        this.cargar(true);
      },
      error: () => this.errorEnvio.set('No se pudo marcar como atendida.'),
    });
  }

  /**
   * «Ya terminé, que siga el asistente.»
   *
   * ADR-023 decía «el bot no vuelve»; la Enmienda 1 acotó que lo prohibido es que vuelva
   * **solo**. Esto nace de un clic y de nadie más. Y el asistente hereda el hilo sabiendo qué
   * dijo una persona y qué dijo él.
   */
  devolverAlAsistente(): void {
    const actual = this.detalle();
    if (!actual) return;

    this.service.devolverAlAsistente(actual.conversacion.id_conversacion).subscribe({
      next: () => {
        this.cargarHilo(actual.conversacion.id_conversacion, true);
        this.cargar(true);
      },
      error: () => this.errorEnvio.set('No se pudo devolver la conversación al asistente.'),
    });
  }

  /**
   * Abre (o cierra) el modal «Reportar usuario». Reportar bloquea al usuario —el asistente deja
   * de contestarle—, así que no debe salir de un solo clic: pasa por este modal.
   */
  alternarConfirmarBloqueo(): void {
    this.confirmandoBloqueo.update((v) => !v);
    this.motivoBloqueo.set('');
    this.errorBloqueo.set(null);
  }

  /**
   * «Este número abusa del sistema»: el asistente deja de contestarle. Distinto de una baja
   * legal por STOP —eso lo decide el cliente, y solo un super admin lo deshace desde la
   * Consola—: esto lo decide el negocio, y por eso el propio negocio puede deshacerlo.
   */
  bloquear(): void {
    const actual = this.detalle();
    if (!actual) return;

    this.bloqueando.set(true);
    this.errorBloqueo.set(null);

    this.service.bloquear(actual.conversacion.id_conversacion, this.motivoBloqueo().trim() || undefined)
      .subscribe({
        next: () => {
          this.detalle.set({
            ...actual,
            conversacion: { ...actual.conversacion, estado: 'bloqueada', bloqueada_por: 'negocio' },
          });
          this.confirmandoBloqueo.set(false);
          this.motivoBloqueo.set('');
          this.bloqueando.set(false);
          this.toast.exito('Usuario reportado y bloqueado: el asistente ya no le contestará.');
          this.cargar(true);
        },
        error: (err) => {
          this.bloqueando.set(false);
          this.errorBloqueo.set(err?.error?.message || 'No se pudo reportar y bloquear al usuario.');
          this.toast.errorHttp(err, 'No se pudo reportar y bloquear al usuario.');
        },
      });
  }

  /** Deshace SU PROPIO bloqueo. Una baja por STOP no se deshace desde aquí. */
  desbloquear(): void {
    const actual = this.detalle();
    if (!actual) return;

    this.bloqueando.set(true);
    this.errorBloqueo.set(null);

    this.service.desbloquear(actual.conversacion.id_conversacion).subscribe({
      next: () => {
        this.detalle.set({
          ...actual,
          conversacion: { ...actual.conversacion, estado: 'activa', bloqueada_por: null },
        });
        this.bloqueando.set(false);
        this.toast.exito('Usuario desbloqueado: el asistente vuelve a contestarle.');
        this.cargar(true);
      },
      error: (err) => {
        this.bloqueando.set(false);
        this.toast.errorHttp(err, 'No se pudo desbloquear el número.');
      },
    });
  }

  cerrar(): void {
    this.cerrarVisor();
    this.liberarArchivos();
    this.quitarAdjunto();
    this.locales.set([]);
    this.detalle.set(null);
    this.abierta.set(null);
    this.estadoDetalle.set('idle');
    this.borrador.set('');
    this.errorEnvio.set(null);
    this.confirmandoBloqueo.set(false);
    this.motivoBloqueo.set('');
    this.errorBloqueo.set(null);
  }

  enviar(): void {
    const actual = this.detalle();
    if (!actual || !this.puedeEnviar()) return;
    const id = actual.conversacion.id_conversacion;
    const texto = this.borrador().trim();
    const adjunto = this.adjunto();

    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.emojisAbierto.set(false);

    // La burbuja sale YA, marcada «enviando…» (2026-11-10). Antes había que esperar a que el
    // servidor contestara y a recargar el hilo, y eso se sentía lento. Sigue sin mentir: dice
    // «enviando…» hasta que el hilo real la reemplaza con el estado que puso el backend.
    const clave = `local-${Date.now()}`;
    const local: MensajeBandeja = {
      id_mensaje: clave,
      direccion: 'saliente',
      canal: actual.conversacion.canal,
      contenido: texto,
      estado_entrega: 'pendiente',
      enviado_en: null,
      entregado_en: null,
      creado_en: new Date().toISOString(),
      origen: 'humano',
      media: adjunto
        ? { tipo: adjunto.tipo, mime: adjunto.archivo.type, caption: texto || null, nombre: adjunto.archivo.name }
        : null,
      local: adjunto ? { url: adjunto.url, estado: 'subiendo' } : undefined,
    };
    this.locales.update((l) => [...l, local]);
    this.borrador.set('');
    // La URL de la vista previa la sigue usando la burbuja local: no se libera aquí.
    this.adjunto.set(null);
    this.alFinal();
    this.enfocarCaja();

    const peticion = adjunto
      ? this.service.enviarArchivo(id, adjunto.archivo, texto)
      : this.service.responder(id, texto);

    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        // Se recarga el hilo: trae el mensaje de verdad, con el estado de entrega que puso el
        // backend, y entonces la burbuja local sobra.
        this.cargarHilo(id, true, () => {
          this.soltarLocal(clave);
          this.alFinal();
        });
        this.cargar(true);
      },
      error: (err) => {
        this.enviando.set(false);
        this.soltarLocal(clave);
        // Lo escrito vuelve a la caja: no se pierde un mensaje que no salió.
        if (!this.borrador()) this.borrador.set(texto);
        if (adjunto) this.adjunto.set(adjunto);
        // El 409 es el caso previsto —la ventana se cerró mientras escribía— y merece el
        // mensaje del backend, que dice exactamente qué pasó.
        this.errorEnvio.set(
          err?.error?.message ?? 'No se pudo enviar. Inténtalo de nuevo.',
        );
        if (err?.status === 409) this.cargarHilo(id, true);
      },
    });
  }

  private soltarLocal(clave: string): void {
    const m = this.locales().find((x) => x.id_mensaje === clave);
    if (m?.local?.url && !this.adjunto()) URL.revokeObjectURL(m.local.url);
    this.locales.update((l) => l.filter((x) => x.id_mensaje !== clave));
  }

  /** ¿La conversación tiene el nombre de la persona? Un número no cuenta como nombre. */
  tieneNombre(c: ConversacionBandeja): boolean {
    const n = (c.persona ?? '').trim();
    return n.length > 0 && !/^\+?[\d\s()-]+$/.test(n);
  }

  /**
   * Quién escribió: el nombre del cliente y, si no lo hay, su número formateado
   * (`+57 300 123 4567`). Solo si tampoco hay número, «Sin identificar».
   */
  quien(c: ConversacionBandeja): string {
    if (this.tieneNombre(c)) return c.persona!.trim();
    // El nombre que el cliente puso en su perfil, con «~» delante como hace WhatsApp con quien
    // no está en la agenda: lo escribió él y puede ser cualquier cosa (2026-11-10).
    if (this.nombreDePerfil(c)) return `~${this.nombreDePerfil(c)}`;
    if (!c.telefono_e164 && this.esIdSinNumero(c.id_externo)) return 'Cliente sin número visible';
    return this.formatearTelefono(c.telefono_e164 || c.id_externo) || 'Sin identificar';
  }

  /**
   * El número (o lo que lo reemplaza) bajo el nombre. Quien escribe con usuario de WhatsApp sin
   * enseñar su número llega con un identificador como `CO.1084387837819952`: sus dígitos NO son un
   * teléfono, y mostrarlos como «+1084…» invita a llamar a un número que no existe.
   */
  contacto(c: ConversacionBandeja): string {
    if (this.esIdSinNumero(c.id_externo) && !c.telefono_e164) return 'WhatsApp no comparte su número';
    // Sin nombre, el título ya ES el número: repetirlo debajo («+57 315… / 573156…») solo
    // ocupa el renglón que en el teléfono no sobra (auditoría móvil, 2026-10-16).
    if (!this.tieneNombre(c) && !this.nombreDePerfil(c)) return 'Sin nombre en WhatsApp';
    const telefono = this.formatearTelefono(c.telefono_e164 || c.id_externo);
    return c.origen_nombre === 'contacto' ? `${telefono} · en tus contactos` : telefono;
  }

  /** El nombre del perfil de WhatsApp del cliente, si es algo legible (no solo espacios o un número). */
  nombreDePerfil(c: ConversacionBandeja): string {
    const n = (c.perfil_nombre ?? '').trim();
    return n && !/^\+?[\d\s()-]+$/.test(n) ? n : '';
  }

  /** ¿Es un identificador de WhatsApp sin número (`CO.123…`) y no un teléfono? */
  esIdSinNumero(idExterno: string | null | undefined): boolean {
    const v = (idExterno ?? '').trim();
    return v.length > 0 && !/^\+?\d{7,15}$/.test(v);
  }

  /** La inicial del nombre. Sin nombre no hay inicial: el avatar enseña un ícono de persona. */
  inicial(c: ConversacionBandeja): string {
    const n = this.tieneNombre(c) ? c.persona!.trim() : this.nombreDePerfil(c);
    return n ? Array.from(n)[0].toUpperCase() : '';
  }

  /** `+573001234567` → `+57 300 123 4567`. Otros países: solo el `+` y los dígitos. */
  formatearTelefono(valor: string | null | undefined): string {
    const digitos = (valor ?? '').replace(/\D/g, '');
    if (!digitos) return '';
    const co = /^57(\d{3})(\d{3})(\d{4})$/.exec(digitos);
    if (co) return `+57 ${co[1]} ${co[2]} ${co[3]}`;
    return `+${digitos}`;
  }

  /**
   * Enter envía; Shift+Enter hace salto de línea. Respeta `puedeEnviar()`: con la ventana de
   * 24 h cerrada, un borrador vacío o un envío en curso, Enter no hace nada (y tampoco mete un
   * salto de línea, para no ensuciar un mensaje que no se puede mandar). No se envía mientras se
   * compone con un IME (tildes, japonés…): ahí Enter confirma la composición.
   */
  alEnter(ev: Event): void {
    const e = ev as KeyboardEvent;
    if (e.shiftKey || e.isComposing) return;
    // Con las respuestas rápidas abiertas, Enter elige una (lo hace `alTeclear`), no envía.
    if (e.defaultPrevented || (this.mostrandoRapidas() && this.sugerenciasRapidas().length)) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    if (this.puedeEnviar()) this.enviar();
  }

  esDeLaPersona(m: MensajeBandeja): boolean {
    return m.direccion === 'entrante';
  }

  /** Quién escribió el mensaje citado, visto desde el negocio. */
  quienCita(c: CitaMensaje): string {
    if (!c.encontrado) return 'Mensaje anterior';
    return c.direccion === 'entrante' ? 'Cliente' : 'Tú';
  }

  /** El texto del mensaje citado, o qué era si fue un archivo. */
  textoCita(c: CitaMensaje): string {
    if (!c.encontrado) return 'No está guardado en EscalApp';
    if (c.eliminado) return 'Mensaje eliminado';
    const texto = (c.contenido ?? '').trim();
    if (c.tipo && (!texto || /^\[\w+\]$/.test(texto))) {
      const archivo = this.nombreDeArchivo(c.tipo);
      return archivo.charAt(0).toUpperCase() + archivo.slice(1);
    }
    return texto || 'Mensaje';
  }

  /** Lleva al mensaje citado si está en las páginas ya cargadas, y lo resalta un momento. */
  irACita(c: CitaMensaje): void {
    if (!c.id_mensaje || !isPlatformBrowser(this.platformId)) return;
    const el = document.querySelector<HTMLElement>(`[data-mensaje="${CSS.escape(c.id_mensaje)}"]`);
    if (!el) {
      this.toast.info('Ese mensaje está más arriba: carga los anteriores para verlo.');
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('bdj__msg--resaltado');
    setTimeout(() => el.classList.remove('bdj__msg--resaltado'), 1600);
  }

  /** Solo tres estados merecen pintarse: lo demás es ruido para quien no depura. */
  etiquetaEntrega(m: MensajeBandeja): string | null {
    if (m.direccion !== 'saliente') return null;
    if (m.estado_entrega === 'pendiente') return 'enviando…';
    if (m.estado_entrega === 'fallido') return 'no se entregó';
    return null;
  }

  /**
   * El formulario de entrega, en el orden en que el cliente lo llenó y con nombres de persona.
   * Lo que no esté en la lista (un campo nuevo) va al final con su clave tal cual.
   */
  camposFormulario(f: Record<string, string>): { clave: string; etiqueta: string; valor: string }[] {
    const ORDEN: Record<string, string> = {
      entrega: 'Cómo lo recibe',
      barrio: 'Barrio',
      direccion: 'Dirección',
      indicaciones: 'Indicaciones',
      telefono: 'Teléfono',
      pago: 'Pago',
    };
    const VALORES: Record<string, string> = {
      domicilio: 'A domicilio',
      recoger: 'Pasa a recoger',
      servir: 'Para servir en el local',
    };
    const claves = [
      ...Object.keys(ORDEN).filter((k) => f[k]),
      ...Object.keys(f).filter((k) => !(k in ORDEN) && f[k]),
    ];
    return claves.map((clave) => ({
      clave,
      etiqueta: ORDEN[clave] ?? clave.replace(/_/g, ' '),
      valor: clave === 'entrega' ? (VALORES[f[clave]] ?? f[clave]) : f[clave],
    }));
  }

  /**
   * El texto con el formato de WhatsApp: *negrita*, _cursiva_ y ~tachado~, como lo ve el cliente.
   *
   * Se escapa TODO el HTML primero y luego se ponen solo esas tres marcas: el texto lo escribió
   * un cliente o el modelo, y `innerHTML` con su texto crudo sería abrirle la página. Las marcas
   * solo valen pegadas a una palabra y con espacio o signo alrededor: «Calle 16A n 43_61» no es
   * una cursiva.
   */
  /** La vista previa de la lista, sin las marcas de formato («El Nequi es *323…*» → sin asteriscos). */
  sinMarcas(texto: string | null | undefined): string {
    return String(texto ?? '')
      .replace(/(^|[\s(¡¿"'«-])([*_~])(?=\S)([^*_~\n]*?\S)\2(?=$|[\s.,;:!?)»"'-])/g, '$1$3')
      .replace(/^📋 Formulario enviado/, '📋 Llenó el formulario');
  }

  formatoWhatsapp(texto: string | null | undefined): string {
    const escapado = String(texto ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const marca = (s: string, signo: string, etiqueta: string): string =>
      s.replace(
        new RegExp(`(^|[\\s(¡¿"'«\\-])\\${signo}(?=\\S)([^${signo}\\n]*?\\S)\\${signo}(?=$|[\\s.,;:!?)»"'\\-])`, 'g'),
        `$1<${etiqueta}>$2</${etiqueta}>`
      );
    // Los enlaces se apartan ANTES de las marcas: un `_` o un `*` dentro de una dirección web no
    // es cursiva ni negrita. Se cortan antes de la puntuación final y de las comillas (escapadas).
    const enlaces: string[] = [];
    const sinEnlaces = escapado.replace(
      /\b(?:https?:\/\/|www\.)[^\s]+?(?=[.,;:!?)»]*(?:\s|$|&quot;|&#39;|&lt;|&gt;))/gi,
      (url) => {
        const href = /^www\./i.test(url) ? `https://${url}` : url;
        enlaces.push(`<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`);
        // Un marcador que ningún texto de WhatsApp trae ni las marcas tocan.
        return `\u0000${enlaces.length - 1}\u0000`;
      },
    );
    return marca(marca(marca(sinEnlaces, '*', 'strong'), '_', 'em'), '~', 's').replace(
      /\u0000(\d+)\u0000/g,
      (_m, i: string) => enlaces[Number(i)],
    );
  }
}
