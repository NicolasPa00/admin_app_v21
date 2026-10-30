import { ActivatedRoute } from '@angular/router';

/**
 * Abre el formulario de la prueba gratis si la URL lo pide (`?prueba=1`).
 *
 * Es el enlace que reparte el asistente de WhatsApp de EscalApp a quien dice «quiero probarlo»:
 * llevarlo a la portada y que tenga que encontrar el botón es perder a la persona que más cerca
 * estaba de registrarse. Se llama dentro de `afterNextRender`: las landings se prerenderizan y el
 * modal solo existe en el navegador.
 */
export function abrirPruebaSiLaPiden(route: ActivatedRoute, abrir: () => void): void {
  if (route.snapshot.queryParamMap.get('prueba') === '1') abrir();
}
