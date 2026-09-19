import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import { ApiResponse } from '../auth/models/auth.models';
import { CobroNegocio, CodigoPasarela, InicioPago } from '../admin/models/cobranza.models';

/**
 * PagosPublicosService — el portal de pagos SIN sesión (/pagar).
 *
 * Endpoints (admin_ws):
 *   POST /admin/publico/cobranza/consultar  { identificacion }
 *   POST /admin/publico/cobranza/pagar      { identificacion, referencia, pasarela }
 *
 * Van por POST y no por GET a propósito: la cédula viaja en el cuerpo, no en la URL, que es lo
 * que acaba en los logs del proxy y en el historial del navegador.
 */
@Injectable({ providedIn: 'root' })
export class PagosPublicosService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  consultar(identificacion: string): Observable<CobroNegocio[]> {
    return this.http
      .post<ApiResponse<CobroNegocio[]>>(`${this.API}/publico/cobranza/consultar`, { identificacion })
      .pipe(map((res) => res.data ?? []));
  }

  pagar(identificacion: string, referencia: string, pasarela: CodigoPasarela): Observable<InicioPago | null> {
    return this.http
      .post<ApiResponse<InicioPago>>(`${this.API}/publico/cobranza/pagar`, {
        identificacion,
        referencia,
        pasarela,
      })
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Confirma un pago al volver del checkout. Solo se envía el id de la transacción: el estado lo
   * pregunta el backend a la pasarela, nunca se deduce de la URL.
   */
  confirmar(
    pasarela: 'wompi' | 'dlocal',
    idTransaccion: string,
  ): Observable<{ estado: 'aprobada' | 'pendiente' | 'rechazada' | 'desconocida' } | null> {
    return this.http
      .post<ApiResponse<{ estado: 'aprobada' | 'pendiente' | 'rechazada' | 'desconocida' }>>(
        `${this.API}/publico/cobranza/confirmar`,
        { pasarela, id_transaccion: idTransaccion },
      )
      .pipe(map((res) => res.data ?? null));
  }
}
