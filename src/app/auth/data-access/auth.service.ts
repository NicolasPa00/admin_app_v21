import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, tap, map, catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  User,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  ApiOkResponse,
  ProfileResponse,
  CheckEmailResponse,
} from '../models/auth.models';

/**
 * AuthService — gestiona autenticación, tokens y estado del usuario.
 *
 * SEGURIDAD:
 * - accessToken se almacena SOLO en memoria (signal privado).
 *   Nunca se guarda en localStorage por defecto.
 * - refreshToken se gestiona preferiblemente vía cookie HttpOnly
 *   (withCredentials: true en cada petición).
 *
 * ALTERNATIVA (si el backend no puede setear cookies HttpOnly):
 *   Ver README — se puede guardar refreshToken en localStorage,
 *   pero esto reduce la seguridad frente a XSS.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  /** URL base del API desde environment. */
  private readonly API = environment.apiUrl;

  // ===================== Estado reactivo =====================

  /** Usuario autenticado actual. */
  readonly currentUser = signal<User | null>(null);

  /** Access token en memoria (NUNCA en localStorage por defecto). */
  private readonly _accessToken = signal<string | null>(null);

  /** Derivado: ¿hay sesión activa? */
  readonly isAuthenticated = computed(
    () => !!this._accessToken() && !!this.currentUser(),
  );

  // ===================== Métodos públicos =====================

  /** Lectura del token para el interceptor (solo lectura). */
  getAccessToken(): string | null {
    return this._accessToken();
  }

  /**
   * Inicia sesión con email y contraseña.
   * Almacena accessToken en memoria, setea currentUser y navega a /dashboard.
   *
   * POST /api/v1/auth/login
   */
  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.API}/auth/login`, request)
      .pipe(
        tap((res) => {
          if (res.data) {
            this._accessToken.set(res.data.token);
            this.currentUser.set(res.data.usuario);
            this.persistUserMeta(res.data.usuario);
            this.router.navigate(['/admin/dashboard']);
          }
        }),
      );
  }

  /**
   * Registra un nuevo usuario.
   *
   * POST /api/v1/auth/register
   */
  /**
   * Crea un nuevo usuario.
   * POST /admin/usuarios — ruta protegida; el interceptor adjunta el token.
   */
  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.API}/usuarios`, request);
  }

  /**
   * Cierra sesión: limpia estado y redirige a login.
   */
  logout(): void {
    this._accessToken.set(null);
    this.currentUser.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('app_user_meta');
    }
    this.router.navigate(['/auth/login']);
  }

  /**
   * Solicita el envío de un código OTP de 6 dígitos al email registrado.
   * Siempre devuelve 200 (anti-enumeración).
   *
   * POST /admin/auth/forgot-password
   */
  requestForgotPassword(email: string): Observable<ForgotPasswordResponse> {
    const body: ForgotPasswordRequest = { email };
    return this.http.post<ForgotPasswordResponse>(
      `${this.API}/auth/forgot-password`,
      body,
    );
  }

  /**
   * Verifica el código OTP y actualiza la contraseña.
   *
   * POST /admin/auth/reset-password
   */
  resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Observable<ResetPasswordResponse> {
    const body: ResetPasswordRequest = { email, code, newPassword };
    return this.http.post<ResetPasswordResponse>(
      `${this.API}/auth/reset-password`,
      body,
    );
  }

  /**
   * Verifica el OTP sin consumirlo ni cambiar la contraseña (paso 1 del reset).
   * POST /admin/auth/verify-otp
   */
  verifyOtp(email: string, code: string): Observable<VerifyOtpResponse> {
    const body: VerifyOtpRequest = { email, code };
    return this.http.post<VerifyOtpResponse>(`${this.API}/auth/verify-otp`, body);
  }

  /**
   * Carga el perfil del usuario autenticado.
   * GET /admin/usuarios/perfil
   */
  loadProfile(): Observable<User> {
    return this.http
      .get<ProfileResponse>(`${this.API}/usuarios/perfil`)
      .pipe(
        map((res) => res.data!),
        tap((user) => this.currentUser.set(user)),
      );
  }

  /**
   * El backend actual no expone este endpoint.
   * Retorna disponible por defecto para no bloquear el formulario de registro.
   */
  checkEmailAvailability(_email: string): Observable<CheckEmailResponse> {
    return of({ available: true });
  }

  // ===================== Helpers privados =====================

  /**
   * Persiste metadatos NO sensibles del usuario en localStorage
   * para rehidratación de la UI al recargar (no tokens).
   */
  private persistUserMeta(user: User): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(
        'app_user_meta',
        JSON.stringify({
          id_usuario:      user.id_usuario,
          primer_nombre:  user.primer_nombre,
          primer_apellido: user.primer_apellido,
          email:           user.email,
          negocios:        user.negocios,
          roles_globales:  user.roles_globales,
        }),
      );
    }
  }
}
