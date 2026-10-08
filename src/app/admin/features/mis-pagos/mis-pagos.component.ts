import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Wallet, CreditCard, Loader2, AlertCircle, CheckCircle2, Clock, Plus, Minus, Check, X,
  Receipt, Eye, FileText, Share2, Download, Mail, Send,
} from 'lucide-angular';

import { CobranzaService } from '../../data-access/cobranza.service';
import { ConciliacionPagosService } from '../../data-access/conciliacion-pagos.service';
import { AuthService } from '../../../auth/data-access/auth.service';
import { SelectorPlanesComponent } from './selector-planes.component';
import { ModalCabeceraComponent } from '../../../shared/modal-cabecera/modal-cabecera.component';
import {
  CobroNegocio,
  CodigoPasarela,
  ComplementoCliente,
  FacturaPendiente,
  PagoRealizado,
  PasarelaElegible,
  PlanDisponible,
  SimulacionCambio,
} from '../../models/cobranza.models';
import { LoadingState } from '../../models/admin.models';
import { Vencimiento, evaluarVencimiento } from '../../../core/utils/estado-plan';
import { hoyBogota } from '../../../core/utils/vigencia';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../shared/toast/toast.service';
import {
  EstadoNegocioSelector,
  NegocioSelector,
  SelectorNegocioComponent,
} from '../../../shared/selector-negocio/selector-negocio.component';
import {
  MarcaPasarela,
  marcaDe,
  recordarPago,
  tomarPagoEnCurso,
} from '../../../core/utils/pasarelas';

/** Tono del plan → punto del chip. `info` (plan por iniciar) no dice ni bien ni mal: neutro. */
const ESTADO_SELECTOR: Record<Vencimiento['tono'], EstadoNegocioSelector> = {
  success: 'ok',
  warning: 'aviso',
  error: 'error',
  info: 'neutro',
};

/** Un negocio con su vigencia ya traducida a estado, etiqueta y tono. */
type CobroVista = CobroNegocio & { vencimiento: Vencimiento };

/** Las tres cosas que se pueden hacer con la mensualidad: pagarla, cambiarla, o revisar lo pagado. */
type Tab = 'pagar' | 'plan' | 'historial';

/**
 * El navegador cuando sabe compartir archivos (móvil). Se tipa a mano porque `canShare` no está
 * en la librería DOM de todas las versiones de TypeScript, y un `any` taparía los dos métodos
 * que de verdad hay que comprobar antes de llamar.
 */
