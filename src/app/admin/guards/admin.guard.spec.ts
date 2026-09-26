import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed }    from '@angular/core/testing';
import { Router }     from '@angular/router';
import { signal }     from '@angular/core';

import { adminGuard } from './admin.guard';
import { AuthService } from '../../auth/data-access/auth.service';
import { User }       from '../../auth/models/auth.models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id_usuario:      1,
    primer_nombre:   'Test',
    primer_apellido: 'User',
    email:           'test@test.com',
    negocios:        [],
    roles_globales:  [],
    ...overrides,
  };
}

function runGuard(
  authServiceMock: Partial<AuthService>,
  allowedRoles: string[] = [],
): boolean | unknown {
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: authServiceMock },
      { provide: Router, useValue: { navigate: vi.fn() } },
    ],
  });

  return TestBed.runInInjectionContext(() =>
    adminGuard(allowedRoles)({} as never, {} as never),
  );
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

describe('adminGuard', () => {
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    routerSpy = { navigate: vi.fn() };
  });

  // --- No autenticado ---

  it('should redirect to /auth/login when not authenticated', () => {
    const mock: Partial<AuthService> = {
      isAuthenticated: signal(false) as never,
      currentUser:     signal(null)  as never,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mock },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      adminGuard()({} as never, {} as never),
    );

    expect(result).toBe(false);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  // --- Super Administrador ---

  it('should allow SUPER ADMINISTRADOR unconditionally', () => {
    const user = buildUser({
      roles_globales: [{ id_rol: 1, descripcion: 'SUPER ADMINISTRADOR' }],
    });

    const mock: Partial<AuthService> = {
      isAuthenticated: signal(true) as never,
      currentUser:     signal(user) as never,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mock },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      adminGuard()({} as never, {} as never),
    );

    expect(result).toBe(true);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  // --- Rol permitido en negocio ---

  it('should allow user whose negocio role is in allowedRoles', () => {
    const user = buildUser({
      negocios: [
        {
          id_negocio: 1,
          nombre: 'Mi Restaurante',
          roles: [{ id_rol: 2, descripcion: 'ADMINISTRADOR RESTAURANTE' }],
        },
      ],
    });

    const mock: Partial<AuthService> = {
      isAuthenticated: signal(true) as never,
      currentUser:     signal(user) as never,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mock },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      adminGuard(['ADMINISTRADOR RESTAURANTE'])({} as never, {} as never),
    );

    expect(result).toBe(true);
  });

  // --- Sin rol adecuado ---

  it('should block user without matching role', () => {
    const user = buildUser({
      negocios: [
        {
          id_negocio: 1,
          nombre: 'Mi Barbería',
          roles: [{ id_rol: 6, descripcion: 'ADMINISTRADOR BARBERIA' }],
        },
      ],
    });

    const mock: Partial<AuthService> = {
      isAuthenticated: signal(true) as never,
      currentUser:     signal(user) as never,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mock },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      adminGuard(['ADMINISTRADOR RESTAURANTE'])({} as never, {} as never),
    );

    expect(result).toBe(false);
    // Con sesión pero sin permiso: al Inicio, no al login.
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('should keep a CAJERO out of the owner-only screens (WhatsApp, Facturación, Mis pagos)', () => {
    const user = buildUser({
      negocios: [{ id_negocio: 1, nombre: 'Mi Restaurante', roles: [{ id_rol: 3, descripcion: 'CAJERO' }] }],
    });
    const mock: Partial<AuthService> = {
      isAuthenticated: signal(true) as never,
      currentUser:     signal(user) as never,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mock },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      adminGuard(['ADMINISTRADOR'])({} as never, {} as never),
    );

    expect(result).toBe(false);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('should let an ADMINISTRADOR into the owner-only screens, ignoring case and spaces', () => {
    const user = buildUser({
      negocios: [{ id_negocio: 1, nombre: 'Mi Restaurante', roles: [{ id_rol: 2, descripcion: ' Administrador ' }] }],
    });
    const mock: Partial<AuthService> = {
      isAuthenticated: signal(true) as never,
      currentUser:     signal(user) as never,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mock },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      adminGuard(['ADMINISTRADOR'])({} as never, {} as never),
    );

    expect(result).toBe(true);
  });
});
