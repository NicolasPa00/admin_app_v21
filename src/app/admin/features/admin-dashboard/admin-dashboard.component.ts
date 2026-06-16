import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router }            from '@angular/router';
import { TitleCasePipe }     from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  AlertCircle, Building2, ArrowRight, Hash, Phone, Mail,
  DollarSign, Receipt, TrendingUp, TrendingDown, Minus,
} from 'lucide-angular';

import { AuthService }          from '../../../auth/data-access/auth.service';
import { AdminService }         from '../../data-access/admin.service';
import { Negocio, TipoNegocio, LoadingState, MetricasResumen } from '../../models/admin.models';
import { SUPER_ADMIN_ROL }      from '../../guards/admin.guard';
import { environment }          from '../../../../environments/environment';

/** Negocio enriquecido con el nombre legible de su tipo. */
interface NegocioVista extends Negocio {
  tipoNombre: string;
}

/** Tarjeta de métrica del dashboard (solo Super Admin). */
interface KpiMetrica {
  icon: string;
  accent: 'blue' | 'green' | 'purple' | 'orange';
  label: string;
  valor: string;
  tendencia: number | null;
  sub: string;
}

/**
 * AdminDashboardComponent — Vista principal del panel administrador.
 *
 * Muestra la lista de NEGOCIOS ACTIVOS del usuario administrador
 * (no los tipos de negocio). Cada tarjeta muestra el nombre del negocio
 * y su tipo; al hacer clic se ingresa directamente a la vertical
 * correspondiente vía código de acceso SSO de un solo uso.
 *
 * Estados de UI: loading (skeleton), error y empty state.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, TitleCasePipe],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        AlertCircle, Building2, ArrowRight, Hash, Phone, Mail,
        DollarSign, Receipt, TrendingUp, TrendingDown, Minus,
      }),
    },
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl:    './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private readonly authService  = inject(AuthService);
  private readonly adminService = inject(AdminService);
  private readonly router       = inject(Router);

  // ===================== Estado reactivo =====================

  protected readonly loadingState = signal<LoadingState>('idle');
  private readonly _negocios = signal<Negocio[]>([]);
  private readonly _tipos    = signal<TipoNegocio[]>([]);

  /** Usuario actual. */
  protected readonly user = this.authService.currentUser;

  /** ¿Es super administrador? */
  protected readonly isSuperAdmin = computed(() => {
    const u = this.user();
    if (!u) return false;
    return u.roles_globales.some((r) => r.descripcion === SUPER_ADMIN_ROL) ||
           u.negocios.some((n) => n.roles.some((r) => r.descripcion === SUPER_ADMIN_ROL));
  });

  /** Mapa id_tipo_negocio → nombre del tipo, para etiquetar cada negocio. */
  private readonly tipoNombrePorId = computed(() => {
    const m = new Map<number, string>();
    for (const t of this._tipos()) m.set(t.id_tipo_negocio, t.nombre);
    return m;
  });

  /** Negocios del usuario, enriquecidos con el nombre de su tipo. */
  protected readonly negocios = computed<NegocioVista[]>(() =>
    this._negocios().map((n) => ({
      ...n,
      tipoNombre: this.tipoNombrePorId().get(n.id_tipo_negocio) ?? 'Negocio',
    })),
  );

  // ── Métricas (solo Super Admin) ─────────────────────────────
  protected readonly metricas = signal<MetricasResumen | null>(null);

  protected readonly kpis = computed<KpiMetrica[]>(() => {
    const m = this.metricas();
    if (!m) return [];
    return [
      { icon: 'building-2', accent: 'blue', label: 'Negocios activos hoy',
        valor: String(m.negocios_activos.valor), tendencia: m.negocios_activos.tendencia, sub: 'vs ayer' },
      { icon: 'dollar-sign', accent: 'green', label: 'Ingresos del día',
        valor: this.formatCOP(m.ingresos.valor), tendencia: m.ingresos.tendencia, sub: 'vs ayer' },
      { icon: 'receipt', accent: 'purple', label: 'Transacciones hoy',
        valor: String(m.transacciones.valor), tendencia: m.transacciones.tendencia, sub: 'vs ayer' },
      { icon: 'trending-up', accent: 'orange', label: 'Conversión a plan',
        valor: `${m.conversion.valor}%`, tendencia: m.conversion.tendencia,
        sub: `${m.conversion.pagados} de ${m.conversion.total} negocios` },
    ];
  });

  /**
   * Mapa nombre-de-tipo → URL de la app dedicada. La key se obtiene
   * normalizando el nombre del tipo (mayúsculas + underscores).
   */
  private readonly MODULO_APPS: Record<string, string> = {
    PARQUEADERO: environment.parqueaderoAppUrl,
    RESTAURANTE: environment.negocioAppUrl,
    GIMNASIO:    environment.gymAppUrl,
    TIENDA:      environment.tiendaAppUrl,
    RESERVA:     environment.reservaAppUrl,
  };

  private resolveAppUrl(tipoNombre: string | undefined): string | undefined {
    if (!tipoNombre) return undefined;
    return this.MODULO_APPS[tipoNombre.toUpperCase().replace(/\s+/g, '_')];
  }

  // ===================== Lifecycle =====================

  ngOnInit(): void {
    this.loadData();
    if (this.isSuperAdmin()) this.loadMetricas();
  }

  // ── Helpers de métricas ─────────────────────────────────────
  protected formatCOP(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }

  protected trendIcon(t: number | null): string {
    if (t === null || t === 0) return 'minus';
    return t > 0 ? 'trending-up' : 'trending-down';
  }

  protected trendClass(t: number | null): 'up' | 'down' | 'flat' {
    if (t === null || t === 0) return 'flat';
    return t > 0 ? 'up' : 'down';
  }

  private loadMetricas(): void {
    this.adminService.getMetricasResumen().subscribe({
      next: (m) => this.metricas.set(m),
      error: () => this.metricas.set(null),
    });
  }

  // ===================== Acciones =====================

  /**
   * Ingresa al negocio seleccionado en su vertical.
   *
   * Pide al backend un código de acceso de un solo uso (TTL 30 s) y
   * navega a `${appUrl}/auth/callback?code=<uuid>`. La app destino canjea
   * el código por la sesión completa (token + permisos).
   */
  protected entrarAlNegocio(negocio: NegocioVista): void {
    const appUrl = this.resolveAppUrl(negocio.tipoNombre);

    // Tipo sin app dedicada aún: ruta interna de placeholder.
    if (!appUrl) {
      this.router.navigate(['/dashboard/negocio', negocio.id_tipo_negocio]);
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) { this.authService.logout(); return; }

    const moduloPath: 'restaurante' | 'parqueadero' | 'gym' | 'tienda' | 'reserva' | null =
      appUrl === environment.negocioAppUrl     ? 'restaurante' :
      appUrl === environment.parqueaderoAppUrl ? 'parqueadero' :
      appUrl === environment.gymAppUrl         ? 'gym' :
      appUrl === environment.tiendaAppUrl      ? 'tienda' :
      appUrl === environment.reservaAppUrl     ? 'reserva' :
      null;

    if (!moduloPath) {
      window.location.href = `${appUrl}/`;
      return;
    }

    this.adminService.generarCodigoAcceso(moduloPath, {
      token,
      id_negocio: negocio.id_negocio,
    }).subscribe({
      next: (code) => {
        if (!code) { this.authService.logout(); return; }
        window.location.href = `${appUrl}/auth/callback?code=${encodeURIComponent(code)}`;
      },
      error: () => {
        // Sin código no podemos transferir sesión: forzar relogin.
        this.authService.logout();
      },
    });
  }

  protected retry(): void {
    this.loadData();
  }

  // ===================== Helpers privados =====================

  private loadData(): void {
    this.loadingState.set('loading');
    forkJoin({
      negocios: this.adminService.getMisNegociosUsuario(),
      tipos: this.adminService.getTiposNegocio().pipe(
        catchError(() => of([] as TipoNegocio[])),
      ),
    }).subscribe({
      next: ({ negocios, tipos }) => {
        this._negocios.set(negocios);
        this._tipos.set(tipos);
        this.loadingState.set('success');
      },
      error: () => {
        this.loadingState.set('error');
      },
    });
  }
}
