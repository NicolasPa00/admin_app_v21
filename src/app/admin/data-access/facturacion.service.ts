import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import {
  CatalogosFiscales,
  DatosFiscalesRespuesta,
  Declaracion,
  EstadoFe,
  FeConfiguracion,
  FeCredenciales,
  FeNuevoRango,
  FePrueba,
  FeRango,
  FeRangoDian,
  FeVista,
  FichaFiscal,
} from '../models/facturacion.models';

/**
 * FacturacionService — los datos fiscales del negocio (FE-1).
 *
 * Endpoints (admin_ws), **sin** `requireSuperAdmin`: es la pantalla del dueño del negocio.
 *
 *   GET  /admin/facturacion/catalogos
 *   GET  /admin/negocios/:id_negocio/datos-fiscales
 *   PUT  /admin/negocios/:id_negocio/datos-fiscales
 *   PUT  /admin/negocios/:id_negocio/datos-fiscales/declaracion
 *
 * El parámetro se llama `id_negocio` y no `id` a propósito: es el nombre que reconoce
 * `exigirPertenenciaNegocio` en el backend, así que la ruta queda cubierta por la comprobación
 * multi-inquilino. Mandar el id de otro negocio no da acceso a nada — el controlador vuelve a
 * comprobar la pertenencia a mano.
 *
 * ## Dos respuestas que esta pantalla trata como información, no como avería
 *
 * · **400 `DV_INVALIDO`** — el dígito de verificación no corresponde al NIT. El mensaje del
 *   backend ya dice cuál debería ser, así que se enseña tal cual.
 * · **409 `REGISTRO_REQUERIDO`** — se intentó activar la facturación de un negocio que no está
 *   registrado. No es un fallo: es la regla, y el backend la aplica también en la base.
 */
@Injectable({ providedIn: 'root' })
export class FacturacionService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  getCatalogos(): Observable<CatalogosFiscales> {
    return this.http
      .get<ApiResponse<CatalogosFiscales>>(`${this.API}/facturacion/catalogos`)
      .pipe(map((res) => res.data ?? { departamentos: [], impuestos: [] }));
  }

  getDatosFiscales(idNegocio: number): Observable<DatosFiscalesRespuesta> {
    return this.http
      .get<ApiResponse<DatosFiscalesRespuesta>>(
        `${this.API}/negocios/${idNegocio}/datos-fiscales`,
      )
      .pipe(map((res) => res.data as DatosFiscalesRespuesta));
  }

  /**
   * Guarda datos. Acepta un subconjunto: la ficha se llena en varias tandas, y esa es la razón
   * de que se le pueda pedir a un cliente sin encerrarlo en un formulario de una sentada.
   */
  guardar(idNegocio: number, campos: Partial<FichaFiscal>): Observable<DatosFiscalesRespuesta> {
    return this.http
      .put<ApiResponse<DatosFiscalesRespuesta>>(
        `${this.API}/negocios/${idNegocio}/datos-fiscales`,
        campos,
      )
      .pipe(map((res) => res.data as DatosFiscalesRespuesta));
  }

  /**
   * Registra lo que el cliente **declara**. Va por su propio endpoint porque no es lo mismo
   * corregir una dirección que declarar la situación legal del negocio: esto queda firmado con
   * quién y cuándo, y es lo único que respalda a EscalApp si la declaración no es cierta.
   */
  declarar(idNegocio: number, declaracion: Declaracion): Observable<DatosFiscalesRespuesta> {
    return this.http
      .put<ApiResponse<DatosFiscalesRespuesta>>(
        `${this.API}/negocios/${idNegocio}/datos-fiscales/declaracion`,
        declaracion,
      )
      .pipe(map((res) => res.data as DatosFiscalesRespuesta));
  }

  // ── Emisión (FE-2) — solo super admin; el backend responde 403 a cualquier otro ──
  //
  //   GET    /admin/negocios/:id_negocio/facturacion-electronica
  //   PUT    …                                  credenciales, ambiente, impuestos por defecto
  //   POST   …/probar                           ¿las credenciales son de este negocio?
  //   GET    …/rangos/dian                      lo que la DIAN tiene asociado
  //   POST   …/rangos                           crear el rango en el proveedor (no lo toma solo)
  //   POST   …/rangos/sincronizar
  //   PUT    …/rangos/:id_resolucion/usar
  //   PATCH  …/estado
  //
  // Las credenciales solo viajan de aquí hacia el servidor: ninguna respuesta las devuelve.

  private fe(idNegocio: number): string {
    return `${this.API}/negocios/${idNegocio}/facturacion-electronica`;
  }

  getEmision(idNegocio: number): Observable<FeVista> {
    return this.http.get<ApiResponse<FeVista>>(this.fe(idNegocio)).pipe(map((r) => r.data as FeVista));
  }

  guardarEmision(
    idNegocio: number,
    campos: Partial<FeConfiguracion> & { credenciales?: FeCredenciales },
  ): Observable<FeVista> {
    return this.http
      .put<ApiResponse<FeVista>>(this.fe(idNegocio), campos)
      .pipe(map((r) => r.data as FeVista));
  }

  probarConexion(idNegocio: number): Observable<FePrueba> {
    return this.http
      .post<ApiResponse<FePrueba>>(`${this.fe(idNegocio)}/probar`, {})
      .pipe(map((r) => r.data as FePrueba));
  }

  sincronizarRangos(idNegocio: number): Observable<FeRango[]> {
    return this.http
      .post<ApiResponse<{ rangos: FeRango[] }>>(`${this.fe(idNegocio)}/rangos/sincronizar`, {})
      .pipe(map((r) => r.data?.rangos ?? []));
  }

  rangosDian(idNegocio: number): Observable<FeRangoDian[]> {
    return this.http
      .get<ApiResponse<{ rangos: FeRangoDian[] }>>(`${this.fe(idNegocio)}/rangos/dian`)
      .pipe(map((r) => r.data?.rangos ?? []));
  }

  crearRango(idNegocio: number, rango: FeNuevoRango): Observable<FeRango[]> {
    return this.http
      .post<ApiResponse<{ rangos: FeRango[] }>>(`${this.fe(idNegocio)}/rangos`, rango)
      .pipe(map((r) => r.data?.rangos ?? []));
  }

  usarRango(idNegocio: number, idResolucion: string): Observable<FeRango[]> {
    return this.http
      .put<ApiResponse<{ rangos: FeRango[] }>>(`${this.fe(idNegocio)}/rangos/${idResolucion}/usar`, {})
      .pipe(map((r) => r.data?.rangos ?? []));
  }

  cambiarEstadoEmision(idNegocio: number, estado: EstadoFe): Observable<FeVista> {
    return this.http
      .patch<ApiResponse<FeVista>>(`${this.fe(idNegocio)}/estado`, { estado })
      .pipe(map((r) => r.data as FeVista));
  }
}
