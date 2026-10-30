import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import {
  ConfigAsistenteEscalapp,
  DatosConocimiento,
  EntradaConocimiento,
  ResumenAsistenteEscalapp,
} from '../models/asistente-escalapp.models';

/**
 * AsistenteEscalappService — el panel del WhatsApp de EscalApp. Solo super admin.
 *
 *   GET    /admin/asistente-escalapp
 *   PUT    /admin/asistente-escalapp/config
 *   GET    /admin/asistente-escalapp/conocimiento
 *   POST   /admin/asistente-escalapp/conocimiento
 *   PUT    /admin/asistente-escalapp/conocimiento/:id
 *   DELETE /admin/asistente-escalapp/conocimiento/:id
 *
 * Las conversaciones van por `BandejaService`, como las de cualquier negocio.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteEscalappService {
  private readonly http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/asistente-escalapp`;

  getResumen(): Observable<ResumenAsistenteEscalapp> {
    return this.http
      .get<ApiResponse<ResumenAsistenteEscalapp>>(this.API)
      .pipe(map((res) => res.data as ResumenAsistenteEscalapp));
  }

  guardarConfig(config: Pick<ConfigAsistenteEscalapp, 'correos_aviso' | 'url_sitio'>): Observable<ConfigAsistenteEscalapp> {
    return this.http
      .put<ApiResponse<ConfigAsistenteEscalapp>>(`${this.API}/config`, config)
      .pipe(map((res) => res.data as ConfigAsistenteEscalapp));
  }

  getConocimiento(): Observable<EntradaConocimiento[]> {
    return this.http
      .get<ApiResponse<EntradaConocimiento[]>>(`${this.API}/conocimiento`)
      .pipe(map((res) => res.data ?? []));
  }

  crear(datos: DatosConocimiento): Observable<void> {
    return this.http.post<ApiResponse<unknown>>(`${this.API}/conocimiento`, datos).pipe(map(() => undefined));
  }

  actualizar(id: number, datos: DatosConocimiento): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.API}/conocimiento/${id}`, datos)
      .pipe(map(() => undefined));
  }

  eliminar(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.API}/conocimiento/${id}`)
      .pipe(map(() => undefined));
  }
}
