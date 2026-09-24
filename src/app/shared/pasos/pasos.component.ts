import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LUCIDE_ICONS, LucideAngularModule, LucideIconProvider, Check } from 'lucide-angular';

/** Un paso del asistente. */
export interface Paso {
  id: string;
  etiqueta: string;
}

/**
 * PasosComponent — el indicador de pasos de los asistentes del admin.
 *
 * Es el mismo recorrido visual que «Adquirir plan» (`/adquirir`): círculos numerados, el paso
 * actual resaltado, los hechos con ✓, y en móvil el número arriba y el nombre debajo, unidos por
 * una línea que dice de un vistazo cuánto falta.
 *
 * ## Por qué no se reutilizan los estilos de `/adquirir` tal cual
 *
 * Aquellos usan los tokens de la landing (`--es-*`) y el admin tiene los suyos (`--color-*`): son
 * dos sistemas a propósito y no se mezclan. Esto es el mismo patrón, escrito una vez con los
 * tokens del admin (y con la paleta dinámica del inquilino), para que cualquier asistente del panel
 * lo use sin copiar CSS.
 */
@Component({
  selector: 'app-pasos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  viewProviders: [
    { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider({ Check }) },
  ],
  template: `
    <ol class="ps" [attr.aria-label]="etiqueta()">
      @for (p of pasos(); track p.id; let i = $index) {
        <li
          class="ps__paso"
          [class.ps__paso--activo]="i === indice()"
          [class.ps__paso--hecho]="i < indice()"
          [attr.aria-current]="i === indice() ? 'step' : null"
        >
          <span class="ps__num">
            @if (i < indice()) {
              <lucide-icon name="check" [size]="14" aria-hidden="true" />
            } @else {
              {{ i + 1 }}
            }
          </span>
          <span class="ps__txt">{{ p.etiqueta }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    .ps {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-xs) var(--spacing-lg);
      list-style: none;
      margin: 0 0 var(--spacing-md);
      padding: 0 0 var(--spacing-md);
      border-bottom: 1px solid var(--color-border);
    }

    .ps__paso {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-secondary);
    }

    .ps__num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
    }

    .ps__paso--activo { color: var(--color-text-primary); }
    .ps__paso--activo .ps__num {
      color: var(--color-on-primary);
      background: var(--color-primary);
      border-color: var(--color-primary);
    }

    .ps__paso--hecho { color: var(--color-success); }
    .ps__paso--hecho .ps__num {
      color: var(--color-on-primary);
      background: var(--color-success);
      border-color: var(--color-success);
    }

    /* Móvil: columnas iguales, número arriba y nombre debajo; la línea une los círculos. */
    @media (max-width: 600px) {
      .ps {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 0;
        padding-bottom: var(--spacing-sm);
      }

      .ps__paso {
        position: relative;
        flex-direction: column;
        gap: 6px;
        font-size: var(--font-size-xs);
        line-height: 1.2;
        text-align: center;
      }

      .ps__num { position: relative; z-index: 1; width: 26px; height: 26px; }

      .ps__paso:not(:first-child)::before {
        content: '';
        position: absolute;
        top: 12px;
        right: 50%;
        width: 100%;
        height: 2px;
        background: var(--color-border);
      }
      .ps__paso--activo:not(:first-child)::before,
      .ps__paso--hecho:not(:first-child)::before { background: var(--color-success); }
    }
  `,
})
export class PasosComponent {
  readonly pasos = input.required<readonly Paso[]>();
  /** Índice (base 0) del paso actual. */
  readonly indice = input.required<number>();
  readonly etiqueta = input('Pasos');
}
