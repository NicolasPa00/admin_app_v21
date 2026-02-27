import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Utensils, Car, Scissors, ShoppingCart, Wrench, PiggyBank,
  Landmark, Building2, CheckCircle2, XCircle, Users, ArrowRight,
  CalendarDays, RefreshCw,
} from 'lucide-angular';

import { TipoNegocioConRoles } from '../../models/admin.models';

// ===================== Mapa de iconos por tipo =====================
// Clave = nombre normalizado (mayúsculas, sin tildes)
const ICON_MAP: Record<string, string> = {
  'RESTAURANTE':                   'utensils',
  'PARQUEADERO':                   'car',
  'BARBERIA':                      'scissors',
  'SUPERMERCADO':                  'shopping-cart',
  'GESTION DE TALLER AUTOMOTRIZ':  'wrench',
  'FONDO DE AHORROS':              'piggy-bank',
  'FINANCIERA DE PRESTAMOS':       'landmark',
};

/**
 * NegocioCardComponent — Tarjeta visual para un tipo de negocio.
 *
 * Emite:
 *   (entrar)    → usuario hace click en "Entrar"
 *   (verRoles)  → usuario hace click en "Ver roles"
 */
@Component({
  selector: 'app-negocio-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TitleCasePipe, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Utensils, Car, Scissors, ShoppingCart, Wrench,
        PiggyBank, Landmark, Building2, CheckCircle2,
        XCircle, Users, ArrowRight, CalendarDays, RefreshCw,
      }),
    },
  ],
  template: `
    <article
      class="nc-card"
      [class.nc-card--inactive]="tipo().estado === 'I'"
      [attr.aria-label]="'Tipo de negocio: ' + tipo().nombre"
    >
      <!-- Cabecera con icono + badge de estado -->
      <header class="nc-card__header">
        <div class="nc-card__icon-wrap" [attr.aria-hidden]="true">
          <lucide-icon [name]="icon()" [size]="28" />
        </div>

        <span
          class="nc-badge"
          [class.nc-badge--active]="tipo().estado === 'A'"
          [class.nc-badge--inactive]="tipo().estado === 'I'"
        >
          <lucide-icon
            [name]="tipo().estado === 'A' ? 'check-circle-2' : 'x-circle'"
            [size]="12"
            aria-hidden="true"
          />
          {{ tipo().estado === 'A' ? 'Activo' : 'Inactivo' }}
        </span>
      </header>

      <!-- Nombre -->
      <h2 class="nc-card__title">{{ tipo().nombre | titlecase }}</h2>

      <!-- Descripción truncada -->
      <p class="nc-card__desc" [title]="tipo().descripcion ?? ''">
        {{ tipo().descripcion ?? 'Sin descripción' }}
      </p>

      <!-- Meta: roles + fechas -->
      <dl class="nc-card__meta">
        <div class="nc-card__meta-item">
          <lucide-icon name="users" [size]="14" aria-hidden="true" />
          <dt class="sr-only">Roles</dt>
          <dd>{{ tipo().roles.length }} {{ tipo().roles.length === 1 ? 'rol' : 'roles' }}</dd>
        </div>

        <div class="nc-card__meta-item">
          <lucide-icon name="calendar-days" [size]="14" aria-hidden="true" />
          <dt class="sr-only">Creación</dt>
          <dd>{{ tipo().fecha_creacion | date: 'dd/MM/yyyy' }}</dd>
        </div>

        <div class="nc-card__meta-item">
          <lucide-icon name="refresh-cw" [size]="14" aria-hidden="true" />
          <dt class="sr-only">Actualización</dt>
          <dd>{{ tipo().fecha_actualizacion | date: 'dd/MM/yyyy' }}</dd>
        </div>
      </dl>

      <!-- Acciones -->
      <footer class="nc-card__actions">
        <button
          type="button"
          class="btn btn--primary nc-card__btn-enter"
          (click)="onEntrar()"
          [attr.aria-label]="'Entrar a ' + tipo().nombre"
        >
          Entrar
          <lucide-icon name="arrow-right" [size]="16" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="btn btn--outline nc-card__btn-roles"
          (click)="onVerRoles()"
          [attr.aria-label]="'Ver roles de ' + tipo().nombre"
        >
          Ver roles
        </button>
      </footer>
    </article>
  `,
  styleUrl: './negocio-card.component.scss',
})
export class NegocioCardComponent {
  /** Datos del tipo de negocio con roles calculados. */
  readonly tipo = input.required<TipoNegocioConRoles>();

  /** Emitido cuando el usuario hace click en "Entrar". */
  readonly entrar   = output<TipoNegocioConRoles>();

  /** Emitido cuando el usuario hace click en "Ver roles". */
  readonly verRoles = output<TipoNegocioConRoles>();

  /** Icono lucide-angular calculado a partir del nombre del tipo de negocio. */
  readonly icon = computed<string>(() => {
    const nombre = this.tipo().nombre.toUpperCase();
    return ICON_MAP[nombre] ?? 'building-2';
  });

  protected onEntrar():   void { this.entrar.emit(this.tipo()); }
  protected onVerRoles(): void { this.verRoles.emit(this.tipo()); }
}
