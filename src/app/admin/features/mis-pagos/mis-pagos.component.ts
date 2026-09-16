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
import { CobroNegocio, CodigoPasarela, FacturaPendiente } from '../../models/cobranza.models';
import { LoadingState } from '../../models/admin.models';
import { Vencimiento, evaluarVencimiento } from '../../../core/utils/estado-plan';
import { hoyBogota } from '../../../core/utils/vigencia';

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

  ngOnInit(): void {
    this.cargar();
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

  protected pagar(factura: FacturaPendiente, pasarela: CodigoPasarela): void {
    if (!factura.id_factura) return;

    this.procesando.set(`${factura.referencia}:${pasarela}`);
    this.error.set(null);

    this.api.pagarFactura(factura.id_factura, pasarela).subscribe({
      next: (r) => {
        this.procesando.set(null);
        if (r?.urlPago) {
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

  protected etiqueta(codigo: CodigoPasarela, nombre: string): string {
    if (codigo === 'wompi') return 'PSE, Nequi o tarjeta';
    if (codigo === 'dlocal') return 'tarjeta o medios locales';
    return nombre;
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
