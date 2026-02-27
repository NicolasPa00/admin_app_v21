/**
 * Configuración de entorno — desarrollo.
 * Ajusta apiUrl al host de tu backend local.
 */
export const environment = {
  production: false,
  /** URL base del API — coincide con app.use('/admin', adminRoutes) del backend. */
  apiUrl: 'http://localhost:3000/admin',
};
