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
