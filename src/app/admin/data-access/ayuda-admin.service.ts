import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Respuesta } from '../../ayuda/ayuda.models';
import {
  AyudaAplicativoAdmin,
  AyudaMetricas,
  AyudaModuloAdmin,
  AyudaTemaAdmin,
  AyudaTemaLista,
} from '../models/ayuda-admin.models';

/**
 * AyudaAdminService — el CRUD del Centro de ayuda (solo super admin).
 *
 * Ver `admin_ws/docs/centro-de-ayuda.md`. Va contra `/ayuda/admin/*`, que **sí** lleva token:
 * el `authInterceptor` adjunta el Bearer porque esas URLs no están en su lista de públicas (solo
 * lo están las de lectura del catálogo, una por una y nunca el prefijo `/ayuda/` suelto).
 *
 * Endpoints:
 *   GET   /ayuda/admin/aplicativos
 *   POST  /ayuda/admin/aplicativos          ·  PUT /ayuda/admin/aplicativos/:id
 *   GET   /ayuda/admin/modulos?id_aplicativo=
 *   POST  /ayuda/admin/modulos              ·  PUT /ayuda/admin/modulos/:id
 *   GET   /ayuda/admin/temas?id_modulo=&id_aplicativo=&sin_video=
 *   GET   /ayuda/admin/temas/:id
 *   POST  /ayuda/admin/temas                ·  PUT /ayuda/admin/temas/:id
 *   PATCH /ayuda/admin/:entidad/:id/estado
 *   GET   /ayuda/admin/metricas?dias=
 */
@Injectable({ providedIn: 'root' })
export class AyudaAdminService {
  private readonly http = inject(HttpClient);
  private readonly API = `${environment.ayudaApiUrl}/admin`;

  getAplicativos(): Observable<AyudaAplicativoAdmin[]> {
    return this.http
      .get<Respuesta<AyudaAplicativoAdmin[]>>(`${this.API}/aplicativos`)
      .pipe(map((r) => r.data ?? []));
  }

  getModulos(idAplicativo?: number | null): Observable<AyudaModuloAdmin[]> {
    let params = new HttpParams();
    if (idAplicativo) params = params.set('id_aplicativo', String(idAplicativo));
    return this.http
      .get<Respuesta<AyudaModuloAdmin[]>>(`${this.API}/modulos`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  getTemas(filtros: {
    idModulo?: number | null;
    idAplicativo?: number | null;
    sinVideo?: boolean | null;
  } = {}): Observable<AyudaTemaLista[]> {
    let params = new HttpParams();
    if (filtros.idModulo) params = params.set('id_modulo', String(filtros.idModulo));
    if (filtros.idAplicativo) params = params.set('id_aplicativo', String(filtros.idAplicativo));
    if (filtros.sinVideo != null) params = params.set('sin_video', String(filtros.sinVideo));
    return this.http
      .get<Respuesta<AyudaTemaLista[]>>(`${this.API}/temas`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  getTema(idTema: number): Observable<AyudaTemaAdmin> {
    return this.http
      .get<Respuesta<AyudaTemaAdmin>>(`${this.API}/temas/${idTema}`)
      .pipe(map((r) => r.data as AyudaTemaAdmin));
  }

  guardarModulo(datos: Partial<AyudaModuloAdmin>, id?: number | null): Observable<{ id_modulo: number }> {
    const url = id ? `${this.API}/modulos/${id}` : `${this.API}/modulos`;
    const peticion = id
      ? this.http.put<Respuesta<{ id_modulo: number }>>(url, datos)
      : this.http.post<Respuesta<{ id_modulo: number }>>(url, datos);
    return peticion.pipe(map((r) => r.data as { id_modulo: number }));
  }

  /**
   * Guarda el tema y sus capítulos en UNA petición.
   *
   * Juntos a propósito: el panel los edita en un solo formulario, con el reproductor al lado. Si
   * el tema se guardara y los capítulos fallaran, quedaría un tutorial cuyos pasos apuntan a los
   * tiempos del video anterior — peor que no haber guardado.
   */
  guardarTema(
    datos: Partial<AyudaTemaAdmin>,
    id?: number | null,
  ): Observable<{ id_tema: number }> {
    const url = id ? `${this.API}/temas/${id}` : `${this.API}/temas`;
    const peticion = id
      ? this.http.put<Respuesta<{ id_tema: number }>>(url, datos)
      : this.http.post<Respuesta<{ id_tema: number }>>(url, datos);
    return peticion.pipe(map((r) => r.data as { id_tema: number }));
  }

  /** Baja lógica. Nada se borra: los eventos ya anotados apuntan a los temas. */
  cambiarEstado(
    entidad: 'aplicativo' | 'modulo' | 'tema',
    id: number,
    activo: boolean,
  ): Observable<void> {
    return this.http
      .patch<Respuesta<null>>(`${this.API}/${entidad}/${id}/estado`, { activo })
      .pipe(map(() => undefined));
  }

  /** El panel de «qué grabar»: búsquedas sin resultado, votos negativos y lo sin revisar. */
  getMetricas(dias = 30): Observable<AyudaMetricas> {
    const params = new HttpParams().set('dias', String(dias));
    return this.http
      .get<Respuesta<AyudaMetricas>>(`${this.API}/metricas`, { params })
      .pipe(map((r) => r.data as AyudaMetricas));
  }
}
