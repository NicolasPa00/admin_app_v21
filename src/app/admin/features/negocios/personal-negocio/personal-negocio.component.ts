import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  UserRound, X, Pencil, Power, Loader2, AlertCircle, Check, ShieldCheck,
} from 'lucide-angular';

import { UsuariosAdminService } from '../../../data-access/usuarios-admin.service';
import { ModalCabeceraComponent } from '../../../../shared/modal-cabecera/modal-cabecera.component';
import { LoadingState, UsuarioAdmin, UpdateUsuarioPerfilRequest, CupoUsuarios } from '../../../models/admin.models';
import { NegociosAdminService } from '../../../data-access/negocios-admin.service';

/** Lo editable de una persona desde aquí. Roles y contraseña siguen viviendo en Usuarios. */
interface FormPerfil {
  id_usuario: number;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  num_identificacion: string;
  email: string;
}

/**
 * PersonalNegocioComponent — el personal adscrito a un negocio, en un modal.
 *
 * Vive aparte de `negocios.component` a propósito: ese archivo ya pasa de las 600 líneas y mezcla
 * el listado, el alta de clientes y la vigencia del plan. Aquí solo se lee `GET /usuarios/admin`
 * con `id_negocio`, que devuelve **los roles que cada persona tiene EN ese negocio** — no todos.
 *
 * ## Qué se puede hacer y qué no
 *
 * Se puede corregir la ficha (nombre, identificación, correo) e inhabilitar o reactivar a alguien.
 * **No** se cambian roles ni contraseñas: eso es Usuarios, donde se ve a la persona completa, con
 * todos sus negocios. Inhabilitar desde aquí suspende al usuario en TODO el sistema, no solo en
 * este negocio, y por eso el modal lo advierte antes de hacerlo.
 */
@Component({
  selector: 'app-personal-negocio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ModalCabeceraComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        UserRound, X, Pencil, Power, Loader2, AlertCircle, Check, ShieldCheck,
      }),
    },
  ],
  templateUrl: './personal-negocio.component.html',
  styleUrl: './personal-negocio.component.scss',
})
export class PersonalNegocioComponent implements OnInit {
  private readonly service = inject(UsuariosAdminService);
  private readonly negocios = inject(NegociosAdminService);

  readonly idNegocio = input.required<number>();
  readonly nombreNegocio = input<string>('');
  readonly cerrar = output<void>();

  protected readonly estado = signal<LoadingState>('loading');
  protected readonly personal = signal<UsuarioAdmin[]>([]);
  /** «X de Y usuarios» del plan; `null` mientras carga o si no se pudo consultar. */
  protected readonly cupo = signal<CupoUsuarios | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  /** Persona sobre la que se está actuando (bloquea solo su fila). */
  protected readonly ocupado = signal<number | null>(null);

  /** Persona a la que se le va a cambiar el estado: pide confirmación antes. */
  protected readonly porCambiarEstado = signal<UsuarioAdmin | null>(null);

  /** Ficha en edición, o null. */
  protected readonly form = signal<FormPerfil | null>(null);
  protected readonly guardando = signal(false);

  protected readonly activos = computed(() => this.personal().filter((u) => u.estado === 'A').length);

