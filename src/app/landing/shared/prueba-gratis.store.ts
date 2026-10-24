import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../auth/data-access/auth.service';
import { AnaliticaService } from '../../core/services/analitica.service';

/**
 * El registro de prueba gratuita, sin su aspecto.
 *
 * ## Por qué es un store y no un componente
 *
 * El embudo es el mismo en todas las páginas públicas —datos, código al correo, cuenta creada— y
 * repetirlo sería garantizar que un día uno de los dos deje de mandar `creo_negocio` a la
 * analítica. Lo que NO se puede compartir es el aspecto: la landing viva se pinta con los tokens
 * `--es-*` (violeta #8B5CF6, degradados, sombras) y la página de restaurantes con la paleta medida
 * `--r-*` sobre campos planos. Un componente único acabaría con un interruptor de tema dentro, que
 * es peor que dos plantillas.
 *
 * Así que aquí viven el estado y las cuatro llamadas, y cada página escribe su propio modal contra
 * él. Se provee **por componente**, no en la raíz: dos páginas en el mismo historial no comparten
 * el formulario a medio llenar.
 */

export type PasoPrueba = 'form' | 'otp' | 'success';

/** Un oficio del desplegable. `nombre` es lo que viaja al backend. */
export interface OficioPrueba {
  nombre: string;
  label: string;
}

/**
 * Los oficios que ofrece el desplegable (espejo de `RUBROS_REGISTRO` en `landing.component.ts`).
 *
 * El catálogo tiene más de quince y ofrecerlos todos prometía cosas que el producto aún no atiende
 * igual de bien. Aquí van solo los que están completos y en producción.
 */
const OFICIOS_REGISTRO = [
  'RESTAURANTE',
  'COMIDAS RAPIDAS',
  'CAFETERIA',
  'BAR',
  'BARBERIA',
  'SALON DE BELLEZA',
];

/**
 * Lo que se pinta mientras la API no conteste — y lo que se queda si no contesta nunca.
 *
 * Durante el prerender no hay a quién preguntar: la página se genera en el build con la API
 * apagada. Un desplegable vacío sería una página rota; uno desactualizado, como mucho, un error
 * claro al registrarse, porque lo que elija el visitante se valida contra la base.
 */
const OFICIOS_RESPALDO: OficioPrueba[] = [
  { nombre: 'RESTAURANTE', label: 'Restaurante' },
  { nombre: 'COMIDAS RAPIDAS', label: 'Comidas rápidas' },
  { nombre: 'CAFETERIA', label: 'Cafetería' },
  { nombre: 'BAR', label: 'Bar' },
  { nombre: 'BARBERIA', label: 'Barbería' },
  { nombre: 'SALON DE BELLEZA', label: 'Salón de belleza' },
];

const MAX_REENVIOS = 3;

@Injectable()
export class PruebaGratisStore {
  private readonly auth = inject(AuthService);
  private readonly analitica = inject(AnaliticaService);
  private readonly destroyRef = inject(DestroyRef);

  // ── Estado de la capa ──
  readonly abierto = signal(false);
  readonly paso = signal<PasoPrueba>('form');

  // ── Paso 1 ──
  readonly nombre = signal('');
  readonly cedula = signal('');
  readonly email = signal('');
  readonly oficio = signal('');
  readonly nombreNegocio = signal('');

  readonly nombreTocado = signal(false);
  readonly cedulaTocada = signal(false);
  readonly emailTocado = signal(false);
  readonly oficioTocado = signal(false);
  readonly nombreNegocioTocado = signal(false);

  // ── Paso 2 ──
  readonly codigo = signal('');
  readonly codigoTocado = signal(false);
  readonly reenvios = signal(0);
  readonly editandoCorreo = signal(false);
  private correoAntesDeCambiar = '';

  // ── Compartido ──
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly nombreCreado = signal('');
  readonly cedulaCreada = signal('');

  readonly oficios = signal<OficioPrueba[]>(OFICIOS_RESPALDO);

  /** La posición de la página antes de congelarla, para devolverla al cerrar. */
  private scrollCongelado = 0;

  // ── Validaciones ──

  readonly nombreError = computed(() => {
    const v = this.nombre().trim();
    if (!v) return 'El nombre completo es obligatorio';
    if (v.length < 2) return 'Mínimo 2 caracteres';
    return null;
  });

