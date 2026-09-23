import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Estado que pinta el punto de color de cada negocio. `neutro` = sin dato o sin importancia. */
export type EstadoNegocioSelector = 'ok' | 'aviso' | 'error' | 'neutro';

export interface NegocioSelector {
  id: number;
  nombre: string;
  estado?: EstadoNegocioSelector;
  /** Cuántas cosas esperan en ese negocio (cobros pendientes, conversaciones…). 0 o vacío = nada. */
  contador?: number;
  /** Lo que dice el punto, en palabras: tooltip y texto para lectores de pantalla. */
  titulo?: string;
}

/**
 * SelectorNegocioComponent — elegir de qué negocio se habla, en todas las pantallas del panel.
 *
 * Es el único formato para esto: antes cada sección tenía el suyo (un `<select>`, un `<select>`
 * más una pastilla de estado, chips…) y el mismo gesto se veía distinto según dónde se hiciera.
 * Un chip por negocio con su punto de estado; se desplazan en horizontal si no caben.
 *
 * Con uno o ningún negocio **no pinta nada**: no hay nada que elegir.
 *
 * Accesibilidad: patrón WAI-ARIA de tablist. Solo el chip activo entra en el orden del tabulador y
 * los demás se alcanzan con las flechas, Inicio y Fin (que además eligen, como en cualquier
 * tablist de activación automática). Si el contenido de debajo es un panel de cada negocio,
 * `conPanel` enlaza cada chip con `<idBase>-panel-<id>`; quien lo use es quien pone ese `id`.
 *
 * Solo tokens `--color-*`: la paleta es dinámica por inquilino.
 */
@Component({
  selector: 'app-selector-negocio',
  standalone: true,
  template: `
    @if (negocios().length > 1) {
      <div
        class="sn"
        role="tablist"
        [attr.aria-label]="etiqueta()"
        (keydown)="tecla($event)"
      >
        @for (n of negocios(); track n.id) {
          <button
            type="button"
            role="tab"
            class="sn__tab"
            [id]="idBase() + '-tab-' + n.id"
            [class.is-on]="n.id === seleccionado()"
            [attr.aria-selected]="n.id === seleccionado()"
            [attr.aria-controls]="conPanel() ? idBase() + '-panel-' + n.id : null"
            [attr.tabindex]="n.id === activoId() ? 0 : -1"
            [attr.title]="n.titulo ?? null"
            (click)="cambiar.emit(n.id)"
          >
            <span [class]="'sn__punto sn__punto--' + (n.estado ?? 'neutro')" aria-hidden="true"></span>
            <span class="sn__nombre">{{ n.nombre }}</span>
            @if (n.titulo) {
              <span class="sn__sr">, {{ n.titulo }}</span>
            }
            @if (n.contador) {
              <span class="sn__num" [attr.aria-label]="n.contador + ' pendientes'">{{ n.contador }}</span>
            }
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }

    /* Una fila que se desplaza en horizontal si hay muchos negocios. */
    .sn {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      padding-bottom: 0.25rem;
      scrollbar-width: thin;
      -webkit-overflow-scrolling: touch;
    }

    /* Alto fijo: otras pantallas (la bandeja) restan exactamente este alto de su propio tamaño. */
    .sn__tab {
      display: inline-flex;
      flex: none;
      align-items: center;
      box-sizing: border-box;
      gap: 0.5rem;
      min-height: 2.5rem;
      max-width: 16rem;
      padding: 0 0.9rem;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text-secondary);
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .sn__tab:hover:not(.is-on) {
      border-color: var(--color-primary);
      color: var(--color-text-primary);
    }
    .sn__tab:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }
    .sn__tab.is-on {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
      color: var(--color-primary);
    }

    .sn__nombre {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sn__punto {
      flex: none;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--color-text-muted);
    }
    .sn__punto--ok { background: var(--color-success); }
    .sn__punto--aviso { background: var(--color-warning); }
    .sn__punto--error { background: var(--color-error); }

    .sn__num {
      display: inline-grid;
      place-items: center;
      flex: none;
      min-width: 1.25rem;
      height: 1.25rem;
      padding: 0 0.3rem;
      border-radius: 999px;
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-size: 0.7rem;
    }

    /* Solo para lectores de pantalla: lo que el punto dice con color. */
    .sn__sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorNegocioComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly platformId = inject(PLATFORM_ID);

  readonly negocios = input.required<NegocioSelector[]>();
  readonly seleccionado = input<number | null>(null);
  /** Prefijo de los `id` de chips y paneles; cambiarlo si hay dos selectores en la misma página. */
  readonly idBase = input('selneg');
  /** El contenido de debajo es un panel por negocio (`<idBase>-panel-<id>`): enlazarlo. */
  readonly conPanel = input(false);
  readonly etiqueta = input('Tus negocios');

  readonly cambiar = output<number>();

  /** El único chip que entra en el orden del tabulador: el elegido, o el primero si no hay. */
  protected readonly activoId = computed(() => {
    const lista = this.negocios();
    return lista.find((n) => n.id === this.seleccionado())?.id ?? lista[0]?.id ?? null;
  });

  protected tecla(ev: KeyboardEvent): void {
    const lista = this.negocios();
    const actual = lista.findIndex((n) => n.id === this.activoId());
    if (actual < 0) return;

    let destino: number;
    switch (ev.key) {
      case 'ArrowRight':
        destino = (actual + 1) % lista.length;
        break;
      case 'ArrowLeft':
        destino = (actual - 1 + lista.length) % lista.length;
        break;
      case 'Home':
        destino = 0;
        break;
      case 'End':
        destino = lista.length - 1;
        break;
      default:
        return;
    }
    ev.preventDefault();
    this.cambiar.emit(lista[destino].id);
    if (isPlatformBrowser(this.platformId)) {
      (this.host.nativeElement as HTMLElement)
        .querySelector<HTMLElement>(`[id="${this.idBase()}-tab-${lista[destino].id}"]`)
        ?.focus();
    }
  }
}
