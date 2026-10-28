#!/bin/sh
# Recorta y comprime las fotos de la landing /reservas (2026-10-27). Fotos de un banco gratuito
# que eligió el dueño; los originales (~36 MB) viven FUERA de los repos, en
# `EscalApp/fotos-landing-reservas/`, para no subirlos a git.
#
#  - Galería «Un solo sistema, ocho oficios»: 4:3, WebP a 640 y 400 px → public/images/producto/.
#  - Servicios de Barbería del negocio de demostración: cuadradas, JPEG 800 px → carpeta de salida,
#    para subirlas con `subir_fotos_servicios.mjs` y recapturar la página pública.
#
# Uso (desde admin_app-v21): sh scripts/demo-landing/recortar_fotos.sh <carpeta de originales> <salida servicios>
# Los recortes (ancho:alto:x:y sobre el original) están encuadrados a mano sobre las personas.
set -e
ORIG="$1"
SRV="$2"
DEST="public/images/producto"
mkdir -p "$SRV"

oficio() {
  for ancho in 640 400; do
    ffmpeg -y -loglevel error -i "$ORIG/oficio-$1.png" -vf "crop=$2,scale=$ancho:-2:flags=lanczos" \
      -c:v libwebp -quality 74 -compression_level 6 "$DEST/oficio-$1-$ancho.webp"
  done
}
oficio barberia    1333:1000:0:170
oficio salon       1332:999:0:300
oficio spa         1799:1349:120:0
oficio estetica    1779:1334:110:0
oficio tatuajes    1780:1335:120:0
oficio mascotas    1333:1000:0:300
oficio consultorio 1333:1000:0:220
oficio hospedaje   1125:844:0:700

# El nombre de salida es el del servicio normalizado, como lo busca subir_fotos_servicios.mjs.
servicio() {
  ffmpeg -y -loglevel error -i "$ORIG/servicio-$1.png" -vf "crop=$3,scale=800:800:flags=lanczos" -q:v 4 "$SRV/srv_$2.jpg"
}
servicio afeitado-clasico  afeitado_clasico_a_navaja 1333:1333:0:250
servicio corte-y-barba     corte_y_barba             1333:1333:0:300
servicio corte-infantil    corte_infantil            1333:1333:0:330
servicio corte-de-cabello  corte_de_cabello          1226:1226:250:0
servicio arreglo-de-barba  arreglo_de_barba          1333:1333:333:0
echo listo
