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
  History, Database, Zap, AlertCircle, ChevronLeft, ChevronRight,
  ChevronDown, Download, Loader2, RotateCcw,
} from 'lucide-angular';

import { AuditoriaService } from '../../data-access/auditoria.service';
import {
  AuditCatalogo, AuditDato, AuditEvento, AuditFiltros,
} from '../../models/auditoria.models';
import { LoadingState } from '../../models/admin.models';

type Pestania = 'datos' | 'eventos';

const LIMIT = 25;

/** Etiquetas legibles por operación de auditoría. */
const OPERACIONES: Record<string, string> = {
  I: 'Creación',
  U: 'Modificación',
  D: 'Eliminación',
  B: 'Baseline',
};

/** El código de una columna `estado` es el mismo en todo el backend (ver CLAUDE.md). */
const ESTADOS: Record<string, string> = {
  A: 'Activo',
  I: 'Inactivo',
  E: 'Eliminado',
};

/**
 * Etiqueta de negocio por tabla auditada — para un super admin es lectura normal, pero para
 * cualquier otra persona `esquema.tabla` es vocabulario de base de datos, no de la plataforma.
 * Clave `esquema.tabla`; lo que no esté aquí (una tabla nueva) cae al nombre crudo, no se rompe.
 */
const TABLAS: Record<string, string> = {
  'cobranza.cob_factura': 'Factura',
  'cobranza.cob_suscripcion': 'Suscripción',
  'general.gener_negocio': 'Negocio',
  'general.gener_negocio_plan': 'Plan del negocio',
  'general.gener_negocio_usuario': 'Usuario del negocio',
  'general.gener_plan': 'Plan',
  'general.gener_rol': 'Rol',
  'general.gener_usuario': 'Usuario',
  'general.gener_usuario_rol': 'Rol de usuario',
  'reserva.reserva_caja': 'Caja (Reserva)',
  'reserva.reserva_categoria': 'Categoría de servicio (Reserva)',
  'reserva.reserva_cita': 'Cita (Reserva)',
  'reserva.reserva_config': 'Configuración (Reserva)',
  'reserva.reserva_horario': 'Horario (Reserva)',
  'reserva.reserva_movimiento_caja': 'Movimiento de caja (Reserva)',
  'reserva.reserva_pago_cita': 'Pago de cita (Reserva)',
  'reserva.reserva_profesional': 'Profesional (Reserva)',
  'reserva.reserva_servicio': 'Servicio (Reserva)',
  'reserva.reserva_servicio_variante': 'Variante de servicio (Reserva)',
  'restaurante.carta_diseno': 'Diseño de carta (Restaurante)',
  'restaurante.carta_producto': 'Producto de carta (Restaurante)',
  'restaurante.pedid_orden': 'Pedido (Restaurante)',
  'restaurante.rest_caja': 'Caja (Restaurante)',
  'restaurante.rest_cuenta': 'Cuenta / tiquetera (Restaurante)',
  'restaurante.rest_cuenta_movimiento': 'Movimiento de cuenta (Restaurante)',
  'restaurante.rest_movimiento_caja': 'Movimiento de caja (Restaurante)',
};

/**
 * AuditoriaComponent — Vista de Super Admin con el historial de auditoría.
 *
 * Dos pestañas:
 *  - Datos:   cambios fila a fila capturados por triggers (auditoria.audit_dato)
 *  - Eventos: acciones de aplicación (login, cambios de plan, caja...)
 * Filtros por negocio, tabla/módulo, operación y rango de fechas; detalle
 * expandible con el antes/después en JSON; export CSV.
 */
@Component({
  selector: 'app-auditoria',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        History, Database, Zap, AlertCircle, ChevronLeft, ChevronRight,
        ChevronDown, Download, Loader2, RotateCcw,
      }),
    },
  ],
  templateUrl: './auditoria.component.html',
  styleUrl: './auditoria.component.scss',
})
export class AuditoriaComponent implements OnInit {
  private readonly api = inject(AuditoriaService);

  // ── Estado ──────────────────────────────────────────────
  protected readonly pestania = signal<Pestania>('datos');
  protected readonly estado = signal<LoadingState>('loading');
  protected readonly exportando = signal(false);

  protected readonly catalogo = signal<AuditCatalogo>({ tablas: [], modulos: [], negocios: [] });

  protected readonly datos = signal<AuditDato[]>([]);
  protected readonly eventos = signal<AuditEvento[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);

  /** id de la fila expandida (detalle JSON) o null. */
  protected readonly expandida = signal<number | null>(null);

