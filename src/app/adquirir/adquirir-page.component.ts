import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  LucideAngularModule,
  LucideIconProvider,
  LUCIDE_ICONS,
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Minus,
  Monitor,
  Plus,
  ShieldCheck,
  Store,
  User,
  UserPlus,
} from 'lucide-angular';

import { AssetService } from '../core/services/asset.service';
import { PagosPublicosService } from '../pagos/pagos-publicos.service';
import { recordarPago, tomarPagoEnCurso } from '../core/utils/pasarelas';

/**
 * La referencia de la compra que salió al checkout. `recordarPago` guarda el id de la pasarela,
 * pero lo descarta si no hay id (y ese es justo el caso de algunas vueltas): la referencia va
 * aparte para no depender de él. sessionStorage: sirve para esta vuelta, no para mañana.
 */
const CLAVE_REFERENCIA = 'escalapp:compra-en-curso';
import { AuthService } from '../auth/data-access/auth.service';
import { RubroPublico } from '../auth/models/auth.models';
import {
  AdquirirService,
  CompraIniciada,
  CuentaCreada,
  ComplementoVendible,
  EstadoCompra,
  PasarelaDisponible,
  PlanVendible,
} from './adquirir.service';

/** Los cuatro pasos del formulario, más la pantalla de vuelta del checkout. */
type Paso = 'negocio' | 'titular' | 'cuenta' | 'pago' | 'resultado';

/**
 * Los pasos en orden. La barra de progreso, «Continuar» y «Atrás» salen de aquí: antes cada uno
 * repetía la lista a mano, y añadir los complementos habría sido tocarla en cuatro sitios.
 *
 * **«Cuenta» y «Pago» son dos cosas distintas, y por eso son dos pasos.** Hasta 2026-09-23 el
 * formulario terminaba en «Ir a pagar» y creaba la cuenta en esa misma llamada: si el pago
 * fallaba, la cuenta quedaba creada y nadie se lo decía al comprador, que volvía a empezar y
 * chocaba con «ya existe una cuenta con ese correo». Ahora la cuenta se crea y se confirma en su
 * paso, y el pago es lo que falta para activar el plan.
 */
const PASOS: { id: Exclude<Paso, 'resultado'>; etiqueta: string }[] = [
  { id: 'negocio', etiqueta: 'Tu negocio' },
  { id: 'titular', etiqueta: 'Tus datos' },
  { id: 'cuenta', etiqueta: 'Tu cuenta' },
  { id: 'pago', etiqueta: 'Pago' },
];

/**
 * AdquirirPageComponent — la compra de un plan, de principio a fin.
 *
 * ## Por qué es una vista y no un modal
 *
 * Porque a mitad del camino el visitante **se va a otro dominio**: el checkout de Wompi o dLocal
 * y, si paga por PSE, además al de su banco. Un modal no sobrevive a eso. Con una ruta propia la
 * vuelta es una URL (`/adquirir?ref=EA-123-202609`) que se puede recargar, compartir por correo
 * y reabrir al día siguiente para reintentar un pago que quedó a medias.
 *
 * ## Qué llega desde la landing
 *
 *   ?plan=Plan%20Avanzado   el plan que eligió (nombre exacto de `gener_plan`)
 *   ?modulo=RESTAURANTE     la familia que ya eligió en el selector de planes
 *   ?ref=EA-12-202609       solo al volver del checkout
 *
 * El precio NO viaja en la URL: lo dice el backend. Lo que se ve aquí sale de
 * `GET /publico/adquirir/catalogo`, que solo devuelve planes con precio real en `cob_precio_plan`.
 */
