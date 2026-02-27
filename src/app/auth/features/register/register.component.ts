import {
  Component,
  inject,
  signal,
  computed,
  WritableSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  LucideAngularModule,
  LucideIconProvider,
  LUCIDE_ICONS,
  Eye, EyeOff, Loader2,
} from 'lucide-angular';

import { AuthService } from '../../data-access/auth.service';
import { RegisterRequest } from '../../models/auth.models';

/**
 * RegisterComponent — Creación de cuenta de usuario.
 *
 * Campos alineados con la tabla `gener_usuario`:
 *   primer_nombre, segundo_nombre?, primer_apellido, segundo_apellido?,
 *   num_identificacion, telefono?, email, password, fecha_nacimiento?, id_rol
 *
 * Signal Forms: validaciones derivadas vía computed().
 * Incluye validación asíncrona de disponibilidad de email.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  providers: [
    { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider({ Eye, EyeOff, Loader2 }) },
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);

  // ===================== Signal Form Fields =====================

  readonly primerNombre      = signal('');
  readonly segundoNombre     = signal('');   // opcional
  readonly primerApellido    = signal('');
  readonly segundoApellido   = signal('');   // opcional
  readonly numIdentificacion = signal('');
  readonly telefono          = signal('');   // opcional
  readonly email             = signal('');
  readonly password          = signal('');
  readonly confirmPassword   = signal('');
  readonly fechaNacimiento   = signal('');   // opcional

  // ===================== Touched State =====================

  readonly primerNombreTouched      = signal(false);
  readonly primerApellidoTouched    = signal(false);
  readonly numIdentificacionTouched = signal(false);
  readonly emailTouched             = signal(false);
  readonly passwordTouched          = signal(false);
  readonly confirmPasswordTouched   = signal(false);

  // ===================== UI State =====================

  readonly loading     = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly showPassword = signal(false);

  // --- Async email check ---
  readonly checkingEmail  = signal(false);
  readonly emailAvailable = signal<boolean | null>(null);
  private emailCheckTimeout: ReturnType<typeof setTimeout> | null = null;

  // ===================== Validaciones (computed) =====================

  readonly primerNombreError = computed(() => {
    const val = this.primerNombre().trim();
    if (!val) return 'El primer nombre es obligatorio';
    if (val.length < 2) return 'Mínimo 2 caracteres';
    return null;
  });

  readonly primerApellidoError = computed(() => {
    const val = this.primerApellido().trim();
    if (!val) return 'El primer apellido es obligatorio';
    if (val.length < 2) return 'Mínimo 2 caracteres';
    return null;
  });

  readonly numIdentificacionError = computed(() => {
    const val = this.numIdentificacion().trim();
    if (!val) return 'El número de identificación es obligatorio';
    if (val.length < 5) return 'Mínimo 5 caracteres';
    return null;
  });

  readonly emailError = computed(() => {
    const val = this.email().trim();
    if (!val) return 'El email es obligatorio';
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val))
      return 'Formato de email inválido';
    return null;
  });

  /** Error combinado de email: validación local + disponibilidad async. */
  readonly emailFullError = computed(() => {
    const localErr = this.emailError();
    if (localErr) return localErr;
    if (this.emailAvailable() === false) return 'Este email ya está en uso';
    return null;
  });

  readonly passwordError = computed(() => {
    const val = this.password();
    if (!val) return 'La contraseña es obligatoria';
    if (val.length < 8) return 'Mínimo 8 caracteres';
    return null;
  });

  readonly confirmPasswordError = computed(() => {
    const val = this.confirmPassword();
    if (!val) return 'Confirma tu contraseña';
    if (val !== this.password()) return 'Las contraseñas no coinciden';
    return null;
  });

  readonly formValid = computed(
    () =>
      !this.primerNombreError() &&
      !this.primerApellidoError() &&
      !this.numIdentificacionError() &&
      !this.emailFullError() &&
      !this.passwordError() &&
      !this.confirmPasswordError() &&
      !this.checkingEmail(),
  );

  // ===================== Métodos =====================

  protected updateField(sig: WritableSignal<string>, event: Event): void {
    sig.set((event.target as HTMLInputElement).value);
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  /**
   * Al hacer blur en el campo de email, verifica disponibilidad
   * si la validación local pasa (debounce de 500ms).
   */
  protected onEmailBlur(): void {
    this.emailTouched.set(true);

    if (this.emailError()) {
      this.emailAvailable.set(null);
      return;
    }

    if (this.emailCheckTimeout) clearTimeout(this.emailCheckTimeout);
    this.emailCheckTimeout = setTimeout(() => this.checkEmail(), 500);
  }

  /** Llama al backend para verificar disponibilidad del email. */
  private async checkEmail(): Promise<void> {
    this.checkingEmail.set(true);
    try {
      const res = await firstValueFrom(
        this.authService.checkEmailAvailability(this.email().trim()),
      );
      this.emailAvailable.set(res.available);
    } catch {
      this.emailAvailable.set(null);
    } finally {
      this.checkingEmail.set(false);
    }
  }

  /** Enviar formulario de registro. */
  protected onSubmit(): void {
    this.primerNombreTouched.set(true);
    this.primerApellidoTouched.set(true);
    this.numIdentificacionTouched.set(true);
    this.emailTouched.set(true);
    this.passwordTouched.set(true);
    this.confirmPasswordTouched.set(true);

    if (!this.formValid() || this.loading()) return;

    this.loading.set(true);
    this.serverError.set(null);

    const request: RegisterRequest = {
      primer_nombre:   this.primerNombre().trim(),
      primer_apellido: this.primerApellido().trim(),
      num_identificacion: this.numIdentificacion().trim(),
      email:    this.email().trim(),
      password: this.password(),
      ...(this.segundoNombre().trim()   ? { segundo_nombre:   this.segundoNombre().trim() }   : {}),
      ...(this.segundoApellido().trim() ? { segundo_apellido: this.segundoApellido().trim() } : {}),
      ...(this.telefono().trim()        ? { telefono:         this.telefono().trim() }         : {}),
      ...(this.fechaNacimiento()        ? { fecha_nacimiento: this.fechaNacimiento() }         : {}),
    };

    this.authService.register(request).subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.serverError.set(
          err.error?.message ?? 'Error al crear la cuenta. Inténtalo de nuevo.',
        );
      },
    });
  }
}
