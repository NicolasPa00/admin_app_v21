import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Plus, Search, Building2, Pencil, Power, X, AlertCircle, Loader2,
  CreditCard, Check, UserRound, UserPlus,
} from 'lucide-angular';

import { AuthService } from '../../../auth/data-access/auth.service';
import { SUPER_ADMIN_ROL } from '../../guards/admin.guard';
import { NegociosAdminService } from '../../data-access/negocios-admin.service';
import {
  NegocioAdmin, TipoNegocio, Rubro, Plan, PlanInfo, LoadingState,
  RegistrarClienteRequest, UsuarioBusqueda,
} from '../../models/admin.models';

type UserMode = 'nuevo' | 'existente';

type PlanTone = 'success' | 'warning' | 'error';

interface CreateForm {
  nombre: string; id_rubro: string; nit: string;
  email_contacto: string; telefono: string; direccion: string; pais: string;
  id_plan: string; meses: string;
  a_primer_nombre: string; a_primer_apellido: string;
  a_num_identificacion: string; a_email: string; a_password: string;
}

interface EditForm {
  id_negocio: number; nombre: string; nit: string;
  email_contacto: string; telefono: string; direccion: string; id_rubro: string;
  pais: string;
}

/**
 * Los países que la plataforma sabe manejar.
 *
 * No es decoración: de esto depende que el teléfono de un cliente se guarde como número
 * utilizable o se descarte. Hasta 2026-09-09 todo era Colombia y no había dónde decirlo, así
 * que los móviles del primer cliente chileno se habrían tirado en silencio.
 * Desde 2026-09-10 el país decide además la **moneda** con la que el inquilino ve sus precios,
 * así que la lista creció con los mercados a los que se puede vender de inmediato.
 * La lista viva está en `app_core/helpers/paises.js` del backend, que además la valida.
 */
const PAISES: ReadonlyArray<{ codigo: string; nombre: string }> = [
  { codigo: 'CO', nombre: 'Colombia (+57)' },
  { codigo: 'CL', nombre: 'Chile (+56)' },
  { codigo: 'PE', nombre: 'Perú (+51)' },
  { codigo: 'EC', nombre: 'Ecuador (+593)' },
  { codigo: 'MX', nombre: 'México (+52)' },
];

const EMPTY_CREATE: CreateForm = {
  nombre: '', id_rubro: '', nit: '', email_contacto: '', telefono: '', direccion: '', pais: 'CO',
  id_plan: '', meses: '1',
  a_primer_nombre: '', a_primer_apellido: '', a_num_identificacion: '', a_email: '', a_password: '',
};

/**
 * NegociosComponent — Gestión de negocios (clientes) del Super Admin.
 * Registrar cliente (negocio + plan + admin), editar y activar/desactivar.
 */
@Component({
  selector: 'app-negocios',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Plus, Search, Building2, Pencil, Power, X, AlertCircle, Loader2,
        CreditCard, Check, UserRound, UserPlus,
      }),
    },
  ],
  templateUrl: './negocios.component.html',
  styleUrl: './negocios.component.scss',
})
export class NegociosComponent implements OnInit, OnDestroy {
  private readonly service = inject(NegociosAdminService);
  private readonly auth = inject(AuthService);

  // ── Estado de datos ─────────────────────────────────────────
  protected readonly loadingState = signal<LoadingState>('idle');
  private readonly _negocios = signal<NegocioAdmin[]>([]);
  protected readonly paises = PAISES;
  protected readonly tipos = signal<TipoNegocio[]>([]);

  /**
   * Los oficios que se le pueden ofrecer a un cliente.
   *
   * Es lo que va en el desplegable de crear y editar — **no** `tipos()`, que es el catálogo
   * entero e incluye media docena de filas sin módulo detrás. Ofrecer una de esas fue lo que
   * dejó al primer cliente de reserva fuera de su propia app (se creó como BARBERIA, 2026-09-09).
   *
   * El backend ya las filtra; aquí solo se agrupan para pintarlas.
   */
  protected readonly rubros = signal<Rubro[]>([]);

