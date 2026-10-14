# Plano y obras de un Xpacio · /redistribucion

Misión FLT-102063 (encargo #5859 · plano y obras del Xpacio en admira.app), orden de Carlos del 14-oct-2026.

## Qué es

`plano.html` muestra el plano en planta y en alzado de un Xpacio con su inventario ITIL de pantallas y permite preparar una **propuesta de obra** que cambie su distribución:

- mover pantallas arrastrándolas en el alzado o con las flechas (Mayús: 10 cm),
- cambiarlas de pared, girarlas (vertical ↔ horizontal) o cambiar su diagonal, conservando el centro,
- añadir pantallas sueltas, un mosaico H (V–H–V) o un mosaico doble H (V–H–V–V–H–V),
- retirar una pantalla o un mosaico entero, o separar una pantalla de su mosaico.

Los mosaicos se mueven enteros salvo que se desmarque «Mover el mosaico entero». La página valida la propuesta y genera la **orden de obra**:

- **Validación:** detecta solapes, pantallas fuera de la pared o por encima del techo, puertas o escaparates tapados, muebles delante y pantallas más bajas que el criterio de altura.
- **Orden de obra:** recoge altas, bajas, traslados, giros y sustituciones, con su acción en el inventario ITIL y su impacto en contenidos (la instalación de admira.studio que hay que rehacer).

## Cómo se abre

Inicialmente, solo desde el modo experto (⌘):

- **admira.app y admira.biz:** `/redistribucion [xpacio]`. Alias: `/redistribución`, `/redistribuir`, `/plano` y `/obras`. Sin xpacio, usa el de la ficha abierta en la portada. Abre `/plano.html?locationId=<id>&modo=obra`.
- **admira.store / xpaceos.com:** el mismo verbo en `assets/xpace-shell.js` (repo admira-store). Abre el plano en `https://www.admira.app`. Sin argumento, toma el `?loc=` del gemelo.

## Datos

- **Plano:** `data/xpacios/<id>.json`, con esquema `admira.xpacio-plano/1`.
- **Paredes:** se recorren en el sentido de las agujas del reloj (planta con el eje y hacia dentro del local), así el alzado de cada pared se ve desde dentro, de su extremo `a` a su extremo `b`.
- **Pantallas:** cada pantalla física es un CI. Campos:
  - `itil`: `null` mientras no se cruce con Yokup
  - `screenId`: la pantalla en admira.studio
  - `player`
  - `grupo`: el mosaico; `subgrupo`: la H a la que pertenece
  - `orientacion`, `pulgadas`, `resolucion`
  - `pared`, `s`: centro desde la izquierda, en metros
  - `z`: base sobre el suelo, en metros
- **Registros de Xpacios con plano:**
  - `PLANOS` en `expert-commands.js`, más su copia en `xpace-shell.js` de admira-store.
  - `BIZ_ASSET_FILES` (`server/biz-assets.mjs`) sirve el plano en admira.biz.
- **Propuesta:** borrador en `localStorage` del navegador (`admira.plano.<id>`). Se descarga como JSON con esquema `admira.orden-obra/1`. Las altas y bajas de CI **no** se escriben en Yokup desde aquí.

## Starbucks Paseo de Gracia 103 (`alsea-sbux-021`) · plano esquemático

- **Sala:** 14 × 8 m y 3,30 m de alto. Medidas, barra, caja, vitrina, pilar y acceso tomados de la rejilla del gemelo de XpaceOS (`admira-xp/scripts/starbucks-room.js`), que **no** es un levantamiento medido.
- **Pantallas:** mural doble H de la instalación `starbucks-six` de admira.studio: V–H–V–V–H–V, lienzo 8160×1920, players Mac Studio (H1) y Mac mini (H2), con la horizontal centrada entre sus verticales. Va sobre la barra, en la pared del fondo, con base a 1,75 m como en el gemelo.
- **Diagonal:** 55″ **supuesta**.
- **Fuentes que no coinciden:** el gemelo de Matrix pinta seis verticales en grupos 3/1/2. Falta confirmar en visita técnica cuál es la distribución real y las medidas.
- **ITIL:** los códigos de las pantallas están por cruzar con Yokup (maestro del ITIL). Fuera de las pruebas no hay códigos de pantalla en ningún repo.

## Siguientes pasos

1. Confirmar medidas y distribución real de Starbucks 103.
2. Leer y escribir el plano desde el modelo del gemelo (`xpaceos.xpacio.v1` y el layout `starbucks_pg103_v1` de admira.store), para que haya un solo plano.
3. Al aprobar una obra, dar de alta o de baja los CI en Yokup (`itil_ci_upsert` / `itil_ci_retire`) y rehacer la instalación de admira.studio.
