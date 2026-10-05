import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import {
  ConsumoIa,
  MovimientoIa,
  NuevoMovimientoIa,
  VentanaConsumo,
} from '../models/consumo-ia.models';

/**
 * ConsumoIaService — gasto de OpenAI, saldo estimado y recargas. Solo Super Admin.
 *
 * Endpoints (admin_ws):
 *   GET    /admin/consumo-ia?dias=&forzar=
 *   POST   /admin/consumo-ia/movimientos
 *   DELETE /admin/consumo-ia/movimientos/:id
 */
@Injectable({ providedIn: 'root' })
export class ConsumoIaService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  getResumen(dias: VentanaConsumo, forzar = false): Observable<ConsumoIa> {
    let params = new HttpParams().set('dias', dias);
    if (forzar) params = params.set('forzar', 'true');
    return this.http
      .get<ApiResponse<ConsumoIa>>(`${this.API}/consumo-ia`, { params })
      .pipe(map((res) => res.data as ConsumoIa));
  }

  registrarMovimiento(mov: NuevoMovimientoIa): Observable<MovimientoIa> {
    return this.http
      .post<ApiResponse<MovimientoIa>>(`${this.API}/consumo-ia/movimientos`, mov)
      .pipe(map((res) => res.data as MovimientoIa));
  }

  anularMovimiento(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.API}/consumo-ia/movimientos/${id}`)
      .pipe(map(() => undefined));
  }
}
