import { Injectable, signal } from '@angular/core';

/**
 * El tema de la landing: claro por defecto, oscuro si quien visita lo pide.
 *
 * El estado real vive en `<html data-tema="oscuro">` y en `localStorage`, no aquí: el script de una
 * línea de `index.html` ya los dejó puestos antes del primer pintado, que es lo que evita el
 * parpadeo en claro. Este servicio solo lo refleja en una señal (para el botón) y lo cambia.
 *
 * Todo acceso al navegador va en try/catch: el almacenamiento puede estar bloqueado (ventana
 * privada, datos del sitio apagados) y la página tiene que seguir funcionando en el tema de la sesión.
 */
/** La misma clave que lee el script de `index.html`: si cambia aquí, cambia allí. */
const CLAVE = 'escalapp-tema';

@Injectable({ providedIn: 'root' })
export class TemaLandingService {
  private readonly _oscuro = signal(false);
  readonly oscuro = this._oscuro.asReadonly();

  /** Se llama una vez en el navegador, después de hidratar: lee lo que el script de `index.html` puso. */
  sincronizar(): void {
    if (typeof document === 'undefined') return;
    this._oscuro.set(document.documentElement.dataset['tema'] === 'oscuro');
    // Otra pestaña cambió el tema: esta lo sigue, para que el botón no muestre un estado que ya no es.
    window.addEventListener('storage', (e) => {
      if (e.key !== CLAVE) return;
      const oscuro = e.newValue === 'oscuro';
      this._oscuro.set(oscuro);
      if (oscuro) document.documentElement.dataset['tema'] = 'oscuro';
      else delete document.documentElement.dataset['tema'];
    });
  }

  alternar(): void {
    if (typeof document === 'undefined') return;
    const oscuro = !this._oscuro();
    this._oscuro.set(oscuro);
    if (oscuro) document.documentElement.dataset['tema'] = 'oscuro';
    else delete document.documentElement.dataset['tema'];
    try {
      localStorage.setItem(CLAVE, oscuro ? 'oscuro' : 'claro');
    } catch {
      /* Sin almacenamiento: el tema vale para esta visita y ya. */
    }
  }
}
