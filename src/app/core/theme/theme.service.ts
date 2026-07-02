import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

/**
 * ThemeService — la aplicación usa un único tema claro (identidad EscalApp).
 * El modo oscuro fue retirado del producto; este servicio solo garantiza que
 * el atributo `data-theme` quede fijado en 'light' en <html>.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.document.documentElement.setAttribute('data-theme', 'light');
    }
  }
}
