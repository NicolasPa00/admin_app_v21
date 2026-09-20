import { Component, inject, signal, computed, afterNextRender, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  LucideAngularModule,
  LucideIconProvider,
  LUCIDE_ICONS,
  Sun,
  Moon,
  Rocket,
  Shield,
  Users,
  BarChart3,
  ChevronRight,
  Check,
  Star,
  Zap,
  Store,
  Smartphone,
  ArrowRight,
  X,
  UtensilsCrossed,
  Coffee,
  Sparkles,
  Beer,
  CakeSlice,
  Bike,
  HandHeart,
  Car,
  Scissors,
  ShoppingCart,
  ShoppingBag,
  Wrench,
  PiggyBank,
  Landmark,
  Dumbbell,
  Croissant,
  IceCreamCone,
  Sandwich,
  Pizza,
  Flower2,
  Hand,
  Stethoscope,
  CalendarCheck,
  ShieldCheck,
  Scale,
  BadgeCheck,
  BotMessageSquare,
  ReceiptText,
  UserPlus,
  Monitor,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  CheckCheck,
  Mail,
  Building2,
  Facebook,
  Instagram,
  Youtube,
  FileText,
  MessageCircle,
  Syringe,
  PenTool,
  PawPrint,
  Dog,
  Hotel,
  BedDouble,
  Tent,
} from 'lucide-angular';

import { AssetService } from '../core/services/asset.service';
import { AuthService } from '../auth/data-access/auth.service';
import { environment } from '../../environments/environment';

/* ──────────────────────────────────────────────────────────
   Datos estáticos
   ────────────────────────────────────────────────────────── */

interface TipoNegocio {
  id: number;
  /** La clave que viaja al backend; tiene que existir en `gener_tipo_negocio.nombre`. */
  nombre: string;
  icon: string;
  label: string;
  disponible: boolean;
  /**
   * El motor que lo atiende: 'RESTAURANTE' o 'RESERVA'.
   *
   * Es lo que decide qué funciones se le prometen en los planes. Una heladería y una pizzería
   * son oficios distintos y el mismo software, así que la lista de funciones cuelga de aquí y
   * no del oficio: si colgara del oficio habría catorce copias casi idénticas.
   */
  modulo: string;
}

interface Feature {
  icon: string;
  titulo: string;
  descripcion: string;
}

/**
 * Los oficios que se ofrecen, **como respaldo**.
 *
 * La lista de verdad vive en `general.gener_tipo_negocio` y llega por `GET /admin/rubros`. Esta
 * copia existe porque la landing se **prerenderiza**: sin ella, el HTML que sirve Caddy saldría
 * sin un solo chip y el visitante vería el hueco hasta que respondiera la API. También cubre que
 * la API esté caída, que en una página de marketing no puede significar página rota.
 *
 * Que se desincronice no rompe nada, y esa es la diferencia con antes: lo que el visitante elija
 * se valida contra la base al registrarse, así que un chip de más da un error claro en vez de
 * crear un negocio sin vertical, que es lo que pasaba cuando esta lista era la única fuente.
 *
 * El `id` es solo para la plantilla (`track` y chip activo); lo que viaja al backend es `nombre`.
 */
const RUBROS_RESPALDO: TipoNegocio[] = [
  // ── Motor restaurante ──
  { id: 1,  nombre: 'RESTAURANTE',            icon: 'utensils-crossed', label: 'Restaurante',            disponible: true, modulo: 'RESTAURANTE' },
  { id: 2,  nombre: 'CAFETERIA',              icon: 'coffee',           label: 'Cafetería',              disponible: true, modulo: 'RESTAURANTE' },
  { id: 3,  nombre: 'PANADERIA Y REPOSTERIA', icon: 'croissant',        label: 'Panadería / Repostería', disponible: true, modulo: 'RESTAURANTE' },
  { id: 4,  nombre: 'HELADERIA',              icon: 'ice-cream-cone',   label: 'Heladería',              disponible: true, modulo: 'RESTAURANTE' },
  { id: 5,  nombre: 'BAR',                    icon: 'beer',             label: 'Bar',                    disponible: true, modulo: 'RESTAURANTE' },
  { id: 6,  nombre: 'COMIDAS RAPIDAS',        icon: 'sandwich',         label: 'Comidas rápidas',        disponible: true, modulo: 'RESTAURANTE' },
  { id: 7,  nombre: 'PIZZERIA',               icon: 'pizza',            label: 'Pizzería',               disponible: true, modulo: 'RESTAURANTE' },

  // ── Motor reserva ──
  { id: 8,  nombre: 'BARBERIA',            icon: 'scissors',    label: 'Barbería',         disponible: true, modulo: 'RESERVA' },
  { id: 9,  nombre: 'SALON DE BELLEZA',    icon: 'sparkles',    label: 'Salón de belleza', disponible: true, modulo: 'RESERVA' },
  { id: 10, nombre: 'PELUQUERIA',          icon: 'scissors',    label: 'Peluquería',       disponible: true, modulo: 'RESERVA' },
  { id: 11, nombre: 'SPA Y ESTETICA',      icon: 'flower-2',    label: 'Spa',              disponible: true, modulo: 'RESERVA' },
  { id: 15, nombre: 'CENTRO DE ESTETICA',  icon: 'syringe',     label: 'Centro de estética', disponible: true, modulo: 'RESERVA' },
  { id: 12, nombre: 'MANICURE Y PEDICURE', icon: 'hand',        label: 'Uñas',             disponible: true, modulo: 'RESERVA' },
  { id: 13, nombre: 'MASAJES',             icon: 'hand-heart',  label: 'Masajes',          disponible: true, modulo: 'RESERVA' },
  { id: 16, nombre: 'TATUAJES Y PERFORACIONES', icon: 'pen-tool', label: 'Tatuajes y perforaciones', disponible: true, modulo: 'RESERVA' },
  { id: 17, nombre: 'PELUQUERIA CANINA',   icon: 'paw-print',   label: 'Peluquería y spa de mascotas', disponible: true, modulo: 'RESERVA' },
  { id: 18, nombre: 'GUARDERIA DE MASCOTAS', icon: 'dog',       label: 'Guardería y hotel de mascotas', disponible: true, modulo: 'RESERVA' },
  { id: 14, nombre: 'CONSULTORIO',         icon: 'stethoscope', label: 'Consultorio',      disponible: true, modulo: 'RESERVA' },
  { id: 19, nombre: 'HOTEL',               icon: 'hotel',       label: 'Hotel',            disponible: true, modulo: 'RESERVA' },
  { id: 20, nombre: 'HOSTAL',              icon: 'bed-double',  label: 'Hostal',           disponible: true, modulo: 'RESERVA' },
  { id: 21, nombre: 'CABANAS Y GLAMPING',  icon: 'tent',        label: 'Cabañas / Glamping', disponible: true, modulo: 'RESERVA' },
  { id: 22, nombre: 'APARTAMENTOS TURISTICOS', icon: 'building-2', label: 'Apartamentos turísticos', disponible: true, modulo: 'RESERVA' },
];

/**
 * Una familia de oficios: lo que el selector de planes enseña como botón.
 *
 * Es la capa de marketing sobre los motores del producto — hay exactamente una por `modulo`, así
 * que elegir familia es elegir motor, que es lo único que de verdad cambia features y precio.
 */
