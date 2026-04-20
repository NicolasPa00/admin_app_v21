/**
 * Configuración de entorno — producción.
 * Backend en EC2 servido mediante Nginx reverse proxy con SSL (puerto 443).
 * Frontend en AWS S3 + CloudFront.
 * Todo el tráfico es HTTPS — sin Mixed Content.
 * Dominio raíz: escalapp.cloud | API subdomain: api.escalapp.cloud
 */
export const environment = {
  production: true,
  apiUrl: 'https://api.escalapp.cloud',
  negocioAppUrl: 'https://escalapp.cloud/restaurante',
  parqueaderoAppUrl: 'https://escalapp.cloud/parqueadero',
  assetPath: 'images',
};
