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
  LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Landmark, Plus, Download, RefreshCw, Loader2, Pencil, Ban, CircleAlert, ArrowDownLeft,
  ArrowUpRight, ArrowLeftRight, Search, Info, Settings, CreditCard, Receipt, Wallet, TrendingUp,
  Copy, ChartColumn,
} from 'lucide-angular';

import { CarteraService } from '../../data-access/cartera.service';
import {
  CatalogosCartera,
  CategoriaCartera,
  CuentaCartera,
  FiltrosCartera,
  MesCartera,
  MovimientoCartera,
  MovimientoInput,
  OrigenMovimiento,
  ResumenCartera,
  TarifaPasarela,
  TipoCuenta,
  TipoMovimiento,
} from '../../models/cartera.models';
import { LoadingState } from '../../models/admin.models';
import { ModalCabeceraComponent } from '../../../shared/modal-cabecera/modal-cabecera.component';
import { PaginadorComponent, paginar } from '../../../shared/paginador/paginador.component';
import { ToastService } from '../../../shared/toast/toast.service';

type Pestana = 'resumen' | 'movimientos' | 'ajustes';
type Periodo = 'mes' | 'mes_anterior' | 'trimestre' | 'anio' | 'personalizado';

const TIPOS: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
  transferencia: 'Traslado',
};

const ORIGENES: Record<OrigenMovimiento, string> = {
  manual: 'Manual',
  cobranza: 'Mensualidad',
  recarga_ia: 'Recarga IA',
};

const TIPOS_CUENTA: Record<TipoCuenta, string> = {
  banco: 'Banco',
  pasarela: 'Pasarela',
  billetera: 'Billetera (Nequi, Daviplata…)',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta de crédito',
};

/** Tasa del GMF si el servidor no la manda: 4 por mil. */
const TASA_GMF = 0.004;

function hoyBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Rango de fechas de cada periodo rápido, en días de Bogotá. */
function rangoDe(periodo: Periodo): { desde: string; hasta: string } {
  const hoy = hoyBogota();
  const [a, m] = hoy.split('-').map(Number);
  const utc = (anio: number, mes: number, dia: number) => iso(new Date(Date.UTC(anio, mes - 1, dia)));
  switch (periodo) {
    case 'mes_anterior':
      return { desde: utc(a, m - 1, 1), hasta: utc(a, m, 0) };
    case 'trimestre':
      return { desde: utc(a, m - 2, 1), hasta: hoy };
    case 'anio':
      return { desde: `${a}-01-01`, hasta: hoy };
    default:
      return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
  }
}

/** Techo «redondo» para el eje: 1, 2, 2.5, 5 o 10 × 10^n (el mismo de Terceros). */
function techo(valor: number): number {
  if (valor <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(valor)));
  const f = valor / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}

function formularioVacio(tipo: TipoMovimiento = 'egreso'): MovimientoInput {
  return {
    tipo,
    fecha: hoyBogota(),
    id_cuenta: null,
    id_cuenta_destino: null,
    id_categoria: null,
    tercero: null,
    descripcion: null,
    soporte: null,
    moneda: 'COP',
    monto: null,
    tasa_cop: null,
    comision: null,
    iva_comision: null,
    retencion: null,
    iva: null,
    gmf: null,
    exento_gmf: false,
  };
}

/**
 * CarteraComponent — el libro de caja de EscalApp, solo para los dueños (super admin).
 *
 * Ver `admin_ws/docs/cartera.md`. Tres pestañas:
 *
 *   - **Resumen**: lo que entró, lo que salió y lo que se quedó por el camino (comisiones de
 *     Wompi/dLocal, 4x1000, retenciones), el saldo de cada cuenta y la evolución de 12 meses.
 *   - **Movimientos**: el libro. Las mensualidades y las recargas de OpenAI llegan solas; los
 *     ingresos de otros negocios y todos los gastos se anotan aquí.
 *   - **Cuentas y tarifas**: dónde vive la plata, qué cuenta paga 4x1000, las categorías y la
 *     tarifa con la que se estiman las comisiones de cada pasarela.
 *
 * ## Por qué «Resultado» y «Caja» son dos cifras
 *
 * Las retenciones que nos practican los clientes empresa no son un gasto —se descuentan al
 * declarar renta—, pero esa plata tampoco llegó al banco. El resultado no las resta; la caja sí.
 */
