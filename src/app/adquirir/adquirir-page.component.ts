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
  ChevronRight,
  CreditCard,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Store,
  User,
} from 'lucide-angular';

import { AssetService } from '../core/services/asset.service';
import { AuthService } from '../auth/data-access/auth.service';
import { RubroPublico } from '../auth/models/auth.models';
import {
  AdquirirService,
  CompraIniciada,
  EstadoCompra,
  PasarelaDisponible,
  PlanVendible,
} from './adquirir.service';

/** Los tres pasos del formulario, más la pantalla de vuelta del checkout. */
type Paso = 'negocio' | 'titular' | 'pago' | 'resultado';

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
        ChevronRight,
        CreditCard,
        Loader2,
        Lock,
        Mail,
        ShieldCheck,
        Store,
        User,
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

    // Vuelta del checkout: la referencia manda, el formulario ya no importa.
    const ref = qp.get('ref');
    if (ref) {
      this.paso.set('resultado');
      this.consultarEstado(ref);
    }

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

  protected readonly puedePagar = computed(
    () => this.pasoNegocioValido() && this.pasoTitularValido() && this.aceptaTerminos() && !!this.plan(),
  );

  /* ── Navegación entre pasos ── */

  protected siguiente(): void {
    this.tocado.set(true);
    if (this.paso() === 'negocio' && this.pasoNegocioValido()) {
      this.tocado.set(false);
      this.error.set(null);
      this.paso.set('titular');
      return;
    }
    if (this.paso() === 'titular' && this.pasoTitularValido()) {
      this.tocado.set(false);
      this.error.set(null);
      this.paso.set('pago');
    }
  }

  protected atras(): void {
    this.tocado.set(false);
    this.error.set(null);
    if (this.paso() === 'titular') this.paso.set('negocio');
    else if (this.paso() === 'pago') this.paso.set('titular');
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
  protected async pagar(): Promise<void> {
    this.tocado.set(true);
    if (!this.puedePagar() || this.cargando()) return;

    this.cargando.set(true);
    this.error.set(null);

    try {
      const compra = await firstValueFrom(
        this.api.iniciar({
          nombres: this.nombres().trim(),
          apellidos: this.apellidos().trim(),
          num_identificacion: this.cedula().trim(),
          email: this.email().trim(),
          telefono: this.telefono().trim() || null,
          rubro: this.rubro(),
          nombre_negocio: this.nombreNegocio().trim(),
          plan: this.planPedido(),
          pasarela: this.pasarela(),
        }),
      );

      this.compra.set(compra);

      if (compra?.url_pago) {
        window.location.href = compra.url_pago;
        return;
      }

      this.paso.set('resultado');
      if (compra?.referencia) this.consultarEstado(compra.referencia);
    } catch (err: unknown) {
      this.error.set(this.mensajeDeError(err, 'No pudimos iniciar la compra. Inténtalo de nuevo.'));
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

  /** Reabre el checkout de una compra que quedó pendiente. */
  protected async reintentar(): Promise<void> {
    const ref = this.estado()?.referencia ?? this.compra()?.referencia;
    if (!ref || this.cargando()) return;

    this.cargando.set(true);
    this.error.set(null);
    try {
      const pago = await firstValueFrom(this.api.reintentar(ref, this.pasarela()));
      if (pago?.url_pago) {
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
