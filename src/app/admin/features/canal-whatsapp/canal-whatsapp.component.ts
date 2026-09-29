import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
  RefreshCw,
  Smartphone,
  Store,
  Unlink,
} from 'lucide-angular';

import { environment } from '../../../../environments/environment';
import { AdminService } from '../../data-access/admin.service';
import { CanalWhatsappService } from '../../data-access/canalWhatsapp.service';
import { Negocio } from '../../models/admin.models';
import {
  EstadoCanalWhatsapp,
  EventoEmbeddedSignup,
  ModoConexion,
} from '../../models/canalWhatsapp.models';

/**
 * Declarado a mano: el SDK de Facebook no trae tipos propios en este proyecto y no vale la pena
 * traer un paquete de tipos solo para dos llamadas.
 */
declare global {
  interface Window {
    FB?: {
      init(opciones: Record<string, unknown>): void;
      login(
        callback: (respuesta: { authResponse?: { code?: string } | null; status?: string }) => void,
        opciones: Record<string, unknown>,
      ): void;
    };
    fbAsyncInit?: () => void;
  }
}

/**
 * Lee un `postMessage` de la ventana de Meta. `null` si no es un evento de Embedded Signup.
 *
 * El origen se compara por dominio y no contra `https://www.facebook.com` exacto: en móvil la
 * ventana puede ser `m.facebook.com` o `web.facebook.com`, y con la comparación exacta el evento
 * se descartaba en silencio. El dato puede venir como texto JSON o ya como objeto.
 */
function leerEventoMeta(evento: MessageEvent): EventoEmbeddedSignup | null {
  if (!/^https:\/\/([a-z0-9-]+\.)*facebook\.com$/i.test(evento.origin)) return null;
  let datos: unknown = evento.data;
  if (typeof datos === 'string') {
    try {
      datos = JSON.parse(datos);
    } catch {
      return null; // otros mensajes de Facebook que no son este
    }
  }
  const e = datos as EventoEmbeddedSignup | null;
  return e && e.type === 'WA_EMBEDDED_SIGNUP' && typeof e.event === 'string' ? e : null;
}

/** Qué camino de Embedded Signup se abre. Ver `ModoConexion` en los modelos. */
const FEATURE_COEXISTENCIA = 'whatsapp_business_app_onboarding';

/** Eventos `WA_EMBEDDED_SIGNUP` que significan «terminó y hay algo que canjear». */
const EVENTOS_FIN = new Set([
  'FINISH',
  'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
  'FINISH_ONLY_WABA',
]);

/** Cuánto se espera el evento del SDK tras el callback de `FB.login` (el `code` vive 30 s). */
const ESPERA_EVENTO_MS = 2500;
/** Si el SDK no ha cargado en este tiempo, se da por bloqueado (bloqueador, red, Safari). */
const LIMITE_CARGA_SDK_MS = 15000;

