import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  Loader2,
  Smartphone,
  MessageCircle,
  AlertCircle,
  Sparkles,
  Check,
  ArrowRight,
} from 'lucide-angular';

import { AdminService } from '../../data-access/admin.service';
import { CanalWhatsappService } from '../../data-access/canalWhatsapp.service';
import { BandejaComponent } from '../bandeja/bandeja.component';
import { CanalWhatsappComponent } from '../canal-whatsapp/canal-whatsapp.component';
import {
  NegocioSelector,
  SelectorNegocioComponent,
} from '../../../shared/selector-negocio/selector-negocio.component';

/** La feature comercial que da WhatsApp (ADR-021: se pregunta por la feature, nunca por el plan). */
const FEATURE_WHATSAPP = 'asistente_ia';

interface NegocioWhatsapp {
  id_negocio: number;
  nombre: string;
  conectado: boolean;
  /** ¿Su plan incluye el asistente? Sin dato del backend se da por sí: no se bloquea a nadie. */
  habilitado: boolean;
}

/**
 * WhatsappComponent — la única entrada «WhatsApp» del menú.
 *
 * La decisión es **por negocio**, no por usuario: un administrador con varios negocios puede
 * tener unos con número conectado y otros sin él. Por eso:
 *
 *   - **Un solo negocio** → sin selector. Conectado: sus conversaciones. Sin conectar: las
 *     opciones para activarlo.
 *   - **Varios** → un selector arriba que dice de cada uno si está conectado. Arranca en el
 *     primero conectado (es donde hay trabajo) y enseña, para el elegido, sus conversaciones o
 *     las opciones de conexión.
 *
 * «Tu número» cambia de vista **aquí dentro**, sin navegar, así el negocio elegido no se pierde.
 *
 * Solo se decide en el navegador: en el servidor no hay sesión, la consulta fallaba y la página
 * salía armada con una bandeja vacía que el primer clic reemplazaba por la vista correcta.
 */
