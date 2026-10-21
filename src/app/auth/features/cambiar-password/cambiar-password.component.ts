import { Component, inject, signal, computed } from '@angular/core';
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
 * CambiarPasswordComponent — Cambio obligatorio de la contraseña temporal.
 *
 * Quien entra con la contraseña que le puso el sistema (su cédula) llega aquí directo desde el
 * login, y el backend no le deja hacer nada más hasta cambiarla (403 DEBE_CAMBIAR_PASSWORD; ver
 * app_core/middleware/auth.js en admin_ws). Al guardarla, el backend devuelve un token nuevo y se
 * sigue al panel sin volver a iniciar sesión.
 */
@Component({
  selector: 'app-cambiar-password',
  standalone: true,
  imports: [LucideAngularModule],
  providers: [
    { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider({ Eye, EyeOff, Loader2 }) },
  ],
  templateUrl: './cambiar-password.component.html',
  // Mismas tarjetas que el resto de pantallas de acceso.
  styleUrl: '../reset-password/reset-password.component.scss',
})
export class CambiarPasswordComponent {
  private readonly authService = inject(AuthService);

  readonly nombre = computed(() => this.authService.currentUser()?.primer_nombre ?? '');

  readonly currentPassword = signal('');
  readonly newPassword     = signal('');
  readonly confirmPassword = signal('');

  readonly currentTouched = signal(false);
  readonly newTouched     = signal(false);
  readonly confirmTouched = signal(false);

  readonly loading      = signal(false);
  readonly serverError  = signal<string | null>(null);
  readonly showCurrent  = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirm  = signal(false);

  readonly currentError = computed(() =>
    this.currentPassword() ? null : 'Escribe la contraseña con la que entraste',
  );

  readonly newPasswordError = computed(() => {
    const val = this.newPassword();
    if (!val) return 'La nueva contraseña es obligatoria';
    if (val.length < 8) return 'Mínimo 8 caracteres';
    if (!/[A-Z]/.test(val)) return 'Debe contener al menos una mayúscula';
    if (!/\d/.test(val)) return 'Debe contener al menos un número';
    if (val === this.currentPassword()) return 'Tiene que ser distinta de la actual';
    return null;
  });

  readonly confirmPasswordError = computed(() => {
    const val = this.confirmPassword();
    if (!val) return 'Confirma tu contraseña';
    if (val !== this.newPassword()) return 'Las contraseñas no coinciden';
    return null;
  });

  readonly formValid = computed(
    () => !this.currentError() && !this.newPasswordError() && !this.confirmPasswordError(),
  );

  protected updateField(setter: (v: string) => void, event: Event): void {
    setter((event.target as HTMLInputElement).value);
  }

  protected onSubmit(): void {
    this.currentTouched.set(true);
    this.newTouched.set(true);
    this.confirmTouched.set(true);
    if (!this.formValid() || this.loading()) return;

    this.loading.set(true);
    this.serverError.set(null);
    this.authService
      .cambiarPasswordTemporal({ currentPassword: this.currentPassword(), newPassword: this.newPassword() })
      .subscribe({
        // La navegación al panel la hace AuthService.
        next: () => this.loading.set(false),
        error: (err) => {
          this.loading.set(false);
          this.serverError.set(err.error?.message ?? 'No se pudo cambiar la contraseña. Inténtalo de nuevo.');
        },
      });
  }

  protected salir(): void {
    this.authService.logout();
  }
}
