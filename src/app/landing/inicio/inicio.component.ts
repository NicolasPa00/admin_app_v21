import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AssetService } from '../../core/services/asset.service';
import { SeoService } from '../../core/services/seo.service';
import { montarEntradas } from '../shared/entradas';
import { TemaSelectorComponent } from '../shared/tema-selector.component';
import { PruebaGratisStore } from '../shared/prueba-gratis.store';
import { environment } from '../../../environments/environment';

/**
 * La página madre — `/inicio`.
 *
 * Su único trabajo es repartir al visitante: una pregunta («¿cómo trabaja tu negocio?»), dos
 * respuestas con su captura real y su botón, y lo que es igual en las dos. El detalle de cada plan,
 * la calculadora de mensajes y el relevo de pantallas viven en `/restaurantes` y `/reservas`; aquí
 * repetirlos competiría con ellas.
 *
 * ## Estado
 *
 * Es una ruta NUEVA, sin tocar `/` (la landing viva), a propósito: mismo criterio con que se
 * publicó `/restaurantes` («con la landing / intacta hasta que se valide»). Cuando se apruebe, el
 * cambio es mover esta ruta a `path: ''` y decidir qué se hace con las secciones de la landing
 * vieja; ver `admin_ws/docs/landing-reservas.md` §6.
 *
 * ## Lo que NO ofrece
 *
 * Gimnasio, tienda y parqueadero no se mencionan: sus apps no están en producción. La franja «¿Tu
 * negocio no es ninguno de estos?» se quitó el 2026-10-26 a pedido del dueño; el WhatsApp comercial
 * sigue en el botón flotante y en el pie.
 */

/** Una de las dos respuestas a «¿cómo trabaja tu negocio?». */
interface Opcion {
  id: 'restaurantes' | 'reservas';
  titulo: string;
  frase: string;
  /** Los oficios que atiende, tal como los lista la landing viva. */
  oficios: string[];
  /** La captura (nombre dentro de `images/producto/`, sin ancho ni extensión). */
  imagen: string;
  alt: string;
  ruta: string;
  boton: string;
  /**
   * La conversación de ejemplo que corre en bucle sobre la captura: escrita, no de un cliente real,
   * con el orden real del asistente de cada motor.
   */
  chat: Mensaje[];
}

interface Mensaje {
  de: 'cliente' | 'asistente';
  texto: string;
}

/** Un mensaje tal como se pinta: su posición en la conversación y cuántos han llegado después. */
interface MensajeVisible extends Mensaje {
  i: number;
  edad: number;
  sale: boolean;
}

/** Cuántos mensajes se ven a la vez: dos, para que la captura de debajo se siga viendo. */
const VENTANA_CHAT = 2;
/** Cada cuánto llega el siguiente mensaje. */
const RITMO_CHAT_MS = 1900;

interface Comun {
  titulo: string;
  texto: string;
}

