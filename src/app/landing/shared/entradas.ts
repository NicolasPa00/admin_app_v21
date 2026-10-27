import { DestroyRef } from '@angular/core';

/**
 * La entrada de los títulos al llegar a su sección: el título sube y aparece, y su frase de apoyo
 * lo sigue 70 ms después. Una sola vez, nunca vuelve a esconderse.
 *
 * **Un oyente de `scroll` y no un `IntersectionObserver`**, por la misma razón que documenta
 * `ReservasComponent.montarObservadores`: la ruta se sirve con SSR + hidratación y un observador se
 * engancha a nodos que la hidratación puede sustituir. Aquí cada repaso vuelve a consultar el DOM.
 *
 * El contenido nace VISIBLE (del servidor y sin JavaScript): la clase `entra` —que lo esconde— se
 * pone solo a lo que está por debajo de la primera pantalla, y `entra--visto` lo trae de vuelta.
 * Con `prefers-reduced-motion` no se hace nada: todo queda en su sitio desde el principio.
 *
 * `data-entra` suma a la entrada lo que no es título (las filas de una lista, los nombres de los
 * clientes): los que llegan juntos a la pantalla salen escalonados por el mismo `RETRASO_MS`.
 */
const OBJETIVOS = 'main section h2, main section h2 + p, main [data-entra]';
const RETRASO_MS = 70;

export function montarEntradas(destroyRef: DestroyRef): void {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  let pendiente = false;
  let tardeHecho = false;

  const revisar = () => {
    pendiente = false;
    const alto = window.innerHeight;
    let ola = 0;
    let quedan = 0;
    document.querySelectorAll<HTMLElement>(OBJETIVOS).forEach((el) => {
      if (el.classList.contains('entra-hecho')) return;
      // Un elemento oculto (`display: none`) mide 0: no es «visible», se vuelve a mirar después.
      if (el.offsetParent === null) return;
      const arriba = el.getBoundingClientRect().top;
      if (!el.classList.contains('entra')) {
        if (arriba > alto * 0.95) {
          el.classList.add('entra');
          quedan++;
        } else {
          el.classList.add('entra-hecho');
        }
        return;
      }
      if (arriba < alto * 0.9) {
        el.style.setProperty('--entra-retraso', `${ola++ * RETRASO_MS}ms`);
        el.classList.add('entra--visto', 'entra-hecho');
      } else {
        quedan++;
      }
    });
    // Todo ya apareció: el vigía no tiene nada más que hacer y deja de costar un repaso por fotograma.
    // No antes del repaso tardío: la hidratación puede sustituir nodos justo después del primero.
    if (quedan === 0 && tardeHecho) soltar();
  };

  const pedir = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(revisar);
  };

  // La hidratación puede reemplazar nodos justo después del primer repaso.
  const tarde = window.setTimeout(() => {
    tardeHecho = true;
    pedir();
  }, 400);
  const soltar = () => {
    window.removeEventListener('scroll', pedir);
    window.removeEventListener('resize', pedir);
    window.clearTimeout(tarde);
  };
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', pedir, { passive: true });
  destroyRef.onDestroy(soltar);
  revisar();
}
