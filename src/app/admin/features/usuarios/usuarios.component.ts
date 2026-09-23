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
  X, ShieldCheck, Pencil, Check, Loader2, LogIn, Power, Trash2, History,
} from 'lucide-angular';

import { UsuariosAdminService } from '../../data-access/usuarios-admin.service';
import { AuthService } from '../../../auth/data-access/auth.service';
import { diaBogota, formatearDia } from '../../../core/utils/vigencia';
import { TonoVencimiento, evaluarVencimiento } from '../../../core/utils/estado-plan';
import { PaginadorComponent, paginar } from '../../../shared/paginador/paginador.component';
import { TelefonoPaisComponent } from '../../../shared/telefono-pais/telefono-pais.component';
import { ToastService } from '../../../shared/toast/toast.service';
import {
  UsuarioAdmin, LoadingState, Plan, PlanInfo, UpdateUsuarioPerfilRequest,
  UsuarioHistorialEvento,
} from '../../models/admin.models';

/** Datos editables del perfil de un usuario dentro del modal "Editar". */
interface EditUserForm {
  id_usuario: number;
  /** Nombre completo tal como lo escribe el usuario ("Juan David"). */
  nombre: string;
  /** Apellido completo ("Vela Narvaez"). */
  apellido: string;
  num_identificacion: string;
  /** Opcional: vacío = sin correo. */
  email: string;
  /** Opcional: vacío = sin teléfono. Con indicativo (`+573001234567`). */
  telefono: string;
  /** Vacío = conservar la contraseña actual. */
  password: string;
}

/** Formato mínimo de correo; el backend hace la validación de verdad. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** ¿La descripción del rol corresponde a un administrador/dueño? */
function esRolAdministrador(descripcion: string): boolean {
  return descripcion.toUpperCase().includes('ADMINISTRADOR');
}

/** Texto de cada acción del historial, tal como se le lee al super admin. */
const HISTORIAL_TEXTO: Record<string, string> = {
  usuario_creado: 'Usuario creado',
  usuario_editado: 'Datos editados',
  usuario_inactivado: 'Usuario inactivado',
  usuario_reactivado: 'Usuario reactivado',
  usuario_eliminado: 'Usuario eliminado',
};

/** Nombre legible de cada campo que puede aparecer en `cambios` de una edición. */
const CAMPO_TEXTO: Record<string, string> = {
  nombre: 'nombre',
  apellido: 'apellido',
  identificacion: 'identificación',
  email: 'correo',
  telefono: 'teléfono',
  password: 'contraseña',
};

type PlanTone = TonoVencimiento;
type TabEstado = 'A' | 'I';

/**
 * UsuariosComponent — Vista de Super Admin con los usuarios del sistema.
 *
 * Muestra a los **administradores** de negocio (no empleados), en dos pestañas —Activos e
 * Inactivos—, con búsqueda, filtro por plan, paginación y acciones de ver detalle / editar /
 * entrar como / inactivar-reactivar / eliminar. Toda acción confirma con un toast.
 *
 * El plan se **consulta** aquí pero no se cambia: pertenece al negocio (`gener_negocio_plan`) y
 * se gestiona en Negocios → Editar. Un usuario con dos negocios tiene dos planes, y cambiarlo
 * desde la ficha del usuario hacía parecer que el plan era suyo.
 */