@Component({
  selector: 'app-cartera',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, ModalCabeceraComponent, PaginadorComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Landmark, Plus, Download, RefreshCw, Loader2, Pencil, Ban, CircleAlert, ArrowDownLeft,
        ArrowUpRight, ArrowLeftRight, Search, Info, Settings, CreditCard, Receipt, Wallet,
        TrendingUp, Copy, ChartColumn,
      }),
    },
  ],
  templateUrl: './cartera.component.html',
  styleUrl: './cartera.component.scss',
})
export class CarteraComponent implements OnInit {
  private readonly api = inject(CarteraService);
  private readonly toast = inject(ToastService);

  protected readonly TIPOS = TIPOS;
  protected readonly ORIGENES = ORIGENES;
  protected readonly TIPOS_CUENTA = TIPOS_CUENTA;
  protected readonly tiposCuenta = Object.keys(TIPOS_CUENTA) as TipoCuenta[];
  protected readonly tiposMovimiento: TipoMovimiento[] = ['ingreso', 'egreso', 'transferencia'];
  protected readonly periodos: { v: Periodo; t: string }[] = [
    { v: 'mes', t: 'Este mes' },
    { v: 'mes_anterior', t: 'Mes anterior' },
    { v: 'trimestre', t: 'Últimos 3 meses' },
    { v: 'anio', t: 'Este año' },
    { v: 'personalizado', t: 'Personalizado' },
  ];

  // ── Estado general ──────────────────────────────────────
  protected readonly pestana = signal<Pestana>('resumen');
  protected readonly periodo = signal<Periodo>('mes');
  protected readonly desde = signal(rangoDe('mes').desde);
  protected readonly hasta = signal(rangoDe('mes').hasta);

  protected readonly catalogos = signal<CatalogosCartera | null>(null);
  protected readonly resumen = signal<ResumenCartera | null>(null);
  protected readonly estadoResumen = signal<LoadingState>('loading');
  protected readonly error = signal<string | null>(null);

  // ── Movimientos ─────────────────────────────────────────
  protected readonly movimientos = signal<MovimientoCartera[]>([]);
  protected readonly estadoMovs = signal<LoadingState>('idle');
  protected readonly fTipo = signal<TipoMovimiento | ''>('');
  protected readonly fCuenta = signal<number | null>(null);
  protected readonly fCategoria = signal<number | null>(null);
  protected readonly fOrigen = signal<OrigenMovimiento | ''>('');
  protected readonly fBusqueda = signal('');
  protected readonly fAnulados = signal(false);
  private readonly _pagina = signal(1);
  protected readonly tamano = signal(25);
  protected readonly exportando = signal(false);

  // ── Modal de movimiento ─────────────────────────────────
  protected readonly editando = signal<MovimientoCartera | null>(null);
  protected readonly formAbierto = signal(false);
  protected readonly form = signal<MovimientoInput>(formularioVacio());
  /** El dueño tecleó el 4x1000 del extracto: deja de calcularse solo. */
  protected readonly gmfManual = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorForm = signal<string | null>(null);

  // ── Modal de anulación ──────────────────────────────────
  protected readonly anulando = signal<MovimientoCartera | null>(null);
  protected readonly motivo = signal('');

  // ── Ajustes ─────────────────────────────────────────────
  protected readonly cuentaEditada = signal<Partial<CuentaCartera> | null>(null);
  protected readonly tarifaEditada = signal<TarifaPasarela | null>(null);
  protected readonly nuevaCategoria = signal('');
  protected readonly nuevaCategoriaTipo = signal<'ingreso' | 'egreso'>('egreso');

  // ── Derivados ───────────────────────────────────────────
  protected readonly cuentasActivas = computed(() =>
    (this.catalogos()?.cuentas ?? []).filter((c) => c.estado === 'A'),
  );

