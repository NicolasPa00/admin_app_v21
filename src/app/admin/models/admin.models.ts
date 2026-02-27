/**
 * Modelos del módulo Admin.
 * Alineados con los endpoints del backend admin_ws.
 *
 * Endpoints esperados:
 *   GET /admin/tipos-negocio   → TipoNegocio[]
 *   GET /admin/tipos-negocio/:id/roles → Rol[]
 *   GET /admin/roles           → Rol[]
 */

import { ApiResponse } from '../../auth/models/auth.models';

// ===================== Tipo de Negocio =====================

export interface TipoNegocio {
  id_tipo_negocio: number;
  nombre: string;
  descripcion: string | null;
  /** 'A' = activo, 'I' = inactivo */
  estado: 'A' | 'I';
  fecha_creacion: string;
  fecha_actualizacion: string;
}

// ===================== Rol =====================

export interface Rol {
  id_rol: number;
  descripcion: string;
  /** 'A' = activo, 'I' = inactivo */
  estado: 'A' | 'I';
  /** null si es rol global (ej. SUPER ADMINISTRADOR) */
  id_tipo_negocio: number | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

// ===================== TipoNegocio enriquecido =====================

/**
 * TipoNegocio con la lista de roles que le corresponden ya calculada.
 * Construido por AdminService.getTiposNegocioConRoles().
 */
export interface TipoNegocioConRoles extends TipoNegocio {
  roles: Rol[];
}

// ===================== Response types =====================

export type TiposNegocioResponse = ApiResponse<TipoNegocio[]>;
export type RolesResponse       = ApiResponse<Rol[]>;

// ===================== Estado de carga =====================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
