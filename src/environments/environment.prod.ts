/**
 * Configuración de entorno — producción.
 * Backend en EC2 servido mediante Nginx reverse proxy con SSL (puerto 443).
 * Frontend en AWS S3 + CloudFront.
 * Todo el tráfico es HTTPS — sin Mixed Content.
 */
export const environment = {
  production: true,
  apiUrl: 'https://escalapp.cloud/admin',
  negocioAppUrl: 'https://dsm1cwmosama.cloudfront.net/restaurante',
  parqueaderoAppUrl: 'https://dsm1cwmosama.cloudfront.net/parqueadero',
  assetPath: 'images',
};
