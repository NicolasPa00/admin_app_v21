import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import {
  ConversacionDetalle,
  ConversacionesFiltros,
  ConversacionesPage,
  Metricas,
} from '../models/intelligence.models';

/**
 * IntelligenceService — Intelligence Console (F5-E, ADR-022).
 *
 * Endpoints (admin_ws), todos de solo lectura y solo Super Admin:
 *   GET /admin/intelligence/conversaciones        listado con filtros
 *   GET /admin/intelligence/conversaciones/:id    rastro completo de una conversación
 *   GET /admin/intelligence/metricas              las doce preguntas de ADR-022
 *
 * La Consola **no escribe nada**. Es la superficie de visualización de la Observabilidad y,
 * sobre todo, la herramienta de depuración: sin ella, mirar una conversación fallida es leer
 * logs; con ella, es abrir una pantalla.
 *
 * El backend responde **503** si el esquema `intelligence` no está migrado en ese entorno. Es
 * un caso normal —Intelligence no está desplegado— y la vista lo dice en vez de enseñar un
 * error genérico.
 */
@Injectable({ providedIn: 'root' })
export class IntelligenceService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  private buildParams(filtros: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filtros)) {
      if (value !== undefined && value !== null && `${value}` !== '') {
        params = params.set(key, `${value}`);
      }
    }
    return params;
  }

  getConversaciones(filtros: ConversacionesFiltros = {}): Observable<ConversacionesPage> {
    return this.http
      .get<ApiResponse<ConversacionesPage>>(`${this.API}/intelligence/conversaciones`, {
        params: this.buildParams(filtros),
      })
      .pipe(map((res) => res.data ?? { conversaciones: [], total: 0, limit: 25, offset: 0 }));
  }

  getConversacion(id: string): Observable<ConversacionDetalle | null> {
    return this.http
      .get<ApiResponse<ConversacionDetalle>>(`${this.API}/intelligence/conversaciones/${id}`)
      .pipe(map((res) => res.data ?? null));
  }

  getMetricas(filtros: { id_negocio?: number | string; desde?: string; hasta?: string } = {}) {
    return this.http
      .get<ApiResponse<Metricas>>(`${this.API}/intelligence/metricas`, {
        params: this.buildParams(filtros),
      })
      .pipe(map((res) => res.data ?? null));
  }
}
