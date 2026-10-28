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
 * La página del motor de restaurante — «El pase».
 *
 * ## La idea
 *
 * La página entera es un relevo: llega el mensaje, el asistente contesta, el pedido entra al panel,
 * la comanda sale en cocina, el dinero aparece en caja. Lo que se enseña es la interfaz de verdad;
 * lo único dibujado a mano es el chat, porque es lo que se anima.
 *
 * ## Las tres reglas que la gobiernan
 *
 * 1. **La primera pantalla dice qué es, para quién y qué hace, en palabras llanas.** Sin acertijo:
 *    un extraño que la mire cinco segundos tiene que poder decir qué es esto y qué hacer. Por eso
 *    el titular no lleva ninguna palabra coloreada ni etiqueta encima, y el botón dice lo que pasa
 *    al pulsarlo.
 * 2. **Todo se demuestra solo al entrar en pantalla.** La escena del héroe se representa sola una
 *    vez; las cifras se cuentan solas; el relevo lo mueve el scroll. El visitante puede tomar el
 *    control («Ver otra vez», las etiquetas del relevo), nunca al revés. El intento anterior
 *    esperaba a que alguien moviera un control y se quedaba mudo si nadie lo tocaba.
 * 3. **Marco con tope de ancho.** Nada se mide en `vw`. El contenido vive dentro de `.marco`
 *    (1280 px) y solo los campos de color sangran. El intento anterior no se probó por encima de
 *    1440 y a 1920 se desarmaba.
 *
 * ## Qué NO se hace aquí
 *
 * Ni etiquetas sobre los títulos, ni 01/02/03, ni filetes de 1 px, ni degradados, ni tarjetas con
 * icono arriba, ni sombras en reposo, ni versalitas rastreadas, ni una palabra del titular
 * coloreada. Son las ocho convenciones que tumbaron el primer intento.
 *
 * Y nada inventado: ni clientes, ni logos, ni citas, ni estadísticas. Las cuatro cifras son de
 * producción (un restaurante, 30 días) y se dicen con esa salvedad delante.
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

/** Una cifra real de producción, con lo que significa exactamente. */
interface CifraReal {
  valor: number;
  titulo: string;
  /** De dónde sale. Sin esto una cifra es una afirmación, no un dato. */
  definicion: string;
}

/** Una burbuja del chat. El único trozo de interfaz dibujado a mano, porque es lo que se anima. */
interface Burbuja {
  de: 'cliente' | 'asistente';
  texto: string;
  hora: string;
}

const PARADAS: ParadaRelevo[] = [
  {
    id: 'despacho',
    etiqueta: 'Despacho',
    titulo: 'El pedido entra solo',
    frase:
      'Nadie lo copia a mano del chat. Llega con los productos, las adiciones, la dirección y la forma de pago que acordó el asistente.',
    detalles: [
      'Para llevar y domicilio, separados',
      'Teléfono, dirección y notas del cliente',
      'Se cobra y se imprime sin salir de aquí',
    ],
    imagen: 'pedidos',
    alt: 'Pantalla de despacho: una tarjeta por pedido, con el cliente, los productos, el total y el botón de cobrar.',
  },
  {
    id: 'mesas',
    etiqueta: 'Mesas',
    titulo: 'Sabes qué mesa lleva qué',
    frase:
      'El mapa del salón con lo que cada mesa tiene consumido. Se añade un plato desde la mesa y la cuenta va sola.',
    detalles: [
      'Por pisos y zonas, como está el local',
      'Cuánto lleva y cuánto tiempo ocupada',
      'Se cobra completa o por partes',
    ],
    imagen: 'mesas',
    alt: 'Mapa del salón con las mesas ocupadas y libres y el consumo de cada una.',
  },
  {
    id: 'cocina',
    etiqueta: 'Cocina',
    titulo: 'La comanda sale donde toca',
    frase:
      'Cada plato va a su cocina. Si el pedido toca dos, salen dos comandas, y la adición nunca se va a la cocina equivocada.',
    detalles: [
      'Pendiente, en preparación y listo',
      'El tiempo de la comanda más antigua',
      'Las notas del cliente, con su alergia',
    ],
    imagen: 'cocina',
    alt: 'Pantalla de cocina con las comandas pendientes y el tiempo que lleva cada una.',
  },
  {
    id: 'caja',
    etiqueta: 'Caja',
    titulo: 'El turno cuadra',
    frase:
      'Abres, cobras en efectivo, transferencia o lo que sea, y cierras. El arqueo sale con el desglose y con quién cobró cada cosa.',
    detalles: [
      'Base de apertura, ingresos y egresos',
      'Desglose por cada forma de pago',
      'Lo que debería haber en el cajón',
    ],
    imagen: 'caja',
    alt: 'Pantalla de caja con el turno abierto, los movimientos y el total por forma de pago.',
  },
  {
    id: 'reportes',
    etiqueta: 'Reportes',
    titulo: 'Al final del mes lo sabes',
    frase:
      'Qué se vendió, a qué hora, qué dejó cada plato y qué día de la semana trabaja de verdad.',
    detalles: [
      'Ventas por día, producto y persona',
      'Costo y ganancia de cada plato',
      'Se exporta a Excel y a PDF',
    ],
    imagen: 'reportes',
    alt: 'Informes de ventas con las gráficas por día y el detalle por producto.',
  },
];

