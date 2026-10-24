// Renderiza a PNG las páginas HTML/SVG que deja `hacer_marca_demo.py`, al tamaño exacto de cada una.
// Uso: node render.mjs <carpeta> <ruta a chrome-headless-shell>
import { spawn } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , carpeta, chrome] = process.argv;
const dir = resolve(carpeta);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9600 + Math.floor(Math.random() * 100);
const proc = spawn(chrome, ['--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}/perfil`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let lista;
for (let i = 0; i < 40; i++) { try { lista = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (lista.length) break; } catch {} await dormir(500); }
const ws = new WebSocket(lista.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const esp = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && esp.has(d.id)) { esp.get(d.id)(d.result); esp.delete(d.id); } };
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; esp.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

for (const f of readdirSync(dir).filter((x) => x.endsWith('.html'))) {
  const ancho = f === 'logo.html' ? 512 : f === 'banner.html' ? 1600 : 640;
  const alto = f === 'logo.html' ? 512 : f === 'banner.html' ? 500 : 480;
  await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: pathToFileURL(`${dir}/${f}`).href });
  await dormir(700);
  const s = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: ancho, height: alto, scale: 1 } });
  writeFileSync(`${dir}/${f.replace('.html', '.png')}`, Buffer.from(s.data, 'base64'));
}
ws.close(); proc.kill(); process.exit(0);
