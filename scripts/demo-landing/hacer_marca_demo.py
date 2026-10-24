"""Dibuja la marca de DEMOSTRACIÓN de la landing /reservas: logo, banner y una ilustración por servicio.

Todo es nuestro (formas planas en vector, iconos de Lucide —licencia ISC— y la paleta de la landing), así
que no hay fotos de terceros ni marcas ajenas. Salida: SVG + una página HTML por imagen; las imágenes se
renderizan con `chrome-headless-shell` (ver `subir_marca_demo.mjs` y `admin_ws/docs/landing-reservas.md` §7).

Uso:  py -3.13 hacer_marca_demo.py <carpeta_de_salida>
"""
import os
import sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TINTA, VIOLETA, VIOLETA_HONDO, VIOLETA_CLARO, PAPEL, SUPERFICIE = '#1a1f38', '#7060a8', '#585098', '#8078b8', '#f4f3f8', '#e9e7f1'

# Trazos de Lucide (24x24, trazo 2, redondeado).
GLIFOS = {
    'tijeras': '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
    'brillo': '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    'paleta': '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    # Gota (bálsamo), para el afeitado clásico.
    'gota': '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
}

# Una ilustración por servicio del negocio de demostración: (archivo, glifo, fondo, tono del círculo, tinta del glifo)
SERVICIOS = {
    'Afeitado clásico a navaja': ('gota', TINTA, '#2b3157', '#ffffff'),
    'Alisado con keratina': ('brillo', VIOLETA_HONDO, '#6a5ba8', '#ffffff'),
    'Arreglo de barba': ('tijeras', VIOLETA, '#8078b8', '#ffffff'),
    'Corte de cabello': ('tijeras', VIOLETA_HONDO, '#6a5ba8', '#ffffff'),
    'Corte infantil': ('tijeras', VIOLETA_CLARO, '#9b92cc', '#1a1f38'),
    'Corte y barba': ('tijeras', TINTA, '#2b3157', '#ffffff'),
    'Diseño de cejas': ('brillo', VIOLETA, '#8078b8', '#ffffff'),
    'Manicure': ('brillo', VIOLETA_CLARO, '#9b92cc', '#1a1f38'),
    'Mechas y balayage': ('paleta', VIOLETA_HONDO, '#6a5ba8', '#ffffff'),
    'Pedicure': ('brillo', VIOLETA, '#8078b8', '#ffffff'),
    'Peinado y secado': ('tijeras', VIOLETA_CLARO, '#9b92cc', '#1a1f38'),
    'Tinte': ('paleta', TINTA, '#2b3157', '#ffffff'),
    'Tratamiento capilar': ('brillo', VIOLETA_HONDO, '#6a5ba8', '#ffffff'),
}


def pagina(ancho, alto, svg):
    return (f'<!doctype html><meta charset="utf-8"><style>html,body{{margin:0;background:#000}}svg{{display:block}}</style>'
            f'<body style="width:{ancho}px;height:{alto}px">{svg}</body>')


def tarjeta(glifo, fondo, circulo, tinta):
    # 640x480: campo plano, un círculo grande descentrado y el glifo enorme encima. Sin degradados.
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <rect width="640" height="480" fill="{fondo}"/>
  <circle cx="470" cy="120" r="210" fill="{circulo}" opacity=".55"/>
  <circle cx="110" cy="440" r="120" fill="{circulo}" opacity=".35"/>
  <g transform="translate(320 240) scale(9) translate(-12 -12)" fill="none" stroke="{tinta}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">{GLIFOS[glifo]}</g>
</svg>'''


for nombre, (glifo, fondo, circulo, tinta) in SERVICIOS.items():
    arch = nombre.lower().replace(' ', '_').replace('ñ', 'n').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
    open(f'{OUT}/srv_{arch}.html', 'w', encoding='utf-8').write(pagina(640, 480, tarjeta(glifo, fondo, circulo, tinta)))

# Logo 512x512: las tres barras de EscalApp sobre tinta (el monograma del negocio de demostración).
logo = f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="{TINTA}"/>
  <g transform="translate(256 256) scale(7.4) translate(-15 -18)">
    <path d="M3 1 L28 0 L22 9 L3 10 Z" fill="{VIOLETA_CLARO}"/>
    <path d="M3 13 L28 12 L22 21 L3 22 Z" fill="{VIOLETA}"/>
    <path d="M3 25 L28 24 L22 33 L3 34 Z" fill="#ffffff"/>
  </g>
</svg>'''
open(f'{OUT}/logo.html', 'w', encoding='utf-8').write(pagina(512, 512, logo))

# Banner 1600x500: campo de tinta con círculos y franjas anchas a la derecha (el texto va a la izquierda).
franjas = ''.join(f'<rect x="{1020 + i * 120}" y="-40" width="64" height="620" fill="{c}" transform="rotate(18 {1020 + i * 120} 250)" opacity=".9"/>'
                  for i, c in enumerate([VIOLETA_HONDO, VIOLETA, VIOLETA_CLARO, '#9b92cc', SUPERFICIE]))
banner = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="500" viewBox="0 0 1600 500">
  <rect width="1600" height="500" fill="{TINTA}"/>
  <circle cx="1280" cy="250" r="330" fill="{VIOLETA_HONDO}" opacity=".45"/>
  {franjas}
</svg>'''
open(f'{OUT}/banner.html', 'w', encoding='utf-8').write(pagina(1600, 500, banner))

# ── Galería de oficios (landing /reservas, «Un motor, ocho oficios») ──
# Un glifo por oficio, mismo lenguaje que las ilustraciones de servicio. Los de Lucide (ISC) llevan su trazo;
# la hoja del spa es de dibujo propio.
GLIFOS_OFICIO = {
    'tijeras': GLIFOS['tijeras'],
    'paleta': GLIFOS['paleta'],
    'hoja': '<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z"/><path d="M5 19 14 10"/>',
    'brillo': GLIFOS['brillo'],
    'pluma': '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
    'huella': '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
    'estetoscopio': '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
    'cama': '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
}
OFICIOS = {
    'barberia': ('tijeras', TINTA, '#2b3157', '#ffffff'),
    'salon': ('paleta', VIOLETA_HONDO, '#6a5ba8', '#ffffff'),
    'spa': ('hoja', VIOLETA, '#8078b8', '#ffffff'),
    'estetica': ('brillo', TINTA, '#2b3157', '#ffffff'),
    'tatuajes': ('pluma', VIOLETA_HONDO, '#6a5ba8', '#ffffff'),
    'mascotas': ('huella', VIOLETA_CLARO, '#9b92cc', '#1a1f38'),
    'consultorio': ('estetoscopio', VIOLETA, '#8078b8', '#ffffff'),
    'hospedaje': ('cama', TINTA, '#2b3157', '#ffffff'),
}
for slug, (glifo, fondo, circulo, tinta) in OFICIOS.items():
    svg = tarjeta('tijeras', fondo, circulo, tinta).replace(GLIFOS['tijeras'], GLIFOS_OFICIO[glifo])
    open(f'{OUT}/ofi_{slug}.html', 'w', encoding='utf-8').write(pagina(640, 480, svg))
print('ok', len(SERVICIOS) + 2 + len(OFICIOS), 'imágenes')
