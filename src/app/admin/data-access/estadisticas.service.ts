import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import { EstadisticasPlataforma } from '../models/estadisticas.models';

/**
 * EstadisticasService — las cifras acumuladas de toda la plataforma, para el Super Admin.
 *
 * Endpoint (admin_ws):
 *   GET /admin/estadisticas/plataforma?desde=&hasta=
 *
 * Sin rango devuelve el recorrido completo desde el primer día, que es el caso normal de esta
 * vista: se abre para enseñar todo lo que lleva andado el sistema.
 */
@Injectable({ providedIn: 'root' })
export class EstadisticasService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  getPlataforma(desde?: string | null, hasta?: string | null): Observable<EstadisticasPlataforma> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);

    return this.http
      .get<ApiResponse<EstadisticasPlataforma>>(`${this.API}/estadisticas/plataforma`, { params })
      .pipe(map((res) => res.data as EstadisticasPlataforma));
  }
}
