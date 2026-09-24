import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  input,
  output,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  NegocioSelector,
  SelectorNegocioComponent,
} from '../../../shared/selector-negocio/selector-negocio.component';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  AlertCircle,
  Check,
  CircleCheck,
  History,
  Loader2,
  MessageCircle,
  Smartphone,
  Store,
  Unlink,
} from 'lucide-angular';

import { environment } from '../../../../environments/environment';
import { AdminService } from '../../data-access/admin.service';
import { CanalWhatsappService } from '../../data-access/canalWhatsapp.service';
import { Negocio } from '../../models/admin.models';
import { DatosEmbeddedSignup, EstadoCanalWhatsapp } from '../../models/canalWhatsapp.models';

/**
 * Declarado a mano: el SDK de Facebook no trae tipos propios en este proyecto y no vale la pena
 * traer un paquete de tipos solo para dos llamadas.
 */
declare global {
  interface Window {
    FB?: {
      init(opciones: Record<string, unknown>): void;
      login(callback: (respuesta: { authResponse?: { code?: string } }) => void, opciones: Record<string, unknown>): void;
    };
    fbAsyncInit?: () => void;
  }
}

/**
 * CanalWhatsappComponent — conectar el número de WhatsApp del negocio (F8-D).
 *
 * ## Las dos opciones, y por qué son dos botones y no un selector
 *
 * La pregunta real que le hace esta pantalla al dueño del negocio es «¿te importa conservar tu
 * WhatsApp de siempre?» — no una configuración técnica. Por eso son dos tarjetas explicadas en
 * palabras, no un `<select>` con "manual" / "embedded_signup":
 *
 *   A) **Gestionado por EscalApp** — no hay nada que construir aquí: es la alta manual que ya
 *      existe, y esta pantalla solo explica qué implica (pierde su historial) y deja un botón de
 *      contacto. No llama a ningún endpoint nuevo.
 *   B) **Tu propio número** — dispara el SDK de Embedded Signup de Meta. Es la que sí es nueva.
 *
 * ## El `code` no se guarda, nunca
 *
 * El evento del SDK entrega un `code` que caduca en 30 segundos. El manejador lo manda al
 * backend en la misma función que lo recibe — no pasa por un signal intermedio del que alguien
 * pudiera "reintentar" más tarde con un código ya muerto.
 */
