import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  Gauge,
  RefreshCw,
  AlertCircle,
  TriangleAlert,
  CircleCheck,
  Wallet,
  Plus,
  Trash2,
  Info,
} from 'lucide-angular';

import { ConsumoIaService } from '../../data-access/consumo-ia.service';
import {
  ConsumoIa,
  PuntoConsumo,
  TipoMovimientoIa,
  VentanaConsumo,
} from '../../models/consumo-ia.models';
import { LoadingState } from '../../models/admin.models';
import { ToastService } from '../../../shared/toast/toast.service';

/** Menos de estos días de saldo = aviso; menos de CRITICO = urgente. */
const DIAS_AVISO = 14;
const DIAS_CRITICO = 5;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Cómo llama OpenAI a cada parte de la factura (`line_item`), en palabras de aquí. */
const CONCEPTOS: Record<string, string> = {
  input: 'Texto que lee',
  'cached input': 'Texto que lee (en caché)',
  'cache writes': 'Guardar en caché',
  output: 'Texto que escribe',
};

/** Techo «redondo» para el eje: 1, 2, 2.5, 5 o 10 × 10^n. */
function techo(valor: number): number {
  if (valor <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(valor)));
  const f = valor / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}

/**
 * ConsumoIaComponent — cuánto se gasta en OpenAI, cuánto queda y en qué se va.
 *
 * Una sola serie en la gráfica (el gasto oficial de cada día), así que no lleva leyenda: el
 * título la nombra. Lo del bot según nuestra cuenta va en el tooltip y en la línea de abajo,
 * no como segunda barra — es una parte del total, y dos barras lado a lado sugerirían dos
 * gastos que se suman.
 *
 * El saldo no lo da OpenAI: se calcula con el saldo de partida y las recargas que se registran
 * abajo. Por eso, sin saldo de partida, la cifra grande invita a registrarlo en vez de inventar.
 */
@Component({
  selector: 'app-consumo-ia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Gauge, RefreshCw, AlertCircle, TriangleAlert, CircleCheck, Wallet, Plus, Trash2, Info,
      }),
    },
  ],
  templateUrl: './consumo-ia.component.html',
  styleUrl: './consumo-ia.component.scss',
})
export class ConsumoIaComponent implements OnInit {
  private readonly api = inject(ConsumoIaService);
  private readonly toast = inject(ToastService);

  protected readonly ventanas: VentanaConsumo[] = [7, 30, 90];
  protected readonly ventana = signal<VentanaConsumo>(30);
  protected readonly estado = signal<LoadingState>('idle');
  protected readonly datos = signal<ConsumoIa | null>(null);

  // Formulario de movimientos
  protected readonly formTipo = signal<TipoMovimientoIa>('SALDO');
  protected readonly formMonto = signal('');
  protected readonly formFecha = signal('');
  protected readonly formNota = signal('');
  protected readonly guardando = signal(false);
  protected readonly porAnular = signal<number | null>(null);

