import { Component, inject, signal, computed, afterNextRender, DestroyRef } from '@angular/core';
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
  { id: 6, nombre: 'SALON_BELLEZA',             icon: 'scissors',         label: 'Salón de belleza',   disponible: false },
  { id: 7, nombre: 'SUPERMERCADO',              icon: 'shopping-cart',    label: 'Supermercado',       disponible: false },
  { id: 8, nombre: 'GESTION_TALLER_AUTOMOTRIZ', icon: 'wrench',           label: 'Taller automotriz',  disponible: false },
  { id: 9, nombre: 'FONDO_AHORROS',             icon: 'piggy-bank',       label: 'Fondo de ahorros',   disponible: false },
  { id: 10, nombre: 'FINANCIERA_PRESTAMOS',     icon: 'landmark',         label: 'Financiera',         disponible: false },
];

const TIPOS_NEGOCIO_REGISTRO = TIPOS_NEGOCIO.filter((t) => t.disponible);

const PLANES_BASE: PlanBase[] = [
  {
    nombre: 'Plan Básico',
    precio: 27999,
    periodo: '/mes',
    descripcion: 'Todo lo esencial para operar tu negocio desde el primer día. Hasta 5 personas en tu equipo.',
    destacado: false,
    cta: 'Probar gratis 7 días',
  },
];

const FEATURES_POR_NEGOCIO: Record<string, string[][]> = {
  RESTAURANTE: [
    ['Hasta 5 personas en tu equipo', 'Menú digital completo', 'Pedidos en línea', 'Gestión de cocina', 'Reportes de ventas'],
  ],
  PARQUEADERO: [
    ['Hasta 5 personas en tu equipo', 'Espacios ilimitados', 'Tarifas por hora / fracción / día', 'Registro de placa', 'Recibos digitales', 'Reportes de ocupación'],
  ],
  GIMNASIO: [
    ['Hasta 5 personas en tu equipo', 'Miembros ilimitados', 'Membresías', 'Control de asistencia', 'Registro de pagos', 'Reportes completos'],
  ],
  TIENDA: [
    ['Hasta 5 personas en tu equipo', 'Productos ilimitados', 'Gestión de inventario', 'Movimientos de stock', 'Ventas y facturación', 'Reportes de ventas'],
  ],
  BARBERIA: [
    ['Hasta 5 personas en tu equipo', 'Agenda de citas', 'Gestión de profesionales', 'Control de servicios', 'Recordatorios automáticos', 'Reportes de ingresos'],
  ],
  SALON_BELLEZA: [
    ['Hasta 5 personas en tu equipo', 'Agenda de citas', 'Gestión de profesionales', 'Control de servicios', 'Recordatorios automáticos', 'Reportes de ingresos'],
  ],
};

const FEATURES_PROXIMAMENTE: string[][] = [
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

const STATS = [
  { valor: '99.9%',   etiqueta: 'Disponibilidad',     descripcion: 'Tu negocio siempre en línea, sin interrupciones.' },
  { valor: '< 200ms', etiqueta: 'Velocidad',           descripcion: 'Operaciones instantáneas para un equipo ágil.' },
  { valor: '24/7',    etiqueta: 'Soporte técnico',     descripcion: 'Asistencia disponible en cualquier momento.' },
  { valor: '∞',       etiqueta: 'Escalabilidad',       descripcion: 'Crece sin límites, la plataforma se adapta a ti.' },
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
  protected readonly selectedTipo = signal<TipoNegocio>(TIPOS_NEGOCIO[0]);
  protected readonly selectedDisponible = computed(() => this.selectedTipo().disponible);

  /* ── Imagen representativa por tipo de negocio ── */
  private readonly tipoImagenMap: Record<string, string | null> = {
    RESTAURANTE:  'pulpo_restaurante.png',
    PARQUEADERO:  'pulpo_parqueadero.png',
    GIMNASIO:     'pulpo_gym.png',
    TIENDA:       'pulpo_tienda.png',
    BARBERIA:     'pulpo_barberia.png',
    SALON_BELLEZA: 'pulpo_salonbelleza.png',
    SUPERMERCADO: 'pulpo_tienda.png',
  };

  protected readonly tipoImagenSrc = computed(() => {
    const filename = this.tipoImagenMap[this.selectedTipo().nombre] ?? null;
    return filename ? this.assetService.getAssetPath(filename) : null;
  });

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
