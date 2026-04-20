/**
 * Configuración de entorno — desarrollo.
 * El backend local está en puerto 3000 bajo rutas /admin, /restaurante, /parqueadero.
 * 
 * IMPORTANTE: apiUrl incluye /admin porque en backend las rutas de admin están
 * registradas bajo app.use('/admin', adminRoutes).
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
