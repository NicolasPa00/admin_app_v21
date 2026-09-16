import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import {
  LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Wallet, Search, RotateCcw, Loader2, FilePlus2, CheckCircle2, Ban,
  ChevronDown, ChevronRight, AlertCircle, TrendingUp, CreditCard,
} from 'lucide-angular';

import { CobranzaService } from '../../data-access/cobranza.service';
import {
  EstadoSuscripcion, Factura, FilaCartera, IngresoMes, ResumenCobro,
} from '../../models/cobranza.models';
import { LoadingState } from '../../models/admin.models';

/** Etiquetas legibles de los estados de suscripción. */
const ESTADOS: Record<EstadoSuscripcion, string> = {
  trial: 'Prueba',
  activa: 'Al día',
  en_gracia: 'Vencido con plazo',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
};

/**
 * CobranzaComponent — la cartera de EscalApp: quién nos paga, quién nos debe y cuánto llegó
 * de verdad al banco.
 *
 * Ver `admin_ws/docs/cobro-mensualidades.md`. Hoy solo existe el modo `manual` (F0): un
 * administrador genera la factura del período y confirma la transferencia cuando entra.
 *
 * ## Por qué la tabla muestra «facturado» y «neto» por separado
 *
 * Porque no son lo mismo y confundirlos es el error que hace que las cuentas no cuadren: entre
 * uno y otro están la comisión de la pasarela y —sobre todo— la retención en la fuente que
 * practica cualquier cliente persona jurídica. Facturamos $59.999 y consignan menos, y eso es
 * normal (`docs/obligaciones-escalapp.md` §3).
 */
@Component({
  selector: 'app-cobranza',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Wallet, Search, RotateCcw, Loader2, FilePlus2, CheckCircle2, Ban,
        ChevronDown, ChevronRight, AlertCircle, TrendingUp, CreditCard,
      }),
    },
  ],
  templateUrl: './cobranza.component.html',
  styleUrl: './cobranza.component.scss',
})
export class CobranzaComponent implements OnInit {
  private readonly api = inject(CobranzaService);

