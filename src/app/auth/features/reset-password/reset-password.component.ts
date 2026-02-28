import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  LucideIconProvider,
  LUCIDE_ICONS,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-angular';

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
  imports: [RouterLink, LucideAngularModule],
  providers: [
    { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider({ Eye, EyeOff, Loader2 }) },
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);

  // ===================== Paso actual (1 = código, 2 = contraseña) =====================

  readonly step = signal<1 | 2>(1);

  // ===================== Signal Form Fields =====================

  readonly email           = signal('');
  readonly code            = signal('');
  readonly newPassword     = signal('');
  readonly confirmPassword = signal('');

  // ===================== State =====================

  readonly emailTouched           = signal(false);
  readonly codeTouched            = signal(false);
  readonly newPasswordTouched     = signal(false);
  readonly confirmPasswordTouched = signal(false);

  readonly loading      = signal(false);
  readonly loadingStep1 = signal(false);
  readonly serverError  = signal<string | null>(null);
  readonly success      = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirm  = signal(false);

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
    if (!/^\d{6}$/.test(val)) return 'Debe tener exactamente 6 dígitos';
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

  readonly step1Valid = computed(() => !this.emailError() && !this.codeError());
  readonly step2Valid = computed(() => !this.newPasswordError() && !this.confirmPasswordError());

  // ===================== Lifecycle =====================

  ngOnInit(): void {
    const emailParam = this.route.snapshot.queryParamMap.get('email') ?? '';
    this.email.set(emailParam);
  }

  // ===================== Métodos =====================

  protected updateField(setter: (v: string) => void, event: Event): void {
    setter((event.target as HTMLInputElement).value);
  }

  protected onCodeInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value
      .replace(/\D/g, '')
      .slice(0, 6);
    this.code.set(raw);
    (event.target as HTMLInputElement).value = raw;
  }

  /** Verifica el OTP contra el backend; si OK avanza al paso 2. */
  protected nextStep(): void {
    this.emailTouched.set(true);
    this.codeTouched.set(true);
    this.serverError.set(null);
    if (!this.step1Valid() || this.loadingStep1()) return;

    this.loadingStep1.set(true);
    this.authService.verifyOtp(this.email().trim(), this.code().trim()).subscribe({
      next: () => {
        this.loadingStep1.set(false);
        this.step.set(2);
      },
      error: (err) => {
        this.loadingStep1.set(false);
        this.serverError.set(
          err.error?.message ?? 'Código inválido o expirado.',
        );
      },
    });
  }

  /** Regresa al paso 1 para corregir email o código. */
  protected prevStep(): void {
    this.step.set(1);
    this.serverError.set(null);
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.newPasswordTouched.set(false);
    this.confirmPasswordTouched.set(false);
  }

  protected onSubmit(): void {
    this.newPasswordTouched.set(true);
    this.confirmPasswordTouched.set(true);
    if (!this.step2Valid() || this.loading()) return;

    this.loading.set(true);
    this.serverError.set(null);

    this.authService
      .resetPassword(this.email().trim(), this.code().trim(), this.newPassword())
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set(true);
          setTimeout(() => this.router.navigate(['/auth/login']), 2500);
        },
        error: (err) => {
          this.loading.set(false);
          const msg: string =
            err.error?.message ?? 'No se pudo restablecer la contraseña. Inténtalo de nuevo.';
          this.serverError.set(msg);
          // Si el error es del código, regresar al paso 1
          if (/código|expirado|intentos/i.test(msg)) {
            this.step.set(1);
          }
        },
      });
  }
}

