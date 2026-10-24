import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AssetService } from '../../core/services/asset.service';
import { SeoService } from '../../core/services/seo.service';
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
 * Gimnasio, tienda y parqueadero no se mencionan: sus apps no están en producción. Quien tiene otro
 * oficio se encuentra con un enlace al WhatsApp comercial, no con una promesa.
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
}

interface Comun {
  titulo: string;
  texto: string;
}

const OPCIONES: Opcion[] = [
  {
    id: 'restaurantes',
    titulo: 'Restaurantes, cafeterías y bares',
    frase:
      'Pedidos, mesas, cocina, caja e inventario. El asistente toma el pedido por WhatsApp y lo deja en tu caja.',
    oficios: ['Restaurante', 'Comidas rápidas', 'Cafetería', 'Bar'],
    imagen: 'pedidos',
    alt: 'Pantalla de despacho de EscalApp: una tarjeta por pedido, con el cliente, los productos, el total y el botón de cobrar.',
    ruta: '/restaurantes',
    boton: 'Ver EscalApp para restaurantes',
  },
  {
    id: 'reservas',
    titulo: 'Barberías, salones, spas y otros negocios de citas',
    frase:
      'Agenda por profesional, una página para que tus clientes agenden solos, caja e informes. El asistente agenda la cita por WhatsApp.',
    oficios: [
      'Barbería',
      'Salón de belleza',
      'Spa',
      'Estética',
      'Tatuajes',
      'Mascotas',
      'Consultorio',
      'Hospedaje',
    ],
    imagen: 'reserva-agenda',
    alt: 'Agenda de EscalApp: una columna por profesional con las citas del día, el cliente, el servicio y su estado.',
    ruta: '/reservas',
    boton: 'Ver EscalApp para negocios de citas',
  },
];

const COMUNES: Comun[] = [
  {
    titulo: 'Un asistente en tu propio WhatsApp',
    texto:
      'Contesta a cualquier hora y deja el pedido o la cita en tu sistema. Viene en el plan con asistente.',
  },
  {
    titulo: '30 días de prueba',
    texto: 'Sin tarjeta y sin contrato. Entras con todo abierto y eliges plan al terminar.',
  },
  {
    titulo: 'Dos planes, el mismo precio',
    texto:
      'Emprendedor, $37.999 al mes, y Emprendedor con asistente, $77.999. Desde el mensaje 1.001 del mes, WhatsApp lo cobra Meta, no nosotros.',
  },
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
  imports: [RouterLink],
  providers: [PruebaGratisStore],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioComponent {
  private readonly seo = inject(SeoService);
  private readonly assets = inject(AssetService);

  protected readonly prueba = inject(PruebaGratisStore);

  protected readonly opciones = OPCIONES;
  protected readonly comunes = COMUNES;

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
      ruta: '/inicio',
    });

    this.prueba.oficios.set(OFICIOS_INICIO);
    afterNextRender(() => this.prueba.cargarOficios(OFICIOS_INICIO.map((o) => o.nombre)));
  }

  protected rutaImagen(nombre: string, ancho: 640 | 1280): string {
    return this.assets.getAssetPath(`producto/${nombre}-${ancho}.webp`);
  }

  protected rutaMovil(nombre: string): string {
    return this.assets.getAssetPath(`producto/${nombre}-movil-430.webp`);
  }

  /** El pulpo que asoma por el corte del pie, el mismo de las páginas de cada motor. */
  protected get pulpoPie(): string {
    return this.assets.getAssetPath('producto/pulpo-emergiendo-520.webp');
  }

  /** Sin oficio por defecto: la página habla de dos mundos, así que el visitante elige el suyo. */
  protected abrirPrueba(): void {
    this.prueba.abrir();
  }
}
