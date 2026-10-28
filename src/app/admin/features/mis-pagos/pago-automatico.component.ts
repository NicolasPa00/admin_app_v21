import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import {
  RefreshCw,
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from '../../../core/icons/phosphor';

import { CobranzaService } from '../../data-access/cobranza.service';
import { PagoAutomatico, TerminosPagoAutomatico } from '../../models/cobranza.models';
import { ToastService } from '../../../shared/toast/toast.service';

/** El script del widget de Wompi: el mismo para pruebas y producción (lo decide la llave). */
const WIDGET_WOMPI = 'https://checkout.wompi.co/widget.js';

interface WidgetWompi {
  open(callback: (resultado: { payment_source?: { token?: string; type?: string } }) => void): void;
}
type ConstructorWidget = new (config: { publicKey: string; widgetOperation: 'tokenize' }) => WidgetWompi;

/** Una sola carga del script para toda la app, aunque haya varios negocios en pantalla. */
let cargaDelWidget: Promise<ConstructorWidget> | null = null;
function cargarWidget(): Promise<ConstructorWidget> {
  const ya = (window as unknown as { WidgetCheckout?: ConstructorWidget }).WidgetCheckout;
  if (ya) return Promise.resolve(ya);
  cargaDelWidget ??= new Promise<ConstructorWidget>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = WIDGET_WOMPI;
    script.async = true;
    script.onload = () => {
      const w = (window as unknown as { WidgetCheckout?: ConstructorWidget }).WidgetCheckout;
      if (w) resolve(w);
      else reject(new Error('El widget de Wompi no se inicializó.'));
    };
    script.onerror = () => {
      cargaDelWidget = null;
      reject(new Error('No se pudo cargar el widget de Wompi.'));
    };
    document.head.appendChild(script);
  });
  return cargaDelWidget;
}

/**
 * PagoAutomaticoComponent — el débito mensual OPCIONAL, dentro de «Mis pagos».
 *
 * Quien lo activa no vuelve a pensar en pagar: cada mes se cobra solo a su tarjeta (o Nequi). Quien
 * no, sigue pagando con el enlace de abajo, como siempre.
 *
 * La tarjeta se escribe en el widget de Wompi en modo «tokenize»: el número va del navegador a
 * Wompi y a nosotros llega un token de un solo uso, que el servidor cambia por una «fuente de pago»
 * con la llave privada. Ni esta app ni nuestro servidor ven nunca el número.
 *
 * Antes de abrir el widget, el cliente autoriza el débito recurrente a EscalApp, que queda
 * registrado en el servidor con quién, cuándo y desde dónde. El reglamento y la autorización de datos
 * de Wompi los acepta dentro del propio widget.
 */
@Component({
  selector: 'app-pago-automatico',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ RefreshCw, CreditCard, Loader2, AlertCircle, CheckCircle2, ShieldCheck }),
    },
  ],
  templateUrl: './pago-automatico.component.html',
  styleUrl: './pago-automatico.component.scss',
})
export class PagoAutomaticoComponent {
  private readonly api = inject(CobranzaService);
  private readonly toast = inject(ToastService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  readonly idNegocio = input.required<number>();
  readonly nombreNegocio = input<string>('');
  /** Se avisa al padre cuando un cobro inmediato pudo haber pagado una factura. */
  readonly actualizado = output<void>();

  protected readonly estado = signal<PagoAutomatico | null>(null);
  protected readonly cargando = signal(true);
  /** `null` = vista normal; `'autorizar'` = las tres casillas antes de abrir el widget. */
  protected readonly paso = signal<null | 'autorizar' | 'desactivar'>(null);
  protected readonly terminos = signal<TerminosPagoAutomatico | null>(null);
  protected readonly ocupado = signal(false);

  /**
   * La autorización del débito recurrente a EscalApp. El reglamento y la autorización de datos de
   * Wompi los acepta el cliente DENTRO del widget (sus dos casillas); repetirlas aquí era pedir lo
   * mismo dos veces. El servidor sigue mandando a Wompi los dos tokens de aceptación.
   */
  protected readonly autorizaDebito = signal(false);

  protected readonly puedeRegistrar = computed(
    () =>
      !!this.terminos() &&
      this.autorizaDebito() &&
      !this.ocupado(),
  );

  /** Mostrar la tarjeta solo si hay algo que hacer o decir: activo, o disponible para activar. */
  protected readonly visible = computed(() => {
    const e = this.estado();
    if (!e) return false;
    if (e.activo || e.disponible) return true;
    // Sin plan con vencimiento no hay mensualidad: no se dice nada. El resto sí se explica.
    return !!e.motivo_no_disponible && !['SIN_PLAN', 'PLAN_SIN_VENCIMIENTO'].includes(e.motivo_no_disponible.code);
  });

  protected readonly cobroFallido = computed(() => {
    const e = this.estado();
    return !!e?.activo && (e.reintentos ?? 0) > 0;
  });

  private readonly alCambiarNegocio = effect(() => {
    const id = this.idNegocio();
    untracked(() => this.cargar(id));
  });

  private cargar(id = this.idNegocio()): void {
    this.cargando.set(true);
    this.paso.set(null);
    this.api
      .getPagoAutomatico(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (e) => {
          this.estado.set(e);
          this.cargando.set(false);
        },
        // Sin esta tarjeta, «Mis pagos» sigue sirviendo para pagar con el enlace: se esconde y ya.
        error: () => {
          this.estado.set(null);
          this.cargando.set(false);
        },
      });
  }

