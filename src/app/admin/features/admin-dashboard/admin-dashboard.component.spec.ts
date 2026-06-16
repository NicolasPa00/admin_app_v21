import { vi }              from 'vitest';
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
import { User }                    from '../../../auth/models/auth.models';
import { Negocio, TipoNegocio }    from '../../models/admin.models';
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

const TIPOS_MOCK: TipoNegocio[] = [
  { id_tipo_negocio: 1, nombre: 'RESTAURANTE', descripcion: 'Restaurante', estado: 'A', fecha_creacion: '2026-02-27', fecha_actualizacion: '2026-02-27' },
  { id_tipo_negocio: 2, nombre: 'PARQUEADERO', descripcion: 'Parqueadero', estado: 'A', fecha_creacion: '2026-02-27', fecha_actualizacion: '2026-02-27' },
];

const NEGOCIOS_MOCK: Negocio[] = [
  { id_negocio: 10, nombre: 'La Parrilla de Juan', nit: '900', email_contacto: 'j@x.com', telefono: '300', id_tipo_negocio: 1, id_paleta: null, estado: 'A', fecha_registro: '2026-02-27' },
  { id_negocio: 11, nombre: 'Parqueadero Centro',  nit: null,  email_contacto: null,      telefono: null,  id_tipo_negocio: 2, id_paleta: null, estado: 'A', fecha_registro: '2026-02-27' },
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
      getAccessToken:  vi.fn().mockReturnValue('tok'),
      logout:          vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminDashboardComponent);
    fixture.detectChanges();
    return { fixture, authMock };
  }

  /** Resuelve las dos peticiones que dispara loadData(). */
  function flushData(negocios: Negocio[], tipos: TipoNegocio[]) {
    httpMock.expectOne(`${environment.apiUrl}/mis-negocios`)
      .flush({ success: true, data: negocios });
    httpMock.expectOne(`${environment.apiUrl}/tipos-negocio`)
      .flush({ success: true, data: tipos });
  }

  afterEach(() => {
    httpMock?.verify();
  });

  it('should show skeleton while loading', async () => {
    const { fixture } = await createComponent(buildUser());

    const skeletons = fixture.nativeElement.querySelectorAll('.skeleton-card');
    expect(skeletons.length).toBeGreaterThan(0);

    flushData([], []);
  });

  it('should list the active businesses with their type', async () => {
    const { fixture } = await createComponent(buildUser());
    flushData(NEGOCIOS_MOCK, TIPOS_MOCK);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.neg-card');
    expect(cards.length).toBe(2);

    const firstName = fixture.nativeElement.querySelector('.neg-card__name')?.textContent ?? '';
    expect(firstName).toContain('La Parrilla de Juan');

    const firstType = fixture.nativeElement.querySelector('.neg-card__type')?.textContent ?? '';
    expect(firstType.toLowerCase()).toContain('restaurante');
  });

  it('should show empty state when there are no businesses', async () => {
    const { fixture } = await createComponent(buildUser());
    flushData([], TIPOS_MOCK);
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('.dashboard__state');
    expect(empty).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.neg-card').length).toBe(0);
  });

  it('should show error state when the request fails', async () => {
    const { fixture } = await createComponent(buildUser());

    httpMock.expectOne(`${environment.apiUrl}/mis-negocios`)
      .error(new ErrorEvent('Network error'));
    httpMock.expectOne(`${environment.apiUrl}/tipos-negocio`)
      .flush({ success: true, data: [] });

    fixture.detectChanges();

    const errorState = fixture.nativeElement.querySelector('.dashboard__state--error');
    expect(errorState).toBeTruthy();
  });
});
