# Iconografía — el pack de Phosphor

La iconografía de las tres apps (`admin_app_v21`, `negocio_app`, `reserva_app`) es **Phosphor**,
no lucide, desde 2026-10-28. Estas herramientas generan y vigilan ese pack.

## Lo que NO cambió

Las plantillas siguen escribiendo `<lucide-icon name="chevron-down">` y el componente de
`lucide-angular` sigue siendo el que pinta. Lo único que cambió es **de dónde salen los dibujos**:
del pack generado `src/app/core/icons/phosphor.ts` de cada app, en vez de `lucide-angular`.

Eso es posible porque el componente resuelve el nombre contra las **claves** de un objeto, no
contra ningún archivo: mientras las claves se llamen igual que antes (`ChevronDown`), ninguna de
las ~2.050 llamadas de plantilla cambia.

## Las tres rarezas del formato

1. Phosphor dibuja en rejilla de 256 y `lucide-angular` fija `viewBox="0 0 24 24"` en el `<svg>`
   raíz sin dejar cambiarlo → cada nodo lleva `transform="scale(0.09375)"`. No se envuelve en un
   `<g>` porque el tipo `LucideIconNode` es `[tag, attrs]`, sin hijos.
2. El raíz impone `stroke="currentColor"` y `stroke-width`. Phosphor es relleno → cada nodo pone
   `stroke="none"`. Sin eso los iconos salen engordados.
3. Por lo mismo, **`[strokeWidth]` en una plantilla ya no hace nada**. Es esperado.

La excepción es `negocio_app/src/app/core/icons/mesa-icon.ts`, dibujado a mano en la rejilla de 24:
ese sí usa trazo (1,5 px, el grosor de Phosphor regular) y no lleva `transform`.

## Comandos

```bash
npm run iconos:generar     # vuelve a generar los tres packs desde la API de Iconify
npm run iconos:verificar   # los dos centinelas; no toca nada
```

`iconos:generar` encadena tres pasos:

| Script | Qué hace |
|---|---|
| `inventario.mjs` | recorre las tres apps y lista cada identificador de icono importado |
| `mapa.mjs` | traduce cada identificador de lucide a su equivalente de Phosphor |
| `generar.mjs` | descarga los SVG y escribe `core/icons/phosphor.ts` en cada app |

`iconos:verificar` corre:

| Script | Qué vigila |
|---|---|
| `validar.mjs` | que todo lo importado del pack **exista** en el pack (lo ve el compilador, pero tarde) |
| `centinela.mjs` | que cada `name="..."` de las plantillas tenga clave en algún proveedor |

**El segundo es el importante.** `lucide-angular` **lanza una excepción** al pintar un nombre que
no esté registrado (`The "x" icon has not been provided by any available icon providers`): no deja
un hueco, tumba la vista entera. El compilador no lo ve, y así es como `hand-platter` y
`package-x` llegaron rotos a `configuracion-inicial.html`.

## Al añadir un icono

1. Si existe en lucide con ese nombre, impórtalo como siempre desde `core/icons/phosphor` y corre
   `npm run iconos:generar`: el inventario lo recoge solo.
2. Si es un icono que **solo** tiene Phosphor (`cash-register`, `whatsapp-logo`), añádelo al mapa
   `EXTRA` de `generar.mjs`.
3. Regístralo en el `icons` de `app.config.ts` de la app que lo use.
4. Corre `npm run iconos:verificar` **antes de desplegar**.

## Variantes rellenas

Las claves que acaban en `Fill` son el mismo icono relleno (`name="algo-fill"`). Se generan solo
para los iconos del menú —el contraste lleno/vacío marca el ítem activo— porque generarlas todas
dobla el peso del pack. La lista está en `CON_FILL` dentro de `generar.mjs` y, en `negocio_app`,
duplicada en `CON_RELLENO` de `layout/sidebar/sidebar.ts`: un acceso cuyo icono no tenga relleno
se queda en contorno en vez de reventar.

## Coste

En `negocio_app`, el bundle inicial pasó de 509,21 kB a 539,65 kB en crudo, y de **141,30 kB a
148,18 kB transferidos**. Son ~7 kB por la red. El presupuesto de 500 kB ya se incumplía antes
del cambio (en 9 kB).
