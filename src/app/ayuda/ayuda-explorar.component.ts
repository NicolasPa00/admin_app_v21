import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';

import { AssetService } from '../core/services/asset.service';
import { AyudaService } from './ayuda.service';
import { AplicativoAyuda, ModuloAyuda } from './ayuda.models';
import { PROVEEDOR_ICONOS_AYUDA, iconoSeguro } from './ayuda-iconos';
import { duracionLegible } from './duracion';

/**
 * El navegador del catálogo: aplicativos → módulos → temas.
 *
 * Son los tres niveles en UN componente porque es una sola superficie con tres profundidades —
 * la misma rejilla de tarjetas, la misma miga de pan, el mismo catálogo ya cacheado— y partirlo
 * en tres habría significado tres plantillas casi iguales y tres cargas del mismo árbol.
 *
 * Rutas que atiende:
 *   /ayuda                      → los aplicativos
 *   /ayuda/:app                 → los módulos de un aplicativo («Pedidos», «Caja», «Menú»…)
 *   /ayuda/:app/:modulo         → los temas de un módulo («Crear producto», «Crear categoría»…)
 */
@Component({
  selector: 'app-ayuda-explorar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule],
  providers: [...PROVEEDOR_ICONOS_AYUDA],
  // En la portada todo va en un bloque centrado del ancho de las tarjetas (ver el SCSS).
  host: { '[class.ay-explorar--inicio]': "nivel() === 'aplicativos'" },
  templateUrl: './ayuda-explorar.component.html',
  styleUrl: './ayuda-explorar.component.scss',
})
export class AyudaExplorarComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly ayuda = inject(AyudaService);
  private readonly assets = inject(AssetService);

  protected readonly icono = iconoSeguro;
  /** La mascota del libro de marca (guiño), la misma pose que en la portada de la landing. */
  protected readonly pulpo = {
    src: this.assets.getAssetPath('marca/pulpo-guino-480.webp'),
    srcset:
      this.assets.getAssetPath('marca/pulpo-guino-480.webp') + ' 480w, ' +
      this.assets.getAssetPath('marca/pulpo-guino-960.webp') + ' 960w',
  };
  protected readonly duracion = duracionLegible;

  /** Los parámetros vienen de la URL, no de un estado: así «atrás» y recargar funcionan. */
  private readonly claveApp = toSignal(
    this.ruta.paramMap.pipe(map((p) => p.get('app'))),
    { initialValue: null },
  );
  private readonly claveModulo = toSignal(
    this.ruta.paramMap.pipe(map((p) => p.get('modulo'))),
    { initialValue: null },
  );

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly catalogo = signal<AplicativoAyuda[]>([]);

  /** Qué nivel se está viendo. Lo decide la URL. */
  protected readonly nivel = computed<'aplicativos' | 'modulos' | 'temas'>(() => {
    if (this.claveModulo()) return 'temas';
    if (this.claveApp()) return 'modulos';
    return 'aplicativos';
  });

  protected readonly aplicativos = computed(() => this.catalogo());

  protected readonly aplicativo = computed<AplicativoAyuda | null>(() => {
    const clave = this.claveApp();
    if (!clave) return null;
    return this.catalogo().find((a) => a.clave === clave) ?? null;
  });

  protected readonly modulo = computed<ModuloAyuda | null>(() => {
    const clave = this.claveModulo();
    const app = this.aplicativo();
    if (!clave || !app) return null;
    return app.modulos.find((m) => m.clave === clave) ?? null;
  });

  /**
   * Cuando la URL nombra algo que no está en el catálogo.
   *
   * Se distingue de «cargando» y de «vacío» porque son tres cosas distintas para quien mira: un
   * enlace viejo que ya no existe no es lo mismo que un módulo al que aún no le hemos grabado
   * nada.
   */
  protected readonly noEncontrado = computed(() => {
    if (this.cargando() || this.error()) return false;
    if (this.claveModulo()) return this.modulo() === null;
    if (this.claveApp()) return this.aplicativo() === null;
    return false;
  });

  constructor() {
    // Siempre el catálogo COMPLETO, aunque la URL nombre un aplicativo: así entrar por
    // `/ayuda/restaurante` y luego subir a `/ayuda` no pide nada otra vez, y la miga de pan
    // tiene los nombres de los demás sin una segunda consulta. El servicio lo cachea.
    this.ayuda.getCatalogo().subscribe({
      next: (datos) => {
        this.catalogo.set(datos);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar los tutoriales. Vuelve a intentarlo en un momento.');
        this.cargando.set(false);
      },
    });
  }
}
