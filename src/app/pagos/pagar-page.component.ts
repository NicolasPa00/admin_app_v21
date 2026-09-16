import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { AssetService } from '../core/services/asset.service';
import { PagosPublicosService } from './pagos-publicos.service';
import {
  CobroNegocio,
  CodigoPasarela,
  FacturaPendiente,
  InicioPago,
} from '../admin/models/cobranza.models';

type Paso = 'consulta' | 'buscando' | 'resultado';

/**
 * PagarPageComponent — pagar la mensualidad SIN iniciar sesión.
 *
 * Existe porque exigir login para pagar es la forma más eficaz de que no paguen: el dueño que
 * olvidó la contraseña no la va a recuperar para darnos dinero. Con su número de identificación
 * ve lo que debe y lo paga.
 *
 * ## Lo que esta página NO muestra, a propósito
 *
 * El nombre del negocio llega enmascarado desde el backend («RES******** CHA****»), y no hay ni
 * correo, ni teléfono, ni fechas del plan. Cualquiera puede escribir una cédula aquí: la página
 * enseña lo imprescindible para pagar y nada que sirva para otra cosa.
 *
 * ## Pagar nunca cobra una tarjeta guardada
 *
 * Siempre lleva al checkout de la pasarela, donde el pagador pone su medio. Lo garantiza el
 * backend; se repite aquí para que nadie «optimice» la página con un botón de pago en un clic.
 *
 * Usa los tokens `--es-*` de la landing: el visitante llega sin sesión y la página debe parecerse
 * al sitio público, no al panel.
 */
@Component({
  selector: 'app-pagar-page',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pagar-page.component.html',
  styleUrl: './pagar-page.component.scss',
})
export class PagarPageComponent {
  private readonly api = inject(PagosPublicosService);
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly assetService = inject(AssetService);

  protected readonly paso = signal<Paso>('consulta');
  protected readonly identificacion = signal('');
  protected readonly cobros = signal<CobroNegocio[]>([]);
  protected readonly error = signal<string | null>(null);

  /** Referencia + pasarela que se está procesando, para deshabilitar solo ese botón. */
  protected readonly procesando = signal<string | null>(null);

  /** Instrucciones de transferencia, cuando se eligió pagar así. */
  protected readonly transferencia = signal<InicioPago | null>(null);

  private readonly route = inject(ActivatedRoute);

  /** `?estado=ok`: vuelta genérica, sin id de transacción que confirmar. */
  private readonly query = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('estado'))), {
    initialValue: null,
  });

  /**
   * Resultado de confirmar el pago al volver del checkout. Wompi devuelve al cliente con
   * `?id=<transacción>` y con ese id el backend le pregunta a Wompi el estado real.
   */
  protected readonly confirmacion = signal<
    'confirmando' | 'aprobada' | 'pendiente' | 'rechazada' | 'desconocida' | null
  >(null);
  protected readonly volvioDePagar = computed(
    () => this.query() === 'ok' || this.confirmacion() !== null,
  );

  constructor() {
    // Solo en el navegador: la ruta se prerenderiza y ahí no hay query ni a quién preguntar.
    if (!isPlatformBrowser(this.platformId)) return;

    const id = this.route.snapshot.queryParamMap.get('id');
    if (!id) return;

    // Hoy solo Wompi devuelve con `?id=`. Cuando dLocal tenga su vuelta, se distingue aquí.
    this.confirmacion.set('confirmando');
    this.api.confirmar('wompi', id).subscribe({
      next: (r) => this.confirmacion.set(r?.estado ?? 'pendiente'),
      // Si no se pudo confirmar ahora, no es un rechazo: el webhook puede cerrarlo después.
      error: () => this.confirmacion.set('pendiente'),
    });
  }

  protected readonly totalAdeudado = computed(() =>
    this.cobros().reduce((suma, c) => suma + c.facturas.reduce((s, f) => s + Number(f.total), 0), 0),
  );

  protected consultar(): void {
    const id = this.identificacion().trim();
    if (id.length < 5) {
      this.error.set('Escribe tu número de identificación completo.');
      return;
    }

    this.error.set(null);
    this.transferencia.set(null);
    this.paso.set('buscando');

    this.api.consultar(id).subscribe({
      next: (cobros) => {
        this.cobros.set(cobros);
        this.paso.set('resultado');
      },
      error: (err) => {
        this.paso.set('consulta');
        this.error.set(this.mensajeDeError(err, 'No pudimos hacer la consulta. Intenta de nuevo.'));
      },
    });
  }

  protected pagar(factura: FacturaPendiente, pasarela: CodigoPasarela): void {
    const clave = `${factura.referencia}:${pasarela}`;
    this.procesando.set(clave);
    this.error.set(null);
    this.transferencia.set(null);

    this.api.pagar(this.identificacion().trim(), factura.referencia, pasarela).subscribe({
      next: (r) => {
        this.procesando.set(null);
        if (!r) return;

        if (r.urlPago) {
          // Solo en el navegador: esta ruta se prerenderiza y en el servidor no hay `window`.
          if (isPlatformBrowser(this.platformId)) window.location.href = r.urlPago;
          return;
        }
        this.transferencia.set(r);
      },
      error: (err) => {
        this.procesando.set(null);
        this.error.set(this.mensajeDeError(err, 'No pudimos iniciar el pago. Intenta de nuevo.'));
      },
    });
  }

  protected volver(): void {
    this.paso.set('consulta');
    this.cobros.set([]);
    this.transferencia.set(null);
    this.error.set(null);
  }

  protected dinero(valor: number | string, moneda = 'COP'): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: moneda || 'COP',
      maximumFractionDigits: 0,
    }).format(Number(valor ?? 0));
  }

  protected fecha(valor: string): string {
    return String(valor ?? '').slice(0, 10);
  }

  protected etiquetaPasarela(codigo: CodigoPasarela, nombre: string): string {
    if (codigo === 'wompi') return 'PSE, Nequi o tarjeta';
    if (codigo === 'dlocal') return 'Tarjeta o medios locales';
    if (codigo === 'manual') return 'Transferencia bancaria';
    return nombre;
  }

  private mensajeDeError(err: unknown, porDefecto: string): string {
    const e = err as { status?: number; error?: { message?: string } };
    if (e?.status === 429) return 'Hiciste demasiadas consultas seguidas. Espera unos minutos.';
    return e?.error?.message || porDefecto;
  }
}
