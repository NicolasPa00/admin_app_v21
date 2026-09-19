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
  Menu,
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

interface PlanBase {
  nombre: string;
  precio: number;
  periodo: string;
  descripcion: string;
  destacado: boolean;
  cta: string;
}

interface PlanConFeatures extends PlanBase {
  features: string[];
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
  { id: 11, nombre: 'SPA Y ESTETICA',      icon: 'flower-2',    label: 'Spa / Estética',   disponible: true, modulo: 'RESERVA' },
  { id: 12, nombre: 'MANICURE Y PEDICURE', icon: 'hand',        label: 'Uñas',             disponible: true, modulo: 'RESERVA' },
  { id: 13, nombre: 'MASAJES',             icon: 'hand-heart',  label: 'Masajes',          disponible: true, modulo: 'RESERVA' },
  { id: 14, nombre: 'CONSULTORIO',         icon: 'stethoscope', label: 'Consultorio',      disponible: true, modulo: 'RESERVA' },
];

/**
 * Los oficios que se enseñan como chips en el selector — un subconjunto de `RUBROS_RESPALDO`.
 *
 * Antes se mostraban los 14 (7 por motor) y se veía como una pared de botones. La lista completa
 * sigue existiendo y sigue siendo la que se puede contratar de verdad (`tiposNegocioRegistro`,
 * usada en el desplegable del registro) — esto es solo una curaduría visual de los más
 * reconocibles por motor. Los que faltan no desaparecen: se nombran en la frase de abajo del
 * selector («también se adapta a…»), así que nadie pierde la información de que su negocio cabe.
 */
const NOMBRES_DESTACADOS = new Set([
  'RESTAURANTE', 'CAFETERIA', 'BAR', 'COMIDAS RAPIDAS',
  'BARBERIA', 'SALON DE BELLEZA', 'SPA Y ESTETICA', 'CONSULTORIO',
]);

/**
 * Lo que se enseña pero **no se puede contratar** todavía. Es copy de marketing, no catálogo, y
 * por eso vive aquí y no en la base. Un tipo pasa de esta lista a la de arriba el día que su
 * módulo se despliegue, y entonces basta con apuntarlo en `gener_tipo_negocio.id_tipo_modulo`.
 *
 * ⚠️ Oculta del selector desde 2026-09-19 (no se borra, por si se reactiva): ver
 * `tiposNegocio` — mientras ningún módulo de esta lista esté desplegado, mostrar sus chips solo
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

const PLANES_BASE: PlanBase[] = [
  {
    nombre: 'Plan Básico',
    precio: 27999,
    periodo: '/mes',
    descripcion: 'Todo lo esencial para operar tu negocio desde el primer día. Hasta 5 personas en tu equipo.',
    destacado: false,
    cta: 'Probar gratis 7 días',
  },
  {
    nombre: 'Plan Avanzado',
    precio: 59999,
    periodo: '/mes',
    descripcion: 'Todo el sistema, más el asistente de WhatsApp que atiende a tus clientes por ti.',
    destacado: true,
    cta: 'Probar gratis 7 días',
  },
];

/**
 * El add-on de Facturación Electrónica, por tramos de volumen — ver
 * `admin_ws/docs/precios-y-planes.md` §3. No es un plan más (no tiene `features` propias): se
 * contrata sobre el plan Avanzado, y el tramo se mide y se ajusta con el primer mes real, nunca
 * se asigna por lo que el negocio dice que va a vender.
 */
interface TramoFacturacion {
  tramo: string;
  documentosMes: string;
  precio: number;
}

const TRAMOS_FACTURACION: TramoFacturacion[] = [
  { tramo: 'S', documentosMes: 'hasta 100 documentos/mes', precio: 39000 },
  { tramo: 'M', documentosMes: 'hasta 500 documentos/mes', precio: 59000 },
  { tramo: 'L', documentosMes: 'hasta 1.200 documentos/mes', precio: 79000 },
  { tramo: 'XL', documentosMes: 'hasta 2.500 documentos/mes', precio: 99000 },
];

/**
 * Qué incluye el plan, **por motor**.
 *
 * Antes estaba indexado por oficio y había una entrada por chip. Con catorce oficios eso serían
 * catorce listas casi idénticas que envejecerían por separado: la de pizzería diría una cosa y
 * la de heladería otra, aunque sean literalmente el mismo software. Lo que se promete depende
 * del motor, no del rótulo, así que se indexa por motor.
 *
 * Los chips `disponible: false` no aparecen aquí: la plantilla les enseña
 * `FEATURES_PROXIMAMENTE`, y una entrada para parqueadero o gimnasio sería una lista que nadie
 * puede ver y que envejecería sin que se note.
 *
 * El acceso tiene respaldo (`?? RESTAURANTE`), así que un motor nuevo sin lista degrada a la de
 * restaurante en vez de romper la página.
 */
