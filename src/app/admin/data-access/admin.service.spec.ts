import { TestBed }             from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient }   from '@angular/common/http';

import { AdminService }        from './admin.service';
import { TipoNegocio, Rol }   from '../models/admin.models';
import { environment }         from '../../../environments/environment';

// ---------------------------------------------------------------------------
// Helpers — datos de prueba
// ---------------------------------------------------------------------------

const TIPOS_MOCK: TipoNegocio[] = [
  {
    id_tipo_negocio: 1,
    nombre: 'RESTAURANTE',
    descripcion: 'Negocio restaurante',
    estado: 'A',
    fecha_creacion: '2026-02-27T04:00:00',
    fecha_actualizacion: '2026-02-27T04:00:00',
  },
  {
    id_tipo_negocio: 2,
    nombre: 'PARQUEADERO',
    descripcion: 'Negocio parqueadero',
    estado: 'A',
    fecha_creacion: '2026-02-27T04:00:00',
    fecha_actualizacion: '2026-02-27T04:00:00',
  },
];

const ROLES_MOCK: Rol[] = [
  {
    id_rol: 1,
    descripcion: 'SUPER ADMINISTRADOR',
    estado: 'A',
    id_tipo_negocio: null,
    fecha_creacion: '2026-02-27T04:00:00',
    fecha_actualizacion: '2026-02-27T04:00:00',
  },
  {
    id_rol: 2,
    descripcion: 'ADMINISTRADOR RESTAURANTE',
    estado: 'A',
    id_tipo_negocio: 1,
    fecha_creacion: '2026-02-27T04:00:00',
    fecha_actualizacion: '2026-02-27T04:00:00',
  },
];

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdminService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service  = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // --- getTiposNegocio ---

  it('should fetch tipos de negocio via GET', () => {
    service.getTiposNegocio().subscribe((tipos) => {
      expect(tipos.length).toBe(2);
      expect(tipos[0].nombre).toBe('RESTAURANTE');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/tipos-negocio`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'OK', data: TIPOS_MOCK });
  });

  it('should return empty array when data is null/undefined', () => {
    service.getTiposNegocio().subscribe((tipos) => {
      expect(tipos).toEqual([]);
    });

    httpMock
      .expectOne(`${environment.apiUrl}/tipos-negocio`)
      .flush({ success: true, message: 'OK' });
  });

  // --- getRoles ---

  it('should fetch roles via GET', () => {
    service.getRoles().subscribe((roles) => {
      expect(roles.length).toBe(2);
      expect(roles[0].descripcion).toBe('SUPER ADMINISTRADOR');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/roles`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'OK', data: ROLES_MOCK });
  });

  // --- getTiposNegocioConRoles ---

  it('should merge roles into each tipo de negocio', () => {
    service.getTiposNegocioConRoles().subscribe((result) => {
      const restaurante = result.find((t) => t.id_tipo_negocio === 1)!;
      const parqueadero = result.find((t) => t.id_tipo_negocio === 2)!;

      expect(restaurante.roles.length).toBe(1);
      expect(restaurante.roles[0].descripcion).toBe('ADMINISTRADOR RESTAURANTE');
      expect(parqueadero.roles.length).toBe(0); // ningún rol en mock
    });

    // forkJoin dispara ambas peticiones en paralelo
    httpMock
      .expectOne(`${environment.apiUrl}/tipos-negocio`)
      .flush({ success: true, message: 'OK', data: TIPOS_MOCK });

    httpMock
      .expectOne(`${environment.apiUrl}/roles`)
      .flush({ success: true, message: 'OK', data: ROLES_MOCK });
  });
});
