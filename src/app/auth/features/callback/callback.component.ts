import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../data-access/auth.service';

/**
 * CallbackComponent — vuelta al panel desde una app de negocio.
 *
 * Es el espejo de `entrarAlNegocio()` del dashboard. La app vertical (negocio_app,
 * reserva_app…) le pide al backend un código de un solo uso con su propio token y trae al
 * usuario a `/auth/callback?code=<uuid>`; aquí se canjea por la sesión del panel.
 *
 * Hace falta un intermediario y no basta con navegar a `/admin/dashboard` porque cada app vive
 * en su propio origen: el `localStorage` donde la otra guardó la sesión no se ve desde aquí.
 * El código caduca a los 30 s, así que un enlace guardado o una vuelta muy tardía enseñan el
 * error con un camino de salida en vez de dejar la pantalla colgada.
 */
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <div class="callback">
      @if (error(); as mensaje) {
        <div class="callback__card">
          <span class="callback__icon" aria-hidden="true">!</span>
          <h2>No pudimos devolverte al panel</h2>
          <p>{{ mensaje }}</p>
          <button type="button" class="callback__btn" (click)="irALogin()">
            Iniciar sesión
          </button>
        </div>
      } @else {
        <div class="callback__card">
          <div class="callback__spinner" aria-hidden="true"></div>
          <p>Volviendo a tu panel…</p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .callback {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: var(--color-bg, #f5f5f5);
      }
      .callback__card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        width: 100%;
        max-width: 360px;
        padding: 2.5rem 2rem;
        text-align: center;
        border-radius: var(--radius-lg, 1rem);
        background: var(--color-surface, #fff);
        box-shadow: var(--shadow-lg, 0 2px 8px rgb(0 0 0 / 8%));
      }
      .callback__card h2 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--color-text-primary, #111827);
      }
      .callback__card p {
        margin: 0;
        font-size: 0.9rem;
        color: var(--color-text-secondary, #6b7280);
      }
      .callback__icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--color-danger, #ef4444);
        color: #fff;
        font-size: 1.25rem;
        font-weight: 700;
      }
      .callback__spinner {
        width: 40px;
        height: 40px;
        border: 4px solid var(--color-border, #e5e7eb);
        border-top-color: var(--color-primary, #312e81);
        border-radius: 50%;
        animation: callback-spin 0.8s linear infinite;
      }
      .callback__btn {
        padding: 0.55rem 1rem;
        border: 0;
        border-radius: var(--radius-md, 0.5rem);
        background: var(--color-primary, #312e81);
        color: var(--color-on-primary, #fff);
        font-weight: 600;
        cursor: pointer;
      }
      @keyframes callback-spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .callback__spinner {
          animation-duration: 3s;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const code = this.route.snapshot.queryParamMap.get('code');
    if (!code) {
      this.error.set('No se recibió un código de acceso válido.');
      return;
    }

    this.authService.canjearCodigo(code).subscribe({
      next: (res) => {
        if (res?.data?.token) {
          void this.router.navigateByUrl(this.destino(), { replaceUrl: true });
        } else {
          this.error.set('El código de acceso ya no es válido. Vuelve a iniciar sesión.');
        }
      },
      error: () => {
        this.error.set('El código caducó o ya se usó. Vuelve a iniciar sesión.');
      },
    });
  }

  protected irALogin(): void {
    void this.router.navigate(['/auth/login'], { replaceUrl: true });
  }

  /**
   * A dónde entra el usuario tras canjear el código.
   *
   * Por defecto al panel, pero la app que lo manda puede pedir una pantalla concreta —«vengo a
   * gestionar mi plan»— con `?destino=`. Solo se aceptan rutas internas: un `destino` con host
   * («//otro.com») convertiría este callback en un redirector abierto, que es exactamente lo que
   * usan los correos de phishing para colgarse de un dominio con buena fama.
   */
  private destino(): string {
    const pedido = this.route.snapshot.queryParamMap.get('destino') ?? '';
    const esInterna = /^\/[^/\\]/.test(pedido);
    return esInterna ? pedido : '/admin/dashboard';
  }
}
