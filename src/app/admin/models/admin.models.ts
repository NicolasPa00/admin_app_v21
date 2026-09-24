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
  /**
   * ¿El tipo tiene módulo de verdad, o es solo una fila del catálogo?
   *
   * El catálogo lista bastantes más tipos de los que tienen vertical construida. Crear un
   * negocio sobre uno de los otros produce una cuenta en la que nadie puede entrar, así que solo
   * los `operativo` se ofrecen al crear. Opcional para no romper contra un backend anterior.
   */
  operativo?: boolean;
  /** Aplicativo que atiende al tipo (`gener_tipo_negocio.id_tipo_modulo`); `null` = ninguno. */
  id_tipo_modulo?: number | null;
  /** Nombre legible del aplicativo («Restaurante», «Reserva»); `null` = sin aplicativo. */
  aplicativo?: string | null;
  /** ¿Es uno de los aplicativos que se pueden elegir al crear un tipo? */
  es_modulo?: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

/** POST /admin/tipos-negocio */
export interface CreateTipoNegocioRequest {
  nombre: string;
  descripcion?: string | null;
  icono?: string | null;
  color_hex?: string | null;
  /** El aplicativo que lo atiende: obligatorio, un tipo con `es_modulo`. */
  id_tipo_modulo: number;
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

/**
 * Un **rubro** es el oficio que el cliente dice tener; el **módulo** es el software que se le
 * monta. Una heladería y una pizzería son rubros distintos y el mismo módulo (RESTAURANTE);
 * una barbería y un spa, lo mismo con RESERVA.
 *
 * La lista sale de `GET /admin/rubros` y ya viene filtrada: solo aparecen los oficios cuyo
 * módulo existe de verdad. Antes esta decisión estaba escrita a mano en cuatro sitios.
 */
export interface Rubro {
  id_tipo_negocio: number;
  /** Clave en mayúsculas y sin tildes: 'SALON DE BELLEZA'. */
  nombre: string;
  /** Lo que se le enseña al usuario: 'Salón de belleza'. */
  etiqueta: string;
  icono: string | null;
  color_hex: string | null;
  orden: number;
  id_tipo_modulo: number;
  /** Nombre del módulo que lo atiende: 'RESTAURANTE' | 'RESERVA'. */
  modulo: string;
}

export type RubrosResponse = ApiResponse<Rubro[]>;
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
  /**
   * Plan del negocio (GET /admin/mis-negocios). `null` = sin plan; ausente = backend anterior
   * que no lo manda, y entonces no se bloquea nada desde aquí.
   */
  plan?: PlanInfo | null;
  /**
   * Features que el plan del negocio habilita (p. ej. `asistente_ia`). Se pregunta por la feature,
   * nunca por el nombre del plan (ADR-021). Ausente = backend anterior que no lo manda: se trata
   * como habilitado para no bloquear a nadie.
   */
  features?: string[];
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
  /** Código estable del plan ('BASICO', 'AVANZADO'…): igual en todos los entornos. */
  codigo?: string | null;
  nombre: string;
  precio: number;
  moneda: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  vigente: boolean;
  dias_restantes: number | null;
  /**
   * Estado calculado por `planHelper` en el backend. PENDIENTE = su fecha de inicio aún no
   * llega. Ver `core/utils/estado-plan.ts` para cómo se muestra.
   */
  estado?: 'ACTIVO' | 'GRACIA' | 'VENCIDO' | 'SIN_PLAN' | 'PENDIENTE';
  /** ¿Puede operar? Incluye los días de gracia. */
  activo?: boolean;
  en_gracia?: boolean;
  dias_gracia_restantes?: number | null;
  /** Último instante de acceso: `fecha_fin` + 5 días de gracia. */
  fecha_limite_gracia?: string | null;
  dias_para_iniciar?: number | null;
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
  /** Opcional: el login va por identificación. */
  email: string | null;
  /** Opcional. Teléfono completo con indicativo (`+573001234567`). */
  telefono: string | null;
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
  /** El MÓDULO sobre el que corre. De aquí cuelgan los permisos. */
  id_tipo_negocio: number;
  /** El OFICIO que dijo ser el cliente. Puede coincidir con el módulo o no. */
  id_rubro: number | null;
  /** Nombre del módulo, para cuando hace falta distinguirlo del oficio. */
  modulo_nombre: string | null;
  /**
   * País del negocio (ISO 3166-1 alfa-2). Decide cómo se normaliza el teléfono de sus
   * clientes: un salón chileno guarda +56 y uno colombiano +57. Por defecto 'CO'.
   */
  pais: string;
  tipo_nombre: string | null;
  tipo_icono: string | null;
  tipo_color: string | null;
  estado: 'A' | 'I';
  fecha_registro: string;
  plan: PlanInfo | null;
}

export type NegociosAdminResponse = ApiResponse<NegocioAdmin[]>;

/** Qué le pasaría a una persona al eliminar el negocio. */
export interface UsuarioEliminacion {
  id_usuario: number;
  nombre: string;
  identificacion: string;
  /** A cuántos OTROS negocios pertenece. */
  otros_negocios: number;
  /** `eliminar`: solo está aquí. `desvincular`: está en otros negocios o tiene rol global. */
  accion: 'eliminar' | 'desvincular';
}

