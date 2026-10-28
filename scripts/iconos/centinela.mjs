// Centinela: comprueba que cada name="..." de las plantillas exista en ALGUN proveedor de la app.
//
// `lucide-angular` LANZA una excepcion al pintar un nombre que no este registrado, asi que un
// olvido no deja un hueco en la pantalla: tumba la vista entera. El compilador no lo ve.
//
// Se comprueba contra la union de todos los proveedores de la app, no contra el del componente:
// lo que se busca aqui es el nombre que no existe en ninguna parte, que es el error real. Un
// nombre registrado en el proveedor equivocado es otro problema, mucho mas raro.
import fs from 'node:fs';
import path from 'node:path';

// La raiz del workspace, deducida de donde vive este script (…/admin_app_v21/scripts/iconos).
const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..').replace(/\\/g, '/');
const APPS = ['admin_app_v21', 'negocio_app', 'reserva_app'];

const pascal = (s) => s.replace(/(\w)([a-z0-9]*)(_|-|\s*)/g, (a, b, c) => b.toUpperCase() + c.toLowerCase());
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const recorrer = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') recorrer(p, acc); }
    else acc.push(p);
  }
  return acc;
};

const clavesDeObjeto = (cuerpo, dentro) => {
  for (let n of sinComentarios(cuerpo).split(',')) {
    n = n.trim(); if (!n) continue;
    const clave = n.includes(':') ? n.split(':')[0].trim() : n; // soporta `Image: ImageIcon`
    if (/^[A-Z][A-Za-z0-9]*$/.test(clave)) dentro.add(clave);
  }
};

let fallos = 0;
for (const app of APPS) {
  const ficheros = recorrer(path.join(RAIZ, app, 'src'));
  const registradas = new Set();

  for (const ts of ficheros.filter((f) => f.endsWith('.ts'))) {
    const txt = fs.readFileSync(ts, 'utf8');
    for (const m of txt.matchAll(/new LucideIconProvider\(\s*\{([\s\S]*?)\}\s*\)/g)) clavesDeObjeto(m[1], registradas);
    for (const m of txt.matchAll(/export const (?:icons|ICONOS\w*)\s*(?::[^=]+)?=\s*\{([\s\S]*?)\n\};/g)) clavesDeObjeto(m[1], registradas);
  }

  for (const html of ficheros.filter((f) => f.endsWith('.html'))) {
    const txt = fs.readFileSync(html, 'utf8');
    const nombres = new Set();
    for (const tag of txt.matchAll(/<lucide-icon\b[^>]*>/g)) {
      const t = tag[0];
      const fijo = t.match(/\bname="([a-z0-9-]+)"/);
      if (fijo) { nombres.add(fijo[1]); continue; }
      const enlazado = t.match(/\[name\]="([^"]*)"/);
      if (!enlazado) continue;
      // En `cond ? 'a' : 'b'` solo interesan las ramas; lo de antes del `?` suele ser
      // una comparacion con un literal que no es un icono (`orden() === 'nombre'`).
      // Antes se quitan las comparaciones (`m.tipo === 'egreso'`), que en un ternario anidado
      // quedan a la derecha del primer `?` y no son nombres de icono.
      const ramas = enlazado[1].replace(/[!=]==?\s*'[^']*'/g, '');
      for (const l of ramas.matchAll(/'([a-z0-9-]+)'/g)) nombres.add(l[1]);
    }

    for (const n of nombres) {
      if (registradas.has(pascal(n))) continue;
      fallos++;
      console.error(path.relative(RAIZ, html).replace(/\\/g, '/') + '  →  name="' + n + '" (clave ' + pascal(n) + ')');
    }
  }
}
console.error('\nnombres sin proveedor: ' + fallos);
