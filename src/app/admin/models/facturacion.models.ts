/**
 * Modelos de los datos fiscales del negocio (FE-1).
 *
 * Espejo de `general.gener_negocio_fiscal` en el backend. Ver
 * `admin_ws/docs/facturacion-electronica.md` §4 y §5.
 */

/**
 * ¿Está registrado el negocio ante la Cámara de Comercio y la DIAN?
 *
 * `NO_DECLARADO` y `SIN_REGISTRO` **no son lo mismo**, y de eso depende toda la pantalla: al
 * primero hay que preguntarle, al segundo **no hay que volver a molestarlo**. Buena parte de los
 * clientes de EscalApp son negocios informales, y tratarlos como una ficha incompleta sería
 * tratarlos como un error.
 */
export type EstadoRegistro = 'NO_DECLARADO' | 'SIN_REGISTRO' | 'REGISTRADO';

/** Qué emite este negocio. `NINGUNO` es el defecto y significa «nada cambia». */
export type ModoFacturacion = 'NINGUNO' | 'POS' | 'COMPLETO';

/** `1` jurídica (obligada a facturar siempre) · `2` natural (depende de umbrales). */
export type TipoPersona = '1' | '2';

export interface FichaFiscal {
  id_negocio: number;

  estado_registro: EstadoRegistro;
  modo_facturacion: ModoFacturacion;
  obligado_a_facturar: boolean | null;
  declarado_por: number | null;
  declarado_en: string | null;

  tipo_persona: TipoPersona | null;
  tipo_documento: string | null;
  /** Solo dígitos: sin puntos, sin guiones y sin el DV. */
  numero_documento: string | null;
  /** Dígito de verificación. Lo calcula el backend si no se manda. */
  dv: string | null;

  razon_social: string | null;
  nombre_comercial: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  primer_nombre: string | null;
  otros_nombres: string | null;

  responsabilidades_fiscales: string[] | null;
  tributos: string[] | null;
  responsable_iva: boolean;
  responsable_inc: boolean;
  regimen: 'ORDINARIO' | 'SIMPLE' | null;
  tipo_contribuyente: 'GRAN_CONTRIBUYENTE' | 'DECLARANTE' | 'NO_DECLARANTE' | null;
  actividad_ciiu: string | null;
  matricula_mercantil: string | null;

  direccion_fiscal: string | null;
  /** Código DANE de 5 dígitos. «Medellín» no es un dato válido; `05001` sí. */
  municipio_dane: string | null;
  departamento_dane: string | null;
  pais: string;
  codigo_postal: string | null;

  correo_facturacion: string | null;
  telefono_facturacion: string | null;
}

/**
 * Lo que responde el backend sobre si el negocio puede emitir.
 *
 * `faltan` trae frases en español ya listas para enseñar. **La pantalla las pinta tal cual**: la
 * lista de campos obligatorios vive en el backend, no aquí, para que el día que la DIAN cambie
 * lo que exige haya un solo sitio que tocar.
 */
export interface EstadoEmision {
  puede: boolean;
  modo: ModoFacturacion;
  motivo: 'SIN_FICHA' | 'SIN_REGISTRO' | 'MODO_NINGUNO' | 'DATOS_INCOMPLETOS' | null;
  faltan: string[];
}

export interface DatosFiscalesRespuesta {
  ficha: FichaFiscal;
  estado: EstadoEmision;
}

export interface Departamento {
  codigo: string;
  nombre: string;
}

export interface ImpuestoCatalogo {
  id_impuesto: number;
  codigo: string;
  nombre: string;
  tarifa: string | number;
  descripcion: string | null;
}

export interface CatalogosFiscales {
  departamentos: Departamento[];
  impuestos: ImpuestoCatalogo[];
}

/** Lo que el cliente declara. Va por su propio endpoint porque deja firma. */
export interface Declaracion {
  estado_registro?: EstadoRegistro;
  modo_facturacion?: ModoFacturacion;
  obligado_a_facturar?: boolean | null;
}

// ── Emisión (FE-2): lo que configura el super admin por negocio ──

export type AmbienteFe = 'PRUEBAS' | 'PRODUCCION';
export type EstadoFe = 'SIN_CONFIGURAR' | 'EN_PRUEBAS' | 'ACTIVO' | 'SUSPENDIDO';
export type TipoRangoFe = 'FV' | 'NC';

/** La configuración de emisión. **Nunca trae las credenciales**: solo si las hay. */
export interface FeConfiguracion {
  id_negocio: number;
  proveedor: string;
  ambiente: AmbienteFe;
  estado: EstadoFe;
  impuesto_defecto_codigo: string;
  impuesto_defecto_tarifa: string | number;
  impuesto_domicilio_codigo: string;
  impuesto_domicilio_tarifa: string | number;
  enviar_correo: boolean;
  /** false (lo normal): se factura solo el cobro en el que el cajero lo pide. true: todos. */
  facturar_todo: boolean;
  activado_en: string | null;
  tiene_credenciales: boolean;
}

export interface FeRango {
  id_resolucion: string;
  id_rango_proveedor: number;
  tipo_documento: TipoRangoFe;
  prefijo: string | null;
  numero_resolucion: string | null;
  rango_desde: string | number | null;
  rango_hasta: string | number | null;
  consecutivo_actual: string | number | null;
  vigencia_hasta: string | null;
  vencida: boolean;
  en_uso: boolean;
}

/** Por qué un negocio no factura todavía. `null` = factura. */
export type MotivoNoFactura = 'SIN_FEATURE' | 'MODO_NINGUNO' | 'DATOS_INCOMPLETOS' | 'NO_ACTIVO' | null;

export interface FeVista {
  /** `null` mientras nadie haya guardado nada para este negocio. */
  config: FeConfiguracion | null;
  rangos: FeRango[];
  puede_emitir: EstadoEmision;
  debe_facturar: { facturar: boolean; motivo: MotivoNoFactura };
  feature: boolean;
  alertas: string[];
}

export interface FeCredenciales {
  client_id: string;
  client_secret: string;
  username: string;
  password: string;
}

export interface FePrueba {
  empresa: { nit: string | null; dv: string | number | null; razon_social: string | null };
  coincide_nit: boolean;
  nit_del_negocio: string | null;
}

/** Un prefijo que la DIAN tiene asociado al software del negocio. */
export interface FeRangoDian {
  prefijo: string | null;
  resolucion: string | null;
  desde: string | number | null;
  hasta: string | number | null;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
}

export interface FeNuevoRango {
  tipo_documento: TipoRangoFe;
  prefijo: string;
  actual: number;
  resolucion?: string | null;
}
