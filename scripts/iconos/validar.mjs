// Comprueba que todo lo que se importa del pack de Phosphor exista de verdad, y lo arregla.
// Con --arreglar quita los nombres que no son exportados (restos de comentarios del codemod).
import fs from 'node:fs';
import path from 'node:path';

// La raiz del workspace, deducida de donde vive este script (…/admin_app_v21/scripts/iconos).
const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..').replace(/\\/g, '/');
const APPS = ['admin_app_v21', 'negocio_app', 'reserva_app'];
const ARREGLAR = process.argv.includes('--arreglar');

const recorrer = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') recorrer(p, acc); }
    else if (e.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
};

let problemas = 0;
for (const app of APPS) {
  const packPath = path.join(RAIZ, app, 'src/app/core/icons/phosphor.ts');
  const pack = fs.readFileSync(packPath, 'utf8');
  const exporta = new Set([...pack.matchAll(/^export const (\w+)/gm)].map((m) => m[1]));
  // mesa-icon.ts vive aparte
  const mesa = path.join(RAIZ, app, 'src/app/core/icons/mesa-icon.ts');
  const exportaMesa = fs.existsSync(mesa)
    ? new Set([...fs.readFileSync(mesa, 'utf8').matchAll(/^export const (\w+)/gm)].map((m) => m[1]))
    : new Set();

  for (const f of recorrer(path.join(RAIZ, app, 'src'))) {
    const txt = fs.readFileSync(f, 'utf8');
    let nuevo = txt;
    const re = /import\s+(?:type\s+)?\{([^{}]*)\}\s*from\s*['"]([^'"]*(?:icons\/phosphor|icons\/mesa-icon))['"]/g;
    for (const m of txt.matchAll(re)) {
      const destino = m[2].endsWith('mesa-icon') ? exportaMesa : exporta;
      const sinComentarios = m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      const nombres = sinComentarios.split(',').map((s) => s.trim()).filter(Boolean);
      const malos = nombres.filter((n) => !destino.has(n.split(/\s+as\s+/)[0]));
      if (!malos.length) continue;
      problemas += malos.length;
      console.error(path.relative(RAIZ, f).replace(/\\/g, '/') + '  →  ' + malos.join(', '));
      if (ARREGLAR) {
        const limpio = nombres.filter((n) => destino.has(n.split(/\s+as\s+/)[0]));
        nuevo = nuevo.replace(m[0], m[0].replace(m[1], ' ' + limpio.join(', ') + ' '));
      }
    }
    if (ARREGLAR && nuevo !== txt) fs.writeFileSync(f, nuevo);
  }
}
console.error((ARREGLAR ? '[ARREGLADO] ' : '') + 'nombres inexistentes: ' + problemas);
