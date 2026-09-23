import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Plus, Check, AlertCircle, Loader2, Tag, Palette,
  UtensilsCrossed, Car, Scissors, ShoppingCart, Dumbbell, Wrench,
  PiggyBank, Landmark, Store, Building2, Calendar, Briefcase,
  // El resto del catálogo ya trae estos íconos guardados en gener_tipo_negocio.icono —
  // faltaban aquí, así que `iconoDe()` los descartaba y todos caían al genérico 'store'.
  Coffee, Croissant, IceCreamCone, Beer, Sandwich, Pizza, Sparkles, Flower2,
  Hand, HandHeart, Stethoscope, Syringe, PenTool, PawPrint, Dog, Hotel, BedDouble, Tent,
} from 'lucide-angular';

import { AdminService } from '../../data-access/admin.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { TipoNegocio, LoadingState } from '../../models/admin.models';

/** Íconos curados que un tipo de negocio puede usar (nombres lucide). */
const ICONOS_DISPONIBLES = [
  'store', 'utensils-crossed', 'car', 'scissors', 'shopping-cart',
  'dumbbell', 'wrench', 'piggy-bank', 'landmark', 'building-2',
  'calendar', 'briefcase',
  'coffee', 'croissant', 'ice-cream-cone', 'beer', 'sandwich', 'pizza',
  'sparkles', 'flower-2', 'hand', 'hand-heart', 'stethoscope', 'syringe',
  'pen-tool', 'paw-print', 'dog', 'hotel', 'bed-double', 'tent',
];

const COLOR_DEFAULT = '#6366F1';

/**
 * RegistrarComponent — Registro de clientes (Super Admin).
 *
 * Fase 1: creación y listado de TIPOS DE NEGOCIO (nombre, descripción,
 * ícono y color de acento). Las siguientes fases añadirán el registro
 * de negocios (clientes) y su administrador.
 */
@Component({
  selector: 'app-registrar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Plus, Check, AlertCircle, Loader2, Tag, Palette,
        UtensilsCrossed, Car, Scissors, ShoppingCart, Dumbbell, Wrench,
        PiggyBank, Landmark, Store, Building2, Calendar, Briefcase,
        Coffee, Croissant, IceCreamCone, Beer, Sandwich, Pizza, Sparkles, Flower2,
        Hand, HandHeart, Stethoscope, Syringe, PenTool, PawPrint, Dog, Hotel, BedDouble, Tent,
      }),
    },
  ],
  templateUrl: './registrar.component.html',
  styleUrl: './registrar.component.scss',
})
export class RegistrarComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  protected readonly iconos = ICONOS_DISPONIBLES;

  // ── Formulario ──────────────────────────────────────────────
  protected readonly nombre = signal('');
  protected readonly descripcion = signal('');
  protected readonly icono = signal('store');
  protected readonly color = signal(COLOR_DEFAULT);

  protected readonly saving = signal(false);

  protected readonly nombreValido = computed(() => this.nombre().trim().length > 0);

  // ── Listado ─────────────────────────────────────────────────
  protected readonly loadingState = signal<LoadingState>('idle');
  protected readonly tipos = signal<TipoNegocio[]>([]);

  ngOnInit(): void {
    this.loadTipos();
  }

  // ── Form handlers ───────────────────────────────────────────
  protected setNombre(e: Event): void {
    this.nombre.set((e.target as HTMLInputElement).value);
  }

  protected setDescripcion(e: Event): void {
    this.descripcion.set((e.target as HTMLTextAreaElement).value);
  }

  protected setColor(e: Event): void {
    this.color.set((e.target as HTMLInputElement).value);
  }

  protected selectIcono(name: string): void {
    this.icono.set(name);
  }

  protected submit(): void {
    if (!this.nombreValido() || this.saving()) return;

    this.saving.set(true);
    this.adminService.createTipoNegocio({
      nombre: this.nombre().trim(),
      descripcion: this.descripcion().trim() || null,
      icono: this.icono(),
      color_hex: this.color(),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.exito('Tipo de negocio creado correctamente.');
        this.nombre.set('');
        this.descripcion.set('');
        this.loadTipos();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.errorHttp(err, 'No se pudo crear el tipo de negocio.');
      },
    });
  }

  // ── Helpers de presentación ─────────────────────────────────
  protected iconoDe(t: TipoNegocio): string {
    return t.icono && this.iconos.includes(t.icono) ? t.icono : 'store';
  }

  protected colorDe(t: TipoNegocio): string {
    return t.color_hex || COLOR_DEFAULT;
  }

  private loadTipos(): void {
    this.loadingState.set('loading');
    this.adminService.getTiposNegocio().subscribe({
      next: (tipos) => {
        this.tipos.set(tipos);
        this.loadingState.set('success');
      },
      error: () => this.loadingState.set('error'),
    });
  }
}
