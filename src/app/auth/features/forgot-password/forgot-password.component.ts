import {
  Component,
  inject,
  signal,
  computed,
  WritableSignal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../data-access/auth.service';

/**
 * ForgotPasswordComponent — Solicita el envío de un código OTP de 6 dígitos.
 *
 * Flujo:
 *  1. Usuario ingresa su email y envía el formulario.
 *  2. El backend genera un OTP, lo hashea y lo envía al email registrado.
 *  3. Siempre responde 200 (anti-enumeración).
 *  4. En estado `success` se muestra guía de instrucciones y enlace a
 *     /auth/reset-password?email=<email> para ingresar el código.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // ===================== Signal Form Fields =====================

  readonly email = signal('');

  // ===================== State =====================

  readonly emailTouched = signal(false);
  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly success = signal(false);

  // ===================== Validaciones =====================

  readonly emailError = computed(() => {
    const val = this.email().trim();
    if (!val) return 'El email es obligatorio';
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val))
      return 'Formato de email inválido';
    return null;
  });

  readonly formValid = computed(() => !this.emailError());

  /** URL para el botón "Ingresar código" — lleva el email como query param. */
  readonly resetUrl = computed(() =>
    `/auth/reset-password?email=${encodeURIComponent(this.email().trim())}`,
  );

  // ===================== Métodos =====================

  protected updateEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  protected onSubmit(): void {
    this.emailTouched.set(true);
    if (!this.formValid() || this.loading()) return;

    this.loading.set(true);
    this.serverError.set(null);
    this.success.set(false);

    this.authService.requestForgotPassword(this.email().trim()).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        // El backend siempre devuelve 200; este bloque solo captura
        // errores de red o validación (400).
        this.serverError.set(
          err.error?.message ??
            'No se pudo procesar la solicitud. Inténtalo de nuevo.',
        );
      },
    });
  }

  protected goToReset(): void {
    this.router.navigate(['/auth/reset-password'], {
      queryParams: { email: this.email().trim() },
    });
  }
}

