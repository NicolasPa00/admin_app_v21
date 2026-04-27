import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router }            from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Sun, Moon, LogOut, AlertCircle, LayoutGrid,
  Building2, ChevronLeft, ArrowRight, Phone, Mail, Hash, Loader,
} from 'lucide-angular';

import { TitleCasePipe }        from '@angular/common';
import { AuthService }          from '../../../auth/data-access/auth.service';
import { ThemeService }         from '../../../core/theme/theme.service';
import { AdminService }         from '../../data-access/admin.service';
import { TipoNegocioConRoles, Negocio }  from '../../models/admin.models';
import { LoadingState }         from '../../models/admin.models';
import { NegocioCardComponent } from '../negocio-card/negocio-card.component';
import { SUPER_ADMIN_ROL }      from '../../guards/admin.guard';
import { environment }          from '../../../../environments/environment';

/**
 * AdminDashboardComponent — Vista principal del panel administrador.
 *
 * Muestra tarjetas de tipos de negocio filtrando según el rol del usuario:
 *  - SUPER ADMINISTRADOR → ve todos.
 *  - Otros roles → ve solo los tipos de negocio que coincidan con sus roles.
 *
 * Estados de UI: loading (skeleton), error y empty state.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, NegocioCardComponent, TitleCasePipe],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Sun, Moon, LogOut, AlertCircle, LayoutGrid,
        Building2, ChevronLeft, ArrowRight, Phone, Mail, Hash, Loader,
      }),
    },
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl:    './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private readonly authService  = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly adminService = inject(AdminService);
  private readonly router       = inject(Router);

  // ===================== Estado reactivo =====================

  protected readonly loadingState = signal<LoadingState>('idle');
  private readonly _allTipos      = signal<TipoNegocioConRoles[]>([]);
  private readonly _misNegocios   = signal<Negocio[]>([]);

  /**
   * Estado de la vista de selección de sucursal.
   *
   *  null              → muestra el grid de tipos de negocio (vista principal)
   *  { loading: true } → consultando negocios al backend
   *  { loading: false, negocios: [] } → sin negocios disponibles
   *  { loading: false, negocios: [N…] } → lista de sucursales para elegir
   */
  protected readonly sucursalView = signal<{
    tipo:     TipoNegocioConRoles;
    negocios: Negocio[];
    loading:  boolean;
  } | null>(null);

  /** Usuario actual — recalcula la vista cuando cambia la sesión. */
  protected readonly user = this.authService.currentUser;

  /** ¿Es super administrador? */
  protected readonly isSuperAdmin = computed(() => {
    const u = this.user();
    if (!u) return false;
    return u.roles_globales.some((r) => r.descripcion === SUPER_ADMIN_ROL) ||
           u.negocios.some((n) => n.roles.some((r) => r.descripcion === SUPER_ADMIN_ROL));
  });

  /**
   * Tipos de negocio visibles según el rol del usuario.
   * - Super admin: todos.
   * - Otro: solo los tipos cuyo id coincide con algún rol del usuario.
   */
  protected readonly visibleTipos = computed<TipoNegocioConRoles[]>(() => {
    const all  = this._allTipos();
    const u    = this.user();

    if (!u || this.isSuperAdmin()) return all;

    // Fuente principal: negocios realmente ligados al usuario desde backend.
    const negociosLigados = this._misNegocios();
    if (negociosLigados.length > 0) {
      const tipoIds = new Set(negociosLigados.map((n) => n.id_tipo_negocio));
      return all.filter((t) => tipoIds.has(t.id_tipo_negocio));
    }

    // Fallback: mapear por id_rol (evita ambigüedad de descripciones repetidas).
    const roleIds = new Set(
      u.negocios.flatMap((n) => n.roles.map((r) => r.id_rol)),
    );

    const tipoIds = new Set(
      all
        .flatMap((t) => t.roles)
        .filter((rol) => rol.id_tipo_negocio !== null && roleIds.has(rol.id_rol))
        .map((rol) => Number(rol.id_tipo_negocio)),
    );

    return all.filter((t) => tipoIds.has(t.id_tipo_negocio));
  });

  /** Nombre de pantalla del usuario autenticado. */
  protected readonly displayName = computed(() => {
    const u = this.user();
    return u ? `${u.primer_nombre} ${u.primer_apellido}` : '';
  });

  /** Tema resuelto para el icono de toggle. */
  protected readonly isDark = computed(
    () => this.themeService.resolvedTheme() === 'dark',
  );

  /**
   * Mapa nombre-de-tipo → URL de la app dedicada. La key se obtiene
   * normalizando el nombre del tipo (mayúsculas + underscores).
   * Tipos sin entrada caen al placeholder interno `/dashboard/negocio/:id`.
   */
  private readonly MODULO_APPS: Record<string, string> = {
    PARQUEADERO: environment.parqueaderoAppUrl,
    RESTAURANTE: environment.negocioAppUrl,
    GIMNASIO:    environment.gymAppUrl,
    TIENDA:      environment.tiendaAppUrl,
  };

  private resolveAppUrl(tipoNombre: string | undefined): string | undefined {
    if (!tipoNombre) return undefined;
    return this.MODULO_APPS[tipoNombre.toUpperCase().replace(/\s+/g, '_')];
  }

  // ===================== Lifecycle =====================

  ngOnInit(): void {
    this.loadTipos();
  }

  // ===================== Acciones =====================

  protected toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  protected logout(): void {
    this.authService.logout();
  }

  protected onEntrar(tipo: TipoNegocioConRoles): void {
    const appUrl = this.resolveAppUrl(tipo.nombre);

    // Sin app dedicada aún: ruta interna de placeholder
    if (!appUrl) {
      this.router.navigate(['/dashboard/negocio', tipo.id_tipo_negocio]);
      return;
    }

    // Mostrar estado de carga del selector
    this.sucursalView.set({ tipo, negocios: [], loading: true });

    // Obtener los negocios del usuario para este tipo
    this.adminService.getMisNegociosPorTipo(tipo.id_tipo_negocio).subscribe({
      next: (negocios) => {
        if (negocios.length === 0) {
          // Sin negocios asignados → mostrar estado vacío en el selector
          this.sucursalView.set({ tipo, negocios: [], loading: false });
        } else if (negocios.length === 1) {
          // Solo una sucursal → ingresar directamente sin mostrar selector
          this.sucursalView.set(null);
          this.entrarAlNegocio(negocios[0], appUrl);
        } else {
          // Múltiples sucursales → mostrar selector
          this.sucursalView.set({ tipo, negocios, loading: false });
        }
      },
      error: () => {
        this.sucursalView.set(null);
        // Fallback: abrir app sin negocio específico
        window.location.href = `${appUrl}/acceso`;
      },
    });
  }

  /**
    * Redirige al módulo del negocio en la misma pestaña.
    *
    * Pide al backend un código de acceso de un solo uso (TTL 30 s) y
    * navega a `${appUrl}/auth/callback?code=<uuid>`. La app destino canjea
    * el código por la sesión completa (token + permisos).
    *
    * Reemplaza el patrón anterior basado en `window.name`, que dejó de
    * funcionar en navegación cross-origin (Chrome 88+, Firefox 79+).
   */
  protected entrarAlNegocio(negocio: Negocio, appUrl?: string): void {
    if (!appUrl) {
      appUrl = this.resolveAppUrl(this.sucursalView()?.tipo.nombre);
    }
    if (!appUrl) return;

    const token = this.authService.getAccessToken();
    if (!token) { this.authService.logout(); return; }

    const moduloPath: 'restaurante' | 'parqueadero' | 'gym' | 'tienda' | null =
      appUrl === environment.negocioAppUrl     ? 'restaurante' :
      appUrl === environment.parqueaderoAppUrl ? 'parqueadero' :
      appUrl === environment.gymAppUrl         ? 'gym' :
      appUrl === environment.tiendaAppUrl      ? 'tienda' :
      null;

    if (!moduloPath) {
      // Tipo de negocio sin app dedicada; abrir landing como fallback.
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

  /** Vuelve al grid de tipos de negocio desde el selector de sucursales */
  protected volverAlDashboard(): void {
    this.sucursalView.set(null);
  }

  protected onVerRoles(tipo: TipoNegocioConRoles): void {
    // Por ahora abre un dialog/navegación; ampliar según diseño
    this.router.navigate(['/admin/tipos-negocio', tipo.id_tipo_negocio, 'roles']);
  }

  protected retry(): void {
    this.loadTipos();
  }

  // ===================== Helpers privados =====================

  private loadTipos(): void {
    this.loadingState.set('loading');
    forkJoin({
      tipos: this.adminService.getTiposNegocioConRoles(),
      negocios: this.adminService.getMisNegociosUsuario().pipe(
        catchError(() => of([] as Negocio[])),
      ),
    }).subscribe({
      next: ({ tipos, negocios }) => {
        this._allTipos.set(tipos);
        this._misNegocios.set(negocios);
        this.loadingState.set('success');
      },
      error: () => {
        this.loadingState.set('error');
      },
    });
  }
}
