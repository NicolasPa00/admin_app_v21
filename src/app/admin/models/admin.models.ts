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
  /** Nombre del ícono (lucide) que representa el tipo. */
  icono?: string | null;
  /** Color de acento del tipo (hex). */
  color_hex?: string | null;
  /** 'A' = activo, 'I' = inactivo */
  estado: 'A' | 'I';
  fecha_creacion: string;
  fecha_actualizacion: string;
}

/** POST /admin/tipos-negocio */
export interface CreateTipoNegocioRequest {
  nombre: string;
  descripcion?: string | null;
  icono?: string | null;
  color_hex?: string | null;
}

export type TipoNegocioResponse = ApiResponse<TipoNegocio>;

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

// ===================== Métricas (dashboard Super Admin) =====================

export interface MetricaValor {
  valor: number;
  ayer: number;
  /** Variación % vs ayer; null si no aplica. */
  tendencia: number | null;
}

export interface MetricaConversion {
  valor: number;
  pagados: number;
  total: number;
  tendencia: number | null;
}

/** GET /admin/metricas/resumen */
export interface MetricasResumen {
  negocios_activos: MetricaValor;
  ingresos: MetricaValor;
  transacciones: MetricaValor;
  conversion: MetricaConversion;
}

export type MetricasResumenResponse = ApiResponse<MetricasResumen>;

// ===================== Negocio (instancia real de un tipo de negocio) =====================

/**
 * Representa un negocio registrado en la plataforma.
 * Viene de GET /admin/mis-negocios?id_tipo_negocio=N
 */
export interface Negocio {
  id_negocio:     number;
  nombre:         string;
  nit:            string | null;
  email_contacto: string | null;
  telefono:       string | null;
  id_tipo_negocio: number;
  id_paleta:      number | null;
  /** 'A' = activo, 'I' = inactivo */
  estado:         'A' | 'I';
  fecha_registro: string;
}

export type NegociosResponse = ApiResponse<Negocio[]>;

// ===================== Usuario admin (gestión Super Admin) =====================

/**
 * Rol asignado a un usuario, tal como lo devuelve el backend
 * (`usuarioAdminDao.getUsuarios`), ya enriquecido con el negocio.
 */
export interface RolAsignado {
  id_usuario_rol: number;
  id_rol: number;
  descripcion: string;
  id_tipo_negocio: number | null;
  id_negocio: number | null;
  negocio_nombre: string | null;
}

/** Plan vigente de un negocio (calculado en el backend). */
export interface PlanInfo {
  id_plan: number | null;
  nombre: string;
  precio: number;
  moneda: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  vigente: boolean;
  dias_restantes: number | null;
}

/** Plan de un negocio que el usuario administra. */
export interface NegocioPlanResumen {
  id_negocio: number;
  negocio_nombre: string | null;
  plan: PlanInfo | null;
}

/**
 * Usuario del sistema visto por el Super Admin.
 * GET /admin/usuarios/admin
 */
export interface UsuarioAdmin {
  id_usuario: number;
  nombre_completo: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  num_identificacion: string;
  email: string;
  estado: 'A' | 'I';
  fecha_creacion: string;
  es_admin_principal: boolean;
  rol_principal: RolAsignado | null;
  roles: RolAsignado[];
  /** Planes de los negocios que administra (uno por negocio). */
  planes: NegocioPlanResumen[];
}

export type UsuariosAdminResponse = ApiResponse<UsuarioAdmin[]>;

// ===================== Plan (catálogo) =====================

/** Plan del catálogo. GET /admin/planes */
export interface Plan {
  id_plan: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  moneda: string;
  estado: 'A' | 'I';
}

export type PlanesResponse = ApiResponse<Plan[]>;

// ===================== Negocio (gestión Super Admin) =====================

/** Negocio con tipo + plan, para la vista de gestión. GET /admin/negocios/admin */
export interface NegocioAdmin {
  id_negocio: number;
  nombre: string;
  nit: string | null;
  email_contacto: string | null;
  telefono: string | null;
  direccion: string | null;
  id_tipo_negocio: number;
  tipo_nombre: string | null;
  tipo_icono: string | null;
  tipo_color: string | null;
  estado: 'A' | 'I';
  fecha_registro: string;
  plan: PlanInfo | null;
}

export type NegociosAdminResponse = ApiResponse<NegocioAdmin[]>;

/** Datos del usuario administrador a crear junto con el negocio. */
export interface AdminUsuarioNuevo {
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  num_identificacion: string;
  telefono?: string | null;
  email: string;
  password: string;
}

/** POST /admin/negocios/registrar-cliente */
export interface RegistrarClienteRequest {
  negocio: {
    nombre: string;
    id_tipo_negocio: number;
    nit?: string | null;
    email_contacto?: string | null;
    telefono?: string | null;
    direccion?: string | null;
  };
  plan?: { id_plan: number; meses?: number } | null;
  admin: AdminUsuarioNuevo;
}

/** PUT /admin/negocios/:id */
export interface UpdateNegocioRequest {
  nombre: string;
  nit?: string | null;
  email_contacto?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  id_tipo_negocio?: number;
}

/** Filtros aceptados por GET /admin/usuarios/admin. */
export interface UsuariosAdminFiltros {
  search?: string;
  estado?: 'A' | 'I' | 'ALL';
}
