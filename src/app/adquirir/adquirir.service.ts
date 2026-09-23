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
  /** Lo que trae el plan de serie; `null` = sin límite. Los complementos suman encima. */
  usuarios_incluidos: number | null;
  cajas_incluidas: number | null;
}

/** Algo que se puede añadir al plan, con su precio real de `cob_precio_complemento`. */
export interface ComplementoVendible {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  /** El límite que amplía: 'usuarios' | 'cajas'. */
  amplia: string | null;
  cantidad_maxima: number;
  precio: number;
}

/** Una línea de la factura: el plan o un complemento. */
export interface LineaCobro {
  tipo: 'plan' | 'complemento';
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface PasarelaDisponible {
  codigo: 'wompi' | 'dlocal';
  nombre: string;
}

export interface CatalogoCompra {
  planes: PlanVendible[];
  complementos: ComplementoVendible[];
  pasarelas: PasarelaDisponible[];
}

export interface DatosCompra {
  nombres: string;
  apellidos: string;
  num_identificacion: string;
  email: string;
  /** La que elige el comprador al crear su cuenta. Sin ella el backend cae a la cédula. */
  password?: string;
  telefono?: string | null;
  /** El `nombre` del rubro en `gener_tipo_negocio` — no la etiqueta que se ve en pantalla. */
  rubro: string;
  nombre_negocio: string;
  /** El `nombre` del plan en `gener_plan`. El precio lo pone el backend, nunca el navegador. */
  plan: string;
  pasarela: 'wompi' | 'dlocal';
  /** Solo códigos y cantidades: el precio lo pone el backend desde el catálogo. */
  complementos: { codigo: string; cantidad: number }[];
}

/**
 * Lo que queda tras crear la cuenta: el negocio ya existe y su primer cobro está esperando.
 *
 * Todavía no hay checkout — eso es el paso siguiente. `referencia` es lo que lo abre.
 */
export interface CuentaCreada {
  id_negocio: number;
  id_usuario: number;
  email: string;
  plan: string;
  /** `true` si el comprador ya había empezado esta compra y volvió: no se creó nada nuevo. */
  retomada: boolean;
  referencia: string;
  lineas: LineaCobro[];
  total: number;
  moneda: string;
  periodo_inicio: string;
  periodo_fin: string;
}

export interface CompraIniciada {
  id_negocio: number;
  plan: string;
  referencia: string;
  lineas: LineaCobro[];
  total: number;
  moneda: string;
  periodo_inicio: string;
  periodo_fin: string;
  url_pago: string | null;
  /** El id del cobro en la pasarela. Se guarda antes de salir al checkout (ver recordarPago). */
  id_externo: string | null;
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
      .pipe(map((res) => res.data ?? { planes: [], complementos: [], pasarelas: [] }));
  }

  /**
   * Crea la cuenta y deja el primer cobro listo. **No abre el checkout.**
   *
   * Va separado del pago a propósito: si el pago falla, la cuenta ya existe, y el comprador tiene
   * que saberlo. Antes los cuatro pasos parecían un trámite único que o salía entero o no valía,
   * y quien volvía a intentarlo chocaba con «ya existe una cuenta con ese correo».
   */
  crearCuenta(datos: DatosCompra): Observable<CuentaCreada | null> {
    return this.http
      .post<ApiResponse<CuentaCreada>>(`${this.API}/publico/adquirir/cuenta`, datos)
      .pipe(map((res) => res.data ?? null));
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
