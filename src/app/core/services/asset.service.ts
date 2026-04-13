import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Servicio para resolver rutas de assets (imágenes, etc.)
 * Se adapta automáticamente según el entorno:
 * - Local (base href = /):        /images/
 * - Producción (base href = /admin/): /admin/images/
 */
@Injectable({
  providedIn: 'root',
})
export class AssetService {
  /**
   * Obtiene la ruta completa de un asset
   * @param filename Nombre del archivo (ej: 'logo.png')
   */
  getAssetPath(filename: string): string {
    return `${environment.assetPath}/${filename}`;
  }
}