interface CategoriaNegocio {
  /** El motor; también la clave de `FEATURES_POR_MODULO`. */
  modulo: string;
  label: string;
  icon: string;
  /** Qué hace el sistema para esta familia — la línea bajo el título de la tarjeta. */
  tagline: string;
  /** El oficio que presta ilustración y features mientras la familia está elegida. */
  representante: string;
  /** Oficios ya nombrados en el título: no se repiten en la tira de «también gestionan…». */
  implicitos: string[];
}

/**
 * Las dos familias del selector — una por motor.
 *
 * Antes eran ocho chips de oficio suelto (restaurante, cafetería, bar, comidas rápidas, barbería,
 * salón, spa, consultorio) y se leía como un catálogo a medias: ocho botones que en realidad solo
 * conmutaban entre dos juegos de features, y el visitante con un glamping o una veterinaria no se
 * veía en ninguno. Dos familias grandes dicen la verdad del producto (hay dos motores) y la
 * amplitud se demuestra debajo, con la tira de oficios que cada familia cubre.
 *
 * `representante` es un `nombre` de `gener_tipo_negocio`: si el catálogo de la API lo pierde, el
 * cómputo cae al primer oficio del mismo motor, así que no hay forma de quedarse sin ilustración.
 */
const CATEGORIAS: CategoriaNegocio[] = [
  {
    modulo: 'RESTAURANTE',
    label: 'Restaurante / Gastrobar',
    icon: 'utensils-crossed',
    tagline: 'Punto de venta, carta digital, comandas a cocina y domicilios.',
    representante: 'RESTAURANTE',
    implicitos: ['RESTAURANTE', 'BAR'],
  },
  {
    modulo: 'RESERVA',
    label: 'Agenda y Reservas',
    icon: 'calendar-check',
    tagline: 'Agenda de citas, profesionales, servicios y recordatorios automáticos.',
    representante: 'BARBERIA',
    implicitos: [],
  },
];

/**
 * Oficios que **no** se listan en la tira de la landing.
 *
 * No se borran del catálogo: el registro los sigue ofreciendo y hay negocios dados de alta con
 * ellos. Lo que sobra es enseñarlos aquí, donde la tira vende amplitud y no precisión: «Uñas» y
 * «Masajes» ya caben en salón de belleza y spa, y hostal, cabañas y apartamentos turísticos
 * quedan dichos con «Hospedaje» (ver `ETIQUETAS_LANDING`). Tres rótulos que dicen lo mismo se
 * leen como relleno, no como cobertura. «Peluquería» se va por lo mismo: ya está dicha en
 * barbería y en salón de belleza.
 */
const OFICIOS_OCULTOS = new Set([
  'PELUQUERIA',
  'MANICURE Y PEDICURE',
  'MASAJES',
  'GUARDERIA DE MASCOTAS',
  'HOSTAL',
  'CABANAS Y GLAMPING',
  'APARTAMENTOS TURISTICOS',
]);

/**
 * Rótulos de marketing para la tira, que no son los del catálogo.
 *
 * «Hospedaje» y «Cuidado de mascotas» son categorías, no oficios: cada una cubre los vecinos que
 * `OFICIOS_OCULTOS` se lleva, así que quien tiene un glamping o una guardería canina se sigue
 * viendo en la lista. La base de datos y el desplegable del registro conservan el nombre exacto
 * — allí sí importa distinguir un hotel de un hostal.
 */
const ETIQUETAS_LANDING: Record<string, string> = {
  HOTEL: 'Hospedaje',
  'PELUQUERIA CANINA': 'Cuidado de mascotas',
};

/**
 * Lo que se enseña pero **no se puede contratar** todavía. Es copy de marketing, no catálogo, y
 * por eso vive aquí y no en la base. Un tipo pasa de esta lista a la de arriba el día que su
 * módulo se despliegue, y entonces basta con apuntarlo en `gener_tipo_negocio.id_tipo_modulo`.
 *
 * ⚠️ Oculta del selector desde 2026-09-19 (no se borra, por si se reactiva): ver
 * `CATEGORIAS` — mientras ningún módulo de esta lista esté desplegado, mostrar sus chips solo
 * añade botones que no llevan a ningún lado.
 */
const PROXIMAMENTE: TipoNegocio[] = [
  // Hay código, pero no están en producción.
  { id: 101, nombre: 'PARQUEADERO', icon: 'car',          label: 'Parqueadero', disponible: false, modulo: '' },
  { id: 102, nombre: 'GIMNASIO',    icon: 'dumbbell',     label: 'Gimnasio',    disponible: false, modulo: '' },
  { id: 103, nombre: 'TIENDA',      icon: 'shopping-bag', label: 'Tienda',      disponible: false, modulo: '' },

  // Sin construir.
  { id: 104, nombre: 'SUPERMERCADO',              icon: 'shopping-cart', label: 'Supermercado',      disponible: false, modulo: '' },
  { id: 105, nombre: 'GESTION_TALLER_AUTOMOTRIZ', icon: 'wrench',        label: 'Taller automotriz', disponible: false, modulo: '' },
  { id: 106, nombre: 'FONDO_AHORROS',             icon: 'piggy-bank',    label: 'Fondo de ahorros',  disponible: false, modulo: '' },
  { id: 107, nombre: 'FINANCIERA_PRESTAMOS',      icon: 'landmark',      label: 'Financiera',        disponible: false, modulo: '' },
];

/* ──────────────────────────────────────────────────────────
   Planes: cuatro tarjetas, ni configurador ni pasos
   ──────────────────────────────────────────────────────────

   Entre el 2026-09-19 y hoy esto fue un configurador «arma tu Mac»: se elegía plan, luego tramo
   de facturación, y un único resumen pegajoso mostraba el precio. Se leía bien pero escondía la
   oferta: para saber cuánto cuesta el sistema con facturación había que hacer dos clics y
   recordar el número anterior. Cuatro tarjetas fijas enseñan las cuatro combinaciones reales a la
   vez, que es lo que un visitante compara antes de decidir.

   Lo único que sigue siendo elegible es el paquete de documentos, y está dentro de las dos
   tarjetas que lo llevan — compartido, así que elegir «L» mueve el precio de las dos a la vez.

   Los precios NO son libres: salen de `general.gener_plan` (Básico $27.999 / Avanzado $59.999) y
   de `admin_ws/docs/precios-y-planes.md` §3. Los nombres de la landing sí son de marketing —
   «Plan Emprendedor» es el Básico de la base de datos, y la consola sigue llamándolo Básico.
*/

/** Los dos planes de verdad, los que existen en `general.gener_plan`. */
type PlanBaseId = 'BASICO' | 'AVANZADO';

/**
 * El precio publicado, **por motor y por plan**.
 *
 * Hasta el 2026-09-20 era un solo número por plan para los dos verticales, y eso ya no describe
 * lo que se entrega: el motor de reserva monta además un portal público por negocio —donde el
 * cliente final ve los servicios y agenda solo— y eso es un canal de venta, no una pantalla más.
 * La carta virtual del restaurante se le parece, pero enseña el menú; el portal de agenda trae
 * la cita hecha. Por eso reserva vale más, y la diferencia se mantiene en los dos planes.
 *
 * ⚠️ `general.gener_plan` guarda **un** precio por plan, sin distinguir motor. Mientras eso no
 * cambie, esta tabla es lo que se promete y aquella es lo que se cobra: hay que alinear la base
 * (o crear un plan por motor) antes de publicar precios distintos.
 */
const PRECIO_PLAN: Record<string, Record<PlanBaseId, number>> = {
  RESTAURANTE: { BASICO: 27999, AVANZADO: 59999 },
  RESERVA:     { BASICO: 37999, AVANZADO: 69999 },
};

