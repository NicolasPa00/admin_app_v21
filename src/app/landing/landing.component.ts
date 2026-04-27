import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  Car,
  Scissors,
  ShoppingCart,
  ShoppingBag,
  Wrench,
  PiggyBank,
  Landmark,
  Dumbbell,
  Clock,
} from 'lucide-angular';

import { ThemeService } from '../core/theme/theme.service';
import { AssetService } from '../core/services/asset.service';

/* ──────────────────────────────────────────────────────────
   Datos estáticos — sin llamadas al backend
   ────────────────────────────────────────────────────────── */

interface TipoNegocio {
  id: number;
  nombre: string;
  icon: string;
  label: string;
  disponible: boolean;
}

interface PlanBase {
  nombre: string;
  precio: number;
  periodo: string;
  descripcion: string;
  destacado: boolean;
  badge?: string;
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

/* ── Tipos de negocio ── */
const TIPOS_NEGOCIO: TipoNegocio[] = [
  { id: 1, nombre: 'RESTAURANTE',               icon: 'utensils-crossed', label: 'Restaurante',       disponible: true  },
  { id: 2, nombre: 'PARQUEADERO',               icon: 'car',              label: 'Parqueadero',        disponible: true  },
  { id: 3, nombre: 'GIMNASIO',                  icon: 'dumbbell',         label: 'Gimnasio',           disponible: true  },
  { id: 4, nombre: 'TIENDA',                    icon: 'shopping-bag',     label: 'Tienda',             disponible: true  },
  { id: 5, nombre: 'BARBERIA',                  icon: 'scissors',         label: 'Barbería',           disponible: false },
  { id: 6, nombre: 'SUPERMERCADO',              icon: 'shopping-cart',    label: 'Supermercado',       disponible: false },
  { id: 7, nombre: 'GESTION_TALLER_AUTOMOTRIZ', icon: 'wrench',           label: 'Taller automotriz',  disponible: false },
  { id: 8, nombre: 'FONDO_AHORROS',             icon: 'piggy-bank',       label: 'Fondo de ahorros',  disponible: false },
  { id: 9, nombre: 'FINANCIERA_PRESTAMOS',      icon: 'landmark',         label: 'Financiera',         disponible: false },
];

/* ── Planes base (2 planes) ── */
const PLANES_BASE: PlanBase[] = [
  {
    nombre: 'Plan Básico',
    precio: 27999,
    periodo: '/mes',
    descripcion: 'Ideal para negocios pequeños. Todo lo esencial para arrancar y operar.',
    destacado: false,
    cta: 'Elegir Plan Básico',
  },
  {
    nombre: 'Plan Avanzado',
    precio: 59999,
    periodo: '/mes',
    descripcion: 'Para negocios en crecimiento. Más sucursales, más usuarios y soporte prioritario.',
    destacado: true,
    cta: 'Elegir Plan Avanzado',
  },
];

/**
 * Features por tipo de negocio: 2 arrays (uno por plan).
 * Solo tipos disponibles necesitan features detalladas;
 * los "Próximamente" usan un array genérico.
 */
const FEATURES_POR_NEGOCIO: Record<string, string[][]> = {
  RESTAURANTE: [
    // Plan Básico
    [
      '1 restaurante',
      'Hasta 5 usuarios',
      'Hasta 15 mesas',
      'Menú digital completo',
      'Pedidos en línea',
      'Gestión de cocina',
      'Reportes de ventas',
    ],
    // Plan Avanzado
    [
      'Hasta 3 restaurantes',
      'Usuarios ilimitados',
      'Mesas ilimitadas',
      'Menú avanzado con fotos',
      'Pedidos + domicilios',
      'Inventario de ingredientes',
      'Reportes completos',
      'Soporte prioritario',
    ],
  ],

  PARQUEADERO: [
    [
      '1 parqueadero',
      'Hasta 5 usuarios',
      'Hasta 80 espacios',
      'Tarifas por hora / fracción / día',
      'Registro de placa',
      'Recibos digitales',
      'Reportes de ocupación',
    ],
    [
      'Hasta 3 parqueaderos',
      'Usuarios ilimitados',
      'Espacios ilimitados',
      'Tarifas diferenciadas',
      'Abonados y mensualidades',
      'Dashboard en tiempo real',
      'Reportes financieros',
      'Soporte prioritario',
    ],
  ],

  GIMNASIO: [
    [
      '1 gimnasio',
      'Hasta 5 usuarios',
      'Hasta 200 miembros',
      'Membresías básicas',
      'Control de asistencia',
      'Registro de pagos',
      'Reportes básicos',
    ],
    [
      'Hasta 3 gimnasios',
      'Usuarios ilimitados',
      'Miembros ilimitados',
      'Planes de membresía avanzados',
      'Control biométrico de asistencia',
      'Cobro automático',
      'Venta de productos',
      'Reportes completos',
      'Soporte prioritario',
    ],
  ],

  TIENDA: [
    [
      '1 tienda',
      'Hasta 5 usuarios',
      'Hasta 1.000 productos',
      'Gestión de inventario',
      'Movimientos de stock',
      'Ventas y facturación',
      'Reportes de ventas',
    ],
    [
      'Hasta 3 tiendas',
      'Usuarios ilimitados',
      'Productos ilimitados',
      'Categorías y proveedores',
      'Alertas de stock bajo',
      'Ventas avanzadas',
      'Reportes completos',
      'Soporte prioritario',
    ],
  ],
};

const FEATURES_PROXIMAMENTE: string[][] = [
  ['Módulo en desarrollo', 'Disponible próximamente'],
  ['Módulo en desarrollo', 'Disponible próximamente'],
];

const FEATURES: Feature[] = [
  {
    icon: 'store',
    titulo: 'Multi-negocio',
    descripcion:
      'Administra múltiples negocios desde una sola cuenta. Restaurantes, gimnasios, tiendas y más.',
  },
  {
    icon: 'users',
    titulo: 'Roles y permisos',
    descripcion:
      'Define roles granulares: superadmin, admin, cajero, operador. Cada quien ve solo lo que necesita.',
  },
  {
    icon: 'shield',
    titulo: 'Seguridad empresarial',
    descripcion:
      'Autenticación JWT, cifrado de datos, verificación por email y recuperación segura de contraseña.',
  },
  {
    icon: 'bar-chart-3',
    titulo: 'Reportes inteligentes',
    descripcion:
      'Dashboards en tiempo real con métricas de ventas, inventario y rendimiento por sucursal.',
  },
  {
    icon: 'smartphone',
    titulo: 'Responsive',
    descripcion:
      'Funciona perfecto en desktop, tablet y móvil. Tu equipo trabaja desde cualquier dispositivo.',
  },
  {
    icon: 'zap',
    titulo: 'Rápido y escalable',
    descripcion:
      'Infraestructura cloud que crece contigo. Sin importar si tienes 1 o 100 sucursales.',
  },
];

const STATS = [
  { valor: '99.9%',    etiqueta: 'Uptime garantizado',   descripcion: 'Tu negocio siempre disponible, sin interrupciones.' },
  { valor: '< 200ms',  etiqueta: 'Tiempo de respuesta',  descripcion: 'Operaciones instantáneas para un equipo ágil.' },
  { valor: '24/7',     etiqueta: 'Soporte técnico',      descripcion: 'Asistencia disponible en cualquier momento.' },
  { valor: '∞',        etiqueta: 'Escalabilidad',        descripcion: 'De 1 sucursal a cientos, sin límites de crecimiento.' },
];

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
        ArrowRight, Menu, X, Clock,
        UtensilsCrossed, Car, Scissors, ShoppingCart, ShoppingBag,
        Wrench, PiggyBank, Landmark, Dumbbell,
      }),
    },
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  protected readonly themeService = inject(ThemeService);
  protected readonly assetService = inject(AssetService);

  protected readonly tiposNegocio = TIPOS_NEGOCIO;
  protected readonly features = FEATURES;
  protected readonly stats = STATS;
  protected readonly mobileMenuOpen = signal(false);
  protected readonly currentYear = new Date().getFullYear();

  /** Tipo de negocio seleccionado (por defecto: Restaurante) */
  protected readonly selectedTipo = signal<TipoNegocio>(TIPOS_NEGOCIO[0]);

  /** ¿El tipo seleccionado está disponible? */
  protected readonly selectedDisponible = computed(() => this.selectedTipo().disponible);

  /** Planes con features dinámicas según el tipo de negocio seleccionado */
  protected readonly planes = computed<PlanConFeatures[]>(() => {
    const tipo = this.selectedTipo();
    const featuresForTipo = tipo.disponible
      ? (FEATURES_POR_NEGOCIO[tipo.nombre] ?? FEATURES_POR_NEGOCIO['RESTAURANTE'])
      : FEATURES_PROXIMAMENTE;
    return PLANES_BASE.map((plan, i) => ({
      ...plan,
      features: featuresForTipo[i] ?? [],
    }));
  });

  protected selectTipo(tipo: TipoNegocio): void {
    this.selectedTipo.set(tipo);
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
}
