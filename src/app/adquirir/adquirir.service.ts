import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import { ApiResponse } from '../auth/models/auth.models';

/** Un plan que de verdad se puede cobrar hoy: existe en `gener_plan` y tiene precio publicado. */
export interface PlanVendible {
  id_plan: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  moneda: string;
  ciclo: string;
}

export interface PasarelaDisponible {
  codigo: 'wompi' | 'dlocal';
  nombre: string;
}

export interface CatalogoCompra {
  planes: PlanVendible[];
  pasarelas: PasarelaDisponible[];
}

export interface DatosCompra {
  nombres: string;
  apellidos: string;
  num_identificacion: string;
  email: string;
  telefono?: string | null;
  /** El `nombre` del rubro en `gener_tipo_negocio` — no la etiqueta que se ve en pantalla. */
  rubro: string;
  nombre_negocio: string;
  /** El `nombre` del plan en `gener_plan`. El precio lo pone el backend, nunca el navegador. */
  plan: string;
  pasarela: 'wompi' | 'dlocal';
}

export interface CompraIniciada {
  id_negocio: number;
  plan: string;
  referencia: string;
  total: number;
  moneda: string;
  periodo_inicio: string;
  periodo_fin: string;
  url_pago: string | null;
  estado_pago: string;
  instrucciones: string | null;
}

export interface EstadoCompra {
  referencia: string;
  estado: 'pendiente' | 'pagada' | 'fallida' | 'anulada';
  total: number;
  moneda: string;
  pagada_en: string | null;
  periodo_fin: string | null;
  email: string | null;
}

/**
 * AdquirirService — comprar un plan sin tener cuenta (`/adquirir`).
 *
 * Todo lo que decide dinero vive en el backend: aquí se manda el **nombre** del plan y el rubro,
 * nunca un precio. Lo que se cobra sale de `cob_precio_plan`, así que manipular la petición desde
 * el navegador no cambia el importe del checkout.
 */
@Injectable({ providedIn: 'root' })
export class AdquirirService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  catalogo(): Observable<CatalogoCompra> {
    return this.http
      .get<ApiResponse<CatalogoCompra>>(`${this.API}/publico/adquirir/catalogo`)
      .pipe(map((res) => res.data ?? { planes: [], pasarelas: [] }));
  }

  iniciar(datos: DatosCompra): Observable<CompraIniciada | null> {
    return this.http
      .post<ApiResponse<CompraIniciada>>(`${this.API}/publico/adquirir`, datos)
      .pipe(map((res) => res.data ?? null));
  }

  /** Reabre el checkout de una compra que quedó sin pagar, con la referencia en la mano. */
  reintentar(referencia: string, pasarela?: 'wompi' | 'dlocal'): Observable<CompraIniciada | null> {
    return this.http
      .post<ApiResponse<CompraIniciada>>(`${this.API}/publico/adquirir/reintentar`, {
        referencia,
        ...(pasarela ? { pasarela } : {}),
      })
      .pipe(map((res) => res.data ?? null));
  }

  estado(referencia: string): Observable<EstadoCompra | null> {
    return this.http
      .get<ApiResponse<EstadoCompra>>(`${this.API}/publico/adquirir/estado/${referencia}`)
      .pipe(map((res) => res.data ?? null));
  }
}
