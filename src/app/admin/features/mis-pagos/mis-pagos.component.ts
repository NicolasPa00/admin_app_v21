import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Wallet, CreditCard, Loader2, AlertCircle, CheckCircle2, Clock,
} from 'lucide-angular';

import { CobranzaService } from '../../data-access/cobranza.service';
import {
  CobroNegocio,
  CodigoPasarela,
  FacturaPendiente,
  PasarelaElegible,
} from '../../models/cobranza.models';
import { LoadingState } from '../../models/admin.models';
import { Vencimiento, evaluarVencimiento } from '../../../core/utils/estado-plan';
import { hoyBogota } from '../../../core/utils/vigencia';
import { environment } from '../../../../environments/environment';
import {
  MarcaPasarela,
  marcaDe,
  recordarPago,
  tomarPagoEnCurso,
} from '../../../core/utils/pasarelas';

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
  imports: [LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Wallet, CreditCard, Loader2, AlertCircle, CheckCircle2, Clock,
      }),
    },
  ],
  templateUrl: './mis-pagos.component.html',
  styleUrl: './mis-pagos.component.scss',
})
export class MisPagosComponent implements OnInit {
  private readonly api = inject(CobranzaService);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly estado = signal<LoadingState>('loading');
  private readonly cobros = signal<CobroNegocio[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly procesando = signal<string | null>(null);

  protected readonly vistas = computed<CobroVista[]>(() =>
    this.cobros().map((c) => ({ ...c, vencimiento: evaluarVencimiento(c.vigencia ?? null) })),
  );

  // ── Vuelta del checkout ─────────────────────────────────────
  //
  // El administrador que paga desde aquí vuelve AQUÍ, con su sesión intacta. Antes toda vuelta
  // caía en `/pagar` —el portal público— y lo sacaba de la sesión: la URL de retorno ahora la
  // elige el backend según de dónde salió el pago.

  protected readonly confirmacion = signal<
    'confirmando' | 'aprobada' | 'pendiente' | 'rechazada' | 'desconocida' | null
  >(null);

  ngOnInit(): void {
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

  // ── Cambio de plan ──────────────────────────────────────────

  /** Negocio cuyo selector de planes está abierto, o null. */
  protected readonly planesAbiertos = signal<number | null>(null);
  protected readonly cambiandoPlan = signal(false);
  protected readonly avisoPlan = signal<string | null>(null);

  protected alternarPlanes(c: CobroVista): void {
    this.avisoPlan.set(null);
    this.error.set(null);
    this.planesAbiertos.update((abierto) =>
      abierto === c.id_negocio ? null : (c.id_negocio ?? null),
    );
  }

  /**
   * Elige otro plan. Lo que pasa después lo decide el backend y se le cuenta al usuario tal cual:
   * si tiene un cobro pendiente, ese cobro pasa a valer el plan nuevo y se aplica al pagarlo; si
   * está al día, el cambio entra en la próxima mensualidad. Nunca se cambia el plan sin pagar.
   */
  protected cambiarPlan(c: CobroVista, idPlan: number): void {
    if (!c.id_negocio || idPlan === c.id_plan) return;

    this.cambiandoPlan.set(true);
    this.avisoPlan.set(null);
    this.error.set(null);

    this.api.elegirPlan(c.id_negocio, idPlan).subscribe({
      next: (r) => {
        this.cambiandoPlan.set(false);
        this.planesAbiertos.set(null);
        if (r) {
          this.avisoPlan.set(
            r.aplica === 'ahora'
              ? `Tu cobro pendiente quedó por el ${r.plan_solicitado}. Al pagarlo, ese será tu plan.`
              : `Cambiarás al ${r.plan_solicitado} en tu próxima mensualidad.`,
          );
        }
        this.cargar();
      },
      error: (err) => {
        this.cambiandoPlan.set(false);
        this.error.set(this.mensajeDeError(err, 'No se pudo cambiar el plan.'));
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
        this.error.set('No pudimos abrir la página de pago. Intenta de nuevo en unos minutos.');
      },
      error: (err) => {
        this.procesando.set(null);
        this.error.set(this.mensajeDeError(err, 'No pudimos iniciar el pago.'));
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
