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
  /** Ver el comentario de `environment.ts`: el API del Centro de ayuda es propio y público. */
  ayudaApiUrl: 'https://api.escalapp.cloud/ayuda',
  negocioAppUrl: 'https://escalapp.cloud/restaurante',
  parqueaderoAppUrl: 'https://escalapp.cloud/parqueadero',
  gymAppUrl: 'https://escalapp.cloud/gym',
  tiendaAppUrl: 'https://escalapp.cloud/tienda',
  reservaAppUrl: 'https://escalapp.cloud/reserva',
  assetPath: 'images',
  /** WhatsApp de soporte (wa.me URL) */
  whatsappUrl: 'https://wa.me/573180332988',
  /**
   * App ID de Meta y config ID de Embedded Signup (ver environment.ts para el porqué).
   * "EscalApp — Registro insertado", creada el 2026-09-19.
   *
   * El config ID por sí solo no basta: `escalapp.cloud` tiene que estar autorizado en
   * "Administrar dominios" o Meta rechaza el origen aunque el config ID sea correcto.
   * ✅ Verificado el 2026-10-20 en la cuenta «Escalapp» (dominio 27803591939268578).
   */
  metaAppId: '1552342763052863',
  metaConfigId: '2166699173923667',
  /** Ver environment.ts: v23.0 por la coexistencia. */
  metaSdkVersion: 'v26.0',

  /**
   * Analítica del embudo público.
   *
   * Mientras estén vacíos no se carga ningún script: el código se puede desplegar hoy y encender
   * el día que existan las cuentas, sin volver a tocar nada más que estas tres líneas.
   *
   * ⚠️ El píxel de Meta conviene encenderlo ANTES de pensar en pautar. La audiencia de
   * retargeting se construye con el tiempo; instalarlo el día que se decide pautar es empezar
   * con una audiencia vacía y pagar de más por el mismo clic.
   */
  analitica: {
    /** GA4 — propiedad «EscalApp», flujo «EscalApp Web», creado el 2026-10-20. */
    ga4: 'G-09HEBGVL5Q',
    /**
     * Conjunto de datos «EscalApp Web» de Meta, creado el 2026-10-20.
     *
     * Vive en la MISMA cuenta de negocio que la app de WhatsApp (`metaAppId`) y que el conjunto
     * de WhatsApp Marketing. No es casualidad ni comodidad: una audiencia de retargeting solo se
     * puede usar desde la cuenta que la posee, así que un píxel en otra cuenta sería una
     * audiencia que no se puede gastar.
     */
    metaPixel: '1659925482479960',
    /** Microsoft Clarity, proyecto «EscalApp», creado el 2026-10-20. */
    clarity: 'z0qcdmwbof',
  },
};