// Las dos tarjetas dicen lo mismo con la misma forma (título corto con «y más», una frase, cuatro
// oficios): así quedan del mismo alto y se comparan de un vistazo.
const OPCIONES: Opcion[] = [
  {
    id: 'restaurantes',
    titulo: 'Restaurantes, cafeterías y más',
    frase:
      'Pedidos, mesas, cocina, caja e inventario. El asistente toma el pedido por WhatsApp y lo deja en tu caja.',
    oficios: ['Restaurante', 'Comidas rápidas', 'Cafetería', 'Bar'],
    imagen: 'pedidos',
    alt: 'Pantalla de despacho de EscalApp: una tarjeta por pedido, con el cliente, los productos, el total y el botón de cobrar.',
    ruta: '/restaurantes',
    boton: 'Ver EscalApp para restaurantes',
    // El #0084 «para llevar» de $24.000 es la primera tarjeta de la captura de Despacho de debajo.
    chat: [
      { de: 'cliente', texto: 'Hola, ¿ya están atendiendo?' },
      { de: 'asistente', texto: '¡Hola! Sí, ya estamos atendiendo. ¿Qué te provoca hoy?' },
      { de: 'cliente', texto: 'Una hamburguesa doble para llevar, porfa' },
      { de: 'asistente', texto: 'Hamburguesa doble para llevar, $24.000. ¿Te la confirmo?' },
      { de: 'cliente', texto: 'Sí, dale' },
      { de: 'asistente', texto: 'Listo, quedó el pedido #0084. Te aviso cuando esté.' },
    ],
  },
  {
    id: 'reservas',
    titulo: 'Barberías, salones, spas y más',
    frase:
      'Agenda, caja, informes y una página para que te agenden solos. El asistente agenda la cita por WhatsApp.',
    oficios: ['Barbería', 'Salón de belleza', 'Spa', 'Estética'],
    imagen: 'reserva-agenda',
    alt: 'Agenda de EscalApp: una columna por profesional con las citas del día, el cliente, el servicio y su estado.',
    ruta: '/reservas',
    boton: 'Ver EscalApp para negocios de citas',
    // El orden del asistente de reserva: servicio, día y hora con su profesional, nombre.
    chat: [
      { de: 'cliente', texto: 'Hola, buenas' },
      { de: 'asistente', texto: '¡Hola! ¿Qué servicio quieres agendar?' },
      { de: 'cliente', texto: 'Corte y barba, mañana en la mañana' },
      { de: 'asistente', texto: 'Tengo a las 10:30 con Camila. ¿Te sirve?' },
      { de: 'cliente', texto: 'Sí, perfecto' },
      { de: 'asistente', texto: 'Listo, quedó agendada. Te la recuerdo un día antes.' },
    ],
  },
];

const COMUNES: Comun[] = [
  {
    titulo: 'Tu WhatsApp contesta solo',
    texto:
      'El asistente responde a cualquier hora y deja el pedido o la cita en tu sistema, sin que nadie la copie a mano. Viene en el plan con asistente.',
  },
  {
    titulo: 'Lo pruebas 30 días sin pagar',
    texto: 'No pedimos tarjeta ni firmas contrato. Usas el sistema completo y al final eliges el plan.',
  },
  {
    titulo: 'Los mismos planes y precios',
    texto:
      'Emprendedor a $37.999 al mes y con asistente a $77.999. El asistente trae 1.000 mensajes de WhatsApp al mes; si tu negocio escribe más, cada mensaje extra (unos $2,54) lo cobra WhatsApp a tu tarjeta, no nosotros.',
  },
];

/**
 * Un logo de la franja de aliados o de clientes. Sin `imagen`, el nombre se escribe como logotipo;
 * sin `url`, no enlaza. Todos se pintan en gris y recuperan su color al pasar el cursor.
 */
interface Logo {
  nombre: string;
  /** Archivo dentro de `images/aliados/`. */
  imagen?: string;
  url?: string;
  /** Los logos de cliente son insignias cuadradas con fondo: se recortan en círculo. */
  insignia?: boolean;
  /** Un ícono sin letras (el de WhatsApp): se escribe el nombre al lado. */
  conNombre?: boolean;
}

/** Las plataformas con las que trabaja EscalApp. Factus no va: lo impide su acuerdo de confidencialidad. */
const ALIADOS: Logo[] = [
  { nombre: 'Meta', imagen: 'meta.svg', url: 'https://www.meta.com' },
  {
    nombre: 'WhatsApp Business',
    imagen: 'whatsapp.svg',
    url: 'https://business.whatsapp.com',
    conNombre: true,
  },
  { nombre: 'Wompi', imagen: 'wompi.svg', url: 'https://wompi.com' },
  // Escrito y no con su logo: el archivo que llegó viene aplanado sobre negro (letras negras con un
  // borde fino) y no se puede recortar sin deformarlo. Pedir el PNG transparente o el SVG.
  { nombre: 'JDD Consultores', url: 'https://orbita.jddconsultores.com/' },
];

