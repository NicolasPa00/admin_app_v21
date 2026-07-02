import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Search, Users, Eye, UserCheck, UserX, Building2, AlertCircle,
  X, CreditCard, ShieldCheck, Pencil, Check, Loader2,
} from 'lucide-angular';

import { UsuariosAdminService } from '../../data-access/usuarios-admin.service';
import {
  UsuarioAdmin, LoadingState, Plan, PlanInfo, UpdateUsuarioPerfilRequest,
} from '../../models/admin.models';

/** Datos editables del perfil de un usuario dentro del modal "Editar". */
interface EditUserForm {
  id_usuario: number;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  num_identificacion: string;
  email: string;
  /** Vacío = conservar la contraseña actual. */
  password: string;
}

/** ¿La descripción del rol corresponde a un administrador/dueño? */
function esRolAdministrador(descripcion: string): boolean {
  return descripcion.toUpperCase().includes('ADMINISTRADOR');
}

type PlanTone = 'success' | 'warning' | 'error';

/** Estado editable del plan de un negocio dentro del modal. */
interface PlanEdit {
  id_plan: string;
  inicio: string; // 'YYYY-MM-DD'
  fin: string;    // 'YYYY-MM-DD'
}

/**
 * UsuariosComponent — Vista de Super Admin con los usuarios del sistema.
 *
 * Muestra a los **administradores** de negocio (no empleados), con búsqueda,
 * filtro por estado y por plan, y acciones de suspender / reactivar /
 * cambiar plan / ver detalles.
 */
@Component({
  selector: 'app-usuarios',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Search, Users, Eye, UserCheck, UserX, Building2, AlertCircle,
        X, CreditCard, ShieldCheck, Pencil, Check, Loader2,
      }),
    },
  ],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss',
})
export class UsuariosComponent implements OnInit {
  private readonly service = inject(UsuariosAdminService);

  // ── Estado ──────────────────────────────────────────────────
  protected readonly loadingState = signal<LoadingState>('idle');
  private readonly _usuarios = signal<UsuarioAdmin[]>([]);
  private readonly _planes = signal<Plan[]>([]);
  protected readonly planesCatalogo = this._planes.asReadonly();

  protected readonly search = signal('');
  protected readonly estadoFilter = signal<'A' | 'I' | 'ALL'>('A');
  protected readonly planFilter = signal<string>('ALL');

  protected readonly selected = signal<UsuarioAdmin | null>(null);
  protected readonly actionId = signal<number | null>(null);
  protected readonly actionError = signal<string | null>(null);

  // ── Modal: editar usuario ───────────────────────────────────
  protected readonly editForm = signal<EditUserForm | null>(null);
  protected readonly editSaving = signal(false);
  protected readonly editError = signal<string | null>(null);

  /** Criterios de la contraseña nueva (solo aplican si el campo no está vacío). */
  protected readonly editPasswordChecks = computed(() => {
    const p = this.editForm()?.password ?? '';
    return {
      length: p.length >= 8,
      upper: /[A-Z]/.test(p),
      number: /\d/.test(p),
    };
  });

  /** ¿La contraseña nueva (si se escribió) cumple todos los criterios? */
  protected readonly editPasswordValid = computed(() => {
    const p = this.editForm()?.password ?? '';
    if (!p) return true; // vacío = conservar la actual
    const c = this.editPasswordChecks();
    return c.length && c.upper && c.number;
  });

  /** ¿El formulario de edición es válido para enviar? */
  protected readonly editValid = computed(() => {
    const f = this.editForm();
    if (!f) return false;
    return (
      f.primer_nombre.trim().length > 0 &&
      f.primer_apellido.trim().length > 0 &&
      f.num_identificacion.trim().length > 0 &&
      f.email.includes('@') &&
      this.editPasswordValid()
    );
  });

  /** Estado editable del plan por negocio dentro del modal (id_negocio → {id_plan, inicio, fin}). */
  protected readonly planEdit = signal<Record<number, PlanEdit>>({});
  protected readonly applyingNegocio = signal<number | null>(null);

  // ── Derivados ───────────────────────────────────────────────

  /** Solo administradores/dueños (excluye empleados como cajeros/meseros). */
  protected readonly administradores = computed<UsuarioAdmin[]>(() =>
    this._usuarios().filter((u) => u.roles.some((r) => esRolAdministrador(r.descripcion))),
  );

  /** Nombres de plan disponibles para el filtro. */
  protected readonly planNombres = computed<string[]>(() =>
    [...new Set(this._planes().map((p) => p.nombre))],
  );