/**
 * Las cifras publicables. Producción, un restaurante, ventana de 30 días.
 *
 * Las definiciones son las de `admin_ws/app_core/asistente/resumenNegocio.js`. Van las cuatro al
 * mismo tamaño **a propósito**, incluida la que dice que el asistente no pudo: un producto temprano
 * que publica lo que no hace se cree más que uno que solo publica lo que sí.
 */
const CIFRAS: CifraReal[] = [
  {
    valor: 580,
    titulo: 'personas atendidas',
    definicion: 'Conversaciones distintas que el asistente contestó.',
  },
  {
    valor: 480,
    titulo: 'pedidos tomados por el asistente',
    definicion: 'Pedidos que quedaron armados de principio a fin sin que interviniera nadie.',
  },
  {
    valor: 216,
    titulo: 'de ellas con el local cerrado',
    definicion: 'Mensajes que llegaron fuera del horario de atención del restaurante.',
  },
  {
    valor: 149,
    titulo: 'conversaciones que necesitaron a una persona',
    definicion: 'El asistente se apartó y avisó al equipo en vez de inventarse una respuesta.',
  },
];

/**
 * La conversación de la madrugada.
 *
 * **No es de un cliente real.** Es una demostración escrita con el flujo que el asistente hace de
 * verdad; sacar mensajes reales a una pieza pública sería un problema de privacidad.
 */
const CONVERSACION: Burbuja[] = [
  { de: 'cliente', texto: 'Buenas, ¿todavía están abiertos?', hora: '1:47 a. m.' },
  {
    de: 'asistente',
    texto: /* taste-skill-ignore: va dentro de un chat, es contenido */ 'Hola 👋 Ya cerramos. Te dejo el pedido para mañana desde las 11:00. ¿Qué te provoca?',
    hora: '1:47 a. m.',
  },
  { de: 'cliente', texto: 'Dos hamburguesas dobles, una sin tomate', hora: '1:48 a. m.' },
  {
    de: 'asistente',
    texto: '2 Doble Queso · $56.000. Sin tomate, anotado. ¿A domicilio o la recoges?',
    hora: '1:48 a. m.',
  },
];

