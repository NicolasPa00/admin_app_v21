import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  AlertCircle,
  Check,
  KeyRound,
  Loader2,
  Plug,
  RefreshCw,
  Save,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-angular';

import { FacturacionService } from '../../../data-access/facturacion.service';
import {
  AmbienteFe,
  EstadoFe,
  FeConfiguracion,
  FeCredenciales,
  FePrueba,
  FeRango,
  FeRangoDian,
  FeVista,
  ImpuestoCatalogo,
  MotivoNoFactura,
  TipoRangoFe,
} from '../../../models/facturacion.models';

const CREDENCIALES_VACIAS: FeCredenciales = {
  client_id: '',
  client_secret: '',
  username: '',
  password: '',
};

/** Por qué no factura todavía, dicho para una persona. */
const MOTIVOS: Record<Exclude<MotivoNoFactura, null>, string> = {
  SIN_FEATURE: 'El plan del negocio no incluye la facturación electrónica.',
  MODO_NINGUNO: 'El negocio no ha activado la facturación en sus datos fiscales.',
  DATOS_INCOMPLETOS: 'A la ficha fiscal del negocio le faltan datos.',
  NO_ACTIVO: 'La emisión no está en pruebas ni activa.',
};

/**
 * Emisión de facturación electrónica de UN negocio (FE-2). **Solo la ve el super admin**: quien
 * decide si se pinta es la pantalla que la contiene, y el backend responde 403 a cualquier otro.
 *
 * Es el alta de un cliente, en el orden en que ocurre en la vida real:
 *   1. Pegar las credenciales que entregó el proveedor para ESE negocio.
 *   2. Probar la conexión — y comprobar que la empresa es la del negocio, no otra.
 *   3. Crear el rango de numeración en el proveedor: no lo toma solo de la DIAN.
 *   4. Elegir con qué rango se factura y con cuál se anula (notas crédito).
 *   5. Pasar a pruebas, y después activar.
 *
 * Las credenciales se escriben y se envían; nunca se vuelven a mostrar. Lo único que el servidor
 * devuelve es si las tiene.
 */
@Component({
  selector: 'app-fe-operacion',
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './fe-operacion.component.html',
  styleUrl: './fe-operacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        AlertCircle,
        Check,
        KeyRound,
        Loader2,
        Plug,
        RefreshCw,
        Save,
        ShieldCheck,
        TriangleAlert,
      }),
    },
  ],
})
export class FeOperacionComponent {
  private readonly api = inject(FacturacionService);

  readonly idNegocio = input.required<number>();
  /** El catálogo de impuestos ya lo cargó la pantalla que la contiene. */
  readonly impuestos = input<ImpuestoCatalogo[]>([]);

  readonly cargando = signal(true);
  /** Qué acción está en curso, para deshabilitar solo lo que toca. */
  readonly ocupado = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly vista = signal<FeVista | null>(null);
  readonly prueba = signal<FePrueba | null>(null);
  readonly dian = signal<FeRangoDian[] | null>(null);

  readonly credenciales = signal<FeCredenciales>({ ...CREDENCIALES_VACIAS });
  readonly ambiente = signal<AmbienteFe>('PRUEBAS');
  readonly nuevoRango = signal<{ tipo: TipoRangoFe; prefijo: string; resolucion: string; actual: string }>({
    tipo: 'FV',
    prefijo: '',
    resolucion: '',
    actual: '',
  });
  /** El cambio de estado que espera confirmación (dos pasos: no se activa con un clic suelto). */
  readonly porConfirmar = signal<EstadoFe | null>(null);

  readonly config = computed(() => this.vista()?.config ?? null);
  readonly estado = computed<EstadoFe>(() => this.config()?.estado ?? 'SIN_CONFIGURAR');
  readonly rangos = computed(() => this.vista()?.rangos ?? []);
  readonly motivo = computed(() => {
    const m = this.vista()?.debe_facturar.motivo;
    return m ? MOTIVOS[m] : null;
  });
  readonly faltan = computed(() => this.vista()?.puede_emitir.faltan ?? []);
  readonly credencialesCompletas = computed(() =>
    Object.values(this.credenciales()).every((v) => v.trim().length > 0),
  );
  readonly rangoValido = computed(() => {
    const r = this.nuevoRango();
    const inicio = Number(r.actual);
    return (
      r.prefijo.trim().length > 0 &&
      Number.isInteger(inicio) &&
      inicio > 0 &&
      (r.tipo === 'NC' || r.resolucion.trim().length >= 5)
    );
  });
  readonly impuestoDefecto = computed(() => this.claveImpuesto('defecto'));
  readonly impuestoDomicilio = computed(() => this.claveImpuesto('domicilio'));