type NavegadorQueComparte = Navigator & {
  canShare?: (datos: { files?: File[] }) => boolean;
  share?: (datos: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

/**
 * MisPagosComponent — el administrador del negocio ve y paga su mensualidad desde la app.
 *
 * ## El estado es el del PLAN, no el de la suscripción
 *
 * La etiqueta sale de `evaluarVencimiento`, la misma lógica del dashboard y de Negocios. Antes
 * salía de `cob_suscripcion.estado`, que se queda en «activa» aunque el plan haya vencido, y un
 * negocio vencido hace dos semanas aparecía como «Al día».
 *
 * ## Una fecha que importa, no un rango
 *
 * La tarjeta no muestra el período de la factura («14 sep → 13 oct»): al dueño no le dice nada
 * y hace ruido. Muestra la fecha que sí le importa —cuándo vence o venció su plan— y, en el cobro,
 * qué pasa cuando paga.
 *
 * Pagar abre siempre el checkout de la pasarela. No hay pago «en un clic» contra una tarjeta
 * guardada: ese es trabajo del cobro automático, no de un botón.
 *
 * ## Tres pestañas por negocio
 *
 * «Pagar mi plan» (a lo que se entra el 95% de las veces), «Cambiar plan» y «Historial». La
 * tercera es de consulta: la tabla de lo pagado con el detalle, el PDF y el envío del comprobante
 * —ver `admin_ws/docs/cobro-mensualidades.md` §«Historial y comprobante de pago»—. El PDF lo
 * genera el backend: un comprobante lo tiene que firmar quien conoce el pago, no la pantalla.
 */
@Component({
  selector: 'app-mis-pagos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    SelectorNegocioComponent,
    SelectorPlanesComponent,
    ModalCabeceraComponent,
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Wallet, CreditCard, Loader2, AlertCircle, CheckCircle2, Clock, Plus, Minus, Check, X,
        Receipt, Eye, FileText, Share2, Download, Mail, Send,
      }),
    },
  ],
  templateUrl: './mis-pagos.component.html',
  styleUrl: './mis-pagos.component.scss',
})
export class MisPagosComponent implements OnInit {
  private readonly api = inject(CobranzaService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly conciliacion = inject(ConciliacionPagosService);
  private readonly auth = inject(AuthService);

  /**
   * Si la conciliación confirma un pago mientras esta pantalla está abierta, los cobros que
   * muestra quedaron viejos (la factura ya está pagada): se recargan. La primera lectura de la
   * señal es la de siempre y no recarga; solo los cambios posteriores.
   */
  private pagosVistos = this.conciliacion.pagosConfirmados();
  private readonly recargarAlConfirmarPago = effect(() => {
    const n = this.conciliacion.pagosConfirmados();
    if (n === this.pagosVistos) return;
    this.pagosVistos = n;
    untracked(() => this.cargar());
  });

  protected readonly estado = signal<LoadingState>('loading');
  private readonly cobros = signal<CobroNegocio[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly procesando = signal<string | null>(null);

  protected readonly vistas = computed<CobroVista[]>(() =>
    this.cobros().map((c) => ({ ...c, vencimiento: evaluarVencimiento(c.vigencia ?? null) })),
  );

  // ── Un negocio por chip ─────────────────────────────────────
  //
  // Con varios negocios apilar todo obligaba a recorrer la pantalla entera para llegar al de
  // abajo. Con uno solo no hay nada que elegir y `app-selector-negocio` no pinta nada.

  /** Id del negocio elegido. Nulo = el primero. */
  private readonly negocioElegido = signal<number | null>(null);

  /** Id para el selector: el del negocio, o uno negativo estable si el backend no lo manda. */
  protected idDe(c: CobroVista): number {
    return c.id_negocio ?? -(this.vistas().indexOf(c) + 1);
  }

  protected readonly variosNegocios = computed(() => this.vistas().length > 1);

  protected readonly negocioActivo = computed<CobroVista | null>(() => {
    const lista = this.vistas();
    return lista.find((c) => this.idDe(c) === this.negocioElegido()) ?? lista[0] ?? null;
  });

  protected readonly idActivo = computed(() => {
    const activo = this.negocioActivo();
    return activo ? this.idDe(activo) : null;
  });

  /** Lo que se dibuja: todos si es uno solo (sin chips), o solo el del chip activo. */
  protected readonly visibles = computed<CobroVista[]>(() => {
    const lista = this.vistas();
    if (lista.length <= 1) return lista;
    const activo = this.negocioActivo();
    return activo ? [activo] : [];
  });

  /**
   * Los chips: el punto es el estado del plan de ese negocio; el número, sus cobros pendientes.
   * Un negocio sin plan lleva punto de aviso y «Sin plan»: no está vencido, le falta contratar.
   */
  protected readonly opcionesNegocio = computed<NegocioSelector[]>(() =>
    this.vistas().map((c) => ({
      id: this.idDe(c),
      nombre: c.negocio,
      estado: c.sin_plan ? 'aviso' : ESTADO_SELECTOR[c.vencimiento.tono],
      contador: c.facturas.length,
      titulo: c.sin_plan ? 'Sin plan' : c.vencimiento.etiqueta,
    })),
  );

  protected elegirNegocio(id: number): void {
    this.negocioElegido.set(id);
  }

  // ── Vuelta del checkout ─────────────────────────────────────
  //
  // El administrador que paga desde aquí vuelve AQUÍ, con su sesión intacta. Antes toda vuelta
  // caía en `/pagar` —el portal público— y lo sacaba de la sesión: la URL de retorno ahora la
  // elige el backend según de dónde salió el pago.

  protected readonly confirmacion = signal<
    'confirmando' | 'aprobada' | 'pendiente' | 'rechazada' | 'desconocida' | null
  >(null);

  ngOnInit(): void {
    // `?negocio=<id>` preselecciona ese chip: es a donde llegan los enlaces «Ver planes» de otras
    // pantallas (WhatsApp). Si el id no es de un negocio de la lista, manda el primero, como siempre.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      const id = Number(q.get('negocio'));
      if (Number.isInteger(id) && id > 0) this.negocioElegido.set(id);
    });

    this.cargar();
    this.confirmarSiVuelveDePagar();
  }

