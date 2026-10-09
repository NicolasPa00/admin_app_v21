import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { LoginResponse, RegisterResponse, User } from '../models/auth.models';

/**
 * Tests unitarios para AuthService.
 *
 * Reescritos contra el contrato REAL del servicio (login por `num_identificacion`, respuesta
 * envuelta en `ApiResponse<{token, usuario}>`, `environment.apiUrl` = `http://localhost:3000/admin`).
 * La versión anterior probaba un servicio que nunca existió aquí — login por email a
 * `/api/v1/auth/login`, `refreshAccessToken$()`, `resetPassword({token, newPassword})` — deuda de
 * un scaffold que no se actualizó cuando se implementó el backend real.
 */
describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  const API = 'http://localhost:3000/admin';

  const mockUser: User = {
    id_usuario: 1,
    primer_nombre: 'Test',
    primer_apellido: 'User',
    email: 'test@example.com',
    negocios: [],
    roles_globales: [],
  };

  const mockLoginResponse: LoginResponse = {
    success: true,
    message: 'Login correcto',
    data: { token: 'mock-token', usuario: mockUser },
  };

  beforeEach(() => {
    routerSpy = { navigate: vi.fn() };
    // El constructor de AuthService rehidrata la sesión desde localStorage: sin limpiarlo, un
    // login exitoso de un test anterior se filtra al siguiente en cuanto se instancia el servicio.
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('debería crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debería iniciar sin usuario autenticado', () => {
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.getAccessToken()).toBeNull();
  });

  describe('login()', () => {
    it('debería almacenar el token en memoria, setear currentUser y navegar a /admin/dashboard', () => {
      service
        .login({ num_identificacion: '1000000001', password: 'Admin123*' })
        .subscribe();

      const req = httpTesting.expectOne(`${API}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        num_identificacion: '1000000001',
        password: 'Admin123*',
      });

      req.flush(mockLoginResponse);

      expect(service.getAccessToken()).toBe('mock-token');
      expect(service.currentUser()).toEqual(mockUser);
      expect(service.isAuthenticated()).toBe(true);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
    });

    it('no cambia el estado si la respuesta no trae `data`', () => {
      service.login({ num_identificacion: '1', password: 'x' }).subscribe();

      const req = httpTesting.expectOne(`${API}/auth/login`);
      req.flush({ success: false, message: 'Credenciales inválidas' });

      expect(service.getAccessToken()).toBeNull();
      expect(service.currentUser()).toBeNull();
    });
  });

  describe('logout()', () => {
    it('debería limpiar estado y navegar a /auth/login', () => {
      service
        .login({ num_identificacion: '1000000001', password: 'Admin123*' })
        .subscribe();
      httpTesting.expectOne(`${API}/auth/login`).flush(mockLoginResponse);

      service.logout();

      expect(service.currentUser()).toBeNull();
      expect(service.getAccessToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    });
  });

  describe('register()', () => {
    it('debería postear a /usuarios (ruta protegida, no /auth/register)', () => {
      const registerResponse: RegisterResponse = {
        success: true,
        message: 'Usuario creado',
        data: { id_usuario: 2 },
      };

      service
        .register({
          primer_nombre: 'Nueva',
          primer_apellido: 'Persona',
          num_identificacion: '999',
          email: 'nueva@example.com',
          password: 'Password123*',
        })
        .subscribe((res) => {
          expect(res.data?.id_usuario).toBe(2);
        });

      const req = httpTesting.expectOne(`${API}/usuarios`);
      expect(req.request.method).toBe('POST');
      req.flush(registerResponse);
    });
  });

  describe('requestForgotPassword()', () => {
    it('debería mandar el email en el cuerpo, a /auth/forgot-password', () => {
      service.requestForgotPassword('test@example.com').subscribe((res) => {
        expect(res.success).toBe(true);
      });

      const req = httpTesting.expectOne(`${API}/auth/forgot-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'test@example.com' });
      req.flush({ success: true, message: 'Código enviado si el correo existe' });
    });
  });

  describe('resetPassword()', () => {
    it('debería mandar email, code y newPassword — argumentos posicionales, no un objeto', () => {
      service.resetPassword('test@example.com', '123456', 'NuevaClave123*').subscribe((res) => {
        expect(res.success).toBe(true);
      });

      const req = httpTesting.expectOne(`${API}/auth/reset-password`);
      expect(req.request.body).toEqual({
        email: 'test@example.com',
        code: '123456',
        newPassword: 'NuevaClave123*',
      });
      req.flush({ success: true, message: 'Contraseña actualizada' });
    });
  });

  describe('loadProfile()', () => {
    it('debería setear currentUser con lo que devuelve GET /usuarios/perfil', () => {
      service.loadProfile().subscribe((user) => {
        expect(user).toEqual(mockUser);
      });

      const req = httpTesting.expectOne(`${API}/usuarios/perfil`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, message: 'ok', data: mockUser });

      expect(service.currentUser()).toEqual(mockUser);
    });
  });

  describe('getRubrosPublicos()', () => {
    it('debería devolver un arreglo vacío si la respuesta no trae `data`', () => {
      service.getRubrosPublicos().subscribe((rubros) => {
        expect(rubros).toEqual([]);
      });

      const req = httpTesting.expectOne(`${API}/rubros`);
      req.flush({ success: true, message: 'ok' });
    });
  });

  it('no debería haber peticiones pendientes', () => {
    httpTesting.verify();
  });
});

