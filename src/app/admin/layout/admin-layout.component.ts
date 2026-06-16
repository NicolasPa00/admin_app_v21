import {
  Component,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd,
} from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  LayoutGrid,
  Settings,
  Users,
  Store,
  Building2,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  Menu,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-angular';

import { AuthService } from '../../auth/data-access/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { AssetService } from '../../core/services/asset.service';
import { NotificacionesBellComponent } from '../features/notificaciones/notificaciones-bell.component';
import { SUPER_ADMIN_ROL } from '../guards/admin.guard';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Si es true, solo se muestra al Super Administrador. */
  superAdmin?: boolean;
}

/** Clave de localStorage para recordar si el sidebar quedó colapsado. */
const COLLAPSE_KEY = 'admin_sidebar_collapsed';

/**
 * AdminLayoutComponent — Shell del panel administrativo.
 *
 * Provee la estructura compartida por todas las rutas de `/admin`:
 *  • Sidebar de navegación (colapsable en desktop, off-canvas en móvil).
 *  • Header con breadcrumb + controles (tema, notificaciones, usuario).
 *  • Área de contenido con <router-outlet>.
 *
 * El dashboard y demás vistas solo aportan su contenido; los controles
 * globales (tema/logout/notificaciones) viven aquí una sola vez.
 */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideAngularModule,
    NotificacionesBellComponent,
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        LayoutGrid, Settings, Users, Store, Building2, Sun, Moon, LogOut,
        ChevronRight, Menu, PanelLeft, PanelLeftClose,
      }),
    },
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  private readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly assets = inject(AssetService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  // ── Navegación ──────────────────────────────────────────────
  private readonly navItems: NavItem[] = [
    { label: 'Inicio', icon: 'layout-grid', route: '/admin/dashboard' },
    { label: 'Negocios', icon: 'building-2', route: '/admin/negocios', superAdmin: true },
    { label: 'Usuarios', icon: 'users', route: '/admin/usuarios', superAdmin: true },
    { label: 'Tipos', icon: 'store', route: '/admin/registrar', superAdmin: true },
    { label: 'Configuración', icon: 'settings', route: '/admin/configuracion' },
  ];

  /** ¿El usuario es Super Administrador? */
  private readonly isSuperAdmin = computed(() => {
    const u = this.user();
    if (!u) return false;
    return u.roles_globales.some((r) => r.descripcion === SUPER_ADMIN_ROL) ||
           u.negocios.some((n) => n.roles.some((r) => r.descripcion === SUPER_ADMIN_ROL));
  });

  /** Ítems de navegación visibles según el rol. */
  protected readonly visibleNavItems = computed<NavItem[]>(() =>
    this.navItems.filter((item) => !item.superAdmin || this.isSuperAdmin()),
  );

  // ── Estado de UI ────────────────────────────────────────────
  protected readonly collapsed = signal(this.readCollapsed());
  protected readonly mobileOpen = signal(false);

  // ── Derivados de sesión / tema ──────────────────────────────
  protected readonly user = this.auth.currentUser;
  protected readonly isDark = computed(
    () => this.theme.resolvedTheme() === 'dark',
  );
  protected readonly displayName = computed(() => {
    const u = this.user();
    return u ? `${u.primer_nombre} ${u.primer_apellido}` : '';
  });
  protected readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '';
    return `${u.primer_nombre?.[0] ?? ''}${u.primer_apellido?.[0] ?? ''}`.toUpperCase();
  });

  // ── Breadcrumb derivado de la URL activa ────────────────────
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly pageTitle = computed(() => {
    const url = this.currentUrl();
    if (url.includes('/configuracion')) return 'Configuración';
    if (url.includes('/negocios')) return 'Negocios';
    if (url.includes('/usuarios')) return 'Usuarios';
    if (url.includes('/registrar')) return 'Tipos de negocio';
    if (url.includes('/tipos-negocio')) return 'Roles del negocio';
    return 'Inicio';
  });

  // ── Acciones ────────────────────────────────────────────────
  protected toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(COLLAPSE_KEY, String(this.collapsed()));
    }
  }

  protected toggleMobile(): void {
    this.mobileOpen.update((v) => !v);
  }

  protected closeMobile(): void {
    this.mobileOpen.set(false);
  }

  protected toggleTheme(): void {
    this.theme.toggleTheme();
  }

  protected logout(): void {
    this.auth.logout();
  }

  private readCollapsed(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  }
}