@Component({
  selector: 'app-usuarios',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink, PaginadorComponent, TelefonoPaisComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Search, Users, Eye, Building2, AlertCircle, ArrowRight,
        X, ShieldCheck, Pencil, Check, Loader2, LogIn, Power, Trash2, History,
      }),
    },
  ],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss',
})
export class UsuariosComponent implements OnInit {
  private readonly service = inject(UsuariosAdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly formatearDia = formatearDia;
  protected readonly diaBogota = diaBogota;

  /** id del usuario que se está impersonando (para estado de carga del botón). */
  protected readonly impersonateId = signal<number | null>(null);
  /** Usuario pendiente de confirmar para impersonar (abre el modal). */
  protected readonly confirmUser = signal<UsuarioAdmin | null>(null);
  /** Usuario pendiente de confirmar para inactivar o reactivar (abre el modal). */
  protected readonly confirmEstado = signal<UsuarioAdmin | null>(null);
  /** Usuario pendiente de confirmar para eliminar, y el nombre que se va escribiendo. */
  protected readonly confirmEliminar = signal<UsuarioAdmin | null>(null);
  protected readonly textoEliminar = signal('');

  // ── Estado ──────────────────────────────────────────────────
  protected readonly loadingState = signal<LoadingState>('idle');
  private readonly _usuarios = signal<UsuarioAdmin[]>([]);
  private readonly _planes = signal<Plan[]>([]);

  protected readonly search = signal('');
  protected readonly tab = signal<TabEstado>('A');
  protected readonly planFilter = signal<string>('ALL');

  // ── Paginación (en el cliente) ──────────────────────────────
  private readonly _pagina = signal(1);
  protected readonly tamano = signal(10);

  protected readonly selected = signal<UsuarioAdmin | null>(null);
  protected readonly actionId = signal<number | null>(null);
  protected readonly actionError = signal<string | null>(null);

  // ── Historial (auditoría) del usuario abierto en el detalle ──
  protected readonly historial = signal<UsuarioHistorialEvento[]>([]);
  protected readonly historialEstado = signal<LoadingState>('idle');

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
      f.nombre.trim().length > 0 &&
      f.apellido.trim().length > 0 &&
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

  protected readonly totalActivos = computed(
    () => this.administradores().filter((u) => u.estado === 'A').length,
  );
  protected readonly totalInactivos = computed(
    () => this.administradores().filter((u) => u.estado === 'I').length,
  );

  /** Nombres de plan disponibles para el filtro. */
  protected readonly planNombres = computed<string[]>(() =>
    [...new Set(this._planes().map((p) => p.nombre))],
  );

  /** Administradores de la pestaña actual tras búsqueda + filtro de plan. */
  protected readonly filtered = computed<UsuarioAdmin[]>(() => {
    const term = this.search().trim().toLowerCase();
    const estado = this.tab();
    const plan = this.planFilter();

    return this.administradores().filter((u) => {
      if (u.estado !== estado) return false;

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

  /**
   * Página efectiva: si al eliminar o inactivar la última fila de la última página esta deja de
   * existir, se baja a la anterior en vez de mostrar una tabla vacía con filas pendientes.
   */
  protected readonly pagina = computed(() => {
    const ultima = Math.max(1, Math.ceil(this.filtered().length / this.tamano()));
    return Math.min(this._pagina(), ultima);
  });

  protected readonly pageRows = computed<UsuarioAdmin[]>(() =>
    paginar(this.filtered(), this.pagina(), this.tamano()),
  );

  // ── Lifecycle ───────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
  }

  // ── Filtros (cualquier cambio vuelve a la página 1) ─────────
  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this._pagina.set(1);
  }

  protected onTab(tab: TabEstado): void {
    this.tab.set(tab);
    this._pagina.set(1);
  }

  protected onPlanFilter(event: Event): void {
    this.planFilter.set((event.target as HTMLSelectElement).value);
    this._pagina.set(1);
  }

  protected irAPagina(p: number): void {
    this._pagina.set(p);
  }

  protected cambiarTamano(t: number): void {
    this.tamano.set(t);
    this._pagina.set(1);
  }

  // ── Inactivar / reactivar (con confirmación) ────────────────

  /** Abre la confirmación. Inactivar deja al usuario fuera del sistema: nunca va directo. */
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

    const nuevo: TabEstado = u.estado === 'A' ? 'I' : 'A';
    this.actionId.set(u.id_usuario);
    this.actionError.set(null);

    this.service.setEstado(u.id_usuario, nuevo).subscribe({
      next: () => {
        this._usuarios.update((list) =>
          list.map((x) => (x.id_usuario === u.id_usuario ? { ...x, estado: nuevo } : x)),
        );
        if (this.selected()?.id_usuario === u.id_usuario) {
          this.selected.update((s) => (s ? { ...s, estado: nuevo } : s));
          this.cargarHistorial(u.id_usuario);
        }
        this.actionId.set(null);
        this.confirmEstado.set(null);
        this.toast.exito(
          nuevo === 'I'
            ? `${u.nombre_completo} fue inactivado. Lo encuentras en la pestaña Inactivos.`
            : `${u.nombre_completo} fue reactivado. Ya aparece en la pestaña Activos.`,
        );
      },
      error: (err) => {
        this.actionError.set(
          err.error?.message
            ?? (nuevo === 'I'
              ? 'No se pudo inactivar al usuario.'
              : 'No se pudo reactivar al usuario.'),
        );
        this.toast.errorHttp(
          err,
          nuevo === 'I' ? 'No se pudo inactivar al usuario.' : 'No se pudo reactivar al usuario.',
        );
        this.actionId.set(null);
        this.confirmEstado.set(null);
      },
    });
  }

  // ── Eliminar (con confirmación escrita) ─────────────────────
  //
  // Inactivar es reversible de un clic; esto no. El usuario desaparece de toda la plataforma y
  // su correo queda libre, así que se pide escribir el nombre: es lo que evita que alguien
  // elimine a otro por pulsar el botón de al lado.

  protected pedirEliminar(u: UsuarioAdmin): void {
    if (u.es_admin_principal || this.actionId() !== null) return;
    this.textoEliminar.set('');
    this.confirmEliminar.set(u);
  }

  protected cancelarEliminar(): void {
    if (this.actionId() !== null) return;
    this.confirmEliminar.set(null);
    this.textoEliminar.set('');
  }

  /** El nombre escrito tiene que coincidir. Se compara sin tildes ni mayúsculas: se está
   *  pidiendo intención, no puntería mecanografiando. */
  protected puedeEliminar(): boolean {
    const u = this.confirmEliminar();
    if (!u) return false;
    const normal = (t: string) =>
      t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
    return normal(this.textoEliminar()) === normal(u.nombre_completo ?? '');
  }

  protected confirmarEliminar(): void {
    const u = this.confirmEliminar();
    if (!u || this.actionId() !== null || !this.puedeEliminar()) return;

    this.actionId.set(u.id_usuario);
    this.actionError.set(null);

    this.service.eliminarUsuario(u.id_usuario).subscribe({
      next: () => {
        // Fuera de la lista sin recargar: eliminar significa que no se ve en ninguna parte.
        this._usuarios.update((list) => list.filter((x) => x.id_usuario !== u.id_usuario));
        if (this.selected()?.id_usuario === u.id_usuario) this.cerrarDetalle();
        this.actionId.set(null);
        this.confirmEliminar.set(null);
        this.textoEliminar.set('');
        this.toast.exito(`${u.nombre_completo} fue eliminado.`);
      },
      error: (err) => {
        this.actionError.set(err.error?.message ?? 'No se pudo eliminar el usuario.');
        this.toast.errorHttp(err, 'No se pudo eliminar el usuario.');
        this.actionId.set(null);
        this.confirmEliminar.set(null);
      },
    });
  }

  // ── Modal: detalles ─────────────────────────────────────────
  protected openDetails(u: UsuarioAdmin): void {
    this.selected.set(u);
    this.cargarHistorial(u.id_usuario);
  }

  protected closeDetails(): void {
    this.cerrarDetalle();
  }

  private cerrarDetalle(): void {
    this.selected.set(null);
    this.historial.set([]);
    this.historialEstado.set('idle');
  }

  /** Línea de tiempo del usuario. Si falla no estorba al resto del detalle: solo se avisa ahí. */
  private cargarHistorial(idUsuario: number): void {
    this.historialEstado.set('loading');
    this.service.getHistorial(idUsuario).subscribe({
      next: (eventos) => {
        // El detalle pudo cerrarse o cambiar de usuario mientras la respuesta venía.
        if (this.selected()?.id_usuario !== idUsuario) return;
        this.historial.set(eventos);
        this.historialEstado.set('success');
      },
      error: () => {
        if (this.selected()?.id_usuario !== idUsuario) return;
        this.historial.set([]);
        this.historialEstado.set('error');
      },
    });
  }

  protected historialTexto(e: UsuarioHistorialEvento): string {
    const base = HISTORIAL_TEXTO[e.accion] ?? e.accion;
    if (e.accion !== 'usuario_editado' || !e.cambios?.length) return base;
    return `${base}: ${e.cambios.map((c) => CAMPO_TEXTO[c] ?? c).join(', ')}`;
  }

  /** Fecha y hora en Bogotá, que es la hora con la que trabaja el resto del sistema. */
  protected historialFecha(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
    });
  }

