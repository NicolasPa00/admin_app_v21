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
  UsuarioHistorialEvento,
  Plan,
  PlanesResponse,
} from '../models/admin.models';

/**
 * UsuariosAdminService — gestión de usuarios para el Super Admin.
 *
 * Endpoints (admin_ws):
 *   GET   /admin/usuarios/admin            (filtros: search, id_rol, id_negocio, estado)
 *   PATCH /admin/usuarios/admin/:id/estado (inactivar / reactivar)
 *   GET   /admin/usuarios/admin/:id/historial (auditoría del usuario)
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
    // Con `id_negocio`, el backend devuelve solo su personal y los roles de ESE negocio: es lo que
    // pinta el modal de personal en Negocios.
    if (filtros.id_negocio) {
      params = params.set('id_negocio', String(filtros.id_negocio));
    }

    return this.http
      .get<UsuariosAdminResponse>(`${this.API}/usuarios/admin`, { params })
      .pipe(map((res) => res.data ?? []));
  }

  /** Cambia el estado de un usuario (A = activo, I = inactivo). */
  setEstado(idUsuario: number, estado: 'A' | 'I'): Observable<void> {
    return this.http
      .patch<ApiResponse>(`${this.API}/usuarios/admin/${idUsuario}/estado`, { estado })
      .pipe(map(() => undefined));
  }

  /**
   * Elimina un usuario. No borra su fila —los pedidos y los turnos de caja tienen que poder
   * decir quién los hizo—, pero lo saca de toda la plataforma y libera su correo y su cédula
   * para poder volver a darlo de alta. A diferencia de inactivar, no tiene vuelta atrás.
   */
  eliminarUsuario(idUsuario: number): Observable<void> {
    return this.http
      .delete<ApiResponse>(`${this.API}/usuarios/admin/${idUsuario}`)
      .pipe(map(() => undefined));
  }

  /** Quién creó, editó, inactivó, reactivó o eliminó al usuario, y cuándo (más reciente primero). */
  getHistorial(idUsuario: number): Observable<UsuarioHistorialEvento[]> {
    return this.http
      .get<ApiResponse<UsuarioHistorialEvento[]>>(
        `${this.API}/usuarios/admin/${idUsuario}/historial`,
      )
      .pipe(map((res) => res.data ?? []));
  }

  /** Actualiza los datos de perfil de un usuario (nombre → contraseña). */
  updatePerfil(idUsuario: number, payload: UpdateUsuarioPerfilRequest): Observable<void> {
    return this.http
      .put<ApiResponse>(`${this.API}/usuarios/admin/${idUsuario}/perfil`, payload)
      .pipe(map(() => undefined));
  }

  /**
   * Catálogo de planes activos (solo para el filtro de la tabla).
   *
   * Cambiar el plan ya no se hace desde aquí: el plan es del negocio, no del usuario, y vive en
   * `NegociosAdminService.cambiarPlan`.
   */
  getPlanes(): Observable<Plan[]> {
    return this.http
      .get<PlanesResponse>(`${this.API}/planes`)
      .pipe(map((res) => res.data ?? []));
  }
}
