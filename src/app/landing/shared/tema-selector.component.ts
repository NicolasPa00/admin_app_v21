import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';

import { TemaLandingService } from './tema.service';

/**
 * El botón de la cabecera que cambia entre el modo claro y el oscuro.
 *
 * Es un interruptor (`aria-pressed`), no un enlace: dice qué va a pasar al pulsarlo, y el icono es
 * el del modo al que se pasa. Hereda el color del texto de la cabecera, así que sirve en las dos.
 */
@Component({
  selector: 'app-tema-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="tema"
      [attr.aria-pressed]="tema.oscuro()"
      [attr.aria-label]="tema.oscuro() ? 'Cambiar al modo claro' : 'Cambiar al modo oscuro'"
      [attr.title]="tema.oscuro() ? 'Modo claro' : 'Modo oscuro'"
      (click)="tema.alternar()"
    >
      <svg class="tema__icono tema__luna" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M20.2 14.6A8.2 8.2 0 0 1 9.4 3.8a.6.6 0 0 0-.8-.7A9.2 9.2 0 1 0 20.9 15.4a.6.6 0 0 0-.7-.8Z"
          fill="currentColor"
        />
      </svg>
      <svg class="tema__icono tema__sol" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4.2" fill="currentColor" />
        <g stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
          <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4 7 7M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
        </g>
      </svg>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .tema {
      position: relative;
      display: inline-grid;
      place-items: center;
      width: 44px; /* objetivo táctil */
      height: 44px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      transition:
        background 160ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    @media (hover: hover) and (pointer: fine) {
      .tema:hover {
        background: color-mix(in srgb, currentColor 12%, transparent);
      }
    }

    .tema:active {
      transform: scale(0.94);
    }

    .tema:focus-visible {
      outline: 3px solid currentColor;
      outline-offset: 2px;
    }

    /* Un icono sobre el otro: el del modo al que se pasa se queda, el otro se funde y gira un poco.
       Solo transform y opacity, y 200 ms: se pulsa pocas veces, pero se nota cuando está mal. */
    .tema__icono {
      grid-area: 1 / 1;
      width: 20px;
      height: 20px;
      transition:
        opacity 200ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .tema__sol {
      opacity: 0;
      transform: rotate(-60deg) scale(0.85);
    }

    .tema[aria-pressed='true'] .tema__luna {
      opacity: 0;
      transform: rotate(60deg) scale(0.85);
    }

    .tema[aria-pressed='true'] .tema__sol {
      opacity: 1;
      transform: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .tema,
      .tema__icono {
        transition: none;
      }
    }
  `,
})
export class TemaSelectorComponent {
  protected readonly tema = inject(TemaLandingService);

  constructor() {
    afterNextRender(() => this.tema.sincronizar());
  }
}
