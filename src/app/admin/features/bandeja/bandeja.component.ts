import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import {
  LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  MessageSquare, Send, Loader2, AlertCircle, User, Bot, Clock, TriangleAlert, RefreshCw, Inbox,
} from 'lucide-angular';

import { BandejaService } from '../../data-access/bandeja.service';
import {
  ConversacionBandeja,
  ConversacionBandejaDetalle,
  MensajeBandeja,
} from '../../models/bandeja.models';
import { LoadingState } from '../../models/admin.models';

/**
 * BandejaComponent — donde el negocio contesta cuando el asistente no supo.
 *
 * ## El problema que resuelve
 *
 * El handoff funcionaba desde F7: el bot reconoce que no sabe, dice honestamente cuándo habrá
 * alguien, y se calla. Lo que faltaba era **el otro lado de esa promesa**. El número está
 * conectado a la Cloud API, así que deja de funcionar en la app de WhatsApp del móvil: el dueño
 * no puede coger el teléfono y responder. Sin esta pantalla, el cliente final recibía una
 * promesa honesta y luego silencio — exactamente lo que el handoff existe para evitar.
 *
 * ## Las tres cosas que esta pantalla hace y una consola normal no haría
 *
 * 1. **Las escaladas primero, y marcadas.** Una bandeja de correo ordena por fecha. Aquí la
 *    pregunta no es «qué es lo último» sino «qué me está esperando», así que el filtro de
 *    escaladas está a un clic y no dentro de un desplegable.
 * 2. **La ventana de 24 h se enseña ANTES de escribir.** Es la regla más restrictiva de
 *    WhatsApp y la que más sorprende: pasado ese plazo Meta rechaza el texto libre. Enterarse
 *    después de redactar un párrafo es la peor forma de descubrirlo, así que si está cerrada el
 *    cuadro de texto aparece deshabilitado y explicado.
 * 3. **«Enviado» no se dice hasta que lo está.** El backend encola el mensaje y lo entrega el
 *    Channel Gateway con reintentos, así que un envío aceptado nace `pendiente`. Pintarlo como
 *    entregado sería repetir el error que se acaba de arreglar en el Ledger.
 *
 * Al responder, la conversación queda tomada por la persona y el bot no vuelve a ella. Se avisa
 * en la propia pantalla porque es irreversible y no es evidente.
 */
@Component({
  selector: 'app-bandeja',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        MessageSquare, Send, Loader2, AlertCircle, User, Bot, Clock, TriangleAlert,
        RefreshCw, Inbox,
      }),
    },
  ],
  templateUrl: './bandeja.component.html',
  styleUrl: './bandeja.component.scss',
})
export class BandejaComponent implements OnInit {
  private readonly service = inject(BandejaService);

  readonly estado = signal<LoadingState>('idle');
  readonly error = signal<string | null>(null);
  /** El esquema `intelligence` no está migrado en este entorno. No es una avería. */
  readonly sinModulo = signal(false);

  readonly conversaciones = signal<ConversacionBandeja[]>([]);
  readonly soloEscaladas = signal(false);

  readonly detalle = signal<ConversacionBandejaDetalle | null>(null);
  readonly estadoDetalle = signal<LoadingState>('idle');

  readonly borrador = signal('');
  readonly enviando = signal(false);
  /** Error del envío, separado del de la lista: son dos fallos con dos remedios distintos. */
  readonly errorEnvio = signal<string | null>(null);

  readonly escaladas = computed(() => this.conversaciones().filter((c) => c.escalada).length);

  readonly puedeEnviar = computed(
    () =>
      !this.enviando() &&
      this.borrador().trim().length > 0 &&
      (this.detalle()?.ventana.abierta ?? false),
  );

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.estado.set('loading');
    this.error.set(null);

    this.service.getConversaciones({ solo_escaladas: this.soloEscaladas() }).subscribe({
      next: (data) => {
        this.sinModulo.set(!data.disponible);
        this.conversaciones.set(data.conversaciones);
        this.estado.set('success');
      },
      error: () => {
        this.error.set('No se pudieron cargar las conversaciones.');
        this.estado.set('error');
      },
    });
  }

  alternarEscaladas(): void {
    this.soloEscaladas.update((v) => !v);
    this.cargar();
  }

  abrir(conversacion: ConversacionBandeja): void {
    this.estadoDetalle.set('loading');
    this.errorEnvio.set(null);
    this.borrador.set('');

    this.service.getConversacion(conversacion.id_conversacion).subscribe({
      next: (data) => {
        this.detalle.set(data);
        this.estadoDetalle.set('success');
      },
      error: () => {
        this.errorEnvio.set('No se pudo abrir la conversación.');
        this.estadoDetalle.set('error');
      },
    });
  }

  cerrar(): void {
    this.detalle.set(null);
    this.estadoDetalle.set('idle');
    this.borrador.set('');
    this.errorEnvio.set(null);
  }

  enviar(): void {
    const actual = this.detalle();
    if (!actual || !this.puedeEnviar()) return;

    this.enviando.set(true);
    this.errorEnvio.set(null);
    const texto = this.borrador().trim();

    this.service.responder(actual.conversacion.id_conversacion, texto).subscribe({
      next: () => {
        this.borrador.set('');
        this.enviando.set(false);
        // Se recarga en vez de añadir la fila a mano: así el hilo enseña el estado de entrega
        // real que puso el backend, y no uno optimista que podría ser mentira.
        this.abrir(actual.conversacion);
        this.cargar();
      },
      error: (err) => {
        this.enviando.set(false);
        // El 409 es el caso previsto —la ventana se cerró mientras estaba escribiendo— y
        // merece el mensaje del backend, que dice exactamente qué pasó.
        this.errorEnvio.set(
          err?.error?.message ?? 'No se pudo enviar la respuesta. Inténtalo de nuevo.',
        );
        if (err?.status === 409) this.abrir(actual.conversacion);
      },
    });
  }

  /** Quién escribió, para el encabezado. El teléfono es el respaldo si no hay nombre. */
  quien(c: ConversacionBandeja): string {
    return c.persona || c.telefono_e164 || c.id_externo || 'Sin identificar';
  }

  esDeLaPersona(m: MensajeBandeja): boolean {
    return m.direccion === 'entrante';
  }

  /** Solo tres estados merecen pintarse: lo demás es ruido para quien no depura. */
  etiquetaEntrega(m: MensajeBandeja): string | null {
    if (m.direccion !== 'saliente') return null;
    if (m.estado_entrega === 'pendiente') return 'enviando…';
    if (m.estado_entrega === 'fallido') return 'no se pudo entregar';
    return null;
  }
}
