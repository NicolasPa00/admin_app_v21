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
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  MessageSquare, Send, Loader2, AlertCircle, Bot, Clock, TriangleAlert, RefreshCw, Inbox,
  Search, X, Check, Building2, CheckCheck, BotMessageSquare, Ban, BellOff,
  Flag, ShieldAlert, MessageCircle,
} from 'lucide-angular';

import { BandejaService } from '../../data-access/bandeja.service';
import {
  ConversacionBandeja,
  ConversacionBandejaDetalle,
  ETIQUETA_MOTIVO,
  MensajeBandeja,
  MOTIVOS_REPORTE,
  NegocioConConversaciones,
  ReportesConversacion,
} from '../../models/bandeja.models';
import { LoadingState } from '../../models/admin.models';

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
  imports: [FormsModule, DatePipe, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        MessageSquare, Send, Loader2, AlertCircle, Bot, Clock, TriangleAlert,
        RefreshCw, Inbox, Search, X, Check, Building2, CheckCheck, BotMessageSquare, Ban, BellOff,
        Flag, ShieldAlert, MessageCircle,
      }),
    },
  ],
  templateUrl: './bandeja.component.html',
  styleUrl: './bandeja.component.scss',
})
export class BandejaComponent implements OnInit, OnDestroy {
  private readonly service = inject(BandejaService);
  private readonly platformId = inject(PLATFORM_ID);
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

  readonly detalle = signal<ConversacionBandejaDetalle | null>(null);
  readonly estadoDetalle = signal<LoadingState>('idle');
  readonly abierta = signal<string | null>(null);

  // ── Reportar ──────────────────────────────────────────────────────────────
  /**
   * El formulario de reporte, abierto o no.
   *
   * Es estado de esta pantalla y no del servidor, así que vive aparte de `detalle()`: el latido
   * de cinco segundos reemplaza el detalle entero, y si el panel dependiera de él se cerraría
   * solo a mitad de escribir el motivo.
   */
  readonly panelReporte = signal(false);
  readonly motivoElegido = signal<string | null>(null);
  readonly notaReporte = signal('');
  readonly reportando = signal(false);
  readonly errorReporte = signal<string | null>(null);

  /** Los motivos que puede elegir una persona. Los del asistente no están: ver el modelo. */
  readonly motivos = MOTIVOS_REPORTE;

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
  readonly variosNegocios = computed(() => this.negocios().length > 1);

  readonly escaladas = computed(() => this.conversaciones().filter((c) => c.escalada).length);