  // ── Estado ──────────────────────────────────────────────
  protected readonly estado = signal<LoadingState>('loading');
  protected readonly cartera = signal<FilaCartera[]>([]);
  protected readonly ingresos = signal<IngresoMes[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  /** Link de pago devuelto por un cobro que quedó pendiente, para copiárselo al cliente. */
  protected readonly linkPago = signal<string | null>(null);

  protected readonly fEstado = signal<EstadoSuscripcion | ''>('');
  protected readonly busqueda = signal('');

  /** Negocio con el detalle abierto, o null. */
  protected readonly expandido = signal<number | null>(null);
  protected readonly detalle = signal<ResumenCobro | null>(null);
  protected readonly cargandoDetalle = signal(false);

  /** Factura sobre la que se está registrando un pago, o null. */
  protected readonly pagando = signal<Factura | null>(null);
  protected readonly guardando = signal(false);

  // Campos del formulario de pago. Se teclean: nada de esto se deduce.
  protected readonly fFecha = signal('');
  protected readonly fMedio = signal('');
  protected readonly fComision = signal('0');
  protected readonly fRetencion = signal('0');
  protected readonly fNumeroFactura = signal('');

  protected readonly ESTADOS = ESTADOS;

  /** Opciones del filtro, ya tipadas: el template no debe hacer casts. */
  protected readonly opcionesEstado = (
    ['activa', 'en_gracia', 'suspendida', 'trial', 'cancelada'] as const
  ).map((valor) => ({ valor, etiqueta: ESTADOS[valor] }));

  // ── Derivados ───────────────────────────────────────────
  protected readonly totalDeuda = computed(() =>
    this.cartera().reduce((suma, f) => suma + Number(f.deuda ?? 0), 0),
  );

  protected readonly morosos = computed(() =>
    this.cartera().filter((f) => Number(f.deuda ?? 0) > 0).length,
  );

  protected readonly activos = computed(() =>
    this.cartera().filter((f) => f.estado === 'activa' || f.estado === 'trial').length,
  );

  /** El mes corriente es el primero: el backend ordena por mes descendente. */
  protected readonly mesActual = computed<IngresoMes | null>(() => this.ingresos()[0] ?? null);

  /**
   * Lo que se quedaron por el camino este mes: comisiones + retenciones. Se muestra explícito
   * porque es justo lo que nadie espera al mirar el extracto bancario.
   */
  protected readonly fugaMes = computed(() => {
    const mes = this.mesActual();
    if (!mes) return 0;
    return Number(mes.comisiones ?? 0) + Number(mes.retenciones ?? 0);
  });

  ngOnInit(): void {
    this.cargar();
  }

  // ── Carga ───────────────────────────────────────────────
  protected cargar(): void {
    this.estado.set('loading');
    this.error.set(null);

    this.api.getCartera({ estado: this.fEstado(), q: this.busqueda().trim() }).subscribe({
      next: (filas) => {
        this.cartera.set(filas);
        this.estado.set('success');
      },
      error: (err) => {
        this.error.set(this.mensajeDeError(err, 'No se pudo cargar la cartera.'));
        this.estado.set('error');
      },
    });

    this.api.getIngresos(6).subscribe({
      next: (meses) => this.ingresos.set(meses),
      // Los ingresos son contexto, no el contenido principal: si fallan, la cartera sigue útil.
      error: () => this.ingresos.set([]),
    });
  }

  protected limpiarFiltros(): void {
    this.fEstado.set('');
    this.busqueda.set('');
    this.cargar();
  }

  // ── Detalle por negocio ─────────────────────────────────
  protected alternarDetalle(fila: FilaCartera): void {
    if (this.expandido() === fila.id_negocio) {
      this.expandido.set(null);
      this.detalle.set(null);
      return;
    }

    this.expandido.set(fila.id_negocio);
    this.detalle.set(null);
    this.cargandoDetalle.set(true);
    this.pagando.set(null);

    this.api.getResumen(fila.id_negocio).subscribe({
      next: (resumen) => {
        this.detalle.set(resumen);
        this.cargandoDetalle.set(false);
      },
      error: (err) => {
        this.error.set(this.mensajeDeError(err, 'No se pudo cargar el detalle del negocio.'));
        this.cargandoDetalle.set(false);
      },
    });
  }

  // ── Acciones ────────────────────────────────────────────
  /**
   * ¿Se le puede generar un cobro? Solo si el plan venció o vence dentro de los próximos 5 días,
   * la misma ventana del cobro automático. El backend lo valida igual; aquí se apaga el botón para
   * que el error no sea la primera señal de que no tocaba.
   */
  protected puedeGenerar(fila: FilaCartera): boolean {
    if (!fila.plan_hasta) return false;
    const limite = new Date();
    limite.setDate(limite.getDate() + 5);
    return String(fila.plan_hasta).slice(0, 10) <= limite.toISOString().slice(0, 10);
  }

  protected generarFactura(fila: FilaCartera): void {
    this.guardando.set(true);
    this.aviso.set(null);
    this.error.set(null);

    this.api.generarFactura(fila.id_negocio).subscribe({
      next: (factura) => {
        this.guardando.set(false);
        this.aviso.set(
          factura
            ? `Factura ${factura.referencia} lista (${factura.periodo_inicio} → ${factura.periodo_fin}).`
            : 'Factura generada.',
        );
        this.refrescar(fila.id_negocio);
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(this.mensajeDeError(err, 'No se pudo generar la factura.'));
      },
    });
  }

  protected abrirPago(factura: Factura): void {
    this.pagando.set(factura);
    this.fFecha.set(new Date().toISOString().slice(0, 10));
    this.fMedio.set('');
    this.fComision.set('0');
    this.fRetencion.set('0');
    this.fNumeroFactura.set(factura.numero_factura ?? '');
    this.error.set(null);
  }

  protected cancelarPago(): void {
    this.pagando.set(null);
  }

  protected confirmarPago(): void {
    const factura = this.pagando();
    if (!factura) return;

    this.guardando.set(true);
    this.error.set(null);

    this.api
      .registrarPago(factura.id_factura, {
        fecha_pago: this.fFecha() || null,
        medio_pago_texto: this.fMedio().trim() || null,
        comision_pasarela: Number(this.fComision() || 0),
        retencion_declarada: Number(this.fRetencion() || 0),
        numero_factura: this.fNumeroFactura().trim() || null,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.pagando.set(null);
          this.aviso.set(`Pago de ${factura.referencia} registrado. El plan quedó extendido.`);
          this.refrescar(factura.id_negocio);
        },
        error: (err) => {
          this.guardando.set(false);
          this.error.set(this.mensajeDeError(err, 'No se pudo registrar el pago.'));
        },
      });
  }