/**
 * El add-on de Facturación Electrónica, por volumen de documentos — ver
 * `admin_ws/docs/precios-y-planes.md` §3. El documento los llama «tramos»; aquí son «paquetes»,
 * que es lo que entiende quien compra. Es una cuota fija mensual, nunca un cobro por documento,
 * y el paquete se mide con el primer mes real: no se asigna por lo que el negocio dice vender.
 *
 * `precio` es lo que cuesta **suelto**, sumado a un plan que no lo trae: es el número que se
 * enseña en los complementos. Dentro de un plan que ya lo incluye, el precio no se suma, se
 * publica entero (`PRECIO_CON_FACTURACION`).
 */
interface PaqueteDocumentos {
  id: string;
  /** El rótulo corto de la tarjeta: «100 documentos». */
  documentos: string;
  /** La frase completa, para las etiquetas accesibles. */
  detalle: string;
  precio: number;
}

const PAQUETES_FACTURACION: PaqueteDocumentos[] = [
  { id: 'S',  documentos: '100 documentos',   detalle: 'hasta 100 documentos al mes',   precio: 38999 },
  { id: 'M',  documentos: '500 documentos',   detalle: 'hasta 500 documentos al mes',   precio: 58999 },
  { id: 'L',  documentos: '1.200 documentos', detalle: 'hasta 1.200 documentos al mes', precio: 78999 },
  { id: 'XL', documentos: '2.500 documentos', detalle: 'hasta 2.500 documentos al mes', precio: 98999 },
];

/**
 * El precio publicado de los planes que traen facturación, por paquete.
 *
 * Es una tabla y no `PRECIO_PLAN + paquete.precio` a propósito: lo que se vende es un plan
 * completo, no una suma que el visitante tenga que auditar. Que la tarjeta enseñara «$27.999 del
 * plan + $39.000 de facturación» invitaba justo a eso — a restar, a comparar sumandos y a
 * preguntarse por qué el módulo suelto cuesta distinto que dentro del paquete.
 *
 * Los saltos entre paquetes son los mismos de `PAQUETES_FACTURACION` ($20.000 entre uno y el
 * siguiente), y los dos precios de Avanzado coinciden con los de `precios-y-planes.md` §3
 * (Avanzado + Facturación S = $98.999, XL = $158.999).
 */
const PRECIO_CON_FACTURACION: Record<string, Record<PlanBaseId, Record<string, number>>> = {
  RESTAURANTE: {
    BASICO:   { S: 66999,  M: 86999,  L: 106999, XL: 126999 },
    AVANZADO: { S: 98999,  M: 118999, L: 138999, XL: 158999 },
  },
  RESERVA: {
    BASICO:   { S: 76999,  M: 96999,  L: 116999, XL: 136999 },
    AVANZADO: { S: 108999, M: 128999, L: 148999, XL: 168999 },
  },
};

/**
 * Lo que cuesta al año el certificado digital de la DIAN, que en estos planes ponemos nosotros.
 *
 * Es el número que se tacha en el precio anual: el visitante no se lo ahorra por una promoción,
 * se lo ahorra porque el certificado va dentro. El costo ya estaba contemplado en el margen de
 * los paquetes (`admin_ws/docs/precios-y-planes.md` §2 lo suma como $10.833 al mes), así que
 * incluirlo no abre un agujero: lo que hace es dejar de cobrarlo dos veces.
 */
const VALOR_CERTIFICADO_ANUAL = 130000;

/**
 * Los complementos que se suman a cualquier plan.
 *
 * Existen porque los límites del plan (usuarios, cajas) son de verdad: un negocio que crece no
 * tiene que saltar de plan para meter a una persona más. Los precios salen de la misma lógica que
 * `admin_ws/docs/precios-y-planes.md` §1 — lo que no nos cuesta por inquilino se cobra barato y
 * fijo; el paquete de documentos, que sí cuesta, tiene su propia tabla (`PAQUETES_FACTURACION`).
 */
interface Complemento {
  icon: string;
  titulo: string;
  descripcion: string;
  /** `null` en la facturación: ahí el precio es una tabla, no un número. */
  precio: number | null;
  periodo: string;
}

const COMPLEMENTOS: Complemento[] = [
  {
    icon: 'user-plus',
    titulo: 'Usuario adicional',
    descripcion: 'Una persona más en tu equipo, con su propio acceso y sus propios permisos.',
    precio: 3999,
    periodo: '/mes',
  },
  {
    icon: 'monitor',
    titulo: 'Caja adicional',
    descripcion: 'Otro punto de cobro abierto a la vez — una segunda barra, un segundo mostrador.',
    precio: 9999,
    periodo: '/mes',
  },
  {
    icon: 'receipt-text',
    titulo: 'Paquete de facturación',
    descripcion: 'Documentos electrónicos ante la DIAN. Cuota fija al mes, nunca por documento.',
    precio: null,
    periodo: '',
  },
];

/** Un módulo resaltado dentro de una tarjeta: lo que la diferencia del Plan Emprendedor pelado. */
interface ModuloDestacado {
  icon: string;
  titulo: string;
  /** El detalle: solo con la tarjeta desplegada. Plegada, el módulo es icono y título. */
  puntos: string[];
  /** `true` en el de facturación: el selector de paquetes vive dentro del bloque. */
  conPaquetes: boolean;
}

interface TarjetaPlan {
  id: string;
  nombre: string;
  descripcion: string;
  /** Sobre qué plan de `gener_plan` se arma — de ahí sale el precio y la lista de funciones. */
  base: PlanBaseId;
  /** Lleva el asistente de IA en WhatsApp (lo que hoy distingue al Avanzado). */
  conAsistente: boolean;
  /** Suma el paquete de documentos elegido al precio que se muestra. */
  conFacturacion: boolean;
  /**
   * Cuántas personas y cuántos puntos de cobro entran en el precio.
   *
   * Son cifras de la landing, no un límite que el backend haga cumplir hoy (`gener_plan` solo
   * guarda nombre y precio). Si algún día se cobra por encima del límite, el número tiene que
   * salir de la base y no de aquí — mientras tanto, esto es la promesa comercial y por eso sube
   * con el precio: lo que sostiene el escalón es el tamaño del negocio, no el software.
   */
  usuarios: number;
  cajas: number;
  /**
   * Solo el Emprendedor se prueba gratis. En los demás hay un costo externo real desde el primer
   * día —WhatsApp le factura a Meta, la facturación consume documentos y certificado—, así que
   * regalar siete días de eso es regalar dinero, no producto.
   */
  conTrial: boolean;
  destacado: boolean;
}

/** El plan que vende el asistente de WhatsApp: la barra de anuncio abre su detalle. */
const ID_PLAN_ASISTENTE = 'emprendedor-ia';

