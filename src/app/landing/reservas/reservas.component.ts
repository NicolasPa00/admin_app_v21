import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AssetService } from '../../core/services/asset.service';
import { SeoService } from '../../core/services/seo.service';
import { montarEntradas } from '../shared/entradas';
import { PAQUETES_EXTRA_FE, PlanFe, TRAMOS_FE, calcularFe, nombrePlanFe } from '../shared/facturacion';
import { TemaSelectorComponent } from '../shared/tema-selector.component';
import { PruebaGratisStore } from '../shared/prueba-gratis.store';
import { environment } from '../../../environments/environment';

/**
 * La página del motor de reserva — «La agenda».
 *
 * Misma mecánica que `/restaurantes` (escenario con chat, relevo que cambia la captura al bajar,
 * precio, mensajes, cierre) y las mismas tres reglas: la primera pantalla dice qué es y qué hacer en
 * palabras llanas; todo se demuestra solo al entrar en pantalla; marco con tope de ancho.
 *
 * ## Lo que esta página NO dice (y por qué) — `admin_ws/docs/landing-reservas.md` §1
 *
 * - **No dice «IA».** El asistente de reserva es un flujo guiado (servicio, profesional, día, hora,
 *   nombre), no un modelo de lenguaje. Se llama «asistente» a secas.
 * - **No promete flujos por oficio** (elegir el largo del cabello, cotizar un tatuaje por chat): están
 *   en análisis, sin implementar.
 * - **No lleva cifras de uso.** No hay clientes de Reserva en Colombia que publicar; la sección de
 *   cifras de `/restaurantes` no tiene equivalente y se sustituyó por una explicación, no por números.
 * - **No anuncia la facturación electrónica**: existe para restaurante, no para Reserva.
 *
 * Las capturas son de `reserva_app` con datos de demostración sembrados a propósito
 * (`admin_ws/scripts/seed_demo_landing_reserva.mjs`): nombres inventados, ningún cliente real.
 */

/** Una parada del relevo: una captura del producto y la frase llana que la explica. */
interface ParadaRelevo {
  id: string;
  /** La etiqueta del salto manual. */
  etiqueta: string;
  titulo: string;
  frase: string;
  /**
   * Tres cosas concretas que se ven en esa misma captura.
   *
   * No son adorno: sin ellas la columna de texto quedaba con dos líneas frente a una captura de
   * 450 px de alto, y a 1366×768 la sección se leía como una página a medio hacer.
   */
  detalles: string[];
  /** El archivo dentro de `images/producto/`. */
  imagen: string;
  /** Lo que lee quien no ve la imagen. Describe la pantalla, no la repite. */
  alt: string;
}

/**
 * Un plan, como se ve en su tarjeta. Lo completo vive en la tabla de `COMPARACION`.
 *
 * La tarjeta del asistente NO repite lo del Emprendedor: arranca con «Todo lo del Emprendedor,
 * más:» y enseña solo lo que la distingue. Antes repetía cuatro líneas de la otra y la diferencia
 * —que es el titular de la sección— había que buscarla.
 */
interface Plan {
  id: 'base' | 'asistente';
  nombre: string;
  precio: string;
  que: string;
  /** La línea que abre la lista, cuando la lista es «lo de antes, más esto». */
  antesDeLista?: string;
  /** Lo que se ve en la tarjeta. Seis, no más. */
  destacados: string[];
  /** La diferencia entre los dos, dicha con las mismas palabras en ambos. */
  sello: string;
}

/**
 * Una fila de la tabla que compara los dos planes. `true` es un visto, `false` una raya («no
 * incluido») y un texto se escribe tal cual (las cantidades: «8», «10»).
 */
interface FilaComparada {
  texto: string;
  base: boolean | string;
  asistente: boolean | string;
}

interface GrupoComparado {
  titulo: string;
  filas: FilaComparada[];
}

/** Una burbuja del chat. El único trozo de interfaz dibujado a mano, porque es lo que se anima. */
interface Burbuja {
  de: 'cliente' | 'asistente';
  texto: string;
  hora: string;
}

