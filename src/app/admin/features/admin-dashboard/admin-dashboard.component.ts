import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router }            from '@angular/router';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Sun, Moon, LogOut, AlertCircle, LayoutGrid,
} from 'lucide-angular';

import { AuthService }          from '../../../auth/data-access/auth.service';
import { ThemeService }         from '../../../core/theme/theme.service';
import { AdminService }         from '../../data-access/admin.service';
import { TipoNegocioConRoles }  from '../../models/admin.models';
import { LoadingState }         from '../../models/admin.models';
import { NegocioCardComponent } from '../negocio-card/negocio-card.component';
import { SUPER_ADMIN_ROL }      from '../../guards/admin.guard';

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
  imports: [LucideAngularModule, NegocioCardComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Sun, Moon, LogOut, AlertCircle, LayoutGrid }),
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

    // Recopilar id_tipo_negocio de los roles del usuario en sus negocios
    const tipoIds = new Set(
      u.negocios.flatMap((n) =>
        n.roles.map((r) => {
          const found = all
            .flatMap((t) => t.roles)
            .find((rol) => rol.descripcion === r.descripcion);
          return found?.id_tipo_negocio ?? null;
        }),
      ).filter((id): id is number => id !== null),
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
    this.router.navigate(['/dashboard/negocio', tipo.id_tipo_negocio]);
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
    this.adminService.getTiposNegocioConRoles().subscribe({
      next: (tipos) => {
        this._allTipos.set(tipos);
        this.loadingState.set('success');
      },
      error: () => {
        this.loadingState.set('error');
      },
    });
  }
}
