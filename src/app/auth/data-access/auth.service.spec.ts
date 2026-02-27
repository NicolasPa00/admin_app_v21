import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import {
  LoginResponse,
  RegisterResponse,
  User,
} from '../models/auth.models';

/**
 * Tests unitarios para AuthService.
 *
 * Verifican:
 *  • login() almacena accessToken en memoria y setea currentUser.
 *  • logout() limpia estado y navega a /auth/login.
 *  • register() almacena token y usuario.
 *  • refreshAccessToken$() actualiza el token en memoria.
 *  • isAuthenticated se calcula correctamente.
 */
describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  const mockUser: User = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    roles: ['admin'],
    tenantId: 'restaurant-1',
  };

  const mockLoginResponse: LoginResponse = {
    accessToken: 'mock-access-token',
    user: mockUser,
  };

  beforeEach(() => {
    routerSpy = { navigate: vi.fn() };

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
    it('debería almacenar accessToken en memoria y setear currentUser', () => {
      service
        .login({ email: 'test@example.com', password: 'password123' })
        .subscribe();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/auth/login',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(req.request.withCredentials).toBe(true);

      req.flush(mockLoginResponse);

      expect(service.getAccessToken()).toBe('mock-access-token');
      expect(service.currentUser()).toEqual(mockUser);
      expect(service.isAuthenticated()).toBe(true);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('debería incluir tenantId cuando se proporciona', () => {
      service
        .login({
          email: 'test@example.com',
          password: 'password123',
          tenantId: 'restaurant-1',
        })
        .subscribe();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/auth/login',
      );
      expect(req.request.body.tenantId).toBe('restaurant-1');
      req.flush(mockLoginResponse);
    });
  });

  describe('logout()', () => {
    it('debería limpiar estado y navegar a /auth/login', () => {
      // Simular sesión activa
      service
        .login({ email: 'test@example.com', password: 'password123' })
        .subscribe();
      httpTesting
        .expectOne('http://localhost:3000/api/v1/auth/login')
        .flush(mockLoginResponse);

      service.logout();

      expect(service.currentUser()).toBeNull();
      expect(service.getAccessToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    });
  });

  describe('register()', () => {
    it('debería almacenar token y usuario tras registro', () => {
      const registerResponse: RegisterResponse = {
        user: mockUser,
        accessToken: 'new-access-token',
      };

      service
        .register({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          tenantId: 'restaurant-1',
        })
        .subscribe();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/auth/register',
      );
      expect(req.request.method).toBe('POST');
      req.flush(registerResponse);

      expect(service.getAccessToken()).toBe('new-access-token');
      expect(service.currentUser()).toEqual(mockUser);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  describe('refreshAccessToken$()', () => {
    it('debería actualizar el token en memoria', () => {
      service.refreshAccessToken$().subscribe((token) => {
        expect(token).toBe('refreshed-token');
      });

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/auth/refresh',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);

      req.flush({ accessToken: 'refreshed-token' });

      expect(service.getAccessToken()).toBe('refreshed-token');
    });

    it('debería hacer logout si el refresh falla', () => {
      service.refreshAccessToken$().subscribe({
        error: () => {
          expect(service.getAccessToken()).toBeNull();
          expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
        },
      });

      httpTesting
        .expectOne('http://localhost:3000/api/v1/auth/refresh')
        .flush(null, { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('requestForgotPassword()', () => {
    it('debería enviar la solicitud correctamente', () => {
      service
        .requestForgotPassword({ email: 'test@example.com' })
        .subscribe((res) => {
          expect(res.ok).toBe(true);
        });

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/auth/forgot-password',
      );
      expect(req.request.method).toBe('POST');
      req.flush({ ok: true });
    });
  });

  describe('resetPassword()', () => {
    it('debería enviar token y nueva contraseña', () => {
      service
        .resetPassword({ token: 'reset-token', newPassword: 'newPass123' })
        .subscribe((res) => {
          expect(res.ok).toBe(true);
        });

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/auth/reset-password',
      );
      expect(req.request.body).toEqual({
        token: 'reset-token',
        newPassword: 'newPass123',
      });
      req.flush({ ok: true });
    });
  });

  it('no debería haber peticiones pendientes', () => {
    httpTesting.verify();
  });
});
