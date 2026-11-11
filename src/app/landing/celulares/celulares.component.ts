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
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AssetService } from '../../core/services/asset.service';
import { SeoService } from '../../core/services/seo.service';
import { montarEntradas } from '../shared/entradas';
import { abrirPruebaSiLaPiden } from '../shared/abrir-prueba';
import { PAQUETES_EXTRA_FE, PlanFe, TRAMOS_FE, calcularFe, nombrePlanFe } from '../shared/facturacion';
import { TemaSelectorComponent } from '../shared/tema-selector.component';
import { PruebaGratisStore } from '../shared/prueba-gratis.store';
import { environment } from '../../../environments/environment';

/**
 * La página del motor de tienda de celulares.
 *
 * Mismas mecánicas que `/reservas` (escena de chat que se representa sola, planes, ventanas de
 * comparación y de facturación electrónica, registro de prueba). Contrato funcional:
 * `admin_ws/docs/celulares.md`. Las capturas no existen todavía: el héroe usa una composición CSS.
 *
 * Lo que esta página NO hace: no promete asesoría legal (el bloque «Cumple con la ley» dice qué
 * resuelve el sistema, no que sustituya a un contador) y no lleva cifras ni fotos de personas.
 */

interface Capacidad {
  titulo: string;
  texto: string;
}

