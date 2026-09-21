import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Search, Users, Eye, Building2, AlertCircle, ArrowRight,
  X, ShieldCheck, Pencil, Check, Loader2, LogIn, Power,
} from 'lucide-angular';

import { UsuariosAdminService } from '../../data-access/usuarios-admin.service';
import { AuthService } from '../../../auth/data-access/auth.service';
import { diaBogota, formatearDia } from '../../../core/utils/vigencia';
import { TonoVencimiento, evaluarVencimiento } from '../../../core/utils/estado-plan';
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
  /** Opcional: vacío = sin correo. */
  email: string;
  /** Vacío = conservar la contraseña actual. */
  password: string;
}

/** Formato mínimo de correo; el backend hace la validación de verdad. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** ¿La descripción del rol corresponde a un administrador/dueño? */
function esRolAdministrador(descripcion: string): boolean {
  return descripcion.toUpperCase().includes('ADMINISTRADOR');
}

type PlanTone = TonoVencimiento;

/**
 * UsuariosComponent — Vista de Super Admin con los usuarios del sistema.
 *
 * Muestra a los **administradores** de negocio (no empleados), con búsqueda, filtro por estado y
 * por plan, y acciones de ver detalles / editar / entrar como / suspender-reactivar.
 *
 * El plan se **consulta** aquí pero no se cambia: pertenece al negocio (`gener_negocio_plan`) y
 * se gestiona en Negocios → Editar. Un usuario con dos negocios tiene dos planes, y cambiarlo
 * desde la ficha del usuario hacía parecer que el plan era suyo.
 */
@Component({
  selector: 'app-usuarios',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Search, Users, Eye, Building2, AlertCircle, ArrowRight,
        X, ShieldCheck, Pencil, Check, Loader2, LogIn, Power,
      }),
    },
  ],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss',
})
export class UsuariosComponent implements OnInit {
  private readonly service = inject(UsuariosAdminService);
  private readonly auth = inject(AuthService);

  protected readonly formatearDia = formatearDia;
  protected readonly diaBogota = diaBogota;

  /** id del usuario que se está impersonando (para estado de carga del botón). */
  protected readonly impersonateId = signal<number | null>(null);
  /** Usuario pendiente de confirmar para impersonar (abre el modal). */
  protected readonly confirmUser = signal<UsuarioAdmin | null>(null);
  /** Usuario pendiente de confirmar para suspender o reactivar (abre el modal). */
  protected readonly confirmEstado = signal<UsuarioAdmin | null>(null);

  // ── Estado ──────────────────────────────────────────────────
  protected readonly loadingState = signal<LoadingState>('idle');
  private readonly _usuarios = signal<UsuarioAdmin[]>([]);
  private readonly _planes = signal<Plan[]>([]);

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

  /** El correo es opcional; si se escribe, tiene que tener forma de correo. */
  protected readonly editEmailInvalido = computed(() => {
    const e = this.editForm()?.email.trim() ?? '';
    return e.length > 0 && !EMAIL_RE.test(e);
  });

  /** ¿El formulario de edición es válido para enviar? */
  protected readonly editValid = computed(() => {
    const f = this.editForm();
    if (!f) return false;
    return (
      f.primer_nombre.trim().length > 0 &&
      f.primer_apellido.trim().length > 0 &&
      f.num_identificacion.trim().length > 0 &&
      !this.editEmailInvalido() &&
      this.editPasswordValid()
    );
  });

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
        // El correo puede venir vacío: en el vertical de reservas es opcional desde que quedó
        // claro que la credencial de acceso es el documento. Sin este guardia, buscar cualquier
        // cosa reventaba la lista entera al toparse con uno de esos usuarios.
        (u.email ?? '').toLowerCase().includes(term) ||
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

  // ── Suspender / reactivar (con confirmación) ────────────────

  /** Abre la confirmación. Suspender deja al usuario fuera del sistema: nunca va directo. */
  protected pedirCambioEstado(u: UsuarioAdmin): void {
    if (u.es_admin_principal || this.actionId() !== null) return;
    this.confirmEstado.set(u);
  }

