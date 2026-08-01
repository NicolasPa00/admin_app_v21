import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';
import { Ficha360, PersonasFiltros, PersonasPage } from '../models/persona.models';

/**
 * PersonasService — Ficha 360 de `platform.persona_negocio` (Super Admin).
 *
 * Endpoints (admin_ws):
 *   GET /admin/personas             listado paginado, con búsqueda por nombre o teléfono
 *   GET /admin/personas/:id/ficha   ficha completa de una persona
 *
 * Solo lectura: no hay escritura desde el admin. La identidad se crea sola cuando una
 * vertical toma un pedido con teléfono (camino de escritura de F0).
 */
@Injectable({ providedIn: 'root' })
export class PersonasService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  private buildParams(filtros: PersonasFiltros): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filtros)) {
      if (value !== undefined && value !== null && `${value}` !== '') {
        params = params.set(key, `${value}`);
      }
    }
    return params;
  }

  getPersonas(filtros: PersonasFiltros = {}): Observable<PersonasPage> {
    return this.http
      .get<ApiResponse<PersonasPage>>(`${this.API}/personas`, {
        params: this.buildParams(filtros),
      })
      .pipe(map((res) => res.data ?? { personas: [], total: 0, limit: 25, offset: 0 }));
  }

  getFicha(idPersonaNegocio: string): Observable<Ficha360 | null> {
    return this.http
      .get<ApiResponse<Ficha360>>(`${this.API}/personas/${idPersonaNegocio}/ficha`)
      .pipe(map((res) => res.data ?? null));
  }
}
