import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Users, Search, Phone, Store, ChevronLeft, ChevronRight, X,
  Loader2, AlertCircle, ShoppingBag, Receipt, CalendarClock, Info,
} from 'lucide-angular';

import { PersonasService } from '../../data-access/personas.service';
import { Ficha360, PersonaResumen } from '../../models/persona.models';
import { LoadingState } from '../../models/admin.models';

const LIMIT = 25;

/**
 * PersonasComponent — Ficha 360, entregable visible de la Fase 0.
 *
 * Listado de las personas que la plataforma conoce (`platform.persona_negocio`) y su
 * ficha agregada. Es una vista de **solo lectura**: la identidad se crea sola cuando
 * una vertical toma un pedido con teléfono.
 *
 * Dos cosas que la vista debe comunicar bien, porque son propias del dominio y no
 * errores:
 *  - La mayoría de personas tiene **un solo pedido** (69.6% en la medición del
 *    2026-07-31). Una ficha "pobre" es el caso normal, no un fallo del backfill.
 *  - Las verticales distintas de restaurante llegan en `null` porque todavía no se
 *    agregan, que no es lo mismo que "esta persona no tiene actividad ahí".
 */
@Component({
  selector: 'app-personas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, DecimalPipe, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Users, Search, Phone, Store, ChevronLeft, ChevronRight, X,
        Loader2, AlertCircle, ShoppingBag, Receipt, CalendarClock, Info,
      }),
    },
  ],
  templateUrl: './personas.component.html',
  styleUrl: './personas.component.scss',
})
export class PersonasComponent implements OnInit {
  private readonly personasService = inject(PersonasService);

  readonly estado = signal<LoadingState>('idle');
  readonly error = signal<string | null>(null);
  readonly personas = signal<PersonaResumen[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);

  /** Texto del input; se aplica al pulsar Buscar o Enter, no en cada tecla. */
  busqueda = '';
  readonly filtroActivo = signal('');

  readonly estadoFicha = signal<LoadingState>('idle');
  readonly ficha = signal<Ficha360 | null>(null);

  readonly limit = LIMIT;
  readonly pagina = computed(() => Math.floor(this.offset() / LIMIT) + 1);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  readonly hayAnterior = computed(() => this.offset() > 0);
  readonly haySiguiente = computed(() => this.offset() + LIMIT < this.total());

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.estado.set('loading');
    this.error.set(null);

    this.personasService
      .getPersonas({ q: this.filtroActivo(), limit: LIMIT, offset: this.offset() })
      .subscribe({
        next: (page) => {
          this.personas.set(page.personas);
          this.total.set(page.total);
          this.estado.set('success');
        },
        error: () => {
          this.error.set('No se pudieron cargar las personas.');
          this.estado.set('error');
        },
      });
  }

  buscar(): void {
    this.filtroActivo.set(this.busqueda.trim());
    this.offset.set(0);
    this.cargar();
  }

  limpiarBusqueda(): void {
    this.busqueda = '';
    this.buscar();
  }

  paginaAnterior(): void {
    if (!this.hayAnterior()) return;
    this.offset.update((o) => Math.max(0, o - LIMIT));
    this.cargar();
  }

  paginaSiguiente(): void {
    if (!this.haySiguiente()) return;
    this.offset.update((o) => o + LIMIT);
    this.cargar();
  }

  abrirFicha(persona: PersonaResumen): void {
    this.estadoFicha.set('loading');
    this.ficha.set(null);

    this.personasService.getFicha(persona.id_persona_negocio).subscribe({
      next: (ficha) => {
        this.ficha.set(ficha);
        this.estadoFicha.set(ficha ? 'success' : 'error');
      },
      error: () => this.estadoFicha.set('error'),
    });
  }

  cerrarFicha(): void {
    this.estadoFicha.set('idle');
    this.ficha.set(null);
  }

  /** '+573001112233' → '+57 300 111 2233'. Solo presentación; el dato guardado es E.164. */
  formatearTelefono(e164: string | null): string {
    if (!e164) return '—';
    const m = /^\+57(\d{3})(\d{3})(\d{4})$/.exec(e164);
    return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : e164;
  }

  /** Un solo pedido no es un fallo: es el caso mayoritario. */
  esClienteRecurrente(pedidos: number): boolean {
    return pedidos > 1;
  }
}
