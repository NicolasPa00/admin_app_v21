/**
 * Modelos de autenticación — alineados con admin_ws API.
 * Todas las respuestas siguen el formato: { success, message, data? }
 */

// ===================== Envoltorio genérico =====================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown[];
}

// ===================== Usuario =====================

export interface UserRol {
  id_rol: number;
  descripcion: string;
}

export interface UserNegocio {
  id_negocio: number;
  nombre: string;
  roles: UserRol[];
}

/**
 * Shape del usuario tal como lo devuelve loginDao.getUsuarioLogin()
 * y GET /admin/usuarios/perfil.
 */
export interface User {
  id_usuario: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  email: string;
  /** Negocios a los que pertenece el usuario con sus roles por negocio. */
  negocios: UserNegocio[];
  /** Roles sin negocio (ej. Super Admin). */
  roles_globales: UserRol[];
}

// ===================== Login =====================

/** POST /admin/auth/login */
export interface LoginRequest {
  num_identificacion: string;
  password: string;
}

export interface LoginData {
  token: string;
  usuario: User;
}

export type LoginResponse = ApiResponse<LoginData>;

// ===================== Register =====================

/** POST /admin/usuarios (ruta protegida — requiere token de admin) */
export interface RegisterRequest {
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  num_identificacion: string;
  telefono?: string;
  email: string;
  password: string;
  fecha_nacimiento?: string;
  id_rol: number;
  id_negocio?: number;
}

export interface RegisterData {
  id_usuario: number;
}

export type RegisterResponse = ApiResponse<RegisterData>;

// ===================== Profile =====================

/** GET /admin/usuarios/perfil */
export type ProfileResponse = ApiResponse<User>;

// ===================== Forgot / Reset Password =====================

/** Endpoints pendientes de implementación en el backend. */
export interface ForgotPasswordRequest {
  email?: string;
  num_identificacion?: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export type ApiOkResponse = ApiResponse;

// ===================== Check Email =====================

export interface CheckEmailResponse {
  available: boolean;
}

