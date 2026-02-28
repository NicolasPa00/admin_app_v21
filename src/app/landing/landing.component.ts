import { Component, inject, signal } from '@angular/core';
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
} from 'lucide-angular';

import { ThemeService } from '../core/theme/theme.service';

/* ──────────────────────────────────────────────────────────
   Datos estáticos — sin llamadas al backend
   ────────────────────────────────────────────────────────── */

interface Plan {
  nombre: string;
  precio: number;
  periodo: string;
  descripcion: string;
  features: string[];
  destacado: boolean;
  cta: string;
}

interface Feature {
  icon: string;
  titulo: string;
  descripcion: string;
}

const PLANES: Plan[] = [
  {
    nombre: 'Gratis',
    precio: 0,
    periodo: 'por siempre',
    descripcion: 'Explora la plataforma sin compromiso.',
    features: [
      '1 negocio',
      'Hasta 2 usuarios',
      'Funcionalidades básicas',
      'Reportes limitados',
    ],
    destacado: false,
    cta: 'Empezar gratis',
  },
  {
    nombre: 'Emprendedor',
    precio: 19990,
    periodo: '/mes',
    descripcion: 'Ideal para negocios pequeños que arrancan.',
    features: [
      '1 negocio',
      'Hasta 5 usuarios',
      'Gestión de mesas (hasta 15)',
      'Menú digital',
      'Pedidos en línea',
      'Reportes básicos',
    ],
    destacado: false,
    cta: 'Elegir Emprendedor',
  },
  {
    nombre: 'Profesional',
    precio: 34990,
    periodo: '/mes',
    descripcion: 'Para negocios en crecimiento.',
    features: [
      'Hasta 2 negocios',
      'Hasta 15 usuarios',
      'Mesas ilimitadas',
      'Menú digital avanzado',
      'Inventario completo',
      'Reportes completos',
      'Soporte prioritario',
    ],
    destacado: true,
    cta: 'Elegir Profesional',
  },
  {
    nombre: 'Empresarial',
    precio: 59990,
    periodo: '/mes',
    descripcion: 'Para cadenas y operaciones grandes.',
    features: [
      'Negocios ilimitados',
      'Usuarios ilimitados',
      'Todas las funcionalidades',
      'API avanzada',
      'Soporte dedicado',
      'Personalización',
    ],
    destacado: false,
    cta: 'Contactar ventas',
  },
];

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
  { valor: '99.9%', etiqueta: 'Uptime garantizado' },
  { valor: '< 200ms', etiqueta: 'Tiempo de respuesta' },
  { valor: '24/7', etiqueta: 'Soporte técnico' },
  { valor: '∞', etiqueta: 'Escalabilidad' },
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
      }),
    },
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  protected readonly themeService = inject(ThemeService);

  protected readonly planes = PLANES;
  protected readonly features = FEATURES;
  protected readonly stats = STATS;
  protected readonly mobileMenuOpen = signal(false);
  protected readonly currentYear = new Date().getFullYear();

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
