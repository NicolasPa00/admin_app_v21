import { Injectable, signal } from '@angular/core';

/**
 * Si la vista que se está mostrando es «de escenario» (video a pantalla, fondo oscuro).
 *
 * Existe por una sola razón: la **cabecera vive en el shell** y la que sabe si hay escenario es
 * la vista del tema, que es su hija. Un tema sin video no tiene escenario, así que la cabecera no
 * puede deducirlo de la URL — tiene que preguntárselo a quien cargó el contenido.
 *
 * Es estado de interfaz, no datos, y por eso no está en `AyudaService`: ahí ensuciaría un
 * servicio que solo habla con el API. Lo pone a `true` la vista del tutorial cuando tiene video y
 * lo apaga al destruirse.
 */
@Injectable({ providedIn: 'root' })
export class AyudaInmersionService {
  private readonly _inmersivo = signal(false);
  readonly inmersivo = this._inmersivo.asReadonly();

  fijar(valor: boolean): void {
    this._inmersivo.set(valor);
  }
}