  readonly cedulaError = computed(() => {
    const v = this.cedula().trim();
    if (!v) return 'El número de cédula es obligatorio';
    if (v.length < 3) return 'Mínimo 3 caracteres';
    if (!/^\d+$/.test(v)) return 'Solo se permiten números';
    return null;
  });

  readonly emailError = computed(() => {
    const v = this.email().trim();
    if (!v) return 'El correo electrónico es obligatorio';
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v))
      return 'Formato de correo inválido';
    return null;
  });

  readonly oficioError = computed(() => (this.oficio() ? null : 'Selecciona el tipo de negocio'));

  readonly nombreNegocioError = computed(() => {
    const v = this.nombreNegocio().trim();
    if (!v) return 'El nombre del negocio es obligatorio';
    if (v.length < 2) return 'Mínimo 2 caracteres';
    return null;
  });

  readonly formularioValido = computed(
    () =>
      !this.nombreError() &&
      !this.cedulaError() &&
      !this.emailError() &&
      !this.oficioError() &&
      !this.nombreNegocioError(),
  );

  readonly codigoError = computed(() => {
    const v = this.codigo().trim();
    if (!v) return 'El código es obligatorio';
    if (!/^\d{6}$/.test(v)) return 'El código debe tener exactamente 6 dígitos';
    return null;
  });

  readonly reenvioBloqueado = computed(() => this.reenvios() >= MAX_REENVIOS || this.cargando());

  readonly reenvioEtiqueta = computed(() => {
    const quedan = MAX_REENVIOS - this.reenvios();
    if (quedan <= 0) return 'Límite de reenvíos alcanzado';
    return `Reenviar código (${quedan} ${quedan === 1 ? 'intento restante' : 'intentos restantes'})`;
  });

  // ── Catálogo ──

  /**
   * Pide el catálogo real. Se llama desde `afterNextRender`: en el prerender no hay API. Si falla
   * se conserva el respaldo, que es lo que ya está pintado.
   *
   * @param nombres los oficios que ofrece ESTA página (por defecto, los de restaurante y los de
   *        siempre). `/reservas` pasa los suyos: el store es de cada componente, así que no se pisan.
   */
  cargarOficios(nombres: readonly string[] = OFICIOS_REGISTRO): void {
    this.auth
      .getRubrosPublicos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rubros) => {
          if (!rubros.length) return;
          const elegidos = nombres.map((nombre) => {
            const r = rubros.find((x) => x.nombre === nombre);
            return r ? { nombre: r.nombre, label: r.etiqueta || r.nombre } : null;
          }).filter((o): o is OficioPrueba => !!o);
          if (elegidos.length) this.oficios.set(elegidos);
        },
        error: () => {
          /* se conserva OFICIOS_RESPALDO */
        },
      });
  }

  // ── Acciones ──

  /**
   * @param oficioPorDefecto el oficio ya elegido. `/restaurantes` entra con RESTAURANTE: la página
   *        entera habla de eso, así que volver a preguntarlo es un paso de más.
   */
  abrir(oficioPorDefecto?: string): void {
    this.abierto.set(true);
    this.paso.set('form');
    this.error.set(null);
    this.editandoCorreo.set(false);
    if (oficioPorDefecto && !this.oficio()) this.oficio.set(oficioPorDefecto);
    this.congelarFondo(true);
    this.analitica.evento('abrio_modal_prueba');
  }

  cerrar(): void {
    this.abierto.set(false);
    this.congelarFondo(false);
  }

  /** Paso 1: manda el código al correo. */
  async enviarCodigo(): Promise<void> {
    this.nombreTocado.set(true);
    this.cedulaTocada.set(true);
    this.emailTocado.set(true);
    this.oficioTocado.set(true);
    this.nombreNegocioTocado.set(true);

    if (!this.formularioValido() || this.cargando()) return;

    this.cargando.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.auth.enviarCodigoTrial(this.datosRegistro()));
      this.codigo.set('');
      this.codigoTocado.set(false);
      this.paso.set('otp');
      // El oficio viaja porque es la única segmentación útil aquí.
      this.analitica.evento('pidio_codigo', { tipo_negocio: this.oficio() });
    } catch (err: unknown) {
      this.error.set(this.mensajeDe(err, 'Error al enviar el código. Inténtalo de nuevo.'));
    } finally {
      this.cargando.set(false);
    }
  }

  async reenviarCodigo(): Promise<void> {
    if (this.reenvioBloqueado()) return;

    this.cargando.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.auth.enviarCodigoTrial(this.datosRegistro()));
      this.reenvios.update((n) => n + 1);
      this.codigo.set('');
    } catch (err: unknown) {
      this.error.set(this.mensajeDe(err, 'Error al reenviar el código.'));
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Corregir el correo sin salir del paso. La única salida a un correo mal escrito era cerrar el
   * modal y volver a llenarlo todo; el resto de datos se conserva.
   */
  cambiarCorreo(): void {
    this.correoAntesDeCambiar = this.email();
    this.emailTocado.set(false);
    this.error.set(null);
    this.editandoCorreo.set(true);
  }

  cancelarCambioCorreo(): void {
    this.email.set(this.correoAntesDeCambiar);
    this.error.set(null);
    this.editandoCorreo.set(false);
  }

  async confirmarCambioCorreo(): Promise<void> {
    this.emailTocado.set(true);
    if (this.emailError() || this.cargando()) return;

    const nuevo = this.email().trim();
    if (nuevo.toLowerCase() === this.correoAntesDeCambiar.trim().toLowerCase()) {
      this.editandoCorreo.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.auth.enviarCodigoTrial({ ...this.datosRegistro(), email: nuevo }));
      // Correo nuevo, cuenta nueva de reenvíos: los gastados eran para la dirección equivocada.
      this.reenvios.set(0);
      this.codigo.set('');
      this.codigoTocado.set(false);
      this.editandoCorreo.set(false);
    } catch (err: unknown) {
      this.error.set(
        this.mensajeDe(err, 'No pudimos enviar el código a ese correo. Inténtalo de nuevo.'),
      );
    } finally {
      this.cargando.set(false);
    }
  }

  /** Paso 2: verifica el código y crea la cuenta. */
  async verificarCodigo(): Promise<void> {
    this.codigoTocado.set(true);
    if (this.codigoError() || this.cargando()) return;

    this.cargando.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.auth.verificarYCrearTrial({ email: this.email().trim(), code: this.codigo().trim() }),
      );
      this.nombreCreado.set(res.data?.nombre ?? this.nombre().split(' ')[0]);
      this.cedulaCreada.set(res.data?.numIdentificacion ?? this.cedula().trim());
      this.paso.set('success');
      // La conversión del embudo público: aquí ya existe el negocio con su prueba de 30 días. Es la
      // que se le declara a Meta como CompleteRegistration. No viaja ni el correo ni la cédula.
      this.analitica.evento('verifico_codigo', { tipo_negocio: this.oficio() });
      this.analitica.evento('creo_negocio', { tipo_negocio: this.oficio() });
    } catch (err: unknown) {
      this.error.set(
        this.mensajeDe(err, 'Código incorrecto o expirado. Verifica e intenta de nuevo.'),
      );
    } finally {
      this.cargando.set(false);
    }
  }

  // ── Interno ──

  private datosRegistro() {
    return {
      email: this.email().trim(),
      nombre_completo: this.nombre().trim(),
      num_identificacion: this.cedula().trim(),
      tipo_negocio: this.oficio(),
      nombre_negocio: this.nombreNegocio().trim(),
    };
  }

  private mensajeDe(err: unknown, porDefecto: string): string {
    return (err as { error?: { message?: string } })?.error?.message ?? porDefecto;
  }

  /**
   * Congela la página detrás de la capa.
   *
   * Fija el body a la altura en la que estaba (`top: -scrollY`), que se ve igual pero no depende de
   * que el documento siga siendo desplazable, y al soltar devuelve la posición. Por eso la capa
   * lleva `role="dialog"` pero NO `aria-modal`: esa regla global vuelve a recortar el scroll.
   */
  private congelarFondo(activo: boolean): void {
    if (typeof document === 'undefined') return;
    const body = document.body;

    // Congelar dos veces seguidas leería `scrollY = 0` —el body ya está fijo— y al soltar mandaría
    // al visitante al principio de la página.
    if (activo === (body.style.position === 'fixed')) return;

    if (activo) {
      this.scrollCongelado = window.scrollY;
      body.style.position = 'fixed';
      body.style.top = `-${this.scrollCongelado}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      return;
    }

    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    window.scrollTo(0, this.scrollCongelado);
  }
}