/**
 * El token y los datos guardados pueden ser de personas distintas, y en producción lo fueron.
 *
 * `negocio_app` se sirve del MISMO origen que esta app (escalapp.cloud/admin y /restaurante), así
 * que comparten un solo `localStorage`, y guarda su token bajo esta misma clave `app_token`.
 * Entrar a la app de restaurante y volver aquí dejaba el token de una persona junto a los datos
 * guardados de otra: la consola arrancaba enseñando una identidad que no correspondía al token
 * con el que iba a hablar con el backend.
 *
 * El caso simétrico —el de `negocio_app`— dejó 1.705 peticiones al negocio equivocado en la
 * auditoría del backend (módulo `authz`, 2026-10-04).
 */
describe('AuthService — token y datos guardados de personas distintas', () => {
  /** Un JWT con la forma que emite el backend: `{ id_usuario }` en el cuerpo. */
  function jwtDe(idUsuario: number): string {
    const b64 = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ id_usuario: idUsuario })}.firma`;
  }

  const meta = (idUsuario: number): User => ({
    id_usuario: idUsuario,
    primer_nombre: 'Quien',
    primer_apellido: 'Sea',
    email: 'quien@demo.co',
    negocios: [],
    roles_globales: [],
  });

  function recargar() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    return TestBed.inject(AuthService);
  }

  beforeEach(() => localStorage.clear());

  it('descarta los datos ajenos en vez de arrancar con la identidad de otro', () => {
    localStorage.setItem('app_token', jwtDe(36));
    localStorage.setItem('app_user_meta', JSON.stringify(meta(19)));

    const auth = recargar();

    expect(auth.currentUser()).toBeNull();
    expect(localStorage.getItem('app_user_meta')).toBeNull();
  });

  it('un token ilegible tampoco restaura: ante la duda, no se adivina', () => {
    localStorage.setItem('app_token', 'esto-no-es-un-jwt');
    localStorage.setItem('app_user_meta', JSON.stringify(meta(19)));

    expect(recargar().currentUser()).toBeNull();
  });

  it('cuando sí corresponden, la sesión se restaura', () => {
    localStorage.setItem('app_token', jwtDe(19));
    localStorage.setItem('app_user_meta', JSON.stringify(meta(19)));

    const auth = recargar();

    expect(auth.currentUser()?.id_usuario).toBe(19);
    expect(auth.isAuthenticated()).toBe(true);
  });
});
