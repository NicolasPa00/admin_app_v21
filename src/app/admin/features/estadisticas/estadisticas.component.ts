import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  ChartColumn, Building2, Receipt, Wallet, Users, CalendarCheck, MessageCircle,
  Package, LogIn, Store, AlertCircle, Loader2, RefreshCw, Eye, EyeOff, TrendingUp,
} from 'lucide-angular';

import { EstadisticasService } from '../../data-access/estadisticas.service';
import {
  EstadisticasPlataforma,
  EstadisticasVertical,
  RangoPreset,
  Vertical,
} from '../../models/estadisticas.models';
import { LoadingState } from '../../models/admin.models';

/** La métrica que dibuja la gráfica grande. Una sola a la vez: nunca dos ejes Y. */
type MetricaSerie = 'transacciones' | 'monto';

/** Geometría de la gráfica de área (coordenadas SVG = píxeles en pantalla). */
const AREA_H = 260;
const AREA_W_INICIAL = 720;
const AREA_PAD = { top: 16, right: 16, bottom: 30, left: 62 };

/**
 * Nombre y color de cada vertical.
 *
 * Los colores son una paleta CATEGÓRICA: identifican al aplicativo, no su tamaño, así que el
 * orden es fijo y no se recicla ni se reordena al filtrar. Cuatro de los cinco son tokens del
 * admin (`--color-accent-*` y el índigo de marca); el cian es el único hue nuevo, y entra porque
 * hacen falta cinco slots distinguibles. La combinación está verificada para daltonismo
 * (separación CVD ΔE ≥ 8 en el par más cercano, naranja↔verde) y contraste ≥ 3:1 sobre la
 * superficie clara — no cambiarlos a ojo.
 */
