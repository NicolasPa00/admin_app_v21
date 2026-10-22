import { Component, inject, signal, computed } from '@angular/core';
import { LucideAngularModule, LucideIconProvider, LUCIDE_ICONS, Loader2 } from 'lucide-angular';

import { AuthService } from '../../data-access/auth.service';
import { VERSION, VIGENTE_DESDE } from '../../../legal/legal-content';

/**
 * AceptarTerminosComponent — Aceptación de los Términos y la Política de tratamiento de datos.
 *
 * Aparece una vez por versión: cuando el usuario no ha aceptado la vigente (`VERSION` de
 * legal-content.ts, que el backend repite en app_core/helpers/aceptacionLegal.js). Al aceptar, el
 * backend guarda la constancia con versión, IP y navegador. Una aceptación que no se puede probar
 * no sirve, y la base está fuera de Colombia: la transferencia internacional exige autorización
 * expresa del titular (Ley 1581, art. 26), por eso se nombra en la casilla.
 */
@Component({
  selector: 'app-aceptar-terminos',
  standalone: true,
  imports: [LucideAngularModule],
  providers: [{ provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider({ Loader2 }) }],
  templateUrl: './aceptar-terminos.component.html',
  styleUrls: ['../reset-password/reset-password.component.scss', './aceptar-terminos.component.scss'],
})
export class AceptarTerminosComponent {
  private readonly authService = inject(AuthService);

  protected readonly version = VERSION;
  protected readonly vigenteDesde = VIGENTE_DESDE;
  readonly nombre = computed(() => this.authService.currentUser()?.primer_nombre ?? '');

  readonly acepto = signal(false);
  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);

  protected aceptar(): void {
    if (!this.acepto() || this.loading()) return;
    this.loading.set(true);
    this.serverError.set(null);
    this.authService.aceptarLegales().subscribe({
      next: () => this.loading.set(false),
      error: (err) => {
        this.loading.set(false);
        this.serverError.set(err.error?.message ?? 'No se pudo guardar tu aceptación. Inténtalo de nuevo.');
      },
    });
  }

  protected salir(): void {
    this.authService.logout();
  }
}
