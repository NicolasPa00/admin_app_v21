import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { AssetService } from '../../../core/services/asset.service';

/** Una escena del panel izquierdo del login. */
interface Escena {
  id: 'pulpo' | 'whatsapp' | 'reservas' | 'cocina' | 'carta';
  /** Lo que dice la pestaña de abajo. */
  pestana: string;
  titulo: string;
  /** La segunda línea del titular, en lavanda. */
  acento: string;
  bajada: string;
  /** Cuánto se queda en pantalla. Lo mide la barra de la pestaña, no un temporizador. */
  duracionMs: number;
}

const ESCENAS: Escena[] = [
  {
    id: 'pulpo',
    pestana: 'EscalApp',
    titulo: 'Tu negocio entero,',
    acento: 'en una sola pantalla.',
    bajada: 'Pedidos, caja, inventario y tu WhatsApp, desde el computador o el celular.',
    duracionMs: 6000,
  },
  {
    id: 'whatsapp',
    pestana: 'WhatsApp',
    titulo: 'Tu WhatsApp',
    acento: 'contesta solo.',
    bajada: 'El asistente toma el pedido completo y lo deja en tu caja, también de madrugada.',
    duracionMs: 9500,
  },
  {
    id: 'reservas',
    pestana: 'Reservas',
    titulo: 'Tu barbería agenda',
    acento: 'mientras cortas.',
    bajada: 'El cliente reserva en tu página y el recordatorio le llega por WhatsApp.',
    duracionMs: 9000,
  },
  {
    id: 'cocina',
    pestana: 'Cocina',
    titulo: 'Directo a la cocina,',
    acento: 'sin papelitos.',
    bajada: 'La comanda llega a la pantalla de cocina y el cliente se entera cuando está listo.',
    duracionMs: 8500,
  },
  {
    id: 'carta',
    pestana: 'Carta IA',
    titulo: 'Tu carta, cargada',
    acento: 'con una foto.',
    bajada: 'Sube un PDF o una foto de tu carta y la IA la deja lista para vender.',
    duracionMs: 8500,
  },
];

/**
 * El panel izquierdo del login: un carrusel de escenas de lo que hace EscalApp.
 *
 * No hay `setInterval`: la barra de la pestaña activa es una animación CSS y, cuando termina
 * (`animationend`), se pasa a la siguiente. No se pausa con el ratón ni con el foco (el dueño lo
 * quiere siempre en marcha); con «reducir movimiento» la barra no corre y el carrusel no avanza
 * solo: se cambia con las pestañas. En el servidor no corre nada, así que el prerender sale con la
 * primera escena.
 */
@Component({
  selector: 'app-escenas-login',
  standalone: true,
  templateUrl: './escenas-login.component.html',
  styleUrl: './escenas-login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EscenasLoginComponent {
  protected readonly assetService = inject(AssetService);
  protected readonly escenas = ESCENAS;
  protected readonly activa = signal(0);

  protected ir(indice: number): void {
    this.activa.set(indice);
  }

  protected siguiente(): void {
    this.activa.update((i) => (i + 1) % ESCENAS.length);
  }

  /** Flechas izquierda/derecha entre pestañas, como pide el patrón de pestañas de ARIA. */
  protected mover(evento: KeyboardEvent, indice: number): void {
    const paso = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;
    if (!paso) return;
    evento.preventDefault();
    const destino = (indice + paso + ESCENAS.length) % ESCENAS.length;
    this.activa.set(destino);
    const lista = (evento.currentTarget as HTMLElement).parentElement;
    (lista?.children[destino] as HTMLElement | undefined)?.focus();
  }
}
