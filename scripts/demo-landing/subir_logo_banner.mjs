// Sube SOLO el logo y el banner del negocio de DEMOSTRACIÓN (negocio 10 de la base de desarrollo),
// sin tocar sus servicios ni su descripción. Desde 2026-10-27 son piezas del Brand Book: el símbolo
// de EscalApp sobre azul noche y el logotipo horizontal corrido a la derecha del banner (la página
// pública escribe el nombre del negocio en la mitad izquierda y funde ese borde).
//
// Uso: node subir_logo_banner.mjs <logo.png> <banner.png>
// NUNCA contra producción: el backend de desarrollo debe estar en :3000 con la base de desarrollo.
import { readFileSync } from 'node:fs';

const API = process.env.API || 'http://localhost:3000';
const NEGOCIO = 10;
const [, , logo, banner] = process.argv;
if (!logo || !banner) {
  console.error('Uso: node subir_logo_banner.mjs <logo.png> <banner.png>');
  process.exit(1);
}

const imagen = (arch) => {
  const f = new FormData();
  f.append('id_negocio', String(NEGOCIO));
  f.append('imagen', new Blob([readFileSync(arch)], { type: 'image/png' }), arch.split(/[\\/]/).pop());
  return f;
};

const login = await (
  await fetch(API + '/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num_identificacion: '1000000002', password: 'Admin123*' }),
  })
).json();
const token = login.data.token;

for (const [ruta, arch] of [['/reserva/marca/logo', logo], ['/reserva/marca/banner', banner]]) {
  const r = await (
    await fetch(API + ruta, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: imagen(arch) })
  ).json();
  console.log(ruta, '→', r.success ? 'ok' : 'falló', r.message);
}
