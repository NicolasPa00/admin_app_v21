import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

/**
 * Medición del embudo público: GA4, el píxel de Meta y Clarity.
 *
 * ## Por qué existe
 *
 * Hasta el 2026-10-20 no había **ninguna** analítica. Se podía saber cuántos negocios se
 * registraban, pero no cuánta gente llegó a la landing, cuántos abrieron el modal de prueba ni
 * en qué paso lo abandonaban. Sin eso, cualquier campaña es dinero gastado a ciegas: no se puede
 * decidir qué canal apagar si no se sabe cuál trajo a cada uno.
 *
 * ## Qué mide cada uno, y por qué los tres
 *
 *   · **GA4** — de dónde viene la gente y qué hace. Es la fuente de la atribución.
 *   · **Píxel de Meta** — hace falta ANTES de pautar, no después: la audiencia de retargeting se
 *     construye con el tiempo, así que instalarlo el día que se decide pautar es llegar con una
 *     audiencia vacía y pagar el doble por el mismo clic.
 *   · **Clarity** — grabaciones y mapas de calor, gratis y sin tope. Es el que contesta *por qué*
 *     abandonan el registro; los otros dos solo dicen *cuántos*.
 *
 * ## Inerte sin identificadores
 *
 * Si `environment` no trae el id de un servicio, ese servicio sencillamente no se carga. Eso hace
 * que el código se pueda desplegar hoy y encender cuando existan las cuentas, y que en desarrollo
 * no se ensucien las métricas con las pruebas de uno mismo.
 *
 * Todo pasa por `isPlatformBrowser`: durante el prerender no hay `window` y cargar un script de
 * terceros ahí rompería el build.
 */

interface ConfigAnalitica {
  ga4?: string;
  metaPixel?: string;
  clarity?: string;
}

/** Los eventos del embudo. Nombrarlos aquí evita que cada pantalla invente el suyo. */
export type EventoEmbudo =
  | 'vio_planes'
  | 'abrio_modal_prueba'
  | 'pidio_codigo'
  | 'verifico_codigo'
  | 'creo_negocio'
  | 'abrio_detalle_plan'
  | 'clic_adquirir'
  | 'inicio_pago'
  | 'pago_aprobado';

/**
 * Qué evento de Meta corresponde a cada uno de los nuestros.
 *
 * Meta solo optimiza las campañas contra SUS nombres estándar, así que un evento propio sirve
 * para mirar informes pero no para que el algoritmo busque gente parecida a la que convierte.
 * Lo que no tiene equivalente se manda igual como evento propio.
 */
const EVENTO_META: Partial<Record<EventoEmbudo, string>> = {
  abrio_modal_prueba: 'Lead',
  verifico_codigo: 'CompleteRegistration',
  inicio_pago: 'InitiateCheckout',
  pago_aprobado: 'Purchase',
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[] };
    clarity?: (...args: unknown[]) => void;
  }
}

@Injectable({ providedIn: 'root' })
export class AnaliticaService {
  private readonly doc = inject(DOCUMENT);
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));
  private iniciada = false;

  private get config(): ConfigAnalitica {
    return (environment as { analitica?: ConfigAnalitica }).analitica ?? {};
  }

  /**
   * Carga los scripts. Se llama una vez, desde el arranque de la app.
   *
   * Idempotente: una segunda llamada no vuelve a inyectar nada. Importa porque en desarrollo el
   * hot reload puede reconstruir el servicio y tres píxeles duplicados cuentan tres veces.
   */
  iniciar(): void {
    if (!this.esNavegador || this.iniciada) return;
    this.iniciada = true;

    const { ga4, metaPixel, clarity } = this.config;
    if (ga4) this.cargarGa4(ga4);
    if (metaPixel) this.cargarMetaPixel(metaPixel);
    if (clarity) this.cargarClarity(clarity);
  }

  /**
   * Un paso del embudo.
   *
   * `datos` viaja tal cual a GA4. **Nunca** se le mandan correos, cédulas ni teléfonos: además de
   * estar prohibido por las condiciones de GA4, son datos personales de un tercero y nuestra
   * política de tratamiento no contempla cedérselos a Google para publicidad.
   */
  evento(nombre: EventoEmbudo, datos: Record<string, string | number | boolean> = {}): void {
    if (!this.esNavegador) return;

    window.gtag?.('event', nombre, datos);

    const estandar = EVENTO_META[nombre];
    if (estandar) window.fbq?.('track', estandar, datos);
    else window.fbq?.('trackCustom', nombre, datos);
  }

  /** Una vista de página, para las navegaciones dentro de la app (que GA4 no ve solo). */
  vista(ruta: string, titulo?: string): void {
    if (!this.esNavegador) return;
    window.gtag?.('event', 'page_view', { page_path: ruta, page_title: titulo });
    window.fbq?.('track', 'PageView');
  }

  // ── Carga de cada script ──────────────────────────────────────────────────

  private cargarGa4(id: string): void {
    const script = this.doc.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    this.doc.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    // `gtag` tiene que empujar los `arguments` crudos, no un array propio: así es como la
    // librería de Google espera encontrarlos cuando termina de cargar.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', id, { anonymize_ip: true });
  }

  private cargarMetaPixel(id: string): void {
    if (window.fbq) return;
    const cola: unknown[] = [];
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) (fbq.callMethod as (...a: unknown[]) => void)(...args);
      else cola.push(args);
    }) as Window['fbq'] & { callMethod?: unknown; queue?: unknown[] };
    fbq!.queue = cola;
    window.fbq = fbq;

    const script = this.doc.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    this.doc.head.appendChild(script);

    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  private cargarClarity(id: string): void {
    const script = this.doc.createElement('script');
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${encodeURIComponent(id)}`;
    this.doc.head.appendChild(script);
  }
}