  /**
   * Los mismos oficios agrupados por el módulo que los atiende, para los `optgroup`.
   *
   * Enseñar el módulo importa: quien crea el cliente tiene que ver de un vistazo que «Heladería»
   * y «Pizzería» son el mismo software, porque de ahí depende lo que le promete al cliente.
   */
  protected readonly rubrosPorModulo = computed(() => {
    const grupos = new Map<string, Rubro[]>();
    for (const r of this.rubros()) {
      const lista = grupos.get(r.modulo) ?? [];
      lista.push(r);
      grupos.set(r.modulo, lista);
    }
    return [...grupos.entries()].map(([modulo, lista]) => ({ modulo, rubros: lista }));
  });

  /**
   * Igual, pero incluyendo el oficio actual del negocio que se edita aunque ya no se ofrezca.
   * Sin esa excepción el desplegable mostraría otro oficio distinto al real, y guardar cualquier
   * otro campo lo cambiaría sin querer.
   */
  protected readonly rubrosEditPorModulo = computed(() => {
    const actual = this.editForm()?.id_rubro;
    const grupos = this.rubrosPorModulo();
    if (!actual || this.rubros().some((r) => String(r.id_tipo_negocio) === actual)) return grupos;

    const suelto = this.tipos().find((t) => String(t.id_tipo_negocio) === actual);
    if (!suelto) return grupos;
    return [...grupos, {
      modulo: 'Sin módulo',
      rubros: [{
        id_tipo_negocio: suelto.id_tipo_negocio,
        nombre: suelto.nombre,
        etiqueta: suelto.descripcion || suelto.nombre,
        icono: suelto.icono ?? null,
        color_hex: suelto.color_hex ?? null,
        orden: 999,
        id_tipo_modulo: suelto.id_tipo_negocio,
        modulo: 'Sin módulo',
      } as Rubro],
    }];
  });

  /**
   * Los módulos, para el filtro de la tabla.
   *
   * El filtro va por MÓDULO y no por oficio a propósito: «enséñame todos los restaurantes» es
   * una pregunta útil, «enséñame las heladerías» con dos clientes no lo es todavía.
   */
  protected readonly modulos = computed(() => {
    const vistos = new Map<number, string>();
    for (const r of this.rubros()) vistos.set(r.id_tipo_modulo, r.modulo);
    return [...vistos.entries()].map(([id, nombre]) => ({ id, nombre }));
  });
  protected readonly planes = signal<Plan[]>([]);

  // ── Filtros ─────────────────────────────────────────────────
  protected readonly search = signal('');
  protected readonly estadoFilter = signal<'A' | 'I' | 'ALL'>('A');
  protected readonly tipoFilter = signal<string>('ALL');

