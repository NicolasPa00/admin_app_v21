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
import { FormsModule } from '@angular/forms';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  MessageSquare, Send, Loader2, AlertCircle, Bot, Clock, TriangleAlert, RefreshCw, Inbox,
  Search, X, Check, Building2, CheckCheck, BotMessageSquare, Ban, BellOff,
  Flag, ShieldAlert, MessageCircle, User, FileText, Settings, Smartphone, Pause, Play,
} from 'lucide-angular';

import { BandejaService } from '../../data-access/bandeja.service';
import { PantallaAnchaService } from '../../../core/services/pantalla-ancha.service';
import { ModalCabeceraComponent } from '../../../shared/modal-cabecera/modal-cabecera.component';
import { ToastService } from '../../../shared/toast/toast.service';
import {
  ConversacionBandeja,
  ConfiguracionReactivacion,
  DiagnosticoAsistente,
  ConversacionBandejaDetalle,
  MensajeBandeja,
  RetomadaAsistente,
  NegocioConConversaciones,
  ReportesConversacion,
  PreparacionAsistente,
} from '../../models/bandeja.models';
import { LoadingState } from '../../models/admin.models';

/** Un archivo del cliente, ya traído (o no) para pintarlo en el hilo. */
type EstadoArchivo =
  | { estado: 'cargando' }
  | { estado: 'listo'; url: string }
  | { estado: 'error'; mensaje: string };

/** Una línea del hilo: un mensaje, o el aviso de que el asistente retomó la conversación. */
type ItemHilo =
  | { tipo: 'msg'; clave: string; fecha: number; m: MensajeBandeja }
  | { tipo: 'retomo'; clave: string; fecha: number; r: RetomadaAsistente };

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
/** Cada cuánto se mira si hay algo nuevo. */
const REFRESCO_MS = 5000;

