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
  MessageCircle,
  Bot,
} from 'lucide-angular';

import { ConsumoIaService } from '../../data-access/consumo-ia.service';
import {
  ConsumoIa,
  NumeroWhatsapp,
  PuntoConsumo,
  TipoMovimientoIa,
  VentanaConsumo,
} from '../../models/consumo-ia.models';
import { LoadingState } from '../../models/admin.models';
import { ToastService } from '../../../shared/toast/toast.service';

/** Menos de estos días de saldo = aviso; menos de CRITICO = urgente. */
const DIAS_AVISO = 14;
const DIAS_CRITICO = 5;

/** Desde qué parte de la cuota gratis de WhatsApp se avisa. */
const CUOTA_AVISO = 0.8;

/** Categorías y tipos de precio de Meta, en palabras de aquí. */
const CATEGORIAS_META: Record<string, string> = {
  SERVICE: 'Respuestas a clientes',
  UTILITY: 'Avisos y recordatorios',
  MARKETING: 'Promociones',
  AUTHENTICATION: 'Códigos de verificación',
};
const TIPOS_META: Record<string, string> = {
  FREE_CUSTOMER_SERVICE: 'gratis',
  FREE_ENTRY_POINT: 'gratis (anuncio)',
  REGULAR: 'cobrado',
};

type Pestana = 'openai' | 'meta';
const CLAVE_PESTANA = 'escalapp.terceros.pestana';

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
 * ConsumoIaComponent — vista «Terceros»: lo que se les paga a OpenAI (IA) y a Meta (WhatsApp).
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
        MessageCircle, Bot,
      }),
    },
  ],
  templateUrl: './consumo-ia.component.html',
  styleUrl: './consumo-ia.component.scss',
})
export class ConsumoIaComponent implements OnInit {
  private readonly api = inject(ConsumoIaService);
  private readonly toast = inject(ToastService);
  private readonly platformId = inject(PLATFORM_ID);

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
  protected readonly hoverWa = signal<number | null>(null);

  /** Pestaña visible. Se recuerda en este navegador: es comodidad, no estado que importe. */
  protected readonly pestana = signal<Pestana>(this.leerPestana());

  ngOnInit(): void {
    this.cargar();
  }

  protected cambiarPestana(p: Pestana): void {
    this.pestana.set(p);
    this.hover.set(null);
    this.hoverWa.set(null);
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(CLAVE_PESTANA, p);
    } catch {
      // Navegación privada o almacenamiento bloqueado: se olvida al recargar, nada más.
    }
  }

  private leerPestana(): Pestana {
    if (!isPlatformBrowser(this.platformId)) return 'openai';
    try {
      return localStorage.getItem(CLAVE_PESTANA) === 'meta' ? 'meta' : 'openai';
    } catch {
      return 'openai';
    }
  }

  /** Un triángulo en la pestaña cuando dentro hay un aviso: así no se pierde en la otra. */
  protected readonly alertaOpenai = computed(() => {
    const d = this.datos();
    if (!d) return false;
    const e = this.estadoSaldo();
    return !!d.aviso_oficial || e === 'aviso' || e === 'critico';
  });

  protected readonly alertaMeta = computed(() => {
    const d = this.datos();
    if (!d) return false;
    return !!d.aviso_whatsapp || this.numerosEnRiesgo().length > 0;
  });

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

  // ── WhatsApp (Meta) ────────────────────────────────────────

  /** Mensajes por día de todas las cuentas: una sola serie, el reparto va en el tooltip. */
  protected readonly serieWa = computed(() =>
    (this.datos()?.whatsapp?.serie ?? []).map((p) => ({ ...p, valor: p.escalapp + p.clientes })),
  );

  protected readonly ejeMaxWa = computed(() =>
    techo(Math.max(0, ...this.serieWa().map((p) => p.valor))),
  );

  protected readonly ejeMarcasWa = computed(() => {
    const max = this.ejeMaxWa();
    return [max, max / 2, 0];
  });

  protected readonly cadaCuantoWa = computed(() =>
    Math.max(1, Math.ceil(this.serieWa().length / 6)),
  );

  protected readonly puntoHoverWa = computed(() => {
    const i = this.hoverWa();
    return i == null ? null : (this.serieWa()[i] ?? null);
  });

  protected readonly mensajesMes = computed(() =>
    (this.datos()?.whatsapp?.cuentas ?? []).reduce((s, c) => s + c.mensajes_mes, 0),
  );

  /** Números que ya pasaron, o van por pasar, la cuota gratis del mes. Van arriba, en un aviso. */
  protected readonly numerosEnRiesgo = computed(() =>
    (this.datos()?.whatsapp?.cuentas ?? []).flatMap((c) =>
      c.numeros
        .filter((n) => this.estadoCuota(n) !== 'ok')
        .map((n) => ({ ...n, paga: c.paga, cuenta: c.nombre })),
    ),
  );

  protected estadoCuota(n: NumeroWhatsapp): 'ok' | 'aviso' | 'pasada' {
    if (n.cobrados_mes > 0 || n.servicio_mes >= n.gratis_limite) return 'pasada';
    if (n.servicio_mes >= n.gratis_limite * CUOTA_AVISO) return 'aviso';
    return 'ok';
  }

  protected pctCuota(n: NumeroWhatsapp): number {
    return Math.min(100, (n.servicio_mes / n.gratis_limite) * 100);
  }

  protected categoriaMeta(categoria: string, tipo: string): string {
    const c = CATEGORIAS_META[categoria] ?? categoria;
    const t = TIPOS_META[tipo] ?? tipo.toLowerCase();
    return `${c} · ${t}`;
  }

  protected alturaWa(valor: number): number {
    return Math.max(0, (valor / this.ejeMaxWa()) * 100);
  }

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

  // Dólares y pesos conviven en esta pantalla, y «$» a secas es ambiguo en Colombia: los dólares
  // llevan siempre «US$» delante y los pesos «COP» detrás. Nunca un importe sin su moneda.

  /** Dólares (`US$1.36`): centavos casi siempre; menos de un centavo se dice así. */
  protected usd(valor: number | null | undefined): string {
    const v = Number(valor ?? 0);
    if (v === 0) return 'US$0.00';
    if (Math.abs(v) < 0.01) return v < 0 ? '−US$0.01' : '< US$0.01';
    const cifra = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(v));
    return `${v < 0 ? '−' : ''}US$${cifra}`;
  }

  /** Dólares por unidad (por conversación), donde importan las milésimas. */
  protected usdFino(valor: number | null | undefined): string {
    const v = Number(valor ?? 0);
    if (v === 0) return 'US$0';
    return `US$${v < 0.1 ? v.toFixed(4) : v.toFixed(2)}`;
  }

  /** Pesos colombianos sin centavos (`$9.622 COP`). */
  protected cop(valor: number | null | undefined): string {
    const v = Math.round(Number(valor ?? 0));
    const cifra = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.abs(v));
    return `${v < 0 ? '−' : ''}$${cifra} COP`;
  }

  /** Costo en la moneda de la cuenta de Meta. */
  protected moneda(valor: number, codigo: string | null): string {
    if (codigo === 'COP' || !codigo) return this.cop(valor);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: codigo }).format(valor);
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
