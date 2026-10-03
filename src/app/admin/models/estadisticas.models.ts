/**
 * Modelos de la vista Estadísticas (Super Admin).
 *
 * Espejo exacto de lo que devuelve `GET /admin/estadisticas/plataforma`
 * (admin_ws · app_admin_api/controllers/estadisticasController.js).
 */

/** Los cinco aplicativos que atienden a los inquilinos. `otro` = tipo sin aplicativo asignado. */
export type Vertical = 'restaurante' | 'reserva' | 'parqueadero' | 'gym' | 'tienda' | 'otro';

export interface EstadisticasPeriodo {
  /** Inicio del rango pedido, o `null` cuando se mira todo el historial. */
  desde: string | null;
  hasta: string | null;
  /** Alta del primer negocio: el día uno de la plataforma. */
  inicio_operacion: string | null;
  primera_transaccion: string | null;
  ultima_transaccion: string | null;
}

export interface EstadisticasResumen {
  negocios: number;
  negocios_activos: number;
  verticales: number;
  usuarios: number;
  clientes: number;
  /** Operaciones gestionadas: pedidos + citas + estancias + facturas + ventas. */
  transacciones: number;
  transacciones_cobradas: number;
  monto_cobrado: number;
  ticket_promedio: number;
  pedidos: number;
  items_vendidos: number;
  agendamientos: number;
  productos_catalogo: number;
  servicios_catalogo: number;
  mensajes_asistente: number;
  conversaciones: number;
  sesiones: number;
}

export interface EstadisticasMes {
  /** `YYYY-MM`. */
  mes: string;
  transacciones: number;
  monto: number;
  pedidos: number;
  agendamientos: number;
  /** Negocios con al menos una operación ese mes. */
  negocios: number;
}

export interface EstadisticasAlta {
  mes: string;
  nuevos: number;
  acumulado: number;
}

export interface EstadisticasVertical {
  vertical: Vertical;
  negocios: number;
  transacciones: number;
  monto: number;
}

export interface EstadisticasHora {
  hora: number;
  transacciones: number;
}

export interface EstadisticasDia {
  /** ISO: 1 = lunes … 7 = domingo. */
  dia: number;
  transacciones: number;
}

export interface EstadisticasNegocio {
  id_negocio: number;
  nombre: string;
  tipo: string | null;
  transacciones: number;
  monto: number;
  desde: string | null;
}

export interface EstadisticasPlataforma {
  periodo: EstadisticasPeriodo;
  resumen: EstadisticasResumen;
  serie_mensual: EstadisticasMes[];
  altas_negocios: EstadisticasAlta[];
  verticales: EstadisticasVertical[];
  por_hora: EstadisticasHora[];
  por_dia_semana: EstadisticasDia[];
  top_negocios: EstadisticasNegocio[];
}

/** Rango que ofrece la vista. `todo` es el valor por defecto: el recorrido completo. */
export type RangoPreset = 'todo' | '12m' | '90d' | '30d';
