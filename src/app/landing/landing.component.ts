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
  Wrench,
  PiggyBank,
  Landmark,
} from 'lucide-angular';

import { ThemeService } from '../core/theme/theme.service';

/* ──────────────────────────────────────────────────────────
   Datos estáticos — sin llamadas al backend
   ────────────────────────────────────────────────────────── */

interface TipoNegocio {
  id: number;
  nombre: string;
  icon: string;
  label: string;
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
  { id: 1, nombre: 'RESTAURANTE',               icon: 'utensils-crossed', label: 'Restaurante' },
  { id: 2, nombre: 'PARQUEADERO',               icon: 'car',              label: 'Parqueadero' },
  { id: 3, nombre: 'BARBERIA',                  icon: 'scissors',         label: 'Barbería' },
  { id: 4, nombre: 'SUPERMERCADO',              icon: 'shopping-cart',    label: 'Supermercado' },
  { id: 5, nombre: 'GESTION_TALLER_AUTOMOTRIZ', icon: 'wrench',           label: 'Taller automotriz' },
  { id: 6, nombre: 'FONDO_AHORROS',             icon: 'piggy-bank',       label: 'Fondo de ahorros' },
  { id: 7, nombre: 'FINANCIERA_PRESTAMOS',      icon: 'landmark',         label: 'Financiera' },
];

/* ── Planes base (precio + meta) ── */
const PLANES_BASE: PlanBase[] = [
  {
    nombre: 'Prueba gratuita',
    precio: 0,
    periodo: 'por 15 días',
    descripcion: 'Todas las funcionalidades del plan Emprendedor. Sin tarjeta de crédito.',
    destacado: false,
    badge: '15 días gratis',
    cta: 'Iniciar prueba gratis',
  },
  {
    nombre: 'Emprendedor',
    precio: 19990,
    periodo: '/mes',
    descripcion: 'Ideal para negocios pequeños que arrancan.',
    destacado: false,
    cta: 'Elegir Emprendedor',
  },
  {
    nombre: 'Profesional',
    precio: 34990,
    periodo: '/mes',
    descripcion: 'Para negocios en crecimiento.',
    destacado: true,
    cta: 'Elegir Profesional',
  },
  {
    nombre: 'Empresarial',
    precio: 59990,
    periodo: '/mes',
    descripcion: 'Para cadenas y operaciones grandes.',
    destacado: false,
    cta: 'Contactar ventas',
  },
];

/**
 * Features específicas por tipo de negocio para cada plan.
 * Clave: TipoNegocio.nombre → array de 4 arrays (uno por plan).
 */