  // ── Filtros (valores actuales de los selects/inputs) ────
  protected readonly fNegocio = signal('');
  protected readonly fTabla = signal('');    // 'esquema.tabla'
  protected readonly fOperacion = signal('');
  protected readonly fModulo = signal('');
  protected readonly fAccion = signal('');
  protected readonly fDesde = signal('');
  protected readonly fHasta = signal('');

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / LIMIT)),
  );

  /** Acciones disponibles para el módulo seleccionado. */
  protected readonly accionesModulo = computed(() => {
    const mod = this.catalogo().modulos.find((m) => m.modulo === this.fModulo());
    return mod?.acciones ?? [];
  });

  ngOnInit(): void {
    this.api.getCatalogo().subscribe({
      next: (cat) => this.catalogo.set(cat),
      error: () => {}, // el catálogo es auxiliar: la vista funciona sin él
    });
    this.cargar();
  }

  // ── Carga de datos ──────────────────────────────────────
  private buildFiltros(): AuditFiltros {
    const filtros: AuditFiltros = { page: this.page(), limit: LIMIT };
    if (this.fNegocio()) filtros.id_negocio = Number(this.fNegocio());
    if (this.fDesde()) filtros.desde = this.fDesde();
    if (this.fHasta()) filtros.hasta = this.fHasta();
    if (this.pestania() === 'datos') {
      const [esquema, tabla] = this.fTabla() ? this.fTabla().split('.') : ['', ''];
      if (esquema) filtros.esquema = esquema;
      if (tabla) filtros.tabla = tabla;
      if (this.fOperacion()) filtros.operacion = this.fOperacion();
    } else {
      if (this.fModulo()) filtros.modulo = this.fModulo();
      if (this.fAccion()) filtros.accion = this.fAccion();
    }
    return filtros;
  }

  protected cargar(): void {
    this.estado.set('loading');
    this.expandida.set(null);
    const filtros = this.buildFiltros();

    if (this.pestania() === 'datos') {
      this.api.getDatos(filtros).subscribe({
        next: (pagina) => {
          this.datos.set(pagina.rows);
          this.total.set(pagina.total);
          this.estado.set('success');
        },
        error: () => this.estado.set('error'),
      });
    } else {
      this.api.getEventos(filtros).subscribe({
        next: (pagina) => {
          this.eventos.set(pagina.rows);
          this.total.set(pagina.total);
          this.estado.set('success');
        },
        error: () => this.estado.set('error'),
      });
    }
  }

  // ── Interacción ─────────────────────────────────────────
  protected cambiarPestania(p: Pestania): void {
    if (this.pestania() === p) return;
    this.pestania.set(p);
    this.page.set(1);
    this.cargar();
  }

  protected aplicarFiltros(): void {
    this.page.set(1);
    this.cargar();
  }

  protected limpiarFiltros(): void {
    this.fNegocio.set('');
    this.fTabla.set('');
    this.fOperacion.set('');
    this.fModulo.set('');
    this.fAccion.set('');
    this.fDesde.set('');
    this.fHasta.set('');
    this.aplicarFiltros();
  }

  protected irPagina(delta: number): void {
    const destino = this.page() + delta;
    if (destino < 1 || destino > this.totalPaginas()) return;
    this.page.set(destino);
    this.cargar();
  }

  protected toggleDetalle(id: number): void {
    this.expandida.set(this.expandida() === id ? null : id);
  }

  protected exportar(): void {
    if (this.exportando()) return;
    this.exportando.set(true);
    this.api.exportCsv(this.pestania(), this.buildFiltros()).subscribe({
      next: () => this.exportando.set(false),
      error: () => this.exportando.set(false),
    });
  }

  protected onModuloChange(valor: string): void {
    this.fModulo.set(valor);
    this.fAccion.set('');
  }

  // ── Presentación ────────────────────────────────────────
  protected opLabel(op: string): string {
    return OPERACIONES[op] ?? op;
  }

  protected fmtFecha(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  protected tablaLabel(esquema: string, tabla: string): string {
    return TABLAS[`${esquema}.${tabla}`] ?? `${esquema}.${tabla}`;
  }

  /** Antes/después como pares campo-valor — nunca un volcado de JSON crudo en pantalla. */
  protected campos(valor: unknown): { clave: string; valor: string }[] {
    if (valor == null || typeof valor !== 'object') return [];
    return Object.entries(valor as Record<string, unknown>).map(([clave, v]) => ({
      clave,
      valor: this.formatCampo(clave, v),
    }));
  }

  private formatCampo(clave: string, v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (clave === 'estado' && typeof v === 'string' && ESTADOS[v]) return ESTADOS[v];
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    return String(v);
  }
}