  /** Bajo el título: a qué negocio pertenece la lista y cuántas personas hay. */
  protected readonly subtitulo = computed(() => {
    const n = this.personal().length;
    const a = this.activos();
    const cuenta = this.estado() === 'success'
      ? ` · ${n} ${n === 1 ? 'persona' : 'personas'}, ${a} ${a === 1 ? 'activa' : 'activas'}`
      : '';
    return `${this.nombreNegocio()}${cuenta}`;
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set('loading');
    this.error.set(null);

    // El cupo no bloquea la lista: si falla, simplemente no se enseña.
    this.negocios.getCupoUsuarios(this.idNegocio()).subscribe({
      next: (c) => this.cupo.set(c),
      error: () => this.cupo.set(null),
    });

    this.service.getUsuarios({ id_negocio: this.idNegocio(), estado: 'ALL' }).subscribe({
      next: (personal) => {
        this.personal.set(personal);
        this.estado.set('success');
      },
      error: (err) => {
        this.error.set(this.mensaje(err, 'No pudimos cargar el personal de este negocio.'));
        this.estado.set('error');
      },
    });
  }

  /** El rol que tiene EN este negocio. El backend ya filtró por `id_negocio`. */
  protected rolEnNegocio(u: UsuarioAdmin): string {
    const propio = u.roles?.find((r) => r.id_negocio === this.idNegocio());
    return propio?.descripcion ?? u.rol_principal?.descripcion ?? 'Sin rol';
  }

  // ── Inhabilitar / reactivar ─────────────────────────────────
  protected pedirCambioEstado(u: UsuarioAdmin): void {
    this.porCambiarEstado.set(u);
    this.error.set(null);
  }

  protected cancelarCambioEstado(): void {
    this.porCambiarEstado.set(null);
  }

  protected confirmarCambioEstado(): void {
    const u = this.porCambiarEstado();
    if (!u) return;

    const nuevo = u.estado === 'A' ? 'I' : 'A';
    this.ocupado.set(u.id_usuario);
    this.porCambiarEstado.set(null);

    this.service.setEstado(u.id_usuario, nuevo).subscribe({
      next: () => {
        this.ocupado.set(null);
        this.aviso.set(
          nuevo === 'I'
            ? `${u.nombre_completo} quedó inhabilitado y no podrá iniciar sesión.`
            : `${u.nombre_completo} quedó habilitado de nuevo.`,
        );
        this.cargar();
      },
      error: (err) => {
        this.ocupado.set(null);
        this.error.set(this.mensaje(err, 'No se pudo cambiar el estado de esta persona.'));
      },
    });
  }

  // ── Editar ficha ────────────────────────────────────────────
  protected editar(u: UsuarioAdmin): void {
    this.aviso.set(null);
    this.error.set(null);
    this.form.set({
      id_usuario: u.id_usuario,
      primer_nombre: u.primer_nombre ?? '',
      segundo_nombre: u.segundo_nombre ?? '',
      primer_apellido: u.primer_apellido ?? '',
      segundo_apellido: u.segundo_apellido ?? '',
      num_identificacion: u.num_identificacion ?? '',
      email: u.email ?? '',
    });
  }

  protected cambiar(campo: keyof FormPerfil, evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.form.update((f) => (f ? { ...f, [campo]: valor } : f));
  }

  protected cancelarEdicion(): void {
    this.form.set(null);
  }

  protected guardar(): void {
    const f = this.form();
    if (!f) return;

    if (!f.primer_nombre.trim() || !f.primer_apellido.trim() || !f.num_identificacion.trim()) {
      this.error.set('El nombre, el apellido y la identificación son obligatorios.');
      return;
    }

    // El correo es opcional desde 2026-09-09: hay empleados que no tienen, y el login va por
    // identificación. Vacío se manda como null, no como cadena vacía (la columna es única).
    const payload: UpdateUsuarioPerfilRequest = {
      primer_nombre: f.primer_nombre.trim(),
      segundo_nombre: f.segundo_nombre.trim() || null,
      primer_apellido: f.primer_apellido.trim(),
      segundo_apellido: f.segundo_apellido.trim() || null,
      num_identificacion: f.num_identificacion.trim(),
      email: f.email.trim() || null,
    };

    this.guardando.set(true);
    this.error.set(null);

    this.service.updatePerfil(f.id_usuario, payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.form.set(null);
        this.aviso.set('Ficha actualizada.');
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(this.mensaje(err, 'No se pudo guardar la ficha.'));
      },
    });
  }

  private mensaje(err: unknown, porDefecto: string): string {
    return (err as { error?: { message?: string } })?.error?.message || porDefecto;
  }
}