  protected cancelarCambioEstado(): void {
    if (this.actionId() !== null) return;
    this.confirmEstado.set(null);
  }

  protected confirmarCambioEstado(): void {
    const u = this.confirmEstado();
    if (!u || this.actionId() !== null) return;

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
        this.confirmEstado.set(null);
      },
      error: (err) => {
        this.actionError.set(
          err.error?.message ?? 'No se pudo actualizar el estado del usuario.',
        );
        this.actionId.set(null);
        this.confirmEstado.set(null);
      },
    });
  }

  // ── Modal: detalles ─────────────────────────────────────────
  protected openDetails(u: UsuarioAdmin): void {
    this.selected.set(u);
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
      email: f.email.trim() || null,
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

  // ── Entrar como este usuario ────────────────────────────────

  /** Abre el modal de confirmación para entrar al sistema como el usuario dado. */
  protected impersonar(u: UsuarioAdmin): void {
    if (u.estado !== 'A' || this.impersonateId() !== null) return;
    this.confirmUser.set(u);
  }

  /** Cierra el modal de confirmación de impersonación. */
  protected cancelImpersonar(): void {
    if (this.impersonateId() !== null) return;
    this.confirmUser.set(null);
  }

  /** Confirma la impersonación (super admin): el backend valida el rol y audita el acceso. */
  protected confirmImpersonar(): void {
    const u = this.confirmUser();
    if (!u || this.impersonateId() !== null) return;

    this.impersonateId.set(u.id_usuario);
    this.actionError.set(null);

    this.auth.impersonate(u.id_usuario).subscribe({
      next: () => {
        this.impersonateId.set(null);
        this.confirmUser.set(null);
      },
      error: (err) => {
        this.actionError.set(err.error?.message ?? 'No se pudo iniciar la impersonación.');
        this.impersonateId.set(null);
        this.confirmUser.set(null);
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

  /** Mismo criterio que Negocios y el dashboard (`core/utils/estado-plan.ts`). */
  protected planTone(plan: PlanInfo): PlanTone {
    return evaluarVencimiento(plan).tono;
  }

  protected planInicioTexto(u: UsuarioAdmin): string {
    const p = this.planPrincipal(u);
    return p?.fecha_inicio ? this.formatDate(p.fecha_inicio) : '—';
  }

  // ── Helpers de presentación ─────────────────────────────────

  protected negociosAdministrados(u: UsuarioAdmin): string[] {
    const nombres = u.roles
      .filter((r) => esRolAdministrador(r.descripcion) && r.negocio_nombre)
      .map((r) => r.negocio_nombre as string);
    return [...new Set(nombres)];
  }

  /** Solo los primeros — sin este límite, un usuario con muchos negocios (p. ej. el super
   *  admin) triplicaba la altura de su fila frente a las demás. El resto va en el "+N". */
  private static readonly NEGOCIOS_VISIBLES = 2;

  protected negociosVisibles(u: UsuarioAdmin): string[] {
    return this.negociosAdministrados(u).slice(0, UsuariosComponent.NEGOCIOS_VISIBLES);
  }

  protected negociosOcultos(u: UsuarioAdmin): number {
    return Math.max(0, this.negociosAdministrados(u).length - UsuariosComponent.NEGOCIOS_VISIBLES);
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

  /** Recarga usuarios tras editar, conservando abierto el modal de detalles si lo estaba. */
  private refreshUsuarios(keepSelectedId?: number): void {
    this.service.getUsuarios({ estado: 'ALL' }).subscribe({
      next: (usuarios) => {
        this._usuarios.set(usuarios);
        const sel = keepSelectedId != null
          ? usuarios.find((u) => u.id_usuario === keepSelectedId) ?? null
          : null;
        this.selected.set(sel);
      },
      error: () => {
        this.actionError.set('El usuario se guardó, pero no se pudo refrescar la lista.');
      },
    });
  }
}