  constructor() {
    // Cambiar de negocio en el selector de arriba recarga todo y olvida lo escrito: unas
    // credenciales a medio pegar no pueden acabar guardadas en el negocio de al lado.
    effect(() => {
      const id = this.idNegocio();
      untracked(() => this.cargar(id));
    });
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.vista.set(null);
    this.prueba.set(null);
    this.dian.set(null);
    this.porConfirmar.set(null);
    this.credenciales.set({ ...CREDENCIALES_VACIAS });
    this.api.getEmision(id).subscribe({
      next: (v) => {
        if (id !== this.idNegocio()) return; // llegó tarde: ya se cambió de negocio
        this.aplicar(v);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(this.mensaje(e));
        this.cargando.set(false);
      },
    });
  }

  private aplicar(v: FeVista): void {
    this.vista.set(v);
    this.ambiente.set(v.config?.ambiente ?? 'PRUEBAS');
  }

  /** Ejecuta una acción con su indicador, su aviso de éxito y su error legible. */
  private ejecutar<T>(clave: string, llamada: Observable<T>, alTerminar: (r: T) => string | null): void {
    this.ocupado.set(clave);
    this.error.set(null);
    this.aviso.set(null);
    llamada.subscribe({
      next: (r) => {
        this.aviso.set(alTerminar(r));
        this.ocupado.set(null);
      },
      error: (e) => {
        this.error.set(this.mensaje(e));
        this.ocupado.set(null);
      },
    });
  }

  private mensaje(e: unknown): string {
    const cuerpo = (e as HttpErrorResponse)?.error;
    const detalle = Array.isArray(cuerpo?.errors) ? cuerpo.errors.map((x: { msg?: string }) => x.msg).filter(Boolean) : [];
    return detalle.length ? detalle.join(' · ') : cuerpo?.message || 'No se pudo completar la acción.';
  }

  private claveImpuesto(cual: 'defecto' | 'domicilio'): string {
    const c = this.config();
    const codigo = c?.[`impuesto_${cual}_codigo`] ?? 'ZZ';
    const tarifa = Number(c?.[`impuesto_${cual}_tarifa`] ?? 0);
    return `${codigo}|${tarifa}`;
  }

  claveDe(i: ImpuestoCatalogo): string {
    return `${i.codigo}|${Number(i.tarifa)}`;
  }

  etiquetaDe(i: ImpuestoCatalogo): string {
    return i.codigo === 'ZZ' ? 'Sin impuesto' : `${i.nombre} ${Number(i.tarifa)}%`;
  }

  credencial(campo: keyof FeCredenciales, valor: string): void {
    this.credenciales.update((c) => ({ ...c, [campo]: valor }));
  }

  rango(campo: 'tipo' | 'prefijo' | 'resolucion' | 'actual', valor: string): void {
    this.nuevoRango.update((r) => ({ ...r, [campo]: valor }));
  }

  guardarCredenciales(): void {
    const credenciales = this.credenciales();
    this.ejecutar(
      'credenciales',
      this.api.guardarEmision(this.idNegocio(), { credenciales, ambiente: this.ambiente() }),
      (v) => {
        this.aplicar(v);
        // Se borran de la pantalla en cuanto llegan al servidor: aquí no se quedan.
        this.credenciales.set({ ...CREDENCIALES_VACIAS });
        this.prueba.set(null);
        return 'Credenciales guardadas. Prueba la conexión antes de seguir.';
      },
    );
  }

  cambiarAmbiente(ambiente: AmbienteFe): void {
    this.ambiente.set(ambiente);
    if (!this.config()) return; // todavía no hay nada guardado: irá con las credenciales
    this.ejecutar('ambiente', this.api.guardarEmision(this.idNegocio(), { ambiente }), (v) => {
      this.aplicar(v);
      this.prueba.set(null);
      return `Ambiente cambiado a ${ambiente === 'PRODUCCION' ? 'producción' : 'pruebas'}.`;
    });
  }

