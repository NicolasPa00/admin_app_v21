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
} from 'lucide-angular';

import { CobranzaService } from '../../data-access/cobranza.service';
import { ConciliacionPagosService } from '../../data-access/conciliacion-pagos.service';
import { SelectorPlanesComponent } from './selector-planes.component';
import {
  CobroNegocio,
  CodigoPasarela,
  ComplementoCliente,
  FacturaPendiente,
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
 */
@Component({
  selector: 'app-mis-pagos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, SelectorNegocioComponent, SelectorPlanesComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Wallet, CreditCard, Loader2, AlertCircle, CheckCircle2, Clock, Plus, Minus, Check, X,
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
  private readonly tabs = signal<Record<number, 'pagar' | 'plan'>>({});

  protected tabDe(c: CobroVista): 'pagar' | 'plan' {
    return this.tabs()[c.id_negocio ?? -1] ?? 'pagar';
  }

  protected verTab(c: CobroVista, tab: 'pagar' | 'plan'): void {
    if (!c.id_negocio) return;
    this.avisoPlan.set(null);
    this.error.set(null);
    // Al entrar a «Cambiar plan» el panel se arma con lo que el negocio tiene hoy, no con lo que
    // quedó de la última visita.
    if (tab === 'plan') this.prepararPanel(c);
    else this.simulacion.set(null);
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