const PARADAS: ParadaRelevo[] = [
  {
    id: 'pagina',
    etiqueta: 'Tu página',
    titulo: 'Tus clientes también agendan solos',
    frase:
      'Cada negocio tiene su propia página, con su logo, sus fotos, sus servicios y sus precios. El cliente elige, agenda y la cita cae en la agenda sin que nadie conteste.',
    detalles: [
      'Servicios con su precio y su duración',
      'Dirección propia, tunegocio.escalapp.cloud',
      'Funciona en el celular, sin descargar nada',
    ],
    imagen: 'reserva-pagina',
    alt: 'La página pública de una barbería: su logo, un banner con foto, las categorías de servicios y, por cada servicio, su foto, su precio y su duración.',
  },
  {
    id: 'agenda',
    etiqueta: 'Agenda',
    titulo: 'El día de cada profesional, en una sola vista',
    frase:
      'Una columna por profesional, con sus horarios; lo que queda fuera de horario se ve en gris. La cita que agenda el asistente aparece sola, sin que nadie la teclee.',
    detalles: [
      'Una columna por profesional',
      'Confirmadas y pendientes, cada una con su color',
      'Nueva cita a mano cuando el cliente llama',
    ],
    imagen: 'reserva-agenda',
    alt: 'Agenda de un salón con una columna por profesional y las citas del día, con el cliente, el servicio y su estado.',
  },
  {
    id: 'citas',
    etiqueta: 'Citas',
    titulo: 'Todas las citas en una lista',
    frase:
      'Filtra por fecha, profesional o estado. Cada cita se confirma, se cobra, se cancela o se marca como inasistencia.',
    detalles: [
      'Filtros por fecha, profesional y estado',
      'El estado de cada cita, a la vista',
      'Cada cliente queda con su historial',
    ],
    imagen: 'reserva-citas',
    alt: 'Lista de citas con la fecha, la hora, el cliente, el servicio, el profesional y el estado de cada una.',
  },
  {
    id: 'caja',
    etiqueta: 'Caja',
    titulo: 'El turno cuadra',
    frase:
      'Abres el turno, cobras cada cita en efectivo, tarjeta o transferencia y cierras. El arqueo sale con el desglose por forma de pago.',
    detalles: [
      'Base de apertura, ingresos y egresos',
      'Desglose por cada forma de pago',
      'Lo que debería haber en el cajón',
    ],
    imagen: 'reserva-caja',
    alt: 'Pantalla de caja con el turno abierto, el total por forma de pago y los movimientos de cada cita cobrada.',
  },
  {
    id: 'informes',
    etiqueta: 'Informes',
    titulo: 'Al final del mes lo sabes',
    frase:
      'Cuánto entró, cuántos servicios se hicieron, cuántas citas se cancelaron y cuántos clientes no llegaron, por periodo y por profesional.',
    detalles: [
      'Ingresos, servicios y ticket promedio',
      'Cancelaciones e inasistencias en porcentaje',
      'Horas trabajadas por el equipo',
    ],
    imagen: 'reserva-informes',
    alt: 'Informes del negocio con los ingresos del periodo, los servicios realizados, las cancelaciones y las inasistencias.',
  },
];

/**
 * La conversación de la madrugada.
 *
 * **No es de un cliente real.** Es una demostración escrita con el mismo orden de pasos que sigue el
 * asistente (servicio, profesional, hora, nombre); sacar mensajes reales a una pieza pública sería un
 * problema de privacidad.
 */
const CONVERSACION: Burbuja[] = [
  { de: 'cliente', texto: 'Hola, quiero un corte y barba para mañana', hora: '1:47 a. m.' },
  {
    de: 'asistente',
    texto: /* taste-skill-ignore: va dentro de un chat, es contenido */ 'Hola 👋 Con gusto. ¿Con Andrés o con Marco? Mañana quedan 10:30, 11:15 y 2:00 p. m.',
    hora: '1:47 a. m.',
  },
  { de: 'cliente', texto: 'Con Andrés, a las 10:30', hora: '1:48 a. m.' },
  {
    de: 'asistente',
    texto: 'Listo: corte y barba mañana a las 10:30 con Andrés, $50.000. ¿A nombre de quién la dejo?',
    hora: '1:48 a. m.',
  },
];

