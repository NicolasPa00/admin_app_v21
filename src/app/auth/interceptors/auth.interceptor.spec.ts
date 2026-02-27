import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptors,
  HttpClient,
} from '@angular/common/http';
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
 * Verifican:
 *  • Adjunta header Authorization cuando hay token.
 *  • No adjunta header para endpoints públicos de auth.
 *  • Intenta refresh en 401 y reintenta la petición original.
 */
describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;
  let authService: AuthService;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  const mockUser: User = {
    id: '1',
    name: 'Test',
    email: 'test@test.com',
    roles: ['admin'],
    tenantId: 't1',
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
    // Simular login para tener token
    authService
      .login({ email: 'test@test.com', password: '12345678' })
      .subscribe();
    httpTesting
      .expectOne('http://localhost:3000/api/v1/auth/login')
      .flush({
        accessToken: 'my-token',
        user: mockUser,
      } as LoginResponse);

    // Ahora hacer una petición protegida
    httpClient.get('/api/data').subscribe();
    const req = httpTesting.expectOne('/api/data');

    expect(req.request.headers.get('Authorization')).toBe(
      'Bearer my-token',
    );
    req.flush({});
  });

  it('no debería adjuntar header para endpoints públicos de auth', () => {
    httpClient
      .post('http://localhost:3000/api/v1/auth/login', {})
      .subscribe();

    const req = httpTesting.expectOne(
      'http://localhost:3000/api/v1/auth/login',
    );
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('debería intentar refresh al recibir 401', () => {
    // Simular login
    authService
      .login({ email: 'test@test.com', password: '12345678' })
      .subscribe();
    httpTesting
      .expectOne('http://localhost:3000/api/v1/auth/login')
      .flush({
        accessToken: 'old-token',
        user: mockUser,
      } as LoginResponse);

    // Petición protegida que recibe 401
    httpClient.get('/api/data').subscribe();
    const failedReq = httpTesting.expectOne('/api/data');
    failedReq.flush(null, { status: 401, statusText: 'Unauthorized' });

    // El interceptor debería intentar refresh
    const refreshReq = httpTesting.expectOne(
      'http://localhost:3000/api/v1/auth/refresh',
    );
    refreshReq.flush({ accessToken: 'new-token' });

    // Y reintentar la petición original con el nuevo token
    const retryReq = httpTesting.expectOne('/api/data');
    expect(retryReq.request.headers.get('Authorization')).toBe(
      'Bearer new-token',
    );
    retryReq.flush({ data: 'ok' });
  });

  it('no debería haber peticiones pendientes', () => {
    httpTesting.verify();
  });
});
