import {
  Injectable,
  signal,
  computed,
  inject,
  PLATFORM_ID,
  effect,
  DestroyRef,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

/**
 * Modos de tema soportados.
 * - 'light' / 'dark': elección explícita del usuario.
 * - 'system': sigue la preferencia del sistema operativo.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Clave usada en localStorage para persistir la preferencia. */
const STORAGE_KEY = 'app_theme';

/**
 * ThemeService — gestiona el tema de la aplicación (claro/oscuro/sistema).
 *
 * Funcionalidad:
 *  • Lee la preferencia guardada en localStorage, o cae en 'system'.
 *  • Si el modo es 'system', escucha cambios de prefers-color-scheme.
 *  • Aplica el atributo `data-theme` en <html> para activar tokens CSS.
 *  • Provee toggleTheme() y setTheme() para uso desde componentes.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  // --- Señales de estado ---

  /** Preferencia de tema elegida por el usuario. */
  readonly theme = signal<ThemeMode>('system');

  /** Preferencia detectada del sistema operativo. */
  private readonly systemPreference = signal<'light' | 'dark'>('light');

  /**
   * Tema resuelto final: si el usuario eligió 'system',
   * se usa la preferencia del SO; de lo contrario, la elección explícita.
   */
  readonly resolvedTheme = computed<'light' | 'dark'>(() => {
    const mode = this.theme();
    return mode === 'system' ? this.systemPreference() : mode;
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initTheme();

      // Efecto reactivo: cada vez que resolvedTheme cambia, actualiza el DOM.
      effect(() => {
        this.applyTheme(this.resolvedTheme());
      });
    }
  }

  // --- API pública ---

  /**
   * Inicializa el tema leyendo localStorage y la media query del SO.
   * Se invoca automáticamente en el constructor (solo browser).
   */
  initTheme(): void {
    // 1. Detectar preferencia del sistema
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemPreference.set(darkQuery.matches ? 'dark' : 'light');

    // Escuchar cambios del sistema
    const handler = (e: MediaQueryListEvent) => {
      this.systemPreference.set(e.matches ? 'dark' : 'light');
    };
    darkQuery.addEventListener('change', handler);

    // Limpiar listener al destruir el servicio (raro en root, pero buena práctica)
    this.destroyRef.onDestroy(() => {
      darkQuery.removeEventListener('change', handler);
    });

    // 2. Leer preferencia guardada
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      this.theme.set(stored);
    }
    // Si no hay valor guardado, se queda en 'system' (por defecto).
  }

  /** Alterna entre light ↔ dark (ignora 'system' al alternar). */
  toggleTheme(): void {
    const next = this.resolvedTheme() === 'light' ? 'dark' : 'light';
    this.setTheme(next);
  }

  /** Establece un modo explícito y lo persiste. */
  setTheme(mode: ThemeMode): void {
    this.theme.set(mode);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }

  /** ¿El usuario prefiere seguir el sistema? */
  prefersSystem(): boolean {
    return this.theme() === 'system';
  }

  // --- Helpers privados ---

  /** Aplica el atributo data-theme en <html>. */
  private applyTheme(resolved: 'light' | 'dark'): void {
    this.document.documentElement.setAttribute('data-theme', resolved);
  }
}