  /**
   * Cobra por la pasarela. Los tres desenlaces se cuentan distinto a propósito: un `pendiente`
   * con link NO es un cobro hecho, y decir «cobrado» ahí es cómo se regalan meses de servicio.
   */
  protected cobrarPorPasarela(factura: Factura): void {
    this.guardando.set(true);
    this.aviso.set(null);
    this.error.set(null);

    this.api.cobrarPorPasarela(factura.id_factura).subscribe({
      next: (r) => {
        this.guardando.set(false);
        if (!r) return;

        if (r.estado === 'aprobada') {
          this.aviso.set(`Cobro aprobado. ${factura.referencia} queda pagada y el plan extendido.`);
        } else if (r.estado === 'pendiente') {
          this.linkPago.set(r.urlPago);
          this.aviso.set(
            r.urlPago
              ? `Cobro creado: falta que el cliente pague. Envíale el link.`
              : `Cobro creado, pendiente de confirmación de la pasarela.`,
          );
        } else {
          this.error.set(`La pasarela rechazó el cobro: ${r.mensaje ?? 'sin detalle'}`);
        }
        this.refrescar(factura.id_negocio);
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(this.mensajeDeError(err, 'No se pudo cobrar por la pasarela.'));
      },
    });
  }

  /** Id de transacción de Wompi a verificar (se pega desde el panel o la pantalla de resultado). */
  protected readonly fIdTransaccion = signal('');

  /**
   * Confirma un pago de Wompi por su id. En local es la única forma de cerrar un pago de prueba;
   * en producción, la de atender a quien pagó y cuyo webhook se perdió.
   */
  protected verificarPagoWompi(): void {
    const id = this.fIdTransaccion().trim();
    if (!id) return;

    this.guardando.set(true);
    this.aviso.set(null);
    this.error.set(null);

    this.api.verificarPagoWompi(id).subscribe({
      next: (r) => {
        this.guardando.set(false);
        switch (r?.estado) {
          case 'aprobada':
            this.aviso.set('Pago confirmado con Wompi: el plan quedó extendido.');
            this.fIdTransaccion.set('');
            this.cargar();
            break;
          case 'pendiente':
            this.aviso.set('Wompi todavía no aprueba esa transacción. Intenta en unos minutos.');
            break;
          case 'rechazada':
            this.error.set('Wompi rechazó esa transacción: no hay nada que activar.');
            break;
          default:
            this.error.set(
              'Esa transacción no corresponde a una factura pendiente, o su monto no coincide.',
            );
        }
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(this.mensajeDeError(err, 'No se pudo verificar la transacción.'));
      },
    });
  }

  protected anular(factura: Factura): void {
    const motivo = 'Anulada desde la consola de cobranza.';
    this.guardando.set(true);
    this.error.set(null);

    this.api.anularFactura(factura.id_factura, motivo).subscribe({
      next: () => {
        this.guardando.set(false);
        this.aviso.set(`Factura ${factura.referencia} anulada.`);
        this.refrescar(factura.id_negocio);
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(this.mensajeDeError(err, 'No se pudo anular la factura.'));
      },
    });
  }

  /** Recarga la cartera y, si sigue abierto, el detalle del negocio afectado. */
  private refrescar(idNegocio: number): void {
    this.cargar();
    if (this.expandido() !== idNegocio) return;

    this.cargandoDetalle.set(true);
    this.api.getResumen(idNegocio).subscribe({
      next: (resumen) => {
        this.detalle.set(resumen);
        this.cargandoDetalle.set(false);
      },
      error: () => this.cargandoDetalle.set(false),
    });
  }

  // ── Formato ─────────────────────────────────────────────
  protected dinero(valor: string | number | null | undefined, moneda = 'COP'): string {
    const numero = Number(valor ?? 0);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: moneda || 'COP',
      maximumFractionDigits: 0,
    }).format(numero);
  }

  protected fecha(valor: string | null | undefined): string {
    if (!valor) return '—';
    return String(valor).slice(0, 10);
  }

  /** El backend manda mensajes de dominio útiles; se prefieren al texto genérico. */
  private mensajeDeError(err: unknown, porDefecto: string): string {
    const mensaje = (err as { error?: { message?: string } })?.error?.message;
    return mensaje || porDefecto;
  }
}