@Component({
  selector: 'app-whatsapp',
  standalone: true,
  imports: [
    LucideAngularModule, RouterLink, BandejaComponent, CanalWhatsappComponent,
    SelectorNegocioComponent,
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Loader2, Smartphone, MessageCircle, AlertCircle, Sparkles, Check, ArrowRight,
      }),
    },
  ],
  template: `
    @if (estado() === 'cargando') {
      <div class="wa__cargando">
        <lucide-icon name="loader-2" [size]="22" class="wa__spin" aria-hidden="true" />
        <span>Cargando…</span>
      </div>
    } @else if (estado() === 'error') {
      <div class="wa__cargando wa__cargando--error" role="alert">
        <lucide-icon name="alert-circle" [size]="20" aria-hidden="true" />
        <span>No se pudieron cargar tus negocios.</span>
        <button type="button" class="wa__pill" (click)="cargar()">Reintentar</button>
      </div>
    } @else {
      <!-- Título → subtítulo → chips → contenido, igual que Facturación. Sobre las conversaciones
           no hay título propio (la bandeja trae su cabecera) y los chips van a todo el ancho. -->
      @if (!enConversaciones()) {
        <header class="wa__ancho-canal wa__cabecera">
          <div>
            <h1 class="wa__titulo">
              <lucide-icon name="message-circle" [size]="20" aria-hidden="true" />
              {{ habilitado() ? 'Conectar WhatsApp' : 'WhatsApp' }}
            </h1>
            <p class="wa__sub">
              @if (habilitado()) {
                Así llega el asistente a tus clientes por WhatsApp — automatizado, respondiendo
                pedidos y citas por ti.
              } @else {
                Un asistente que atiende a tus clientes por WhatsApp mientras tú te ocupas del negocio.
              }
            </p>
          </div>
          @if (actual()?.conectado) {
            <button type="button" class="wa__pill" (click)="vista.set('conversaciones')">
              <lucide-icon name="message-circle" [size]="15" aria-hidden="true" />
              Ver conversaciones
            </button>
          }
        </header>
      }

      @if (negocios().length > 1) {
        <div class="wa__barra" [class.wa__ancho-canal]="!enConversaciones()">
          <app-selector-negocio
            idBase="wa-neg"
            [negocios]="opciones()"
            [seleccionado]="seleccion()"
            (cambiar)="elegir($event)"
          />
        </div>
      }

      <!-- El @for con una sola clave recrea la vista al cambiar de negocio. -->
      <div [class.wa__vista--con-barra]="negocios().length > 1 && enConversaciones()">
      @for (id of claveVista(); track id) {
        @if (!habilitado()) {
          <!-- Sin la feature en su plan: no hay nada que conectar. Se ofrece mejorar el plan. -->
          <section class="wa__ancho-canal wa__mejora" aria-labelledby="wa-mejora-titulo">
            <span class="wa__mejora-icono" aria-hidden="true">
              <lucide-icon name="sparkles" [size]="22" />
            </span>
            <h2 id="wa-mejora-titulo" class="wa__mejora-titulo">Mejora tu plan para usar WhatsApp</h2>
            <p class="wa__mejora-texto">
              {{ actual()?.nombre }} todavía no incluye el asistente de WhatsApp. Con un plan que lo
              incluya tendrías:
            </p>
            <ul class="wa__beneficios">
              @for (b of beneficios; track b) {
                <li>
                  <lucide-icon name="check" [size]="16" aria-hidden="true" />
                  <span>{{ b }}</span>
                </li>
              }
            </ul>
            <a
              class="wa__cta"
              routerLink="/admin/mis-pagos"
              [queryParams]="{ negocio: seleccion() }"
            >
              Ver planes
              <lucide-icon name="arrow-right" [size]="16" aria-hidden="true" />
            </a>
          </section>
        } @else if (enConversaciones()) {
          <app-bandeja [negocioFijo]="seleccion()">
            <button type="button" class="wa__pill" (click)="vista.set('numero')"
                    title="Gestionar tu número">
              <lucide-icon name="smartphone" [size]="15" aria-hidden="true" />
              Tu número
            </button>
          </app-bandeja>
        } @else {
          <app-canal-whatsapp
            [negocioInicial]="seleccion()"
            [ocultarSelector]="true"
            [ocultarEncabezado]="true"
            (estadoCambio)="alCambiarEstado($event)"
          />
        }
      }
      </div>
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
    .wa__cargando--error { color: var(--color-error); }
    .wa__spin { animation: wa-giro 0.9s linear infinite; }
    @keyframes wa-giro { to { transform: rotate(360deg); } }

    /* El mismo ancho y centrado que .cw (canal-whatsapp): si uno cambia, cambia el otro. */
    .wa__ancho-canal {
      max-width: 1100px;
      margin-inline: auto;
      width: 100%;
    }

    /* Los chips sobre la bandeja: 2.5rem de chip + 0.25rem de su relleno inferior + este margen. */
    .wa__barra { margin-bottom: 0.75rem; }
    /* Alto que la barra le quita a la bandeja (ver --bdj-extra en bandeja.component.scss):
       2.5 + 0.25 + 0.75. */
    .wa__vista--con-barra { --bdj-extra: 3.5rem; }

    /* Cabecera de la vista de conexión y de la de mejora: mismo aspecto que .cw__head. */
    .wa__cabecera {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 0.75rem;
    }
    .wa__titulo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-size: 1.375rem;
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .wa__sub {
      margin: 0.25rem 0 0;
      font-size: 0.875rem;
      color: var(--color-text-muted);
    }
    /* Chips en la vista de conexión: separados del contenido como las tarjetas entre sí. */
    .wa__barra.wa__ancho-canal { margin-bottom: 1.25rem; }

    /* Card de mejora de plan. */
    .wa__mejora {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1.5rem;
      border: 1px solid var(--color-border);
      border-radius: 0.875rem;
      background: var(--color-surface);
    }
    .wa__mejora-icono {
      display: inline-grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 50%;
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      color: var(--color-primary);
    }
    .wa__mejora-titulo {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .wa__mejora-texto {
      margin: 0;
      font-size: 0.9375rem;
      color: var(--color-text-secondary);
    }
    .wa__beneficios {
      display: grid;
      gap: 0.5rem;
      margin: 0.25rem 0 0.5rem;
      padding: 0;
      list-style: none;
    }
    .wa__beneficios li {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      font-size: 0.9375rem;
      color: var(--color-text-primary);
    }
    .wa__beneficios lucide-icon { color: var(--color-success); margin-top: 0.15rem; flex: none; }
    .wa__cta {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.1rem;
      border-radius: 0.625rem;
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-size: 0.9375rem;
      font-weight: 600;
      text-decoration: none;
    }
    .wa__cta:hover { background: color-mix(in srgb, var(--color-primary) 88%, #000); }
    .wa__cta:focus-visible { outline: none; box-shadow: var(--focus-ring); }

    .wa__pill {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text-secondary);
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
    }
    .wa__pill:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsappComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly canalService = inject(CanalWhatsappService);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  protected readonly negocios = signal<NegocioWhatsapp[]>([]);
  protected readonly seleccion = signal<number | null>(null);
  protected readonly vista = signal<'conversaciones' | 'numero'>('conversaciones');

  /** ¿Se están mostrando las conversaciones (y no la vista de conexión del número)? */
  protected readonly enConversaciones = computed(
    () =>
      this.actual()?.habilitado !== false &&
      this.actual()?.conectado === true &&
      this.vista() === 'conversaciones',
  );

  protected readonly actual = computed(
    () => this.negocios().find((n) => n.id_negocio === this.seleccion()) ?? null,
  );
  /** Los chips: punto verde con WhatsApp activo, ámbar sin él. */
  protected readonly opciones = computed<NegocioSelector[]>(() =>
    this.negocios().map((n) => ({
      id: n.id_negocio,
      nombre: n.nombre,
      // Sin la feature no hay nada que conectar: ni bien ni mal, neutro.
      estado: !n.habilitado ? 'neutro' : n.conectado ? 'ok' : 'aviso',
      titulo: !n.habilitado
        ? 'Disponible en Plan Avanzado'
        : n.conectado
          ? 'WhatsApp activo'
          : 'Aún sin WhatsApp',
    })),
  );

  /** ¿El negocio elegido tiene la feature? Con el campo ausente, sí. */
  protected readonly habilitado = computed(() => this.actual()?.habilitado ?? true);

  /** Lo que gana el negocio con un plan que incluya el asistente. */
  protected readonly beneficios = [
    'Un asistente que responde pedidos y agenda citas por WhatsApp, a cualquier hora',
    'Bandeja de conversaciones para ver lo que dicen tus clientes y responderles tú',
    'Avisos automáticos a tus clientes, como cuando su pedido está listo',
    'Tu propio número de WhatsApp conectado al negocio',
  ];

  /** Una sola clave por negocio: cambiarla recrea bandeja/canal con el negocio nuevo. */
  protected readonly claveVista = computed(() => [this.seleccion() ?? 0]);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set('cargando');
    this.adminService
      .getMisNegociosUsuario()
      .pipe(
        switchMap((negocios) =>
          negocios.length === 0
            ? of([] as NegocioWhatsapp[])
            : forkJoin(
                negocios.map((n) => {
                  const habilitado = n.features?.includes(FEATURE_WHATSAPP) ?? true;
                  // Sin la feature no hay canal que consultar.
                  const conectado$ = habilitado
                    ? this.canalService.getEstado(n.id_negocio).pipe(
                        map((e) => e?.conectado === true),
                        catchError(() => of(false)),
                      )
                    : of(false);
                  return conectado$.pipe(
                    map((conectado) => ({
                      id_negocio: n.id_negocio,
                      nombre: n.nombre,
                      conectado,
                      habilitado,
                    })),
                  );
                }),
              ),
        ),
      )
      .subscribe({
        next: (lista) => {
          // Conectados primero (ahí hay conversaciones), luego los que pueden conectar, y al final
          // los que necesitan mejorar de plan.
          const rango = (n: NegocioWhatsapp) => (n.conectado ? 0 : n.habilitado ? 1 : 2);
          const orden = [...lista].sort((a, b) => rango(a) - rango(b));
          this.negocios.set(orden);
          this.seleccion.set(orden[0]?.id_negocio ?? null);
          this.vista.set('conversaciones');
          this.estado.set('listo');
        },
        error: () => this.estado.set('error'),
      });
  }

  protected elegir(id: number): void {
    this.seleccion.set(id);
    this.vista.set('conversaciones');
  }

  /** Conectar o desconectar desde la vista de número actualiza el estado de ese negocio. */
  protected alCambiarEstado(e: { idNegocio: number; conectado: boolean }): void {
    const antes = this.negocios().find((n) => n.id_negocio === e.idNegocio);
    if (!antes || antes.conectado === e.conectado) return;
    this.negocios.update((l) =>
      l.map((n) => (n.id_negocio === e.idNegocio ? { ...n, conectado: e.conectado } : n)),
    );
    // Recién conectado → a sus conversaciones.
    if (e.conectado) this.vista.set('conversaciones');
  }
}
