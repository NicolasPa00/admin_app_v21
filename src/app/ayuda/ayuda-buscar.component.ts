import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { switchMap } from 'rxjs';

import { AyudaService } from './ayuda.service';
import { RespuestaBusqueda } from './ayuda.models';
import { PROVEEDOR_ICONOS_AYUDA, iconoSeguro } from './ayuda-iconos';
import { ResaltadoPipe } from './markdown.pipe';
import { marcaTiempo } from './duracion';
import { environment } from '../../environments/environment';

/**
 * Los resultados de búsqueda.
 *
 * Lo que hace esto distinto de un filtro de títulos es que un resultado puede ser un **capítulo**:
 * entonces el enlace lleva al tema con `?t=135` y el video arranca en el segundo exacto en el que
 * se explica eso. La respuesta no es «mira el video de Crear producto», es «mira el minuto 2:15
 * de Crear producto».
 *
 * El término vive en la URL (`/ayuda/buscar?q=`) y no en un signal: una búsqueda tiene que poder
 * compartirse, recargarse y quedar en el historial.
 */
@Component({
  selector: 'app-ayuda-buscar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, ResaltadoPipe],
  providers: [...PROVEEDOR_ICONOS_AYUDA],
  templateUrl: './ayuda-buscar.component.html',
  styleUrl: './ayuda-buscar.component.scss',
})
export class AyudaBuscarComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly ayuda = inject(AyudaService);

  protected readonly icono = iconoSeguro;
  protected readonly marca = marcaTiempo;
  protected readonly whatsappSoporte = environment.whatsappUrl;

  protected readonly resultado = signal<RespuestaBusqueda | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.ruta.queryParamMap
      .pipe(
        switchMap((params) => {
          const q = (params.get('q') ?? '').trim();
          this.cargando.set(true);
          this.error.set(null);
          // El backend ignora términos de menos de 3 caracteres (son teclazos a medias y
          // llenarían de ruido el registro de búsquedas); aquí se refleja esa misma regla para
          // no hacer un viaje que ya se sabe que no devuelve nada.
          if (q.length < 3) {
            this.resultado.set({ termino: q, total: 0, resultados: [] });
            this.cargando.set(false);
            return [];
          }
          return this.ayuda.buscar(q, params.get('app'));
        }),
      )
      .subscribe({
        next: (res) => {
          this.resultado.set(res);
          this.cargando.set(false);
        },
        error: () => {
          this.error.set('No pudimos buscar en este momento. Vuelve a intentarlo.');
          this.cargando.set(false);
        },
      });
  }
}
