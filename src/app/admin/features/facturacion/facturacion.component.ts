import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  AlertCircle,
  Building2,
  Check,
  CircleCheck,
  FileText,
  Info,
  Loader2,
  Save,
  Store,
  TriangleAlert,
} from 'lucide-angular';

import { AdminService } from '../../data-access/admin.service';
import { FacturacionService } from '../../data-access/facturacion.service';
import { Negocio } from '../../models/admin.models';
import {
  CatalogosFiscales,
  Declaracion,
  EstadoEmision,
  EstadoRegistro,
  FichaFiscal,
  ModoFacturacion,
  TipoPersona,
} from '../../models/facturacion.models';

/**
 * FacturacionComponent — los datos fiscales del negocio (FE-1).
 *
 * ## Lo que esta pantalla NO hace, y es lo más importante de ella
 *
 * **No abre con un formulario.** Abre con una sola pregunta: *«¿tu negocio está registrado en
 * Cámara de Comercio y tiene RUT?»*. Buena parte de los clientes de EscalApp son negocios
 * informales, y ayudarlos a crecer es parte de por qué existe el producto. Si al entrar aquí se
 * encontraran veinte campos pidiendo códigos de responsabilidad fiscal, la lectura sería «esto
 * no es para mí» — y el cliente pequeño de hoy es el grande de dentro de dos años.
 *
 * De ahí los tres caminos, que salen de `estado_registro`:
 *
 *   NO_DECLARADO → se le pregunta
 *   SIN_REGISTRO → **se le deja en paz**, con un mensaje amable y ni un campo más
 *   REGISTRADO   → ahora sí, el formulario
 *
 * La diferencia entre los dos primeros parece un matiz y es justo lo contrario: si se pierde,
 * la pantalla acaba dándole la lata para siempre a alguien que **ya contestó**.
 *
 * ## Por qué la lista de «lo que falta» no está aquí
 *
 * Viene del backend, en `estado.faltan`, ya redactada en español. La tentación era escribirla en
 * el frontend —es una lista de campos obligatorios, parece cosa de formulario— pero lo que la
 * DIAN exige cambia, y con la lista duplicada cambiaría en dos sitios y se olvidaría uno.
 * Aquí solo se pinta.
 *
 * ## El dígito de verificación se calcula solo, y eso no es adivinar
 *
 * Si se escribe el NIT sin DV, el backend lo calcula: el DV es una función del número. Lo que
 * **no** se adivina es dónde termina el NIT cuando llega todo pegado. Y si se escribe un DV que
 * no corresponde, se rechaza diciendo cuál era — vale la pena que reviente aquí, porque si pasa,
 * la DIAN rechaza *cada* documento de ese negocio y su mensaje no siempre dice que el problema
 * era el DV.
 *
 * ## Datos y declaración se guardan por separado
 *
 * Dos botones y dos endpoints, a propósito. Corregir una dirección no es lo mismo que declarar
 * la situación legal del negocio: lo segundo queda firmado con quién y cuándo, y es lo único que
 * respalda a EscalApp si el cliente declara algo que no es cierto. Eso, además, tiene que estar
 * en los términos y condiciones — ver `admin_ws/docs/obligaciones-escalapp.md` §6.
 */
