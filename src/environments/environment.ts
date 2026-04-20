/**
 * Configuración de entorno — desarrollo.
 * Ajusta apiUrl al host de tu backend local.
 */
export const environment = {
  production: false,
  /** URL base del API — coincide con app.use('/admin', adminRoutes) del backend. */
  apiUrl: 'http://localhost:3000/admin',
  /** URL de la app de negocio (restaurante, etc.) */
  negocioAppUrl: 'http://localhost:6002',
  /** URL de la app de parqueadero */
  parqueaderoAppUrl: 'http://localhost:4003',
  /** Ruta base de assets (imágenes, etc.) */
  assetPath: '/images',
};
