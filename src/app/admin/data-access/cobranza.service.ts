import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import {
  CobroNegocio,
  CambioDePlan,
  CobroResultado,
  CodigoPasarela,
  EstadoSuscripcion,
  InicioPago,
  Factura,
  FilaCartera,
  IngresoMes,
  PagoManual,
  ResumenCobro,
} from '../models/cobranza.models';

/**
 * CobranzaService — el cobro de NUESTRAS mensualidades (Super Admin).
 *
 * Endpoints (admin_ws · docs/cobro-mensualidades.md §4):
 *   GET  /admin/cobranza/cartera
 *   GET  /admin/cobranza/ingresos
 *   GET  /admin/cobranza/mi-suscripcion?id_negocio=N
 *   POST /admin/cobranza/negocios/:id/facturas
 *   POST /admin/cobranza/facturas/:id/pago-manual
 *   POST /admin/cobranza/facturas/:id/anular
 */
@Injectable({ providedIn: 'root' })
export class CobranzaService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  getCartera(filtros: { estado?: EstadoSuscripcion | ''; q?: string } = {}): Observable<FilaCartera[]> {
    let params = new HttpParams();
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.q) params = params.set('q', filtros.q);

    return this.http
      .get<ApiResponse<FilaCartera[]>>(`${this.API}/cobranza/cartera`, { params })
      .pipe(map((res) => res.data ?? []));
  }

  getIngresos(meses = 6): Observable<IngresoMes[]> {
    return this.http
      .get<ApiResponse<IngresoMes[]>>(`${this.API}/cobranza/ingresos`, {
        params: new HttpParams().set('meses', meses),
      })
      .pipe(map((res) => res.data ?? []));
  }

  /** El detalle de un negocio: su suscripción y sus facturas. */
  getResumen(idNegocio: number): Observable<ResumenCobro | null> {
    return this.http
      .get<ApiResponse<ResumenCobro>>(`${this.API}/cobranza/mi-suscripcion`, {
        params: new HttpParams().set('id_negocio', idNegocio),
      })
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Genera la factura del siguiente período. Es idempotente en el backend: si ya existe la de
   * ese mes, la devuelve en vez de crear otra.
   */
  generarFactura(idNegocio: number, desde: string | null = null): Observable<Factura | null> {
    return this.http
      .post<ApiResponse<Factura>>(`${this.API}/cobranza/negocios/${idNegocio}/facturas`, { desde })
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Cobra por la pasarela de la factura (el «reintentar» de la consola).
   *
   * `estado` puede volver `pendiente` con una `urlPago`: significa que hay que mandarle el link
   * al cliente, no que ya pagó. La pantalla debe decirlo así.
   */
  cobrarPorPasarela(idFactura: number): Observable<CobroResultado | null> {
    return this.http
      .post<ApiResponse<CobroResultado>>(`${this.API}/cobranza/facturas/${idFactura}/cobrar`, {})
      .pipe(map((res) => res.data ?? null));
  }

  /** «Mis pagos»: los negocios que administra el usuario de la sesión, con lo que deben. */
  getMisCobros(): Observable<CobroNegocio[]> {
    return this.http
      .get<ApiResponse<CobroNegocio[]>>(`${this.API}/cobranza/mis-cobros`)
      .pipe(map((res) => res.data ?? []));
  }

  /**
   * El administrador elige el plan de su negocio. Si hay un cobro pendiente, queda por el valor
   * del plan nuevo; si no, se cobrará en la próxima mensualidad.
   */
  elegirPlan(idNegocio: number, idPlan: number): Observable<CambioDePlan | null> {
    return this.http
      .post<ApiResponse<CambioDePlan>>(`${this.API}/cobranza/mi-plan`, {
        id_negocio: idNegocio,
        id_plan: idPlan,
      })
      .pipe(map((res) => res.data ?? null));
  }

  /** El administrador paga desde la app. Devuelve el link del checkout o las instrucciones. */
  pagarFactura(idFactura: number, pasarela: CodigoPasarela): Observable<InicioPago | null> {
    return this.http
      .post<ApiResponse<InicioPago>>(`${this.API}/cobranza/facturas/${idFactura}/pagar`, { pasarela })
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Confirma un pago de Wompi por el id de su transacción (pantalla de resultado de Wompi o su
   * panel). El estado lo consulta el backend a Wompi; aquí solo viaja el id.
   */
  verificarPagoWompi(
    idTransaccion: string,
  ): Observable<{ estado: 'aprobada' | 'pendiente' | 'rechazada' | 'desconocida' } | null> {
    return this.http
      .post<ApiResponse<{ estado: 'aprobada' | 'pendiente' | 'rechazada' | 'desconocida' }>>(
        `${this.API}/cobranza/wompi/verificar`,
        { id_transaccion: idTransaccion },
      )
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Confirma un pago al volver del checkout, desde la app con sesión.
   *
   * Usa el endpoint **público** de confirmación a propósito: es el mismo camino que el webhook
   * —le pregunta el estado a la pasarela y solo entonces aplica el pago—, es idempotente, y del
   * navegador únicamente acepta el id. No hace falta una segunda ruta autenticada que mantener.
   */
  confirmarPago(
    pasarela: CodigoPasarela,
    idTransaccion: string,
  ): Observable<{ estado: 'aprobada' | 'pendiente' | 'rechazada' | 'desconocida' } | null> {
    return this.http
      .post<ApiResponse<{ estado: 'aprobada' | 'pendiente' | 'rechazada' | 'desconocida' }>>(
        `${this.API}/publico/cobranza/confirmar`,
        { pasarela, id_transaccion: idTransaccion },
      )
      .pipe(map((res) => res.data ?? null));
  }

  registrarPago(idFactura: number, pago: PagoManual): Observable<Factura | null> {
    return this.http
      .post<ApiResponse<Factura>>(`${this.API}/cobranza/facturas/${idFactura}/pago-manual`, pago)
      .pipe(map((res) => res.data ?? null));
  }

  anularFactura(idFactura: number, motivo: string): Observable<Factura | null> {
    return this.http
      .post<ApiResponse<Factura>>(`${this.API}/cobranza/facturas/${idFactura}/anular`, { motivo })
      .pipe(map((res) => res.data ?? null));
  }
}