  protected empezarAutorizacion(): void {
    this.autorizaDebito.set(false);
    this.terminos.set(null);
    this.paso.set('autorizar');
    // Los tokens de aceptación caducan: se piden justo al abrir, no al cargar la pantalla.
    this.api
      .getTerminosPagoAutomatico(this.idNegocio())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (t) => this.terminos.set(t),
        error: (err: HttpErrorResponse) => {
          this.toast.error(this.mensajeDe(err, 'No pudimos preparar el registro de la tarjeta.'));
          this.paso.set(null);
        },
      });
  }

  protected cancelar(): void {
    this.paso.set(null);
  }

  protected async registrarTarjeta(): Promise<void> {
    const t = this.terminos();
    if (!t || !this.puedeRegistrar() || !this.esNavegador) return;
    this.ocupado.set(true);

    let Widget: ConstructorWidget;
    try {
      Widget = await cargarWidget();
    } catch {
      this.ocupado.set(false);
      this.toast.error('No pudimos abrir el formulario de Wompi. Revisa tu conexión e inténtalo de nuevo.');
      return;
    }

    const widget = new Widget({ publicKey: t.llave_publica, widgetOperation: 'tokenize' });
    // El widget llama fuera de la zona de Angular: se vuelve a ella para que la vista se entere.
    widget.open((resultado) =>
      this.zone.run(() => {
        const fuente = resultado?.payment_source;
        if (!fuente?.token) {
          // Cerró el formulario sin terminar.
          this.ocupado.set(false);
          return;
        }
        this.guardar(fuente.token, fuente.type ?? 'CARD', t);
      }),
    );
  }

  private guardar(token: string, tipo: string, t: TerminosPagoAutomatico): void {
    this.api
      .activarPagoAutomatico({
        id_negocio: this.idNegocio(),
        token,
        tipo,
        acceptance_token: t.acceptance_token,
        personal_auth_token: t.personal_auth_token,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (e) => {
          this.ocupado.set(false);
          this.paso.set(null);
          this.estado.set(e);
          const inmediato = e?.cobro_inmediato;
          if (inmediato?.estado === 'aprobada') {
            this.toast.exito('Pago automático activado y tu mensualidad pendiente quedó pagada.');
            this.actualizado.emit();
          } else if (inmediato?.estado === 'rechazada') {
            this.toast.error(
              'Guardamos tu medio de pago, pero el banco rechazó el cobro pendiente. Lo reintentaremos en 3 días.',
            );
            this.actualizado.emit();
          } else if (inmediato?.estado === 'pendiente') {
            this.toast.exito('Pago automático activado. Tu pago pendiente se está procesando.');
            this.actualizado.emit();
          } else {
            this.toast.exito('Pago automático activado. Cada mes se cobrará solo.');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.ocupado.set(false);
          this.toast.error(this.mensajeDe(err, 'No pudimos guardar tu medio de pago.'));
        },
      });
  }

  protected pedirDesactivar(): void {
    this.paso.set('desactivar');
  }

  protected desactivar(): void {
    this.ocupado.set(true);
    this.api
      .desactivarPagoAutomatico(this.idNegocio())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (e) => {
          this.ocupado.set(false);
          this.paso.set(null);
          this.estado.set(e);
          this.toast.exito('Pago automático desactivado. Te avisaremos antes de cada vencimiento.');
        },
        error: (err: HttpErrorResponse) => {
          this.ocupado.set(false);
          this.toast.error(this.mensajeDe(err, 'No pudimos desactivar el pago automático.'));
        },
      });
  }

  protected fecha(iso: string | null | undefined): string {
    if (!iso) return '';
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d, 12)).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  private mensajeDe(err: HttpErrorResponse, porDefecto: string): string {
    const m = err?.error?.message;
    return typeof m === 'string' && m.trim() ? m : porDefecto;
  }
}