const TARJETAS_PLAN: TarjetaPlan[] = [
  {
    id: 'emprendedor',
    nombre: 'Plan Emprendedor',
    descripcion: 'Todo lo esencial para operar tu negocio desde el primer día.',
    base: 'BASICO',
    conAsistente: false,
    conFacturacion: false,
    usuarios: 4,
    cajas: 1,
    conTrial: true,
    destacado: false,
  },
  {
    id: ID_PLAN_ASISTENTE,
    nombre: 'Emprendedor + Asistente IA',
    descripcion: 'El sistema completo y un asistente que atiende tu WhatsApp por ti.',
    base: 'AVANZADO',
    conAsistente: true,
    conFacturacion: false,
    usuarios: 8,
    cajas: 2,
    conTrial: false,
    destacado: true,
  },
  {
    id: 'emprendedor-factura',
    nombre: 'Emprendedor + Facturación',
    descripcion: 'Todo el Plan Emprendedor y tus facturas electrónicas ante la DIAN.',
    base: 'BASICO',
    conAsistente: false,
    conFacturacion: true,
    usuarios: 10,
    cajas: 2,
    conTrial: false,
    destacado: false,
  },
  {
    id: 'emprendedor-total',
    nombre: 'Emprendedor Total',
    descripcion: 'Todo junto: el sistema, el asistente de IA y la facturación electrónica.',
    base: 'AVANZADO',
    conAsistente: true,
    conFacturacion: true,
    usuarios: 15,
    cajas: 3,
    conTrial: false,
    destacado: false,
  },
];

/**
 * Qué incluye el plan, **por motor**.
 *
 * Antes estaba indexado por oficio y había una entrada por chip. Con catorce oficios eso serían
 * catorce listas casi idénticas que envejecerían por separado: la de pizzería diría una cosa y
 * la de heladería otra, aunque sean literalmente el mismo software. Lo que se promete depende
 * del motor, no del rótulo, así que se indexa por motor.
 *
 * `base` es lo que lleva el Plan Emprendedor y, por tanto, lo que llevan las cuatro tarjetas —
 * los usuarios y las cajas no están aquí porque cambian de tarjeta en tarjeta: los pone
 * `tarjetasPlan()` al principio de la lista, que es lo primero que se mira.
 * el requisito de listar todo en cada una, no un «+ lo del plan anterior» que obliga a mirar
 * arriba. `avanzado` es lo que el Avanzado añade *además* del asistente, que va aparte porque se
 * enseña resaltado y con texto propio (`ASISTENTE_POR_MODULO`).
 *
 * El acceso tiene respaldo (`?? RESTAURANTE`), así que un motor nuevo sin lista degrada a la de
 * restaurante en vez de romper la página.
 */
const FEATURES_POR_MODULO: Record<string, { base: string[]; avanzado: string[] }> = {
  RESTAURANTE: {
    base: [
      'Carta digital con pedidos',
      'Comandas a cocina',
      'Mesas y domicilios',
      'Caja y reportes de ventas',
    ],
    avanzado: ['Inventario y sucursales', 'Reportes avanzados'],
  },
  RESERVA: {
    base: [
      'Agenda de citas',
      'Gestión de profesionales',
      'Control de servicios',
      'Recordatorios automáticos',
      'Reportes de ingresos',
    ],
    avanzado: ['Sucursales adicionales', 'Reportes avanzados'],
  },
};

/** Lo que el asistente hace, que no es lo mismo en un restaurante que en una agenda. */
const ASISTENTE_POR_MODULO: Record<string, string[]> = {
  RESTAURANTE: [
    'Responde, toma pedidos y agenda domicilios 24/7',
    'Conecta tu propio número (le pagas a Meta) o usa el nuestro, sin trámites',
  ],
  RESERVA: [
    'Responde, agenda y confirma citas 24/7',
    'Conecta tu propio número (le pagas a Meta) o usa el nuestro, sin trámites',
  ],
};

/** Lo que promete el módulo de facturación, igual en los dos motores: la DIAN no distingue. */
const PUNTOS_FACTURACION: string[] = [
  'Emite y envía tus facturas a la DIAN desde el mismo sistema',
  'Cuota fija al mes según el paquete — nunca pagas por documento',
];

const FEATURES: Feature[] = [
  {
    icon: 'building-2',
    titulo: 'Todo tu negocio en un lugar',
    descripcion:
      'Gestiona tu restaurante, gimnasio, tienda o parqueadero desde una sola plataforma. Ventas, inventario, equipo y reportes — todo centralizado y fácil de controlar.',
  },
  {
    icon: 'users',
    titulo: 'Tu equipo, cada uno con su función',
    descripcion:
      'Cada persona tiene su propio acceso: el cajero solo ve sus ventas, el cocinero solo ve los pedidos, tú ves todo. Sin confusiones, sin errores.',
  },
  {
    icon: 'shield',
    titulo: 'Tu información protegida',
    descripcion:
      'Cada persona entra con su usuario y contraseña personal. Solo acceden a lo que tú les permites. Tus datos siempre seguros y bajo tu control.',
  },
  {
    icon: 'bar-chart-3',
    titulo: 'Reportes en tiempo real',
    descripcion:
      'Ve cómo va tu negocio en cualquier momento: ventas del día, productos más vendidos, ocupación del parqueadero. Todo con gráficas claras y sencillas.',
  },
  {
    icon: 'smartphone',
    titulo: 'Desde cualquier dispositivo',
    descripcion:
      'Funciona perfecto en celular, tablet y computador. Tu equipo trabaja desde donde esté, sin instalar nada. Solo necesitan el navegador.',
  },
  {
    icon: 'zap',
    titulo: 'Crece sin límites',
    descripcion:
      'Empieza hoy y expande cuando quieras. La plataforma crece contigo sin cambiar de sistema ni perder información.',
  },
];

/**
 * Lo que hace el asistente de WhatsApp — antes solo se mencionaba en una línea del hero y en dos
 * viñetas del Plan Avanzado. Es la característica más diferenciadora del producto (el "todo el
 * sistema" ya lo prometen todos los competidores) y no tenía su propia sección.
 */
const CAPACIDADES_WHATSAPP: Feature[] = [
  {
    icon: 'zap',
    titulo: 'Responde al instante',
    descripcion: 'A cualquier hora, sin que tu equipo suelte lo que está haciendo para contestar un mensaje.',
  },
  {
    icon: 'shopping-bag',
    titulo: 'Toma pedidos y agenda citas',
    descripcion: 'Solo, de principio a fin — el cliente pide o agenda por WhatsApp y la orden ya está en tu sistema.',
  },
  {
    icon: 'users',
    titulo: 'Sabe cuándo pasarte el turno',
    descripcion: 'Si el cliente necesita a una persona, avisa a tu equipo — nunca inventa una respuesta.',
  },
];

/**
 * La conversación de ejemplo de la sección de WhatsApp.
 *
 * Es copy, no una transcripción real, pero tiene que parecerlo: mezcla una reserva y un pedido
 * en el mismo hilo porque eso es exactamente lo que el asistente resuelve y lo que separa a
 * EscalApp de un chatbot que solo contesta — la respuesta termina en la agenda y en la caja.
 */
interface MensajeDemo {
  de: 'cliente' | 'bot';
  texto: string;
  hora: string;
}

const CONVERSACION_DEMO: MensajeDemo[] = [
  { de: 'cliente', texto: '¡Hola! ¿Tienen mesa para 4 esta noche?', hora: '7:41 p. m.' },
  {
    de: 'bot',
    texto: '¡Hola, Andrés! Sí 🙌 Me queda a las 8:00 o a las 8:30 p. m. ¿Cuál te sirve?',
    hora: '7:41 p. m.',
  },
  { de: 'cliente', texto: 'A las 8 está perfecto. ¿Y puedo pedir algo para llevar?', hora: '7:42 p. m.' },
  {
    de: 'bot',
    texto: 'Listo: mesa 5 a las 8:00 p. m. a tu nombre. Te paso la carta para el pedido 👇',
    hora: '7:42 p. m.',
  },
];

