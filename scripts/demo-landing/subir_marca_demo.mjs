// Sube la marca de DEMOSTRACIÓN (ver hacer_marca_demo.py + render.mjs) al negocio 10 de la base de
// DESARROLLO, por la API de reserva: logo, banner, una imagen por servicio y una descripción propia.
// Para que la página pública y las pantallas de gestión se vean con una identidad nuestra y las
// capturas de la landing /reservas no lleven fotos ni marcas de terceros.
//
// Uso: node subir_marca_demo.mjs <carpeta con los PNG> [--dry]
// NUNCA contra producción: el backend de desarrollo debe estar en :3000 con la base de desarrollo.
import { readFileSync, existsSync } from 'node:fs';

const API = process.env.API || 'http://localhost:3000';
const NEGOCIO = 10;
const [, , carpeta, bandera] = process.argv;
const DRY = bandera === '--dry';

const norm = (n) => n.toLowerCase().replace(/ñ/g, 'n').replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ /g, '_');
const j = async (m, url, body, token) =>
  (await fetch(API + url, { method: m, headers: { ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}` }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined })).json();
const imagen = (arch) => {
  const f = new FormData();
  f.append('id_negocio', String(NEGOCIO));
  f.append('imagen', new Blob([readFileSync(arch)], { type: 'image/png' }), arch.split(/[\\/]/).pop());
  return f;
};

const login = await (await fetch(API + '/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ num_identificacion: '1000000002', password: 'Admin123*' }) })).json();
const token = login.data.token;

if (DRY) console.log('[dry] no se sube nada');
else {
  console.log('logo:', (await j('POST', '/reserva/marca/logo', imagen(`${carpeta}/logo.png`), token)).message);
  console.log('banner:', (await j('POST', '/reserva/marca/banner', imagen(`${carpeta}/banner.png`), token)).message);
}

const servicios = (await j('GET', `/reserva/servicios?id_negocio=${NEGOCIO}`, null, token)).data;
let ok = 0;
for (const s of servicios) {
  const arch = `${carpeta}/srv_${norm(s.nombre)}.png`;
  if (!existsSync(arch)) { console.log('  sin imagen para', s.nombre); continue; }
  if (DRY) { console.log('[dry]', s.nombre, '→', arch); continue; }
  const r = await j('POST', `/reserva/servicios/${s.id_servicio}/imagen`, imagen(arch), token);
  if (r.success) ok++; else console.log('  falló', s.nombre, r.message);
}

if (!DRY) {
  const v = await j('PUT', '/reserva/vitrina', {
    id_negocio: NEGOCIO,
    descripcion_publica: 'Un negocio de demostración de EscalApp: elige tu servicio, el profesional y la hora, y llega justo a tu turno.',
  }, token);
  console.log('descripción:', v.message);
}
console.log(`imágenes de servicio subidas: ${ok} de ${servicios.length}`);