@Component({
  selector: 'app-facturacion',
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './facturacion.component.html',
  styleUrl: './facturacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        AlertCircle,
        Building2,
        Check,
        CircleCheck,
        FileText,
        Info,
        Loader2,
        Save,
        Store,
        TriangleAlert,
      }),
    },
  ],
})
export class FacturacionComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly facturacion = inject(FacturacionService);

  // ── Estado ────────────────────────────────────────────────────
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly negocios = signal<Negocio[]>([]);
  readonly idNegocio = signal<number | null>(null);
  readonly ficha = signal<FichaFiscal | null>(null);
  readonly estado = signal<EstadoEmision | null>(null);
  readonly catalogos = signal<CatalogosFiscales>({ departamentos: [], impuestos: [] });

  /** Copia editable del formulario. La ficha del servidor se deja intacta para comparar. */
  readonly form = signal<Partial<FichaFiscal>>({});

  // ── Derivados ─────────────────────────────────────────────────
  readonly negocioActual = computed(() =>
    this.negocios().find((n) => n.id_negocio === this.idNegocio()),
  );

  readonly estadoRegistro = computed<EstadoRegistro>(
    () => this.ficha()?.estado_registro ?? 'NO_DECLARADO',
  );

  /** ¿Toca enseñar el formulario fiscal? Solo si el negocio dijo que está registrado. */
  readonly mostrarFormulario = computed(() => this.estadoRegistro() === 'REGISTRADO');

  readonly esPersonaNatural = computed(() => this.form().tipo_persona === '2');

  /**
   * Una persona jurídica está obligada a facturar SIEMPRE, sin umbral. No es algo que tenga
   * sentido preguntarle: se le informa.
   */
  readonly obligadaPorSerJuridica = computed(() => this.form().tipo_persona === '1');

  readonly puedeEmitir = computed(() => this.estado()?.puede === true);
  readonly faltantes = computed(() => this.estado()?.faltan ?? []);

  ngOnInit(): void {
    this.adminService.getMisNegociosUsuario().subscribe({
      next: (negocios) => {
        this.negocios.set(negocios);
        if (negocios.length > 0) {
          this.seleccionar(negocios[0].id_negocio);
        } else {
          this.cargando.set(false);
        }
      },
      error: () => {
        this.error.set('No se pudieron cargar tus negocios.');
        this.cargando.set(false);
      },
    });

    this.facturacion.getCatalogos().subscribe({
      next: (c) => this.catalogos.set(c),
      // Sin catálogos la pantalla sigue siendo usable: los desplegables quedan vacíos y el
      // resto del formulario funciona. No merece tapar la vista con un error.
      error: () => this.catalogos.set({ departamentos: [], impuestos: [] }),
    });
  }

  seleccionar(idNegocio: number): void {
    this.idNegocio.set(idNegocio);
    this.cargando.set(true);
    this.error.set(null);
    this.aviso.set(null);

    this.facturacion.getDatosFiscales(idNegocio).subscribe({
      next: ({ ficha, estado }) => {
        this.ficha.set(ficha);
        this.estado.set(estado);
        this.form.set({ ...ficha });
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron cargar los datos fiscales.');
        this.cargando.set(false);
      },
    });
  }

  /** Actualiza un campo del formulario sin perder el resto. */
  set<K extends keyof FichaFiscal>(campo: K, valor: FichaFiscal[K]): void {
    this.form.update((f) => ({ ...f, [campo]: valor }));
  }

  /** Lee un valor del formulario para enlazarlo con `ngModel`. */
  get<K extends keyof FichaFiscal>(campo: K): FichaFiscal[K] | null {
    return (this.form()[campo] ?? null) as FichaFiscal[K] | null;
  }

  esTributoActivo(codigo: string): boolean {
    return (this.form().tributos ?? []).includes(codigo);
  }

  alternarTributo(codigo: string): void {
    const actuales = this.form().tributos ?? [];
    const nuevos = actuales.includes(codigo)
      ? actuales.filter((c) => c !== codigo)
      : [...actuales, codigo];
    this.set('tributos', nuevos);
  }

  /** Las responsabilidades del RUT se escriben separadas por coma: la lista real es larga. */
  responsabilidadesTexto(): string {
    return (this.form().responsabilidades_fiscales ?? []).join(', ');
  }

  fijarResponsabilidades(texto: string): void {
    const lista = texto
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0);
    this.set('responsabilidades_fiscales', lista);
  }

  // ── Declaración (endpoint aparte, deja firma) ─────────────────

  declararRegistro(estadoRegistro: EstadoRegistro): void {
    this.enviarDeclaracion({ estado_registro: estadoRegistro });
  }

  declararObligacion(obligado: boolean): void {
    this.enviarDeclaracion({ obligado_a_facturar: obligado });
  }

  declararModo(modo: ModoFacturacion): void {
    this.enviarDeclaracion({ modo_facturacion: modo });
  }

  private enviarDeclaracion(declaracion: Declaracion): void {
    const id = this.idNegocio();
    if (!id) return;

    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);

    this.facturacion.declarar(id, declaracion).subscribe({
      next: ({ ficha, estado }) => {
        this.ficha.set(ficha);
        this.estado.set(estado);
        this.form.update((f) => ({ ...f, ...ficha }));
        this.guardando.set(false);
        this.aviso.set('Declaración guardada.');
      },
      error: (err) => {
        // El backend contesta con frases pensadas para una persona («un negocio que no está
        // registrado… no puede emitir»). Se enseñan tal cual en vez de traducirlas otra vez.
        this.error.set(err?.error?.message ?? 'No se pudo guardar la declaración.');
        this.guardando.set(false);
      },
    });
  }

  // ── Datos ─────────────────────────────────────────────────────

  guardar(): void {
    const id = this.idNegocio();
    if (!id) return;

    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);

    // Solo se manda lo que se puede escribir por este endpoint: la declaración va por el suyo.
    const f = this.form();
    const campos: Partial<FichaFiscal> = {
      tipo_persona: f.tipo_persona ?? null,
      tipo_documento: f.tipo_documento ?? null,
      numero_documento: f.numero_documento ?? null,
      dv: f.dv ?? null,
      razon_social: f.razon_social ?? null,
      nombre_comercial: f.nombre_comercial ?? null,
      primer_apellido: f.primer_apellido ?? null,
      segundo_apellido: f.segundo_apellido ?? null,
      primer_nombre: f.primer_nombre ?? null,
      otros_nombres: f.otros_nombres ?? null,
      responsabilidades_fiscales: f.responsabilidades_fiscales ?? null,
      tributos: f.tributos ?? null,
      regimen: f.regimen ?? null,
      tipo_contribuyente: f.tipo_contribuyente ?? null,
      actividad_ciiu: f.actividad_ciiu ?? null,
      matricula_mercantil: f.matricula_mercantil ?? null,
      direccion_fiscal: f.direccion_fiscal ?? null,
      municipio_dane: f.municipio_dane ?? null,
      departamento_dane: f.departamento_dane ?? null,
      codigo_postal: f.codigo_postal ?? null,
      correo_facturacion: f.correo_facturacion ?? null,
      telefono_facturacion: f.telefono_facturacion ?? null,
    };

    this.facturacion.guardar(id, campos).subscribe({
      next: ({ ficha, estado }) => {
        this.ficha.set(ficha);
        this.estado.set(estado);
        // Se relee del servidor: el DV pudo haberse calculado allá y el número, normalizado.
        this.form.set({ ...ficha });
        this.guardando.set(false);
        this.aviso.set('Datos guardados.');
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron guardar los datos.');
        this.guardando.set(false);
      },
    });
  }

  /** Para el `@for` de la plantilla. */
  trackNegocio = (_: number, n: Negocio) => n.id_negocio;
  trackTexto = (i: number, t: string) => `${i}-${t}`;
}
