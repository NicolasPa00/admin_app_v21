import {
  Component,
  inject,
  signal,
  computed,
  WritableSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  LucideIconProvider,
  LUCIDE_ICONS,
  Eye, EyeOff, Sun, Moon, Loader2,
} from 'lucide-angular';

import { AuthService } from '../../data-access/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { LoginRequest } from '../../models/auth.models';

/**
 * LoginComponent — Página de inicio de sesión.
 *
 * Signal Forms: cada campo es un signal() con validaciones
 * derivadas vía computed(). Incluye toggle de tema (claro/oscuro).
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  providers: [
    { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider({ Eye, EyeOff, Sun, Moon, Loader2 }) },
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);

  // ===================== Signal Form Fields =====================

  readonly numIdentificacion = signal('');
  readonly password = signal('');

  // ===================== Touched State =====================

  readonly numIdentificacionTouched = signal(false);
  readonly passwordTouched = signal(false);

  // ===================== UI State =====================

  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly showPassword = signal(false);

  // ===================== Validaciones (computed) =====================

  readonly numIdentificacionError = computed(() => {
    const val = this.numIdentificacion().trim();
    if (!val) return 'El número de identificación es obligatorio';
    return null;
  });

  readonly passwordError = computed(() => {
    const val = this.password();
    if (!val) return 'La contraseña es obligatoria';
    if (val.length < 8) return 'Mínimo 8 caracteres';
    return null;
  });

  /** El formulario es válido cuando no hay errores en ningún campo. */
  readonly formValid = computed(
    () => !this.numIdentificacionError() && !this.passwordError(),
  );

  // ===================== Métodos =====================

  /** Actualiza un signal de campo desde un evento de input. */
  protected updateField(sig: WritableSignal<string>, event: Event): void {
    sig.set((event.target as HTMLInputElement).value);
  }

  /** Toggle de visibilidad de contraseña. */
  protected togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  /** Enviar formulario de login. */
  protected onSubmit(): void {
    // Marcar todos los campos como tocados para mostrar errores
    this.numIdentificacionTouched.set(true);
    this.passwordTouched.set(true);

    if (!this.formValid() || this.loading()) return;

    this.loading.set(true);
    this.serverError.set(null);

    const request: LoginRequest = {
      num_identificacion: this.numIdentificacion().trim(),
      password: this.password(),
    };

    this.authService.login(request).subscribe({
      next: () => {
        this.loading.set(false);
        // Navegación manejada por AuthService
      },
      error: (err) => {
        this.loading.set(false);
        this.serverError.set(
          err.error?.message ??
            'Error al iniciar sesión. Inténtalo de nuevo.',
        );
      },
    });
  }
}
