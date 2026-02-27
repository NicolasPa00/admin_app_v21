import {
  Component,
  inject,
  signal,
  computed,
  WritableSignal,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../data-access/auth.service';
import { ResetPasswordRequest } from '../../models/auth.models';

/**
 * ResetPasswordComponent — Permite establecer una nueva contraseña.
 *
 * Espera un query param `token` en la URL (ej: /auth/reset-password?token=abc123).
 * Este token es generado por el backend y enviado al email del usuario.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  // ===================== Signal Form Fields =====================

  readonly newPassword = signal('');
  readonly confirmPassword = signal('');

  /** Token extraído del query param. */
  readonly token = signal('');

  // ===================== State =====================

  readonly newPasswordTouched = signal(false);
  readonly confirmPasswordTouched = signal(false);

  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly success = signal(false);
  readonly showPassword = signal(false);

  // ===================== Validaciones =====================

  readonly newPasswordError = computed(() => {
    const val = this.newPassword();
    if (!val) return 'La nueva contraseña es obligatoria';
    if (val.length < 8) return 'Mínimo 8 caracteres';
    return null;
  });

  readonly confirmPasswordError = computed(() => {
    const val = this.confirmPassword();
    if (!val) return 'Confirma tu contraseña';
    if (val !== this.newPassword()) return 'Las contraseñas no coinciden';
    return null;
  });

  readonly formValid = computed(
    () =>
      !!this.token() &&
      !this.newPasswordError() &&
      !this.confirmPasswordError(),
  );

  // ===================== Lifecycle =====================

  ngOnInit(): void {
    // Leer el token de los query params
    const tokenParam =
      this.route.snapshot.queryParamMap.get('token') ?? '';
    this.token.set(tokenParam);
  }

  // ===================== Métodos =====================

  protected updateField(sig: WritableSignal<string>, event: Event): void {
    sig.set((event.target as HTMLInputElement).value);
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  protected onSubmit(): void {
    this.newPasswordTouched.set(true);
    this.confirmPasswordTouched.set(true);

    if (!this.formValid() || this.loading()) return;

    this.loading.set(true);
    this.serverError.set(null);
    this.success.set(false);

    const request: ResetPasswordRequest = {
      token: this.token(),
      newPassword: this.newPassword(),
    };

    this.authService.resetPassword(request).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.serverError.set(
          err.error?.message ??
            'No se pudo restablecer la contraseña. Inténtalo de nuevo.',
        );
      },
    });
  }
}
