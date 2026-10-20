/**
 * Genera `public/images/og-escalapp.png`: la tarjeta de 1200x630 que sale al compartir el enlace.
 *
 *   npm install --no-save sharp
 *   node scripts/generar-og.js
 *
 * ## Por qué un script y no un PNG suelto
 *
 * La tarjeta lleva el titular y el precio, y los dos cambian. Un PNG exportado a mano envejece en
 * silencio: nadie se acuerda de volver a exportarlo cuando sube la tarifa, y lo que se comparte
 * acaba anunciando un precio que ya no existe. Así se regenera en un comando.
 *
 * `sharp` se instala con `--no-save` a propósito: es una herramienta de autor, no una dependencia
 * de la app. No tiene por qué estar en el `package.json` de nadie que solo quiera compilar.
 *
 * ## Las medidas
 *
 * 1200x630 es lo que piden Meta y X. WhatsApp recorta al cuadrado en la vista previa pequeña, así
 * que lo importante —icono y titular— va dentro de los 630x630 centrales; los bordes solo llevan
 * fondo y el degradado.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RAIZ = path.join(__dirname, '..');
const ICONO = path.join(RAIZ, 'public', 'images', 'icono-escalapp.png');
const SALIDA = path.join(RAIZ, 'public', 'images', 'og-escalapp.png');

const ANCHO = 1200;
const ALTO = 630;

/** Los colores de marca: el violeta de la landing y el índigo del botón primario. */
const VIOLETA = '#8B5CF6';
const INDIGO = '#4F46E5';
const TINTA = '#1E1B4B';

/**
 * El fondo y el texto, en un solo SVG.
 *
 * La familia tipográfica se declara con respaldos del sistema porque el rasterizador de `sharp`
 * no descarga fuentes web: pedir solo «Inter» dejaría el texto en la fuente por defecto, que en
 * Windows es Times New Roman y arruina la tarjeta.
 */
const svg = `
<svg width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="${TINTA}"/>
      <stop offset="55%"  stop-color="${INDIGO}"/>
      <stop offset="100%" stop-color="${VIOLETA}"/>
    </linearGradient>
    <radialGradient id="brillo" cx="0.78" cy="0.22" r="0.55">
      <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${ANCHO}" height="${ALTO}" fill="url(#fondo)"/>
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#brillo)"/>

  <style>
    .marca  { font-family: 'Segoe UI', Inter, Arial, sans-serif; font-size: 44px; font-weight: 700; fill: #FFFFFF; }
    .titulo { font-family: 'Segoe UI', Inter, Arial, sans-serif; font-size: 68px; font-weight: 800; fill: #FFFFFF; }
    .bajada { font-family: 'Segoe UI', Inter, Arial, sans-serif; font-size: 31px; font-weight: 400; fill: #DDD6FE; }
    .sello  { font-family: 'Segoe UI', Inter, Arial, sans-serif; font-size: 25px; font-weight: 600; fill: #FFFFFF; }
  </style>

  <text class="marca"  x="196" y="112">EscalApp</text>

  <text class="titulo" x="88" y="268">Tu WhatsApp toma</text>
  <text class="titulo" x="88" y="348">los pedidos solo</text>

  <text class="bajada" x="88" y="412">El asistente contesta, toma el pedido</text>
  <text class="bajada" x="88" y="454">y lo deja en tu caja. 24 horas.</text>

  <rect x="88" y="508" width="330" height="62" rx="31" fill="#FFFFFF" fill-opacity="0.16" stroke="#FFFFFF" stroke-opacity="0.38"/>
  <text class="sello" x="120" y="547">30 días gratis · sin tarjeta</text>
</svg>`;

async function generar() {
  if (!fs.existsSync(ICONO)) throw new Error(`No está el icono: ${ICONO}`);

  const icono = await sharp(ICONO).resize(96, 96, { fit: 'contain', background: '#0000' }).toBuffer();

  await sharp(Buffer.from(svg))
    .composite([{ input: icono, left: 88, top: 42 }])
    .png({ compressionLevel: 9 })
    .toFile(SALIDA);

  const meta = await sharp(SALIDA).metadata();
  const kb = (fs.statSync(SALIDA).size / 1024).toFixed(0);
  console.log(`✔ ${path.relative(RAIZ, SALIDA)} — ${meta.width}x${meta.height}, ${kb} KB`);
}

generar().catch((err) => {
  console.error('✖', err.message);
  process.exitCode = 1;
});
