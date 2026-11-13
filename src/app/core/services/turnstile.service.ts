import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * CAPTCHA del registro público (Cloudflare Turnstile), pedido justo antes de crear la cuenta.
 *
 * Por qué: el 2026-11-08 una misma persona abrió dos pruebas con cédulas distintas (auditoría
 * 2026-11-09). El backend lo verifica en `/auth/registro/prueba/verificar`
 * (`admin_ws/app_core/middleware/captcha.js`).
 *
 * - Sin `environment.turnstileSiteKey` no carga nada y devuelve `null`: se puede desplegar antes
 *   de tener la cuenta de Cloudflare.
 * - Modo `interaction-only`: casi siempre es invisible. Solo si Cloudflare duda aparece la casilla,
 *   fija abajo y por encima del modal.
 * - Si algo falla devuelve `null` y el registro sigue: es el backend el que decide si un registro
 *   sin token pasa (`TURNSTILE_OBLIGATORIO`). Nunca dejamos a alguien sin poder registrarse
 *   porque un script de terceros no cargó.
 */
interface TurnstileApi {
  render(contenedor: HTMLElement, opciones: Record<string, unknown>): string;
  remove(id: string): void;
}

const URL_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const ESPERA_MAX_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class TurnstileService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private script: Promise<TurnstileApi | null> | null = null;

  private get activo(): boolean {
    return isPlatformBrowser(this.platformId) && !!environment.turnstileSiteKey;
  }

  /** Token de un solo uso para el backend, o `null` si el CAPTCHA está apagado o falló. */
  async obtenerToken(): Promise<string | null> {
    if (!this.activo) return null;
    const api = await this.cargar();
    if (!api) return null;

    const contenedor = this.contenedor();
    return new Promise<string | null>((resolve) => {
      let id: string | null = null;
      let terminado = false;
      const fin = (token: string | null) => {
        if (terminado) return;
        terminado = true;
        clearTimeout(reloj);
        contenedor.hidden = true;
        if (id !== null) {
          try {
            api.remove(id);
          } catch {
            /* ya no existe */
          }
        }
        resolve(token);
      };
      const reloj = setTimeout(() => fin(null), ESPERA_MAX_MS);
      contenedor.hidden = false;
      try {
        id = api.render(contenedor, {
          sitekey: environment.turnstileSiteKey,
          appearance: 'interaction-only',
          language: 'es',
          callback: (token: string) => fin(token),
          'error-callback': () => fin(null),
          'timeout-callback': () => fin(null),
        });
      } catch {
        fin(null);
      }
    });
  }

  private cargar(): Promise<TurnstileApi | null> {
    if (this.script) return this.script;
    const win = this.document.defaultView as (Window & { turnstile?: TurnstileApi }) | null;
    this.script = new Promise<TurnstileApi | null>((resolve) => {
      if (win?.turnstile) return resolve(win.turnstile);
      const s = this.document.createElement('script');
      s.src = URL_SCRIPT;
      s.async = true;
      s.onload = () => resolve(win?.turnstile ?? null);
      s.onerror = () => {
        this.script = null; // reintentar en el próximo registro
        resolve(null);
      };
      this.document.head.appendChild(s);
    });
    return this.script;
  }

  private contenedor(): HTMLElement {
    const ID = 'escalapp-turnstile';
    let el = this.document.getElementById(ID);
    if (!el) {
      el = this.document.createElement('div');
      el.id = ID;
      el.hidden = true;
      el.setAttribute(
        'style',
        'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10000',
      );
      this.document.body.appendChild(el);
    }
    return el;
  }
}