  protected readonly categoriasDelForm = computed<CategoriaCartera[]>(() => {
    const tipo = this.form().tipo;
    const actual = this.form().id_categoria;
    return (this.catalogos()?.categorias ?? []).filter(
      (c) => c.tipo === tipo && (c.estado === 'A' || c.id_categoria === actual),
    );
  });

  protected readonly categoriasFiltro = computed(() => {
    const tipo = this.fTipo();
    return (this.catalogos()?.categorias ?? []).filter((c) => !tipo || c.tipo === tipo);
  });

  protected readonly automatico = computed(() => {
    const m = this.editando();
    return !!m && m.origen !== 'manual';
  });

  /** Monto del formulario en pesos, o null si falta la tasa. */
  private readonly montoCopForm = computed<number | null>(() => {
    const f = this.form();
    const monto = Number(f.monto) || 0;
    if (f.moneda === 'COP') return monto;
    return f.tasa_cop ? monto * Number(f.tasa_cop) : null;
  });

  /** El 4x1000 que calcularía el servidor, para enseñarlo antes de guardar. */
  protected readonly gmfCalculado = computed(() => {
    const f = this.form();
    const cuenta = this.cuentasActivas().find((c) => c.id_cuenta === Number(f.id_cuenta));
    if (f.tipo === 'ingreso' || !cuenta?.aplica_gmf || f.exento_gmf) return 0;
    const base = (this.montoCopForm() ?? 0) + (Number(f.comision) || 0) + (Number(f.iva_comision) || 0);
    return Math.round(base * (this.catalogos()?.tasa_gmf ?? TASA_GMF));
  });

  protected readonly cuentaFormPagaGmf = computed(
    () => !!this.cuentasActivas().find((c) => c.id_cuenta === Number(this.form().id_cuenta))?.aplica_gmf,
  );

  /** Lo que sube o baja la cuenta con este movimiento. */
  protected readonly netoForm = computed(() => {
    const f = this.form();
    const monto = this.montoCopForm() ?? 0;
    const gmf = this.gmfManual() ? Number(f.gmf) || 0 : this.gmfCalculado();
    const cargos = (Number(f.comision) || 0) + (Number(f.iva_comision) || 0) + gmf;
    return f.tipo === 'ingreso' ? monto - cargos - (Number(f.retencion) || 0) : -(monto + cargos);
  });

  protected readonly pagina = computed(() => {
    const ultima = Math.max(1, Math.ceil(this.movimientos().length / this.tamano()));
    return Math.min(this._pagina(), ultima);
  });

  protected readonly filasPagina = computed(() =>
    paginar(this.movimientos(), this.pagina(), this.tamano()),
  );

  /** Totales de lo que está filtrado en la lista (lo que sumaría la contadora). */
  protected readonly totalesLista = computed(() => {
    let entradas = 0;
    let salidas = 0;
    for (const m of this.movimientos()) {
      if (m.estado !== 'A' || m.tipo === 'transferencia') continue;
      const neto = this.neto(m);
      if (neto >= 0) entradas += neto;
      else salidas += -neto;
    }
    return { entradas, salidas };
  });

  // ── Gráfica mensual ─────────────────────────────────────
  /** Mes bajo el cursor (índice), o null. */
  protected readonly hoverMes = signal<number | null>(null);

  /**
   * Dos series con la misma unidad (pesos) sobre UN eje: lo que entró y lo que salió. Los
   * egresos incluyen comisiones y 4x1000, que también son plata que se fue.
   */
  protected readonly serieMeses = computed(() =>
    (this.resumen()?.por_mes ?? []).map((m) => ({ ...m, salidas: m.egresos + m.costos_financieros })),
  );

  protected readonly ejeMaxMes = computed(() =>
    techo(Math.max(0, ...this.serieMeses().flatMap((m) => [m.ingresos, m.salidas]))),
  );

  protected readonly ejeMarcasMes = computed(() => {
    const max = this.ejeMaxMes();
    return [max, max / 2, 0];
  });

  protected readonly mesHover = computed(() => {
    const i = this.hoverMes();
    return i === null ? null : (this.serieMeses()[i] ?? null);
  });