const FEATURES_POR_NEGOCIO: Record<string, string[][]> = {
  RESTAURANTE: [
    // Prueba gratuita (igual al plan Emprendedor)
    [
      '1 restaurante',
      'Hasta 5 usuarios',
      'Hasta 15 mesas',
      'Menú digital completo',
      'Pedidos en línea',
      'Gestión de cocina',
      'Reportes de ventas',
    ],
    // Emprendedor
    [
      '1 restaurante',
      'Hasta 5 usuarios',
      'Hasta 15 mesas',
      'Menú digital completo',
      'Pedidos en línea',
      'Gestión de cocina',
      'Reportes de ventas',
    ],
    // Profesional
    [
      'Hasta 2 restaurantes',
      'Hasta 15 usuarios',
      'Mesas ilimitadas',
      'Menú digital avanzado con fotos',
      'Pedidos + delivery',
      'Inventario de ingredientes',
      'Reportes completos',
      'Soporte prioritario',
    ],
    // Empresarial
    [
      'Restaurantes ilimitados',
      'Usuarios ilimitados',
      'Todas las funcionalidades',
      'Reservas en línea',
      'Programa de fidelización',
      'API avanzada',
      'Soporte dedicado 24/7',
      'Personalización de marca',
    ],
  ],

  PARQUEADERO: [
    [
      '1 parqueadero',
      'Hasta 5 usuarios',
      'Hasta 80 espacios',
      'Tarifas por hora/fracción/día',
      'Registro de placa automático',
      'Recibos digitales',
      'Reportes de ocupación',
    ],
    [
      '1 parqueadero',
      'Hasta 5 usuarios',
      'Hasta 80 espacios',
      'Tarifas por hora/fracción/día',
      'Registro de placa automático',
      'Recibos digitales',
      'Reportes de ocupación',
    ],
    [
      'Hasta 2 parqueaderos',
      'Hasta 15 usuarios',
      'Espacios ilimitados',
      'Tarifas diferenciadas',
      'Abonados y mensualidades',
      'Dashboard en tiempo real',
      'Reportes financieros',
      'Soporte prioritario',
    ],
    [
      'Parqueaderos ilimitados',
      'Usuarios ilimitados',
      'Todas las funcionalidades',
      'Reconocimiento de placas (LPR)',
      'Integración con barreras',
      'API avanzada',
      'Soporte dedicado 24/7',
      'Personalización completa',
    ],
  ],

  BARBERIA: [
    [
      '1 barbería',
      'Hasta 5 barberos',
      'Agenda con franjas horarias',
      'Catálogo de servicios + precios',
      'Historial de clientes',
      'Recordatorios por email',
      'Reportes de ingresos',
    ],
    [
      '1 barbería',
      'Hasta 5 barberos',
      'Agenda con franjas horarias',
      'Catálogo de servicios + precios',
      'Historial de clientes',
      'Recordatorios por email',
      'Reportes de ingresos',
    ],
    [
      'Hasta 2 barberías',
      'Hasta 15 barberos',
      'Agenda avanzada + turnos',
      'Reservas en línea',
      'Galería de trabajos',
      'Inventario de productos',
      'Reportes completos',
      'Soporte prioritario',
    ],
    [
      'Barberías ilimitadas',
      'Barberos ilimitados',
      'Todas las funcionalidades',
      'App de reservas para clientes',
      'Programa de fidelización',
      'API avanzada',
      'Soporte dedicado 24/7',
      'Personalización de marca',
    ],
  ],

  SUPERMERCADO: [
    [
      '1 sucursal',
      'Hasta 5 usuarios',
      'Hasta 1.000 productos',
      'Punto de venta completo',
      'Lector de códigos de barras',
      'Alertas de stock bajo',
      'Reportes de ventas',
    ],
    [
      '1 sucursal',
      'Hasta 5 usuarios',
      'Hasta 1.000 productos',
      'Punto de venta completo',
      'Lector de códigos de barras',
      'Alertas de stock bajo',
      'Reportes de ventas',
    ],
    [
      'Hasta 2 sucursales',
      'Hasta 15 usuarios',
      'Productos ilimitados',
      'Gestión de proveedores',
      'Compras y recepción',
      'Ofertas y promociones',
      'Reportes financieros',
      'Soporte prioritario',
    ],
    [
      'Sucursales ilimitadas',
      'Usuarios ilimitados',
      'Todas las funcionalidades',
      'E-commerce integrado',
      'Logística de domicilios',
      'API avanzada',
      'Soporte dedicado 24/7',
      'Personalización completa',
    ],
  ],

  GESTION_TALLER_AUTOMOTRIZ: [
    [
      '1 taller',
      'Hasta 5 técnicos',
      'Historial por vehículo',
      'Órdenes de trabajo completas',
      'Cotizaciones detalladas',
      'Inventario de repuestos',
      'Reportes de productividad',
    ],
    [
      '1 taller',
      'Hasta 5 técnicos',
      'Historial por vehículo',
      'Órdenes de trabajo completas',
      'Cotizaciones detalladas',
      'Inventario de repuestos',
      'Reportes de productividad',
    ],
    [
      'Hasta 2 talleres',
      'Hasta 15 técnicos',
      'Seguimiento en tiempo real',
      'Notificaciones al cliente',
      'Proveedores de repuestos',
      'Facturación integrada',
      'Reportes completos',
      'Soporte prioritario',
    ],
    [
      'Talleres ilimitados',
      'Técnicos ilimitados',
      'Todas las funcionalidades',
      'Portal del cliente',
      'Diagnóstico OBD-II',
      'API avanzada',
      'Soporte dedicado 24/7',
      'Personalización completa',
    ],
  ],

  FONDO_AHORROS: [
    [
      '1 fondo',
      'Hasta 5 administradores',
      'Hasta 150 asociados',
      'Aportes + retiros',
      'Cálculo de rendimientos',
      'Extractos detallados',
      'Reportes financieros',
    ],
    [
      '1 fondo',
      'Hasta 5 administradores',
      'Hasta 150 asociados',
      'Aportes + retiros',
      'Cálculo de rendimientos',
      'Extractos detallados',
      'Reportes financieros',
    ],
    [
      'Hasta 2 fondos',
      'Hasta 15 administradores',
      'Asociados ilimitados',
      'Líneas de crédito interno',
      'Notificaciones automáticas',
      'Auditoría de movimientos',
      'Reportes completos',
      'Soporte prioritario',
    ],
    [
      'Fondos ilimitados',
      'Administradores ilimitados',
      'Todas las funcionalidades',
      'Portal del asociado',
      'Integración bancaria',
      'API avanzada',
      'Soporte dedicado 24/7',
      'Personalización completa',
    ],
  ],

  FINANCIERA_PRESTAMOS: [
    [
      '1 financiera',
      'Hasta 5 asesores',
      'Hasta 200 clientes',
      'Préstamos + refinanciación',
      'Cobro de cuotas',
      'Alertas de mora',
      'Reportes de cartera',
    ],
    [
      '1 financiera',
      'Hasta 5 asesores',
      'Hasta 200 clientes',
      'Préstamos + refinanciación',
      'Cobro de cuotas',
      'Alertas de mora',
      'Reportes de cartera',
    ],
    [
      'Hasta 2 financieras',
      'Hasta 15 asesores',
      'Clientes ilimitados',
      'Scoring crediticio interno',
      'Cobranza automatizada',
      'Gestión de garantías',
      'Reportes regulatorios',
      'Soporte prioritario',
    ],
    [
      'Financieras ilimitadas',
      'Asesores ilimitados',
      'Todas las funcionalidades',
      'Portal del cliente',
      'Integración con centrales',
      'API avanzada',
      'Soporte dedicado 24/7',
      'Personalización completa',
    ],
  ],
};

