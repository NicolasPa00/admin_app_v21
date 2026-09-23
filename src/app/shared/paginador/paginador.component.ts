import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * PaginadorComponent — pie de tabla compartido del panel.
 *
 * Es solo presentación: recibe `pagina` (1-based), `total` de filas y `tamano`, y emite la página
 * pedida y el tamaño elegido. Sirve igual para paginar en el cliente (cortar un array con
 * `paginar()`) o en el servidor (mandar limit/offset).
 */
@Component({
  selector: 'app-paginador',
  standalone: true,
  template: `
    @if (total() > 0) {
      <nav class="pag" aria-label="Paginación">
        <span class="pag__info">{{ desde() }}–{{ hasta() }} de {{ total() }}</span>

        <div class="pag__nums">
          <button type="button" class="pag__btn" [disabled]="pagina() <= 1"
                  (click)="cambiarPagina.emit(pagina() - 1)" aria-label="Página anterior">‹</button>
          @for (p of paginas(); track $index) {
            @if (p === null) {
              <span class="pag__gap">…</span>
            } @else {
              <button type="button" class="pag__btn" [class.pag__btn--on]="p === pagina()"
                      [attr.aria-current]="p === pagina() ? 'page' : null"
                      (click)="cambiarPagina.emit(p)">{{ p }}</button>
            }
          }
          <button type="button" class="pag__btn" [disabled]="pagina() >= totalPaginas()"
                  (click)="cambiarPagina.emit(pagina() + 1)" aria-label="Página siguiente">›</button>
        </div>

        @if (tamanos().length > 1) {
          <label class="pag__tam">
            <span>Filas</span>
            <select [value]="tamano()" (change)="elegirTamano($event)">
              @for (t of tamanos(); track t) {
                <option [value]="t" [selected]="t === tamano()">{{ t }}</option>
              }
            </select>
          </label>
        }
      </nav>
    }
  `,
  styles: `
    .pag {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
    }
    .pag__nums { display: flex; align-items: center; gap: 0.25rem; }
    .pag__btn {
      min-width: 2rem;
      height: 2rem;
      padding: 0 0.5rem;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text-primary);
      font: inherit;
      cursor: pointer;
    }
    .pag__btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
    .pag__btn:disabled { opacity: 0.4; cursor: default; }
    .pag__btn--on {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #fff;
      font-weight: 600;
    }
    .pag__btn--on:hover:not(:disabled) { color: #fff; }
    .pag__gap { padding: 0 0.25rem; }
    .pag__tam { display: flex; align-items: center; gap: 0.375rem; }
    .pag__tam select {
      height: 2rem;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text-primary);
      font: inherit;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginadorComponent {
  readonly pagina = input.required<number>();
  readonly total = input.required<number>();
  readonly tamano = input(10);
  readonly tamanos = input<number[]>([10, 25, 50]);

  readonly cambiarPagina = output<number>();
  readonly cambiarTamano = output<number>();

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.tamano())),
  );
  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * this.tamano() + 1,
  );
  protected readonly hasta = computed(() => Math.min(this.total(), this.pagina() * this.tamano()));

  /** Números visibles: primera, última y dos alrededor de la actual; `null` = hueco (…). */
  protected readonly paginas = computed<(number | null)[]>(() => {
    const n = this.totalPaginas();
    const p = this.pagina();
    const set = new Set([1, n, p - 1, p, p + 1].filter((x) => x >= 1 && x <= n));
    const orden = [...set].sort((a, b) => a - b);
    const out: (number | null)[] = [];
    orden.forEach((x, i) => {
      if (i > 0 && x - orden[i - 1] > 1) out.push(null);
      out.push(x);
    });
    return out;
  });

  protected elegirTamano(ev: Event): void {
    this.cambiarTamano.emit(Number((ev.target as HTMLSelectElement).value));
  }
}

/** Corta un array para paginación en el cliente. `pagina` es 1-based. */
export function paginar<T>(filas: readonly T[], pagina: number, tamano: number): T[] {
  const inicio = (pagina - 1) * tamano;
  return filas.slice(inicio, inicio + tamano);
}
