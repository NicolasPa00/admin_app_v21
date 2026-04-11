import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Servicio para resolver rutas de assets (imágenes, etc.)
 * Se adapta automáticamente según el entorno:
 * - Local: /images/
 * - Producción: /admin/images/
 */
@Injectable({
  providedIn: 'root',
})
export class AssetService {
  /**
   * Obtiene la ruta completa de un asset
   * @param filename Nombre del archivo (ej: 'logo.png')
   * @returns Ruta completa del asset (ej: '/images/logo.png' o '/admin/images/logo.png')
   */
  getAssetPath(filename: string): string {
    return `${environment.assetPath}/${filename}`;
  }

  /**
   * Obtiene solo la ruta base de assets
   * @returns '/images' o '/admin/images'
   */
  getAssetBasePath(): string {
    return environment.assetPath;
  }
}
