import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import {
  CobroNegocio,
  CambioDePlan,
  SimulacionCambio,
  ConciliacionPagos,
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
   * El administrador cambia el plan de su negocio, sus complementos, o las dos cosas a la vez.
   *
   * Un solo endpoint para los tres casos porque son una sola cuenta: subir de plan y quitar un
   * usuario extra a la vez tiene que cobrarse por la diferencia NETA, no como dos operaciones que
   * se pisan. Quién paga qué y cuándo lo decide el backend y viene en la respuesta.
   *
   * @param idPlan `null` = deja el plan que tiene.
   * @param complementos la elección COMPLETA (lo que no venga se entiende como «quítamelo»).
   *        `null` = no toca los complementos.
   */
  cambiarMiPlan(
    idNegocio: number,
    { idPlan = null, complementos = null }:
      { idPlan?: number | null; complementos?: Array<{ codigo: string; cantidad: number }> | null },
  ): Observable<CambioDePlan | null> {
    return this.http
      .post<ApiResponse<CambioDePlan>>(`${this.API}/cobranza/mi-plan`, {
        id_negocio: idNegocio,
        ...(idPlan != null ? { id_plan: idPlan } : {}),
        ...(complementos != null ? { complementos } : {}),
      })
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Cuánto se cobraría por un cambio, sin hacerlo. Mismos parámetros que `cambiarMiPlan`; el monto
   * lo calcula el backend con la misma cuenta que el cobro real, aquí nunca se recalcula.
   */
  simularCambio(
    idNegocio: number,
    { idPlan = null, complementos = null }:
      { idPlan?: number | null; complementos?: Array<{ codigo: string; cantidad: number }> | null },
  ): Observable<SimulacionCambio | null> {
    const params: Record<string, string> = { id_negocio: String(idNegocio) };
    if (idPlan != null) params['id_plan'] = String(idPlan);
    // `[]` viaja como `complementos=` (todos a cero), igual que el POST; solo `null` los omite.
    if (complementos != null) {
      params['complementos'] = complementos.map((c) => `${c.codigo}:${c.cantidad}`).join(',');
    }
    return this.http
      .get<ApiResponse<SimulacionCambio>>(`${this.API}/cobranza/mi-plan/simular`, { params })
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Pide al backend que pregunte a la pasarela por los pagos pendientes del usuario y aplique los
   * ya aprobados. Sin pendientes responde al instante y sin llamar a nadie.
   */
  conciliarPendientes(origen: 'al_iniciar_sesion' | 'al_volver'): Observable<ConciliacionPagos | null> {
    return this.http
      .post<ApiResponse<ConciliacionPagos>>(`${this.API}/cobranza/conciliar-pendientes`, { origen })
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
