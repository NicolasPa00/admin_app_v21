import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../auth/models/auth.models';

/** Un país del catálogo de la plataforma (GET /admin/paises). */
export interface PaisDisponible {
  /** ISO 3166-1 alfa-2. */
  codigo: string;
  nombre: string;
  /** Con el '+': «+57». */
  indicativo: string;
  /** Dígitos del número nacional. */
  largo: number;
}

/**
 * El catálogo de países: código, nombre, indicativo y largo del número.
 *
 * Se pide al backend y no se escribe aquí porque la tabla vive en `app_core/helpers/paises.js`
 * junto con la regla de qué es un número válido en cada país; una copia en el frontend se
 * quedaría vieja el día que se añada un país. Es el mismo criterio que sigue `reserva_app`.
 *
 * Una sola petición por sesión, compartida entre todos los campos de teléfono que se abran a la
 * vez. Un fallo no se cachea (se reintenta la próxima vez) y nunca se propaga: un formulario
 * sin catálogo sigue funcionando con el indicativo por defecto.
 */
@Injectable({ providedIn: 'root' })
export class PaisesService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _paises = signal<PaisDisponible[]>([]);
  readonly paises = this._paises.asReadonly();

  private enCurso: Observable<PaisDisponible[]> | null = null;

  /** Carga el catálogo si aún no está. En el servidor (prerender) no se pide. */
  cargar(): Observable<PaisDisponible[]> {
    if (!isPlatformBrowser(this.platformId) || this._paises().length) return of(this._paises());
    if (this.enCurso) return this.enCurso;

    this.enCurso = this.http.get<ApiResponse<PaisDisponible[]>>(`${environment.apiUrl}/paises`).pipe(
      tap((r) => {
        if (r?.data?.length) this._paises.set(r.data);
      }),
      map(() => this._paises()),
      catchError(() => of(this._paises())),
      finalize(() => (this.enCurso = null)),
      shareReplay(1),
    );
    return this.enCurso;
  }

  porCodigo(codigo: string | null | undefined): PaisDisponible | null {
    if (!codigo) return null;
    return this._paises().find((p) => p.codigo === codigo) ?? null;
  }

  /**
   * Parte un teléfono guardado (`+573001234567`) en país + número nacional.
   *
   * 1. Si encaja exacto con algún país (indicativo + largo), gana ese; entre varios, el
   *    preferido y si no el de indicativo más largo (un `+1` no le gana a un `+56`).
   * 2. Si el largo no encaja —un número a medio escribir— se quita el indicativo que sí
   *    coincida, prefiriendo el del país elegido. Sin esto, escribir el primer dígito bajo
   *    Colombia (`+573`) se leería como «573» y el número crecería solo.
   * 3. Lo que no empieza por `+` es un teléfono guardado antes del selector: se devuelve
   *    entero con el país preferido y se normaliza al guardarlo.
   */
  partir(valor: string | null | undefined, paisPreferido = 'CO'): { pais: string; numero: string } {
    const texto = String(valor ?? '').trim();
    if (!texto) return { pais: paisPreferido, numero: '' };

    const digitos = texto.replace(/\D/g, '');
    if (!texto.startsWith('+')) return { pais: paisPreferido, numero: digitos };

    const cc = (p: PaisDisponible) => p.indicativo.replace('+', '');
    const masLargoPrimero = (a: PaisDisponible, b: PaisDisponible) =>
      b.indicativo.length - a.indicativo.length;
    const conPrefijo = this._paises().filter((p) => digitos.startsWith(cc(p)));

    const exactos = conPrefijo
      .filter((p) => digitos.length === cc(p).length + p.largo)
      .sort(masLargoPrimero);
    const elegido =
      exactos.find((p) => p.codigo === paisPreferido) ??
      exactos[0] ??
      conPrefijo.find((p) => p.codigo === paisPreferido) ??
      [...conPrefijo].sort(masLargoPrimero)[0];

    if (elegido) return { pais: elegido.codigo, numero: digitos.slice(cc(elegido).length) };
    return { pais: paisPreferido, numero: digitos };
  }

  /** Junta país + número nacional en `+573001234567`. Sin número, cadena vacía. */
  componer(pais: string, numero: string): string {
    const digitos = String(numero ?? '').replace(/\D/g, '');
    if (!digitos) return '';
    const p = this.porCodigo(pais);
    return p ? `${p.indicativo}${digitos}` : digitos;
  }
}