/**
 * Un oficio de la galería «Un solo sistema, ocho oficios».
 *
 * La `frase` dice lo que cambia en ese oficio, y solo lo que el producto ya hace (fuentes:
 * `admin_ws/docs/perfiles-de-reserva.md` §4 y §11.1). No se prometen flujos del asistente por oficio
 * (siguen en análisis). Las imágenes son fotos de un banco gratuito (desde 2026-10-27; antes,
 * ilustraciones de `admin_app-v21/scripts/demo-landing/`): en la página de un negocio van sus fotos.
 */
interface OficioGaleria {
  slug: string;
  nombre: string;
  frase: string;
  alt: string;
}

const OFICIOS_GALERIA: OficioGaleria[] = [
  { slug: 'barberia', nombre: 'Barbería', frase: 'Agenda por barbero, con sus servicios, precios y duraciones.', alt: 'Un barbero atiende a un cliente recostado en la silla.' },
  { slug: 'salon', nombre: 'Salón de belleza', frase: 'Tiempo de proceso del tinte y precios «desde» según el largo.', alt: 'Una maquilladora trabaja frente al espejo de luces de un salón.' },
  { slug: 'spa', nombre: 'Spa', frase: 'Cabinas y equipos: no se ofrece una hora si no hay cabina libre.', alt: 'Una terapeuta da un masaje en una cabina de spa.' },
  { slug: 'estetica', nombre: 'Centro de estética', frase: 'Cabinas, ficha del cliente y consentimiento antes del tratamiento.', alt: 'Una especialista hace un tratamiento facial a una clienta.' },
  { slug: 'tatuajes', nombre: 'Tatuajes y perforaciones', frase: 'Servicios «a cotizar» que van a tu WhatsApp, y el portafolio de cada artista.', alt: 'Un tatuador trabaja con guantes sobre el brazo de un cliente.' },
  { slug: 'mascotas', nombre: 'Cuidado de mascotas', frase: 'Datos de la mascota; su tamaño define la duración y el precio.', alt: 'Un perro pequeño y blanco durante su corte de pelo.' },
  { slug: 'consultorio', nombre: 'Consultorio', frase: 'Agenda por profesional, con sus horarios y su lista de clientes.', alt: 'Una médica toma notas en su consultorio.' },
  { slug: 'hospedaje', nombre: 'Hospedaje', frase: 'Reserva por noches, anticipo y calendario sincronizado con Airbnb y Booking.', alt: 'Una habitación de hotel con dos camas tendidas.' },
];

const PLANES: Plan[] = [
  {
    id: 'base',
    nombre: 'Emprendedor',
    precio: '$37.999',
    que: 'El sistema completo para llevar tu agenda desde el primer día.',
    destacados: [
      '8 usuarios y 1 caja incluidos',
      'Agenda por profesional, con sus horarios',
      'Página propia para que tus clientes agenden solos',
      'Abono para asegurar la cita',
      'Servicios, cabinas y venta de productos',
      'Clientes con su historial',
    ],
    sello: 'El WhatsApp lo sigues contestando tú.',
  },
  {
    id: 'asistente',
    nombre: 'Emprendedor con asistente',
    precio: '$77.999',
    que: 'Un asistente que atiende tu WhatsApp por ti.',
    antesDeLista: 'Todo lo del Emprendedor, más:',
    destacados: [
      '10 usuarios y 2 cajas incluidos',
      'Contesta tu WhatsApp a cualquier hora, también con el negocio cerrado',
      'Ofrece las horas libres y deja la cita en la agenda',
      'Manda el recordatorio de la cita un día antes',
      'Te pasa el turno si hace falta una persona',
    ],
    sello: 'El WhatsApp lo contesta el asistente, también de madrugada.',
  },
];

/**
 * La comparación completa, por temas. El asistente va primero porque es la diferencia; el resto
 * lo traen los dos y se lee de un vistazo bajando por la columna de vistos.
 */