const VERTICALES: Record<Vertical, { label: string; color: string }> = {
  restaurante: { label: 'Restaurante', color: '#4F46E5' },
  reserva:     { label: 'Reservas',    color: '#38A169' },
  parqueadero: { label: 'Parqueadero', color: '#C05621' },
  gym:         { label: 'Gimnasio',    color: '#7B1FA2' },
  tienda:      { label: 'Tienda',      color: '#0891B2' },
  otro:        { label: 'Otros',       color: '#64748B' },
};

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** Techo «redondo» para el eje Y: 1, 2, 2.5, 5 o 10 × 10^n. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/** Curva monótona (Fritsch–Carlson): suave y sin inventarse valles por debajo de los puntos. */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  }
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      t[i] = (3 * a * m[i]) / h;
      t[i + 1] = (3 * b * m[i]) / h;
    }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    d += ` C${pts[i].x + dx[i] / 3},${pts[i].y + (t[i] * dx[i]) / 3}`
      + ` ${pts[i + 1].x - dx[i] / 3},${pts[i + 1].y - (t[i + 1] * dx[i]) / 3}`
      + ` ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

/**
 * EstadisticasComponent — «EscalApp en números», la vista del Super Admin.
 *
 * Qué pretende: que alguien que nunca ha visto el sistema entienda en treinta segundos que ya
 * está en producción y se usa a diario. De ahí las decisiones que la separan del resto del
 * panel:
 *
 *  • Por defecto enseña TODO el historial, no el mes actual. La historia aquí es el recorrido.
 *  • Pocos filtros, y solo de tiempo. Cada control extra es una pregunta que el que mira no
 *    tenía, y esta pantalla se abre delante de alguien.
 *  • Los nombres de los inquilinos se pueden ocultar con un clic: son clientes reales, y el
 *    ranking se puede enseñar sin exponerlos.
 *
 * El dato viene de un solo endpoint, que ya hace las agregaciones en la base: aquí no se suma
 * nada a mano, solo se dibuja.
 */
@Component({
  selector: 'app-estadisticas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        ChartColumn, Building2, Receipt, Wallet, Users, CalendarCheck, MessageCircle,
        Package, LogIn, Store, AlertCircle, Loader2, RefreshCw, Eye, EyeOff, TrendingUp,
      }),
    },
  ],
  templateUrl: './estadisticas.component.html',
  styleUrl: './estadisticas.component.scss',
})
export class EstadisticasComponent implements OnInit {
  private readonly api = inject(EstadisticasService);

  // ── Estado ──────────────────────────────────────────────────────────────
  protected readonly estado = signal<LoadingState>('loading');
  protected readonly datos = signal<EstadisticasPlataforma | null>(null);
  protected readonly rango = signal<RangoPreset>('todo');
  protected readonly metrica = signal<MetricaSerie>('transacciones');
  /** Oculta los nombres de los inquilinos para poder enseñar el ranking a un tercero. */
  protected readonly anonimo = signal(false);

  protected readonly rangos: Array<{ valor: RangoPreset; label: string }> = [
    { valor: 'todo', label: 'Todo el historial' },
    { valor: '12m', label: 'Últimos 12 meses' },
    { valor: '90d', label: 'Últimos 90 días' },
    { valor: '30d', label: 'Últimos 30 días' },
  ];

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set('loading');
    const { desde, hasta } = this.fechasDelRango();
    this.api.getPlataforma(desde, hasta).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.estado.set('success');
      },
      error: () => this.estado.set('error'),
    });
  }

  protected cambiarRango(valor: RangoPreset): void {
    if (this.rango() === valor) return;
    this.rango.set(valor);
    this.cargar();
  }

  /**
   * El preset traducido a fechas. `todo` no manda ninguna: que el backend decida el principio
   * evita que el frontend tenga que saber cuándo arrancó la plataforma.
   */
  private fechasDelRango(): { desde: string | null; hasta: string | null } {
    const preset = this.rango();
    if (preset === 'todo') return { desde: null, hasta: null };

    const hoy = new Date();
    const inicio = new Date(hoy);
    if (preset === '12m') inicio.setMonth(inicio.getMonth() - 12);
    if (preset === '90d') inicio.setDate(inicio.getDate() - 90);
    if (preset === '30d') inicio.setDate(inicio.getDate() - 30);
    return { desde: this.iso(inicio), hasta: this.iso(hoy) };
  }

  private iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ── Titular: los cuatro números que se leen desde la puerta ─────────────
  protected readonly hero = computed(() => {
    const r = this.datos()?.resumen;
    if (!r) return [];
    return [
      { label: 'Negocios en el sistema', valor: this.fmtEntero(r.negocios_activos), nota: `${r.verticales} verticales activos` },
      { label: 'Operaciones gestionadas', valor: this.fmtEntero(r.transacciones), nota: 'pedidos, citas y ventas' },
      { label: 'Ventas procesadas', valor: this.fmtCompacto(r.monto_cobrado), nota: `ticket promedio ${this.fmtMoneda(r.ticket_promedio)}` },
      { label: 'Clientes atendidos', valor: this.fmtEntero(r.clientes), nota: 'personas en los directorios' },
    ];
  });

  /** Días transcurridos desde el primer negocio registrado. */
  protected readonly diasOperacion = computed(() => {
    const inicio = this.datos()?.periodo.inicio_operacion;
    if (!inicio) return 0;
    const ms = Date.now() - new Date(`${inicio}T00:00:00`).getTime();
    return Math.max(1, Math.round(ms / 86_400_000));
  });

  // ── Tarjetas de detalle ─────────────────────────────────────────────────
  protected readonly tarjetas = computed(() => {
    const r = this.datos()?.resumen;
    if (!r) return [];
    return [
      { icon: 'receipt', label: 'Pedidos de restaurante', valor: this.fmtEntero(r.pedidos) },
      { icon: 'package', label: 'Productos despachados', valor: this.fmtEntero(r.items_vendidos) },
      { icon: 'calendar-check', label: 'Citas y reservas agendadas', valor: this.fmtEntero(r.agendamientos) },
      { icon: 'message-circle', label: 'Mensajes atendidos por el asistente', valor: this.fmtEntero(r.mensajes_asistente) },
      { icon: 'users', label: 'Personas trabajando en el sistema', valor: this.fmtEntero(r.usuarios) },
      { icon: 'log-in', label: 'Inicios de sesión', valor: this.fmtEntero(r.sesiones) },
      { icon: 'store', label: 'Productos y servicios publicados', valor: this.fmtEntero(r.productos_catalogo + r.servicios_catalogo) },
      { icon: 'wallet', label: 'Operaciones cobradas', valor: this.fmtEntero(r.transacciones_cobradas) },
    ];
  });

  // ── Gráfica de área: el crecimiento mes a mes ───────────────────────────
  protected readonly anchoArea = signal(AREA_W_INICIAL);
  protected readonly altoArea = AREA_H;
  private readonly areaWrap = viewChild<ElementRef<HTMLElement>>('areaWrap');

  /** El SVG se dibuja en píxeles reales, así que necesita el ancho que le dio el layout. */
  private readonly observarAncho = effect((onCleanup) => {
    const el = this.areaWrap()?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entrada]) => {
      const w = Math.round(entrada.contentRect.width);
      if (w >= 280 && w !== this.anchoArea()) this.anchoArea.set(w);
    });
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });

  protected readonly area = computed(() => {
    const serie = this.datos()?.serie_mensual ?? [];
    const esMonto = this.metrica() === 'monto';
    const w = this.anchoArea();
    const innerW = Math.max(40, w - AREA_PAD.left - AREA_PAD.right);
    const innerH = AREA_H - AREA_PAD.top - AREA_PAD.bottom;
    const baseY = AREA_PAD.top + innerH;
    const n = serie.length;
    const max = niceMax(Math.max(0, ...serie.map((p) => (esMonto ? p.monto : p.transacciones))));

    const puntos = serie.map((p, i) => {
      const valor = esMonto ? p.monto : p.transacciones;
      return {
        x: n === 1 ? AREA_PAD.left + innerW / 2 : AREA_PAD.left + (i * innerW) / (n - 1),
        y: baseY - (valor / max) * innerH,
        mes: p.mes,
        valor,
        transacciones: p.transacciones,
        monto: p.monto,
        negocios: p.negocios,
      };
    });

    const linea = smoothPath(puntos);
    const relleno = puntos.length
      ? `${linea} L${puntos[puntos.length - 1].x},${baseY} L${puntos[0].x},${baseY} Z`
      : '';

    const ticks = [0, 1, 2, 3, 4].map((k) => ({
      y: baseY - (k / 4) * innerH,
      label: esMonto ? this.fmtCompacto((max * k) / 4) : this.fmtEntero((max * k) / 4),
    }));

    // Como mucho seis etiquetas en el eje X: con una por mes se solapan en cuanto el historial
    // pasa de medio año.
    const cuantas = Math.min(n, 6);
    const etiquetas: Array<{ x: number; label: string }> = [];
    for (let k = 0; k < cuantas; k++) {
      const idx = cuantas === 1 ? 0 : Math.round((k * (n - 1)) / (cuantas - 1));
      etiquetas.push({ x: puntos[idx].x, label: this.fmtMes(puntos[idx].mes) });
    }

    return { puntos, linea, relleno, ticks, etiquetas, baseY, hayDatos: n > 0 };
  });

  protected readonly indiceHover = signal<number | null>(null);

  protected readonly puntoHover = computed(() => {
    const i = this.indiceHover();
    const pts = this.area().puntos;
    return i !== null && i >= 0 && i < pts.length ? pts[i] : null;
  });

  protected moverSobreArea(evento: MouseEvent | TouchEvent): void {
    const pts = this.area().puntos;
    if (pts.length === 0) return;
    const rect = (evento.currentTarget as SVGElement).getBoundingClientRect();
    if (rect.width === 0) return;
    const clientX = 'touches' in evento ? (evento.touches[0]?.clientX ?? 0) : evento.clientX;
    const x = ((clientX - rect.left) / rect.width) * this.anchoArea();
    let mejor = 0;
    let dist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - x);
      if (d < dist) {
        mejor = i;
        dist = d;
      }
    }
    this.indiceHover.set(mejor);
  }

  protected salirDelArea(): void {
    this.indiceHover.set(null);
  }

  protected cambiarMetrica(m: MetricaSerie): void {
    this.metrica.set(m);
    this.indiceHover.set(null);
  }

  // ── Anillo: reparto de la actividad por vertical ────────────────────────
  protected readonly donut = computed(() => {
    const filas = (this.datos()?.verticales ?? []).filter((v) => v.transacciones > 0);
    const total = filas.reduce((a, v) => a + v.transacciones, 0);
    const r = 56;
    const circunferencia = 2 * Math.PI * r;
    let acumulado = 0;

    const segmentos = filas.map((v) => {
      const pct = total > 0 ? v.transacciones / total : 0;
      const largo = pct * circunferencia;
      const seg = {
        key: v.vertical,
        label: this.verticalLabel(v.vertical),
        color: this.verticalColor(v.vertical),
        valor: v.transacciones,
        pct: pct * 100,
        // 2px de hueco entre porciones: el espaciador que las separa sin una línea blanca falsa.
        dash: `${Math.max(0, largo - 2)} ${circunferencia - Math.max(0, largo - 2)}`,
        offset: -acumulado,
      };
      acumulado += largo;
      return seg;
    });

    return { r, total, segmentos };
  });

  /** Negocios por vertical, incluidos los que aún no han facturado nada. */
  protected readonly verticalesConNegocios = computed<EstadisticasVertical[]>(() =>
    (this.datos()?.verticales ?? []).filter((v) => v.negocios > 0 || v.transacciones > 0),
  );

  // ── Barras: base de clientes acumulada ──────────────────────────────────
  protected readonly altas = computed(() => {
    const filas = this.datos()?.altas_negocios ?? [];
    const max = Math.max(1, ...filas.map((f) => f.acumulado));
    return filas.map((f) => ({
      ...f,
      mesLabel: this.fmtMes(f.mes),
      pct: (f.acumulado / max) * 100,
    }));
  });

  // ── Barras: ritmo de uso ────────────────────────────────────────────────
  protected readonly horas = computed(() => {
    const mapa = new Map((this.datos()?.por_hora ?? []).map((h) => [h.hora, h.transacciones]));
    const max = Math.max(1, ...mapa.values());
    return Array.from({ length: 24 }, (_, h) => {
      const valor = mapa.get(h) ?? 0;
      return {
        hora: h,
        label: `${String(h).padStart(2, '0')}:00`,
        valor,
        pct: (valor / max) * 100,
      };
    });
  });

  protected readonly dias = computed(() => {
    const filas = this.datos()?.por_dia_semana ?? [];
    const max = Math.max(1, ...filas.map((d) => d.transacciones));
    return filas.map((d) => ({
      dia: d.dia,
      label: DIAS[d.dia] ?? String(d.dia),
      valor: d.transacciones,
      pct: (d.transacciones / max) * 100,
    }));
  });

  /** La hora punta, que es la frase que acompaña a la gráfica. */
  protected readonly horaPunta = computed(() => {
    const filas = this.datos()?.por_hora ?? [];
    if (filas.length === 0) return null;
    return filas.reduce((a, b) => (b.transacciones > a.transacciones ? b : a));
  });

  // ── Ranking de inquilinos ───────────────────────────────────────────────
  protected readonly top = computed(() => {
    const filas = this.datos()?.top_negocios ?? [];
    const max = Math.max(1, ...filas.map((f) => f.transacciones));
    return filas.map((f, i) => ({
      ...f,
      pct: (f.transacciones / max) * 100,
      etiqueta: this.anonimo() ? `Negocio ${i + 1}` : f.nombre,
    }));
  });

  protected alternarAnonimo(): void {
    this.anonimo.update((v) => !v);
  }

  // ── Presentación ────────────────────────────────────────────────────────
  private readonly enteroFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
  private readonly monedaFmt = new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  });

  protected fmtEntero(v: number): string {
    return this.enteroFmt.format(Math.round(Number(v) || 0));
  }

  protected fmtMoneda(v: number): string {
    return this.monedaFmt.format(Number(v) || 0);
  }

  /** Dinero resumido: `$173,5 M`. Los totales de la plataforma no caben en una tarjeta. */
  protected fmtCompacto(v: number): string {
    const n = Number(v) || 0;
    if (n >= 1_000_000) {
      return `$${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
    }
    if (n >= 1_000) {
      return `$${(n / 1_000).toLocaleString('es-CO', { maximumFractionDigits: 0 })} K`;
    }
    return `$${this.enteroFmt.format(n)}`;
  }

  protected fmtPct(v: number): string {
    return `${(Number(v) || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;
  }

  /** `2026-04` → `abr 2026`. */
  protected fmtMes(mes: string): string {
    const [anio, m] = (mes ?? '').split('-');
    const idx = Number(m) - 1;
    if (!anio || idx < 0 || idx > 11) return mes ?? '';
    return `${MESES[idx]} ${anio}`;
  }

  protected fmtFecha(iso: string | null): string {
    if (!iso) return '—';
    return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  protected verticalLabel(v: Vertical): string {
    return VERTICALES[v]?.label ?? v;
  }

  protected verticalColor(v: Vertical): string {
    return VERTICALES[v]?.color ?? VERTICALES.otro.color;
  }

  /** El valor del punto bajo el cursor, en la unidad de la métrica activa. */
  protected valorMetrica(valor: number): string {
    return this.metrica() === 'monto' ? this.fmtMoneda(valor) : this.fmtEntero(valor);
  }
}
