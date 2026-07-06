/**
 * Modelos de la vista de Auditoría (Super Admin).
 * Alineados con admin_ws → GET /admin/auditoria/*.
 */

/** Fila de auditoría de datos (auditoria.audit_dato). */
export interface AuditDato {
  id_audit: number;
  fecha: string;
  esquema: string;
  tabla: string;
  operacion: 'I' | 'U' | 'D' | 'B';
  id_negocio: number | null;
  id_usuario: number | null;
  pk_registro: string | null;
  datos_antes: Record<string, unknown> | null;
  datos_despues: Record<string, unknown> | null;
  negocio_nombre: string | null;
  usuario_nombre: string | null;
}

/** Fila de auditoría de eventos (auditoria.audit_evento). */
export interface AuditEvento {
  id_evento: number;
  fecha: string;
  modulo: string;
  accion: string;
  resultado: string;
  id_negocio: number | null;
  id_usuario: number | null;
  ip: string | null;
  detalle: Record<string, unknown> | null;
  negocio_nombre: string | null;
  usuario_nombre: string | null;
}

/** Página de resultados de auditoría. */
export interface AuditPage<T> {
  total: number;
  page: number;
  limit: number;
  rows: T[];
}

/** Filtros comunes de consulta. */
export interface AuditFiltros {
  esquema?: string;
  tabla?: string;
  operacion?: string;
  modulo?: string;
  accion?: string;
  resultado?: string;
  id_negocio?: number | null;
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  page?: number;
  limit?: number;
}

/** Catálogo de valores para los filtros. */
export interface AuditCatalogo {
  tablas: { esquema: string; tabla: string }[];
  modulos: { modulo: string; acciones: string[] }[];
  negocios: { id_negocio: number; nombre: string }[];
}
