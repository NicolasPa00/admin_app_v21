import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  Loader2,
  Smartphone,
} from 'lucide-angular';

import { AdminService } from '../../data-access/admin.service';
import { CanalWhatsappService } from '../../data-access/canalWhatsapp.service';
import { BandejaComponent } from '../bandeja/bandeja.component';
import { CanalWhatsappComponent } from '../canal-whatsapp/canal-whatsapp.component';

/**
 * WhatsappComponent — la única entrada «WhatsApp» del menú.
 *
 * Antes había dos: «Conversaciones» (la bandeja) y «WhatsApp» (conectar el número). Pero
 * conectar el número se hace una vez, y las conversaciones son el día a día: dos ítems para lo
 * mismo confundían. Ahora esta vista decide:
 *
 *   - **Ningún negocio con número conectado** → las opciones para activarlo (gestionado por
 *     EscalApp o tu propio número). Sin número no hay conversaciones que ver.
 *   - **Alguno conectado** → las conversaciones, con un acceso a «Tu número» para gestionarlo
 *     o desconectarlo (`/admin/whatsapp/numero`).
 *
 * Si la consulta del estado falla, se muestran las conversaciones: la bandeja tiene su propio
 * manejo de errores, y esconderle el trabajo a quien ya tiene el canal por un fallo puntual
 * es peor que enseñarle una bandeja vacía a quien no lo tiene.
 */
@Component({
  selector: 'app-whatsapp',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, BandejaComponent, CanalWhatsappComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Loader2, Smartphone }),
    },
  ],
  template: `
    @if (conectado() === null) {
      <div class="wa__cargando">
        <lucide-icon name="loader-2" [size]="22" class="wa__spin" aria-hidden="true" />
        <span>Cargando…</span>
      </div>
    } @else if (conectado()) {
      <app-bandeja>
        <a routerLink="/admin/whatsapp/numero" class="wa__numero" title="Gestionar tu número">
          <lucide-icon name="smartphone" [size]="15" aria-hidden="true" />
          Tu número
        </a>
      </app-bandeja>
    } @else {
      <app-canal-whatsapp />
    }
  `,
  styles: `
    .wa__cargando {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 3rem 1rem;
      color: var(--color-text-secondary);
    }
    .wa__spin { animation: wa-giro 0.9s linear infinite; }
    @keyframes wa-giro { to { transform: rotate(360deg); } }

    .wa__numero {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text-secondary);
      font-size: 0.8125rem;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
    }
    .wa__numero:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsappComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly canalService = inject(CanalWhatsappService);

  /** `null` mientras se consulta; luego, si algún negocio del usuario tiene número conectado. */
  protected readonly conectado = signal<boolean | null>(null);

  ngOnInit(): void {
    this.adminService
      .getMisNegociosUsuario()
      .pipe(
        switchMap((negocios) =>
          negocios.length === 0
            ? of([] as boolean[])
            : forkJoin(
                negocios.map((n) =>
                  this.canalService.getEstado(n.id_negocio).pipe(
                    map((e) => e?.conectado === true),
                    catchError(() => of(false)),
                  ),
                ),
              ),
        ),
        map((estados) => estados.some(Boolean)),
        catchError(() => of(true)),
      )
      .subscribe((hayConectado) => this.conectado.set(hayConectado));
  }
}
