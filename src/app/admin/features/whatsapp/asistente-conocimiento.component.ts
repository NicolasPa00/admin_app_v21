import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { Check, Loader2, Pencil, Plus, Trash2, X } from '../../../core/icons/phosphor';

import { AsistenteEscalappService } from '../../data-access/asistente-escalapp.service';
import {
  DatosConocimiento,
  EntradaConocimiento,
  TipoConocimiento,
} from '../../models/asistente-escalapp.models';
import { ToastService } from '../../../shared/toast/toast.service';

const MAX_CONTENIDO = 2000;

const TIPOS: readonly { valor: TipoConocimiento; etiqueta: string; ayuda: string }[] = [
  { valor: 'servicio', etiqueta: 'Servicio', ayuda: 'Algo que ofrecemos además del software' },
  { valor: 'promocion', etiqueta: 'Promoción', ayuda: 'Con fecha de fin: vencida, el asistente deja de decirla' },
  { valor: 'pregunta', etiqueta: 'Pregunta frecuente', ayuda: 'Una pregunta con su respuesta' },
  { valor: 'dato', etiqueta: 'Dato', ayuda: 'Cualquier otra cosa que el asistente deba saber' },
];

function vacia(): DatosConocimiento {
  return {
    tipo: 'servicio',
    titulo: '',
    contenido: '',
    palabras_clave: '',
    vigente_hasta: null,
    activo: true,
    orden: 0,
  };
}

/**
 * Lo que el asistente comercial sabe y no está en ninguna otra tabla.
 *
 * Es la v1 de Knowledge (ADR-020): entradas escritas y aprobadas por el equipo, que el asistente
 * consulta con `consultar_informacion` cuando la pregunta lo pide. **Guardar es publicar**: no hay
 * borrador ni caché, el siguiente mensaje ya la lee. Por eso «Activa» existe —para preparar una
 * entrada sin que el asistente la diga todavía— y una promoción exige fecha de fin.
 */
@Component({
  selector: 'app-asistente-conocimiento',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgTemplateOutlet, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Check, Loader2, Pencil, Plus, Trash2, X }),
    },
  ],
  templateUrl: './asistente-conocimiento.component.html',
  styleUrl: './asistente-conocimiento.component.scss',
})
export class AsistenteConocimientoComponent implements OnInit {
  private readonly api = inject(AsistenteEscalappService);
  private readonly toast = inject(ToastService);

  /** Se creó, editó o borró algo: la cabecera del panel recuenta. */
  readonly cambio = output<void>();

  protected readonly TIPOS = TIPOS;
  protected readonly MAX_CONTENIDO = MAX_CONTENIDO;

  private readonly _entradas = signal<EntradaConocimiento[]>([]);
  readonly entradas = this._entradas.asReadonly();
  readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');

  /** `null` = sin formulario; `0` = entrada nueva; otro = la que se edita. */
  readonly editando = signal<number | null>(null);
  readonly borrador = signal<DatosConocimiento>(vacia());
  readonly guardando = signal(false);
  readonly confirmandoBorrar = signal<number | null>(null);

  readonly etiquetaTipo = (tipo: TipoConocimiento) => TIPOS.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
  readonly ayudaTipo = computed(() => TIPOS.find((t) => t.valor === this.borrador().tipo)?.ayuda ?? '');

  readonly faltaFecha = computed(
    () => this.borrador().tipo === 'promocion' && !this.borrador().vigente_hasta,
  );
  readonly valido = computed(() => {
    const b = this.borrador();
    return (
      b.titulo.trim().length > 0 &&
      b.contenido.trim().length > 0 &&
      b.contenido.length <= MAX_CONTENIDO &&
      !this.faltaFecha()
    );
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    // Solo la primera vez se enseña «cargando»: al recargar tras guardar, la lista sigue a la vista.
    if (this._entradas().length === 0) this.estado.set('cargando');
    this.api.getConocimiento().subscribe({
      next: (lista) => {
        this._entradas.set(lista);
        this.estado.set('listo');
      },
      error: () => {
        if (this._entradas().length === 0) this.estado.set('error');
      },
    });
  }

  nueva(): void {
    this.borrador.set(vacia());
    this.editando.set(0);
  }

  editar(e: EntradaConocimiento): void {
    this.borrador.set({
      tipo: e.tipo,
      titulo: e.titulo,
      contenido: e.contenido,
      palabras_clave: e.palabras_clave ?? '',
      vigente_hasta: e.vigente_hasta,
      activo: e.activo,
      orden: e.orden,
    });
    this.editando.set(e.id_conocimiento);
    this.confirmandoBorrar.set(null);
  }

  cancelar(): void {
    this.editando.set(null);
  }

  campo<K extends keyof DatosConocimiento>(clave: K, valor: DatosConocimiento[K]): void {
    this.borrador.update((b) => ({ ...b, [clave]: valor }));
  }

  guardar(): void {
    const id = this.editando();
    if (id === null || !this.valido() || this.guardando()) return;
    const b = this.borrador();
    const datos: DatosConocimiento = {
      ...b,
      titulo: b.titulo.trim(),
      contenido: b.contenido.trim(),
      palabras_clave: b.palabras_clave?.trim() || null,
      vigente_hasta: b.vigente_hasta || null,
      orden: Number(b.orden) || 0,
    };
    this.guardando.set(true);
    const peticion = id === 0 ? this.api.crear(datos) : this.api.actualizar(id, datos);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(null);
        this.toast.exito(
          datos.activo
            ? 'Guardado. El asistente ya puede usarlo en sus respuestas.'
            : 'Guardado como inactivo: el asistente no lo dirá hasta que lo actives.',
        );
        this.cargar();
        this.cambio.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.toast.errorHttp(err, 'No se pudo guardar la entrada.');
      },
    });
  }

  /** Activar o desactivar sin abrir el formulario: es lo que más se hace con una promoción. */
  alternarActiva(e: EntradaConocimiento): void {
    const datos: DatosConocimiento = {
      tipo: e.tipo,
      titulo: e.titulo,
      contenido: e.contenido,
      palabras_clave: e.palabras_clave,
      vigente_hasta: e.vigente_hasta,
      activo: !e.activo,
      orden: e.orden,
    };
    this._entradas.update((l) =>
      l.map((x) => (x.id_conocimiento === e.id_conocimiento ? { ...x, activo: !e.activo } : x)),
    );
    this.api.actualizar(e.id_conocimiento, datos).subscribe({
      next: () => this.cambio.emit(),
      error: (err) => {
        // Se deshace lo pintado: la base no cambió.
        this._entradas.update((l) =>
          l.map((x) => (x.id_conocimiento === e.id_conocimiento ? { ...x, activo: e.activo } : x)),
        );
        this.toast.errorHttp(err, 'No se pudo cambiar la entrada.');
      },
    });
  }

  borrar(e: EntradaConocimiento): void {
    this.api.eliminar(e.id_conocimiento).subscribe({
      next: () => {
        this.confirmandoBorrar.set(null);
        if (this.editando() === e.id_conocimiento) this.editando.set(null);
        this._entradas.update((l) => l.filter((x) => x.id_conocimiento !== e.id_conocimiento));
        this.toast.exito('Entrada eliminada.');
        this.cambio.emit();
      },
      error: (err) => this.toast.errorHttp(err, 'No se pudo eliminar la entrada.'),
    });
  }
}
