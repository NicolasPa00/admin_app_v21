import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { PlanDisponible } from '../../models/cobranza.models';
import {
  DOCUMENTOS_POR_TRAMO,
  OpcionPlan,
  Tramo,
  agruparPlanes,
  opcionInicial,
} from './agrupar-planes';

/**
 * Los planes de Mis pagos como los entiende el cliente: tres tarjetas y, donde aplica, un paquete
 * de facturación electrónica. Ver `agrupar-planes.ts` para el porqué del agrupado y del mapeo.
 *
 * Elegir tarjeta + paquete es marcar el `id_plan` de esa fila (`elegir` emite ese id), así que
 * quien lo usa no cambia: marcar, simular y guardar siguen trabajando con ids de plan.
 */
@Component({
  selector: 'app-selector-planes',
  standalone: true,
  templateUrl: './selector-planes.component.html',
  styleUrl: './selector-planes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorPlanesComponent {
  readonly planes = input.required<readonly PlanDisponible[]>();
  /** El plan que el negocio tiene hoy: se marca en su tarjeta con su paquete. */
  readonly idPlanActual = input<number | null>(null);
  /** El plan marcado en el panel mientras se decide. */
  readonly idPlanMarcado = input<number | null>(null);
  readonly deshabilitado = input(false);
  /** `contratar` = negocio sin plan: el botón dice «Elegir este plan». */
  readonly modo = input<'cambiar' | 'contratar'>('cambiar');
  /** El plan que se está contratando (bloquea y anima solo ese botón). */
  readonly ocupadoId = input<number | null>(null);

  readonly elegir = output<number>();

  protected readonly agrupado = computed(() => agruparPlanes(this.planes()));

  /**
   * El paquete que el cliente fue tocando en cada tarjeta, por si todavía no la ha elegido:
   * `null` = «Sin facturación», que es una elección y no la ausencia de una.
   */
  private readonly tramoLocal = signal<Record<string, Tramo | null>>({});

  protected opcionDe(familia: string): OpcionPlan {
    const tarjeta = this.agrupado().tarjetas.find((t) => t.id === familia)!;
    return opcionInicial(tarjeta, {
      idPlanMarcado: this.idPlanMarcado(),
      idPlanActual: this.idPlanActual(),
      tramoLocal: familia in this.tramoLocal() ? this.tramoLocal()[familia] : undefined,
    });
  }

  protected estaElegida(familia: string): boolean {
    const marcado = this.idPlanMarcado();
    return (
      marcado !== null &&
      (this.agrupado().tarjetas.find((t) => t.id === familia)?.opciones ?? []).some(
        (o) => o.plan.id_plan === marcado,
      )
    );
  }

  protected esActual(familia: string): boolean {
    const actual = this.idPlanActual();
    return (
      actual !== null &&
      (this.agrupado().tarjetas.find((t) => t.id === familia)?.opciones ?? []).some(
        (o) => o.plan.id_plan === actual,
      )
    );
  }

  protected etiquetaTramo(tramo: Tramo | null): string {
    return tramo === null ? 'Sin facturación' : `Paquete ${tramo}`;
  }

  protected documentos(tramo: Tramo): string {
    return DOCUMENTOS_POR_TRAMO[tramo];
  }

  /** Tocar un paquete lo recuerda en la tarjeta y, si el modo es cambiar, marca ese plan. */
  protected elegirTramo(familia: string, opcion: OpcionPlan): void {
    this.tramoLocal.update((m) => ({ ...m, [familia]: opcion.tramo }));
    if (this.modo() === 'cambiar') this.elegir.emit(opcion.plan.id_plan);
  }

  protected elegirTarjeta(familia: string): void {
    this.elegir.emit(this.opcionDe(familia).plan.id_plan);
  }

  protected dinero(valor: number, moneda: string): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: moneda || 'COP',
      maximumFractionDigits: 0,
    }).format(Number(valor ?? 0));
  }
}