  /** Administradores tras búsqueda + filtro de estado + filtro de plan. */
  protected readonly filtered = computed<UsuarioAdmin[]>(() => {
    const term = this.search().trim().toLowerCase();
    const estado = this.estadoFilter();
    const plan = this.planFilter();

    return this.administradores().filter((u) => {
      if (estado !== 'ALL' && u.estado !== estado) return false;

      if (plan === 'ACTIVO' && !u.planes.some((p) => p.plan?.vigente)) return false;
      if (plan === 'SIN' && u.planes.some((p) => p.plan)) return false;
      if (plan !== 'ALL' && plan !== 'ACTIVO' && plan !== 'SIN'
        && !u.planes.some((p) => p.plan?.nombre === plan)) return false;

      if (!term) return true;
      return (
        u.nombre_completo.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.num_identificacion.toLowerCase().includes(term)
      );
    });
  });

  // ── Lifecycle ───────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
  }

  // ── Filtros ─────────────────────────────────────────────────
  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onEstado(event: Event): void {
    this.estadoFilter.set((event.target as HTMLSelectElement).value as 'A' | 'I' | 'ALL');
  }

  protected onPlanFilter(event: Event): void {
    this.planFilter.set((event.target as HTMLSelectElement).value);
  }

  // ── Acciones ────────────────────────────────────────────────
  protected toggleEstado(u: UsuarioAdmin): void {
    if (u.es_admin_principal || this.actionId() !== null) return;

    const nuevo: 'A' | 'I' = u.estado === 'A' ? 'I' : 'A';
    this.actionId.set(u.id_usuario);
    this.actionError.set(null);

    this.service.setEstado(u.id_usuario, nuevo).subscribe({
      next: () => {
        this._usuarios.update((list) =>
          list.map((x) => (x.id_usuario === u.id_usuario ? { ...x, estado: nuevo } : x)),
        );
        if (this.selected()?.id_usuario === u.id_usuario) {
          this.selected.update((s) => (s ? { ...s, estado: nuevo } : s));
        }
        this.actionId.set(null);
      },
      error: (err) => {
        this.actionError.set(
          err.error?.message ?? 'No se pudo actualizar el estado del usuario.',
        );
        this.actionId.set(null);
      },
    });
  }

  protected onPlanField(idNegocio: number, field: keyof PlanEdit, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.planEdit.update((m) => ({
      ...m,
      [idNegocio]: { ...(m[idNegocio] ?? { id_plan: '', inicio: '', fin: '' }), [field]: value },
    }));
  }

  protected aplicarPlan(idNegocio: number): void {
    const st = this.planEdit()[idNegocio];
    if (!st?.id_plan || this.applyingNegocio() !== null) return;

    this.applyingNegocio.set(idNegocio);
    this.actionError.set(null);

    this.service.cambiarPlan(idNegocio, Number(st.id_plan), {
      fechaInicio: st.inicio || undefined,
      fechaFin: st.fin || undefined,
    }).subscribe({
      next: () => this.refreshUsuarios(this.selected()?.id_usuario),
      error: (err) => {
        this.actionError.set(err.error?.message ?? 'No se pudo cambiar el plan.');
        this.applyingNegocio.set(null);
      },
    });
  }

  protected openDetails(u: UsuarioAdmin): void {
    this.planEdit.set(this.buildPlanEdit(u));
    this.selected.set(u);
  }

  /** Construye el estado editable del plan a partir de los negocios del usuario. */
  private buildPlanEdit(u: UsuarioAdmin): Record<number, PlanEdit> {
    const map: Record<number, PlanEdit> = {};
    for (const np of u.planes) {
      map[np.id_negocio] = {
        id_plan: np.plan?.id_plan ? String(np.plan.id_plan) : '',
        inicio: np.plan?.fecha_inicio ? this.toDateInput(np.plan.fecha_inicio) : this.todayInput(),
        fin: np.plan?.fecha_fin ? this.toDateInput(np.plan.fecha_fin) : '',
      };
    }
    return map;
  }

  private toDateInput(iso: string): string {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private todayInput(): string {
    return this.toDateInput(new Date().toISOString());
  }

  protected closeDetails(): void {
    this.selected.set(null);
  }

  // ── Modal: editar usuario ───────────────────────────────────
  protected openEdit(u: UsuarioAdmin): void {
    this.editForm.set({
      id_usuario: u.id_usuario,
      primer_nombre: u.primer_nombre ?? '',
      segundo_nombre: u.segundo_nombre ?? '',
      primer_apellido: u.primer_apellido ?? '',
      segundo_apellido: u.segundo_apellido ?? '',
      num_identificacion: u.num_identificacion ?? '',
      email: u.email ?? '',
      password: '',
    });
    this.editError.set(null);
  }

  protected updateEdit(field: keyof EditUserForm, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.editForm.update((f) => (f ? { ...f, [field]: value } : f));
  }

  protected closeEdit(): void {
    this.editForm.set(null);
    this.editError.set(null);
  }

  protected submitEdit(): void {
    const f = this.editForm();
    if (!f || !this.editValid() || this.editSaving()) return;

    this.editSaving.set(true);
    this.editError.set(null);

    const payload: UpdateUsuarioPerfilRequest = {
      primer_nombre: f.primer_nombre.trim(),
      segundo_nombre: f.segundo_nombre.trim() || null,
      primer_apellido: f.primer_apellido.trim(),
      segundo_apellido: f.segundo_apellido.trim() || null,
      num_identificacion: f.num_identificacion.trim(),
      email: f.email.trim(),
      ...(f.password ? { password: f.password } : {}),
    };

    this.service.updatePerfil(f.id_usuario, payload).subscribe({
      next: () => {
        this.editSaving.set(false);
        this.closeEdit();
        this.refreshUsuarios(this.selected()?.id_usuario);
      },
      error: (err) => {
        this.editSaving.set(false);
        this.editError.set(err.error?.message ?? 'No se pudo actualizar el usuario.');
      },
    });
  }

  protected retry(): void {
    this.load();
  }

  // ── Helpers de plan ─────────────────────────────────────────

  /** Plan representativo del usuario (el vigente, o el primero con datos). */
  protected planPrincipal(u: UsuarioAdmin): PlanInfo | null {
    const conPlan = u.planes.filter((p) => p.plan);
    if (conPlan.length === 0) return null;
    return (conPlan.find((p) => p.plan?.vigente) ?? conPlan[0]).plan;
  }

  /** Cuántos negocios del usuario tienen plan. */
  protected planesConDatos(u: UsuarioAdmin): number {
    return u.planes.filter((p) => p.plan).length;
  }

  /** ¿El plan dado es el seleccionado para ese negocio? (para [selected]). */
  protected esPlanSel(idNegocio: number, idPlan: number): boolean {
    return String(idPlan) === this.planEdit()[idNegocio]?.id_plan;
  }

  protected planTone(plan: PlanInfo): PlanTone {
    if (!plan.vigente) return 'error';
    if (plan.dias_restantes !== null && plan.dias_restantes <= 15) return 'warning';
    return 'success';
  }

  protected planInicioTexto(u: UsuarioAdmin): string {
    const p = this.planPrincipal(u);
    return p?.fecha_inicio ? this.formatDate(p.fecha_inicio) : '—';
  }

  protected formatPrecio(plan: Plan): string {
    return `${Number(plan.precio).toLocaleString('es-CO')} ${plan.moneda}`;
  }

  // ── Helpers de presentación ─────────────────────────────────

  protected negociosAdministrados(u: UsuarioAdmin): string[] {
    const nombres = u.roles
      .filter((r) => esRolAdministrador(r.descripcion) && r.negocio_nombre)
      .map((r) => r.negocio_nombre as string);
    return [...new Set(nombres)];
  }

  protected initials(u: UsuarioAdmin): string {
    return `${u.primer_nombre?.[0] ?? ''}${u.primer_apellido?.[0] ?? ''}`.toUpperCase();
  }

  protected formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  // ── Carga ───────────────────────────────────────────────────
  private load(): void {
    this.loadingState.set('loading');
    forkJoin({
      usuarios: this.service.getUsuarios({ estado: 'ALL' }),
      planes: this.service.getPlanes(),
    }).subscribe({
      next: ({ usuarios, planes }) => {
        this._usuarios.set(usuarios);
        this._planes.set(planes);
        this.loadingState.set('success');
      },
      error: () => this.loadingState.set('error'),
    });
  }

  /** Recarga usuarios tras un cambio de plan, conservando el modal abierto. */
  private refreshUsuarios(keepSelectedId?: number): void {
    this.service.getUsuarios({ estado: 'ALL' }).subscribe({
      next: (usuarios) => {
        this._usuarios.set(usuarios);
        const sel = keepSelectedId != null
          ? usuarios.find((u) => u.id_usuario === keepSelectedId) ?? null
          : null;
        this.selected.set(sel);
        if (sel) this.planEdit.set(this.buildPlanEdit(sel));
        this.applyingNegocio.set(null);
      },
      error: () => {
        this.applyingNegocio.set(null);
        this.actionError.set('El plan se cambió, pero no se pudo refrescar la lista.');
      },
    });
  }
}
