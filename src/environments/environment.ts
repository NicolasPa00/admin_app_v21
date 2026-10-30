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
  /**
   * API del Centro de ayuda. Es un API propio (`app.use('/ayuda', ...)`) y no un bloque bajo
   * `/admin`, porque sus rutas de lectura son públicas a propósito: quien olvidó la contraseña
   * o se le venció la prueba también necesita los tutoriales. Ver `app_ayuda_api/routes/index.js`.
   */
  ayudaApiUrl: 'http://localhost:3000/ayuda',
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
  whatsappUrl: 'https://wa.me/573180332988',
  /**
   * App ID de Meta y config ID de Embedded Signup — para el SDK de JS de la pantalla
   * "Conectar WhatsApp" del panel. El config ID sale del checklist manual de
   * developers.facebook.com (ver admin_ws/docs/embedded-signup.md §1); no se automatiza.
   * En desarrollo puede quedar vacío: el botón de "tu propio número" se deshabilita si falta.
   */
  metaAppId: '1552342763052863',
  /** "EscalApp - Embedded Signup v4", creada el 2026-10-30 (la v3 del 2026-09-19 era 3007420636275811). */
  metaConfigId: '2166699173923667',
  /**
   * Versión de la Graph API con la que se inicializa el SDK de JS. Era v23.0 (la coexistencia salió
   * en 2025); desde 2026-10-30 es la que pide la guía de implementación de Embedded Signup v4.
   *
   * ⚠️ La VERSIÓN de Embedded Signup no se elige aquí: la fija la configuración de «Facebook Login
   * for Business» (`metaConfigId`). Una configuración creada marcando los productos queda en v4;
   * v2 y v3 se desactivaron el 15-oct-2026. Ver admin_ws/docs/embedded-signup.md.
   */
  metaSdkVersion: 'v26.0',

  /**
   * Analítica del embudo público. **Vacía en desarrollo a propósito**: medir las pruebas de uno
   * mismo ensucia justo los números que se van a usar para decidir dónde invertir.
   *
   * Para probar la instrumentación en local, pon aquí tus propios identificadores de prueba.
   */
  analitica: {
    /** GA4, formato `G-XXXXXXXXXX`. */
    ga4: '',
    /** Píxel de Meta, solo dígitos. */
    metaPixel: '',
    /** Microsoft Clarity, el id del proyecto. */
    clarity: '',
  },
};
