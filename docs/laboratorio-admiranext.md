# Laboratorio AdmiraNeXT · handON

Xpacio `lab-gran-de-gracia-51`, Carrer Gran de Gràcia 51, 1.ª planta · 08012 Barcelona. Misión DCL-6ae9d5b0e2d48ee2fd9c7b19.
Es el laboratorio de I+D de AdmiraNeXT y la sala de Carlos: no se comercializa y no es una tienda Starbucks.
Página pública: `/laboratorio/` (admira.biz). Detalle del plano: [plano-obras.md](plano-obras.md#laboratorio-admiranext--gran-de-gràcia-51-lab-gran-de-gracia-51).

## Acceso

- Ficha del mapa: `/?locationId=lab-gran-de-gracia-51` → «Plano y obras · ITIL ↗» y «handON del laboratorio ↗».
- Experto: `/plano lab` (alias `laboratorio`, `gran de gracia 51`, `gdg51`) abre `plano.html?locationId=lab-gran-de-gracia-51&modo=obra`.
- Tour Starbucks España: laboratorio → Paseo de Gracia 103 → L’Illa Diagonal 557 (`/demo dooh starbucks espana`). Ver [starbucks-digital-twin.md](starbucks-digital-twin.md).
- Gemelo 3D: https://www.xpaceos.com/xpacios/gran-de-gracia-51/ (sin gemelo 2D/Matrix; ese solo existe para Paseo de Gràcia).
- Plano compartido (CORS de lectura): https://www.admira.biz/data/xpacios/lab-gran-de-gracia-51.json.

## Sala

- 3,45 × 3,50 m y 3,10 m de alto, levantada por Neo con la webcam PTZ Insta360 Link 2 de admira.live (barrido de -120° a +120°).
- Margen ±15 cm en paredes y ±10 cm en pantallas. **Por confirmar con metro.**
- Paredes: F ventana y puesto de Carlos · D puerta al pasillo · P puerta doble de las pizarras (Trinity, Oráculo, Neo y Morfeo) · I paneles 3D y mesa larga.
- Mobiliario: mesa del puesto de Carlos, mesa larga del Mac Studio, nevera Monster, recreativa ADMIRA, mueble negro, silla Secretlab y silla de oficina. Mesas en L y nevera corregidas por Carlos con fotos del 14-oct-2026.

## Pantallas, players e ITIL

Yokup es el maestro del ITIL: 11 CI dados de alta el 14-oct-2026 en el Portal del comercio (site `4723419e-5bf2-4f7c-b5d2-b87171503754`). El JSON del plano es una vista; las altas y bajas se hacen en Yokup.

| CI | Elemento | Player | Notas |
|---|---|---|---|
| GDG51-PAN-01…03 | V–H–V 27″ mesa larga | Mac Studio (GDG51-PLY-01) | `macstudio-starbucks-*` |
| GDG51-PAN-04…06 | V–H–V 27″ puesto de Carlos | Mac mini (GDG51-PLY-02) | PAN-05 (H central, lleva la webcam) reservada: trabajo de Carlos |
| GDG51-PAN-07 | Pantalla integrada | MacBook Pro 16 (GDG51-PLY-03) | player `macbookpro16`, demo de Bugito |
| GDG51-CAM-01 | Webcam PTZ Insta360 Link 2 | — | cámara de admira.live, 6 presets |

Contenidos: instalación `starbucks-six` de admira.studio, grupo `laboratorio`.

## Bugito y Supervisor

`/bugito error starbucks gran de gracia 51 pantalla girada` · `/bugito restaurar starbucks gran de gracia 51`
(EN: `/bugito fault … rotated screen`, `/bugito restore …`). Envía el fallo al MBP16 y el Supervisor lo detecta. Negro pone el contenido en espera, no apaga el portátil. La vinculación Starbucks → laboratorio → MBP16 es de demo y no representa el inventario de un restaurante. Ver [bugito-xpacios.md](bugito-xpacios.md).

## Límites y continuación

- Medidas estimadas por cámara; marca y modelo de las pantallas por leer en la etiqueta.
- Sin impresiones ni CPM. «Sin señal reciente» en rojo no demuestra apagado físico.
- Próximo trabajo: medir con metro, leer etiquetas y mantener el plano alineado con los CI de Yokup.

## English handON

The AdmiraNeXT lab (`lab-gran-de-gracia-51`) is Carlos’s R&D room on the first floor of Carrer Gran de Gràcia 51, Barcelona. It is not for sale and is not a Starbucks shop. Public page: `/laboratorio/`. Expert `/plano lab` (also `laboratorio`, `gran de gracia 51`, `gdg51`) opens the plan in works mode. It is the first stop of the Starbucks Spain tour (`/demo dooh starbucks spain`). The 3D twin lives at xpaceos.com/xpacios/gran-de-gracia-51/.

The room (3.45 × 3.50 × 3.10 m, ±15 cm) was surveyed with the admira.live PTZ webcam and still needs a tape-measure check. Yokup is the ITIL master for its 11 CIs: seven screens (two 27″ V–H–V sets on the Mac Studio and Mac mini, plus the MacBook Pro 16 display), three players and the webcam. The central H at Carlos’s desk (GDG51-PAN-05) is reserved for his work. Bugito’s demo binds Starbucks → lab → MBP16 (GDG51-PAN-07); it is not a restaurant inventory. Screen make and model are still to be read from the labels.
