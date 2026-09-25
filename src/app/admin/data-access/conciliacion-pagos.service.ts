import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, isDevMode, signal, untracked } from '@angular/core';

import { AuthService } from '../../auth/data-access/auth.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ConciliacionPagos } from '../models/cobranza.models';
import { CobranzaService } from './cobranza.service';

/**
 * ConciliacionPagosService — que un pago aprobado en la pasarela termine aplicado aunque el
 * webhook no llegue y el cliente no vuelva del checkout.
 *
 * Cuándo pregunta al backend (`POST /cobranza/conciliar-pendientes`):
 *   - al iniciar sesión, al abrir la app con la sesión restaurada y al volver del SSO
 *     (`al_iniciar_sesion`): se dispara cuando la sesión pasa a estar autenticada;
 *   - al volver a la pestaña (`al_volver`, `visibilitychange` → visible), con debounce.
 *
 * En el 99 % de los casos no hay pagos pendientes y el backend responde al instante sin llamar a
 * ninguna pasarela. Si confirma alguno, se recarga la sesión (el aviso de plan vencido se
 * apaga) y se avisa con un mensaje.
 *
 * **Nunca estorba**: no bloquea el login, no muestra errores (si falla, en silencio; solo consola
 * en desarrollo) y solo corre en el navegador.
 */
@Injectable({ providedIn: 'root' })
export class ConciliacionPagosService {
  /** Espera tras el último `visibilitychange` antes de consultar (cambiar de pestaña a saltos). */
  static readonly DEBOUNCE_MS = 800;
  /** Al volver a la pestaña no se consulta más de una vez en este intervalo. */
  static readonly INTERVALO_MIN_MS = 15_000;

  private readonly api = inject(CobranzaService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly doc = inject(DOCUMENT);

  /** Sube cada vez que se confirma al menos un pago: pantallas como Mis pagos pueden reaccionar. */
  readonly pagosConfirmados = signal(0);

  private enCurso = false;
  private ultimaConsultaMs = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Sesión autenticada (login, retorno del SSO o sesión rehidratada al abrir la app).
    effect(() => {
      if (this.auth.isAuthenticated()) {
        untracked(() => this.conciliar('al_iniciar_sesion'));
      }
    });

    this.doc.addEventListener('visibilitychange', () => {
      if (this.doc.visibilityState === 'visible') this.programarAlVolver();
    });
  }

  /** Vuelve a la pestaña: consulta tras un pequeño debounce. */
  private programarAlVolver(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      this.conciliar('al_volver');
    }, ConciliacionPagosService.DEBOUNCE_MS);
  }

  /** Pregunta al backend y, si confirmó pagos, refresca la sesión y avisa. Nunca lanza. */
  conciliar(origen: 'al_iniciar_sesion' | 'al_volver'): void {
    if (!this.auth.isAuthenticated() || this.auth.isImpersonating() || this.enCurso) return;

    const ahora = Date.now();
    if (
      origen === 'al_volver' &&
      ahora - this.ultimaConsultaMs < ConciliacionPagosService.INTERVALO_MIN_MS
    ) {
      return;
    }
    this.ultimaConsultaMs = ahora;
    this.enCurso = true;

    this.api.conciliarPendientes(origen).subscribe({
      next: (r) => {
        this.enCurso = false;
        this.alResponder(r);
      },
      error: (err) => {
        this.enCurso = false;
        if (isDevMode()) console.debug('[conciliación de pagos] no se pudo consultar', err);
      },
    });
  }

  private alResponder(r: ConciliacionPagos | null): void {
    const aplicados = r?.aplicados ?? [];
    if (aplicados.length === 0) return;

    this.pagosConfirmados.update((n) => n + 1);
    this.auth.refrescarSesion().subscribe({
      next: (user) => {
        const idNegocio = aplicados[0].id_negocio;
        const fin = user.negocios?.find((n) => n.id_negocio === idNegocio)?.plan?.fecha_fin ?? null;
        this.toast.exito(this.mensaje(fin));
      },
      // Si no se pudo recargar el perfil, el pago igual se confirmó: se avisa sin fecha.
      error: () => this.toast.exito(this.mensaje(null)),
    });
  }

  private mensaje(fechaFin: string | null): string {
    if (!fechaFin) return 'Confirmamos tu pago: tu plan ya está activo.';
    const fecha = new Date(fechaFin).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Bogota',
    });
    return `Confirmamos tu pago: tu plan está activo hasta el ${fecha}.`;
  }
}