@Component({
  selector: 'app-bandeja',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, LucideAngularModule, ModalCabeceraComponent],
  // `viewProviders` y no `providers`: los `providers` también los ven los hijos PROYECTADOS
  // (<ng-content>), y como LUCIDE_ICONS es multi, un ícono declarado por quien proyecta (el botón
  // «Tu número» de WhatsApp) se buscaba aquí, no lo encontraba y cortaba el render de la bandeja.
  viewProviders: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        MessageSquare, Send, Loader2, AlertCircle, Bot, Clock, TriangleAlert,
        RefreshCw, Inbox, Search, X, Check, Building2, CheckCheck, BotMessageSquare, Ban, BellOff,
        Flag, ShieldAlert, MessageCircle, User, FileText, Settings, Smartphone, Pause, Play,
      }),
    },
  ],
  templateUrl: './bandeja.component.html',
  styleUrl: './bandeja.component.scss',
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
  readonly gestionarNumero = output<void>();

  readonly detalle = signal<ConversacionBandejaDetalle | null>(null);

  // ── Archivos de los clientes (fotos, stickers, audios…) ──
  // Se guardan aquí como URL `blob:` por id de mensaje: el hilo se recarga cada pocos segundos y
  // no hay que volver a pedírselos al servidor (que a su vez se los pide a Meta). Se liberan al
  // cambiar de conversación. El archivo nunca se guarda en el servidor (decisión del dueño).
  readonly archivos = signal<Record<string, EstadoArchivo>>({});
  readonly estadoDetalle = signal<LoadingState>('idle');
  readonly abierta = signal<string | null>(null);

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
        if (this.negocioConfig() === id) this.diagnostico.set(d);
      },
      error: (err) => {
        this.diagnosticando.set(false);
        this.toast.errorHttp(err, 'No se pudo revisar la carta.');
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
          `${this.quien(c)} ${c.ultimo_texto ?? ''}`.toLowerCase().includes(q),
        )
      : this.conversaciones();
    // Por fecha, como siempre: anclar arriba las que esperan respuesta se probó y se retiró el
    // mismo día (2026-10-02) — muchas «esperaban» solo un «gracias». Se distinguen por el recuadro.
    return lista;
  });

  readonly puedeEnviar = computed(
    () =>
      !this.enviando() &&
      this.borrador().trim().length > 0 &&
      (this.detalle()?.ventana.abierta ?? false),
  );

  private cargarConfig(idNegocio: number | null): void {
    if (idNegocio === null) {
      this.config.set(null);
      this.diagnostico.set(null);
      this.preparacion.set(null);
      this.prepAbierta.set(false);
      return;
    }
    this.cargarPreparacion(idNegocio, true);
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
    ];
    return items.sort((a, b) => a.fecha - b.fecha);
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
  }

  ngOnDestroy(): void {
    this.liberarArchivos();
    if (this.temporizador) clearInterval(this.temporizador);
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

    this.cargar(true);
    const abierta = this.abierta();
    if (abierta) this.cargarHilo(abierta, true);
  }

  cargar(silencioso = false): void {
    if (!silencioso) this.estado.set('loading');
    this.error.set(null);

    this.service
      .getConversaciones({
        solo_escaladas: this.soloEscaladas(),
        id_negocio: this.negocioActivo() ?? undefined,
      })
      .subscribe({
        next: (data) => {
          this.sinModulo.set(!data.disponible);
          this.conversaciones.set(data.conversaciones);
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
    if (this.abierta() !== conversacion.id_conversacion) this.liberarArchivos();
    this.marcarVista(conversacion);
    this.abierta.set(conversacion.id_conversacion);
    this.errorEnvio.set(null);
    this.borrador.set('');
    // Cambiar de conversación con el modal de reporte abierto lo dejaría apuntando a otra
    // persona. Se cierra siempre.
    this.confirmandoBloqueo.set(false);
    this.motivoBloqueo.set('');
    this.errorBloqueo.set(null);
    this.cargarHilo(conversacion.id_conversacion);
  }

  private cargarHilo(id: string, silencioso = false): void {
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
        this.detalle.set(data);
        this.estadoDetalle.set('success');
        this.pedirArchivos(id, data?.mensajes ?? []);
        if (pegadoAbajo) this.alFinal();
      },
      error: () => {
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
    this.liberarArchivos();
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

    this.enviando.set(true);
    this.errorEnvio.set(null);
    const texto = this.borrador().trim();

    this.service.responder(actual.conversacion.id_conversacion, texto).subscribe({
      next: () => {
        this.borrador.set('');
        this.enviando.set(false);
        // Se recarga en vez de añadir la burbuja a mano: así el hilo enseña el estado de entrega
        // real que puso el backend, y no uno optimista que podría ser mentira.
        this.cargarHilo(actual.conversacion.id_conversacion, true);
        this.cargar(true);
      },
      error: (err) => {
        this.enviando.set(false);
        // El 409 es el caso previsto —la ventana se cerró mientras escribía— y merece el
        // mensaje del backend, que dice exactamente qué pasó.
        this.errorEnvio.set(
          err?.error?.message ?? 'No se pudo enviar la respuesta. Inténtalo de nuevo.',
        );
        if (err?.status === 409) this.cargarHilo(actual.conversacion.id_conversacion, true);
      },
    });
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
    if (!c.telefono_e164 && this.esIdSinNumero(c.id_externo)) return 'Cliente sin número visible';
    return this.formatearTelefono(c.telefono_e164 || c.id_externo) || 'Sin identificar';
  }

  /**
   * El número (o lo que lo reemplaza) bajo el nombre. Quien escribe con usuario de WhatsApp sin
   * enseñar su número llega con un identificador como `CO.1084387837819952`: sus dígitos NO son un
   * teléfono, y mostrarlos como «+1084…» invita a llamar a un número que no existe.
   */
  contacto(c: ConversacionBandeja): string {
    if (c.telefono_e164) return c.telefono_e164;
    if (this.esIdSinNumero(c.id_externo)) return 'WhatsApp no comparte su número';
    return c.id_externo ?? '';
  }

  /** ¿Es un identificador de WhatsApp sin número (`CO.123…`) y no un teléfono? */
  esIdSinNumero(idExterno: string | null | undefined): boolean {
    const v = (idExterno ?? '').trim();
    return v.length > 0 && !/^\+?\d{7,15}$/.test(v);
  }

  /** La inicial del nombre. Sin nombre no hay inicial: el avatar enseña un ícono de persona. */
  inicial(c: ConversacionBandeja): string {
    return this.tieneNombre(c) ? c.persona!.trim()[0].toUpperCase() : '';
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
    e.preventDefault();
    if (this.puedeEnviar()) this.enviar();
  }

  esDeLaPersona(m: MensajeBandeja): boolean {
    return m.direccion === 'entrante';
  }

  /** Solo tres estados merecen pintarse: lo demás es ruido para quien no depura. */
  etiquetaEntrega(m: MensajeBandeja): string | null {
    if (m.direccion !== 'saliente') return null;
    if (m.estado_entrega === 'pendiente') return 'enviando…';
    if (m.estado_entrega === 'fallido') return 'no se entregó';
    return null;
  }
}
