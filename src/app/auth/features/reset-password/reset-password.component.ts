import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../data-access/auth.service';

/**
 * ResetPasswordComponent — Verifica el código OTP y actualiza la contraseña.
 *
 * Flujo:
 *  1. Lee el query param `email` (inyectado por ForgotPasswordComponent).
 *  2. Usuario ingresa el código OTP de 6 dígitos recibido por correo.
 *  3. Usuario ingresa y confirma la nueva contraseña.
 *  4. POST /admin/auth/reset-password → 200 OK → redirect a /auth/login.
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
  private readonly router = inject(Router);

  // ===================== Signal Form Fields =====================

  /** Email precargado desde query param. */
  readonly email = signal('');
  readonly code = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');

  // ===================== State =====================

  readonly emailTouched = signal(false);
  readonly codeTouched = signal(false);
  readonly newPasswordTouched = signal(false);
  readonly confirmPasswordTouched = signal(false);

  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly success = signal(false);
  readonly showPassword = signal(false);

  // ===================== Validaciones =====================

  readonly emailError = computed(() => {
    const val = this.email().trim();
    if (!val) return 'El email es obligatorio';
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val))
      return 'Formato de email inválido';
    return null;
  });

  readonly codeError = computed(() => {
    const val = this.code().trim();
    if (!val) return 'El código es obligatorio';
    if (!/^\d{6}$/.test(val)) return 'El código debe tener exactamente 6 dígitos';
    return null;
  });

  readonly newPasswordError = computed(() => {
    const val = this.newPassword();
    if (!val) return 'La nueva contraseña es obligatoria';
    if (val.length < 8) return 'Mínimo 8 caracteres';
    if (!/[A-Z]/.test(val)) return 'Debe contener al menos una mayúscula';
    if (!/\d/.test(val)) return 'Debe contener al menos un número';
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
      !this.emailError() &&
      !this.codeError() &&
      !this.newPasswordError() &&
      !this.confirmPasswordError(),
  );

  // ===================== Lifecycle =====================

  ngOnInit(): void {
    const emailParam = this.route.snapshot.queryParamMap.get('email') ?? '';
    this.email.set(emailParam);
  }

  // ===================== Métodos =====================

  protected updateField(setter: (v: string) => void, event: Event): void {
    setter((event.target as HTMLInputElement).value);
  }

  /** Limita la entrada del código a sólo dígitos (máx 6). */
  protected onCodeInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value
      .replace(/\D/g, '')
      .slice(0, 6);
    this.code.set(raw);
    (event.target as HTMLInputElement).value = raw;
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  protected onSubmit(): void {
    this.emailTouched.set(true);
    this.codeTouched.set(true);
    this.newPasswordTouched.set(true);
    this.confirmPasswordTouched.set(true);

    if (!this.formValid() || this.loading()) return;

    this.loading.set(true);
    this.serverError.set(null);

    this.authService
      .resetPassword(this.email().trim(), this.code().trim(), this.newPassword())
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set(true);
          // Redirige al login después de 2.5 s
          setTimeout(() => this.router.navigate(['/auth/login']), 2500);
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

