import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/**
 * Los metadatos que ve Google y, sobre todo, los que ve WhatsApp.
 *
 * ## Por qué existe
 *
 * Hasta el 2026-10-20 la landing salía con `<title>` y nada más: sin `description`, sin Open
 * Graph y sin canonical. El efecto que se notaba no era el de Google —que tarda semanas— sino
 * el de pegar `escalapp.cloud` en un grupo de WhatsApp y que saliera **un enlace pelado**, sin
 * título, sin imagen y sin una línea que dijera qué es. Para un producto cuyo argumento entero
 * es WhatsApp, eso era desperdiciar cada vez que alguien nos recomendaba.
 *
 * ## Cómo funciona con el prerender
 *
 * Las rutas públicas de esta app son `RenderMode.Prerender`, así que `Meta` y `Title` se
 * ejecutan **durante el build** y las etiquetas quedan horneadas en el HTML. Es justo lo que
 * hace falta: los rastreadores de WhatsApp, Facebook y X no ejecutan JavaScript, así que una
 * etiqueta que solo se pusiera en el navegador no la leería ninguno.
 *
 * ## La URL canónica
 *
 * La app se sirve desde la RAÍZ del dominio desde el 2026-10-20 (antes `baseHref: '/admin/'`, con
 * la raíz redirigiendo ahí). Así la landing es `https://escalapp.cloud/` y la consola queda en
 * `/admin/`, que es lo que cada una dice ser.
 */

/** El origen público. Sin barra final. */
const ORIGEN = 'https://escalapp.cloud';

/**
 * El prefijo donde vive esta app dentro del dominio. Espejo de `baseHref` en `angular.json`:
 * si uno cambia y el otro no, el canonical empieza a apuntar a páginas que no existen.
 * Vacío = la raíz.
 */
const BASE = '';

/** La imagen que sale en la tarjeta al compartir. 1200x630 es lo que piden Meta y X. */
const IMAGEN_DEFECTO = `${ORIGEN}${BASE}/images/og-escalapp-marca.png`;

export interface MetadatosPagina {
  titulo: string;
  descripcion: string;
  /** Ruta dentro de la app, con barra inicial: `/`, `/terminos`, `/ayuda`. */
  ruta: string;
  /** Imagen absoluta para la tarjeta. Por defecto, la de marca. */
  imagen?: string;
  /** `website` para la portada, `article` para contenido. */
  tipo?: 'website' | 'article';
  /** `true` en páginas que no deben indexarse (pasarelas, callbacks, estados de error). */
  noIndexar?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly doc = inject(DOCUMENT);

  /**
   * Fija todo lo de una página de una vez.
   *
   * Se usa `updateTag` y no `addTag` a propósito: al navegar entre rutas en el navegador las
   * etiquetas se reemplazan en lugar de acumularse, que es lo que pasaba si se añadían.
   */
  aplicar(datos: MetadatosPagina): void {
    const url = this.urlAbsoluta(datos.ruta);
    const imagen = datos.imagen ?? IMAGEN_DEFECTO;

    this.title.setTitle(datos.titulo);
    this.meta.updateTag({ name: 'description', content: datos.descripcion });

    // Open Graph — WhatsApp, Facebook, LinkedIn, Telegram y Slack leen esto.
    this.meta.updateTag({ property: 'og:type', content: datos.tipo ?? 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: 'EscalApp' });
    this.meta.updateTag({ property: 'og:locale', content: 'es_CO' });
    this.meta.updateTag({ property: 'og:title', content: datos.titulo });
    this.meta.updateTag({ property: 'og:description', content: datos.descripcion });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: imagen });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    this.meta.updateTag({ property: 'og:image:alt', content: 'EscalApp' });

    // X/Twitter. `summary_large_image` es la tarjeta grande; sin esto sale la miniatura.
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: datos.titulo });
    this.meta.updateTag({ name: 'twitter:description', content: datos.descripcion });
    this.meta.updateTag({ name: 'twitter:image', content: imagen });

    this.meta.updateTag({
      name: 'robots',
      content: datos.noIndexar ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    });

    this.fijarCanonical(url);
  }

  /**
   * El `<link rel="canonical">`, que no es una meta y por tanto no lo gestiona `Meta`.
   *
   * Se busca el que ya exista en vez de añadir uno nuevo: dos canonicals distintos en la misma
   * página hacen que Google ignore los dos.
   */
  private fijarCanonical(url: string): void {
    const cabeza = this.doc.head;
    if (!cabeza) return;
    let enlace = cabeza.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!enlace) {
      enlace = this.doc.createElement('link');
      enlace.setAttribute('rel', 'canonical');
      cabeza.appendChild(enlace);
    }
    enlace.setAttribute('href', url);
  }

  /**
   * Inserta un bloque JSON-LD con datos estructurados.
   *
   * Cada bloque lleva su `id` para poder reemplazarlo al navegar; si no, al volver a una ruta
   * se acumularían dos descripciones del mismo producto y Google se queda con cualquiera.
   */
  datosEstructurados(id: string, datos: Record<string, unknown>): void {
    const cabeza = this.doc.head;
    if (!cabeza) return;
    const idElemento = `ld-${id}`;
    cabeza.querySelector(`#${idElemento}`)?.remove();

    const script = this.doc.createElement('script');
    script.id = idElemento;
    script.type = 'application/ld+json';
    // `textContent` y no `innerHTML`: así el contenido nunca se interpreta como marcado.
    script.textContent = JSON.stringify(datos);
    cabeza.appendChild(script);
  }

  /**
   * `/terminos` → `https://escalapp.cloud/terminos`.
   *
   * La portada conserva la barra final (`https://escalapp.cloud/`) porque es la URL que de verdad
   * se sirve. Un canonical que apunta a una URL que redirige es un canonical que Google descarta.
   */
  urlAbsoluta(ruta: string): string {
    if (ruta === '/') return `${ORIGEN}${BASE}/`;
    return `${ORIGEN}${BASE}${ruta.replace(/^\/+/, '/')}`;
  }
}
