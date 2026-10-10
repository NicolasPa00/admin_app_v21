import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import {
  CatalogosCartera,
  CuentaCartera,
  FiltrosCartera,
  MovimientoCartera,
  MovimientoInput,
  ResumenCartera,
  TarifaPasarela,
} from '../models/cartera.models';

/**
 * CarteraService — el libro de caja de EscalApp (solo super admin).
 *
 * Endpoints (admin_ws · docs/cartera.md):
 *   GET  /admin/cartera/catalogos
 *   GET  /admin/cartera/resumen?desde&hasta
 *   GET  /admin/cartera/movimientos?desde&hasta&tipo&id_cuenta&id_categoria&origen&q&anulados
 *   GET  /admin/cartera/exportar   (CSV, mismos filtros)
 *   POST /admin/cartera/movimientos · PUT /:id · POST /:id/anular
 *   POST /admin/cartera/cuentas · PUT /:id
 *   POST /admin/cartera/categorias · PUT /:id
 *   PUT  /admin/cartera/tarifas/:pasarela
 */
@Injectable({ providedIn: 'root' })
export class CarteraService {
  private readonly http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/cartera`;

  getCatalogos(): Observable<CatalogosCartera> {
    return this.http
      .get<ApiResponse<CatalogosCartera>>(`${this.API}/catalogos`)
      .pipe(map((res) => res.data as CatalogosCartera));
  }

  getResumen(desde: string, hasta: string): Observable<ResumenCartera> {
    return this.http
      .get<ApiResponse<ResumenCartera>>(`${this.API}/resumen`, {
        params: new HttpParams().set('desde', desde).set('hasta', hasta),
      })
      .pipe(map((res) => res.data as ResumenCartera));
  }

  getMovimientos(filtros: FiltrosCartera): Observable<MovimientoCartera[]> {
    return this.http
      .get<ApiResponse<MovimientoCartera[]>>(`${this.API}/movimientos`, {
        params: this.params(filtros),
      })
      .pipe(map((res) => res.data ?? []));
  }

  /** El CSV para la contadora. Va por HttpClient porque la ruta exige el Bearer. */
  exportar(filtros: FiltrosCartera): Observable<Blob> {
    return this.http.get(`${this.API}/exportar`, {
      params: this.params(filtros),
      responseType: 'blob',
    });
  }

  crearMovimiento(datos: MovimientoInput): Observable<MovimientoCartera> {
    return this.http
      .post<ApiResponse<MovimientoCartera>>(`${this.API}/movimientos`, datos)
      .pipe(map((res) => res.data as MovimientoCartera));
  }

  actualizarMovimiento(id: number, datos: Partial<MovimientoInput>): Observable<MovimientoCartera> {
    return this.http
      .put<ApiResponse<MovimientoCartera>>(`${this.API}/movimientos/${id}`, datos)
      .pipe(map((res) => res.data as MovimientoCartera));
  }

  anularMovimiento(id: number, motivo: string): Observable<unknown> {
    return this.http.post(`${this.API}/movimientos/${id}/anular`, { motivo });
  }

  guardarCuenta(datos: Partial<CuentaCartera>, id?: number): Observable<unknown> {
    return id
      ? this.http.put(`${this.API}/cuentas/${id}`, datos)
      : this.http.post(`${this.API}/cuentas`, datos);
  }

  crearCategoria(nombre: string, tipo: 'ingreso' | 'egreso'): Observable<unknown> {
    return this.http.post(`${this.API}/categorias`, { nombre, tipo });
  }

  actualizarCategoria(id: number, datos: { nombre?: string; estado?: 'A' | 'I' }): Observable<unknown> {
    return this.http.put(`${this.API}/categorias/${id}`, datos);
  }

  actualizarTarifa(t: TarifaPasarela): Observable<unknown> {
    const { pasarela, porcentaje, fijo, fijo_moneda, iva_pct, retencion_pct, nota } = t;
    return this.http.put(`${this.API}/tarifas/${pasarela}`, {
      porcentaje, fijo, fijo_moneda, iva_pct, retencion_pct, nota,
    });
  }

  private params(f: FiltrosCartera): HttpParams {
    let p = new HttpParams().set('desde', f.desde).set('hasta', f.hasta);
    if (f.tipo) p = p.set('tipo', f.tipo);
    if (f.id_cuenta) p = p.set('id_cuenta', f.id_cuenta);
    if (f.id_categoria) p = p.set('id_categoria', f.id_categoria);
    if (f.origen) p = p.set('origen', f.origen);
    if (f.q?.trim()) p = p.set('q', f.q.trim());
    if (f.anulados) p = p.set('anulados', 'true');
    return p;
  }
}
