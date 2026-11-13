import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import {
  AlertCircle, Phone, RefreshCw, Users,
} from '../../../core/icons/phosphor';

import { EstadisticasService } from '../../data-access/estadisticas.service';
import { Embudo, EstadoEmbudo, NegocioEmbudo } from '../../models/embudo.models';
import { LoadingState } from '../../models/admin.models';

type Rango = 'todo' | '90' | '30';

/** Etiqueta y tono de cada estado. La pastilla SIEMPRE lleva la palabra, nunca solo el color. */
const ESTADOS: Record<EstadoEmbudo, { label: string; tono: 'ok' | 'aviso' | 'mal' | 'neutro' }> = {
  cliente: { label: 'Cliente', tono: 'ok' },
  en_prueba: { label: 'En prueba', tono: 'neutro' },
  cortesia: { label: 'Cortesía', tono: 'neutro' },
  cliente_vencido: { label: 'Plan vencido', tono: 'aviso' },
  prueba_vencida: { label: 'Prueba vencida', tono: 'mal' },
  baja: { label: 'Baja', tono: 'mal' },
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Pruebas y conversión (super admin, INTERNO).
 *
 * Contesta dos preguntas: ¿en qué paso se nos caen los registros? y ¿a quién llamo hoy?
 * Registrado → configuró → primera venta → pagó. A diferencia de «Estadísticas», esta no se
 * enseña a un interesado: lleva nombres y alertas comerciales.
 */
@Component({
  selector: 'app-embudo',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './embudo.component.html',
  styleUrl: './embudo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ AlertCircle, Phone, RefreshCw, Users }),
    },
  ],
})
export class EmbudoComponent implements OnInit {
  private readonly service = inject(EstadisticasService);

  private readonly _estado = signal<LoadingState>('idle');
  private readonly _datos = signal<Embudo | null>(null);
  private readonly _rango = signal<Rango>('todo');
  private readonly _filtro = signal<EstadoEmbudo | 'todos'>('todos');

  readonly estado = this._estado.asReadonly();
  readonly datos = this._datos.asReadonly();
  readonly rango = this._rango.asReadonly();
  readonly filtro = this._filtro.asReadonly();

  readonly rangos: { valor: Rango; label: string }[] = [
    { valor: 'todo', label: 'Todo' },
    { valor: '90', label: '90 días' },
    { valor: '30', label: '30 días' },
  ];

  /** Los cuatro escalones, con su % sobre los registrados y la caída frente al anterior. */
  readonly escalones = computed(() => {
    const k = this._datos()?.kpis;
    if (!k) return [];
    const pasos = [
      { label: 'Se registraron', n: k.registrados, ayuda: 'Negocios creados (sin demos ni sedes)' },
      { label: 'Configuraron', n: k.configurados, ayuda: 'Terminaron la configuración inicial' },
      { label: 'Vendieron algo', n: k.con_venta, ayuda: 'Al menos una venta, cita u orden real' },
      { label: 'Pagaron', n: k.pagaron, ayuda: 'Al menos una mensualidad pagada' },
    ];
    return pasos.map((p, i) => ({
      ...p,
      pct: k.registrados ? Math.round((p.n / k.registrados) * 100) : 0,
      ancho: k.registrados ? Math.max(4, (p.n / k.registrados) * 100) : 0,
      caida: i > 0 && pasos[i - 1].n ? Math.round((1 - p.n / pasos[i - 1].n) * 100) : null,
    }));
  });

  /** Lo accionable primero: los negocios con alerta, los de prueba que vence antes arriba. */
  readonly pendientes = computed(() =>
    (this._datos()?.negocios ?? [])
      .filter((n) => n.alerta)
      .sort((a, b) => (a.dias_prueba ?? 999) - (b.dias_prueba ?? 999)),
  );

  readonly filtros = computed(() => {
    const por = this._datos()?.por_estado ?? {};
    return (Object.keys(ESTADOS) as EstadoEmbudo[])
      .filter((e) => (por[e] ?? 0) > 0)
      .map((e) => ({ valor: e, label: ESTADOS[e].label, n: por[e] ?? 0 }));
  });

  readonly negociosFiltrados = computed(() => {
    const f = this._filtro();
    const lista = this._datos()?.negocios ?? [];
    return f === 'todos' ? lista : lista.filter((n) => n.estado === f);
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    // Spinner solo en la primera carga; al refrescar se queda lo que había (sin parpadeo).
    if (!this._datos()) this._estado.set('loading');
    const { desde } = this.fechas(this._rango());
    this.service.getEmbudo(desde, null).subscribe({
      next: (d) => {
        this._datos.set(d);
        this._estado.set('success');
      },
      error: () => this._estado.set(this._datos() ? 'success' : 'error'),
    });
  }

  cambiarRango(r: Rango): void {
    if (r === this._rango()) return;
    this._rango.set(r);
    this._filtro.set('todos');
    this._datos.set(null);
    this.cargar();
  }

  cambiarFiltro(f: EstadoEmbudo | 'todos'): void {
    this._filtro.set(f);
  }

  etiquetaEstado(e: EstadoEmbudo): string {
    return ESTADOS[e].label;
  }

  tonoEstado(e: EstadoEmbudo): string {
    return ESTADOS[e].tono;
  }

  fecha(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : `${d.getDate()} ${MESES[d.getMonth()]}`;
  }

  mes(clave: string): string {
    const [a, m] = clave.split('-');
    return `${MESES[Number(m) - 1]} ${a}`;
  }

  pct(parte: number, total: number): string {
    return total ? `${Math.round((parte / total) * 100)} %` : '—';
  }

  uso(n: NegocioEmbudo): string {
    if (!n.n_tx) return 'Sin ventas';
    if (n.dias_sin_uso === 0) return 'Hoy';
    return n.dias_sin_uso === 1 ? 'Ayer' : `Hace ${n.dias_sin_uso} días`;
  }

  dinero(v: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(v);
  }

  private fechas(r: Rango): { desde: string | null } {
    if (r === 'todo') return { desde: null };
    const d = new Date();
    d.setDate(d.getDate() - Number(r));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return { desde: `${y}-${m}-${dia}` };
  }
}
