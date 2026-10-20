import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

import { AyudaService } from './ayuda.service';
import { PROVEEDOR_ICONOS_AYUDA } from './ayuda-iconos';

/**
 * `/ayuda/ir?app=restaurante&ruta=/menu` — la puerta de la ayuda contextual.
 *
 * Ver `admin_ws/docs/centro-de-ayuda.md`. Es a donde apunta el botón «?» de cada vertical:
 * recibe la ruta en la que estaba el usuario, le pregunta al API qué módulo le corresponde y
 * redirige allí. Si no hay módulo, al índice del aplicativo.
 *
 * ## Por qué esta pieza existe en vez de que cada app arme el enlace
 *
 * Porque el mapeo ruta → módulo vive en la base (`ayuda_modulo.rutas`), editable desde el panel.
 * Si cada vertical compusiera `/ayuda/restaurante/menu` por su cuenta, estaría repitiendo —en
 * tres repositorios y en cada futuro— una convención que el super admin puede cambiar sin tocar
 * ningún frontend. Con esta ruta, **un aplicativo nuevo solo necesita saber su propia clave**:
 * el resto lo resuelve quien es dueño del dato.
 *
 * Y es lo que hace que el botón «?» no pueda enseñar un error: sin módulo hay un destino
 * razonable, y si el API falla, también.
 */
@Component({
  selector: 'app-ayuda-ir',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule],
  providers: [...PROVEEDOR_ICONOS_AYUDA],
  template: `
    <div class="ir-estado" aria-live="polite">
      @if (error()) {
        <lucide-icon name="circle-help" [size]="28" />
        <p>No encontramos la ayuda de esa pantalla.</p>
        <a routerLink="/ayuda" class="ir-accion">Ver todos los temas</a>
      } @else {
        <lucide-icon name="loader-2" [size]="24" class="ir-girando" />
        <p>Buscando la ayuda de esta pantalla…</p>
      }
    </div>
  `,
  styles: [`
    .ir-estado {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 72px 24px;
      text-align: center;
      color: var(--es-text-secondary);
    }
    .ir-estado p { margin: 0; }
    .ir-accion {
      margin-top: 6px;
      display: inline-flex;
      padding: 10px 18px;
      border: 1px solid var(--es-border);
      border-radius: var(--es-radius-md);
      background: var(--es-bg-card);
      color: var(--es-text-primary);
      font-size: var(--es-font-size-sm);
      font-weight: 600;
      text-decoration: none;
    }
    .ir-girando { animation: ir-girar 900ms linear infinite; }
    @keyframes ir-girar { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .ir-girando { animation: none; } }
  `],
})
export class AyudaIrComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ayuda = inject(AyudaService);

  protected readonly error = signal(false);

  constructor() {
    const params = this.ruta.snapshot.queryParamMap;
    const app = (params.get('app') ?? '').trim();
    // Sin query ni parámetros: `/menu/producto/12?tab=x` tiene que resolverse como `/menu`.
    const ruta = (params.get('ruta') ?? '').split('?')[0].trim();

    if (!app) {
      this.error.set(true);
      return;
    }

    // `replaceUrl` en los tres caminos: `/ayuda/ir` es un peaje, no un sitio. Dejarlo en el
    // historial haría que «atrás» desde el tema volviera a redirigir hacia delante.
    if (!ruta) {
      void this.router.navigate(['/ayuda', app], { replaceUrl: true });
      return;
    }

    this.ayuda.getContexto(app, ruta).subscribe({
      next: (ctx) => {
        if (ctx.modulo) {
          void this.router.navigate(['/ayuda', app, ctx.modulo.clave], { replaceUrl: true });
        } else {
          // Sin módulo documentado para esa vista, el índice del aplicativo es un destino
          // razonable: el usuario ve de qué hay ayuda en su app en vez de un «no existe».
          void this.router.navigate(['/ayuda', app], { replaceUrl: true });
        }
      },
      // `getContexto` ya se traga los errores y devuelve un contexto vacío, así que esto solo
      // salta si algo se rompe antes. Aun así se cubre: el botón de ayuda nunca enseña un fallo.
      error: () => void this.router.navigate(['/ayuda', app], { replaceUrl: true }),
    });
  }
}
