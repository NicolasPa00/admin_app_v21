import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  Notificacion,
  NotificacionesResponse,
  ContadorNoLeidasResponse,
  ConversacionEsperando,
  EsperandoRespuestaResponse,
} from '../models/notificacion.models';

@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  readonly notificaciones = signal<Notificacion[]>([]);
  readonly totalNoLeidas = signal(0);

  /**
   * Conversaciones que esperan a una persona, derivadas al leer (no son filas de notificación,
   * así que no pueden quedarse «sin leer» después de contestar). `totalEsperando` cuenta todas;
   * `esperando` trae las más recientes.
   */
  readonly esperando = signal<ConversacionEsperando[]>([]);
  readonly totalEsperando = signal(0);

  getMisNotificaciones(soloNoLeidas = false): Observable<Notificacion[]> {
    const params = soloNoLeidas ? '?no_leidas=true' : '';
    return this.http
      .get<NotificacionesResponse>(`${this.API}/mis-notificaciones${params}`)
      .pipe(
        map((res) => res.data ?? []),
        tap((data) => this.notificaciones.set(data)),
      );
  }

  getEsperandoRespuesta(): Observable<ConversacionEsperando[]> {
    return this.http
      .get<EsperandoRespuestaResponse>(`${this.API}/mis-notificaciones/esperando-respuesta`)
      .pipe(
        tap((res) => {
          this.esperando.set(res.data?.conversaciones ?? []);
          this.totalEsperando.set(res.data?.total ?? 0);
        }),
        map((res) => res.data?.conversaciones ?? []),
      );
  }

  contarMisNoLeidas(): Observable<number> {
    return this.http
      .get<ContadorNoLeidasResponse>(`${this.API}/mis-notificaciones/no-leidas`)
      .pipe(
        map((res) => res.data?.total ?? 0),
        tap((total) => this.totalNoLeidas.set(total)),
      );
  }

  marcarLeida(idNotificacion: number, idNegocio: number): Observable<{ success: boolean }> {
    return this.http
      .put<{ success: boolean }>(`${this.API}/notificaciones/${idNotificacion}/leida`, { id_negocio: idNegocio })
      .pipe(
        tap(() => {
          this.notificaciones.update((list) =>
            list.map((n) =>
              n.id_notificacion === idNotificacion
                ? { ...n, leida: true, fecha_lectura: new Date().toISOString() }
                : n,
            ),
          );
          this.totalNoLeidas.update((t) => Math.max(0, t - 1));
        }),
      );
  }

  marcarTodasLeidas(idNegocio: number): Observable<{ success: boolean }> {
    return this.http
      .put<{ success: boolean }>(`${this.API}/notificaciones/leer-todas/${idNegocio}`, {})
      .pipe(
        tap(() => {
          this.notificaciones.update((list) =>
            list.map((n) => ({ ...n, leida: true, fecha_lectura: new Date().toISOString() })),
          );
          this.totalNoLeidas.set(0);
        }),
      );
  }
}