@Component({
  selector: 'app-adquirir-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        ArrowRight,
        ArrowLeft,
        BadgeCheck,
        Building2,
        Check,
        CheckCircle2,
        ChevronRight,
        Eye,
        EyeOff,
        CreditCard,
        Loader2,
        Lock,
        Mail,
        Minus,
        Monitor,
        Plus,
        ShieldCheck,
        Store,
        User,
        UserPlus,
      }),
    },
  ],
  // El contenido de esta página depende de la URL y de dos consultas al API: no hay HTML del
  // servidor con el que casar. Saltarse la hidratación aquí evita que Angular intente encajar
  // un árbol servido contra otro distinto y acabe vaciando el bloque — que es lo que hacía
  // desaparecer el título y la bajada a los pocos segundos de abrir la vista.
  host: { ngSkipHydration: 'true' },
  templateUrl: './adquirir-page.component.html',
  styleUrl: './adquirir-page.component.scss',
})
export class AdquirirPageComponent {
  private readonly api = inject(AdquirirService);
  private readonly pagos = inject(PagosPublicosService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly assetService = inject(AssetService);

  protected readonly paso = signal<Paso>('negocio');
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  /* ── Lo que viene de la landing ── */
  protected readonly planPedido = signal<string>('Plan Básico');
  protected readonly moduloPedido = signal<string>('RESTAURANTE');

  /* ── Catálogo real ── */
  private readonly rubros = signal<RubroPublico[]>([]);
  protected readonly planes = signal<PlanVendible[]>([]);
  protected readonly pasarelas = signal<PasarelaDisponible[]>([]);
  protected readonly complementos = signal<ComplementoVendible[]>([]);
  /** Hasta que el catálogo responde no se sabe si el plan se puede cobrar: ni precio ni aviso. */
  protected readonly catalogoCargado = signal(false);
  /**
   * El catálogo no llegó (API caída, sin red, CORS). Es distinto de «ese plan no se vende»: si
   * no se separan, un backend apagado le dice al visitante que el plan que eligió no existe.
   */
  protected readonly catalogoFallo = signal(false);

  /** Solo los oficios de la familia que el visitante ya eligió: no se le vuelve a preguntar. */
  protected readonly rubrosDeCategoria = computed(() =>
    this.rubros().filter((r) => r.modulo === this.moduloPedido()),
  );

  /** El plan elegido, ya con su precio de la base. Si no existe, la compra no puede seguir. */
  protected readonly plan = computed<PlanVendible | null>(
    () => this.planes().find((p) => p.nombre === this.planPedido()) ?? null,
  );

  protected readonly etiquetaCategoria = computed(() =>
    this.moduloPedido() === 'RESERVA' ? 'Agenda y Reservas' : 'Restaurante / Gastrobar',
  );

  /* ── Formulario ── */
  protected readonly rubro = signal('');
  protected readonly nombreNegocio = signal('');
  protected readonly nombres = signal('');
  protected readonly apellidos = signal('');
  protected readonly cedula = signal('');
  protected readonly email = signal('');
  protected readonly emailConfirma = signal('');
  protected readonly telefono = signal('');
  protected readonly pasarela = signal<'wompi' | 'dlocal'>('wompi');
  protected readonly aceptaTerminos = signal(false);

  protected readonly tocado = signal(false);

  /* ── Resultado ── */
  protected readonly compra = signal<CompraIniciada | null>(null);
  protected readonly estado = signal<EstadoCompra | null>(null);
  private intentosEstado = 0;
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('plan')) this.planPedido.set(qp.get('plan')!);
    if (qp.get('modulo')) this.moduloPedido.set(qp.get('modulo')!.toUpperCase());