const COMPARACION: GrupoComparado[] = [
  {
    titulo: 'El asistente en WhatsApp',
    filas: [
      { texto: 'Contesta al instante, a cualquier hora, también con el negocio cerrado', base: false, asistente: true },
      { texto: 'Ofrece las horas libres de cada profesional y deja la cita en la agenda', base: false, asistente: true },
      { texto: 'Manda el recordatorio de la cita por WhatsApp un día antes', base: false, asistente: true },
      { texto: 'Si hace falta una persona, te pasa el turno en vez de inventarse una respuesta', base: false, asistente: true },
      { texto: 'Ves y contestas todas las conversaciones desde el sistema', base: false, asistente: true },
      { texto: 'Conectas el WhatsApp de tu negocio. Si no puedes, lo hacemos contigo', base: false, asistente: true },
    ],
  },
  {
    titulo: 'Agenda y clientes',
    filas: [
      { texto: 'Agenda por profesional, con sus horarios', base: true, asistente: true },
      { texto: 'Página propia para que tus clientes agenden solos', base: true, asistente: true },
      { texto: 'Abono para asegurar la cita', base: true, asistente: true },
      { texto: 'Clientes con su historial', base: true, asistente: true },
      { texto: 'Hospedaje sincronizado con Airbnb y Booking', base: true, asistente: true },
    ],
  },
  {
    titulo: 'Caja y ventas',
    filas: [
      { texto: 'Servicios, cabinas y venta de productos', base: true, asistente: true },
      { texto: 'Caja con varios medios de pago', base: true, asistente: true },
      { texto: 'Informes de ingresos, cancelaciones e inasistencias', base: true, asistente: true },
    ],
  },
  {
    titulo: 'Tu equipo',
    filas: [
      { texto: 'Usuarios incluidos', base: '8', asistente: '10' },
      { texto: 'Cajas incluidas', base: '1', asistente: '2' },
      { texto: 'Cada persona entra con su usuario y sus permisos', base: true, asistente: true },
      { texto: 'Funciona en celular, tablet y computador', base: true, asistente: true },
    ],
  },
];

/**
 * Los oficios que ofrece el registro de esta página: los del motor de reserva, tal como los lista
 * la landing viva (`RUBROS_REGISTRO`). El `nombre` es lo que viaja al backend; se validan contra la
 * base al registrarse. Las etiquetas son el respaldo para cuando la API no contesta (prerender).
 */
const OFICIOS_RESERVA: { nombre: string; label: string }[] = [
  { nombre: 'BARBERIA', label: 'Barbería' },
  { nombre: 'SALON DE BELLEZA', label: 'Salón de belleza' },
  { nombre: 'SPA Y ESTETICA', label: 'Spa' },
  { nombre: 'CENTRO DE ESTETICA', label: 'Centro de estética' },
  { nombre: 'TATUAJES Y PERFORACIONES', label: 'Tatuajes y perforaciones' },
  { nombre: 'PELUQUERIA CANINA', label: 'Cuidado de mascotas' },
  { nombre: 'CONSULTORIO', label: 'Consultorio' },
  { nombre: 'HOTEL', label: 'Hospedaje' },
];

