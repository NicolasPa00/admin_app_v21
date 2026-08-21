import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import {
  LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Bot, Search, X, ChevronLeft, ChevronRight, Loader2, AlertCircle,
  MessageSquare, Zap, CircleAlert, CircleCheck, Timer, Wrench, Coins, Filter, BellOff,
} from 'lucide-angular';

import { IntelligenceService } from '../../data-access/intelligence.service';
import {
  ConversacionDetalle,
  ConversacionResumen,
  Metricas,
  TurnoLedger,
} from '../../models/intelligence.models';
import { LoadingState } from '../../models/admin.models';

const LIMIT = 25;

/**
 * IntelligenceComponent — Intelligence Console (F5-E).
 *
 * ADR-022 y `revision-01.md` §2: la Consola **no es una fase, es la Observabilidad vista
 * desde el otro lado**, y nace ahora porque hasta F5-D no había conversaciones reales que
 * mirar. Prohibido construirla con datos simulados — todo lo que se pinta aquí salió de una
 * conversación que ocurrió de verdad.
 *
 * Su usuario principal no es un cliente: es **el desarrollador depurando**. De ahí las tres
 * decisiones de diseño de esta pantalla:
 *
 *  1. El filtro «solo con errores» está a la vista, no escondido en un desplegable. Es el
 *     primer clic de cualquier depuración.
 *  2. El detalle enseña el turno completo —pasos, invocaciones, argumentos y el detalle del
 *     error— porque después de un incidente la única pregunta que importa es qué se pidió
 *     exactamente.
 *  3. **El costo $0.00 se muestra, no se oculta.** En F5 no hay IA y ése es el resultado que
 *     la fase promete, no una columna vacía esperando a llenarse. En F6 se llenará sola.
 */
@Component({
  selector: 'app-intelligence',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, DecimalPipe, PercentPipe, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Bot, Search, X, ChevronLeft, ChevronRight, Loader2, AlertCircle,
        MessageSquare, Zap, CircleAlert, CircleCheck, Timer, Wrench, Coins, Filter, BellOff,
      }),
    },
  ],
  templateUrl: './intelligence.component.html',
  styleUrl: './intelligence.component.scss',
})
export class IntelligenceComponent implements OnInit {
  private readonly service = inject(IntelligenceService);

  readonly estado = signal<LoadingState>('idle');
  readonly error = signal<string | null>(null);
  /** true cuando el backend responde 503: Intelligence no está migrado en este entorno. */
  readonly sinMigrar = signal(false);

  readonly conversaciones = signal<ConversacionResumen[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);

  readonly metricas = signal<Metricas | null>(null);
  readonly estadoMetricas = signal<LoadingState>('idle');

  readonly estadoDetalle = signal<LoadingState>('idle');
  readonly detalle = signal<ConversacionDetalle | null>(null);

  /**
   * Deshacer una baja (F8-B). Es la única escritura de esta pantalla.
   *
   * Pide motivo porque el motivo se audita: un `STOP` es irrevocable **por el cliente** a
   * propósito, así que volver a abrirle la puerta es una decisión de una persona con nombre.
   */
  readonly desbloqueando = signal(false);
  readonly errorDesbloqueo = signal<string | null>(null);
  motivoDesbloqueo = '';

  readonly estaBloqueada = computed(() => this.detalle()?.conversacion.estado === 'bloqueada');

  busqueda = '';
  readonly filtroBusqueda = signal('');
  readonly soloErrores = signal(false);

  readonly limit = LIMIT;
  readonly pagina = computed(() => Math.floor(this.offset() / LIMIT) + 1);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  readonly hayAnterior = computed(() => this.offset() > 0);
  readonly haySiguiente = computed(() => this.offset() + LIMIT < this.total());

  /** En F5 esto es siempre true. Cuando deje de serlo, será porque F6 llegó. */
  readonly sinCosto = computed(() => (this.metricas()?.costo_total_usd ?? 0) === 0);