  protected readonly hayMovimientosEnMeses = computed(() =>
    this.serieMeses().some((m) => m.ingresos > 0 || m.salidas > 0),
  );

  /** Escala de las barras horizontales: la categoría más grande de su lista llena la pista. */
  protected readonly maxIngresoCategoria = computed(() =>
    Math.max(1, ...(this.resumen()?.ingresos_por_categoria ?? []).map((c) => c.total)),
  );

  protected readonly maxEgresoCategoria = computed(() =>
    Math.max(1, ...(this.resumen()?.egresos_por_categoria ?? []).map((c) => c.total)),
  );

  protected readonly maxTercero = computed(() =>
    Math.max(1, ...(this.resumen()?.ingresos_por_tercero ?? []).map((c) => c.total)),
  );

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarResumen();
  }

  // ── Carga ───────────────────────────────────────────────
  private cargarCatalogos(): void {
    this.api.getCatalogos().subscribe({
      next: (c) => this.catalogos.set(c),
      error: (err) => this.error.set(this.mensaje(err, 'No se pudieron cargar las cuentas.')),
    });
  }

  protected cargarResumen(): void {
    this.estadoResumen.set('loading');
    this.error.set(null);
    this.api.getResumen(this.desde(), this.hasta()).subscribe({
      next: (r) => {
        this.resumen.set(r);
        this.estadoResumen.set('success');
        const s = r.sincronizacion;
        const nuevos = s.mensualidades + s.recargas;
        if (nuevos > 0) {
          this.toast.info(`${nuevos} pago(s) nuevo(s) entraron solos a la cartera.`);
        }
      },
      error: (err) => {
        this.error.set(this.mensaje(err, 'No se pudo calcular el resumen.'));
        this.estadoResumen.set('error');
      },
    });
  }

  protected cargarMovimientos(): void {
    this.estadoMovs.set('loading');
    this.api.getMovimientos(this.filtros()).subscribe({
      next: (filas) => {
        this.movimientos.set(filas);
        this.estadoMovs.set('success');
      },
      error: (err) => {
        this.error.set(this.mensaje(err, 'No se pudieron cargar los movimientos.'));
        this.estadoMovs.set('error');
      },
    });
  }

  /** Recarga lo que se ve: el resumen siempre (cambia con cualquier movimiento) y la lista si toca. */
  protected recargar(): void {
    this.cargarResumen();
    if (this.pestana() === 'movimientos' || this.estadoMovs() !== 'idle') this.cargarMovimientos();
  }

  protected irA(p: Pestana): void {
    this.pestana.set(p);
    if (p === 'movimientos' && this.estadoMovs() === 'idle') this.cargarMovimientos();
  }

  private filtros(): FiltrosCartera {
    return {
      desde: this.desde(),
      hasta: this.hasta(),
      tipo: this.fTipo(),
      id_cuenta: this.fCuenta(),
      id_categoria: this.fCategoria(),
      origen: this.fOrigen(),
      q: this.fBusqueda(),
      anulados: this.fAnulados(),
    };
  }

  // ── Periodo ─────────────────────────────────────────────
  protected elegirPeriodo(p: Periodo): void {
    this.periodo.set(p);
    if (p !== 'personalizado') {
      const r = rangoDe(p);
      this.desde.set(r.desde);
      this.hasta.set(r.hasta);
      this._pagina.set(1);
      this.recargar();
    }
  }

  protected aplicarRango(): void {
    if (!this.desde() || !this.hasta()) return;
    if (this.desde() > this.hasta()) {
      this.toast.aviso('La fecha inicial es posterior a la final.');
      return;
    }
    this._pagina.set(1);
    this.recargar();
  }

  // ── Filtros de la lista ─────────────────────────────────
  protected aplicarFiltros(): void {
    this._pagina.set(1);
    this.cargarMovimientos();
  }

  protected limpiarFiltros(): void {
    this.fTipo.set('');
    this.fCuenta.set(null);
    this.fCategoria.set(null);
    this.fOrigen.set('');
    this.fBusqueda.set('');
    this.fAnulados.set(false);
    this.aplicarFiltros();
  }

  /** Desde el resumen: ver los movimientos de una categoría. */
  protected verCategoria(idCategoria: number, tipo: 'ingreso' | 'egreso'): void {
    this.fTipo.set(tipo);
    this.fCategoria.set(idCategoria);
    this.fCuenta.set(null);
    this.fOrigen.set('');
    this.fBusqueda.set('');
    this.pestana.set('movimientos');
    this.aplicarFiltros();
  }

  protected irAPagina(p: number): void {
    this._pagina.set(p);
  }

  protected cambiarTamano(t: number): void {
    this.tamano.set(t);
    this._pagina.set(1);
  }

  protected exportar(): void {
    this.exportando.set(true);
    this.api.exportar(this.filtros()).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cartera_${this.desde()}_${this.hasta()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exportando.set(false);
      },
      error: (err) => {
        this.toast.error(this.mensaje(err, 'No se pudo exportar.'));
        this.exportando.set(false);
      },
    });
  }

  // ── Formulario de movimiento ────────────────────────────
  protected nuevo(tipo: TipoMovimiento = 'egreso'): void {
    const f = formularioVacio(tipo);
    f.id_cuenta = this.cuentasActivas().find((c) => c.tipo === 'banco')?.id_cuenta
      ?? this.cuentasActivas()[0]?.id_cuenta ?? null;
    this.editando.set(null);
    this.form.set(f);
    this.gmfManual.set(false);
    this.errorForm.set(null);
    this.formAbierto.set(true);
  }

  protected editar(m: MovimientoCartera): void {
    this.editando.set(m);
    this.form.set({
      tipo: m.tipo,
      fecha: m.fecha,
      id_cuenta: m.id_cuenta,
      id_cuenta_destino: m.id_cuenta_destino,
      id_categoria: m.id_categoria,
      tercero: m.negocio || m.tercero,
      descripcion: m.descripcion,
      soporte: m.soporte,
      moneda: m.moneda,
      monto: m.monto,
      tasa_cop: m.tasa_cop,
      comision: m.comision,
      iva_comision: m.iva_comision,
      retencion: m.retencion,
      iva: m.iva,
      gmf: m.gmf,
      exento_gmf: m.exento_gmf,
    });
    // Si el guardado no coincide con el que se calcularía, alguien lo tecleó: se respeta.
    this.gmfManual.set(false);
    this.gmfManual.set(m.gmf !== this.gmfCalculado());
    this.errorForm.set(null);
    this.formAbierto.set(true);
  }

  /** Repetir un gasto (el arriendo del servidor, el contador…): mismo formulario, fecha de hoy. */
  protected duplicar(m: MovimientoCartera): void {
    this.editar(m);
    this.editando.set(null);
    this.form.update((f) => ({ ...f, fecha: hoyBogota(), soporte: null }));
  }

  protected cerrarForm(): void {
    if (this.guardando()) return;
    this.formAbierto.set(false);
  }

  protected campo<K extends keyof MovimientoInput>(k: K, valor: MovimientoInput[K]): void {
    this.form.update((f) => ({ ...f, [k]: valor }));
  }

  protected numero(k: keyof MovimientoInput, valor: string | number | null): void {
    const n = valor === '' || valor === null ? null : Number(valor);
    this.form.update((f) => ({ ...f, [k]: Number.isFinite(n) ? n : null }));
  }

  protected cambiarTipo(tipo: TipoMovimiento): void {
    if (this.automatico()) return;
    this.form.update((f) => ({
      ...f,
      tipo,
      id_categoria: null,
      id_cuenta_destino: tipo === 'transferencia' ? f.id_cuenta_destino : null,
    }));
  }

  protected cambiarMoneda(moneda: string): void {
    this.form.update((f) => ({
      ...f,
      moneda,
      tasa_cop: moneda === 'COP' ? null : f.tasa_cop ?? this.catalogos()?.trm?.valor ?? null,
    }));
  }

  protected guardar(): void {
    const f = this.form();
    if (!f.monto || f.monto <= 0) return this.errorForm.set('Escribe el monto.');
    if (!f.id_cuenta) return this.errorForm.set('Elige la cuenta.');
    if (f.tipo === 'transferencia' && !f.id_cuenta_destino) {
      return this.errorForm.set('Elige la cuenta de destino.');
    }
    if (f.tipo !== 'transferencia' && !f.id_categoria) return this.errorForm.set('Elige una categoría.');

    const datos: MovimientoInput = { ...f, gmf: this.gmfManual() ? Number(f.gmf) || 0 : null };
    const m = this.editando();
    if (m && m.origen !== 'manual') {
      // De uno automático no viajan el tipo, el monto ni la moneda: los fija su origen.
      const { tipo: _t, monto: _m, moneda: _mo, id_cuenta_destino: _d, ...resto } = datos;
      return this.enviar(this.api.actualizarMovimiento(m.id_movimiento, resto), 'Movimiento actualizado');
    }
    this.enviar(
      m ? this.api.actualizarMovimiento(m.id_movimiento, datos) : this.api.crearMovimiento(datos),
      m ? 'Movimiento actualizado' : 'Movimiento registrado',
    );
  }

  private enviar(peticion: ReturnType<CarteraService['crearMovimiento']>, ok: string): void {
    this.guardando.set(true);
    this.errorForm.set(null);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.formAbierto.set(false);
        this.toast.exito(ok);
        this.recargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorForm.set(this.mensaje(err, 'No se pudo guardar.'));
      },
    });
  }

  // ── Anular ──────────────────────────────────────────────
  protected pedirAnular(m: MovimientoCartera): void {
    this.anulando.set(m);
    this.motivo.set('');
  }

  protected confirmarAnular(): void {
    const m = this.anulando();
    if (!m || this.motivo().trim().length < 3) return;
    this.guardando.set(true);
    this.api.anularMovimiento(m.id_movimiento, this.motivo().trim()).subscribe({
      next: () => {
        this.guardando.set(false);
        this.anulando.set(null);
        this.toast.exito('Movimiento anulado');
        this.recargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.toast.error(this.mensaje(err, 'No se pudo anular.'));
      },
    });
  }

  // ── Cuentas, categorías, tarifas ────────────────────────
  protected editarCuenta(c?: CuentaCartera): void {
    this.cuentaEditada.set(
      c ? { ...c } : { nombre: '', tipo: 'banco', aplica_gmf: true, saldo_inicial: 0, fecha_saldo: null, nota: null },
    );
  }

  protected campoCuenta<K extends keyof CuentaCartera>(k: K, valor: CuentaCartera[K]): void {
    this.cuentaEditada.update((c) => (c ? { ...c, [k]: valor } : c));
  }

  protected guardarCuenta(): void {
    const c = this.cuentaEditada();
    if (!c || !c.nombre?.trim()) return;
    const { nombre, tipo, aplica_gmf, saldo_inicial, fecha_saldo, nota, estado } = c;
    this.guardando.set(true);
    this.api
      .guardarCuenta(
        { nombre, tipo, aplica_gmf, saldo_inicial: Number(saldo_inicial) || 0, fecha_saldo: fecha_saldo || null, nota, estado },
        c.id_cuenta,
      )
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.cuentaEditada.set(null);
          this.toast.exito('Cuenta guardada');
          this.cargarCatalogos();
          this.cargarResumen();
        },
        error: (err) => {
          this.guardando.set(false);
          this.toast.error(this.mensaje(err, 'No se pudo guardar la cuenta.'));
        },
      });
  }

  protected crearCategoria(): void {
    const nombre = this.nuevaCategoria().trim();
    if (nombre.length < 2) return;
    this.api.crearCategoria(nombre, this.nuevaCategoriaTipo()).subscribe({
      next: () => {
        this.nuevaCategoria.set('');
        this.toast.exito('Categoría creada');
        this.cargarCatalogos();
      },
      error: (err) => this.toast.error(this.mensaje(err, 'No se pudo crear la categoría.')),
    });
  }

  protected alternarCategoria(c: CategoriaCartera): void {
    this.api.actualizarCategoria(c.id_categoria, { estado: c.estado === 'A' ? 'I' : 'A' }).subscribe({
      next: () => this.cargarCatalogos(),
      error: (err) => this.toast.error(this.mensaje(err, 'No se pudo cambiar la categoría.')),
    });
  }

  protected editarTarifa(t: TarifaPasarela): void {
    this.tarifaEditada.set({ ...t });
  }

  protected campoTarifa<K extends keyof TarifaPasarela>(k: K, valor: TarifaPasarela[K]): void {
    this.tarifaEditada.update((t) => (t ? { ...t, [k]: valor } : t));
  }

  protected guardarTarifa(): void {
    const t = this.tarifaEditada();
    if (!t) return;
    this.guardando.set(true);
    this.api
      .actualizarTarifa({
        ...t,
        porcentaje: Number(t.porcentaje) || 0,
        fijo: Number(t.fijo) || 0,
        iva_pct: Number(t.iva_pct) || 0,
        retencion_pct: Number(t.retencion_pct) || 0,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.tarifaEditada.set(null);
          this.toast.exito('Tarifa guardada. Aplica a los pagos que entren de aquí en adelante.');
          this.cargarCatalogos();
        },
        error: (err) => {
          this.guardando.set(false);
          this.toast.error(this.mensaje(err, 'No se pudo guardar la tarifa.'));
        },
      });
  }

  // ── Presentación ────────────────────────────────────────
  protected dinero(valor: number | null | undefined, moneda = 'COP'): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: moneda || 'COP',
      maximumFractionDigits: moneda === 'COP' ? 0 : 2,
    }).format(Number(valor ?? 0) || 0); // || 0: sin «-$ 0»
  }

  protected porcentaje(valor: number | null): string {
    return valor === null ? '—' : `${(valor * 100).toFixed(1).replace('.', ',')} %`;
  }

  /** Qué cobros llegan a una cuenta, con el nombre de la pasarela tal como se escribe. */
  protected recibe(pasarela: string | null): string {
    if (!pasarela) return '—';
    if (pasarela === 'manual') return 'Transferencias';
    const nombre = this.catalogos()?.tarifas.find((t) => t.pasarela === pasarela)?.nombre ?? pasarela;
    return `Pagos de ${nombre}`;
  }

  /** Un porcentaje de tarifa con coma decimal: «1,99 %». */
  protected pct(valor: number): string {
    return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(valor)} %`;
  }

  /** Lo que el movimiento sumó o restó en su cuenta de origen (el traslado: lo que salió). */
  protected neto(m: MovimientoCartera): number {
    const monto = m.monto_cop ?? 0;
    const cargos = m.comision + m.iva_comision + m.gmf;
    return m.tipo === 'ingreso' ? monto - cargos - m.retencion : -(monto + cargos);
  }

  protected nombreMes(mes: string): string {
    const [a, m] = mes.split('-').map(Number);
    return new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(a, m - 1, 1)))
      .replace('.', '');
  }

  protected altura(valor: number): number {
    return Math.max(0, (valor / this.ejeMaxMes()) * 100);
  }

  protected ancho(valor: number, max: number): number {
    return Math.max(2, (valor / max) * 100);
  }

  /** Cifra corta para el eje: «$1,2 M», «$450 mil». */
  protected compacto(valor: number): string {
    if (!valor) return '$0';
    return '$' + new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 2 }).format(valor);
  }

  protected etiquetaMes(m: MesCartera): string {
    return `${this.nombreMes(m.mes)} ${m.mes.slice(0, 4)}: ingresos ${this.dinero(m.ingresos)}, `
      + `egresos ${this.dinero(m.egresos)}, comisiones y 4x1000 ${this.dinero(m.costos_financieros)}, `
      + `resultado ${this.dinero(m.resultado)}`;
  }

  private mensaje(err: unknown, porDefecto: string): string {
    const e = (err as { error?: { message?: string; errors?: { msg?: string }[] } })?.error;
    return e?.errors?.[0]?.msg || e?.message || porDefecto;
  }
}
