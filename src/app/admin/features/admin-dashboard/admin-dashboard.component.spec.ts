import { TestBed }         from '@angular/core/testing';
import { provideRouter }   from '@angular/router';
import { signal }          from '@angular/core';
import {
  provideHttpClient,
} from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';

import { AdminDashboardComponent } from './admin-dashboard.component';
import { AuthService }             from '../../../auth/data-access/auth.service';
import { ThemeService }            from '../../../core/theme/theme.service';
import { AdminService }            from '../../data-access/admin.service';
import { User }                    from '../../../auth/models/auth.models';
import { TipoNegocioConRoles }     from '../../models/admin.models';
import { environment }             from '../../../../environments/environment';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id_usuario:      1,
    primer_nombre:   'Nicolas',
    primer_apellido: 'Paez',
    email:           'test@test.com',
    negocios:        [],
    roles_globales:  [],
    ...overrides,
  };
}

const TIPOS_MOCK: TipoNegocioConRoles[] = [
  {
    id_tipo_negocio: 1, nombre: 'RESTAURANTE', descripcion: 'Restaurante',
    estado: 'A', fecha_creacion: '2026-02-27', fecha_actualizacion: '2026-02-27',
    roles: [{ id_rol: 2, descripcion: 'ADMINISTRADOR RESTAURANTE', estado: 'A', id_tipo_negocio: 1, fecha_creacion: '2026-02-27', fecha_actualizacion: '2026-02-27' }],
  },
  {
    id_tipo_negocio: 2, nombre: 'PARQUEADERO', descripcion: 'Parqueadero',
    estado: 'A', fecha_creacion: '2026-02-27', fecha_actualizacion: '2026-02-27',
    roles: [{ id_rol: 4, descripcion: 'ADMINISTRADOR PARQUEADERO', estado: 'A', id_tipo_negocio: 2, fecha_creacion: '2026-02-27', fecha_actualizacion: '2026-02-27' }],
  },
];

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

describe('AdminDashboardComponent', () => {
  let httpMock: HttpTestingController;

  async function createComponent(user: User | null) {
    const authMock = {
      currentUser:     signal(user),
      isAuthenticated: signal(user !== null),
      logout:          jasmine.createSpy('logout'),
    };

    const themeMock = {
      resolvedTheme: signal<'light' | 'dark'>('light'),
      toggleTheme:   jasmine.createSpy('toggleTheme'),
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authMock },
        { provide: ThemeService, useValue: themeMock },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminDashboardComponent);
    fixture.detectChanges();
    return { fixture, authMock, themeMock };
  }

  afterEach(() => {
    httpMock?.verify();
  });

  // ── Cargando / skeleton ──────────────────────────────────

  it('should show skeleton while loading', async () => {
    const superAdmin = buildUser({
      roles_globales: [{ id_rol: 1, descripcion: 'SUPER ADMINISTRADOR' }],
    });
    const { fixture } = await createComponent(superAdmin);

    const skeletons = fixture.nativeElement.querySelectorAll('.skeleton-card');
    expect(skeletons.length).toBeGreaterThan(0);

    // Limpiar petición pendiente
    httpMock.expectOne(`${environment.apiUrl}/tipos-negocio`).flush({ success: true, data: [] });
    httpMock.expectOne(`${environment.apiUrl}/roles`).flush({ success: true, data: [] });
  });

  // ── Super Admin ve todos los tipos ──────────────────────

  it('should show all tipos when user is SUPER ADMINISTRADOR', async () => {
    const superAdmin = buildUser({
      roles_globales: [{ id_rol: 1, descripcion: 'SUPER ADMINISTRADOR' }],
    });
    const { fixture } = await createComponent(superAdmin);

    // Resolver la petición HTTP
    httpMock.expectOne(`${environment.apiUrl}/tipos-negocio`)
      .flush({ success: true, data: TIPOS_MOCK.map(({ roles: _, ...t }) => t) });
    httpMock.expectOne(`${environment.apiUrl}/roles`)
      .flush({ success: true, data: TIPOS_MOCK.flatMap((t) => t.roles) });

    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-negocio-card');
    expect(cards.length).toBe(2);
  });

  // ── Admin de tenant ve solo su tipo ─────────────────────

  it('should show only permitted tipo for tenant admin', async () => {
    const tenantAdmin = buildUser({
      negocios: [{
        id_negocio: 1,
        nombre: 'Mi Restaurante',
        roles: [{ id_rol: 2, descripcion: 'ADMINISTRADOR RESTAURANTE' }],
      }],
    });
    const { fixture } = await createComponent(tenantAdmin);

    httpMock.expectOne(`${environment.apiUrl}/tipos-negocio`)
      .flush({ success: true, data: TIPOS_MOCK.map(({ roles: _, ...t }) => t) });
    httpMock.expectOne(`${environment.apiUrl}/roles`)
      .flush({ success: true, data: TIPOS_MOCK.flatMap((t) => t.roles) });

    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-negocio-card');
    expect(cards.length).toBe(1);
  });

  // ── Estado de error ──────────────────────────────────────

  it('should show error state when request fails', async () => {
    const superAdmin = buildUser({
      roles_globales: [{ id_rol: 1, descripcion: 'SUPER ADMINISTRADOR' }],
    });
    const { fixture } = await createComponent(superAdmin);

    httpMock.expectOne(`${environment.apiUrl}/tipos-negocio`).error(new ErrorEvent('Network error'));
    httpMock.expectOne(`${environment.apiUrl}/roles`).flush({ success: true, data: [] });

    fixture.detectChanges();

    const errorState = fixture.nativeElement.querySelector('.dashboard__state--error');
    expect(errorState).toBeTruthy();
  });

  // ── Toggle de tema ───────────────────────────────────────

  it('should call toggleTheme when theme button clicked', async () => {
    const superAdmin = buildUser({
      roles_globales: [{ id_rol: 1, descripcion: 'SUPER ADMINISTRADOR' }],
    });
    const { fixture, themeMock } = await createComponent(superAdmin);

    const btn = fixture.nativeElement.querySelector('.theme-toggle') as HTMLElement;
    btn.click();
    expect(themeMock.toggleTheme).toHaveBeenCalled();

    httpMock.expectOne(`${environment.apiUrl}/tipos-negocio`).flush({ success: true, data: [] });
    httpMock.expectOne(`${environment.apiUrl}/roles`).flush({ success: true, data: [] });
  });

  // ── Logout ───────────────────────────────────────────────

  it('should call logout when logout button clicked', async () => {
    const superAdmin = buildUser({
      roles_globales: [{ id_rol: 1, descripcion: 'SUPER ADMINISTRADOR' }],
    });
    const { fixture, authMock } = await createComponent(superAdmin);

    const btn = fixture.nativeElement.querySelector('.dashboard__logout-btn') as HTMLElement;
    btn.click();
    expect(authMock.logout).toHaveBeenCalled();

    httpMock.expectOne(`${environment.apiUrl}/tipos-negocio`).flush({ success: true, data: [] });
    httpMock.expectOne(`${environment.apiUrl}/roles`).flush({ success: true, data: [] });
  });
});