  // ── Modal: editar usuario ───────────────────────────────────
  protected openEdit(u: UsuarioAdmin): void {
    // La base tiene primer/segundo nombre y apellido; aquí se edita el nombre completo en un
    // solo campo, así que se juntan al abrir.
    const unir = (a: string | null, b: string | null) =>
      [a, b].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');

    this.editForm.set({
      id_usuario: u.id_usuario,
      nombre: unir(u.primer_nombre, u.segundo_nombre),
      apellido: unir(u.primer_apellido, u.segundo_apellido),
      num_identificacion: u.num_identificacion ?? '',
      email: u.email ?? '',
      telefono: u.telefono ?? '',
      password: '',
    });
    this.editError.set(null);
  }

  protected updateEdit(field: keyof EditUserForm, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.editForm.update((f) => (f ? { ...f, [field]: value } : f));
  }

  protected updateTelefono(valor: string): void {
    this.editForm.update((f) => (f ? { ...f, telefono: valor } : f));
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

    // El nombre completo va entero en primer_nombre y el apellido entero en primer_apellido;
    // los segundos quedan en null (así no se adivina dónde termina uno y empieza el otro).
    const payload: UpdateUsuarioPerfilRequest = {
      primer_nombre: f.nombre.trim().replace(/\s+/g, ' '),
      segundo_nombre: null,
      primer_apellido: f.apellido.trim().replace(/\s+/g, ' '),
      segundo_apellido: null,
      num_identificacion: f.num_identificacion.trim(),
      email: f.email.trim() || null,
      telefono: f.telefono.trim() || null,
      ...(f.password ? { password: f.password } : {}),
    };

    this.service.updatePerfil(f.id_usuario, payload).subscribe({
      next: () => {
        this.editSaving.set(false);
        this.closeEdit();
        this.toast.exito('Los datos del usuario se guardaron.');
        this.refreshUsuarios(this.selected()?.id_usuario);
      },
      error: (err) => {
        this.editSaving.set(false);
        this.editError.set(err.error?.message ?? 'No se pudo actualizar el usuario.');
        this.toast.errorHttp(err, 'No se pudo actualizar el usuario.');
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
        this.toast.exito(`Entraste como ${u.nombre_completo}.`);
      },
      error: (err) => {
        this.actionError.set(err.error?.message ?? 'No se pudo iniciar la impersonación.');
        this.toast.errorHttp(err, 'No se pudo iniciar la impersonación.');
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
        if (sel) this.cargarHistorial(sel.id_usuario);
      },
      error: () => {
        this.actionError.set('El usuario se guardó, pero no se pudo refrescar la lista.');
        this.toast.aviso('El usuario se guardó, pero no se pudo refrescar la lista.');
      },
    });
  }
}
