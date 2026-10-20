import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, shareReplay, catchError } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  AplicativoAyuda,
  ContextoAyuda,
  RespuestaBusqueda,
  Respuesta,
  TemaDetalle,
} from './ayuda.models';

/**
 * AyudaService — el Centro de ayuda, contra `app_ayuda_api`.
 *
 * Ver `admin_ws/docs/centro-de-ayuda.md`.
 *
 * **Sin token.** El `authInterceptor` no adjunta nada a estas URLs porque están en `PUBLIC_URLS`
 * (ver `core/interceptors`): el centro de ayuda tiene que funcionar con la sesión caducada, que
 * es justo cuando alguien busca cómo recuperar su cuenta. Si el interceptor las tratara como
 * protegidas, un 401 cerraría la sesión de quien solo quería leer un tutorial.
 *
 * El catálogo se cachea en memoria con `shareReplay`: es lo primero que pide cada visita, cambia
 * cuando el super admin publica algo —no cada minuto— y así moverse entre aplicativos y módulos
 * no pega al API otra vez.
 */
@Injectable({ providedIn: 'root' })
export class AyudaService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.ayudaApiUrl;

  /** Una entrada por `clave` de aplicativo (más `''` para «todos»). */
  private readonly cacheCatalogo = new Map<string, Observable<AplicativoAyuda[]>>();

  /** Una entrada por término tecleado, para el autocompletado. Ver `sugerir()`. */
  private readonly cacheSugerencias = new Map<string, Observable<RespuestaBusqueda>>();

  /**
   * El árbol de aplicativos → módulos → temas.
   *
   * `incluirVacios` solo lo usa el panel de administración: en público, un módulo sin tutoriales
   * es una tarjeta vacía que hace parecer roto algo que apenas empieza.
   */
  getCatalogo(app?: string | null, incluirVacios = false): Observable<AplicativoAyuda[]> {
    const clave = `${app ?? ''}|${incluirVacios}`;
    const enCache = this.cacheCatalogo.get(clave);
    if (enCache) return enCache;

    let params = new HttpParams();
    if (app) params = params.set('app', app);
    if (incluirVacios) params = params.set('incluirVacios', 'true');

    const peticion = this.http
      .get<Respuesta<AplicativoAyuda[]>>(`${this.API}/catalogo`, { params })
      .pipe(
        map((res) => res.data ?? []),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.cacheCatalogo.set(clave, peticion);
    return peticion;
  }

  /**
   * Vacía las cachés de lectura. Lo llama el panel tras publicar un cambio.
   *
   * También las sugerencias: si no, el super admin acaba de crear un tutorial y el autocompletado
   * sigue jurando que no existe nada con ese nombre.
   */
  invalidarCatalogo(): void {
    this.cacheCatalogo.clear();
    this.cacheSugerencias.clear();
  }

  /** Un tema completo con sus capítulos. Por claves, que son las de la URL. */
  getTema(app: string, modulo: string, tema: string): Observable<TemaDetalle> {
    return this.http
      .get<Respuesta<TemaDetalle>>(
        `${this.API}/tema/${encodeURIComponent(app)}/${encodeURIComponent(modulo)}`
        + `/${encodeURIComponent(tema)}`,
      )
      .pipe(map((res) => res.data as TemaDetalle));
  }

  /**
   * Busca en temas y capítulos. El backend anota las búsquedas sin resultado, que son el
   * backlog de contenido — así que no hay que mandar ningún evento extra desde aquí.
   */
  buscar(termino: string, app?: string | null): Observable<RespuestaBusqueda> {
    let params = new HttpParams().set('q', termino);
    if (app) params = params.set('app', app);
    return this.http
      .get<Respuesta<RespuestaBusqueda>>(`${this.API}/buscar`, { params })
      .pipe(map((res) => res.data ?? { termino, total: 0, resultados: [] }));
  }

  /**
   * Las coincidencias para el autocompletado del buscador.
   *
   * Es la misma búsqueda del backend con `sugerir=true`, y ese parámetro no es un detalle de
   * rendimiento: le dice al servidor que **no anote** el término. Las búsquedas sin resultado son
   * el backlog de contenido —la pestaña «Qué grabar» del panel—, y anotar cada pausa al teclear
   * lo llenaría de «cre», «crear pro», «crear produc». Lo que se anota es el término que la
   * persona da por bueno, y de eso se encarga `buscar()`.
   *
   * Se cachea por término porque borrar con la tecla de retroceso vuelve sobre lo ya escrito, y
   * repetir esas consultas es gratis de evitar. El tope existe para que un rato largo escribiendo
   * no deje el mapa creciendo sin fin.
   */
  sugerir(termino: string, app?: string | null): Observable<RespuestaBusqueda> {
    const q = termino.trim();
    const clave = `${q.toLowerCase()}|${app ?? ''}`;
    const enCache = this.cacheSugerencias.get(clave);
    if (enCache) return enCache;

    let params = new HttpParams().set('q', q).set('sugerir', 'true').set('limite', '6');
    if (app) params = params.set('app', app);

    const peticion = this.http
      .get<Respuesta<RespuestaBusqueda>>(`${this.API}/buscar`, { params })
      .pipe(
        map((res) => res.data ?? { termino: q, total: 0, resultados: [] }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    if (this.cacheSugerencias.size >= 60) this.cacheSugerencias.clear();
    this.cacheSugerencias.set(clave, peticion);
    return peticion;
  }

  /**
   * La ayuda de una ruta concreta. Lo usa el botón `?` de los verticales.
   *
   * Un fallo se traga y devuelve un contexto vacío: el botón de ayuda no debe enseñar un error
   * nunca. Sin módulo, el componente lleva al índice del aplicativo, que es un destino razonable.
   */
  getContexto(app: string, ruta: string): Observable<ContextoAyuda> {
    const params = new HttpParams().set('app', app).set('ruta', ruta);
    return this.http
      .get<Respuesta<ContextoAyuda>>(`${this.API}/contexto`, { params })
      .pipe(
        map((res) => res.data ?? { app, ruta, modulo: null, temas: [] }),
        catchError(() => of({ app, ruta, modulo: null, temas: [] } as ContextoAyuda)),
      );
  }

  /**
   * Anota un evento. Dispara y olvida.
   *
   * Se suscribe aquí mismo y se traga cualquier error a propósito: ni el 429 del limitador ni una
   * caída del API deben notarse en la pantalla. La telemetría de la ayuda no vale una
   * interrupción. `busqueda` y `busqueda_vacia` NO se pueden mandar desde el navegador — las
   * anota el servidor— para que nadie pueda inventarse el backlog de contenido.
   */
  anotar(evento: {
    tipo: 'vista_tema' | 'salto_capitulo' | 'voto';
    id_tema?: number | null;
    id_capitulo?: number | null;
    app?: string | null;
    util?: boolean | null;
    comentario?: string | null;
    ruta_origen?: string | null;
  }): void {
    this.http
      .post<Respuesta<null>>(`${this.API}/evento`, evento)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }
}