/** Los pasos de la escena del héroe. El último deja la tarjeta del pedido dentro del panel. */
const PASOS_ESCENA = CONVERSACION.length + 1;

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [RouterLink, TemaSelectorComponent],
  providers: [PruebaGratisStore],
  templateUrl: './reservas.component.html',
  styleUrl: './reservas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservasComponent {
  private readonly seo = inject(SeoService);
  private readonly assets = inject(AssetService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * El propio elemento del componente, para buscar dentro los hitos del relevo.
   *
   * La app corre **sin zone.js** (`NoopNgZone`), así que una señal escrita desde el callback de un
   * `IntersectionObserver` programa la detección de cambios ella sola: no hace falta `zone.run`.
   */
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  protected readonly prueba = inject(PruebaGratisStore);

  /** El menú de la cabecera en un celular: ahí solo quedan a la vista «Entrar» y la prueba. */
  protected readonly menuAbierto = signal(false);

  protected readonly paradas = PARADAS;
  protected readonly oficios = OFICIOS_GALERIA;
    protected readonly conversacion = CONVERSACION;
  protected readonly planes = PLANES;

  protected readonly comparacion = COMPARACION;

  /** Para la barra legal del pie. */
  protected readonly anio = new Date().getFullYear();

  /**
   * El WhatsApp comercial, que es el propio asistente contestando: la demo y el contacto son la
   * misma cosa. El número vive en `environment`, en un solo sitio, nunca escrito aquí a mano.
   *
   * Llega sin el texto de «quiero adquirir» a propósito: quien baja hasta el pie sin haber pulsado
   * nada todavía no está comprando, y ponerle esa frase en la boca es la forma más rápida de que
   * cierre la ventana.
   */
  protected readonly whatsappContacto =
    `${environment.whatsappUrl}?text=${encodeURIComponent('Hola, quiero saber más de EscalApp para mi negocio de citas')}`;

  // ── La escena del héroe ──

  /** Cuántos pasos de la escena se han representado ya. `PASOS_ESCENA` = escena completa. */
  protected readonly pasoEscena = signal(0);
  protected readonly escenaTerminada = computed(() => this.pasoEscena() >= PASOS_ESCENA);
  /** La tarjeta del pedido entra en el panel con la última respuesta. */
  protected readonly pedidoEnPanel = computed(() => this.pasoEscena() >= PASOS_ESCENA);
  /** Los puntos de «escribiendo» salen justo antes de cada respuesta del asistente. */
  protected readonly escribiendo = signal(false);

  private temporizadores: ReturnType<typeof setTimeout>[] = [];
  /** Lo que solo pasa una vez; el repaso del scroll lo consulta en cada paso. */
  private escenaLanzada = false;

  // ── El relevo ──

  protected readonly paradaActiva = signal(0);

  protected readonly paradaVisible = computed(() => this.paradas[this.paradaActiva()]);

  // ── Lo que cuesta un mes de mensajes ──

  /**
   * Una calculadora de tres líneas, no un simulador.
   *
   * La de la landing viva pregunta por pedidos, estima mensajes, pinta dos barras superpuestas y
   * cruza dos topes distintos — el de Meta y el del plan. Es exacta y nadie la entiende de un
   * vistazo. Aquí se pregunta lo único que el dueño puede responder sin pensar (cuántos mensajes
   * manda al mes) y se contesta lo único que quiere saber: cuánto le cobra Meta.
   */
  protected readonly mensajesMes = signal(3000);

  /** Lo que WhatsApp regala por número y mes. */
  private readonly MENSAJES_GRATIS = 1000;
  /** Lo que cobra Meta por cada mensaje de más, en pesos. */
  private readonly COP_POR_MENSAJE = 2.54;

  protected readonly mensajesDePago = computed(() =>
    Math.max(0, this.mensajesMes() - this.MENSAJES_GRATIS),
  );

  protected readonly costoMeta = computed(() =>
    Math.round(this.mensajesDePago() * this.COP_POR_MENSAJE),
  );

  // ── Precio ──

  /**
   * La facturación electrónica se cuenta aparte, en su ventana: la pide una minoría y son ocho
   * precios. Precios y cuentas en `shared/facturacion.ts`, los mismos en `/restaurantes` y `/reservas`.
   */
  protected readonly tramosFe = TRAMOS_FE;

  /**
   * La elección en la ventana de facturación: un tramo y un plan. Arranca en el recomendado (con
   * asistente) y el tramo más pequeño; tocar un precio la cambia y la barra de abajo la resume.
   */
  protected readonly feTramo = signal(0);
  protected readonly fePlan = signal<PlanFe>('asistente');
  protected readonly feEleccion = computed(() => {
    const tramo = TRAMOS_FE[this.feTramo()];
    const conAsistente = this.fePlan() === 'asistente';
    return {
      plan: `${nombrePlanFe(this.fePlan())} ${tramo.paquete}`,
      tope: this.numero(tramo.tope),
      precio: this.pesos(conAsistente ? tramo.asistente : tramo.base),
      codigo: conAsistente ? tramo.codigoAsistente : tramo.codigoBase,
    };
  });

  protected elegirFe(tramo: number, plan: PlanFe): void {
    this.feTramo.set(tramo);
    this.fePlan.set(plan);
  }

  // ── Documentos adicionales ──

  protected readonly paquetesExtraFe = PAQUETES_EXTRA_FE;

  /** Lo que el dueño responde en la calculadora. Arranca por encima del XL, que es para quien está. */
  protected readonly feDocsMes = signal(3000);

  /**
   * El paquete que le alcanza, los adicionales que le faltan y el total, con el plan que tenga
   * elegido en la tabla (con o sin asistente). No cambia la elección de la tabla: los adicionales
   * no se compran desde «Adquirir», se activan por WhatsApp.
   */
  protected readonly feCalculo = computed(() =>
    calcularFe(this.feDocsMes(), this.fePlan(), (valor) => this.numero(valor)),
  );

  /** Para «¿Tienes dudas?» de la ventana de facturación: aquí sí llega con la pregunta escrita. */
  protected readonly whatsappFe =
    `${environment.whatsappUrl}?text=${encodeURIComponent('Hola, tengo dudas sobre la facturación electrónica de EscalApp para mi negocio de citas')}`;

  protected readonly whatsappFeExtra =
    `${environment.whatsappUrl}?text=${encodeURIComponent('Hola, necesito documentos adicionales de facturación electrónica para mi negocio de citas')}`;

  constructor() {
    // En el constructor y no en `afterNextRender`: la ruta es `Prerender`, así que esto corre
    // durante el build y las etiquetas quedan horneadas en el HTML. Los rastreadores de WhatsApp
    // y Facebook no ejecutan JavaScript — una etiqueta puesta solo en el navegador no la lee nadie.
    this.seo.aplicar({
      titulo: 'EscalApp para negocios de citas — el asistente que agenda por WhatsApp',
      descripcion:
        'El asistente contesta tu WhatsApp, agenda la cita y la deja en tu agenda. Agenda por profesional, página para que tus clientes agenden solos, caja e informes. Prueba 30 días gratis, sin tarjeta.',
      ruta: '/reservas',
    });
    // Mismo bloque que `/restaurantes`, y por las mismas razones: ver el comentario de allí.
    this.seo.datosEstructurados('reservas', {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'EscalApp para negocios de citas',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: this.seo.urlAbsoluta('/reservas'),
      inLanguage: 'es-CO',
      image: this.seo.urlAbsoluta('/images/og-escalapp-marca.png'),
      description:
        'Sistema de agenda y reservas con asistente en WhatsApp: citas por profesional, página para agendar, caja e informes.',
      offers: {
        '@type': 'Offer',
        price: PLANES[0].precio.replace(/\D/g, ''),
        priceCurrency: 'COP',
        availability: 'https://schema.org/InStock',
        url: this.seo.urlAbsoluta('/adquirir'),
      },
      publisher: { '@id': `${this.seo.urlAbsoluta('/')}#organizacion` },
    });

    this.prueba.oficios.set(OFICIOS_RESERVA);

    afterNextRender(() => {
      montarEntradas(this.destroyRef);
      this.prueba.cargarOficios(OFICIOS_RESERVA.map((o) => o.nombre));
      this.montarObservadores();
    });

    this.destroyRef.onDestroy(() => this.limpiarTemporizadores());
  }

  /** Los recursos de la marca (logo, pulpo, logotipo), por el servicio como el resto de imágenes. */
  protected marca(archivo: string): string {
    return this.assets.getAssetPath(`marca/${archivo}`);
  }

  /**
   * Las capturas se hicieron a 1280×800 y no a 1600×1000 a propósito: en el marco de la landing
   * una captura de 1600 se encoge tanto que el panel deja de leerse, y una captura de software
   * que no se lee no enseña nada.
   */
  protected rutaImagen(nombre: string, ancho: 640 | 1280): string {
    return this.assets.getAssetPath(`producto/${nombre}-${ancho}.webp`);
  }

  /**
   * La misma vista capturada **en un móvil**, no la de escritorio encogida.
   *
   * `negocio_app` tiene su propia maqueta de móvil (barra de pestañas abajo, una tarjeta por
   * fila), así que a 390 px se lee igual de bien que la de escritorio a 1440 — y además es como
   * lo usa de verdad un dueño de negocio entre cita y cita.
   */
  /** Ilustración de un oficio de la galería (ver `OFICIOS_GALERIA`). */
  /** Fotos de la galería de oficios: WebP recortado a 4:3, en 400 y 640 px de ancho. */
  protected rutaOficio(slug: string, ancho: 400 | 640 = 640): string {
    return this.assets.getAssetPath(`producto/oficio-${slug}-${ancho}.webp`);
  }

  protected rutaMovil(nombre: string): string {
    return this.assets.getAssetPath(`producto/${nombre}-movil-430.webp`);
  }

  /** Una pose de la mascota oficial (WebP con fondo transparente, a 480 o 960 px de ancho). */
  protected mascota(pose: 'laptop' | 'guino' | 'sentado' | 'descanso', ancho: 480 | 960): string {
    return this.assets.getAssetPath(`marca/pulpo-${pose}-${ancho}.webp`);
  }

  /** Sin oficio por defecto: la página habla de ocho, así que el visitante elige el suyo. */
  protected abrirPrueba(): void {
    this.prueba.abrir();
  }

  /**
   * Abre una ventana de la sección de precios. Mientras está abierta la página de atrás no se
   * desplaza; el hueco de la barra de scroll se rellena para que nada salte de sitio.
   */
  protected abrirVentana(ventana: HTMLDialogElement): void {
    const raiz = document.documentElement;
    const barra = window.innerWidth - raiz.clientWidth;
    raiz.style.overflow = 'hidden';
    raiz.style.paddingRight = barra > 0 ? `${barra}px` : '';
    ventana.addEventListener(
      'close',
      () => {
        raiz.style.overflow = '';
        raiz.style.paddingRight = '';
      },
      { once: true },
    );
    ventana.showModal();
  }

  /** Un clic en el fondo oscuro (el propio `<dialog>`, fuera de su contenido) la cierra. */
  protected cerrarSiFondo(evento: MouseEvent, ventana: HTMLDialogElement): void {
    if (evento.target === ventana) ventana.close();
  }

  /**
   * Lleva al principio de la sección, no a su centro.
   *
   * Con `block: 'center'` los enlaces del pie dejaban «Precio» y «Qué hace» a media sección, con
   * el titular ya fuera de pantalla. El hueco que deja la cabecera pegada lo pone el
   * `scroll-margin-top` de cada destino, no este método.
   */
  protected irA(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Movimiento ──

  /**
   * Un solo vigía del scroll para las tres cosas que se mueven.
   *
   * **Por qué no `IntersectionObserver`.** Era lo natural y costó dos sesiones descubrir que aquí
   * no sirve: esta ruta se sirve con SSR + hidratación, y un observador montado en
   * `afterNextRender` se engancha a los nodos que pintó el servidor justo antes de que la
   * hidratación los sustituya por los suyos. A partir de ahí vigila nodos huérfanos. El síntoma es
   * desconcertante —dispara **una sola vez** al engancharse y nunca más, con los elementos en su
   * sitio, sin un solo error en consola— y aguanta cualquier intento de arreglarlo esperando
   * (`setTimeout`, `whenStable()`), porque el problema no es cuándo se monta sino a qué se agarra.
   *
   * Un oyente de `scroll` que vuelve a consultar el DOM en cada repaso no puede caer en eso. Son
   * cinco `getBoundingClientRect()` por fotograma, acotados por `requestAnimationFrame`: para una
   * página de marketing, gratis.
   */
  private montarObservadores(): void {
    if (this.sinMovimiento) {
      // Nada se mueve: todo aparece ya en su estado final, sin perder una sola palabra.
      this.pasoEscena.set(PASOS_ESCENA);
      return;
    }

    let pendiente = false;
    const revisar = () => {
      pendiente = false;
      try {
        this.repasarEscena();
        this.repasarRelevo();
      } catch (err) {
        console.error('[reservas] fallo al repasar el scroll', err);
      }
    };
    const planificar = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(revisar);
    };

    revisar();
    window.addEventListener('scroll', planificar, { passive: true });
    window.addEventListener('resize', planificar, { passive: true });
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', planificar);
      window.removeEventListener('resize', planificar);
    });
  }

  /** La escena se representa sola la primera vez que el escenario entra en pantalla. */
  private repasarEscena(): void {
    if (this.escenaLanzada) return;
    const caja = this.buscar('.heroe__escenario')?.getBoundingClientRect();
    if (!caja) return;
    const alto = window.innerHeight;
    const visible = Math.min(caja.bottom, alto) - Math.max(caja.top, 0);
    if (visible > 0 && visible / Math.min(caja.height, alto) >= 0.35) {
      this.escenaLanzada = true;
      this.reproducirEscena();
    }
  }

  /**
   * El relevo: manda la última parada cuya cabecera ya pasó por la mitad de la ventana.
   *
   * Se vuelven a consultar los nodos **en cada repaso**, y ahí está la gracia: guardarlos una vez
   * es lo que tenía el relevo clavado en la primera captura sesión tras sesión.
   */
  private repasarRelevo(): void {
    const nodos = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-parada]');
    if (!nodos.length) return;

    const mitad = window.innerHeight / 2;
    let activa = 0;
    nodos.forEach((n) => {
      const i = Number(n.dataset['parada']);
      if (!Number.isNaN(i) && n.getBoundingClientRect().top <= mitad) activa = i;
    });
    if (activa !== this.paradaActiva()) this.paradaActiva.set(activa);
  }

  /**
   * Un elemento del propio componente.
   *
   * Los tres observadores buscan por aquí y no con `viewChild`/`viewChildren`: las consultas de
   * señales llegaban sin resolver a `afterNextRender` y los observadores se quedaban sin enganchar
   * —el relevo clavado en la primera parada y las cifras en cero—, sin dar ningún error. Una
   * consulta al DOM del propio `ElementRef` no depende de cuándo se resuelve la consulta.
   */
  private buscar(selector: string): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>(selector);
  }

  /**
   * ¿Hay que quedarse quieto? Se consulta en cada arranque y no una vez: alguien puede cambiar la
   * preferencia del sistema con la página abierta.
   */
  private get sinMovimiento(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  /** Vuelve a representarla desde el principio. Es la única forma de verla dos veces. */
  protected volverAVer(): void {
    this.limpiarTemporizadores();
    this.pasoEscena.set(0);
    this.escribiendo.set(false);
    if (this.sinMovimiento) {
      this.pasoEscena.set(PASOS_ESCENA);
      return;
    }
    this.reproducirEscena();
  }

  /**
   * El guion: cada burbuja del cliente aparece sola; cada respuesta del asistente va precedida de
   * los puntos de «escribiendo», porque sin esa pausa parece que el sistema ya sabía la respuesta.
   */
  private reproducirEscena(): void {
    let t = 450;
    CONVERSACION.forEach((burbuja, i) => {
      if (burbuja.de === 'asistente') {
        this.enEl(t, () => this.escribiendo.set(true));
        t += 900;
        this.enEl(t, () => {
          this.escribiendo.set(false);
          this.pasoEscena.set(i + 1);
        });
      } else {
        this.enEl(t, () => this.pasoEscena.set(i + 1));
      }
      t += 1100;
    });
    // La tarjeta entra en el panel al final: es la consecuencia de la conversación, no un paso más.
    this.enEl(t, () => this.pasoEscena.set(PASOS_ESCENA));
  }

  private enEl(ms: number, accion: () => void): void {
    this.temporizadores.push(setTimeout(accion, ms));
  }

  private limpiarTemporizadores(): void {
    this.temporizadores.forEach(clearTimeout);
    this.temporizadores = [];
  }

  /** «6000» → «6.000». */
  protected numero(valor: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(valor);
  }

  /** «12700» → «$12.700». */
  protected pesos(valor: number): string {
    return `$${this.numero(valor)}`;
  }
}