@Component({
  selector: 'app-canal-whatsapp',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, SelectorNegocioComponent],
  templateUrl: './canal-whatsapp.component.html',
  styleUrl: './canal-whatsapp.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        AlertCircle,
        Check,
        CircleCheck,
        History,
        Loader2,
        MessageCircle,
        Smartphone,
        Store,
        Unlink,
      }),
    },
  ],
})
export class CanalWhatsappComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly canalService = inject(CanalWhatsappService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly cargando = signal(true);
  readonly conectando = signal(false);
  readonly error = signal<string | null>(null);

  readonly negocios = signal<Negocio[]>([]);
  readonly idNegocio = signal<number | null>(null);

  /** Negocio con el que arrancar; lo pasa la vista WhatsApp cuando ya lo eligió arriba. */
  readonly negocioInicial = input<number | null>(null);
  /** La vista WhatsApp tiene su propio selector: aquí se esconde para no tener dos. */
  readonly ocultarSelector = input(false);
  /** La vista WhatsApp pinta el título y el subtítulo ella misma, para poner los chips debajo. */
  readonly ocultarEncabezado = input(false);
  /** Avisa el estado tras cada consulta, conectar o desconectar, para que el contenedor cambie de vista. */
  readonly estadoCambio = output<{ idNegocio: number; conectado: boolean }>();
  readonly estadoCanal = signal<EstadoCanalWhatsapp | null>(null);

  /**
   * Chips de la pantalla suelta. Solo del negocio abierto se sabe si está conectado (una consulta
   * por negocio serían N llamadas); los demás van en neutro.
   */
  readonly opcionesNegocio = computed<NegocioSelector[]>(() =>
    this.negocios().map((n) => {
      if (n.id_negocio !== this.idNegocio() || this.estadoCanal() === null) {
        return { id: n.id_negocio, nombre: n.nombre };
      }
      const ok = this.conectado();
      return {
        id: n.id_negocio,
        nombre: n.nombre,
        estado: ok ? 'ok' : 'aviso',
        titulo: ok ? 'WhatsApp activo' : 'Aún sin WhatsApp',
      } satisfies NegocioSelector;
    }),
  );

  readonly negocioActual = computed(() => this.negocios().find((n) => n.id_negocio === this.idNegocio()));

  readonly conectado = computed(() => this.estadoCanal()?.conectado === true);
  readonly esPropio = computed(() => this.estadoCanal()?.origen === 'embedded_signup');

  /** Confirmación de dos pasos para desconectar — nunca en el primer clic: es una acción con
   *  consecuencia real (el asistente deja de responder por este número hasta reconectarlo). */
  readonly confirmandoDesconectar = signal(false);
  readonly desconectando = signal(false);

  /** Sin `metaAppId`/`metaConfigId` en el entorno, el botón de la Opción B no tiene con qué abrir. */
  readonly embeddedSignupDisponible = computed(
    () => Boolean(environment.metaAppId) && Boolean(environment.metaConfigId),
  );

  private sdkCargado = false;

  /** Mismo enlace de contacto que usa la landing (`environment.whatsappUrl`). */
  protected readonly whatsappSoporte = `${environment.whatsappUrl}?text=${encodeURIComponent(
    'Hola, quiero activar el WhatsApp gestionado por EscalApp',
  )}`;

  /** Ayuda con la activación o algún trámite: el mismo canal de soporte, con el texto ya escrito. */
  protected readonly whatsappAyuda = `${environment.whatsappUrl}?text=${encodeURIComponent(
    'Hola, tengo una duda con la activación de WhatsApp en mi negocio',
  )}`;

  ngOnInit(): void {
    this.adminService.getMisNegociosUsuario().subscribe({
      next: (negocios) => {
        this.negocios.set(negocios);
        if (negocios.length > 0) {
          const inicial = this.negocioInicial();
          const existe = negocios.some((n) => n.id_negocio === inicial);
          this.seleccionar(existe && inicial !== null ? inicial : negocios[0].id_negocio);
        } else {
          this.cargando.set(false);
        }
      },
      error: () => {
        this.error.set('No se pudieron cargar tus negocios.');
        this.cargando.set(false);
      },
    });
  }

  seleccionar(idNegocio: number): void {
    this.idNegocio.set(idNegocio);
    this.cargando.set(true);
    this.error.set(null);
    this.confirmandoDesconectar.set(false);

    this.canalService.getEstado(idNegocio).subscribe({
      next: (estado) => {
        this.estadoCanal.set(estado);
        this.cargando.set(false);
        this.estadoCambio.emit({ idNegocio, conectado: estado?.conectado === true });
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo consultar el estado del canal.');
        this.cargando.set(false);
      },
    });
  }

  protected pedirConfirmacionDesconectar(): void {
    this.confirmandoDesconectar.set(true);
  }

  protected cancelarDesconectar(): void {
    this.confirmandoDesconectar.set(false);
  }

  protected confirmarDesconectar(): void {
    const idNegocio = this.idNegocio();
    if (!idNegocio) return;

    this.desconectando.set(true);
    this.error.set(null);

    this.canalService.desconectar(idNegocio).subscribe({
      next: () => {
        this.desconectando.set(false);
        this.confirmandoDesconectar.set(false);
        this.seleccionar(idNegocio);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo desconectar el número.');
        this.desconectando.set(false);
        this.confirmandoDesconectar.set(false);
      },
    });
  }

  /**
   * Carga el SDK de Facebook, solo en el navegador (SSR-safe) y solo una vez. Inicializado con
   * `metaAppId`, listo para que `iniciarConexionPropia()` abra el flujo.
   */
  private cargarSdk(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return Promise.resolve();
    if (this.sdkCargado || window.FB) {
      this.sdkCargado = true;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      window.fbAsyncInit = () => {
        window.FB?.init({ appId: environment.metaAppId, version: 'v21.0' });
        this.sdkCargado = true;
        resolve();
      };
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/es_LA/sdk.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    });
  }

  /**
   * Opción B: dispara el flujo de Embedded Signup. El `code` que devuelve `FB.login()` se manda
   * de inmediato a `canjear()` — nada se guarda entre medio.
   */
  async iniciarConexionPropia(): Promise<void> {
    const idNegocio = this.idNegocio();
    if (!idNegocio || !this.embeddedSignupDisponible()) return;

    this.error.set(null);
    this.conectando.set(true);
    await this.cargarSdk();

    if (!window.FB) {
      this.error.set('No se pudo cargar el conector de WhatsApp. Intenta de nuevo.');
      this.conectando.set(false);
      return;
    }

    // El evento `message` de tipo `WA_EMBEDDED_SIGNUP` es el mecanismo documentado de Meta para
    // entregar `phone_number_id` — separado del `code` que devuelve `FB.login()`. Se escucha
    // ANTES de abrir el login, porque el mensaje puede llegar antes que el callback.
    //
    // ⚠️ Este evento NO trae `display_phone_number` (probado en producción el 2026-09-19: llegaba
    // `undefined` siempre, no solo esa vez). El número legible se resuelve del lado del backend
    // con el access token, no aquí — ver `embeddedSignupApi.js#resolverNumero`. `numeroE164` se
    // manda igual por si el backend lo necesita como respaldo, pero normalmente viaja `null`.
    let datosEmbedded: Omit<DatosEmbeddedSignup, 'code'> | null = null;
    const escuchador = (evento: MessageEvent) => {
      if (evento.origin !== 'https://www.facebook.com') return;
      try {
        const datos = JSON.parse(evento.data);
        if (datos.type === 'WA_EMBEDDED_SIGNUP' && datos.event === 'FINISH') {
          datosEmbedded = {
            phoneNumberId: datos.data?.phone_number_id,
            numeroE164: datos.data?.display_phone_number ?? null,
            businessId: datos.data?.business_id ?? null,
          };
        }
      } catch {
        // Mensajes de otros orígenes/formatos de Facebook que no son el que esperamos — se
        // ignoran, no es un error de esta pantalla.
      }
    };
    window.addEventListener('message', escuchador);

    window.FB.login(
      (respuesta) => {
        window.removeEventListener('message', escuchador);
        const code = respuesta.authResponse?.code;
        if (!code || !datosEmbedded) {
          this.error.set('No se completó la conexión con WhatsApp. Vuelve a intentarlo.');
          this.conectando.set(false);
          return;
        }
        this.canjear(idNegocio, code, datosEmbedded);
      },
      {
        config_id: environment.metaConfigId,
        response_type: 'code',
        override_default_response_type: true,
      },
    );
  }

  private canjear(idNegocio: number, code: string, datos: Omit<DatosEmbeddedSignup, 'code'>): void {
    this.canalService
      .canjear(idNegocio, code, datos.phoneNumberId, datos.numeroE164 ?? null, datos.businessId ?? null)
      .subscribe({
        next: () => {
          this.conectando.set(false);
          this.seleccionar(idNegocio);
        },
        error: (err) => {
          // CANAL_YA_CONECTADO / META_CANJE_FALLIDO ya traen un mensaje enseñable del backend.
          this.error.set(err?.error?.message ?? 'No se pudo conectar tu WhatsApp.');
          this.conectando.set(false);
        },
      });
  }

  /** Para el `@for` de la plantilla, si hay más de un negocio. */
  trackNegocio = (_: number, n: Negocio) => n.id_negocio;
}
