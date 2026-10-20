/**
 * Markdown mínimo para las guías escritas del Centro de ayuda.
 *
 * ## Por qué no `marked` ni `ngx-markdown`
 *
 * Porque lo que hay que renderizar es un subconjunto deliberadamente pequeño —negritas, listas,
 * títulos, citas, enlaces y código en línea— y una dependencia nueva traería un parser completo
 * de CommonMark, su superficie de seguridad y su mantenimiento, para no usar el 90%. Son 2 devs.
 *
 * ## El escapado va PRIMERO, y eso es lo único que no se puede tocar
 *
 * El texto se escapa entero antes de aplicar cualquier regla, así que nada de lo que venga en la
 * base de datos puede producir una etiqueta HTML. Las etiquetas las pone este archivo y solo
 * este archivo. El contenido lo escribe un super admin, pero eso no es una defensa: un día
 * alguien pegará un texto copiado de internet, y «confiamos en el autor» es cómo se cuela un
 * script. Por eso el resultado se marca con `bypassSecurityTrustHtml` solo después de escapar.
 */

/** Escapa todo lo que el navegador podría interpretar como HTML. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Negritas, cursivas, código en línea y enlaces. Se aplica a texto YA escapado.
 *
 * El código se APARTA antes de lo demás y se devuelve al final, en vez de convertirlo primero a
 * `<code>`: convertirlo primero no basta, porque el contenido sigue en la cadena y la regla de
 * la negrita lo encuentra igual — `` `**esto**` `` salía como código en negrita. Lo encontró
 * `markdown.spec.ts` y es la razón de que esta función sea algo más que una cadena de `replace`.
 *
 * El centinela usa `\u0000`, que no puede aparecer en el texto escapado ni lo toca ninguna de
 * las otras reglas.
 */
function enLinea(texto: string): string {
  const codigos: string[] = [];
  let salida = texto.replace(/`([^`]+)`/g, (_todo, dentro: string) => {
    codigos.push(dentro);
    return `\u0000${codigos.length - 1}\u0000`;
  });

  salida = salida
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    // Solo http(s) y rutas internas, así que `javascript:` nunca llega a ser un enlace: se queda
    // como texto a la vista, que es el fallo correcto. El `&quot;` ya está escapado, así que la
    // URL tampoco puede cerrar el atributo.
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );

  return salida.replace(/\u0000(\d+)\u0000/g, (_todo, i: string) => `<code>${codigos[+i]}</code>`);
}

/**
 * Convierte markdown a HTML.
 *
 * Soporta: `#`/`##`/`###`, listas con `-` o `*`, listas numeradas, citas con `>`, separadores
 * `---`, párrafos, y lo de `enLinea`. Lo que no reconoce queda como párrafo, que es el fallo
 * correcto: se ve el texto, nunca se pierde.
 */
export function markdownAHtml(fuente: string | null | undefined): string {
  if (!fuente) return '';

  const lineas = escapar(fuente).split(/\r?\n/);
  const salida: string[] = [];
  let enLista: 'ul' | 'ol' | null = null;
  let enCita = false;

  const cerrarLista = () => {
    if (enLista) {
      salida.push(`</${enLista}>`);
      enLista = null;
    }
  };
  const cerrarCita = () => {
    if (enCita) {
      salida.push('</blockquote>');
      enCita = false;
    }
  };

  for (const cruda of lineas) {
    const linea = cruda.trimEnd();

    if (!linea.trim()) {
      cerrarLista();
      cerrarCita();
      continue;
    }

    const titulo = linea.match(/^(#{1,3})\s+(.*)$/);
    if (titulo) {
      cerrarLista();
      cerrarCita();
      const nivel = titulo[1].length + 2; // # → h3, para no competir con el h1/h2 de la página
      salida.push(`<h${nivel}>${enLinea(titulo[2])}</h${nivel}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(linea.trim())) {
      cerrarLista();
      cerrarCita();
      salida.push('<hr />');
      continue;
    }

    const cita = linea.match(/^&gt;\s?(.*)$/);
    if (cita) {
      cerrarLista();
      if (!enCita) {
        salida.push('<blockquote>');
        enCita = true;
      }
      salida.push(`<p>${enLinea(cita[1])}</p>`);
      continue;
    }
    cerrarCita();

    const vineta = linea.match(/^\s*[-*]\s+(.*)$/);
    if (vineta) {
      if (enLista !== 'ul') {
        cerrarLista();
        salida.push('<ul>');
        enLista = 'ul';
      }
      salida.push(`<li>${enLinea(vineta[1])}</li>`);
      continue;
    }

    const numerada = linea.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numerada) {
      if (enLista !== 'ol') {
        cerrarLista();
        salida.push('<ol>');
        enLista = 'ol';
      }
      salida.push(`<li>${enLinea(numerada[1])}</li>`);
      continue;
    }

    cerrarLista();
    salida.push(`<p>${enLinea(linea)}</p>`);
  }

  cerrarLista();
  cerrarCita();
  return salida.join('\n');
}

/**
 * El markdown reducido a texto corrido, para enseñar un adelanto de un paso.
 *
 * Es lo que va en las tarjetas de pasos del lateral del tutorial: ahí no cabe —ni interesa— el
 * cuerpo entero, solo las primeras palabras para saber de qué va el paso antes de hacer clic.
 *
 * Devuelve texto **plano**, y por eso se interpola con `{{ }}` y nunca con `[innerHTML]`: no
 * escapa nada porque no tiene que hacerlo, Angular ya escapa lo que interpola. Si algún día
 * alguien lo mete en un `innerHTML`, eso es el agujero — no este archivo.
 */
export function textoPlano(fuente: string | null | undefined, maximo = 110): string {
  if (!fuente) return '';

  const plano = fuente
    // Bloques de código enteros fuera: un adelanto que empieza por ``` no dice nada.
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    // De un enlace queda su texto, que es lo que se lee.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*(-{3,}|\*{3,})\s*$/gm, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (plano.length <= maximo) return plano;

  // Se corta por la última palabra entera: partir una palabra por la mitad se lee como un error
  // de la aplicación, no como un recorte.
  const corte = plano.slice(0, maximo);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > maximo * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}