/**
 * CanalWhatsappComponent — conectar el número de WhatsApp del negocio (F8-D).
 *
 * ## Las opciones, y por qué son botones y no un selector
 *
 * La pregunta real que le hace esta pantalla al dueño del negocio es «¿te importa conservar tu
 * WhatsApp de siempre?» — no una configuración técnica:
 *
 *   A) **Gestionado por EscalApp** — la alta manual que ya existe; solo un botón de contacto.
 *   B) **Tu propio número**, con dos caminos (desde 2026-09-28):
 *      - **«Ya uso WhatsApp Business»** → coexistencia (`featureType:
 *        'whatsapp_business_app_onboarding'`). El número sigue en la app del celular, con sus
 *        chats y contactos. Es lo que casi todo negocio quiere.
 *      - **«Usar un número nuevo»** → Embedded Signup estándar. El número no puede estar en
 *        ninguna app de WhatsApp: si lo está, Meta responde «Este número ya está registrado en una
 *        cuenta de WhatsApp» — que es exactamente lo que pasó con el primer cliente real cuando
 *        solo existía este camino.
 *
 * ## iPhone: `FB.login()` tiene que salir del mismo toque
 *
 * Safari (iOS) solo deja abrir la ventana de Facebook si `window.open` ocurre dentro del gesto del
 * usuario. La versión anterior hacía `await cargarSdk()` y LUEGO `FB.login()`: la descarga del SDK
 * rompía el gesto y Safari bloqueaba la ventana sin avisar (el botón se quedaba en «Conectando…»).
 * Ahora el SDK se carga al abrir la pantalla y el clic llama a `FB.login()` de forma síncrona; los
 * botones esperan en «Preparando…» hasta que el SDK está listo.
 *
 * ## El `code` no se guarda, nunca
 *
 * El `code` caduca en 30 segundos. Se manda al backend en cuanto llega — no pasa por un signal
 * intermedio del que alguien pudiera "reintentar" más tarde con un código ya muerto.
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
        RefreshCw,
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

  readonly esCoexistencia = computed(() => this.estadoCanal()?.coexistencia === true);

  /** Sin `metaAppId`/`metaConfigId` en el entorno, el botón de la Opción B no tiene con qué abrir. */
  readonly embeddedSignupDisponible = computed(
    () => Boolean(environment.metaAppId) && Boolean(environment.metaConfigId),
  );

  /** El SDK de Facebook se carga al abrir la pantalla (ver la cabecera: iPhone). */
  readonly sdkEstado = signal<'cargando' | 'listo' | 'error'>('cargando');
  /** Qué camino está en curso, para el texto del botón y de la ayuda. */
  readonly modoEnCurso = signal<ModoConexion | null>(null);
  /**
   * Navegador dentro de Facebook/Instagram/Messenger: ahí la ventana de Facebook no se abre bien.
   * Se avisa para que abran el enlace en Safari o Chrome.
   */
  readonly navegadorIntegrado = signal(false);

  /** Cada intento tiene su número: un callback de un intento cancelado no pisa al siguiente. */
  private intento = 0;
  private escuchador: ((evento: MessageEvent) => void) | null = null;
  private eventoMeta: EventoEmbeddedSignup | null = null;
  private relojSdk: ReturnType<typeof setTimeout> | null = null;
  private readonly destroyRef = inject(DestroyRef);

  /** Mismo enlace de contacto que usa la landing (`environment.whatsappUrl`). */
  protected readonly whatsappSoporte = `${environment.whatsappUrl}?text=${encodeURIComponent(
    'Hola, quiero activar el WhatsApp gestionado por EscalApp',
  )}`;

  /** Ayuda con la activación o algún trámite: el mismo canal de soporte, con el texto ya escrito. */
  protected readonly whatsappAyuda = `${environment.whatsappUrl}?text=${encodeURIComponent(
    'Hola, tengo una duda con la activación de WhatsApp en mi negocio',
  )}`;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.navegadorIntegrado.set(/FBAN|FBAV|FB_IAB|Instagram|Messenger/i.test(navigator.userAgent));
      if (this.embeddedSignupDisponible()) this.cargarSdk();
    }
    this.destroyRef.onDestroy(() => {
      this.quitarEscuchador();
      if (this.relojSdk) clearTimeout(this.relojSdk);
    });

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
   * Carga el SDK de Facebook una sola vez, al abrir la pantalla — nunca dentro del clic (ver la
   * cabecera: iPhone). Detecta el bloqueo (bloqueador de anuncios, protección de rastreo, red) en
   * vez de dejar el botón esperando para siempre.
   */
  private cargarSdk(): void {
    if (window.FB) {
      this.sdkEstado.set('listo');
      return;
    }
    this.sdkEstado.set('cargando');

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: environment.metaAppId,
        autoLogAppEvents: true,
        xfbml: false,
        version: environment.metaSdkVersion,
      });
      if (this.relojSdk) clearTimeout(this.relojSdk);
      this.sdkEstado.set('listo');
    };

    // Un intento anterior que falló deja su <script>: se quita para que el reintento sea real.
    document.getElementById('facebook-jssdk')?.remove();
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/es_LA/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => this.sdkEstado.set('error');
    document.body.appendChild(script);

    if (this.relojSdk) clearTimeout(this.relojSdk);
    this.relojSdk = setTimeout(() => {
      if (this.sdkEstado() === 'cargando' && !window.FB) this.sdkEstado.set('error');
    }, LIMITE_CARGA_SDK_MS);
  }

  protected reintentarSdk(): void {
    this.error.set(null);
    this.cargarSdk();
  }

  /**
   * Abre la ventana de Meta. **Síncrono hasta `FB.login()`** — nada de `await` antes: Safari en
   * iPhone bloquea la ventana si la apertura no sale del mismo toque.
   *
   * El `phone_number_id` llega por un evento `message` (`WA_EMBEDDED_SIGNUP`) separado del `code`.
   * Se escucha ANTES de abrir, porque puede llegar antes que el callback; y si no llega, el
   * backend descubre el número en la WABA que concedió el token.
   */
  conectar(modo: ModoConexion): void {
    const idNegocio = this.idNegocio();
    if (!idNegocio || !this.embeddedSignupDisponible() || this.conectando()) return;
    if (this.sdkEstado() !== 'listo' || !window.FB) {
      this.error.set('El conector de Facebook todavía no está listo. Espera un momento y vuelve a intentarlo.');
      return;
    }

    const miIntento = ++this.intento;
    this.error.set(null);
    this.eventoMeta = null;
    this.modoEnCurso.set(modo);
    this.conectando.set(true);

    this.quitarEscuchador();
    this.escuchador = (evento: MessageEvent) => {
      const datos = leerEventoMeta(evento);
      if (datos && miIntento === this.intento) this.eventoMeta = datos;
    };
    window.addEventListener('message', this.escuchador);

    window.FB.login(
      (respuesta) => {
        void this.alTerminarLogin(respuesta.authResponse?.code ?? null, miIntento, idNegocio, modo);
      },
      {
        config_id: environment.metaConfigId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: '3',
          ...(modo === 'coexistencia' ? { featureType: FEATURE_COEXISTENCIA } : {}),
        },
      },
    );
  }

  /** Por si la ventana nunca se abrió (bloqueada) o se quedó colgada: deja volver a empezar. */
  protected cancelarConexion(): void {
    this.intento++;
    this.quitarEscuchador();
    this.conectando.set(false);
    this.modoEnCurso.set(null);
  }

  private async alTerminarLogin(
    code: string | null,
    miIntento: number,
    idNegocio: number,
    modo: ModoConexion,
  ): Promise<void> {
    if (miIntento !== this.intento) return; // cancelado entretanto

    if (!code) {
      this.quitarEscuchador();
      const evento = this.eventoMeta;
      const errorMeta = evento?.event === 'CANCEL' ? evento.data?.error_message : null;
      this.error.set(
        errorMeta
          ? `Meta no completó la conexión: ${errorMeta}`
          : 'Se cerró la ventana de Facebook antes de terminar. Vuelve a intentarlo cuando quieras.',
      );
      this.conectando.set(false);
      this.modoEnCurso.set(null);
      return;
    }

    // El evento con el número suele llegar antes que el callback, pero no siempre: se espera un
    // poco (el `code` vive 30 s) y, si no llega, se canjea igual — el backend lo resuelve.
    const limite = Date.now() + ESPERA_EVENTO_MS;
    while (!this.eventoFinal() && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (miIntento !== this.intento) return;
    this.quitarEscuchador();

    const datos = this.eventoFinal()?.data ?? {};
    this.canalService
      .canjear(idNegocio, {
        code,
        modo,
        phoneNumberId: datos.phone_number_id ?? null,
        numeroE164: datos.display_phone_number ?? null,
        businessId: datos.business_id ?? null,
      })
      .subscribe({
        next: () => {
          this.conectando.set(false);
          this.modoEnCurso.set(null);
          this.seleccionar(idNegocio);
        },
        error: (err) => {
          // Los errores de dominio (CANAL_*, META_*) ya traen un mensaje enseñable del backend.
          this.error.set(err?.error?.message ?? 'No se pudo conectar tu WhatsApp.');
          this.conectando.set(false);
          this.modoEnCurso.set(null);
        },
      });
  }

  /** El evento de fin (con o sin número), o `null` si todavía no llegó. */
  private eventoFinal(): EventoEmbeddedSignup | null {
    const e = this.eventoMeta;
    return e && EVENTOS_FIN.has(e.event) ? e : null;
  }

  private quitarEscuchador(): void {
    if (this.escuchador && isPlatformBrowser(this.platformId)) {
      window.removeEventListener('message', this.escuchador);
    }
    this.escuchador = null;
  }

  /** Para el `@for` de la plantilla, si hay más de un negocio. */
  trackNegocio = (_: number, n: Negocio) => n.id_negocio;
}