/**
 * Negocios reales que trabajan hoy con EscalApp (producción, 2026-10-26). Cada uno enlaza a lo que
 * su cliente ve: la carta virtual (restaurante) o su página para agendar (reserva). Logos en blanco
 * y negro, como sellos sobre negro: los envió el dueño el 2026-10-26 (Zona Burger es el que subió el
 * propio negocio). Sin logo, el nombre escrito: ICONIC no tiene, y Quesudas Yomi Yomi y Mi Dulce Nariño
 * aún no lo han dado. Fuera: negocios de prueba (10, 12), los inactivos (14) y los de módulos sin
 * desplegar (2, 7, 8).
 */
const CARTA = 'https://escalapp.cloud/restaurante/carta/';
const CLIENTES: Logo[] = [
  { nombre: 'Zona Burger', imagen: 'zona-burger.webp', url: `${CARTA}6`, insignia: true },
  { nombre: 'Zona Burger VIP', imagen: 'zona-burger-vip.webp', url: `${CARTA}27`, insignia: true },
  { nombre: 'El Callejero', imagen: 'el-callejero.webp', url: `${CARTA}13`, insignia: true },
  {
    nombre: "D'Alex Barber Studio",
    imagen: 'd-alex-barberia.webp',
    url: 'https://d-alex-barberia.escalapp.cloud',
    insignia: true,
  },
  { nombre: 'Quesudas Yomi Yomi', url: `${CARTA}28` },
  { nombre: 'ICONIC', url: `${CARTA}15` },
  { nombre: 'Mi Dulce Nariño', url: `${CARTA}29` },
];

/**
 * Los oficios del registro de esta página: los de las dos. El `nombre` es lo que viaja al backend y
 * se valida contra la base; las etiquetas son el respaldo para cuando la API no contesta (prerender).
 */