interface Regla {
  titulo: string;
  texto: string;
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

const CAPACIDADES: Capacidad[] = [
  { titulo: 'Inventario por IMEI', texto: 'Cada equipo con su IMEI, su condición (nuevo, usado, reacondicionado) y su precio. Accesorios y repuestos por cantidad.' },
  { titulo: 'Ventas con factura electrónica', texto: 'La factura sale con el IMEI en la descripción y el IVA calculado solo: los celulares hasta 22 UVT van excluidos; accesorios y reparaciones, al 19 %.' },
  { titulo: 'Garantías automáticas', texto: '1 año para equipos nuevos y 3 meses para usados. El certificado de garantía queda listo en cada venta.' },
  { titulo: 'Apartados con abonos', texto: 'Guardas el equipo, registras los abonos y el sistema te avisa cuando el apartado vence.' },
  { titulo: 'Servicio técnico', texto: 'Orden de recepción con la constancia del estado del equipo y aviso por WhatsApp cuando está «listo».' },
  { titulo: 'Asistente de WhatsApp', texto: 'Contesta precio y disponibilidad las 24 horas, y te pasa la conversación cuando hace falta una persona.' },
  { titulo: 'Catálogo público con carrito', texto: 'Tus equipos en una página propia. El cliente arma su pedido y te llega por WhatsApp ya escrito.' },
  { titulo: 'Caja, clientes y equipo', texto: 'Caja con varios medios de pago, clientes con su historial y un usuario para cada persona con sus permisos.' },
];

const REGLAS: Regla[] = [
  { titulo: 'Factura con IMEI', texto: 'Cada equipo vendido queda facturado con su IMEI, como exige la norma para equipos terminales móviles.' },
  { titulo: 'Garantía legal', texto: 'La garantía mínima (1 año nuevo, 3 meses usado) se calcula sola y se imprime en el certificado de la venta.' },
  { titulo: 'Retracto en ventas a distancia', texto: 'Si vendes por WhatsApp o con envío, el sistema marca hasta cuándo el cliente puede retractarse (5 días hábiles).' },
  { titulo: 'Alerta de tu autorización AVETM', texto: 'Registras el número y la fecha de vencimiento de tu autorización del MinTIC y el panel te avisa con tiempo para renovarla.' },
];

/**
 * La conversación de la madrugada.
 *
 * **No es de un cliente real.** Es una demostración escrita con el mismo orden de pasos que sigue el
 * asistente (servicio, profesional, hora, nombre); sacar mensajes reales a una pieza pública sería un
 * problema de privacidad.
 */
const CONVERSACION: Burbuja[] = [
  { de: 'cliente', texto: 'Hola, ¿tiene el iPhone 13 de 128?', hora: '10:12 p. m.' },
  {
    de: 'asistente',
    texto: /* taste-skill-ignore: va dentro de un chat, es contenido */ 'Hola 👋 Sí, nos queda 1 en azul: $2.150.000, nuevo y con garantía de 1 año. ¿Quieres que te lo aparte?',
    hora: '10:12 p. m.',
  },
  { de: 'cliente', texto: 'Sí, apártelo', hora: '10:13 p. m.' },
  {
    de: 'asistente',
    texto: 'Listo: queda apartado 30 días con un abono mínimo de $215.000. ¿A nombre de quién lo dejo?',
    hora: '10:13 p. m.',
  },
];

const PLANES: Plan[] = [
  {
    id: 'base',
    nombre: 'Emprendedor',
    precio: '$37.999',
    que: 'El sistema completo para llevar tu tienda desde el primer día.',
    destacados: [
      '8 usuarios y 1 caja incluidos',
      'Inventario por IMEI y accesorios',
      'Ventas con garantía y factura con IMEI',
      'Apartados con abonos',
      'Servicio técnico con orden de recepción',
      'Catálogo público con carrito a WhatsApp',
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
      'Contesta precio y disponibilidad a cualquier hora',
      'Te pasa el turno si hace falta una persona',
      'Aviso por WhatsApp de «equipo listo» en servicio técnico',
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
      { texto: 'Responde precio y disponibilidad de cada equipo', base: false, asistente: true },
      { texto: 'Avisa por WhatsApp cuando el equipo en servicio técnico está listo', base: false, asistente: true },
      { texto: 'Si hace falta una persona, te pasa el turno en vez de inventarse una respuesta', base: false, asistente: true },
      { texto: 'Ves y contestas todas las conversaciones desde el sistema', base: false, asistente: true },
      { texto: 'Conectas el WhatsApp de tu negocio. Si no puedes, lo hacemos contigo', base: false, asistente: true },
    ],
  },
  {
    titulo: 'Inventario y clientes',
    filas: [
      { texto: 'Inventario por IMEI y accesorios', base: true, asistente: true },
      { texto: 'Apartados con abonos y alerta de vencimiento', base: true, asistente: true },
      { texto: 'Servicio técnico con orden de recepción', base: true, asistente: true },
      { texto: 'Catálogo público con carrito a WhatsApp', base: true, asistente: true },
      { texto: 'Clientes con su historial', base: true, asistente: true },
    ],
  },
  {
    titulo: 'Caja y ventas',
    filas: [
      { texto: 'Ventas con garantía automática y factura con IMEI', base: true, asistente: true },
      { texto: 'Caja con varios medios de pago', base: true, asistente: true },
      { texto: 'Informes de ventas y servicio técnico', base: true, asistente: true },
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
const OFICIOS_CELULARES: { nombre: string; label: string }[] = [
  { nombre: 'TIENDA DE CELULARES', label: 'Tienda de celulares' },
  { nombre: 'SERVICIO TECNICO CELULARES', label: 'Servicio técnico de celulares' },
  { nombre: 'TECNOLOGIA Y VIDEOJUEGOS', label: 'Tecnología y videojuegos' },
];

/** Los pasos de la escena del héroe. El último deja la tarjeta del pedido dentro del panel. */
const PASOS_ESCENA = CONVERSACION.length + 1;

@Component({
  selector: 'app-celulares',
  standalone: true,
  imports: [RouterLink, TemaSelectorComponent],
  providers: [PruebaGratisStore],
  templateUrl: './celulares.component.html',
  styleUrl: './celulares.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CelularesComponent {
  private readonly seo = inject(SeoService);
  private readonly assets = inject(AssetService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

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

  protected readonly capacidades = CAPACIDADES;
  protected readonly reglas = REGLAS;
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
    `${environment.whatsappUrl}?text=${encodeURIComponent('Hola, quiero saber más de EscalApp para mi negocio de celulares')}`;

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
    `${environment.whatsappUrl}?text=${encodeURIComponent('Hola, tengo dudas sobre la facturación electrónica de EscalApp para mi negocio de celulares')}`;

  protected readonly whatsappFeExtra =
    `${environment.whatsappUrl}?text=${encodeURIComponent('Hola, necesito documentos adicionales de facturación electrónica para mi negocio de celulares')}`;

  constructor() {
    // En el constructor y no en `afterNextRender`: la ruta es `Prerender`, así que esto corre
    // durante el build y las etiquetas quedan horneadas en el HTML. Los rastreadores de WhatsApp
    // y Facebook no ejecutan JavaScript — una etiqueta puesta solo en el navegador no la lee nadie.
    this.seo.aplicar({
      titulo: 'EscalApp para tiendas de celulares — inventario por IMEI y WhatsApp',
      descripcion:
        'Inventario por IMEI, ventas con factura electrónica, garantías, apartados y servicio técnico para tiendas de celulares en Colombia, con asistente de WhatsApp.',
      ruta: '/celulares',
    });
    // Mismo bloque que `/restaurantes`, y por las mismas razones: ver el comentario de allí.
    this.seo.datosEstructurados('celulares', {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'EscalApp para tiendas de celulares',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: this.seo.urlAbsoluta('/celulares'),
      inLanguage: 'es-CO',
      image: this.seo.urlAbsoluta('/images/og-escalapp-marca.png'),
      description:
        'Sistema para tiendas de celulares: inventario por IMEI, ventas con factura electrónica, garantías, apartados, servicio técnico y asistente de WhatsApp.',
      offers: {
        '@type': 'Offer',
        price: PLANES[0].precio.replace(/\D/g, ''),
        priceCurrency: 'COP',
        availability: 'https://schema.org/InStock',
        url: this.seo.urlAbsoluta('/adquirir'),
      },
      publisher: { '@id': `${this.seo.urlAbsoluta('/')}#organizacion` },
    });

    this.prueba.oficios.set(OFICIOS_CELULARES);

    afterNextRender(() => {
      montarEntradas(this.destroyRef);
      this.prueba.cargarOficios(OFICIOS_CELULARES.map((o) => o.nombre));
      this.montarObservadores();
      abrirPruebaSiLaPiden(this.route, () => this.abrirPrueba());
    });

    this.destroyRef.onDestroy(() => this.limpiarTemporizadores());
  }

  /** Los recursos de la marca (logo, pulpo, logotipo), por el servicio como el resto de imágenes. */
  protected marca(archivo: string): string {
    return this.assets.getAssetPath(`marca/${archivo}`);
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
      } catch (err) {
        console.error('[celulares] fallo al repasar el scroll', err);
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
