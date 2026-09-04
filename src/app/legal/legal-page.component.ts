import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { AssetService } from '../core/services/asset.service';
import {
  BORRADOR,
  DOCUMENTOS,
  DocumentoLegal,
  RUTAS_LEGALES,
  VERSION,
  VIGENTE_DESDE,
} from './legal-content';

/**
 * LegalPageComponent — muestra los documentos legales públicos.
 *
 * Un solo componente para los tres documentos (`/terminos`, `/privacidad` y
 * `/eliminacion-datos`): son la misma página con distinto contenido, y tener componentes casi
 * idénticos garantiza que uno se quede atrás en cuanto haya que cambiar algo del diseño.
 *
 * ## Público de verdad
 *
 * Estas rutas **no llevan guardia**. Un titular de datos que quiere ejercer sus derechos no tiene
 * por qué tener cuenta, y una política de privacidad que exige iniciar sesión para leerla no
 * cumple su función. Se prerenderizan como el resto de rutas estáticas, así que se sirven sin
 * pasar por el backend.
 *
 * ## El aviso de borrador
 *
 * Mientras `BORRADOR` sea `true`, la página lo dice arriba y sin disimulo. Publicar un texto legal
 * sin revisar como si fuera definitivo es peor que no publicarlo: sería vinculante. Cuando el
 * abogado lo apruebe se pone en `false` y el aviso desaparece.
 *
 * ## El contenido va por innerHTML, y por qué es seguro
 *
 * El HTML sale de `legal-content.ts`, un archivo nuestro que se compila con la aplicación: no hay
 * entrada de usuario en ningún punto. Aun así pasa por el sanitizador de Angular, que descarta
 * scripts y atributos peligrosos.
 */
@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalPageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly assetService = inject(AssetService);

  protected readonly borrador = BORRADOR;
  protected readonly version = VERSION;
  protected readonly vigenteDesde = VIGENTE_DESDE;
  protected readonly anio = new Date().getFullYear();

  /** Qué documento toca. Llega por `data.documento` desde la definición de la ruta. */
  private readonly clave = toSignal(
    this.route.data.pipe(map((d) => (d['documento'] as string) ?? 'terminos')),
    { initialValue: 'terminos' },
  );

  protected readonly doc = computed<DocumentoLegal>(
    () => DOCUMENTOS[this.clave()] ?? DOCUMENTOS['terminos'],
  );

  /**
   * Los demás documentos, para saltar de uno a otro sin volver a la landing.
   *
   * Era un solo «el otro» mientras hubo dos documentos. Con el de eliminación de datos pasaron a
   * ser tres, y una condición ternaria con tres ramas es la forma de que el cuarto se olvide: la
   * lista sale de `RUTAS_LEGALES`, así que añadir un documento no toca este componente.
   */
  protected readonly otros = computed(() => RUTAS_LEGALES.filter((r) => r.clave !== this.clave()));

  /** Todos, para el pie: ahí sí se listan los tres, incluido el que se está leyendo. */
  protected readonly todos = RUTAS_LEGALES;

  /**
   * Separa el número del texto en cada título («7. Transferencia…» → «7» + «Transferencia…»).
   *
   * Los números son parte del documento —las cláusulas se citan por número— así que no se quitan
   * del contenido. Pero teniéndolos aparte se pueden pintar como la pastilla morada de la marca,
   * y el índice deja de numerar por su cuenta encima del número que ya trae el título: eso era lo
   * que producía el «1. 1. Responsable del tratamiento».
   */
  protected readonly secciones = computed(() =>
    this.doc().secciones.map((s) => {
      const corte = s.titulo.indexOf('. ');
      const tieneNumero = corte > 0 && corte <= 3;
      return {
        id: s.id,
        numero: tieneNumero ? s.titulo.slice(0, corte) : '',
        texto: tieneNumero ? s.titulo.slice(corte + 2) : s.titulo,
        html: s.html,
      };
    }),
  );

  protected readonly indiceAbierto = signal(false);

  protected alternarIndice(): void {
    this.indiceAbierto.update((v) => !v);
  }
}