  probar(): void {
    this.ejecutar('probar', this.api.probarConexion(this.idNegocio()), (p) => {
      this.prueba.set(p);
      return null;
    });
  }

  sincronizar(): void {
    this.ejecutar('sincronizar', this.api.sincronizarRangos(this.idNegocio()), (rangos) => {
      this.ponerRangos(rangos);
      return `Rangos sincronizados: ${rangos.length}.`;
    });
  }

  verDian(): void {
    this.ejecutar('dian', this.api.rangosDian(this.idNegocio()), (rangos) => {
      this.dian.set(rangos);
      return null;
    });
  }

  /** Rellena el formulario con un prefijo que la DIAN ya tiene asociado. */
  tomarDeDian(r: FeRangoDian): void {
    this.nuevoRango.set({
      tipo: 'FV',
      prefijo: r.prefijo ?? '',
      resolucion: r.resolucion ?? '',
      actual: r.desde != null ? String(r.desde) : '',
    });
  }

  crearRango(): void {
    const r = this.nuevoRango();
    this.ejecutar(
      'crear-rango',
      this.api.crearRango(this.idNegocio(), {
        tipo_documento: r.tipo,
        prefijo: r.prefijo.trim().toUpperCase(),
        actual: Number(r.actual),
        resolucion: r.tipo === 'FV' ? r.resolucion.trim() : null,
      }),
      (rangos) => {
        this.ponerRangos(rangos);
        this.nuevoRango.set({ tipo: 'FV', prefijo: '', resolucion: '', actual: '' });
        return 'Rango creado en el proveedor. Elige «Usar» para facturar con él.';
      },
    );
  }

  usar(r: FeRango): void {
    this.ejecutar(`usar-${r.id_resolucion}`, this.api.usarRango(this.idNegocio(), r.id_resolucion), (rangos) => {
      this.ponerRangos(rangos);
      return `Se usará ${r.prefijo ?? 'el rango'} para ${r.tipo_documento === 'NC' ? 'las notas crédito' : 'las facturas'}.`;
    });
  }

  private ponerRangos(rangos: FeRango[]): void {
    this.vista.update((v) => (v ? { ...v, rangos } : v));
  }

  guardarImpuesto(cual: 'defecto' | 'domicilio', clave: string): void {
    const [codigo, tarifa] = clave.split('|');
    this.ejecutar(
      `impuesto-${cual}`,
      this.api.guardarEmision(this.idNegocio(), {
        [`impuesto_${cual}_codigo`]: codigo,
        [`impuesto_${cual}_tarifa`]: Number(tarifa),
      } as Partial<FeConfiguracion>),
      (v) => {
        this.aplicar(v);
        return 'Impuesto guardado.';
      },
    );
  }

  guardarCorreo(enviar: boolean): void {
    this.ejecutar('correo', this.api.guardarEmision(this.idNegocio(), { enviar_correo: enviar }), (v) => {
      this.aplicar(v);
      return enviar ? 'El proveedor enviará la factura por correo al comprador.' : 'No se enviará correo al comprador.';
    });
  }

  confirmarEstado(): void {
    const estado = this.porConfirmar();
    if (!estado) return;
    this.porConfirmar.set(null);
    this.ejecutar('estado', this.api.cambiarEstadoEmision(this.idNegocio(), estado), (v) => {
      this.aplicar(v);
      return estado === 'SUSPENDIDO' ? 'Emisión suspendida: los cobros siguen, sin factura.' : 'Estado actualizado.';
    });
  }

  textoEstado(e: EstadoFe): string {
    return { SIN_CONFIGURAR: 'Sin configurar', EN_PRUEBAS: 'En pruebas', ACTIVO: 'Activo', SUSPENDIDO: 'Suspendido' }[e];
  }

  textoConfirmar(e: EstadoFe): string {
    if (e === 'ACTIVO') {
      return this.ambiente() === 'PRODUCCION'
        ? 'Desde este momento cada cobro de este negocio emite una factura REAL ante la DIAN.'
        : 'Cada cobro de este negocio emitirá una factura en el ambiente de pruebas.';
    }
    if (e === 'EN_PRUEBAS') return 'Cada cobro de este negocio intentará emitir una factura con esta configuración.';
    return 'El negocio dejará de emitir. Los cobros siguen funcionando igual.';
  }
}
