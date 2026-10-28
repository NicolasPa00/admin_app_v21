// Genera, para cada app, el pack de iconos Phosphor en formato LucideIconData.
//
// Phosphor dibuja en una rejilla de 256 y con relleno; lucide-angular fija viewBox="0 0 24 24",
// fill="none" y stroke="currentColor" en el <svg> raiz y no deja cambiarlos. Por eso cada nodo
// lleva su propio transform de escala (24/256 = 0.09375), su fill y stroke="none".
import fs from 'node:fs';
import path from 'node:path';

// La raiz del workspace, deducida de donde vive este script (…/admin_app_v21/scripts/iconos).
const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..').replace(/\\/g, '/');

const ESCALA = 24 / 256; // 0.09375

const { mapa } = JSON.parse(fs.readFileSync(import.meta.dirname + '/mapa.json', 'utf8'));
const inv = JSON.parse(fs.readFileSync(import.meta.dirname + '/inventario.json', 'utf8'));

// ── Descarga ──
/**
 * Claves que no vienen de ningun identificador de lucide: iconos que Phosphor SI tiene y lucide
 * no, y que valen la pena por si solos. Se piden desde la plantilla por su nombre en kebab
 * (`name="cash-register"`).
 */
const EXTRA = {
  admin_app_v21: { WhatsappLogo: 'whatsapp-logo' },
  negocio_app: { WhatsappLogo: 'whatsapp-logo', CashRegister: 'cash-register' },
  reserva_app: { WhatsappLogo: 'whatsapp-logo' },
};

const pedir = async (nombres) => {
  const r = await fetch('https://api.iconify.design/ph.json?icons=' + nombres.join(','));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
};

const necesarios = new Set();
for (const v of Object.values(mapa)) { necesarios.add(v); necesarios.add(v + '-fill'); }
for (const v of Object.values(EXTRA)) for (const n of Object.values(v)) { necesarios.add(n); necesarios.add(n + "-fill"); }
const lista = [...necesarios];
const crudos = {};
for (let i = 0; i < lista.length; i += 50) Object.assign(crudos, (await pedir(lista.slice(i, i + 50))).icons || {});
console.error('descargados ' + Object.keys(crudos).length + ' de ' + lista.length);

// ── Conversion del cuerpo SVG a nodos ──
const RE_EL = /<([a-zA-Z]+)\b([^>]*?)\/?>/g;
const RE_ATTR = /([a-zA-Z-]+)="([^"]*)"/g;

const aNodos = (body) => {
  const nodos = [];
  let m;
  RE_EL.lastIndex = 0;
  while ((m = RE_EL.exec(body))) {
    const tag = m[1];
    if (tag === 'g' || tag === 'svg') continue; // Phosphor no los usa; si apareciera, se ignora el envoltorio
    const attrs = {};
    let a;
    RE_ATTR.lastIndex = 0;
    while ((a = RE_ATTR.exec(m[2]))) attrs[a[1]] = a[2];
    const previo = attrs.transform ? ' ' + attrs.transform : '';
    attrs.transform = 'scale(' + ESCALA + ')' + previo;
    attrs.fill = attrs.fill || 'currentColor';
    attrs.stroke = 'none'; // el <svg> raiz impone stroke="currentColor"; aqui estorba
    nodos.push([tag, attrs]);
  }
  return nodos;
};

/**
 * Casi todos los iconos de Phosphor son un unico <path> con los mismos tres atributos fijos.
 * Repetirlos 200 veces eran ~12 kB de bundle, asi que ese caso sale por el helper `p()` y solo
 * lo raro (un <circle>, un <rect>, un path con mas atributos) se escribe entero.
 */
const FIJOS = { fill: 'currentColor', stroke: 'none', transform: 'scale(' + ESCALA + ')' };

