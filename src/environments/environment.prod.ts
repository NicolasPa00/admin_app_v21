/**
 * Configuración de entorno — producción.
 * Backend en EC2 servido mediante Nginx reverse proxy con SSL (puerto 443).
 * Frontend en AWS S3 + CloudFront.
 * Todo el tráfico es HTTPS — sin Mixed Content.
 * Dominio raíz: escalapp.cloud | API subdomain: api.escalapp.cloud
 * 
 * IMPORTANTE: apiUrl incluye el prefijo /admin porque en backend las rutas están 
 * registradas bajo app.use('/admin', adminRoutes), por lo que:
 *   POST /auth/login → debe ser /admin/auth/login
 */
export const environment = {
  production: true,
  apiUrl: 'https://api.escalapp.cloud/admin',
  negocioAppUrl: 'https://escalapp.cloud/restaurante',
  parqueaderoAppUrl: 'https://escalapp.cloud/parqueadero',
  assetPath: 'images',
};
