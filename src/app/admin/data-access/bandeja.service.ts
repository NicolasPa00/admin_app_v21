import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import {
  BandejaListado,
  ConversacionBandejaDetalle,
  RespuestaEncolada,
} from '../models/bandeja.models';

/**
 * BandejaService — las conversaciones del asistente, para el dueño del negocio.
 *
 * Endpoints (admin_ws), **sin** `requireSuperAdmin`:
 *   GET  /admin/intelligence/bandeja/conversaciones
 *   GET  /admin/intelligence/bandeja/conversaciones/:id
 *   POST /admin/intelligence/bandeja/conversaciones/:id/responder
 *
 * No lleva `id_negocio` a menos que el usuario elija uno: el backend decide el alcance cruzando
 * el usuario del token contra sus negocios, y **ignora** lo que mande el navegador si no es
 * suyo. Mandarlo desde aquí no da acceso a nada; omitirlo trae todos los negocios del usuario,
 * que es lo que quiere un dueño con dos locales.
 *
 * Dos respuestas del backend que esta pantalla trata como información, no como avería:
 *   · `disponible: false` — el esquema `intelligence` no está migrado en este entorno.
 *   · **409 `VENTANA_CERRADA`** — pasaron 24 h desde el último mensaje de la persona y WhatsApp
 *     ya no acepta texto libre. Se rechaza en el backend a propósito: aceptarlo sería fingir un
 *     envío que Meta iba a tirar después, sin que nadie lo viera.
 */
@Injectable({ providedIn: 'root' })
export class BandejaService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  getConversaciones(filtros: { id_negocio?: number; solo_escaladas?: boolean } = {}):
    Observable<BandejaListado> {
    let params = new HttpParams();
    if (filtros.id_negocio) params = params.set('id_negocio', `${filtros.id_negocio}`);
    if (filtros.solo_escaladas) params = params.set('solo_escaladas', 'true');

    return this.http
      .get<ApiResponse<BandejaListado>>(`${this.API}/intelligence/bandeja/conversaciones`, {
        params,
      })
      .pipe(map((res) => res.data ?? { disponible: false, conversaciones: [], negocios: [] }));
  }

  /**
   * «Ya me ocupé de esto», sin escribir nada.
   *
   * No devuelve la conversación al asistente: eso lo prohíbe ADR-023 y sigue prohibido. Lo
   * único que cambia es si le queda algo por hacer a una persona.
   */
  atender(id: string): Observable<void> {
    return this.http
      .post<ApiResponse<{ escalada: boolean }>>(
        `${this.API}/intelligence/bandeja/conversaciones/${id}/atender`,
        {},
      )
      .pipe(map(() => undefined));
  }

  getConversacion(id: string): Observable<ConversacionBandejaDetalle | null> {
    return this.http
      .get<ApiResponse<ConversacionBandejaDetalle>>(
        `${this.API}/intelligence/bandeja/conversaciones/${id}`,
      )
      .pipe(map((res) => res.data ?? null));
  }

  /**
   * Responde a mano — y con ello **toma la conversación**: el asistente deja de contestar en
   * ella, para siempre. No es un efecto secundario del envío, es la decisión de ADR-023: si se
   * prometió una persona, contesta una persona.
   */
  responder(id: string, texto: string): Observable<RespuestaEncolada | null> {
    return this.http
      .post<ApiResponse<RespuestaEncolada>>(
        `${this.API}/intelligence/bandeja/conversaciones/${id}/responder`,
        { texto },
      )
      .pipe(map((res) => res.data ?? null));
  }
}