const PLANES: Plan[] = [
  {
    id: 'base',
    nombre: 'Emprendedor',
    precio: '$37.999',
    que: 'El sistema completo para operar el restaurante desde el primer día.',
    destacados: [
      '8 usuarios y 1 caja incluidos',
      'Carta digital con QR',
      'Carga tu carta con IA desde un PDF o fotos',
      'Mesas, comandas y pantalla de cocina',
      'Domicilios con precio por barrio',
      'Inventario, costos y reportes',
    ],
    sello: 'El WhatsApp lo sigues contestando tú.',
  },
  {
    id: 'asistente',
    nombre: 'Emprendedor con asistente',
    precio: '$77.999',
    que: 'Un asistente de IA que atiende tu WhatsApp por ti.',
    antesDeLista: 'Todo lo del Emprendedor, más:',
    destacados: [
      '10 usuarios y 2 cajas incluidos',
      'Contesta tu WhatsApp a cualquier hora, también con el local cerrado',
      'Toma el pedido completo y lo deja en tu caja',
      'Avisa al cliente cuando su pedido está listo',
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
    titulo: 'El asistente de IA en WhatsApp',
    filas: [
      { texto: 'Contesta al instante, a cualquier hora, también con el local cerrado', base: false, asistente: true },
      { texto: 'Toma el pedido de principio a fin y lo deja en el sistema', base: false, asistente: true },
      { texto: 'Avisa al cliente por WhatsApp cuando su pedido está listo', base: false, asistente: true },
      { texto: 'Si hace falta una persona, te pasa el turno en vez de inventarse una respuesta', base: false, asistente: true },
      { texto: 'Ves y contestas todas las conversaciones desde el sistema', base: false, asistente: true },
      { texto: 'Conectas el WhatsApp de tu negocio. Si no puedes, lo hacemos contigo', base: false, asistente: true },
    ],
  },
  {
    titulo: 'Pedidos y carta',
    filas: [
      { texto: 'Carta digital con QR', base: true, asistente: true },
      { texto: 'Carga tu carta con IA desde un PDF o fotos', base: true, asistente: true },
      { texto: 'Mesas, comandas y pantalla de cocina', base: true, asistente: true },
      { texto: 'Domicilios con precio por barrio', base: true, asistente: true },
    ],
  },
  {
    titulo: 'Caja y dinero',
    filas: [
      { texto: 'Caja con varios medios de pago', base: true, asistente: true },
      { texto: 'Inventario con recetas y proveedores', base: true, asistente: true },
      { texto: 'Costo y ganancia de cada producto', base: true, asistente: true },
      { texto: 'Tiqueteras y fiado de clientes', base: true, asistente: true },
      { texto: 'Reportes de ventas, impuestos y domicilios', base: true, asistente: true },
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

/** Los pasos de la escena del héroe. El último deja la tarjeta del pedido dentro del panel. */
const PASOS_ESCENA = CONVERSACION.length + 1;

@Component({
  selector: 'app-restaurantes',
  standalone: true,
  imports: [RouterLink, TemaSelectorComponent],
  providers: [PruebaGratisStore],
  templateUrl: './restaurantes.component.html',
  styleUrl: './restaurantes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantesComponent {
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
  protected readonly cifras = CIFRAS;
  protected readonly conversacion = CONVERSACION;
  protected readonly planes = PLANES;
  protected readonly comparacion = COMPARACION;

  /** El oficio con el que entra el registro: la página entera habla de restaurantes. */
  private readonly OFICIO = 'RESTAURANTE';

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
    `${environment.whatsappUrl}?text=${encodeURIComponent('Hola, quiero saber más de EscalApp para mi restaurante')}`;

  // ── La escena del héroe ──

  /** Cuántos pasos de la escena se han representado ya. `PASOS_ESCENA` = escena completa. */
  protected readonly pasoEscena = signal(0);
  protected readonly escenaTerminada = computed(() => this.pasoEscena() >= PASOS_ESCENA);
  /** La tarjeta del pedido entra en el panel con la última respuesta. */
  protected readonly pedidoEnPanel = computed(() => this.pasoEscena() >= PASOS_ESCENA);
  /** Los puntos de «escribiendo» salen justo antes de cada respuesta del asistente. */
  protected readonly escribiendo = signal(false);

  private temporizadores: ReturnType<typeof setTimeout>[] = [];
  /** Las dos cosas que solo pasan una vez; el repaso del scroll las consulta en cada paso. */
  private escenaLanzada = false;
  private cifrasLanzadas = false;

  // ── El relevo ──

  protected readonly paradaActiva = signal(0);

  protected readonly paradaVisible = computed(() => this.paradas[this.paradaActiva()]);

  // ── Las cifras ──

  /** Lo que se pinta en cada cifra mientras cuenta. */
  protected readonly cifrasContadas = signal<number[]>(CIFRAS.map(() => 0));

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
    `${environment.whatsappUrl}?text=${encodeURIComponent('Hola, tengo dudas sobre la facturación electrónica de EscalApp para mi restaurante')}`;

  protected readonly whatsappFeExtra =
    `${environment.whatsappUrl}?text=${encodeURIComponent('Hola, necesito documentos adicionales de facturación electrónica para mi restaurante')}`;

  constructor() {
    // En el constructor y no en `afterNextRender`: la ruta es `Prerender`, así que esto corre
    // durante el build y las etiquetas quedan horneadas en el HTML. Los rastreadores de WhatsApp
    // y Facebook no ejecutan JavaScript — una etiqueta puesta solo en el navegador no la lee nadie.
    this.seo.aplicar({
      titulo: 'EscalApp para restaurantes — el asistente que contesta tu WhatsApp',
      descripcion:
        'El asistente contesta tu WhatsApp, arma el pedido con tu carta y lo deja en tu caja. Pedidos, mesas, cocina, caja e inventario. Prueba 30 días gratis, sin tarjeta.',
      ruta: '/restaurantes',
    });
    this.seo.datosEstructurados('restaurantes', {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'EscalApp para restaurantes',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description:
        'Sistema de restaurante con asistente de IA en WhatsApp: pedidos, mesas, cocina, caja, inventario y reportes.',
      offers: {
        '@type': 'Offer',
        price: '37999',
        priceCurrency: 'COP',
      },
    });

    afterNextRender(() => {
      montarEntradas(this.destroyRef);
      this.prueba.cargarOficios();
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
  /** Una pose de la mascota oficial (WebP con fondo transparente, a 480 o 960 px de ancho). */
  protected mascota(pose: 'laptop' | 'guino' | 'sentado' | 'descanso', ancho: 480 | 960): string {
    return this.assets.getAssetPath(`marca/pulpo-${pose}-${ancho}.webp`);
  }

  protected rutaImagen(nombre: string, ancho: 640 | 1280): string {
    return this.assets.getAssetPath(`producto/${nombre}-${ancho}.webp`);
  }

  /**
   * La misma vista capturada **en un móvil**, no la de escritorio encogida.
   *
   * `negocio_app` tiene su propia maqueta de móvil (barra de pestañas abajo, una tarjeta por
   * fila), así que a 390 px se lee igual de bien que la de escritorio a 1440 — y además es como
   * lo usa de verdad un dueño de restaurante entre pedido y pedido.
   */
  protected rutaMovil(nombre: string): string {
    return this.assets.getAssetPath(`producto/${nombre}-movil-430.webp`);
  }

  protected abrirPrueba(): void {
    this.prueba.abrir(this.OFICIO);
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
      this.cifrasContadas.set(CIFRAS.map((c) => c.valor));
      return;
    }

    let pendiente = false;
    const revisar = () => {
      pendiente = false;
      try {
        this.repasarEscena();
        this.repasarRelevo();
        this.repasarCifras();
      } catch (err) {
        console.error('[restaurantes] fallo al repasar el scroll', err);
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

  /** Las cifras se cuentan solas al entrar, una vez, y se quedan quietas. */
  private repasarCifras(): void {
    if (this.cifrasLanzadas) return;
    const caja = this.buscar('.cifras')?.getBoundingClientRect();
    if (!caja) return;
    if (caja.top < window.innerHeight * 0.75 && caja.bottom > 0) {
      this.cifrasLanzadas = true;
      this.contarCifras();
    }
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

  /**
   * Cuenta las cuatro a la vez en 1,1 s con una curva que frena al final.
   *
   * `requestAnimationFrame` y no un `setInterval` por cifra: cuatro intervalos sueltos se
   * desincronizan y se ve cómo una termina antes que otra sin motivo.
   */
  private contarCifras(): void {
    const DURACION = 1100;
    const inicio = performance.now();

    const paso = (ahora: number) => {
      const avance = Math.min((ahora - inicio) / DURACION, 1);
      // easeOutCubic: arranca rápido y aterriza suave, que es como se lee un marcador.
      const curva = 1 - Math.pow(1 - avance, 3);
      this.cifrasContadas.set(CIFRAS.map((c) => Math.round(c.valor * curva)));
      if (avance < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
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
