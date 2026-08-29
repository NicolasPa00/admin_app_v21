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
  MessageSquare, Send, Loader2, AlertCircle, Bot, Clock, TriangleAlert, RefreshCw, Inbox,
  Search, X, Check, Building2,
} from 'lucide-angular';

import { BandejaService } from '../../data-access/bandeja.service';
import { AuthService } from '../../../auth/data-access/auth.service';
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
 * no puede coger el teléfono y responder.
 *
 * ## Por qué se parece a WhatsApp, y hasta dónde
 *
 * Se copia **la forma**, no los colores: dos paneles, la lista a la izquierda con avatar y
 * último mensaje, el hilo a la derecha, burbujas con la hora dentro. Quien use esto ya sabe
 * usar WhatsApp y no debería tener que aprender otra cosa.
 *
 * Lo que **no** se copia es el verde. La paleta es dinámica por inquilino (`--color-primary` y
 * mezclas con `color-mix`): un verde fijo se vería mal en el negocio que elija otro color, y
 * además esto no es WhatsApp — es el panel de EscalApp.
 *
 * ## Las tres cosas que esta pantalla hace y una consola normal no haría
 *
 * 1. **Separa por negocio.** Un dueño con dos locales tiene dos números y dos conversaciones
 *    distintas con el mismo cliente. Mezclarlas sería contestarle a uno creyendo que es el
 *    otro. Los negocios salen del propio usuario autenticado, no de un endpoint nuevo.
 * 2. **Las escaladas primero y marcadas.** La pregunta no es «qué es lo último» sino «qué me
 *    está esperando».
 * 3. **La ventana de 24 h se enseña ANTES de escribir**, y también en la lista. Es la regla más
 *    restrictiva de WhatsApp: pasado ese plazo Meta rechaza el texto libre. Enterarse después de
 *    redactar un párrafo es la peor forma de descubrirlo.
 *
 * Y «enviado» no se dice hasta que lo está: el backend encola y entrega el Channel Gateway con
 * reintentos, así que un envío aceptado nace `pendiente` y se pinta «enviando…».
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
        MessageSquare, Send, Loader2, AlertCircle, Bot, Clock, TriangleAlert,
        RefreshCw, Inbox, Search, X, Check, Building2,
      }),
    },
  ],
  templateUrl: './bandeja.component.html',
  styleUrl: './bandeja.component.scss',
})
export class BandejaComponent implements OnInit {
  private readonly service = inject(BandejaService);
  private readonly auth = inject(AuthService);

  readonly estado = signal<LoadingState>('idle');
  readonly error = signal<string | null>(null);
  /** El esquema `intelligence` no está migrado en este entorno. No es una avería. */
  readonly sinModulo = signal(false);

  readonly conversaciones = signal<ConversacionBandeja[]>([]);
  readonly soloEscaladas = signal(false);
  readonly busqueda = signal('');

  /**
   * Negocio activo, o `null` para «todos».
   *
   * Se filtra **en el servidor**, no aquí: la lista viene con un límite, y filtrar después de
   * recortar enseñaría menos conversaciones de las que hay.
   */
  readonly negocioActivo = signal<number | null>(null);

  readonly detalle = signal<ConversacionBandejaDetalle | null>(null);
  readonly estadoDetalle = signal<LoadingState>('idle');
  readonly abierta = signal<string | null>(null);

  readonly borrador = signal('');
  readonly enviando = signal(false);
  /** Error del envío, separado del de la lista: son dos fallos con dos remedios distintos. */
  readonly errorEnvio = signal<string | null>(null);

  /** Los negocios del usuario. Ya vienen en la sesión — no hace falta pedirlos. */
  readonly negocios = computed(() => this.auth.currentUser()?.negocios ?? []);
  readonly variosNegocios = computed(() => this.negocios().length > 1);

  readonly escaladas = computed(() => this.conversaciones().filter((c) => c.escalada).length);

  /** La búsqueda sí es local: filtra lo que ya está en pantalla, como la de WhatsApp. */
  readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.conversaciones();
    return this.conversaciones().filter((c) =>
      `${this.quien(c)} ${c.ultimo_texto ?? ''}`.toLowerCase().includes(q),
    );
  });

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

    this.service
      .getConversaciones({
        solo_escaladas: this.soloEscaladas(),
        id_negocio: this.negocioActivo() ?? undefined,
      })
      .subscribe({
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

  filtrarPorNegocio(idNegocio: number | null): void {
    if (this.negocioActivo() === idNegocio) return;
    this.negocioActivo.set(idNegocio);
    this.cerrar();
    this.cargar();
  }

  alternarEscaladas(): void {
    this.soloEscaladas.update((v) => !v);
    this.cerrar();
    this.cargar();
  }

  abrir(conversacion: ConversacionBandeja): void {
    this.abierta.set(conversacion.id_conversacion);
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
    this.abierta.set(null);
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
        // Se recarga en vez de añadir la burbuja a mano: así el hilo enseña el estado de entrega
        // real que puso el backend, y no uno optimista que podría ser mentira.
        this.abrir(actual.conversacion);
        this.cargar();
      },
      error: (err) => {
        this.enviando.set(false);
        // El 409 es el caso previsto —la ventana se cerró mientras escribía— y merece el
        // mensaje del backend, que dice exactamente qué pasó.
        this.errorEnvio.set(
          err?.error?.message ?? 'No se pudo enviar la respuesta. Inténtalo de nuevo.',
        );
        if (err?.status === 409) this.abrir(actual.conversacion);
      },
    });
  }

  /** Quién escribió. El teléfono es el respaldo cuando la persona no está identificada. */
  quien(c: ConversacionBandeja): string {
    return c.persona || c.telefono_e164 || c.id_externo || 'Sin identificar';
  }

  /** Iniciales para el avatar. Dos letras como mucho: más no se leen en un círculo. */
  iniciales(c: ConversacionBandeja): string {
    const nombre = this.quien(c).trim();
    if (/^\+?\d/.test(nombre)) return nombre.slice(-2);
    return nombre
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  esDeLaPersona(m: MensajeBandeja): boolean {
    return m.direccion === 'entrante';
  }

  /** Solo tres estados merecen pintarse: lo demás es ruido para quien no depura. */
  etiquetaEntrega(m: MensajeBandeja): string | null {
    if (m.direccion !== 'saliente') return null;
    if (m.estado_entrega === 'pendiente') return 'enviando…';
    if (m.estado_entrega === 'fallido') return 'no se entregó';
    return null;
  }
}
