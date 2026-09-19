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
});
