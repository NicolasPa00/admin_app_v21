// Recorre los tres frontends y saca TODOS los identificadores importados de 'lucide-angular',
// separando los simbolos del framework de los iconos propiamente dichos.
import fs from 'node:fs';
import path from 'node:path';

// La raiz del workspace, deducida de donde vive este script (…/admin_app_v21/scripts/iconos).
const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..').replace(/\\/g, '/');
const APPS = ['admin_app_v21', 'negocio_app', 'reserva_app'];
const FRAMEWORK = new Set([
  'LucideAngularModule', 'LUCIDE_ICONS', 'LucideIconProvider', 'LucideIconData',
  'LucideIconConfig', 'LucideAngularComponent', 'LucideIconProviderInterface', 'LucideIconNode',
]);
/** El pack generado se importa a si mismo los tipos; no es una fuente de nombres. */
const GENERADO = /core[\\/]icons[\\/]phosphor\.ts$/;

const recorrer = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') recorrer(p, acc); }
    else if (/\.(ts|html)$/.test(e.name)) acc.push(p);
  }
  return acc;
};

// import [type] { a, b as c } from 'lucide-angular'  (puede ocupar varias lineas)
// Acepta los dos origenes: el de antes ('lucide-angular') y el pack nuevo, para poder
// reconstruir el inventario tanto antes como despues del codemod.
const RE_IMPORT = /import\s+(type\s+)?\{([^{}]*)\}\s*from\s*['"](?:lucide-angular|[^'"]*icons\/phosphor)['"]/g;

const porApp = {};
for (const app of APPS) {
  const archivos = recorrer(path.join(RAIZ, app, 'src'));
  const iconos = new Set();
  const ficheros = [];
  for (const f of archivos) {
    if (!f.endsWith('.ts') || GENERADO.test(f)) continue;
    const txt = fs.readFileSync(f, 'utf8');
    let m, tocado = false;
    RE_IMPORT.lastIndex = 0;
    while ((m = RE_IMPORT.exec(txt))) {
      // Los comentarios se quitan del bloque ENTERO antes de partir por comas: si se parte
      // primero, un `// ... vista.\n  ArrowRight` deja el icono pegado al final del comentario
      // y se pierde en silencio.
      const limpio = m[2].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      const nombres = limpio.split(',').map((s) => s.trim()).filter(Boolean);
      for (const n of nombres) {
        const base = n.split(/\s+as\s+/)[0].trim();
        if (!base || FRAMEWORK.has(base)) continue;
        if (!/^[A-Z][A-Za-z0-9]*$/.test(base)) continue; // restos de comentarios dentro del bloque
        if (base.endsWith('Fill')) continue;             // las rellenas se derivan, no se mapean
        iconos.add(base);
        tocado = true;
      }
    }
    if (tocado) ficheros.push(path.relative(path.join(RAIZ, app), f).replace(/\\/g, '/'));
  }

  // Nombres usados en plantillas: name="kebab" dentro de <lucide-icon ...>
  const enPlantilla = new Set();
  for (const f of archivos) {
    const txt = fs.readFileSync(f, 'utf8');
    const re = /<lucide-icon\b[^>]*?\bname="([a-z0-9-]+)"/g;
    let m;
    while ((m = re.exec(txt))) enPlantilla.add(m[1]);
    const re2 = /\[?name\]?="'([a-z0-9-]+)'"/g;
    while ((m = re2.exec(txt))) enPlantilla.add(m[1]);
  }
  porApp[app] = { iconos: [...iconos].sort(), ficheros, plantilla: [...enPlantilla].sort() };
  console.error(`${app}: ${iconos.size} identificadores en ${ficheros.length} archivos, ${enPlantilla.size} nombres en plantillas`);
}

const todos = new Set();
for (const a of APPS) porApp[a].iconos.forEach((i) => todos.add(i));
console.error(`\nUnion de identificadores: ${todos.size}`);

fs.writeFileSync(RAIZ + '/admin_app_v21/scripts/iconos/inventario.json', JSON.stringify({ porApp, union: [...todos].sort() }, null, 2));