  /**
   * Wompi vuelve con `?id=<transacción>`; dLocal no devuelve nada, así que se usa el id que se
   * guardó antes de salir. Se prefiere el de la URL cuando existe: lo pone la pasarela.
   */
  private confirmarSiVuelveDePagar(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const enCurso = tomarPagoEnCurso();
    const idUrl = new URLSearchParams(window.location.search).get('id');
    const pasarela = enCurso?.pasarela ?? 'wompi';
    const id = idUrl || enCurso?.idExterno;
    if (!id) return;

    this.confirmacion.set('confirmando');
    this.api.confirmarPago(pasarela, id).subscribe({
      next: (r) => {
        this.confirmacion.set(r?.estado ?? 'pendiente');
        // Si el pago entró, las facturas y la vigencia que están en pantalla ya no valen.
        if (r?.estado === 'aprobada') this.cargar();
      },
      // No poder confirmar ahora no es un rechazo: el webhook puede cerrarlo en minutos.
      error: () => this.confirmacion.set('pendiente'),
    });
  }

  protected cargar(): void {
    this.estado.set('loading');
    this.api.getMisCobros().subscribe({
      next: (cobros) => {
        this.cobros.set(cobros);
        this.estado.set('success');
        // Un pago que acaba de entrar es una fila nueva del historial. Se refresca solo si el
        // usuario está mirándolo; los demás negocios se releen al entrar a su pestaña.
        const activo = this.negocioActivo();
        if (activo && this.tabDe(activo) === 'historial') this.cargarPagos(activo);
      },
      error: (err) => {
        this.error.set(this.mensajeDeError(err, 'No pudimos cargar tus pagos.'));
        this.estado.set('error');
      },
    });
  }

  // ── Cambio de plan y de complementos ────────────────────────
  //
  // Van juntos porque son una sola cuenta: subir de plan y añadir un usuario a la vez se cobra
  // por la diferencia neta, no como dos cambios encadenados. El panel deja preparar todo y
  // guardarlo de una vez; hasta que no se guarda, no se cobra ni se pide nada.

  protected readonly cambiandoPlan = signal(false);
  protected readonly avisoPlan = signal<string | null>(null);

  /**
   * Qué pestaña mira cada negocio.
   *
   * Por negocio y no una global porque el usuario puede administrar varios y no tiene por qué
   * estar en lo mismo en todos. Arranca en «Pagar», que es a lo que se entra el 95% de las
   * veces; cambiar de plan es una decisión de una vez cada varios meses.
   */
  private readonly tabs = signal<Record<number, Tab>>({});

  protected tabDe(c: CobroVista): Tab {
    return this.tabs()[c.id_negocio ?? -1] ?? 'pagar';
  }

  protected verTab(c: CobroVista, tab: Tab): void {
    if (!c.id_negocio) return;
    this.avisoPlan.set(null);
    this.error.set(null);
    // Al entrar a «Cambiar plan» el panel se arma con lo que el negocio tiene hoy, no con lo que
    // quedó de la última visita.
    if (tab === 'plan') this.prepararPanel(c);
    else this.simulacion.set(null);
    if (tab === 'historial') this.cargarPagos(c);
    this.tabs.update((m) => ({ ...m, [c.id_negocio!]: tab }));
  }

  /** El plan marcado en el panel mientras se decide. Sin marcar = el que ya tiene pedido o activo. */
  private readonly planElegido = signal<number | null>(null);

  /** Cantidades de complementos que se están editando, por código. */
  private readonly complementosEditados = signal<Record<string, number>>({});

  /** Arranca el panel con lo que el negocio tiene hoy (o con lo que dejó pedido). */
  private prepararPanel(c: CobroVista): void {
    this.planElegido.set(c.id_plan_solicitado ?? c.id_plan ?? null);
    const cantidades: Record<string, number> = {};
    for (const x of c.complementos?.complementos ?? []) {
      cantidades[x.codigo] = x.cantidad_solicitada ?? x.cantidad;
    }
    this.complementosEditados.set(cantidades);
    this.simulacion.set(null);
  }

  protected planMarcado(c: CobroVista): number | null {
    return this.planElegido() ?? c.id_plan_solicitado ?? c.id_plan ?? null;
  }

  protected marcarPlan(c: CobroVista, idPlan: number): void {
    this.planElegido.set(idPlan);
    this.avisoPlan.set(null);
    this.simular(c);
  }

  protected cantidadDe(x: ComplementoCliente): number {
    const editado = this.complementosEditados()[x.codigo];
    return editado ?? x.cantidad_solicitada ?? x.cantidad;
  }

  protected ajustarComplemento(c: CobroVista, x: ComplementoCliente, delta: number): void {
    const actual = this.cantidadDe(x);
    const nueva = Math.max(0, Math.min(x.cantidad_maxima, actual + delta));
    this.complementosEditados.update((m) => ({ ...m, [x.codigo]: nueva }));
    this.avisoPlan.set(null);
    this.simular(c);
  }

