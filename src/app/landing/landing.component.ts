import { Component, inject, signal, computed } from '@angular/core';
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
  Car,
  Scissors,
  ShoppingCart,
  ShoppingBag,
  Wrench,
  PiggyBank,
  Landmark,
  Dumbbell,
  Clock,
  Loader2,
  CheckCheck,
  Mail,
  Building2,
} from 'lucide-angular';

import { ThemeService } from '../core/theme/theme.service';
import { AssetService } from '../core/services/asset.service';
import { AuthService } from '../auth/data-access/auth.service';

/* ──────────────────────────────────────────────────────────
   Datos estáticos
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

const TIPOS_NEGOCIO: TipoNegocio[] = [
  { id: 1, nombre: 'RESTAURANTE',               icon: 'utensils-crossed', label: 'Restaurante',       disponible: true  },
  { id: 2, nombre: 'PARQUEADERO',               icon: 'car',              label: 'Parqueadero',        disponible: true  },
  { id: 3, nombre: 'GIMNASIO',                  icon: 'dumbbell',         label: 'Gimnasio',           disponible: true  },
  { id: 4, nombre: 'TIENDA',                    icon: 'shopping-bag',     label: 'Tienda',             disponible: true  },
  { id: 5, nombre: 'BARBERIA',                  icon: 'scissors',         label: 'Barbería',           disponible: false },
  { id: 6, nombre: 'SUPERMERCADO',              icon: 'shopping-cart',    label: 'Supermercado',       disponible: false },
  { id: 7, nombre: 'GESTION_TALLER_AUTOMOTRIZ', icon: 'wrench',           label: 'Taller automotriz',  disponible: false },
  { id: 8, nombre: 'FONDO_AHORROS',             icon: 'piggy-bank',       label: 'Fondo de ahorros',   disponible: false },
  { id: 9, nombre: 'FINANCIERA_PRESTAMOS',      icon: 'landmark',         label: 'Financiera',         disponible: false },
];

const TIPOS_NEGOCIO_REGISTRO = TIPOS_NEGOCIO.filter((t) => t.disponible);

const PLANES_BASE: PlanBase[] = [
  {
    nombre: 'Plan Básico',
    precio: 27999,
    periodo: '/mes',
    descripcion: 'Ideal para emprendedores y negocios pequeños. Todo lo esencial para operar desde el primer día.',
    destacado: false,
    cta: 'Probar gratis 7 días',
  },
  {
    nombre: 'Plan Avanzado',
    precio: 59999,
    periodo: '/mes',
    descripcion: 'Para negocios en crecimiento. Más sucursales, más personas en tu equipo y soporte prioritario.',
    destacado: true,
    cta: 'Probar gratis 7 días',
  },
];

const FEATURES_POR_NEGOCIO: Record<string, string[][]> = {
  RESTAURANTE: [
    ['1 sucursal', 'Hasta 5 personas en tu equipo', 'Hasta 15 mesas', 'Menú digital completo', 'Pedidos en línea', 'Gestión de cocina', 'Reportes de ventas'],
    ['Hasta 3 sucursales', 'Equipo ilimitado', 'Mesas ilimitadas', 'Menú avanzado con fotos', 'Pedidos + domicilios', 'Inventario de ingredientes', 'Reportes completos', 'Soporte prioritario'],
  ],
  PARQUEADERO: [
    ['1 sucursal', 'Hasta 5 personas en tu equipo', 'Hasta 80 espacios', 'Tarifas por hora / fracción / día', 'Registro de placa', 'Recibos digitales', 'Reportes de ocupación'],
    ['Hasta 3 sucursales', 'Equipo ilimitado', 'Espacios ilimitados', 'Tarifas diferenciadas', 'Abonados y mensualidades', 'Panel en tiempo real', 'Reportes financieros', 'Soporte prioritario'],
  ],
  GIMNASIO: [
    ['1 sucursal', 'Hasta 5 personas en tu equipo', 'Hasta 200 miembros', 'Membresías básicas', 'Control de asistencia', 'Registro de pagos', 'Reportes básicos'],
    ['Hasta 3 sucursales', 'Equipo ilimitado', 'Miembros ilimitados', 'Planes de membresía avanzados', 'Control de asistencia', 'Cobro automático', 'Venta de productos', 'Reportes completos', 'Soporte prioritario'],
  ],
  TIENDA: [
    ['1 sucursal', 'Hasta 5 personas en tu equipo', 'Hasta 1.000 productos', 'Gestión de inventario', 'Movimientos de stock', 'Ventas y facturación', 'Reportes de ventas'],
    ['Hasta 3 sucursales', 'Equipo ilimitado', 'Productos ilimitados', 'Categorías y proveedores', 'Alertas de stock bajo', 'Ventas avanzadas', 'Reportes completos', 'Soporte prioritario'],
  ],
};

const FEATURES_PROXIMAMENTE: string[][] = [
  ['Módulo en desarrollo', 'Disponible próximamente'],
  ['Módulo en desarrollo', 'Disponible próximamente'],
];

const FEATURES: Feature[] = [
  {
    icon: 'building-2',
    titulo: 'Tus sucursales en un lugar',
    descripcion:
      'Abre y gestiona todas tus sucursales desde una sola plataforma. Restaurantes, gimnasios, tiendas y más — todo centralizado y fácil de controlar.',
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
      'Empieza con una sucursal y expande cuando quieras. La plataforma crece contigo sin cambiar de sistema ni perder información.',
  },
];

const STATS = [
  { valor: '99.9%',   etiqueta: 'Disponibilidad',     descripcion: 'Tu negocio siempre en línea, sin interrupciones.' },
  { valor: '< 200ms', etiqueta: 'Velocidad',           descripcion: 'Operaciones instantáneas para un equipo ágil.' },
  { valor: '24/7',    etiqueta: 'Soporte técnico',     descripcion: 'Asistencia disponible en cualquier momento.' },
  { valor: '∞',       etiqueta: 'Escalabilidad',       descripcion: 'De 1 sucursal a cientos, sin límites.' },
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
        Mail, Building2,
        UtensilsCrossed, Car, Scissors, ShoppingCart, ShoppingBag,
        Wrench, PiggyBank, Landmark, Dumbbell,
      }),
    },
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  protected readonly themeService   = inject(ThemeService);
  protected readonly assetService   = inject(AssetService);
  private   readonly authService    = inject(AuthService);

  protected readonly tiposNegocio        = TIPOS_NEGOCIO;
  protected readonly tiposNegocioRegistro = TIPOS_NEGOCIO_REGISTRO;
  protected readonly features            = FEATURES;
  protected readonly stats               = STATS;
  protected readonly mobileMenuOpen      = signal(false);
  protected readonly currentYear         = new Date().getFullYear();

  /** Tipo seleccionado en el selector de planes */
  protected readonly selectedTipo = signal<TipoNegocio>(TIPOS_NEGOCIO[0]);
  protected readonly selectedDisponible = computed(() => this.selectedTipo().disponible);

  protected readonly planes = computed<PlanConFeatures[]>(() => {
    const tipo = this.selectedTipo();
    const features = tipo.disponible
      ? (FEATURES_POR_NEGOCIO[tipo.nombre] ?? FEATURES_POR_NEGOCIO['RESTAURANTE'])
      : FEATURES_PROXIMAMENTE;
    return PLANES_BASE.map((plan, i) => ({ ...plan, features: features[i] ?? [] }));
  });

  // =================== Modal Trial Registration ===================

  protected readonly modalOpen = signal(false);
  protected readonly modalStep = signal<ModalStep>('form');

  // Formulario - paso 1
  protected readonly trialNombre     = signal('');
  protected readonly trialCedula     = signal('');
  protected readonly trialEmail      = signal('');
  protected readonly trialTipoNeg    = signal('');

  // Touched
  protected readonly trialNombreTouched  = signal(false);
  protected readonly trialCedulaTouched  = signal(false);
  protected readonly trialEmailTouched   = signal(false);
  protected readonly trialTipoTouched    = signal(false);

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

  protected readonly trialFormValid = computed(
    () =>
      !this.trialNombreError() &&
      !this.trialCedulaError() &&
      !this.trialEmailError() &&
      !this.trialTipoError(),
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
