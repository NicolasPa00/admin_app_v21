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
  /** URL de la app de gimnasio */
  gymAppUrl: 'http://localhost:4004',
  /** URL de la app de tienda / inventario */
  tiendaAppUrl: 'http://localhost:4005',
  /** URL de la app de reserva */
  reservaAppUrl: 'http://localhost:4006',
  /** Ruta base de assets (imágenes, etc.) */
  assetPath: '/images',
  /** WhatsApp de soporte (wa.me URL) */
  whatsappUrl: 'https://wa.me/573114682492',
  /**
   * App ID de Meta y config ID de Embedded Signup — para el SDK de JS de la pantalla
   * "Conectar WhatsApp" del panel. El config ID sale del checklist manual de
   * developers.facebook.com (ver admin_ws/docs/embedded-signup.md §1); no se automatiza.
   * En desarrollo puede quedar vacío: el botón de "tu propio número" se deshabilita si falta.
   */
  metaAppId: '1552342763052863',
  /** "EscalApp — Registro insertado", creada el 2026-09-19. */
  metaConfigId: '3007420636275811',
};
