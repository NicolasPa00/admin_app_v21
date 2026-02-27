import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  TipoNegocio,
  Rol,
  TipoNegocioConRoles,
  TiposNegocioResponse,
  RolesResponse,
} from '../models/admin.models';

// ============================================================
// Mock data — solo para desarrollo local.
// Para desactivar en producción:
//   1. Eliminar la constante MOCK_* de abajo.
//   2. Poner USE_MOCK = false (o eliminarlo).
//   El servicio usará los endpoints reales automáticamente.
// ============================================================
const USE_MOCK = false; // ← cambiar a false cuando el backend esté listo

const MOCK_TIPOS: TipoNegocio[] = [
  { id_tipo_negocio: 1, nombre: 'RESTAURANTE',                    descripcion: 'Negocio de tipo restaurante',                   estado: 'A', fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_tipo_negocio: 2, nombre: 'PARQUEADERO',                    descripcion: 'Negocio de tipo parqueadero',                   estado: 'A', fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_tipo_negocio: 3, nombre: 'BARBERIA',                       descripcion: 'Negocio de tipo barbería',                      estado: 'A', fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_tipo_negocio: 4, nombre: 'SUPERMERCADO',                   descripcion: 'Negocio de tipo supermercado',                  estado: 'A', fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_tipo_negocio: 5, nombre: 'GESTION DE TALLER AUTOMOTRIZ',   descripcion: 'Negocio de gestión de taller automotriz',       estado: 'A', fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_tipo_negocio: 6, nombre: 'FONDO DE AHORROS',               descripcion: 'Negocio de tipo fondo de ahorros',              estado: 'A', fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_tipo_negocio: 7, nombre: 'FINANCIERA DE PRESTAMOS',        descripcion: 'Negocio de tipo financiera de préstamos',       estado: 'A', fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
];

const MOCK_ROLES: Rol[] = [
  { id_rol: 1,  descripcion: 'SUPER ADMINISTRADOR',          estado: 'A', id_tipo_negocio: null, fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_rol: 2,  descripcion: 'ADMINISTRADOR RESTAURANTE',    estado: 'A', id_tipo_negocio: 1,    fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_rol: 3,  descripcion: 'CAJERO RESTAURANTE',           estado: 'A', id_tipo_negocio: 1,    fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_rol: 4,  descripcion: 'ADMINISTRADOR PARQUEADERO',    estado: 'A', id_tipo_negocio: 2,    fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_rol: 5,  descripcion: 'OPERADOR PARQUEADERO',         estado: 'A', id_tipo_negocio: 2,    fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_rol: 6,  descripcion: 'ADMINISTRADOR BARBERIA',       estado: 'A', id_tipo_negocio: 3,    fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_rol: 7,  descripcion: 'BARBERO',                      estado: 'A', id_tipo_negocio: 3,    fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_rol: 8,  descripcion: 'ADMINISTRADOR SUPERMERCADO',   estado: 'A', id_tipo_negocio: 4,    fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_rol: 9,  descripcion: 'ADMINISTRADOR TALLER',         estado: 'A', id_tipo_negocio: 5,    fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_rol: 10, descripcion: 'ADMINISTRADOR FONDO',          estado: 'A', id_tipo_negocio: 6,    fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
  { id_rol: 11, descripcion: 'ADMINISTRADOR FINANCIERA',     estado: 'A', id_tipo_negocio: 7,    fecha_creacion: '2026-02-27T04:00:39.20023', fecha_actualizacion: '2026-02-27T04:00:39.20023' },
];

/**
 * AdminService — obtiene tipos de negocio y roles desde el backend.
 *
 * Endpoints reales (reemplazar environment.apiUrl si cambia):
 *   GET {apiUrl}/tipos-negocio
 *   GET {apiUrl}/roles
 *
 * Si USE_MOCK = true, retorna datos estáticos para desarrollo
 * sin necesidad del backend.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  /** URL base del API — se lee de environment.ts */
  private readonly API = environment.apiUrl;

  // ===================== Señales internas de caché =====================

  private readonly _tiposNegocio = signal<TipoNegocio[]>([]);
  private readonly _roles        = signal<Rol[]>([]);

  /** Cache pública de solo lectura */
  readonly tiposNegocio = this._tiposNegocio.asReadonly();
  readonly roles        = this._roles.asReadonly();

  // ===================== API pública =====================

  /**
   * Obtiene los tipos de negocio activos.
   * GET /admin/tipos-negocio
   *
   * Reemplazar `{apiUrl}` con la URL base del backend.
   */
  getTiposNegocio(): Observable<TipoNegocio[]> {
    if (USE_MOCK) {
      return of(MOCK_TIPOS);
    }
    return this.http
      .get<TiposNegocioResponse>(`${this.API}/tipos-negocio`)
      .pipe(map((res) => res.data ?? []));
  }

  /**
   * Obtiene todos los roles activos.
   * GET /admin/roles
   */
  getRoles(): Observable<Rol[]> {
    if (USE_MOCK) {
      return of(MOCK_ROLES);
    }
    // /roles/lista usa RolController que incluye id_tipo_negocio, estado y fechas.
    // /roles (UsuarioController) solo devuelve { id_rol, descripcion }.
    return this.http
      .get<RolesResponse>(`${this.API}/roles/lista`)
      .pipe(map((res) => res.data ?? []));
  }

  /**
   * Combina tipos de negocio con sus roles asociados en un solo stream.
   * Útil para el dashboard: evita múltiples suscripciones en el componente.
   */
  getTiposNegocioConRoles(): Observable<TipoNegocioConRoles[]> {
    return forkJoin({
      tipos: this.getTiposNegocio(),
      roles: this.getRoles(),
    }).pipe(
      map(({ tipos, roles }) =>
        tipos.map((tipo) => ({
          ...tipo,
          roles: roles.filter((r) => r.id_tipo_negocio === tipo.id_tipo_negocio),
        })),
      ),
    );
  }
}