  ngOnInit(): void {
    this.cargar();
    this.cargarMetricas();
  }

  cargar(): void {
    this.estado.set('loading');
    this.error.set(null);

    this.service
      .getConversaciones({
        q: this.filtroBusqueda(),
        con_error: this.soloErrores() ? 'true' : undefined,
        limit: LIMIT,
        offset: this.offset(),
      })
      .subscribe({
        next: (page) => {
          this.conversaciones.set(page.conversaciones);
          this.total.set(page.total);
          this.estado.set('success');
        },
        error: (e) => {
          // 503 no es una avería: es que esta fase no está desplegada aquí.
          if (e?.status === 503) {
            this.sinMigrar.set(true);
            this.estado.set('success');
            return;
          }
          this.error.set('No se pudieron cargar las conversaciones.');
          this.estado.set('error');
        },
      });
  }

  cargarMetricas(): void {
    this.estadoMetricas.set('loading');
    this.service.getMetricas().subscribe({
      next: (m) => {
        this.metricas.set(m);
        this.estadoMetricas.set(m ? 'success' : 'error');
      },
      error: () => this.estadoMetricas.set('error'),
    });
  }

  buscar(): void {
    this.filtroBusqueda.set(this.busqueda.trim());
    this.offset.set(0);
    this.cargar();
  }

  limpiarBusqueda(): void {
    this.busqueda = '';
    this.buscar();
  }

  alternarErrores(): void {
    this.soloErrores.update((v) => !v);
    this.offset.set(0);
    this.cargar();
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

  abrirDetalle(conversacion: ConversacionResumen): void {
    this.estadoDetalle.set('loading');
    this.detalle.set(null);

    this.service.getConversacion(conversacion.id_conversacion).subscribe({
      next: (d) => {
        this.detalle.set(d);
        this.estadoDetalle.set(d ? 'success' : 'error');
      },
      error: () => this.estadoDetalle.set('error'),
    });
  }

  cerrarDetalle(): void {
    this.estadoDetalle.set('idle');
    this.detalle.set(null);
    this.motivoDesbloqueo = '';
    this.errorDesbloqueo.set(null);
  }

  desbloquear(): void {
    const d = this.detalle();
    const motivo = this.motivoDesbloqueo.trim();
    if (!d || motivo.length < 5) {
      this.errorDesbloqueo.set('Escribe por qué se deshace la baja (mínimo 5 caracteres).');
      return;
    }

    this.desbloqueando.set(true);
    this.errorDesbloqueo.set(null);

    this.service.desbloquear(d.conversacion.id_conversacion, motivo).subscribe({
      next: () => {
        // Se refleja en el sitio, sin recargar: el estado que se acaba de cambiar es
        // justamente lo que la persona está mirando.
        this.detalle.set({ ...d, conversacion: { ...d.conversacion, estado: 'activa' } });
        this.motivoDesbloqueo = '';
        this.desbloqueando.set(false);
        this.cargar();
      },
      error: (e) => {
        this.errorDesbloqueo.set(e?.error?.message || 'No se pudo desbloquear la conversación.');
        this.desbloqueando.set(false);
      },
    });
  }

  /** Los mensajes de un turno concreto, para pintarlos dentro de él. */
  mensajesDelTurno(turno: TurnoLedger) {
    return (this.detalle()?.mensajes ?? []).filter((m) => m.id_turno === turno.id_turno);
  }

  /** Mensajes que aún no tienen turno: entraron y esperan a que se abra uno. */
  mensajesSinTurno() {
    return (this.detalle()?.mensajes ?? []).filter((m) => !m.id_turno);
  }

  duracion(turno: TurnoLedger): string {
    return turno.latencia_ms == null ? '—' : `${turno.latencia_ms} ms`;
  }

  json(valor: unknown): string {
    if (valor == null) return '';
    return JSON.stringify(valor, null, 2);
  }
}