/** Lo que queda registrado en el sistema cuando termina esa conversación. */
const RESULTADOS_DEMO: Feature[] = [
  {
    icon: 'calendar-check',
    titulo: 'Reserva creada',
    descripcion: 'Mesa 5 · hoy 8:00 p. m. · 4 personas',
  },
  {
    icon: 'shopping-bag',
    titulo: 'Pedido #1042 en cocina',
    descripcion: '$86.000 · para llevar · pagado en la entrega',
  },
  {
    icon: 'user-plus',
    titulo: 'Cliente guardado',
    descripcion: 'Andrés M. · vuelve con su historial la próxima vez',
  },
];

/* Verticales para el diagrama radial (orden = posición en el círculo) */
/**
 * La tira de oficios que atendemos. Se enseña tal cual, así que aquí NO puede haber nada que no
 * podamos operar hoy: es una promesa, no una hoja de ruta. Antes listaba parqueaderos, gimnasios,
 * tiendas, supermercados, talleres y financieras — ninguno desplegado.
 *
 * Los que están son los oficios reales que caben en los dos motores que sí existen.
 */
const ECOSISTEMA = [
  { icon: 'utensils-crossed', label: 'Restaurantes' },
  { icon: 'coffee',           label: 'Cafeterías' },
  { icon: 'scissors',         label: 'Barberías' },
  { icon: 'sparkles',         label: 'Salones de belleza' },
  { icon: 'beer',             label: 'Bares' },
  { icon: 'cake-slice',       label: 'Reposterías' },
  { icon: 'bike',             label: 'Comidas rápidas' },
  { icon: 'hand-heart',       label: 'Spa y estética' },
];

/* ──────────────────────────────────────────────────────────
   Tipo de paso del modal trial
   ────────────────────────────────────────────────────────── */
