import {
  Component,
  inject,
  signal,
  computed,
  WritableSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../data-access/auth.service';
import { ForgotPasswordRequest } from '../../models/auth.models';

/**
 * ForgotPasswordComponent — Solicita un email de recuperación de contraseña.
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

  // ===================== Signal Form Fields =====================

  readonly email = signal('');
  readonly tenantId = signal('');

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

  // ===================== Métodos =====================

  protected updateField(sig: WritableSignal<string>, event: Event): void {
    sig.set((event.target as HTMLInputElement).value);
  }

  protected onSubmit(): void {
    this.emailTouched.set(true);
    if (!this.formValid() || this.loading()) return;

    this.loading.set(true);
    this.serverError.set(null);
    this.success.set(false);

    const request: ForgotPasswordRequest = {
      email: this.email().trim(),
      ...(this.tenantId() ? { tenantId: this.tenantId() } : {}),
    };

    this.authService.requestForgotPassword(request).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.serverError.set(
          err.error?.message ??
            'No se pudo enviar el correo. Inténtalo de nuevo.',
        );
      },
    });
  }
}
