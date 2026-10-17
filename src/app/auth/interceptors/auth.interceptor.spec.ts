import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../data-access/auth.service';
import { LoginResponse, User } from '../models/auth.models';

/**
 * Tests unitarios para authInterceptor.
 *
 * Reescritos contra el interceptor real: no hay refresh de token (el JWT dura 24h, sin retry —
 * ver su propio comentario de cabecera), un 401 llama a `logout()` sin más, y las URLs públicas
 * son `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`. La versión anterior probaba
 * un flujo de refresh que nunca existió aquí.
 */
describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;
  let authService: AuthService;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  const API = 'http://localhost:3000/admin';

  const mockUser: User = {
    id_usuario: 1,
    primer_nombre: 'Test',
    primer_apellido: 'User',
    email: 'test@test.com',
    negocios: [],
    roles_globales: [],
  };

  const mockLoginResponse: LoginResponse = {
    success: true,
    message: 'ok',
    data: { token: 'my-token', usuario: mockUser },
  };

  beforeEach(() => {
    routerSpy = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  it('debería adjuntar Authorization header cuando hay token', () => {
    authService.login({ num_identificacion: '1', password: '12345678' }).subscribe();
    httpTesting.expectOne(`${API}/auth/login`).flush(mockLoginResponse);

    httpClient.get(`${API}/negocios`).subscribe();
    const req = httpTesting.expectOne(`${API}/negocios`);

    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush({});
  });

  it('no debería adjuntar header para /auth/login', () => {
    httpClient.post(`${API}/auth/login`, {}).subscribe();

    const req = httpTesting.expectOne(`${API}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('debería cerrar sesión (logout) al recibir un 401, sin reintentar', () => {
    authService.login({ num_identificacion: '1', password: '12345678' }).subscribe();
    httpTesting.expectOne(`${API}/auth/login`).flush(mockLoginResponse);

    httpClient.get(`${API}/negocios`).subscribe({
      error: (err) => expect(err.status).toBe(401),
    });
    const req = httpTesting.expectOne(`${API}/negocios`);
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authService.getAccessToken()).toBeNull();
    expect(authService.currentUser()).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);

    // Sin refresh: no debe quedar ninguna otra petición pendiente.
    httpTesting.verify();
  });

  // Zona Burger, 2026-10-16: vigilando a un cliente con «entrar como», cada hora la sesión
  // vencía y el 401 cerraba TODO, también la cuenta propia del super admin.
  describe('entrando como otro usuario', () => {
    const cliente = { ...mockUser, id_usuario: 2, primer_nombre: 'Cliente' };
    const no401 = { status: 401, statusText: 'Unauthorized' };

    function entrarComoCliente(): void {
      localStorage.clear();
      authService.login({ num_identificacion: '1', password: '12345678' }).subscribe();
      httpTesting.expectOne(`${API}/auth/login`).flush(mockLoginResponse);
      authService.impersonate(2).subscribe();
      httpTesting
        .expectOne(`${API}/auth/impersonar`)
        .flush({ success: true, message: 'ok', data: { token: 'tok-cliente', usuario: cliente } });
      expect(authService.isImpersonating()).toBe(true);
      routerSpy.navigate.mockClear();
    }

    it('EL CASO: si vence esa sesión, vuelve a la cuenta propia en vez de cerrarlo todo', () => {
      entrarComoCliente();
      httpClient.get(`${API}/negocios`).subscribe({ error: () => undefined });
      httpTesting.expectOne(`${API}/negocios`).flush(null, no401);

      expect(authService.getAccessToken()).toBe('my-token');
      expect(authService.isImpersonating()).toBe(false);
      expect(authService.currentUser()?.id_usuario).toBe(1);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
      expect(routerSpy.navigate).not.toHaveBeenCalledWith(['/auth/login']);
    });

    it('las respuestas que iban en vuelo con la sesión vieja no cierran la cuenta recuperada', () => {
      entrarComoCliente();
      httpClient.get(`${API}/a`).subscribe({ error: () => undefined });
      httpClient.get(`${API}/b`).subscribe({ error: () => undefined });
      httpTesting.expectOne(`${API}/a`).flush(null, no401);
      httpTesting.expectOne(`${API}/b`).flush(null, no401);

      expect(authService.getAccessToken()).toBe('my-token');
      expect(routerSpy.navigate).not.toHaveBeenCalledWith(['/auth/login']);
    });

    it('sin la cuenta propia guardada, cierra la sesión como siempre', () => {
      entrarComoCliente();
      localStorage.removeItem('admin_token');
      httpClient.get(`${API}/negocios`).subscribe({ error: () => undefined });
      httpTesting.expectOne(`${API}/negocios`).flush(null, no401);

      expect(authService.getAccessToken()).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    });
  });
});
