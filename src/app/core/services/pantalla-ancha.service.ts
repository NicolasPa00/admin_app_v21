import { Injectable, computed, signal } from '@angular/core';

/**
 * PantallaAnchaService — una pantalla avisa al layout de que necesita todo el ancho.
 *
 * Las Conversaciones son dos paneles (lista e hilo) y con el menú lateral abierto la columna del
 * chat se queda sin sitio. Antes el layout lo decidía mirando la URL (`/admin/whatsapp`), pero esa
 * ruta también muestra la vista de conexión del número, que es una pantalla normal: el menú se
 * colapsaba sin motivo. Ahora lo pide quien lo necesita, mientras lo necesita, y el layout solo
 * obedece.
 *
 * Es un contador y no un booleano: al cambiar de negocio la bandeja se recrea, y el nuevo
 * componente puede pedir el ancho antes de que el viejo lo suelte. Con un booleano ese orden
 * dejaba el menú abierto.
 */
@Injectable({ providedIn: 'root' })
export class PantallaAnchaService {
  private readonly pedidos = signal(0);

  /** ¿Hay alguna pantalla pidiendo el ancho completo? */
  readonly pide = computed(() => this.pedidos() > 0);

  /** Llamar al mostrarse la pantalla; cada llamada debe tener su `soltar()`. */
  pedir(): void {
    this.pedidos.update((n) => n + 1);
  }

  soltar(): void {
    this.pedidos.update((n) => Math.max(0, n - 1));
  }
}