  /** Lo que costaría al mes lo que hay marcado ahora mismo en el panel. */
  protected mensualPrevisto(c: CobroVista): number {
    const plan = c.planes?.find((p) => p.id_plan === this.planMarcado(c));
    const base = plan?.precio ?? 0;
    return (c.complementos?.complementos ?? []).reduce(
      (suma, x) => suma + this.cantidadDe(x) * x.precio,
      base,
    );
  }

  /** Lo que paga hoy al mes: su plan activo más los complementos que ya tiene. */
  protected mensualActual(c: CobroVista): number {
    const plan = c.planes?.find((p) => p.id_plan === c.id_plan);
    const base = plan?.precio ?? 0;
    return (c.complementos?.complementos ?? []).reduce(
      (suma, x) => suma + x.cantidad * x.precio,
      base,
    );
  }

  /** ¿Hay algo distinto de lo que tiene hoy? Es lo que habilita el botón de guardar. */
  protected hayCambios(c: CobroVista): boolean {
    if (this.planMarcado(c) !== (c.id_plan ?? null)) return true;
    return (c.complementos?.complementos ?? []).some((x) => this.cantidadDe(x) !== x.cantidad);
  }

  /**
   * Lo que el backend cobraría por lo marcado en el panel, o `null` si no se sabe (cargando, sin
   * subida, o la simulación falló). El aviso solo AÑADE el monto cuando llega: nunca bloquea el
   * cambio ni cambia su texto mientras tanto.
   */
  protected readonly simulacion = signal<SimulacionCambio | null>(null);

  /** Descarta respuestas de simulaciones viejas: gana siempre la última que se pidió. */
  private simulacionSeq = 0;