  // ── Rol ─────────────────────────────────────────────────────
  protected readonly isSuperAdmin = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return false;
    return u.roles_globales.some((r) => r.descripcion === SUPER_ADMIN_ROL) ||
           u.negocios.some((n) => n.roles.some((r) => r.descripcion === SUPER_ADMIN_ROL));
  });

  // ── Modal ───────────────────────────────────────────────────
  protected readonly modalMode = signal<'create' | 'edit' | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly createForm = signal<CreateForm>({ ...EMPTY_CREATE });
  protected readonly editForm = signal<EditForm | null>(null);

  // ── Usuario mode (crear nuevo vs vincular existente) ────────
  protected readonly userMode = signal<UserMode>('nuevo');
  protected readonly usuarioQuery = signal('');
  protected readonly usuarioResults = signal<UsuarioBusqueda[]>([]);
  protected readonly usuarioSeleccionado = signal<UsuarioBusqueda | null>(null);
  protected readonly searchLoading = signal(false);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Acción de fila ──────────────────────────────────────────
  protected readonly actionId = signal<number | null>(null);
  protected readonly rowError = signal<string | null>(null);

  // ── Derivados ───────────────────────────────────────────────
  protected readonly filtered = computed<NegocioAdmin[]>(() => {
    const term = this.search().trim().toLowerCase();
    const estado = this.estadoFilter();
    const tipo = this.tipoFilter();

    return this._negocios().filter((n) => {
      if (estado !== 'ALL' && n.estado !== estado) return false;
      if (tipo !== 'ALL' && String(n.id_tipo_negocio) !== tipo) return false;
      if (!term) return true;
      return (
        n.nombre.toLowerCase().includes(term) ||
        (n.nit ?? '').toLowerCase().includes(term) ||
        (n.email_contacto ?? '').toLowerCase().includes(term)
      );
    });
  });

  /** Criterios de seguridad de la contraseña del admin nuevo (evaluados en vivo). */
  protected readonly passwordChecks = computed(() => {
    const p = this.createForm().a_password;
    return {
      length: p.length >= 8,
      upper: /[A-Z]/.test(p),
      number: /\d/.test(p),
    };
  });

  /** ¿La contraseña cumple todos los criterios? */
  protected readonly passwordValid = computed(() => {
    const c = this.passwordChecks();
    return c.length && c.upper && c.number;
  });

  protected readonly createValid = computed(() => {
    const f = this.createForm();
    const base = f.nombre.trim().length > 0 && f.id_rubro !== '';
    if (this.userMode() === 'existente') return base && this.usuarioSeleccionado() !== null;
    return (
      base &&
      f.a_primer_nombre.trim().length > 0 &&
      f.a_primer_apellido.trim().length > 0 &&
      f.a_num_identificacion.trim().length > 0 &&
      f.a_email.includes('@') &&
      this.passwordValid()
    );
  });

  protected readonly editValid = computed(() => (this.editForm()?.nombre.trim().length ?? 0) > 0);

  // ── Lifecycle ───────────────────────────────────────────────
  ngOnInit(): void { this.load(); }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  // ── Filtros ─────────────────────────────────────────────────
  protected onSearch(e: Event): void { this.search.set((e.target as HTMLInputElement).value); }
  protected onEstado(e: Event): void { this.estadoFilter.set((e.target as HTMLSelectElement).value as 'A' | 'I' | 'ALL'); }
  protected onTipo(e: Event): void { this.tipoFilter.set((e.target as HTMLSelectElement).value); }

  // ── Modal: crear ────────────────────────────────────────────
  protected openCreate(): void {
    this.createForm.set({ ...EMPTY_CREATE });
    this.formError.set(null);
    this.userMode.set('nuevo');
    this.usuarioQuery.set('');
    this.usuarioResults.set([]);
    this.usuarioSeleccionado.set(null);
    this.modalMode.set('create');
  }

  protected setUserMode(mode: UserMode): void {
    this.userMode.set(mode);
    this.usuarioQuery.set('');
    this.usuarioResults.set([]);
    this.usuarioSeleccionado.set(null);
  }

  protected onUsuarioQuery(e: Event): void {
    const q = (e.target as HTMLInputElement).value;
    this.usuarioQuery.set(q);
    this.usuarioSeleccionado.set(null);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (q.trim().length < 2) { this.usuarioResults.set([]); return; }
    this.searchTimer = setTimeout(() => this.doSearch(q.trim()), 350);
  }

  private doSearch(q: string): void {
    this.searchLoading.set(true);
    this.service.buscarUsuarios(q).subscribe({
      next: (r) => { this.usuarioResults.set(r); this.searchLoading.set(false); },
      error: () => this.searchLoading.set(false),
    });
  }

  protected selectUsuario(u: UsuarioBusqueda): void {
    this.usuarioSeleccionado.set(u);
    this.usuarioResults.set([]);
    // Autofill negocio contact fields from the selected user
    this.createForm.update((f) => ({
      ...f,
      email_contacto: u.email,
      telefono: u.telefono ?? '',
    }));
  }

  protected clearUsuario(): void {
    this.usuarioSeleccionado.set(null);
    this.usuarioQuery.set('');
    this.usuarioResults.set([]);
  }

  protected updateCreate(field: keyof CreateForm, e: Event): void {
    const value = (e.target as HTMLInputElement | HTMLSelectElement).value;
    this.createForm.update((f) => ({ ...f, [field]: value }));
  }

  protected submitCreate(): void {
    if (!this.createValid() || this.saving()) return;
    const f = this.createForm();
    this.saving.set(true);
    this.formError.set(null);

    const negocioPayload = {
      nombre: f.nombre.trim(),
      id_rubro: Number(f.id_rubro),
      nit: f.nit.trim() || null,
      email_contacto: f.email_contacto.trim() || null,
      telefono: f.telefono.trim() || null,
      direccion: f.direccion.trim() || null,
      pais: f.pais || 'CO',
    };
    const planPayload = f.id_plan ? { id_plan: Number(f.id_plan), meses: Number(f.meses) || 1 } : null;

    const payload: RegistrarClienteRequest = this.userMode() === 'existente'
      ? {
          negocio: negocioPayload,
          plan: planPayload,
          id_usuario_existente: this.usuarioSeleccionado()!.id_usuario,
        }
      : {
          negocio: negocioPayload,
          plan: planPayload,
          admin: {
            primer_nombre: f.a_primer_nombre.trim(),
            primer_apellido: f.a_primer_apellido.trim(),
            num_identificacion: f.a_num_identificacion.trim(),
            email: f.a_email.trim(),
            password: f.a_password,
          },
        };

    this.service.registrarCliente(payload).subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.load(); },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.error?.message ?? 'No se pudo registrar el cliente.');
      },
    });
  }

  // ── Modal: editar ───────────────────────────────────────────
  protected openEdit(n: NegocioAdmin): void {
    this.editForm.set({
      id_negocio: n.id_negocio,
      nombre: n.nombre,
      nit: n.nit ?? '',
      email_contacto: n.email_contacto ?? '',
      telefono: n.telefono ?? '',
      direccion: n.direccion ?? '',
      id_rubro: String(n.id_rubro ?? n.id_tipo_negocio),
      pais: n.pais ?? 'CO',
    });
    this.formError.set(null);
    this.modalMode.set('edit');
  }

  protected updateEdit(field: keyof EditForm, e: Event): void {
    const value = (e.target as HTMLInputElement | HTMLSelectElement).value;
    this.editForm.update((f) => (f ? { ...f, [field]: value } : f));
  }

  protected submitEdit(): void {
    const f = this.editForm();
    if (!f || !this.editValid() || this.saving()) return;
    this.saving.set(true);
    this.formError.set(null);

    this.service.updateNegocio(f.id_negocio, {
      nombre: f.nombre.trim(),
      nit: f.nit.trim() || null,
      email_contacto: f.email_contacto.trim() || null,
      telefono: f.telefono.trim() || null,
      direccion: f.direccion.trim() || null,
      id_rubro: f.id_rubro ? Number(f.id_rubro) : undefined,
      pais: f.pais || 'CO',
    }).subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.load(); },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.error?.message ?? 'No se pudo actualizar el negocio.');
      },
    });
  }

  protected closeModal(): void {
    this.modalMode.set(null);
    this.editForm.set(null);
  }

  /** ¿El oficio dado es el del negocio en edición? (para marcar la opción). */
  protected esRubroEdit(idRubro: number): boolean {
    return String(idRubro) === this.editForm()?.id_rubro;
  }

  // ── Activar / desactivar ────────────────────────────────────
  protected toggleEstado(n: NegocioAdmin): void {
    if (this.actionId() !== null) return;
    const nuevo: 'A' | 'I' = n.estado === 'A' ? 'I' : 'A';
    this.actionId.set(n.id_negocio);
    this.rowError.set(null);

    this.service.setEstado(n.id_negocio, nuevo).subscribe({
      next: () => {
        this._negocios.update((list) =>
          list.map((x) => (x.id_negocio === n.id_negocio ? { ...x, estado: nuevo } : x)),
        );
        this.actionId.set(null);
      },
      error: (err) => {
        this.rowError.set(err.error?.message ?? 'No se pudo cambiar el estado.');
        this.actionId.set(null);
      },
    });
  }

  protected retry(): void { this.load(); }

  // ── Helpers ─────────────────────────────────────────────────
  protected planTone(p: PlanInfo): PlanTone {
    if (!p.vigente) return 'error';
    if (p.dias_restantes !== null && p.dias_restantes <= 15) return 'warning';
    return 'success';
  }

  protected formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ── Carga ───────────────────────────────────────────────────
  private load(): void {
    this.loadingState.set('loading');
    forkJoin({
      negocios: this.service.getNegocios(),
      tipos: this.service.getTipos(),
      rubros: this.service.getRubros(),
      planes: this.service.getPlanes(),
    }).subscribe({
      next: ({ negocios, tipos, rubros, planes }) => {
        this._negocios.set(negocios);
        this.tipos.set(tipos);
        this.rubros.set(rubros);
        this.planes.set(planes);
        this.loadingState.set('success');
      },
      error: () => this.loadingState.set('error'),
    });
  }
}
