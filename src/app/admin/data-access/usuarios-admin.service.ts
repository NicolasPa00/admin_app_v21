import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import {
  UsuarioAdmin,
  UsuariosAdminResponse,
  UsuariosAdminFiltros,
  UpdateUsuarioPerfilRequest,
  Plan,
  PlanesResponse,
} from '../models/admin.models';

/**
 * UsuariosAdminService — gestión de usuarios para el Super Admin.
 *
 * Endpoints (admin_ws):
 *   GET   /admin/usuarios/admin            (filtros: search, id_rol, id_negocio, estado)
 *   PATCH /admin/usuarios/admin/:id/estado (suspender / reactivar)
 */
@Injectable({ providedIn: 'root' })
export class UsuariosAdminService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  /** Lista de usuarios del sistema. Por defecto trae activos e inactivos. */
  getUsuarios(filtros: UsuariosAdminFiltros = {}): Observable<UsuarioAdmin[]> {
    let params = new HttpParams().set('estado', filtros.estado ?? 'ALL');
    if (filtros.search?.trim()) {
      params = params.set('search', filtros.search.trim());
    }

    return this.http
      .get<UsuariosAdminResponse>(`${this.API}/usuarios/admin`, { params })
      .pipe(map((res) => res.data ?? []));
  }

  /** Cambia el estado de un usuario (A = activo, I = suspendido). */
  setEstado(idUsuario: number, estado: 'A' | 'I'): Observable<void> {
    return this.http
      .patch<ApiResponse>(`${this.API}/usuarios/admin/${idUsuario}/estado`, { estado })
      .pipe(map(() => undefined));
  }

  /** Actualiza los datos de perfil de un usuario (nombre → contraseña). */
  updatePerfil(idUsuario: number, payload: UpdateUsuarioPerfilRequest): Observable<void> {
    return this.http
      .put<ApiResponse>(`${this.API}/usuarios/admin/${idUsuario}/perfil`, payload)
      .pipe(map(() => undefined));
  }

  /** Catálogo de planes activos. */
  getPlanes(): Observable<Plan[]> {
    return this.http
      .get<PlanesResponse>(`${this.API}/planes`)
      .pipe(map((res) => res.data ?? []));
  }

  /** Asigna/cambia el plan de un negocio, con fechas de vigencia opcionales. */
  cambiarPlan(
    idNegocio: number,
    idPlan: number,
    opts: { fechaInicio?: string; fechaFin?: string; meses?: number } = {},
  ): Observable<void> {
    const body: { id_plan: number; meses?: number; fecha_inicio?: string; fecha_fin?: string } = {
      id_plan: idPlan,
    };
    if (opts.meses) body.meses = opts.meses;
    if (opts.fechaInicio) body.fecha_inicio = opts.fechaInicio;
    if (opts.fechaFin) body.fecha_fin = opts.fechaFin;
    return this.http
      .patch<ApiResponse>(`${this.API}/negocios/${idNegocio}/plan`, body)
      .pipe(map(() => undefined));
  }
}