  private simular(c: CobroVista): void {
    const seq = ++this.simulacionSeq;
    this.simulacion.set(null);
    if (!c.id_negocio || !this.hayCambios(c) || !this.estaAlDia(c.vencimiento) || !this.subeDePrecio(c)) {
      return;
    }

    this.api
      .simularCambio(c.id_negocio, this.cambioPedido(c))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (seq === this.simulacionSeq) this.simulacion.set(r?.aplica === 'ajuste' ? r : null);
        },
        error: () => {
          if (seq === this.simulacionSeq) this.simulacion.set(null);
        },
      });
  }

  /** «Plan Básico» tal cual, o «plan Básico» si el catálogo trae solo el apellido. */
  protected nombreConPlan(nombre: string): string {
    return /^plan/i.test(nombre) ? nombre : `plan ${nombre}`;
  }

  /**
   * El cambio marcado en el panel, tal como viaja. UNA sola construcción para simular y para
   * guardar: si difirieran, se simularía una cosa y se cobraría otra.
   */
  private cambioPedido(c: CobroVista): {
    idPlan: number | null;
    complementos: Array<{ codigo: string; cantidad: number }>;
  } {
    return {
      idPlan: this.planMarcado(c),
      complementos: (c.complementos?.complementos ?? []).map((x) => ({
        codigo: x.codigo,
        cantidad: this.cantidadDe(x),
      })),
    };
  }

  /** El plan que tiene activo hoy, para nombrarlo en el aviso de subida. */
  protected planActualDe(c: CobroVista): PlanDisponible | undefined {
    return c.planes?.find((p) => p.id_plan === c.id_plan);
  }

  /** Días que le quedan al plan vigente (ya calculados por `evaluarVencimiento`). 0 si no hay. */
  protected diasRestantes(v: Vencimiento): number {
    return this.estaAlDia(v) ? Math.max(0, v.dias ?? 0) : 0;
  }

  /** Lo que el cliente va a ver: sube (se cobra ahora) o baja (entra al renovar). */
  protected subeDePrecio(c: CobroVista): boolean {
    return this.mensualPrevisto(c) > this.mensualActual(c);
  }

  /**
   * Guarda plan y complementos de una vez.
   *
   * El backend decide si eso se cobra hoy (subida, prorrateada por los días que faltan) o si
   * entra en la próxima renovación (bajada), y devuelve el mensaje que explica cuál fue.
   */
  protected guardarCambios(c: CobroVista): void {
    if (!c.id_negocio || !this.hayCambios(c)) return;

    this.cambiandoPlan.set(true);
    this.avisoPlan.set(null);
    this.error.set(null);

    this.api
      .cambiarMiPlan(c.id_negocio, this.cambioPedido(c))
      .subscribe({
        next: (r) => {
          this.cambiandoPlan.set(false);
          if (r?.mensaje) this.avisoPlan.set(r.mensaje);
          this.toast.exito('Guardamos tu cambio de plan.');
          // Si subir generó un cobro, lo siguiente que tiene que hacer es pagarlo: se le lleva
          // a la pestaña donde está, en vez de dejarle buscarlo.
          // Sin plan vigente el cambio se sumó a la mensualidad pendiente: también toca pagarla.
          if (r?.aplica === 'ajuste' || !this.estaAlDia(c.vencimiento)) this.verTab(c, 'pagar');
          this.cargar();
        },
        error: (err) => {
          this.cambiandoPlan.set(false);
          this.toast.errorHttp(err, 'No se pudo cambiar el plan.');
        },
      });
  }

  /** Plan en el que se está pulsando «Elegir» en un negocio sin plan (bloquea solo ese botón). */
  protected readonly eligiendoPlan = signal<number | null>(null);

  /**
   * Un negocio SIN plan elige el primero. No hay nada que cambiar ni que comparar: el backend crea
   * la suscripción y genera el cobro del primer mes, y el plan se activa cuando ese cobro se paga.
   * Por eso, al terminar, se vuelve a cargar y el negocio aparece con su cobro listo para pagar.
   */
  /** El selector agrupado emite el id de la fila real; aquí se vuelve al plan completo. */
  protected elegirPrimerPlanPorId(c: CobroVista, idPlan: number): void {
    const plan = c.planes?.find((p) => p.id_plan === idPlan);
    if (plan) this.elegirPrimerPlan(c, plan);
  }

  protected elegirPrimerPlan(c: CobroVista, plan: PlanDisponible): void {
    if (!c.id_negocio || this.eligiendoPlan() !== null) return;

    this.eligiendoPlan.set(plan.id_plan);
    this.error.set(null);

    this.api.cambiarMiPlan(c.id_negocio, { idPlan: plan.id_plan }).subscribe({
      next: (r) => {
        this.eligiendoPlan.set(null);
        this.toast.exito(r?.mensaje ?? `Elegiste el ${plan.nombre}. Págalo para activarlo.`);
        this.tabs.update((m) => ({ ...m, [c.id_negocio!]: 'pagar' }));
        this.cargar();
      },
      error: (err) => {
        this.eligiendoPlan.set(null);
        this.toast.errorHttp(err, 'No se pudo elegir el plan.');
      },
    });
  }

  /** Cancela lo pedido y sin pagar: se vuelve a lo que el negocio tiene contratado hoy. */
  protected cancelarSolicitud(c: CobroVista): void {
    if (!c.id_negocio) return;

    this.cambiandoPlan.set(true);
    this.avisoPlan.set(null);
    this.error.set(null);

    // Mandar lo que ya tiene es, para el backend, «deshaz lo pendiente».
    const complementos = (c.complementos?.complementos ?? []).map((x) => ({
      codigo: x.codigo,
      cantidad: x.cantidad,
    }));

    this.api.cambiarMiPlan(c.id_negocio, { idPlan: c.id_plan ?? null, complementos }).subscribe({
      next: (r) => {
        this.cambiandoPlan.set(false);
        if (r?.mensaje) this.avisoPlan.set(r.mensaje);
        this.toast.exito('Cancelamos el cambio que habías pedido.');
        this.cargar();
      },
      error: (err) => {
        this.cambiandoPlan.set(false);
        this.toast.errorHttp(err, 'No se pudo cancelar el cambio.');
      },
    });
  }

  /** Lo pedido de un complemento, para poder decir «tienes 2, pediste 4». */
  protected pendienteDe(c: CobroVista): ComplementoCliente[] {
    return (c.complementos?.complementos ?? []).filter(
      (x) => x.cantidad_solicitada != null && x.cantidad_solicitada !== x.cantidad,
    );
  }

  /** El título de un cobro dice qué cobra: la renovación de un plan, o el cambio a otro. */
  protected conceptoDe(c: CobroVista, f: FacturaPendiente): string {
    if (f.tipo === 'ajuste') return `Cambio de plan · ${f.plan ?? c.plan}`;
    return `Mensualidad · ${f.plan ?? c.plan}`;
  }

  /** Qué pasa al pagar ESTE cobro. Un ajuste no renueva: estrena. */
  protected efectoDeFactura(c: CobroVista, f: FacturaPendiente): string {
    if (f.tipo === 'ajuste') {
      return 'Al pagar, el cambio queda activo de inmediato y tu fecha de vencimiento no se mueve.';
    }
    return this.efectoDelPago(c.vencimiento);
  }

  // ── Historial: los pagos ya hechos ──────────────────────────
  //
  // La tercera pestaña es de consulta, no de decisión: una tabla con lo pagado y, por fila, las
  // tres cosas que alguien pide de un pago viejo —verlo, tener el PDF y mandárselo a su contador.
  // No lleva paginador a propósito: el backend topa en 120 filas, que son diez años de
  // mensualidades, y un paginador para doce filas al año solo añade clics.

  /** Los pagos por negocio. Por negocio porque el usuario puede administrar varios. */
  private readonly pagos = signal<Record<number, PagoRealizado[]>>({});
  protected readonly estadoPagos = signal<LoadingState>('idle');

  /** Factura cuya acción (PDF, compartir, envío) está en curso: bloquea solo esa fila. */
  protected readonly ocupado = signal<number | null>(null);

  /** El pago abierto en la ficha de detalle. */
  protected readonly detalle = signal<PagoRealizado | null>(null);

  /** El pago que se está mandando por correo, con su destinatario. */
  protected readonly envio = signal<PagoRealizado | null>(null);
  protected readonly emailEnvio = signal('');
  protected readonly enviando = signal(false);

  protected pagosDe(c: CobroVista): PagoRealizado[] {
    return this.pagos()[c.id_negocio ?? -1] ?? [];
  }

  /**
   * Trae los pagos del negocio.
   *
   * `cargando` solo la primera vez (regla del tiempo real de la consola): al volver a la pestaña
   * ya hay filas en pantalla y vaciarlas para pintar «Cargando…» es un parpadeo gratis. Si la
   * recarga falla, se queda lo que había: una lista vieja informa más que un error.
   */
  protected cargarPagos(c: CobroVista): void {
    const id = c.id_negocio;
    if (!id) return;

    const primeraVez = !this.pagos()[id];
    if (primeraVez) this.estadoPagos.set('loading');

    this.api
      .getMisPagos(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagos) => {
          this.pagos.update((m) => ({ ...m, [id]: pagos }));
          this.estadoPagos.set('success');
        },
        error: (err) => {
          if (primeraVez) {
            this.estadoPagos.set('error');
            this.error.set(this.mensajeDeError(err, 'No pudimos cargar tus pagos anteriores.'));
          } else {
            this.estadoPagos.set('success');
          }
        },
      });
  }

  /** ¿Este navegador sabe compartir archivos? En escritorio casi nunca: ahí la vía es el correo. */
  private get navegador(): NavegadorQueComparte | null {
    return isPlatformBrowser(this.platformId) ? (navigator as NavegadorQueComparte) : null;
  }

  protected readonly puedeCompartirArchivos = computed(() => {
    const nav = this.navegador;
    return typeof nav?.share === 'function' && typeof nav?.canShare === 'function';
  });

  /** «Mensualidad · Plan Básico» o «Cambio de plan · Plan Avanzado». */
  protected conceptoDePago(p: PagoRealizado): string {
    const plan = p.plan ? ` · ${p.plan}` : '';
    return p.tipo === 'ajuste' ? `Cambio de plan${plan}` : `Mensualidad${plan}`;
  }

  /** Con qué pagó. Lo tecleado en un pago manual manda sobre el nombre de la pasarela. */
  protected medioDePago(p: PagoRealizado): string {
    if (p.medio_pago_texto) return p.medio_pago_texto;
    return marcaDe(p.pasarela).marca;
  }

  /** ¿Ese pago ya tiene factura electrónica nuestra? Cambia cómo se llama el documento. */
  protected esFactura(p: PagoRealizado): boolean {
    return Boolean(p.numero_factura);
  }

  /** '5 oct 2026' — la columna de la tabla, donde el ancho importa. */
  protected fechaCorta(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Bogota',
    });
  }

  /** '5 de octubre de 2026, 2:32 p. m.' — el detalle, donde sí cabe la hora. */
  protected fechaHora(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Bogota',
    });
  }

  /** El período que cubrió el pago. Un ajuste no compra período: mejora el que ya estaba pagado. */
  protected periodoDe(p: PagoRealizado): string {
    if (p.tipo === 'ajuste') return 'Ajuste de plan (no mueve el vencimiento)';
    return `${this.diaLargo(p.periodo_inicio)} → ${this.diaLargo(p.periodo_fin)}`;
  }

  /** El PDF del comprobante, una sola vez, para quien lo necesite (ver, bajar o compartir). */
  private traerComprobante(p: PagoRealizado, hecho: (blob: Blob) => void): void {
    if (!isPlatformBrowser(this.platformId) || this.ocupado() !== null) return;

    this.ocupado.set(p.id_factura);
    this.api
      .getComprobante(p.id_factura)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.ocupado.set(null);
          hecho(blob);
        },
        error: (err) => {
          this.ocupado.set(null);
          this.toast.errorHttp(err, 'No pudimos generar el comprobante.');
        },
      });
  }

  private nombreArchivo(p: PagoRealizado): string {
    return `comprobante-${p.referencia}.pdf`;
  }

  /**
   * Abre el PDF en una pestaña nueva.
   *
   * La URL `blob:` se revoca con retraso: revocarla al instante deja a la pestaña recién abierta
   * sin nada que cargar. Si el bloqueador de ventanas se come la pestaña, se descarga — que es lo
   * que el usuario quería de todos modos.
   */
  protected verComprobante(p: PagoRealizado): void {
    this.traerComprobante(p, (blob) => {
      const url = URL.createObjectURL(blob);
      const ventana = window.open(url, '_blank');
      if (!ventana) this.descargarUrl(url, this.nombreArchivo(p));
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }

  protected descargarComprobante(p: PagoRealizado): void {
    this.traerComprobante(p, (blob) => {
      const url = URL.createObjectURL(blob);
      this.descargarUrl(url, this.nombreArchivo(p));
      URL.revokeObjectURL(url);
    });
  }

  private descargarUrl(url: string, nombre: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
  }

  /**
   * Compartir el comprobante.
   *
   * En el móvil abre la hoja de compartir del sistema **con el PDF adjunto**: de ahí sale a
   * WhatsApp, al correo o a donde el dueño quiera, sin que nosotros tengamos que integrar nada.
   * En escritorio esa API casi nunca existe, y entonces se cae al envío por correo, que es lo que
   * de verdad pide quien tiene que mandárselo a su contador.
   */
  protected compartir(p: PagoRealizado): void {
    const nav = this.navegador;
    if (!nav || !this.puedeCompartirArchivos()) {
      this.abrirEnvio(p);
      return;
    }

    this.traerComprobante(p, (blob) => {
      const archivo = new File([blob], this.nombreArchivo(p), { type: 'application/pdf' });
      if (!nav.canShare!({ files: [archivo] })) {
        this.abrirEnvio(p);
        return;
      }
      nav
        .share!({
          files: [archivo],
          title: `Comprobante ${p.referencia}`,
          text: `Pago de ${this.dinero(p.total, p.moneda)} · ${p.negocio} · EscalApp`,
        })
        .catch((err: unknown) => {
          // Cerrar la hoja de compartir no es un fallo: no se avisa de nada.
          if ((err as DOMException)?.name !== 'AbortError') this.abrirEnvio(p);
        });
    });
  }

  /** El envío por correo arranca con el correo de la sesión: es el destinatario del 90% de los casos. */
  protected abrirEnvio(p: PagoRealizado): void {
    this.emailEnvio.set(this.auth.currentUser()?.email ?? '');
    this.envio.set(p);
  }

  protected cerrarEnvio(): void {
    if (this.enviando()) return;
    this.envio.set(null);
  }

  protected escribirEmail(valor: string): void {
    this.emailEnvio.set(valor);
  }

  protected enviarComprobante(): void {
    const p = this.envio();
    if (!p || this.enviando()) return;

    this.enviando.set(true);
    this.api.enviarComprobante(p.id_factura, this.emailEnvio().trim() || null).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.envio.set(null);
        // `enviado: false` es el entorno de desarrollo sin SMTP. Decir «ya se envió» ahí sería
        // mentir, así que el aviso lo dice tal cual.
        if (r?.enviado) this.toast.exito(`Comprobante enviado a ${r.email}`);
        else this.toast.info('El correo no está configurado en este entorno.');
      },
      error: (err) => {
        this.enviando.set(false);
        this.toast.errorHttp(err, 'No pudimos enviar el comprobante.');
      },
    });
  }

  // ── Elegir con qué pagar ────────────────────────────────────
  //
  // Dos pasos (elegir y después pagar) en vez de un botón por pasarela: con dos marcas, una fila
  // de botones obliga a decidir y a actuar en el mismo gesto, y no deja sitio para decir cuál
  // conviene. El select se abre en la recomendada, así que quien no quiera pensarlo solo pulsa
  // «Pagar».

  /** Pasarela elegida por referencia de factura. Sin entrada = todavía manda la recomendada. */
  private readonly seleccion = signal<Record<string, CodigoPasarela>>({});

  /** Logos que no cargaron: se cae al distintivo de texto y no se reintenta en cada render. */
  private readonly logosRotos = signal<Set<string>>(new Set());

  protected elegida(referencia: string, pasarelas: PasarelaElegible[]): CodigoPasarela {
    const guardada = this.seleccion()[referencia];
    if (guardada && pasarelas.some((p) => p.codigo === guardada)) return guardada;
    return (pasarelas.find((p) => p.recomendada) ?? pasarelas[0])?.codigo ?? 'wompi';
  }

  protected seleccionar(referencia: string, codigo: string): void {
    this.seleccion.update((m) => ({ ...m, [referencia]: codigo as CodigoPasarela }));
  }

  protected marca(codigo: CodigoPasarela, nombre = ''): MarcaPasarela {
    return marcaDe(codigo, nombre);
  }

  protected logo(codigo: CodigoPasarela): string | null {
    const archivo = marcaDe(codigo).logo;
    if (!archivo || this.logosRotos().has(archivo)) return null;
    return `${environment.assetPath}/${archivo}`;
  }

  /** Un logo que falta no es un error: la marca se sigue leyendo como texto. */
  protected logoFallo(codigo: CodigoPasarela): void {
    const archivo = marcaDe(codigo).logo;
    this.logosRotos.update((s) => new Set(s).add(archivo));
  }

  protected pagar(factura: FacturaPendiente, pasarelas: PasarelaElegible[]): void {
    if (!factura.id_factura) return;

    const pasarela = this.elegida(factura.referencia, pasarelas);
    this.procesando.set(factura.referencia);
    this.error.set(null);

    this.api.pagarFactura(factura.id_factura, pasarela).subscribe({
      next: (r) => {
        this.procesando.set(null);
        if (r?.urlPago) {
          // Se recuerda ANTES de salir: al volver, esto es lo único que identifica el pago
          // cuando la pasarela no devuelve un id en la URL (el caso de dLocal).
          if (r.idExterno) {
            recordarPago({ pasarela, idExterno: r.idExterno, referencia: factura.referencia });
          }
          if (isPlatformBrowser(this.platformId)) window.location.href = r.urlPago;
          return;
        }
        this.toast.error('No pudimos abrir la página de pago. Intenta de nuevo en unos minutos.');
      },
      error: (err) => {
        this.procesando.set(null);
        this.toast.errorHttp(err, 'No pudimos iniciar el pago.');
      },
    });
  }

  /** ¿Plan en fechas? Solo entonces «sin facturas» es una buena noticia y merece el ✓ verde. */
  protected estaAlDia(v: Vencimiento): boolean {
    return v.clave === 'AL_DIA' || v.clave === 'POR_VENCER';
  }

  /** La única fecha que le importa al dueño: cuándo vence (o venció) su plan. */
  protected detalleVigencia(v: Vencimiento): string {
    switch (v.clave) {
      case 'AL_DIA':
        return v.fin
          ? `Tu plan está activo hasta el ${this.diaLargo(v.fin)}`
          : 'Tu plan no tiene fecha de vencimiento';
      case 'POR_VENCER':
        return `Tu plan vence el ${this.diaLargo(v.fin)}`;
      case 'GRACIA':
        return `Tu plan venció el ${this.diaLargo(v.fin)}. Puedes seguir usando EscalApp hasta el ${this.diaLargo(v.limiteGracia)}`;
      case 'VENCIDO':
        return `Tu plan venció el ${this.diaLargo(v.fin)}`;
      case 'PENDIENTE':
        return `Tu plan inicia el ${this.diaLargo(v.inicio)}`;
      default:
        return 'Este negocio no tiene un plan activo';
    }
  }

  /** Qué pasa cuando paga. Dice más que el período de la factura y no hace ruido. */
  protected efectoDelPago(v: Vencimiento): string {
    if (v.clave === 'VENCIDO' || v.clave === 'GRACIA') {
      return 'Al pagar, tu negocio se reactiva de inmediato.';
    }
    if (v.clave === 'SIN_PLAN' || v.clave === 'PENDIENTE') {
      return 'Al pagar, tu plan queda activo.';
    }
    return 'Al pagar, tu plan se renueva por un mes.';
  }

  protected dinero(valor: number | string, moneda = 'COP'): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: moneda || 'COP',
      maximumFractionDigits: 0,
    }).format(Number(valor ?? 0));
  }

  /** «1 de septiembre»; con año solo si no es el actual. */
  private diaLargo(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    const mismoAnio = y === Number(hoyBogota().slice(0, 4));
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      ...(mismoAnio ? {} : { year: 'numeric' }),
      timeZone: 'UTC',
    });
  }

  private mensajeDeError(err: unknown, porDefecto: string): string {
    return (err as { error?: { message?: string } })?.error?.message || porDefecto;
  }
}
