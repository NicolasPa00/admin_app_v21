import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import { ConexionCanalWhatsapp, EstadoCanalWhatsapp } from '../models/canalWhatsapp.models';

/**
 * CanalWhatsappService — conexión del número de WhatsApp de un negocio (F8-D).
 *
 * Endpoints (admin_ws), **sin** `requireSuperAdmin`: es la pantalla del dueño del negocio, mismo
 * criterio que `facturacion` — ver ese servicio para el porqué de `:id_negocio` en la ruta.
 *
 *   GET  /admin/negocios/:id_negocio/canal-whatsapp
 *   POST /admin/negocios/:id_negocio/canal-whatsapp/embedded-signup/canjear
 *   POST /admin/negocios/:id_negocio/canal-whatsapp/desconectar
 */
@Injectable({ providedIn: 'root' })
export class CanalWhatsappService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  getEstado(idNegocio: number): Observable<EstadoCanalWhatsapp> {
    return this.http
      .get<ApiResponse<EstadoCanalWhatsapp>>(`${this.API}/negocios/${idNegocio}/canal-whatsapp`)
      .pipe(map((res) => res.data as EstadoCanalWhatsapp));
  }

  /**
   * Canjea el `code` de Embedded Signup. Se llama de inmediato al recibir el evento del SDK — el
   * `code` caduca en 30 segundos, así que este método nunca debe encolarse ni reintentarse con el
   * mismo valor.
   */
  canjear(
    idNegocio: number,
    code: string,
    phoneNumberId: string,
    numeroE164: string | null,
    businessId: string | null = null,
  ): Observable<ConexionCanalWhatsapp> {
    return this.http
      .post<ApiResponse<ConexionCanalWhatsapp>>(
        `${this.API}/negocios/${idNegocio}/canal-whatsapp/embedded-signup/canjear`,
        { code, phoneNumberId, numeroE164, businessId },
      )
      .pipe(map((res) => res.data as ConexionCanalWhatsapp));
  }

  /**
   * Autoservicio: el negocio se desconecta de su propio número. Nunca actúa sobre un número
   * gestionado por EscalApp (alta manual) — el backend responde 409 en ese caso.
   */
  desconectar(idNegocio: number): Observable<void> {
    return this.http
      .post<ApiResponse<{ desconectado: boolean }>>(
        `${this.API}/negocios/${idNegocio}/canal-whatsapp/desconectar`,
        {},
      )
      .pipe(map(() => undefined));
  }
}
