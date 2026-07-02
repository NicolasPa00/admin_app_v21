import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import {
  NegocioAdmin,
  NegociosAdminResponse,
  RegistrarClienteRequest,
  UpdateNegocioRequest,
  TipoNegocio,
  TiposNegocioResponse,
  Plan,
  PlanesResponse,
  UsuarioBusqueda,
} from '../models/admin.models';

/**
 * NegociosAdminService — gestión de negocios (clientes) para el Super Admin.
 *
 * Endpoints (admin_ws):
 *   GET   /admin/negocios/admin            (lista con tipo + plan)
 *   POST  /admin/negocios/registrar-cliente (negocio + plan + admin, transaccional)
 *   PUT   /admin/negocios/:id               (editar)
 *   PATCH /admin/negocios/:id/estado        (activar / desactivar)
 *   GET   /admin/tipos-negocio · GET /admin/planes (catálogos)
 */
@Injectable({ providedIn: 'root' })
export class NegociosAdminService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  getNegocios(): Observable<NegocioAdmin[]> {
    return this.http
      .get<NegociosAdminResponse>(`${this.API}/negocios/admin`)
      .pipe(map((res) => res.data ?? []));
  }

  registrarCliente(payload: RegistrarClienteRequest): Observable<{ id_negocio: number; id_usuario: number }> {
    return this.http
      .post<ApiResponse<{ id_negocio: number; id_usuario: number }>>(
        `${this.API}/negocios/registrar-cliente`, payload,
      )
      .pipe(map((res) => res.data as { id_negocio: number; id_usuario: number }));
  }

  updateNegocio(idNegocio: number, data: UpdateNegocioRequest): Observable<void> {
    return this.http
      .put<ApiResponse>(`${this.API}/negocios/${idNegocio}`, data)
      .pipe(map(() => undefined));
  }

  setEstado(idNegocio: number, estado: 'A' | 'I'): Observable<void> {
    return this.http
      .patch<ApiResponse>(`${this.API}/negocios/${idNegocio}/estado`, { estado })
      .pipe(map(() => undefined));
  }

  getTipos(): Observable<TipoNegocio[]> {
    return this.http
      .get<TiposNegocioResponse>(`${this.API}/tipos-negocio`)
      .pipe(map((res) => res.data ?? []));
  }

  getPlanes(): Observable<Plan[]> {
    return this.http
      .get<PlanesResponse>(`${this.API}/planes`)
      .pipe(map((res) => res.data ?? []));
  }

  buscarUsuarios(q: string): Observable<UsuarioBusqueda[]> {
    return this.http
      .get<ApiResponse<UsuarioBusqueda[]>>(`${this.API}/usuarios/buscar`, { params: { q } })
      .pipe(map((res) => res.data ?? []));
  }
}
