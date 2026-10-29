/**
 * Genera TODO el juego de iconos de marca de las tres apps desde el logotipo oficial.
 *
 *   cd admin_app_v21
 *   npm install --no-save sharp     # si no está ya
 *   node scripts/generar-iconos.mjs
 *
 * ## La fuente es UN archivo del diseñador
 *
 * `public/logo-fondo-oscuro.svg` — el logotipo completo: fondo `#191a24` y, en blanco, el
 * isotipo arriba y la palabra «EscalApp» debajo. El script lo **lee**, no lo copia a mano: si el
 * diseñador manda una versión nueva, se vuelve a correr y ya está. Por eso comprueba la forma
 * del archivo al empezar y se planta si no es la que espera, en vez de generar en silencio un
 * juego de iconos equivocado.
 *
 * ## Por qué el favicon NO lleva la palabra «EscalApp»
 *
 * Medido a 16, 24 y 32 px sobre pestaña clara, pestaña oscura y barra oscura: con el logotipo
 * completo el isotipo se encoge hasta ser una mota y la palabra queda en un borrón gris de tres
 * píxeles de alto. No es que se lea mal — es que no se lee, y encima roba el sitio que necesita
 * la parte que sí se reconoce.
 *
 * Así que los iconos llevan **solo el isotipo**, con el mismo fondo `#191a24` y el mismo blanco
 * del archivo: es el mismo logotipo, recortado a la parte que funciona al tamaño de un favicon.
 * El lockup completo se genera aparte como `logo-escalapp-512.png`, para donde sí se lee: es el
 * que declara `Organization.logo` en los datos estructurados, que es de donde Google saca la
 * imagen de marca y donde la palabra **ayuda** a asociar el nombre.
 *
 * ## El fondo oscuro y la barra de pestañas oscura
 *
 * `#191a24` contra la barra oscura de Chrome es ~1,4:1: la baldosa prácticamente desaparece.
 * Aquí eso **no** es el problema que se arregló el 2026-10-28, y la diferencia está en lo que
 * hay dentro. Entonces la marca era tricolor (blanco + lavanda + violeta) sobre azul noche, así
 * que al perderse la baldosa se perdían también dos de los tres trazos. Ahora la marca es
 * **blanco puro**: la baldosa se funde con la barra, sí, pero el isotipo queda flotando a máximo
 * contraste y se lee mejor que antes. Sobre una pestaña blanca, la baldosa oscura lo recorta.
 * Verificado a los cinco tamaños sobre los tres fondos antes de cambiarlo.
 *
 * ## `?v=` en los enlaces
 *
 * El `<link rel="icon">` de los tres `index.html` lleva `?v=N`. El icono del navegador y el que
 * Google enseña al lado del resultado se cachean durísimo (Google lo rastrea en su propio
 * calendario, uno por HOSTNAME, y tarda semanas). Cambiar la URL es lo único que fuerza a los dos
 * a volver a pedirlo. El ARCHIVO conserva su nombre para que `/favicon.ico` a secas —que Chrome
 * pide solo— siga resolviendo. **Al cambiar el icono otra vez: subir el número.**
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const APP = resolve(AQUI, '..');
const WORKSPACE = resolve(APP, '..');

const FUENTE = join(APP, 'public', 'logo-fondo-oscuro.svg');

// ── Leer el logotipo del diseñador ────────────────────────────────────────────────────────────

const svgFuente = readFileSync(FUENTE, 'utf8');

/** El fondo, tal cual lo trae el archivo. */
const FONDO = (svgFuente.match(/<rect[^>]*fill="(#[0-9a-fA-F]{6})"/) ?? [])[1];

/**
 * Los trazos, en orden. Los **tres primeros son el isotipo** (los tres golpes de la «E») y los
 * ocho siguientes, las letras de «EscalApp». Ese orden es el del archivo del diseñador y es lo
 * único que este script da por supuesto, así que se comprueba: con otro número de trazos, parar.
 */
const TRAZOS = [...svgFuente.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);

if (!FONDO || TRAZOS.length !== 11) {
  console.error(
    `✗ ${FUENTE} no tiene la forma esperada (fondo: ${FONDO ?? 'ninguno'}, trazos: ${TRAZOS.length}, se esperaban 11).\n`
    + '  El diseñador cambió el archivo. Mirar cuáles son ahora los trazos del isotipo y ajustar '
    + 'ISOTIPO / CAJA_ISOTIPO antes de seguir: generar iconos a ciegas los rompe en las tres apps.',
  );
  process.exit(1);
}

const ISOTIPO = TRAZOS.slice(0, 3);

/**
 * La caja que ocupa el isotipo dentro del `viewBox` interno del archivo (256.29 x 250.51).
 * Es la envolvente de los tres trazos, a mano: medirla en tiempo de ejecución pediría un
 * intérprete de rutas SVG entero para ahorrar cuatro números que solo cambian si cambia el logo
 * —y si cambia, la comprobación de arriba ya obliga a pasar por aquí—.
 */
const CAJA_ISOTIPO = { x: 70.27, y: 0, ancho: 122.95, alto: 162.03 };

// ── Composición ───────────────────────────────────────────────────────────────────────────────

