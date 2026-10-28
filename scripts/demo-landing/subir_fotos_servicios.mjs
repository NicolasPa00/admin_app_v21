// Sube fotos JPEG a los servicios del negocio de DEMOSTRACIÓN (negocio 10 de la base de desarrollo).
// Busca `srv_<nombre-normalizado>.jpg` en la carpeta por cada servicio; los que no tienen foto se
// dejan como están (con su ilustración). Desde 2026-10-27 los cinco de Barbería llevan fotos de un
// banco gratuito, que son los que se ven en la captura de la landing /reservas.
//
// Uso: node subir_fotos_servicios.mjs <carpeta con los JPG>
// NUNCA contra producción: el backend de desarrollo debe estar en :3000 con la base de desarrollo.
import { readFileSync, existsSync } from 'node:fs';

const API = process.env.API || 'http://localhost:3000';
const NEGOCIO = 10;
const [, , carpeta] = process.argv;
if (!carpeta) {
  console.error('Uso: node subir_fotos_servicios.mjs <carpeta>');
  process.exit(1);
}

const norm = (n) =>
  n.toLowerCase().replace(/ñ/g, 'n').replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ /g, '_');

const login = await (
  await fetch(API + '/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num_identificacion: '1000000002', password: 'Admin123*' }),
  })
).json();
const token = login.data.token;
const auth = { Authorization: `Bearer ${token}` };

const servicios = (await (await fetch(`${API}/reserva/servicios?id_negocio=${NEGOCIO}`, { headers: auth })).json()).data;
let subidas = 0;
for (const s of servicios) {
  const arch = `${carpeta}/srv_${norm(s.nombre)}.jpg`;
  if (!existsSync(arch)) continue;
  const f = new FormData();
  f.append('id_negocio', String(NEGOCIO));
  f.append('imagen', new Blob([readFileSync(arch)], { type: 'image/jpeg' }), arch.split(/[\\/]/).pop());
  const r = await (await fetch(`${API}/reserva/servicios/${s.id_servicio}/imagen`, { method: 'POST', headers: auth, body: f })).json();
  console.log(s.nombre, '→', r.success ? 'ok' : `falló: ${r.message}`);
  if (r.success) subidas++;
}
console.log(`fotos subidas: ${subidas}`);