const FEATURES: Feature[] = [
  {
    icon: 'store',
    titulo: 'Multi-negocio',
    descripcion:
      'Administra múltiples negocios desde una sola cuenta. Restaurantes, cafeterías, bares y más.',
  },
  {
    icon: 'users',
    titulo: 'Roles y permisos',
    descripcion:
      'Define roles granulares: superadmin, admin, cajero, mesero. Cada quien ve solo lo que necesita.',
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
        ArrowRight, Menu, X,
        UtensilsCrossed, Car, Scissors, ShoppingCart, Wrench, PiggyBank, Landmark,
      }),
    },
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  protected readonly themeService = inject(ThemeService);

  protected readonly tiposNegocio = TIPOS_NEGOCIO;
  protected readonly features = FEATURES;
  protected readonly stats = STATS;
  protected readonly mobileMenuOpen = signal(false);
  protected readonly currentYear = new Date().getFullYear();

  /** Tipo de negocio seleccionado (por defecto: Restaurante) */
  protected readonly selectedTipo = signal<TipoNegocio>(TIPOS_NEGOCIO[0]);

  /** Planes con features dinámicas según el tipo de negocio seleccionado */
  protected readonly planes = computed<PlanConFeatures[]>(() => {
    const tipo = this.selectedTipo();
    const featuresForTipo = FEATURES_POR_NEGOCIO[tipo.nombre] ?? FEATURES_POR_NEGOCIO['RESTAURANTE'];
    return PLANES_BASE.map((plan, i) => ({
      ...plan,
      features: featuresForTipo[i],
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
