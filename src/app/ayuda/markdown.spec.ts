import { describe, expect, it } from 'vitest';

import { markdownAHtml, textoPlano } from './markdown';

/**
 * El centinela del markdown de las guías escritas.
 *
 * Lo que de verdad se comprueba aquí es el **escapado**, porque `MarkdownPipe` marca el resultado
 * con `bypassSecurityTrustHtml`: si `markdownAHtml` dejara pasar una etiqueta del contenido, ese
 * pipe se convertiría en un agujero. El contenido lo escribe un super admin, pero eso no es una
 * defensa — un día alguien pegará un texto copiado de internet.
 */
describe('markdownAHtml', () => {
  it('no deja pasar HTML del contenido', () => {
    const html = markdownAHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapa el HTML incluso dentro de una negrita', () => {
    const html = markdownAHtml('**<img src=x onerror=alert(1)>**');
    expect(html).toContain('<strong>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('no convierte javascript: en un enlace', () => {
    const html = markdownAHtml('[pulsa](javascript:alert(1))');
    // Lo que importa es que NO haya enlace. El texto queda a la vista tal cual —
    // «[pulsa](javascript:alert(1))»— y eso es el fallo correcto: se ve que algo está mal
    // escrito, y no hay nada que pulsar.
    expect(html).not.toContain('href');
    expect(html).not.toContain('<a ');
  });

  it('sí convierte enlaces http y rutas internas, y los abre fuera con rel seguro', () => {
    const externo = markdownAHtml('[docs](https://escalapp.cloud/terminos)');
    expect(externo).toContain('href="https://escalapp.cloud/terminos"');
    expect(externo).toContain('rel="noopener noreferrer"');

    const interno = markdownAHtml('[la carta](/ayuda/restaurante/menu)');
    expect(interno).toContain('href="/ayuda/restaurante/menu"');
  });

  it('una comilla en el texto no puede cerrar un atributo', () => {
    const html = markdownAHtml('["raro"](https://x.com/a)');
    expect(html).toContain('&quot;raro&quot;');
    expect(html).toContain('href="https://x.com/a"');
  });

  // ── Lo que tiene que renderizar bien ────────────────────────────────────────────────────

  it('títulos, y empezando en h3 para no competir con el h1 de la página', () => {
    expect(markdownAHtml('# Hola')).toContain('<h3>Hola</h3>');
    expect(markdownAHtml('## Hola')).toContain('<h4>Hola</h4>');
    expect(markdownAHtml('### Hola')).toContain('<h5>Hola</h5>');
  });

  it('listas con viñeta y numeradas, cerrándolas al cambiar de tipo', () => {
    const vinetas = markdownAHtml('- uno\n- dos');
    expect(vinetas).toContain('<ul>');
    expect(vinetas).toContain('<li>uno</li>');
    expect((vinetas.match(/<\/ul>/g) ?? []).length).toBe(1);

    const mezcla = markdownAHtml('- uno\n1. dos');
    expect(mezcla).toContain('</ul>');
    expect(mezcla).toContain('<ol>');
    expect(mezcla).toContain('</ol>');
  });

  it('citas, que es donde van los avisos de las guías', () => {
    const html = markdownAHtml('> ojo con esto');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('</blockquote>');
    expect(html).toContain('ojo con esto');
  });

  it('negrita, cursiva y código en línea, sin interpretar lo de dentro del código', () => {
    expect(markdownAHtml('**fuerte**')).toContain('<strong>fuerte</strong>');
    expect(markdownAHtml('un *detalle*')).toContain('<em>detalle</em>');
    const codigo = markdownAHtml('usa `**esto**`');
    expect(codigo).toContain('<code>**esto**</code>');
    expect(codigo).not.toContain('<strong>');
  });

  it('separa párrafos por línea en blanco y cierra las listas abiertas', () => {
    const html = markdownAHtml('- uno\n\nOtro párrafo');
    expect(html).toContain('</ul>');
    expect(html).toContain('<p>Otro párrafo</p>');
  });

  it('vacío, null y undefined devuelven cadena vacía', () => {
    expect(markdownAHtml('')).toBe('');
    expect(markdownAHtml(null)).toBe('');
    expect(markdownAHtml(undefined)).toBe('');
  });

  it('una línea que no reconoce queda como párrafo: nunca se pierde el texto', () => {
    expect(markdownAHtml('| tabla | que | no | soporta |')).toContain('<p>');
    expect(markdownAHtml('| tabla | que | no | soporta |')).toContain('tabla');
  });
});

/**
 * El adelanto de un paso, que es lo que se lee en las tarjetas del lateral del tutorial.
 *
 * Aquí no se comprueba seguridad: `textoPlano` devuelve texto que se interpola con `{{ }}`, y
 * Angular lo escapa. Lo que se comprueba es que no se escape ningún resto de markdown a la
 * vista —un `**` o un `#` suelto en una tarjeta se lee como un fallo— y que el recorte no
 * parta palabras.
 */
describe('textoPlano', () => {
  it('quita las marcas de markdown y deja el texto corrido', () => {
    const texto = textoPlano('## Subir imagen\n\nToca **Elegir archivo** y busca la foto.');
    expect(texto).toBe('Subir imagen Toca Elegir archivo y busca la foto.');
  });

  it('de un enlace deja su texto, no la URL', () => {
    expect(textoPlano('Abre [la carta](/ayuda/restaurante/menu) y revisa.')).toBe(
      'Abre la carta y revisa.',
    );
  });

  it('deja fuera los bloques de código y desarma el código en línea', () => {
    expect(textoPlano('Antes\n```\nnpm run build\n```\nDespués')).toBe('Antes Después');
    expect(textoPlano('Escribe `12.500` en el campo')).toBe('Escribe 12.500 en el campo');
  });

  it('quita viñetas, numeración, citas y separadores', () => {
    expect(textoPlano('- uno\n- dos\n\n1. tres\n\n> ojo\n\n---')).toBe('uno dos tres ojo');
  });

  it('recorta sin partir palabras y avisa con puntos suspensivos', () => {
    const largo = 'palabra '.repeat(40);
    const texto = textoPlano(largo, 30);
    expect(texto.length).toBeLessThanOrEqual(31);
    expect(texto.endsWith('…')).toBe(true);
    expect(texto).not.toContain('palab…');
  });

  it('no recorta lo que ya cabe', () => {
    expect(textoPlano('corto', 50)).toBe('corto');
    expect(textoPlano('corto', 50).endsWith('…')).toBe(false);
  });

  it('vacío, null y undefined devuelven cadena vacía', () => {
    expect(textoPlano('')).toBe('');
    expect(textoPlano(null)).toBe('');
    expect(textoPlano(undefined)).toBe('');
  });
});
