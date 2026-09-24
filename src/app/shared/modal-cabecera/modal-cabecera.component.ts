import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  Bot,
  Building2,
  CalendarClock,
  CalendarRange,
  Check,
  CircleAlert,
  CreditCard,
  Eye,
  FileText,
  History,
  Info,
  KeyRound,
  Layers,
  Lock,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Power,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Tag,
  Tags,
  Trash2,
  TriangleAlert,
  User,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-angular';

/**
 * ModalCabeceraComponent — la cabecera estándar de TODOS los modales del admin.
 *
 * ```html
 * <app-modal-cabecera icono="trash-2" titulo="Eliminar negocio" tituloId="neg-del-title"
 *                     (cerrar)="cancelar()" />
 * ```
 *
 * A la izquierda un recuadro con el ícono de la acción; a la derecha la X de cerrar. El recuadro
 * tiene el mismo tamaño, borde y radio que la X, pero NO es un botón: no reacciona, no tiene
 * cursor de mano y se oculta a los lectores de pantalla. Así el ojo distingue de un vistazo qué es
 * decoración y qué se puede pulsar.
 *
 * ## El color del ícono es UNO
 *
 * `--color-primary` para todos. El rojo para «eliminar» o el ámbar para «inactivar» los pone el
 * botón de la acción en el pie del modal, no la cabecera: si cada modal pintara su ícono a su
 * gusto el conjunto dejaría de leerse como un sistema.
 *
 * ## Iconos por acción (convención)
 * eliminar → `trash-2` · ver → `eye` · editar → `pencil` · crear/registrar → `plus` ·
 * historial → `history` · inactivar/activar → `power`. Para el resto, el que mejor diga qué es.
 *
 * ## Por qué el set de íconos va en `viewProviders`
 *
 * El nombre del ícono llega por `input`, así que el componente tiene que traer los suyos. Va en
 * `viewProviders` y NO en `providers` (regla del equipo tras un fallo de íconos en producción):
 * `viewProviders` limita el set a la vista de este componente y no lo expone al contenido
 * proyectado ni a los demás componentes del anfitrión. Si un modal necesita un ícono que no está
 * en la lista, se añade AQUÍ.
 */
@Component({
  selector: 'app-modal-cabecera',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  viewProviders: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Bot, Building2, CalendarClock, CalendarRange, Check, CircleAlert, CreditCard, Eye,
        FileText, History, Info, KeyRound, Layers, Lock, MessageSquare, Pencil, Phone, Plus,
        Power, Receipt, Search, Settings, ShieldCheck, Store, Tag, Tags, Trash2, TriangleAlert,
        User, UserMinus, UserPlus, UserRound, Users, Wallet, X,
      }),
    },
  ],
  template: `
    <header class="mc">
      <div class="mc__lado">
        <span class="mc__icono" aria-hidden="true">
          <lucide-icon [name]="icono()" [size]="18" />
        </span>
        <div class="mc__texto">
          <h2 class="mc__titulo" [attr.id]="tituloId()">{{ titulo() }}</h2>
          @if (subtitulo()) {
            <p class="mc__sub">{{ subtitulo() }}</p>
          }
        </div>
      </div>
      <button
        type="button"
        class="mc__x"
        [disabled]="bloqueado()"
        (click)="cerrar.emit()"
        aria-label="Cerrar"
      >
        <lucide-icon name="x" [size]="18" aria-hidden="true" />
      </button>
    </header>
  `,
  styles: `
    :host { display: block; flex: none; }

    .mc {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-md);
      padding: var(--spacing-md) var(--spacing-xl);
      border-bottom: 1px solid var(--color-border);
    }
    @media (max-width: 520px) { .mc { padding-inline: var(--spacing-md); } }

    .mc__lado { display: flex; align-items: center; gap: var(--spacing-sm); min-width: 0; }
    .mc__texto { min-width: 0; }

    .mc__titulo {
      margin: 0;
      font-size: var(--font-size-lg);
      font-weight: 700;
      color: var(--color-text-primary);
      overflow-wrap: anywhere;
    }
    .mc__sub {
      margin: 2px 0 0;
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    /* Mismo tamaño, borde y radio que la X; a propósito sin hover ni cursor: no es un botón. */
    .mc__icono,
    .mc__x {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 34px;
      height: 34px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }
    .mc__icono { color: var(--color-primary); cursor: default; user-select: none; }

    .mc__x {
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast),
        border-color var(--transition-fast);
    }
    .mc__x:hover:not(:disabled) {
      border-color: var(--color-primary);
      color: var(--color-primary);
      background: var(--color-surface-hover);
    }
    .mc__x:focus-visible { outline: none; box-shadow: var(--focus-ring); }
    .mc__x:disabled { opacity: 0.45; cursor: not-allowed; }
  `,
})
export class ModalCabeceraComponent {
  /** Nombre del ícono de lucide (`trash-2`, `eye`, `pencil`…). Tiene que estar en el set de arriba. */
  readonly icono = input.required<string>();
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>();
  /** `id` del título, para el `aria-labelledby` del diálogo. */
  readonly tituloId = input<string>();
  /** Deshabilita la X mientras hay algo guardándose. */
  readonly bloqueado = input(false);

  readonly cerrar = output<void>();
}
