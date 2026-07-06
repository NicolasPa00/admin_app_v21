import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import {
  AuditCatalogo,
  AuditDato,
  AuditEvento,
  AuditFiltros,
  AuditPage,
} from '../models/auditoria.models';

/**
 * AuditoriaService — consulta de auditoría para el Super Admin.
 *
 * Endpoints (admin_ws):
 *   GET /admin/auditoria/datos           (cambios de datos, paginado)
 *   GET /admin/auditoria/eventos         (eventos de aplicación, paginado)
 *   GET /admin/auditoria/catalogo        (valores para filtros)
 *   GET /admin/auditoria/{datos|eventos}/export → CSV
 */
@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  private buildParams(filtros: AuditFiltros): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filtros)) {
      if (value !== undefined && value !== null && `${value}` !== '') {
        params = params.set(key, `${value}`);
      }
    }
    return params;
  }

  getDatos(filtros: AuditFiltros = {}): Observable<AuditPage<AuditDato>> {
    return this.http
      .get<ApiResponse<AuditPage<AuditDato>>>(`${this.API}/auditoria/datos`, {
        params: this.buildParams(filtros),
      })
      .pipe(map((res) => res.data ?? { total: 0, page: 1, limit: 25, rows: [] }));
  }

  getEventos(filtros: AuditFiltros = {}): Observable<AuditPage<AuditEvento>> {
    return this.http
      .get<ApiResponse<AuditPage<AuditEvento>>>(`${this.API}/auditoria/eventos`, {
        params: this.buildParams(filtros),
      })
      .pipe(map((res) => res.data ?? { total: 0, page: 1, limit: 25, rows: [] }));
  }

  getCatalogo(): Observable<AuditCatalogo> {
    return this.http
      .get<ApiResponse<AuditCatalogo>>(`${this.API}/auditoria/catalogo`)
      .pipe(map((res) => res.data ?? { tablas: [], modulos: [], negocios: [] }));
  }

  /** Descarga el CSV (con el token del interceptor) y dispara el guardado en el navegador. */
  exportCsv(tipo: 'datos' | 'eventos', filtros: AuditFiltros = {}): Observable<void> {
    return this.http
      .get(`${this.API}/auditoria/${tipo}/export`, {
        params: this.buildParams(filtros),
        responseType: 'blob',
      })
      .pipe(
        map((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `auditoria_${tipo}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }),
      );
  }
}