  /** La búsqueda sí es local: filtra lo que ya está en pantalla, como la de WhatsApp. */
  readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.conversaciones();
    return this.conversaciones().filter((c) =>
      `${this.quien(c)} ${c.ultimo_texto ?? ''}`.toLowerCase().includes(q),
    );
  });

  readonly puedeEnviar = computed(
    () =>
      !this.enviando() &&
      this.borrador().trim().length > 0 &&
      (this.detalle()?.ventana.abierta ?? false),
  );

  ngOnInit(): void {
    this.cargar();

    // En SSR no hay `document` ni sentido en sondear: la página se pinta una vez y se manda.
    if (!isPlatformBrowser(this.platformId)) return;
    this.temporizador = setInterval(() => this.refrescar(), REFRESCO_MS);
  }

  ngOnDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
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
    this.abierta.set(conversacion.id_conversacion);
    this.errorEnvio.set(null);
    this.borrador.set('');
    // Cambiar de conversación con el formulario de reporte abierto dejaría el motivo elegido
    // apuntando a otra persona. Se cierra siempre.
    this.cerrarPanelReporte();
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
        if (pegadoAbajo) this.alFinal();
      },
      error: () => {
        if (silencioso) return;
        this.errorEnvio.set('No se pudo abrir la conversación.');
        this.estadoDetalle.set('error');
      },
    });
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

  /** Abre (o cierra) la confirmación de bloqueo. Bloquear no debe salir de un solo clic. */
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
          this.cargar(true);
        },
        error: (err) => {
          this.bloqueando.set(false);
          this.errorBloqueo.set(err?.error?.message || 'No se pudo bloquear el número.');
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
        this.cargar(true);
      },
      error: (err) => {
        this.bloqueando.set(false);
        this.errorBloqueo.set(err?.error?.message || 'No se pudo desbloquear el número.');
      },
    });
  }

  cerrar(): void {
    this.detalle.set(null);
    this.abierta.set(null);
    this.estadoDetalle.set('idle');
    this.borrador.set('');
    this.errorEnvio.set(null);
    this.confirmandoBloqueo.set(false);
    this.motivoBloqueo.set('');
    this.errorBloqueo.set(null);
    this.cerrarPanelReporte();
  }

  // ── Reportar ──────────────────────────────────────────────────────────────
  //
  // Reportar NO bloquea a nadie, no calla al asistente y no cambia el estado de la conversación:
  // es una opinión con autor, fecha y motivo. Lo que se cuenta es el CONTACTO —todas sus
  // conversaciones en este negocio—, porque de la persona es de quien habla la pregunta.

  alternarPanelReporte(): void {
    if (this.panelReporte()) {
      this.cerrarPanelReporte();
      return;
    }
    this.errorReporte.set(null);
    this.motivoElegido.set(null);
    this.notaReporte.set('');
    this.panelReporte.set(true);
  }

  cerrarPanelReporte(): void {
    this.panelReporte.set(false);
    this.motivoElegido.set(null);
    this.notaReporte.set('');
    this.errorReporte.set(null);
  }

  reportar(): void {
    const actual = this.detalle();
    const motivo = this.motivoElegido();
    if (!actual || !motivo || this.reportando()) return;

    this.reportando.set(true);
    this.errorReporte.set(null);

    this.service
      .reportar(actual.conversacion.id_conversacion, motivo, this.notaReporte())
      .subscribe({
        next: (reportes) => {
          this.reportando.set(false);
          this.cerrarPanelReporte();
          // El conteo llega en la respuesta, así que la pantalla no espera al siguiente latido
          // para enseñar la bandera. La lista sí se recarga: el contador de la fila también sube.
          if (reportes) this.detalle.set({ ...actual, reportes });
          this.cargar(true);
        },
        error: (err) => {
          this.reportando.set(false);
          this.errorReporte.set(
            err?.error?.message ?? 'No se pudo reportar la conversación. Inténtalo de nuevo.',
          );
        },
      });
  }

  /** Deshace el propio reporte. El del asistente no se toca desde aquí: se revisa, no se borra. */
  retirarReporte(): void {
    const actual = this.detalle();
    if (!actual || this.reportando()) return;

    this.reportando.set(true);
    this.errorReporte.set(null);

    this.service.retirarReporte(actual.conversacion.id_conversacion).subscribe({
      next: (reportes) => {
        this.reportando.set(false);
        this.cerrarPanelReporte();
        if (reportes) this.detalle.set({ ...actual, reportes });
        this.cargar(true);
      },
      error: () => {
        this.reportando.set(false);
        this.errorReporte.set('No se pudo retirar el reporte.');
      },
    });
  }

  /** Cómo se lee un motivo, incluidos los dos que solo pone el asistente. */
  etiquetaMotivo(motivo: string | null): string {
    return motivo ? ETIQUETA_MOTIVO[motivo] ?? motivo : '';
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

  /** Quién escribió. El teléfono es el respaldo cuando la persona no está identificada. */
  quien(c: ConversacionBandeja): string {
    return c.persona || c.telefono_e164 || c.id_externo || 'Sin identificar';
  }

  /** Iniciales para el avatar. Dos letras como mucho: más no se leen en un círculo. */
  iniciales(c: ConversacionBandeja): string {
    const nombre = this.quien(c).trim();
    if (/^\+?\d/.test(nombre)) return nombre.slice(-2);
    return nombre
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
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