type ModalStep = 'form' | 'otp' | 'success';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Sun, Moon, Rocket, Shield, Users, BarChart3,
        ChevronRight, Check, Star, Zap, Store, Smartphone,
        ArrowRight, X, Clock, Loader2, CheckCheck,
        Mail, Building2, Facebook, Instagram, Youtube, FileText, MessageCircle,
        UtensilsCrossed, Coffee, Sparkles, Beer, CakeSlice, Bike, HandHeart,
        Car, Scissors, ShoppingCart, ShoppingBag,
        Wrench, PiggyBank, Landmark, Dumbbell,
        // Los oficios que se añadieron al abrir el catálogo (2026-09-10). lucide-angular
        // registra los iconos de uno en uno: si falta uno aquí el chip se pinta sin dibujo
        // y no falla nada al compilar, así que no se nota hasta verlo.
        Croissant, IceCreamCone, Sandwich, Pizza, Flower2, Hand, Stethoscope,
        // La familia «Agenda y Reservas» y los módulos resaltados de las tarjetas de plan
        // (2026-09-19): el asistente de IA y la facturación electrónica.
        CalendarCheck, BotMessageSquare, ReceiptText,
        // Los complementos y el desplegable de las tarjetas.
        UserPlus, Monitor, ChevronDown, ChevronUp, ShieldCheck,
        // El aviso legal de la facturación y el sello de proveedor de WhatsApp.
        Scale, BadgeCheck,
        // Los perfiles de reserva (2026-09-17): estética, tatuajes, mascotas y alojamiento.
        Syringe, PenTool, PawPrint, Dog, Hotel, BedDouble, Tent,
      }),
    },
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  protected readonly assetService   = inject(AssetService);
  private   readonly authService    = inject(AuthService);

  /**
   * Los oficios ofrecibles. Arranca con el respaldo (para el prerender) y se reemplaza con lo
   * que diga la API en cuanto el navegador la responde. Ver `RUBROS_RESPALDO`.
   */
  private   readonly rubros = signal<TipoNegocio[]>(RUBROS_RESPALDO);

  /**
   * Las familias que se enseñan como botón, ya cruzadas con el catálogo real: una familia sin
   * un solo oficio en la lista de la API no se pinta, porque llevaría a un plan que nadie puede
   * contratar. Si el catálogo llegara tan distinto que ninguna familia encaja, se dejan las dos
   * antes que dejar el selector vacío: es una página de marketing, no un formulario.
   */
  protected readonly categorias = computed(() => {
    const rubros = this.rubros();
    const conOficios = CATEGORIAS.filter((c) => rubros.some((r) => r.modulo === c.modulo));
    return conOficios.length > 0 ? conOficios : CATEGORIAS;
  });

  /** La familia elegida en el selector de planes. */
  protected readonly selectedCategoria = signal<CategoriaNegocio>(CATEGORIAS[0]);

  /**
   * El oficio que representa a la familia elegida — de él salen la ilustración y las features.
   * Se busca por `representante` y se cae al primero del mismo motor si el catálogo de la API no
   * lo trae, así que un cambio de nombres en `gener_tipo_negocio` no deja la sección coja.
   */
  protected readonly selectedTipo = computed<TipoNegocio>(() => {
    const cat = this.selectedCategoria();
    const rubros = this.rubros();
    return (
      rubros.find((r) => r.nombre === cat.representante) ??
      rubros.find((r) => r.modulo === cat.modulo) ??
      RUBROS_RESPALDO[0]
    );
  });

  /** El desplegable del registro sí ofrece los 14: aquí no sobra ninguno. */
  protected readonly tiposNegocioRegistro = computed(() => this.rubros());

  /**
   * Los oficios que cubre la familia elegida — la tira de «nuestros clientes también gestionan…».
   *
   * Es lo que compensa haber bajado de ocho botones a dos: la familia dice qué motor se contrata
   * y esta tira demuestra hasta dónde llega, con el icono de cada oficio. Los que ya se nombran
   * en el título de la familia (`implicitos`) se omiten para no repetir «Restaurante» debajo de
   * un botón que se llama «Restaurante / Gastrobar», y `OFICIOS_OCULTOS`/`ETIQUETAS_LANDING`
   * recortan y reagrupan el resto — la tira vende cobertura, no es el catálogo.
   */
  protected readonly oficiosCategoria = computed(() => {
    const cat = this.selectedCategoria();
    return this.rubros()
      .filter(
        (r) =>
          r.modulo === cat.modulo &&
          !cat.implicitos.includes(r.nombre) &&
          !OFICIOS_OCULTOS.has(r.nombre),
      )
      .map((r) => ({ ...r, label: ETIQUETAS_LANDING[r.nombre] ?? r.label }));
  });

  protected readonly features            = FEATURES;
  protected readonly capacidadesWhatsapp = CAPACIDADES_WHATSAPP;
  protected readonly conversacionDemo     = CONVERSACION_DEMO;
  protected readonly resultadosDemo       = RESULTADOS_DEMO;
  protected readonly ecosistema          = ECOSISTEMA;
  protected readonly currentYear         = new Date().getFullYear();
  /** Enlace de WhatsApp con el mensaje predeterminado precargado. */
  protected readonly waUrl               =
    `${environment.whatsappUrl}?text=${encodeURIComponent('Hola!, quiero adquirir Escalapp')}`;

  /* ── Typewriter CTA ── */
  private readonly ctaPhrases = [
    'Prueba gratis 7 días',
    'Empieza ya',
    'Sin compromisos',
    'Crece tu negocio',
  ];
  protected readonly ctaBtnText = signal('');
  protected readonly ctaCursorVisible = signal(true);
  private phraseIndex  = 0;
  private charIndex    = 0;
  private isDeleting   = false;
  private typewriterPaused = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Los chips reales, en cuanto el navegador puede pedirlos.
    //
    // Va en `afterNextRender` porque durante el prerender no hay a quién preguntarle: la página
    // se genera en el build, con la API apagada. Si la llamada falla se conserva el respaldo, que
    // es lo que ya está pintado — una landing sin chips sería peor que unos chips desactualizados.
    afterNextRender(() => {
      this.authService.getRubrosPublicos()
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe({
          next: (rubros) => {
            if (!rubros.length) return;
            const mapeados: TipoNegocio[] = rubros.map((r, i) => ({
              id: r.id_tipo_negocio ?? i,
              nombre: r.nombre,
              icon: r.icono || 'store',
              label: r.etiqueta || r.nombre,
              disponible: true,
              modulo: r.modulo,
            }));
            this.rubros.set(mapeados);
            // Si la familia elegida se quedó sin oficios en el catálogo nuevo, se pasa a la
            // primera que sí tenga: `selectedTipo` deriva de ella y no puede apuntar al vacío.
            const cat = this.selectedCategoria();
            if (!mapeados.some((t) => t.modulo === cat.modulo)) {
              this.selectedCategoria.set(this.categorias()[0]);
            }
          },
          error: () => { /* se conserva RUBROS_RESPALDO */ },
        });
    });

    afterNextRender(() => {
      this.ctaBtnText.set(this.ctaPhrases[0]);
      this.charIndex   = this.ctaPhrases[0].length;
      this.phraseIndex = 0;

      const tick = () => {
        if (this.typewriterPaused) {
          this.timer = setTimeout(tick, 50);
          return;
        }

        const currentPhrase = this.ctaPhrases[this.phraseIndex];

        if (!this.isDeleting) {
          if (this.charIndex < currentPhrase.length) {
            this.charIndex++;
            this.ctaBtnText.set(currentPhrase.slice(0, this.charIndex));
            this.timer = setTimeout(tick, 50);
          } else {
            this.typewriterPaused = true;
            this.timer = setTimeout(() => {
              this.typewriterPaused = false;
              this.isDeleting = true;
              tick();
            }, 2000);
          }
        } else {
          if (this.charIndex > 0) {
            this.charIndex--;
            this.ctaBtnText.set(currentPhrase.slice(0, this.charIndex));
            this.timer = setTimeout(tick, 30);
          } else {
            this.isDeleting = false;
            this.phraseIndex = (this.phraseIndex + 1) % this.ctaPhrases.length;
            this.timer = setTimeout(tick, 300);
          }
        }
      };

      this.timer = setTimeout(tick, 1500);
    });

    // Blinking cursor independent of typewriter
    const cursorInterval = setInterval(() => {
      this.ctaCursorVisible.update((v) => !v);
    }, 530);
    destroyRef.onDestroy(() => {
      clearInterval(cursorInterval);
      clearTimeout(this.timer);
      clearTimeout(this.esperaScroll);
    });
  }

  private timer: ReturnType<typeof setTimeout> | undefined;

  /* ── Imagen representativa por tipo de negocio ── */
  /**
   * La ilustración que acompaña a cada tipo. Se conservan las de los oficios «Próximamente»
   * (parqueadero, gimnasio, tienda) por si vuelven al selector: no estorban y recuperarlas
   * después costaría más que dejarlas. No hay ilustración de cafetería, así que reutiliza la de
   * restaurante, que es el mismo motor.
   */
  private readonly tipoImagenMap: Record<string, string | null> = {
    RESTAURANTE:        'pulpo_restaurante.png',
    BARBERIA:           'pulpo_barberia.png',
    'SALON DE BELLEZA': 'pulpo_salonbelleza.png',
    PARQUEADERO:        'pulpo_parqueadero.png',
    GIMNASIO:           'pulpo_gym.png',
    TIENDA:             'pulpo_tienda.png',
    SUPERMERCADO:       'pulpo_tienda.png',
  };

  /**
   * Solo hay seis ilustraciones y catorce oficios, así que los que no tienen la suya caen a la
   * de su motor: una pizzería enseña el pulpo de restaurante y una manicurista el de barbería.
   * Es preferible a dejar el hueco, que se lee como un fallo de la página.
   */
  private readonly imagenPorModulo: Record<string, string> = {
    RESTAURANTE: 'pulpo_restaurante.png',
    RESERVA:     'pulpo_barberia.png',
  };

  protected readonly tipoImagenSrc = computed(() => {
    const tipo = this.selectedTipo();
    const filename = this.tipoImagenMap[tipo.nombre]
      ?? this.imagenPorModulo[tipo.modulo]
      ?? null;
    return filename ? this.assetService.getAssetPath(filename) : null;
  });

  /* ── Las cuatro tarjetas de plan ── */

  protected readonly paquetesFacturacion = PAQUETES_FACTURACION;
  protected readonly complementos        = COMPLEMENTOS;

  /**
   * El paquete de documentos elegido **por tarjeta**, indexado por `id` de tarjeta.
   *
   * Fue uno solo compartido durante medio día y estaba mal: tocar el selector de «Emprendedor +
   * Facturación» movía también el precio de «Emprendedor Total», que es otra oferta y otro
   * bolsillo. Quien compara dos tarjetas quiere ponerle 100 documentos a una y 1.200 a la otra.
   *
   * Arrancan en el paquete más pequeño a propósito: es el precio de entrada, y abrir en XL haría
   * que la facturación pareciera cara de salida.
   */
  private readonly paquetesPorTarjeta = signal<Record<string, string>>({});

  protected paqueteDe(idTarjeta: string): PaqueteDocumentos {
    const id = this.paquetesPorTarjeta()[idTarjeta];
    return PAQUETES_FACTURACION.find((p) => p.id === id) ?? PAQUETES_FACTURACION[0];
  }

  protected elegirPaquete(idTarjeta: string, paquete: PaqueteDocumentos): void {
    this.paquetesPorTarjeta.update((actual) => ({ ...actual, [idTarjeta]: paquete.id }));
  }

  /**
   * La tarjeta desplegada, o `null` si están las cuatro plegadas.
   *
   * Plegadas enseñan lo que se compara de un vistazo —precio, límites, los módulos que trae— y
   * caben a lo ancho de la pantalla sin volverse columnas de dos metros. El detalle completo (la
   * lista entera de funciones, el detalle de cada módulo y el selector de paquetes) vive detrás
   * de «Ver más detalles», y al abrirlo las otras tres se quitan de en medio: quien llegó ahí ya
   * eligió cuál mirar.
   */
  protected readonly planExpandido = signal<string | null>(null);

  /**
   * La tarjeta abierta, ya resuelta — la que dibuja la capa de detalle.
   *
   * El detalle NO es la misma tarjeta agrandada: es una tarjeta aparte, centrada sobre la
   * rejilla, con el contenido repartido en columnas. Las cuatro de abajo se quedan donde
   * estaban, desenfocadas y sin poder pulsarse, para que quede claro de dónde salió esta.
   */
  protected readonly planDetalle = computed(() => this.tarjetasPlan().find((t) => t.abierta) ?? null);

  protected alternarDetalle(idTarjeta: string): void {
    this.planExpandido.update((actual) => (actual === idTarjeta ? null : idTarjeta));
    this.congelarFondo(this.planExpandido() !== null);
  }

  /**
   * El atajo de la barra de anuncio: baja a Planes y abre el detalle del plan con asistente.
   *
   * El detalle se abre **cuando el desplazamiento termina**, no antes. Con un salto instantáneo
   * la página cambiaba de sitio de golpe y parecía otra vista; y abriendo el detalle a la vez
   * que se desplaza tampoco vale, porque `congelarFondo` lee `window.scrollY` en ese momento y
   * congelaría el fondo a medio camino. Se espera a `scrollend`, con un temporizador de
   * respaldo para los navegadores que todavía no lo emiten.
   */
  protected verPlanAsistente(): void {
    this.cerrarDetalle();

    const destino = document.getElementById('planes');
    const abrir = () => {
      window.removeEventListener('scrollend', abrir);
      clearTimeout(this.esperaScroll);
      this.planExpandido.set(ID_PLAN_ASISTENTE);
      this.congelarFondo(true);
    };

    if (!destino) {
      abrir();
      return;
    }

    destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.addEventListener('scrollend', abrir, { once: true });
    this.esperaScroll = setTimeout(abrir, 1000);
  }

  /** El respaldo del `scrollend` de arriba; se limpia al destruir el componente. */
  private esperaScroll: ReturnType<typeof setTimeout> | undefined;

  protected cerrarDetalle(): void {
    this.planExpandido.set(null);
    this.congelarFondo(false);
  }

  /** Dónde estaba la página cuando se abrió la última capa. */
  private scrollCongelado = 0;

  /**
   * Congela el fondo mientras hay una capa abierta, sin mover al visitante de sitio.
   *
   * Antes esto era `body.style.overflow = 'hidden'`, y con él la página saltaba al principio: el
   * tema global lleva `html, body { height: 100% }` y una regla
   * `html:has([aria-modal]) { overflow: hidden }`, así que al abrir la capa el elemento que
   * scrollea se quedaba sin desbordamiento y el navegador recortaba su desplazamiento a cero.
   * Quien abría el detalle desde la sección de planes terminaba en la cabecera de la página.
   *
   * La receta de aquí fija el body a la altura en la que estaba (`top: -scrollY`), que se ve
   * exactamente igual pero no depende de que el documento siga siendo desplazable, y al soltar
   * devuelve la posición. Por eso las capas llevan `role="dialog"` pero NO `aria-modal`: esa
   * regla global volvería a recortar el scroll.
   */
  private congelarFondo(activo: boolean): void {
    const body = document.body;

    // Congelar dos veces seguidas leería `scrollY = 0` —el body ya está fijo— y al soltar
    // mandaría al visitante al principio de la página.
    if (activo === (body.style.position === 'fixed')) return;

    if (activo) {
      this.scrollCongelado = window.scrollY;
      body.style.position = 'fixed';
      body.style.top = `-${this.scrollCongelado}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      return;
    }

    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    window.scrollTo({ top: this.scrollCongelado, behavior: 'auto' });
  }

  /**
   * Las cuatro tarjetas ya resueltas para el motor elegido, con su paquete y su estado.
   *
   * Cada una lista **todas** sus funciones, no «lo del plan anterior más X»: la comparación se
   * hace de un vistazo entre columnas, y obligar a mirar la tarjeta de al lado para saber qué
   * incluye esta es justo lo que hace que un precio se lea como una trampa. Lo que se recorta
   * con la tarjeta plegada es cuánto de esa lista se enseña, no la lista.
   */
  protected readonly tarjetasPlan = computed(() => {
    const modulo = this.selectedTipo().modulo;
    const features = FEATURES_POR_MODULO[modulo] ?? FEATURES_POR_MODULO['RESTAURANTE'];
    const asistente = ASISTENTE_POR_MODULO[modulo] ?? ASISTENTE_POR_MODULO['RESTAURANTE'];
    const expandido = this.planExpandido();

    return TARJETAS_PLAN.map((t) => {
      const paquete = this.paqueteDe(t.id);
      const precioPlan = (PRECIO_PLAN[modulo] ?? PRECIO_PLAN['RESTAURANTE'])[t.base];
      const precioConFactura =
        (PRECIO_CON_FACTURACION[modulo] ?? PRECIO_CON_FACTURACION['RESTAURANTE'])[t.base];

      /* Los módulos, en orden fijo: primero el asistente, después la facturación. Van pegados a
         la lista de funciones y no anclados al fondo de la tarjeta — probado al revés, con
         ranuras fijas al pie, y el resultado era peor: el recuadro de una tarjeta quedaba a
         media altura y el de la de al lado contra el botón. Con las cabeceras de la misma
         altura (min-height en el SCSS), el primer recuadro de cada tarjeta cae a la misma
         línea que el de sus vecinas. */
      const modulos: ModuloDestacado[] = [];

      if (t.conAsistente) {
        modulos.push({
          icon: 'bot-message-square',
          titulo: 'Asistente de IA en WhatsApp',
          puntos: asistente,
          conPaquetes: false,
        });
      }
      if (t.conFacturacion) {
        modulos.push({
          icon: 'receipt-text',
          titulo: 'Facturación electrónica DIAN',
          puntos: PUNTOS_FACTURACION,
          conPaquetes: true,
        });
      }

      const incluidos = [
        `${t.usuarios} usuarios incluidos`,
        t.cajas === 1 ? '1 caja incluida' : `${t.cajas} cajas incluidas`,
      ];

      return {
        ...t,
        paquete,
        /**
         * El precio de la rejilla NO se mueve con el volumen: es el del paquete de entrada,
         * siempre. Elegir «L» dentro del detalle de un plan no puede reescribir el precio que
         * la sección enseña de ese plan — quien esté comparando las cuatro tarjetas vería
         * cambiar un número que él no tocó.
         */
        precio: t.conFacturacion ? precioConFactura[PAQUETES_FACTURACION[0].id] : precioPlan,
        /** El del detalle sí: ahí es donde se elige el volumen y donde se ve su efecto. */
        precioDetalle: t.conFacturacion ? precioConFactura[paquete.id] : precioPlan,
        /**
         * El año completo, solo para los planes con facturación —los únicos que se contratan
         * por doce meses—. `precioAnualComparado` es lo que costaría el mismo año comprando el
         * certificado por fuera: es el número tachado, y la diferencia es exactamente el
         * certificado, no un descuento inventado.
         */
        precioAnual: t.conFacturacion ? precioConFactura[paquete.id] * 12 : 0,
        precioAnualComparado: t.conFacturacion
          ? precioConFactura[paquete.id] * 12 + VALOR_CERTIFICADO_ANUAL
          : 0,
        ahorroCertificado: VALOR_CERTIFICADO_ANUAL,
        /**
         * La letra pequeña bajo el precio. Un plan con facturación NO es «sin contratos»: el
         * certificado digital se compra por un año, así que la permanencia es real y decirlo
         * aquí es lo honesto, no letra pequeña de verdad.
         */
        garantia: t.conFacturacion
          ? { icon: 'calendar-check', texto: 'Plan anual — certificado digital incluido' }
          : { icon: 'shield-check', texto: 'Sin contratos — cancela cuando quieras' },
        features: [
          ...incluidos,
          ...(t.base === 'AVANZADO' ? [...features.base, ...features.avanzado] : features.base),
        ],
        modulos,
        /**
         * Solo tiene desplegable la tarjeta que esconde algo. El Emprendedor no lleva módulos y
         * su lista entera cabe plegada, así que un «Ver más detalles» ahí abriría una tarjeta
         * idéntica a la que ya se está mirando.
         */
        conDesplegable: modulos.length > 0,
        abierta: expandido === t.id,
        /**
         * El Emprendedor también se compra: la prueba es un enlace aparte, no el botón. Enseñar
         * «Probar gratis» como acción principal en el plan de entrada y «Adquirir» en los otros
         * tres hacía que el único plan con precio de entrada pareciera el único que no se vende.
         */
        cta: 'Adquirir plan',
      };
    });
  });

  /**
   * A dónde va el botón de un plan de pago.
   *
   * La pantalla de compra todavía no existe, así que el botón abre WhatsApp con el plan escrito
   * — un cliente que quiere pagar no puede toparse con un botón que no hace nada. El día que
   * haya checkout, esto es lo único que cambia.
   */
  protected urlAdquirir(nombrePlan: string): string {
    const texto = `Hola!, quiero adquirir el ${nombrePlan} de Escalapp`;
    return `${environment.whatsappUrl}?text=${encodeURIComponent(texto)}`;
  }


  // =================== Modal Trial Registration ===================

  protected readonly modalOpen = signal(false);
  protected readonly modalStep = signal<ModalStep>('form');

  // Formulario - paso 1
  protected readonly trialNombre        = signal('');
  protected readonly trialCedula        = signal('');
  protected readonly trialEmail         = signal('');
  protected readonly trialTipoNeg       = signal('');
  protected readonly trialNombreNegocio = signal('');

  // Touched
  protected readonly trialNombreTouched        = signal(false);
  protected readonly trialCedulaTouched        = signal(false);
  protected readonly trialEmailTouched         = signal(false);
  protected readonly trialTipoTouched          = signal(false);
  protected readonly trialNombreNegocioTouched = signal(false);

  // OTP - paso 2
  protected readonly trialOtp          = signal('');
  protected readonly trialOtpTouched   = signal(false);
  protected readonly trialResendCount  = signal(0);
  protected readonly trialMaxResends   = 3;

  // Estado compartido
  protected readonly trialLoading   = signal(false);
  protected readonly trialError     = signal<string | null>(null);
  protected readonly trialSuccessNombre = signal('');
  protected readonly trialSuccessCedula = signal('');

  // =================== Validaciones paso 1 ===================

  protected readonly trialNombreError = computed(() => {
    const v = this.trialNombre().trim();
    if (!v) return 'El nombre completo es obligatorio';
    if (v.length < 2) return 'Mínimo 2 caracteres';
    return null;
  });

  protected readonly trialCedulaError = computed(() => {
    const v = this.trialCedula().trim();
    if (!v) return 'El número de cédula es obligatorio';
    if (v.length < 3) return 'Mínimo 3 caracteres';
    if (!/^\d+$/.test(v)) return 'Solo se permiten números';
    return null;
  });

  protected readonly trialEmailError = computed(() => {
    const v = this.trialEmail().trim();
    if (!v) return 'El correo electrónico es obligatorio';
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)) return 'Formato de correo inválido';
    return null;
  });

  protected readonly trialTipoError = computed(() => {
    if (!this.trialTipoNeg()) return 'Selecciona el tipo de negocio';
    return null;
  });

  protected readonly trialNombreNegocioError = computed(() => {
    const v = this.trialNombreNegocio().trim();
    if (!v) return 'El nombre del negocio es obligatorio';
    if (v.length < 2) return 'Mínimo 2 caracteres';
    return null;
  });

  protected readonly trialFormValid = computed(
    () =>
      !this.trialNombreError() &&
      !this.trialCedulaError() &&
      !this.trialEmailError() &&
      !this.trialTipoError() &&
      !this.trialNombreNegocioError(),
  );

  // Validación OTP
  protected readonly trialOtpError = computed(() => {
    const v = this.trialOtp().trim();
    if (!v) return 'El código es obligatorio';
    if (!/^\d{6}$/.test(v)) return 'El código debe tener exactamente 6 dígitos';
    return null;
  });

  // =================== Acciones del modal ===================

  protected openModal(): void {
    this.modalOpen.set(true);
    this.modalStep.set('form');
    this.trialError.set(null);
    this.congelarFondo(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.congelarFondo(false);
  }

  protected selectCategoria(cat: CategoriaNegocio): void {
    this.selectedCategoria.set(cat);
  }

  protected scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  protected formatPrice(precio: number): string {
    if (precio === 0) return 'Gratis';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(precio);
  }

  /** Paso 1: enviar código OTP al correo */
  protected async onEnviarCodigo(): Promise<void> {
    this.trialNombreTouched.set(true);
    this.trialCedulaTouched.set(true);
    this.trialEmailTouched.set(true);
    this.trialTipoTouched.set(true);
    this.trialNombreNegocioTouched.set(true);

    if (!this.trialFormValid() || this.trialLoading()) return;

    this.trialLoading.set(true);
    this.trialError.set(null);

    try {
      await firstValueFrom(
        this.authService.enviarCodigoTrial({
          email:              this.trialEmail().trim(),
          nombre_completo:    this.trialNombre().trim(),
          num_identificacion: this.trialCedula().trim(),
          tipo_negocio:       this.trialTipoNeg(),
          nombre_negocio:     this.trialNombreNegocio().trim(),
        }),
      );
      this.trialOtp.set('');
      this.trialOtpTouched.set(false);
      this.modalStep.set('otp');
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message;
      this.trialError.set(msg ?? 'Error al enviar el código. Inténtalo de nuevo.');
    } finally {
      this.trialLoading.set(false);
    }
  }

  /** Paso 2: reenviar código */
  protected async onReenviarCodigo(): Promise<void> {
    if (this.trialResendCount() >= this.trialMaxResends || this.trialLoading()) return;

    this.trialLoading.set(true);
    this.trialError.set(null);

    try {
      await firstValueFrom(
        this.authService.enviarCodigoTrial({
          email:              this.trialEmail().trim(),
          nombre_completo:    this.trialNombre().trim(),
          num_identificacion: this.trialCedula().trim(),
          tipo_negocio:       this.trialTipoNeg(),
          nombre_negocio:     this.trialNombreNegocio().trim(),
        }),
      );
      this.trialResendCount.update((n) => n + 1);
      this.trialOtp.set('');
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message;
      this.trialError.set(msg ?? 'Error al reenviar el código.');
    } finally {
      this.trialLoading.set(false);
    }
  }

  /** Paso 2: verificar OTP y crear cuenta */
  protected async onVerificarCodigo(): Promise<void> {
    this.trialOtpTouched.set(true);

    if (this.trialOtpError() || this.trialLoading()) return;

    this.trialLoading.set(true);
    this.trialError.set(null);

    try {
      const res = await firstValueFrom(
        this.authService.verificarYCrearTrial({
          email: this.trialEmail().trim(),
          code:  this.trialOtp().trim(),
        }),
      );
      this.trialSuccessNombre.set(res.data?.nombre ?? this.trialNombre().split(' ')[0]);
      this.trialSuccessCedula.set(res.data?.numIdentificacion ?? this.trialCedula().trim());
      this.modalStep.set('success');
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message;
      this.trialError.set(msg ?? 'Código incorrecto o expirado. Verifica e intenta de nuevo.');
    } finally {
      this.trialLoading.set(false);
    }
  }

  protected get trialResendDisabled(): boolean {
    return this.trialResendCount() >= this.trialMaxResends || this.trialLoading();
  }

  protected get trialResendLabel(): string {
    const left = this.trialMaxResends - this.trialResendCount();
    if (left <= 0) return 'Límite de reenvíos alcanzado';
    return `Reenviar código (${left} ${left === 1 ? 'intento' : 'intentos'} restante${left === 1 ? '' : 's'})`;
  }
}