const comoLiteral = (a) => '{' + Object.entries(a).map(([k, v]) =>
  (/^[a-zA-Z][a-zA-Z0-9]*$/.test(k) ? k : "'" + k + "'") + ":'" + String(v).replace(/'/g, "\\'") + "'"
).join(',') + '}';

const esSimple = ([t, a]) => t === 'path'
  && Object.keys(a).length === 4 && a.d !== undefined
  && Object.entries(FIJOS).every(([k, v]) => a[k] === v);

const serializar = (nodos) => '[' + nodos.map((n) =>
  esSimple(n) ? "p('" + n[1].d.replace(/'/g, "\\'") + "')" : "['" + n[0] + "'," + comoLiteral(n[1]) + ']'
).join(',') + ']';

// ── Salida por app ──
const CABECERA = (n, conFill) => `/**
 * Pack de iconos Phosphor en el formato que entiende \`lucide-angular\`.
 *
 * ARCHIVO GENERADO — no editar a mano. Se regenera con \`scripts/iconos/generar.mjs\`.
 *
 * ## Por que existe
 *
 * Las plantillas siguen escribiendo \`<lucide-icon name="chevron-down">\`: el componente pasa ese
 * nombre a PascalCase y lo busca como clave del proveedor. Mientras las claves se llamen igual que
 * antes, cambiar de iconografia no toca ni una plantilla. Lo unico que cambia es el dibujo.
 *
 * ## Las tres rarezas del formato
 *
 * 1. Phosphor dibuja en una rejilla de 256 y \`lucide-angular\` fija \`viewBox="0 0 24 24"\` en el
 *    \`<svg>\` raiz sin dejar cambiarlo, asi que cada nodo lleva \`transform="scale(0.09375)"\`.
 *    No se envuelve en un \`<g>\` porque el tipo \`LucideIconNode\` es \`[tag, attrs]\`, sin hijos.
 * 2. El raiz tambien impone \`stroke="currentColor"\` y \`stroke-width\`. Phosphor es relleno, no
 *    trazo, asi que cada nodo pone \`stroke="none"\`: sin eso los iconos salen engordados.
 * 3. Por lo mismo, \`[strokeWidth]\` en una plantilla ya no hace nada. Es esperado.
 *${conFill ? `
 * ## Las variantes rellenas
 *
 * Las claves que acaban en \`Fill\` son el mismo icono relleno (\`name="algo-fill"\`). Se generan
 * solo para los iconos del menu, que es donde se usa el contraste lleno/vacio para marcar el
 * item activo. Generarlas todas pesaria el doble sin que nadie las pida.
 *` : ''}
 * ${n} iconos.
 */
import type { LucideIconData, LucideIconNode } from 'lucide-angular';

/** Un <path> de Phosphor: relleno, sin trazo y escalado de la rejilla de 256 a la de 24. */
const p = (d: string): LucideIconNode =>
  ['path', { d, fill: 'currentColor', stroke: 'none', transform: 'scale(${ESCALA})' }];

`;

const APPS = {
  admin_app_v21: RAIZ + '/admin_app_v21/src/app/core/icons/phosphor.ts',
  negocio_app: RAIZ + '/negocio_app/src/app/core/icons/phosphor.ts',
  reserva_app: RAIZ + '/reserva_app/src/app/core/icons/phosphor.ts',
};

// Los iconos del menu de cada app: de estos se genera tambien la variante rellena.

const CON_FILL = {
  admin_app_v21: ['LayoutDashboard', 'Building2', 'Users', 'Rocket', 'CreditCard', 'BadgeCheck',
    'FileText', 'MessageCircle', 'Settings', 'ChartBar', 'Database', 'Bell', 'User', 'Store'],
  negocio_app: ['LayoutDashboard', 'ClipboardList', 'Bike', 'Flame', 'Armchair', 'UtensilsCrossed',
    'MessageCircle', 'Users', 'Wallet', 'Package', 'ChartBar', 'Settings', 'Truck', 'Megaphone',
    'Bot', 'Star', 'Bell', 'CashRegister'],
  reserva_app: ['LayoutDashboard', 'CalendarDays', 'CalendarCheck', 'Users', 'Scissors', 'Wallet',
    'ChartBar', 'Settings', 'UserCheck', 'Store', 'Bell', 'Globe'],
};

const resumen = [];
for (const [app, destino] of Object.entries(APPS)) {
  const claves = new Set(inv.porApp[app].iconos);
  // los dos nombres que las plantillas usan sin registrar
  if (app === 'negocio_app') { claves.add('HandPlatter'); claves.add('PackageX'); }
  for (const k of Object.keys(EXTRA[app] || {})) claves.add(k);

  const lineas = [];
  const nombresFill = new Set(CON_FILL[app] || []);
  let n = 0;

  for (const clave of [...claves].sort()) {
    const ph = (EXTRA[app] || {})[clave] || mapa[clave];
    if (!ph) { console.error('  ! sin mapa: ' + app + ' ' + clave); continue; }
    const crudo = crudos[ph];
    if (!crudo) { console.error('  ! sin datos: ' + app + ' ' + clave + ' -> ' + ph); continue; }
    lineas.push('export const ' + clave + ': LucideIconData = ' + serializar(aNodos(crudo.body)) + ';');
    n++;
    if (nombresFill.has(clave)) {
      const f = crudos[ph + '-fill'];
      if (f) { lineas.push('export const ' + clave + 'Fill: LucideIconData = ' + serializar(aNodos(f.body)) + ';'); n++; }
    }
  }

  const txt = CABECERA(n, true) + lineas.join('\n') + '\n';
  fs.mkdirSync(destino.replace(/\/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(destino, txt);
  resumen.push([app, n, Math.round(txt.length / 1024)]);
}

console.error('\napp                iconos   KB');
for (const [a, n, kb] of resumen) console.error(a.padEnd(18) + String(n).padStart(6) + String(kb).padStart(5));