/** Filas de una tabla del negocio que se borrarían. */
export interface DatoEliminacion {
  tabla: string;
  etiqueta: string;
  filas: number;
  tipo: 'operativo' | 'configuracion';
}

/** Resumen de `GET /negocios/:id/eliminacion`: todo lo que se llevaría por delante eliminar. */
export interface EliminacionNegocio {
  negocio: { id_negocio: number; nombre: string; nit: string | null; estado: 'A' | 'I' };
  usuarios: UsuarioEliminacion[];
  datos: DatoEliminacion[];
  totales: {
    usuarios: number;
    usuarios_eliminados: number;
    usuarios_desvinculados: number;
    filas_operativas: number;
    filas_configuracion: number;
    filas: number;
  };
}

/** Cuántos usuarios usa un negocio y cuántos le caben (`GET /negocios/:id/cupo-usuarios`). */
export interface CupoUsuarios {
  usados: number;
  /** `null` = sin tope (sin plan vigente o plan sin límite). */
  total: number | null;
  incluidos: number | null;
  adicionales: number;
  plan: string | null;
}

/** Un hecho del ciclo de vida de un negocio (`GET /negocios/:id/historial`). */
export interface NegocioEventoHistorial {
  id_evento: number;
  fecha: string;
  accion:
    | 'negocio_inactivado'
    | 'negocio_reactivado'
    | 'negocio_eliminado'
    | string;
  resultado: string;
  id_usuario: number | null;
  usuario_nombre: string | null;
  detalle: { nombre?: string; motivo?: string; id_usuario?: number } | null;
}

/** Datos del usuario administrador a crear junto con el negocio. */
export interface AdminUsuarioNuevo {
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  num_identificacion: string;
  telefono?: string | null;
  /** Opcional: el login va por identificación. */
  email?: string | null;
  password: string;
}

/** GET /admin/usuarios/buscar — resultado de búsqueda de usuario existente. */
export interface UsuarioBusqueda {
  id_usuario: number;
  primer_nombre: string;
  primer_apellido: string;
  email: string | null;
  num_identificacion: string;
  telefono?: string | null;
}

/** POST /admin/negocios/registrar-cliente */
export interface RegistrarClienteRequest {
  negocio: {
    nombre: string;
    /**
     * El MÓDULO. Solo para llamadas anteriores a los rubros: hoy se manda `id_rubro` y el
     * backend deriva el módulo de ahí. Debe venir uno de los dos.
     */
    id_tipo_negocio?: number;
    nit?: string | null;
    email_contacto?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    /** ISO 3166-1 alfa-2. Si no se manda, el backend lo deja en 'CO'. */
    pais?: string | null;
    /** El oficio elegido. El backend deriva de aquí el módulo. */
    id_rubro?: number | null;
  };
  /**
   * Vigencia del negocio. Con `id_plan`: `meses` desde `fecha_inicio`. Con `id_plan: null` y
   * `fecha_inicio`: prueba de 7 días (Plan Básico) desde ese día.
   */
  plan?: { id_plan: number | null; meses?: number; fecha_inicio?: string } | null;
  /** Modo A: vincular usuario existente (se excluye mutuamente con admin). */
  id_usuario_existente?: number | null;
  /** Modo B: crear usuario nuevo (se excluye mutuamente con id_usuario_existente). */
  admin?: AdminUsuarioNuevo | null;
}

/** PUT /admin/negocios/:id */
export interface UpdateNegocioRequest {
  nombre: string;
  nit?: string | null;
  email_contacto?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  id_tipo_negocio?: number;
  /** El oficio elegido. El backend deriva de aquí el módulo y traduce los roles si cambia. */
  id_rubro?: number | null;
  /** ISO 3166-1 alfa-2. Decide la normalización del teléfono de sus clientes. */
  pais?: string | null;
}

/** PUT /admin/usuarios/admin/:id/perfil — edición de datos del usuario. */
export interface UpdateUsuarioPerfilRequest {
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  num_identificacion: string;
  /** Opcional: `null` deja al usuario sin correo. */
  email: string | null;
  /** Opcional: `null` deja al usuario sin teléfono. */
  telefono?: string | null;
  /** Solo se envía si el admin quiere cambiar la contraseña. */
  password?: string;
}

/** Acciones auditadas sobre un usuario (`audit_evento.accion`, módulo `usuarios`). */
export type UsuarioHistorialAccion =
  | 'usuario_creado'
  | 'usuario_editado'
  | 'usuario_inactivado'
  | 'usuario_reactivado'
  | 'usuario_eliminado';

/** Una línea del historial de un usuario. GET /admin/usuarios/admin/:id/historial */
export interface UsuarioHistorialEvento {
  id_evento: string;
  fecha: string;
  accion: UsuarioHistorialAccion | string;
  resultado: string;
  id_actor: number | null;
  /** Quién hizo la acción (el actor, no el usuario afectado). */
  actor_nombre: string | null;
  /** Solo en `usuario_editado`: qué campos cambiaron. */
  cambios: string[] | null;
}

/** Filtros aceptados por GET /admin/usuarios/admin. */
export interface UsuariosAdminFiltros {
  search?: string;
  estado?: 'A' | 'I' | 'ALL';
  /** Solo el personal de ese negocio, con los roles que tiene EN ese negocio. */
  id_negocio?: number;
}