/**
 * Una baldosa cuadrada con el isotipo centrado.
 *
 * @param lado        px del lienzo
 * @param ocupacion   qué fracción del ALTO ocupa la marca. 0.64 en los iconos normales; 0.45 en
 *                    el maskable, donde Android recorta hasta un 20 % por cada lado.
 * @param radio       fracción del lado para las esquinas. 0 = cuadrado a sangre (apple-touch-icon
 *                    y maskable: los redondea el sistema, y redondear dos veces deja un filo).
 */
function baldosa(lado, { ocupacion = 0.64, radio = 0.22 } = {}) {
  const { x: ix, y: iy, ancho: iw, alto: ih } = CAJA_ISOTIPO;
  const alto = lado * ocupacion;
  const escala = alto / ih;
  const x = (lado - iw * escala) / 2 - ix * escala;
  const y = (lado - alto) / 2 - iy * escala;
  const rx = (lado * radio).toFixed(2);
  const marca = ISOTIPO.map((d) => `<path fill="#ffffff" d="${d}"/>`).join('');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado}" height="${lado}">`
    + `<rect width="${lado}" height="${lado}" rx="${rx}" fill="${FONDO}"/>`
    + `<g transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${escala.toFixed(5)})">${marca}</g>`
    + `</svg>`,
  );
}

/**
 * Rasteriza al tamaño pedido.
 *
 * Se dibuja a 4x y se baja con Lanczos en vez de rasterizar directo al tamaño final: a 16 px el
 * trazo fino del isotipo rasterizado en crudo sale dentado, y 16 px es justo el tamaño en el que
 * se mira el icono todo el día.
 */
const png = (lado, opciones) =>
  sharp(baldosa(lado, opciones), { density: 288 })
    .resize(lado, lado, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();

/**
 * Un `.ico` con varios tamaños dentro, con los marcos en PNG.
 *
 * El de 48 NO es decorativo: es el tamaño mínimo que Google pide para enseñar el icono al lado
 * del resultado de búsqueda (y pide un múltiplo de 48 cuadrado).
 */
function ico(marcos) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0);            // reservado
  cabecera.writeUInt16LE(1, 2);            // tipo: icono
  cabecera.writeUInt16LE(marcos.length, 4);

  let desplazamiento = 6 + marcos.length * 16;
  const entradas = marcos.map(({ lado, datos }) => {
    const e = Buffer.alloc(16);
    e[0] = lado >= 256 ? 0 : lado;         // 0 significa 256
    e[1] = lado >= 256 ? 0 : lado;
    e[2] = 0;                              // colores de la paleta: 0 = sin paleta
    e[3] = 0;                              // reservado
    e.writeUInt16LE(1, 4);                 // planos
    e.writeUInt16LE(32, 6);                // bits por píxel
    e.writeUInt32LE(datos.length, 8);
    e.writeUInt32LE(desplazamiento, 12);
    desplazamiento += datos.length;
    return e;
  });

  return Buffer.concat([cabecera, ...entradas, ...marcos.map((m) => m.datos)]);
}

// ── Generación ────────────────────────────────────────────────────────────────────────────────

/** El SVG de la pestaña. 64 px de lienzo: es vectorial, el número solo fija la proporción. */
const SVG_PESTANA = baldosa(64);

const [p16, p32, p48, p180, p192, p512, pMask] = await Promise.all([
  png(16), png(32), png(48),
  png(180, { radio: 0 }),                     // apple-touch-icon: iOS pone su propia máscara
  png(192), png(512),
  png(512, { ocupacion: 0.45, radio: 0 }),    // maskable: zona segura del 80 %
]);

const ARCHIVOS = {
  'favicon.svg': SVG_PESTANA,
  'favicon.ico': ico([{ lado: 16, datos: p16 }, { lado: 32, datos: p32 }, { lado: 48, datos: p48 }]),
  'favicon-16.png': p16,
  'favicon-32.png': p32,
  'apple-touch-icon.png': p180,
  'icon-192.png': p192,
  'icon-512.png': p512,
  'icon-maskable-512.png': pMask,
};

const APPS = ['admin_app_v21', 'negocio_app', 'reserva_app'];

for (const app of APPS) {
  const destino = join(WORKSPACE, app, 'public');
  if (!existsSync(destino)) { console.warn(`· ${app}: no existe ${destino} — omitida`); continue; }
  mkdirSync(destino, { recursive: true });
  for (const [nombre, datos] of Object.entries(ARCHIVOS)) {
    writeFileSync(join(destino, nombre), datos);
  }
  console.log(`✓ ${app}/public — ${Object.keys(ARCHIVOS).length} iconos`);
}

/**
 * El lockup COMPLETO en PNG, solo para `admin_app_v21`.
 *
 * Aquí sí va la palabra: lo usa `Organization.logo` de los datos estructurados de la portada, que
 * Google lee a tamaño grande. Es el archivo del diseñador rasterizado tal cual, sin recomponer
 * nada — de ahí que no pase por `baldosa()`.
 */
const logoCompleto = await sharp(Buffer.from(svgFuente), { density: 288 })
  .resize(512, 512, { kernel: 'lanczos3' })
  .png({ compressionLevel: 9 })
  .toBuffer();
writeFileSync(join(WORKSPACE, 'admin_app_v21', 'public', 'logo-escalapp-512.png'), logoCompleto);
console.log('✓ admin_app_v21/public/logo-escalapp-512.png — el lockup con la palabra');