const FEATURES_POR_MODULO: Record<string, string[][]> = {
  RESTAURANTE: [
    ['Hasta 5 personas en tu equipo', 'Carta digital con pedidos', 'Comandas a cocina', 'Mesas y domicilios', 'Caja y reportes de ventas'],
    [
      'Todo lo del Plan Básico',
      'Inventario y sucursales',
      'Asistente de WhatsApp: responde, toma pedidos y agenda — 24/7, sin costo adicional de software',
      'Conecta tu propio número (pagas tú a Meta) o usa el nuestro, sin trámites',
      'Reportes avanzados',
    ],
  ],
  RESERVA: [
    ['Hasta 5 personas en tu equipo', 'Agenda de citas', 'Gestión de profesionales', 'Control de servicios', 'Recordatorios automáticos', 'Reportes de ingresos'],
    [
      'Todo lo del Plan Básico',
      'Sucursales adicionales',
      'Asistente de WhatsApp: responde, agenda y confirma citas — 24/7, sin costo adicional de software',
      'Conecta tu propio número (pagas tú a Meta) o usa el nuestro, sin trámites',
      'Reportes avanzados',
    ],
  ],
};

const FEATURES_PROXIMAMENTE: string[][] = [
  ['Módulo en desarrollo — disponible próximamente'],
  ['Módulo en desarrollo — disponible próximamente'],
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

/** Las dos formas de conectar el número — mismo criterio que ya usa el panel de administración. */
const OPCIONES_WHATSAPP: Feature[] = [
  {
    icon: 'store',
    titulo: 'Gestionado por EscalApp',
    descripcion: 'Te damos un número listo para usar, sin ningún trámite en Meta de tu parte. Actívalo en minutos.',
  },
  {
    icon: 'smartphone',
    titulo: 'Tu propio número',
    descripcion: 'Conserva tu número, tu historial y tu app de WhatsApp Business tal como están hoy.',
  },
];

const STATS = [
  { valor: '99.9%',   etiqueta: 'Disponibilidad',     descripcion: 'Tu negocio siempre en línea, sin interrupciones.' },
  { valor: '< 200ms', etiqueta: 'Velocidad',           descripcion: 'Operaciones instantáneas para un equipo ágil.' },
  { valor: '24/7',    etiqueta: 'Soporte técnico',     descripcion: 'Asistencia disponible en cualquier momento.' },
  { valor: '∞',       etiqueta: 'Escalabilidad',       descripcion: 'Crece sin límites, la plataforma se adapta a ti.' },
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
        ArrowRight, Menu, X, Clock, Loader2, CheckCheck,
        Mail, Building2, Facebook, Instagram, Youtube, FileText, MessageCircle,
        UtensilsCrossed, Coffee, Sparkles, Beer, CakeSlice, Bike, HandHeart,
        Car, Scissors, ShoppingCart, ShoppingBag,
        Wrench, PiggyBank, Landmark, Dumbbell,
        // Los oficios que se añadieron al abrir el catálogo (2026-09-10). lucide-angular
        // registra los iconos de uno en uno: si falta uno aquí el chip se pinta sin dibujo
        // y no falla nada al compilar, así que no se nota hasta verlo.
        Croissant, IceCreamCone, Sandwich, Pizza, Flower2, Hand, Stethoscope,
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
   * Los chips que se muestran — la curaduría de `NOMBRES_DESTACADOS`, no los 14 disponibles.
   * Próximamente queda fuera a propósito (ver su cabecera). Si por lo que sea la curaduría no
   * encuentra ningún nombre en la lista que llegó de la API (un catálogo muy distinto al de
   * respaldo), se cae a mostrarlos todos antes que dejar el selector vacío.
   */
  protected readonly tiposNegocio = computed(() => {
    const destacados = this.rubros().filter((r) => NOMBRES_DESTACADOS.has(r.nombre));
    return destacados.length > 0 ? destacados : this.rubros();
  });

  /** El desplegable del registro sí ofrece los 14: aquí no sobra ninguno. */
  protected readonly tiposNegocioRegistro = computed(() => this.rubros());

  /**
   * Los oficios del mismo motor que el seleccionado y que NO tienen chip propio — la frase
   * «también se adapta a…» sale de aquí. Así un chip oculto no es información perdida: solo deja
   * de tener botón propio.
   */
  protected readonly otrosDelModulo = computed(() => {
    const actual = this.selectedTipo();
    return this.rubros()
      .filter((r) => r.modulo === actual.modulo && !NOMBRES_DESTACADOS.has(r.nombre))
      .map((r) => r.label);
  });
  protected readonly features            = FEATURES;
  protected readonly capacidadesWhatsapp = CAPACIDADES_WHATSAPP;
  protected readonly opcionesWhatsapp    = OPCIONES_WHATSAPP;
  protected readonly stats               = STATS;
  protected readonly ecosistema          = ECOSISTEMA;
  protected readonly mobileMenuOpen      = signal(false);
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
            // Si el que estaba seleccionado ya no existe, se vuelve al primero.
            if (!mapeados.some((t) => t.nombre === this.selectedTipo().nombre)
                && this.selectedTipo().disponible) {
              this.selectedTipo.set(mapeados[0]);
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
    });
  }

  private timer: ReturnType<typeof setTimeout> | undefined;

  /** Tipo seleccionado en el selector de planes */
  protected readonly selectedTipo = signal<TipoNegocio>(RUBROS_RESPALDO[0]);
  protected readonly selectedDisponible = computed(() => this.selectedTipo().disponible);

  /* ── Imagen representativa por tipo de negocio ── */
  /**
   * La ilustración que acompaña a cada tipo. Se conservan las de los chips «Próximamente» porque
   * esos chips siguen siendo seleccionables —el visitante puede pulsarlos para ver que existen— y
   * quedarse sin dibujo se vería como un fallo. No hay ilustración de cafetería, así que reutiliza
   * la de restaurante, que es el mismo motor.
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

  protected readonly planes = computed<PlanConFeatures[]>(() => {
    const tipo = this.selectedTipo();
    const features = tipo.disponible
      ? (FEATURES_POR_MODULO[tipo.modulo] ?? FEATURES_POR_MODULO['RESTAURANTE'])
      : FEATURES_PROXIMAMENTE;
    return PLANES_BASE.map((plan, i) => ({ ...plan, features: features[i] ?? [] }));
  });

  /**
   * El add-on de facturación electrónica, por tramos — solo tiene sentido sobre el Plan
   * Avanzado. Se enseña para cualquier oficio contratable, no solo restaurante: una barbería o
   * un spa facturan electrónicamente igual que un restaurante, la DIAN no distingue por motor.
   */
  protected readonly tramosFacturacion = TRAMOS_FACTURACION;
  protected readonly mostrarFacturacion = computed(() => this.selectedTipo().disponible);

  /* ── Configurador de precio, al estilo "arma tu Mac" ──
   *
   * Antes esto eran dos tarjetas de plan lado a lado y, más abajo — fuera de la primera
   * pantalla —, una sección aparte con los tramos de facturación. El precio importaba y
   * costaba encontrarlo. Aquí es al revés: se elige en pasos (plan → facturación opcional) y el
   * precio total vive en una tarjeta de resumen que no se mueve, igual que el configurador de
   * Apple mantiene el total a la vista mientras eliges memoria o almacenamiento.
   */

  /** El nombre del plan elegido en el configurador — no el objeto, porque `planes()` genera
   *  objetos nuevos cada vez que cambia el tipo de negocio (el `nombre` es lo único estable). */
  protected readonly nombrePlanElegido = signal<string>('Plan Avanzado');

  /** El plan elegido, ya con las features del tipo de negocio actual. Cae al destacado si el
   *  nombre guardado no existe en la lista de hoy (no debería pasar, pero nunca hay que reventar
   *  el precio por un nombre que no calza). */
  protected readonly planElegido = computed<PlanConFeatures>(() => {
    const lista = this.planes();
    return (
      lista.find((p) => p.nombre === this.nombrePlanElegido()) ??
      lista.find((p) => p.destacado) ??
      lista[0]
    );
  });

  /** El tramo de facturación añadido, si hay uno. `null` = "no, gracias". */
  protected readonly tramoElegido = signal<TramoFacturacion | null>(null);

  /** El paso 2 (facturación) solo aparece sobre el Plan Avanzado — es la pareja que ya está
   *  vendida en `precios-y-planes.md` §3, no una combinación libre. */
  protected readonly mostrarPasoFacturacion = computed(
    () => this.mostrarFacturacion() && this.planElegido().nombre === 'Plan Avanzado',
  );

  /** El precio que de verdad se ve: el del plan, más el tramo si aplica y está elegido. */
  protected readonly precioTotal = computed(
    () => this.planElegido().precio + (this.mostrarPasoFacturacion() ? (this.tramoElegido()?.precio ?? 0) : 0),
  );

  protected elegirPlan(plan: PlanConFeatures): void {
    this.nombrePlanElegido.set(plan.nombre);
    // Bajar a Básico quita la facturación de la cuenta — no tiene sentido dejarla "elegida pero
    // escondida": si vuelve a subir a Avanzado, que la vuelva a pedir.
    if (plan.nombre !== 'Plan Avanzado') this.tramoElegido.set(null);
  }

  protected elegirTramo(tramo: TramoFacturacion | null): void {
    this.tramoElegido.set(tramo);
  }

  protected trackTramo = (_: number, t: TramoFacturacion) => t.tramo;

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
    document.body.style.overflow = 'hidden';
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    document.body.style.overflow = '';
  }

  protected selectTipo(tipo: TipoNegocio): void {
    this.selectedTipo.set(tipo);
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  protected scrollTo(id: string): void {
    this.closeMobileMenu();
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