    // Las dos consultas van en afterNextRender porque esta ruta se prerenderiza: durante el
    // build no hay API a la que preguntar, y pedirlo ahí dejaría el HTML servido con el mensaje
    // de error dentro. En el navegador se piden al abrir la página, que es cuando importan.
    afterNextRender(() => this.cargarCatalogo());
  }

  private cargarCatalogo(): void {
    const qp = this.route.snapshot.queryParamMap;

    this.auth
      .getRubrosPublicos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lista) => this.rubros.set(lista),
        error: () => this.error.set('No pudimos cargar los tipos de negocio. Recarga la página.'),
      });

    this.api
      .catalogo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cat) => {
          this.planes.set(cat.planes);
          this.pasarelas.set(cat.pasarelas);
          this.complementos.set(cat.complementos ?? []);
          this.catalogoCargado.set(true);
          this.catalogoFallo.set(false);
          if (cat.pasarelas.length && !cat.pasarelas.some((p) => p.codigo === this.pasarela())) {
            this.pasarela.set(cat.pasarelas[0].codigo);
          }
        },
        error: () => {
          this.catalogoCargado.set(true);
          this.catalogoFallo.set(true);
        },
      });

    this.atenderVueltaDelCheckout();

    this.destroyRef.onDestroy(() => clearTimeout(this.temporizador));
  }

  /* ── Validación ── */

  protected readonly errorRubro = computed(() => (this.rubro() ? null : 'Elige tu tipo de negocio'));

  protected readonly errorNombreNegocio = computed(() => {
    const v = this.nombreNegocio().trim();
    if (!v) return 'El nombre de tu negocio es obligatorio';
    if (v.length < 2) return 'Mínimo 2 caracteres';
    return null;
  });

  protected readonly errorNombres = computed(() => {
    const v = this.nombres().trim();
    if (!v) return 'Tus nombres son obligatorios';
    if (v.length < 2) return 'Mínimo 2 caracteres';
    return null;
  });

  protected readonly errorApellidos = computed(() => {
    const v = this.apellidos().trim();
    if (!v) return 'Tus apellidos son obligatorios';
    if (v.length < 2) return 'Mínimo 2 caracteres';
    return null;
  });

  /**
   * La misma regla que el backend, palabra por palabra: entre 5 y 20, dígitos, letras y guiones.
   * Decir aquí exactamente cuántos faltan evita el viaje al servidor para que conteste «inválido»
   * sin explicar por qué — que es lo que pasaba con un documento corto.
   */
  protected readonly errorCedula = computed(() => {
    const v = this.cedula().trim();
    if (!v) return 'El número de identificación es obligatorio';
    if (v.length < 5) return 'Debe tener al menos 5 caracteres';
    if (v.length > 20) return 'No puede superar los 20 caracteres';
    if (!/^[0-9A-Za-z-]+$/.test(v)) return 'Solo se permiten números, letras y guiones';
    return null;
  });

  protected readonly errorEmail = computed(() => {
    const v = this.email().trim();
    if (!v) return 'El correo es obligatorio';
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)) return 'Formato de correo inválido';
    return null;
  });

  /**
   * El correo se escribe dos veces a propósito. Aquí no hay OTP —el pago es la prueba de que la
   * compra es real— así que un correo mal escrito es una cuenta pagada a la que su dueño no puede
   * entrar. Confirmarlo cuesta un campo; arreglarlo después cuesta soporte.
   */
  protected readonly errorEmailConfirma = computed(() => {
    if (!this.emailConfirma().trim()) return 'Confirma tu correo';
    if (this.emailConfirma().trim().toLowerCase() !== this.email().trim().toLowerCase()) {
      return 'Los correos no coinciden';
    }
    return null;
  });

  protected readonly pasoNegocioValido = computed(
    () => !this.errorRubro() && !this.errorNombreNegocio(),
  );

  protected readonly pasoTitularValido = computed(
    () =>
      !this.errorNombres() &&
      !this.errorApellidos() &&
      !this.errorCedula() &&
      !this.errorEmail() &&
      !this.errorEmailConfirma(),
  );

  /* ── La contraseña de la cuenta ──
     Mismas reglas que en el resto del sistema (8 caracteres, una mayúscula y un número): el
     backend las vuelve a comprobar, esto solo evita el viaje. */

  protected readonly password = signal('');
  protected readonly passwordConfirma = signal('');
  protected readonly verPassword = signal(false);

  protected readonly errorPassword = computed(() => {
    const v = this.password();
    if (!v) return 'Crea una contraseña';
    if (v.length < 8) return 'Mínimo 8 caracteres';
    if (!/[A-Z]/.test(v)) return 'Debe llevar al menos una mayúscula';
    if (!/\d/.test(v)) return 'Debe llevar al menos un número';
    return null;
  });

  protected readonly errorPasswordConfirma = computed(() => {
    if (!this.passwordConfirma()) return 'Repite la contraseña';
    if (this.passwordConfirma() !== this.password()) return 'Las contraseñas no coinciden';
    return null;
  });

  protected readonly pasoCuentaValido = computed(
    () => !this.errorPassword() && !this.errorPasswordConfirma() && this.aceptaTerminos(),
  );

  /** Se puede crear la cuenta: todo lo anterior válido y un plan elegido. */
  protected readonly puedeCrearCuenta = computed(
    () =>
      this.pasoNegocioValido() &&
      this.pasoTitularValido() &&
      this.pasoCuentaValido() &&
      !!this.plan(),
  );

  /** La cuenta ya existe: de aquí en adelante solo falta pagar. */
  protected readonly cuenta = signal<CuentaCreada | null>(null);
  protected readonly cuentaLista = computed(() => this.cuenta() !== null);

  protected readonly puedePagar = computed(() => this.cuentaLista() && !!this.plan());

  /* ── Navegación entre pasos ── */

  protected readonly pasos = PASOS;

  /** En qué paso va, como índice: la barra de progreso marca hechos los anteriores. */
  protected readonly indicePaso = computed(() => PASOS.findIndex((p) => p.id === this.paso()));

  /** ¿Se puede salir del paso actual? Los complementos son opcionales: nunca bloquean. */
  private pasoActualValido(): boolean {
    switch (this.paso()) {
      case 'negocio':
        return this.pasoNegocioValido();
      case 'titular':
        return this.pasoTitularValido();
      case 'cuenta':
        return this.pasoCuentaValido();
      default:
        return true;
    }
  }

  protected siguiente(): void {
    this.tocado.set(true);
    if (!this.pasoActualValido()) return;

    const siguiente = PASOS[this.indicePaso() + 1];
    if (!siguiente) return;
    this.tocado.set(false);
    this.error.set(null);
    this.paso.set(siguiente.id);
  }

  protected atras(): void {
    // Con la cuenta ya creada no se vuelve atrás: esos datos ya no son un borrador, son una
    // cuenta de verdad. Dejar editarlos daría a entender que se puede rehacer, y no se puede.
    if (this.cuentaLista()) return;
    this.tocado.set(false);
    this.error.set(null);
    const anterior = PASOS[this.indicePaso() - 1];
    if (anterior) this.paso.set(anterior.id);
  }

  /* ── Complementos ── */

  /** Cantidad elegida de cada complemento, por código. Ausente = 0. */
  protected readonly cantidades = signal<Record<string, number>>({});

  protected cantidadDe(codigo: string): number {
    return this.cantidades()[codigo] ?? 0;
  }

  /** Sube o baja un complemento sin salirse de [0, tope del catálogo]. */
  protected cambiarCantidad(c: ComplementoVendible, delta: number): void {
    const nueva = Math.min(c.cantidad_maxima, Math.max(0, this.cantidadDe(c.codigo) + delta));
    this.cantidades.update((actual) => ({ ...actual, [c.codigo]: nueva }));
  }

  /** Lo elegido, con su subtotal — para el resumen y para mandar al backend. */
  protected readonly lineasComplemento = computed(() =>
    this.complementos()
      .map((c) => {
        const cantidad = this.cantidadDe(c.codigo);
        return { ...c, cantidad, subtotal: cantidad * c.precio };
      })
      .filter((c) => c.cantidad > 0),
  );

  /**
   * El total mensual que se ve en el resumen. Es una **vista previa**: el importe que se cobra lo
   * calcula el backend con los precios de la base, y si difiriera, manda el suyo.
   */
  protected readonly totalMensual = computed(
    () =>
      (this.plan()?.precio ?? 0) + this.lineasComplemento().reduce((suma, l) => suma + l.subtotal, 0),
  );

  /** «4 usuarios y 1 caja»: lo que el plan trae de serie, para que se entienda qué se amplía. */
  protected readonly incluidosPlan = computed(() => {
    const p = this.plan();
    if (!p) return null;
    const partes: string[] = [];
    if (p.usuarios_incluidos != null) {
      partes.push(`${p.usuarios_incluidos} usuario${p.usuarios_incluidos === 1 ? '' : 's'}`);
    }
    if (p.cajas_incluidas != null) {
      partes.push(`${p.cajas_incluidas} caja${p.cajas_incluidas === 1 ? '' : 's'}`);
    }
    return partes.length ? partes.join(' y ') : null;
  });

  protected iconoComplemento(c: ComplementoVendible): string {
    return c.amplia === 'cajas' ? 'monitor' : 'user-plus';
  }

  /**
   * Cuántos trae el plan de lo que amplía este complemento. El contador enseña el total del
   * negocio (incluidos + adicionales), así que parte de aquí y no puede bajar de aquí.
   */
  protected incluidoDe(c: ComplementoVendible): number {
    const p = this.plan();
    if (!p) return 0;
    if (c.amplia === 'usuarios') return p.usuarios_incluidos ?? 0;
    if (c.amplia === 'cajas') return p.cajas_incluidas ?? 0;
    return 0;
  }

  /** El número del contador: lo incluido más lo añadido. Al backend va solo lo añadido. */
  protected totalDe(c: ComplementoVendible): number {
    return this.incluidoDe(c) + this.cantidadDe(c.codigo);
  }

  /** «Usuarios» / «Cajas»: se pregunta por el total, no por «usuarios adicionales». */
  protected etiquetaComplemento(c: ComplementoVendible): string {
    if (c.amplia === 'usuarios') return 'Usuarios';
    if (c.amplia === 'cajas') return 'Cajas';
    return c.nombre;
  }

  /** Lo que se enseña en el resumen mientras se llena el formulario. */
  protected readonly nombreTitular = computed(() =>
    `${this.nombres().trim()} ${this.apellidos().trim()}`.trim(),
  );

  protected etiquetaRubro(nombre: string): string {
    return this.rubros().find((r) => r.nombre === nombre)?.etiqueta ?? nombre;
  }

  protected formatPrice(valor: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor);
  }

  /* ── Pago ── */

  /**
   * Crea la cuenta (apagada) y manda al checkout de la pasarela.
   *
   * La redirección la hace el navegador con `window.location`, no el router: el destino es otro
   * dominio. Si la pasarela no devuelve enlace —caso raro, o una pasarela manual— se queda en la
   * pantalla de resultado con la referencia, que es con lo que se puede reintentar.
   */
  /**
   * Crea la cuenta y pasa al pago. No cobra nada todavía.
   *
   * Es el botón «Crear y continuar». Cuando vuelve, el comprador ya tiene usuario, negocio y su
   * primer cobro esperando: el paso siguiente solo abre el checkout con esa referencia.
   */
  protected async crearCuenta(): Promise<void> {
    this.tocado.set(true);
    if (!this.puedeCrearCuenta() || this.cargando()) return;
    if (this.cuentaLista()) {
      this.paso.set('pago');
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    try {
      const cuenta = await firstValueFrom(
        this.api.crearCuenta({
          nombres: this.nombres().trim(),
          apellidos: this.apellidos().trim(),
          num_identificacion: this.cedula().trim(),
          email: this.email().trim(),
          password: this.password(),
          telefono: this.telefono().trim() || null,
          rubro: this.rubro(),
          nombre_negocio: this.nombreNegocio().trim(),
          plan: this.planPedido(),
          pasarela: this.pasarela(),
          complementos: this.lineasComplemento().map((l) => ({
            codigo: l.codigo,
            cantidad: l.cantidad,
          })),
        }),
      );

      if (!cuenta) {
        this.error.set('No pudimos crear tu cuenta. Inténtalo de nuevo.');
        return;
      }

      this.cuenta.set(cuenta);
      // La contraseña no se queda en memoria más de lo necesario: ya cumplió su función.
      this.password.set('');
      this.passwordConfirma.set('');
      this.tocado.set(false);
      this.paso.set('pago');
    } catch (err: unknown) {
      this.error.set(this.mensajeDeError(err, 'No pudimos crear tu cuenta. Inténtalo de nuevo.'));
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Abre el checkout del cobro que dejó la creación de la cuenta.
   *
   * La redirección la hace el navegador con `window.location`, no el router: el destino es otro
   * dominio. Si la pasarela no devuelve enlace —caso raro, o una pasarela manual— se queda en la
   * pantalla de resultado con la referencia, que es con lo que se puede reintentar.
   */
  protected async pagar(): Promise<void> {
    const cuenta = this.cuenta();
    if (!cuenta || this.cargando()) return;

    this.cargando.set(true);
    this.error.set(null);

    try {
      const compra = await firstValueFrom(
        this.api.reintentar(cuenta.referencia, this.pasarela()),
      );

      this.compra.set(compra);

      if (compra?.url_pago) {
        this.recordarCompra(compra);
        window.location.href = compra.url_pago;
        return;
      }

      this.paso.set('resultado');
      if (compra?.referencia) this.consultarEstado(compra.referencia);
    } catch (err: unknown) {
      this.error.set(this.mensajeDeError(err, 'No pudimos abrir el pago. Inténtalo de nuevo.'));
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * El mensaje que se enseña cuando el backend rechaza algo.
   *
   * Un 422 de express-validator trae `errors[]` con el campo y el motivo; quedarse solo con
   * «Datos inválidos» obliga a abrir las herramientas del navegador para saber qué campo fue.
   */
  private mensajeDeError(err: unknown, porDefecto: string): string {
    const cuerpo = (err as { error?: { message?: string; errors?: { msg?: string; path?: string }[] } })
      ?.error;
    const detalle = cuerpo?.errors?.[0];
    if (detalle?.msg) {
      return detalle.path ? `${detalle.msg} (${detalle.path})` : detalle.msg;
    }
    return cuerpo?.message ?? porDefecto;
  }

  /**
   * Lo que pasa al volver de la pasarela.
   *
   * Wompi vuelve con `?id=<transacción>`; dLocal no trae nada y se usa el id que se guardó al
   * salir. Con ese id se le **pide la confirmación a la pasarela** antes de mirar el estado: en
   * producción el webhook suele haberla aplicado ya, pero en local no puede llegar nunca (la
   * pasarela no ve `localhost`), y sin este paso la compra se quedaba «pendiente» para siempre.
   * Confirmar dos veces es inofensivo: la segunda responde «ya estaba pagada».
   */
  private atenderVueltaDelCheckout(): void {
    const qp = this.route.snapshot.queryParamMap;
    const enCurso = tomarPagoEnCurso();
    const referencia = qp.get('ref') ?? enCurso?.referencia ?? this.tomarReferencia();
    const idTransaccion = qp.get('id') ?? enCurso?.idExterno ?? null;

    if (!referencia && !idTransaccion) return;

    this.paso.set('resultado');
    this.cargando.set(true);

    if (!idTransaccion) {
      if (referencia) this.consultarEstado(referencia);
      return;
    }

    const pasarela = enCurso?.pasarela === 'dlocal' && !qp.get('id') ? 'dlocal' : 'wompi';
    this.pagos
      .confirmar(pasarela, idTransaccion)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // Pase lo que pase con la confirmación, el estado lo dice la base.
        next: () => referencia && this.consultarEstado(referencia),
        error: () => referencia && this.consultarEstado(referencia),
      });
  }

  /** Guarda lo necesario para reconocer la compra al volver del checkout. */
  private recordarCompra(compra: { referencia: string; id_externo: string | null }): void {
    try {
      sessionStorage.setItem(CLAVE_REFERENCIA, compra.referencia);
    } catch {
      // Sin almacenamiento se pierde la confirmación inmediata; el webhook la cierra igual.
    }
    if (compra.id_externo) {
      recordarPago({
        pasarela: this.pasarela(),
        idExterno: compra.id_externo,
        referencia: compra.referencia,
      });
    }
  }

  /** Lee y borra: una vuelta se atiende una vez, no en cada recarga. */
  private tomarReferencia(): string | null {
    try {
      const ref = sessionStorage.getItem(CLAVE_REFERENCIA);
      sessionStorage.removeItem(CLAVE_REFERENCIA);
      return ref;
    } catch {
      return null;
    }
  }

  /** Reabre el checkout de una compra que quedó pendiente. */
  protected async reintentar(): Promise<void> {
    const ref = this.estado()?.referencia ?? this.compra()?.referencia;
    if (!ref || this.cargando()) return;

    this.cargando.set(true);
    this.error.set(null);
    try {
      const pago = await firstValueFrom(this.api.reintentar(ref, this.pasarela()));
      if (pago?.url_pago) {
        this.recordarCompra({ referencia: ref, id_externo: pago.id_externo ?? null });
        window.location.href = pago.url_pago;
        return;
      }
      this.consultarEstado(ref);
    } catch (err: unknown) {
      this.error.set(this.mensajeDeError(err, 'No pudimos reabrir el pago.'));
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Pregunta por el estado de la compra al volver del checkout.
   *
   * Reintenta unas cuantas veces con espera creciente porque el pago lo confirma el **webhook**,
   * que puede llegar unos segundos después que el visitante: enseñar «pendiente» a alguien que
   * acaba de pagar es la forma más rápida de que pague dos veces.
   */
  protected consultarEstado(referencia: string): void {
    clearTimeout(this.temporizador);
    this.cargando.set(true);

    this.api
      .estado(referencia)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (estado) => {
          this.cargando.set(false);
          this.estado.set(estado);
          this.paso.set('resultado');

          if (estado?.estado === 'pendiente' && this.intentosEstado < 5) {
            this.intentosEstado += 1;
            this.temporizador = setTimeout(
              () => this.consultarEstado(referencia),
              2000 * this.intentosEstado,
            );
          }
        },
        error: () => {
          this.cargando.set(false);
          this.error.set('No encontramos esa compra. Revisa el enlace o escríbenos.');
          this.paso.set('resultado');
        },
      });
  }

  /** Reintenta las dos consultas sin recargar la página. */
  protected recargarCatalogo(): void {
    this.catalogoFallo.set(false);
    this.catalogoCargado.set(false);
    this.error.set(null);
    this.cargarCatalogo();
  }

  protected volverALanding(): void {
    this.router.navigate(['/'], { fragment: 'planes' });
  }
}