const OFICIOS_INICIO: { nombre: string; label: string }[] = [
  { nombre: 'RESTAURANTE', label: 'Restaurante' },
  { nombre: 'COMIDAS RAPIDAS', label: 'Comidas rápidas' },
  { nombre: 'CAFETERIA', label: 'Cafetería' },
  { nombre: 'BAR', label: 'Bar' },
  { nombre: 'BARBERIA', label: 'Barbería' },
  { nombre: 'SALON DE BELLEZA', label: 'Salón de belleza' },
  { nombre: 'SPA Y ESTETICA', label: 'Spa' },
  { nombre: 'CENTRO DE ESTETICA', label: 'Centro de estética' },
  { nombre: 'TATUAJES Y PERFORACIONES', label: 'Tatuajes y perforaciones' },
  { nombre: 'PELUQUERIA CANINA', label: 'Cuidado de mascotas' },
  { nombre: 'CONSULTORIO', label: 'Consultorio' },
  { nombre: 'HOTEL', label: 'Hospedaje' },
];

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, TemaSelectorComponent],
  providers: [PruebaGratisStore],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioComponent {
  private readonly seo = inject(SeoService);
  private readonly assets = inject(AssetService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly prueba = inject(PruebaGratisStore);

  protected readonly opciones = OPCIONES;
  protected readonly comunes = COMUNES;
  /** Apagados por ahora: el dueño está decidiendo si la franja de aliados va o no. */
  protected readonly aliados = ALIADOS;
  /**
   * Solo los que tienen logo: una fila de nombres escritos junto a logos se ve a medias. Cuando haya
   * más logos, esta franja pasa a ser un carrusel.
   */
  protected readonly clientes = CLIENTES.filter((c) => c.imagen);

  /**
   * El reloj del chat de las tarjetas: cada tic llega un mensaje. Nace en 1 para que el servidor (y
   * quien pide menos movimiento) vea el saludo y la primera respuesta, quietos.
   */
  private readonly pasoChat = signal(1);

  /** Para la barra legal del pie. */
  protected readonly anio = new Date().getFullYear();

  /** El WhatsApp comercial, el único canal real. El número vive en `environment`. */
  protected readonly whatsappContacto =
    `${environment.whatsappUrl}?text=${encodeURIComponent('Hola, quiero saber más de EscalApp para mi negocio')}`;

  constructor() {
    // En el constructor y no en `afterNextRender`: la ruta es `Prerender` y los rastreadores de
    // WhatsApp y Facebook no ejecutan JavaScript.
    this.seo.aplicar({
      titulo: 'EscalApp — el sistema para tu negocio, con un asistente en WhatsApp',
      descripcion:
        'Restaurantes, barberías, salones, spas y otros negocios de citas: el sistema para operarlos y un asistente que contesta tu WhatsApp. Prueba 30 días gratis, sin tarjeta.',
      ruta: '/',
    });

    this.prueba.oficios.set(OFICIOS_INICIO);
    afterNextRender(() => {
      this.prueba.cargarOficios(OFICIOS_INICIO.map((o) => o.nombre));
      montarEntradas(this.destroyRef);
      this.arrancarChat();
    });
  }

  /**
   * Los mensajes que se ven ahora en el chat de una tarjeta: llegan de uno en uno, caben
   * `VENTANA_CHAT`, y los viejos se desvanecen según su `edad`. Al terminar la conversación se queda
   * dos tics a la vista, se borra entera (`sale`) y vuelve a empezar. La segunda tarjeta va un tic
   * por detrás para que las dos no hablen a la vez.
   */
  protected chatVisible(o: Opcion, desfase: number): MensajeVisible[] {
    const total = o.chat.length;
    const ciclo = total + 3;
    const p = (this.pasoChat() + ciclo - desfase) % ciclo;
    const sale = p >= total + 2;
    const llegados = sale ? total : Math.min(p + 1, total);
    const desde = Math.max(0, llegados - VENTANA_CHAT);
    return o.chat.slice(desde, llegados).map((m, k) => ({
      ...m,
      i: desde + k,
      edad: llegados - 1 - (desde + k),
      sale,
    }));
  }

  /**
   * Solo en el navegador y sin `prefers-reduced-motion`. El reloj no avanza con la pestaña oculta ni
   * con las tarjetas fuera de la pantalla: nadie lo ve y no tiene por qué gastar.
   */
  private arrancarChat(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const reloj = window.setInterval(() => {
      if (document.hidden) return;
      const tarjetas = document.querySelector('.eleccion');
      const caja = tarjetas?.getBoundingClientRect();
      if (caja && (caja.bottom < 0 || caja.top > window.innerHeight)) return;
      this.pasoChat.update((n) => n + 1);
    }, RITMO_CHAT_MS);
    this.destroyRef.onDestroy(() => window.clearInterval(reloj));
  }

  /** Los recursos de la marca (logo, pulpo, logotipo), por el servicio como el resto de imágenes. */
  protected marca(archivo: string): string {
    return this.assets.getAssetPath(`marca/${archivo}`);
  }

  /** Una pose de la mascota oficial (WebP con fondo transparente, a 480 o 960 px de ancho). */
  protected mascota(pose: 'laptop' | 'guino' | 'sentado' | 'descanso', ancho: 480 | 960): string {
    return this.assets.getAssetPath(`marca/pulpo-${pose}-${ancho}.webp`);
  }

  protected logo(archivo: string): string {
    return this.assets.getAssetPath(`aliados/${archivo}`);
  }

  protected rutaImagen(nombre: string, ancho: 640 | 1280): string {
    return this.assets.getAssetPath(`producto/${nombre}-${ancho}.webp`);
  }

  protected rutaMovil(nombre: string): string {
    return this.assets.getAssetPath(`producto/${nombre}-movil-430.webp`);
  }


  /** Sin oficio por defecto: la página habla de dos mundos, así que el visitante elige el suyo. */
  protected abrirPrueba(): void {
    this.prueba.abrir();
  }
}