  protected readonly hover = signal<number | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(forzar = false): void {
    this.estado.set('loading');
    this.api.getResumen(this.ventana(), forzar).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.estado.set('success');
        // Sin saldo de partida, lo primero que hay que hacer es registrarlo.
        if (!d.saldo) this.formTipo.set('SALDO');
        else if (this.formTipo() === 'SALDO' && !this.formMonto()) this.formTipo.set('RECARGA');
      },
      error: () => this.estado.set('error'),
    });
  }

  protected cambiarVentana(v: VentanaConsumo): void {
    if (v === this.ventana()) return;
    this.ventana.set(v);
    this.cargar();
  }

  // ── Derivados ──────────────────────────────────────────────

  /** La serie que se dibuja: la oficial, o la interna si OpenAI no contestó. */
  protected readonly serie = computed(() => {
    const d = this.datos();
    if (!d) return [];
    const oficial = d.aviso_oficial === null;
    return d.serie.map((p) => ({ ...p, valor: oficial ? (p.oficial ?? 0) : p.interno }));
  });

  protected readonly ejeMax = computed(() =>
    techo(Math.max(0, ...this.serie().map((p) => p.valor))),
  );

  protected readonly ejeMarcas = computed(() => {
    const max = this.ejeMax();
    return [max, max / 2, 0];
  });

  /** Etiquetas del eje X: unas 6, nunca una por barra en 90 días. */
  protected readonly cadaCuanto = computed(() => Math.max(1, Math.ceil(this.serie().length / 6)));

  protected readonly estadoSaldo = computed<'ok' | 'aviso' | 'critico' | null>(() => {
    const dias = this.datos()?.saldo?.dias_restantes;
    if (dias == null) return null;
    if (dias < DIAS_CRITICO) return 'critico';
    if (dias < DIAS_AVISO) return 'aviso';
    return 'ok';
  });

  protected readonly fueraDelBot = computed(() => {
    const r = this.datos()?.resumen;
    if (!r || r.periodo_oficial == null) return null;
    return Math.max(0, r.periodo_oficial - r.periodo_interno);
  });

  protected readonly maxNegocio = computed(() =>
    Math.max(0, ...(this.datos()?.por_negocio ?? []).map((n) => n.costo_usd)),
  );

  protected readonly conceptos = computed(() =>
    (this.datos()?.por_concepto ?? []).map((c) => {
      const corte = c.concepto.lastIndexOf(', ');
      const modelo = corte > 0 ? c.concepto.slice(0, corte) : c.concepto;
      const parte = corte > 0 ? c.concepto.slice(corte + 2) : '';
      return { modelo, parte: CONCEPTOS[parte] ?? parte, usd: c.usd };
    }),
  );

  protected readonly maxConcepto = computed(() =>
    Math.max(0, ...this.conceptos().map((c) => c.usd)),
  );

  protected readonly pctSinIa = computed(() => {
    const t = this.datos()?.turnos;
    if (!t || !t.total) return null;
    return Math.round((t.sin_ia / t.total) * 100);
  });

  protected readonly puntoHover = computed<(PuntoConsumo & { valor: number }) | null>(() => {
    const i = this.hover();
    return i == null ? null : (this.serie()[i] ?? null);
  });

  // ── Movimientos ────────────────────────────────────────────

  protected guardarMovimiento(): void {
    const monto = Number(this.formMonto().replace(',', '.'));
    if (!Number.isFinite(monto) || monto < 0) {
      this.toast.error('Escribe un monto válido en dólares.');
      return;
    }
    if (this.formTipo() === 'RECARGA' && monto <= 0) {
      this.toast.error('Una recarga tiene que ser mayor que cero.');
      return;
    }

    this.guardando.set(true);
    this.api
      .registrarMovimiento({
        tipo: this.formTipo(),
        monto_usd: monto,
        fecha: this.formFecha() || null,
        nota: this.formNota().trim() || null,
      })
      .subscribe({
        next: () => {
          this.toast.exito(
            this.formTipo() === 'SALDO' ? 'Saldo de partida registrado.' : 'Recarga registrada.',
          );
          this.formMonto.set('');
          this.formFecha.set('');
          this.formNota.set('');
          this.guardando.set(false);
          this.cargar();
        },
        error: (err) => {
          this.guardando.set(false);
          this.toast.errorHttp(err, 'No se pudo registrar el movimiento.');
        },
      });
  }

  /** Dos clics: el primero pide confirmación en la misma fila, el segundo anula. */
  protected anular(id: number): void {
    if (this.porAnular() !== id) {
      this.porAnular.set(id);
      return;
    }
    this.api.anularMovimiento(id).subscribe({
      next: () => {
        this.porAnular.set(null);
        this.toast.exito('Movimiento anulado.');
        this.cargar();
      },
      error: (err) => {
        this.porAnular.set(null);
        this.toast.errorHttp(err, 'No se pudo anular el movimiento.');
      },
    });
  }

  protected leerInput(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  // ── Formato ────────────────────────────────────────────────

  /** Dólares: centavos casi siempre; más decimales solo cuando la cifra es diminuta. */
  protected usd(valor: number | null | undefined): string {
    const v = Number(valor ?? 0);
    if (v === 0) return '$0.00';
    if (Math.abs(v) < 0.01) return v < 0 ? '−$0.01' : '< $0.01';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  }

  /** Para costos por unidad (por conversación), donde importan las milésimas. */
  protected usdFino(valor: number | null | undefined): string {
    const v = Number(valor ?? 0);
    if (v === 0) return '$0';
    return `$${v < 0.1 ? v.toFixed(4) : v.toFixed(2)}`;
  }

  protected entero(valor: number | null | undefined): string {
    return new Intl.NumberFormat('es-CO').format(Math.round(Number(valor ?? 0)));
  }

  /** `2026-10-04` → `4 oct`. */
  protected dia(fecha: string): string {
    const [, m, d] = fecha.split('-').map(Number);
    return `${d} ${MESES[m - 1]}`;
  }

  /** Fecha y hora de un movimiento, en hora de Colombia. */
  protected fechaHora(iso: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  }

  protected altura(valor: number): number {
    return Math.max(0, (valor / this.ejeMax()) * 100);
  }

  protected ancho(valor: number, max: number): number {
    return max > 0 ? Math.max(1.5, (valor / max) * 100) : 0;
  }
}
