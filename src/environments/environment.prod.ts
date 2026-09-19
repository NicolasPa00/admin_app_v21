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
  gymAppUrl: 'https://escalapp.cloud/gym',
  tiendaAppUrl: 'https://escalapp.cloud/tienda',
  reservaAppUrl: 'https://escalapp.cloud/reserva',
  assetPath: 'images',
  /** WhatsApp de soporte (wa.me URL) */
  whatsappUrl: 'https://wa.me/573114682492',
  /**
   * App ID de Meta y config ID de Embedded Signup (ver environment.ts para el porqué).
   * "EscalApp — Registro insertado", creada el 2026-09-19.
   * ⚠️ El config ID por sí solo no basta: falta autorizar `escalapp.cloud` en "Administrar
   * dominios" (checklist de developers.facebook.com) antes de que el SDK funcione de verdad
   * desde producción — sin eso, Meta rechaza el origen aunque el config ID sea correcto.
   */
  metaAppId: '1552342763052863',
  metaConfigId: '3007420636275811',
};
