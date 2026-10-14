# Plano y obras de un Xpacio · /redistribucion

Misión FLT-102063 (encargo #5859 · plano y obras del Xpacio en admira.biz), orden de Carlos del 14-oct-2026.

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

- **⌘ Modo experto · admira.biz** (este proyecto; desde el intercambio de dominios de octubre, www.admira.app es Yokup): `/redistribucion [xpacio]`. Alias: `/redistribución`, `/redistribuir`, `/plano` y `/obras`. Sin xpacio, usa el de la ficha abierta en la portada. Abre `/plano.html?locationId=<id>&modo=obra`. Si el Xpacio no tiene plano registrado y su id es válido (minúsculas, cifras y guiones), la respuesta da el enlace para subirlo: `/plano.html?locationId=<id>&subir=1`.
- **⌘ Modo experto · admira.store / xpaceos.com:** el mismo verbo en `assets/xpace-shell.js` (repo admira-store). Abre el plano en `https://www.admira.biz`. Sin argumento, toma el `?loc=` del gemelo.
- **▤ Modo avanzado de la portada:** «Subir plano» abre `/plano.html?locationId=<ficha abierta>&subir=1` (sin ficha abierta, el plano por defecto).
- **`?subir=1`** abre el panel ▤ de `plano.html` al cargar y enfoca «Subir plano». Un Xpacio sin plano también lo abre solo.

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

## Subir plano (▤ Modo avanzado)

Misión DCL-58288891486617b36ed8777d (Hoy #86), orden de Carlos del 14-oct-2026. En `plano.html`, el panel derecho ▤ Modo avanzado lleva la sección «Subir plano» (`data-shell-slot="advanced"`). Acepta:

- **Plano en JSON** (`admira.xpacio-plano/1`, hasta 2 MB). Se valida el esquema y la estructura mínima: sala (`planta` con ancho, fondo y alto), al menos 3 paredes con sus extremos `a` y `b`, y pantallas con `id`, `pared`, `s`, `z`, `orientacion` y `pulgadas`. Los errores bloquean; los avisos no: paredes en sentido antihorario o abiertas y la validación de `plano-core` (solapes, techo, puertas tapadas…). El id sale del JSON si es válido (`^[a-z0-9][a-z0-9-]{0,79}$`); si no, el de la URL. Si es de otro Xpacio, al aplicarlo se abre su página.
- **Imagen (PNG, JPG, WebP o SVG) o PDF como calco** (hasta 25 MB): se reescala en el navegador a 2400 px de lado mayor, con fondo blanco, y se guarda como dataURL (WebP, o PNG si el navegador no codifica WebP). Del PDF se pinta la página 1 con pdf.js 3.11.174, que se carga de cdnjs solo al subir un PDF (versión fijada, SRI y `isEvalSupported: false`). El calco se pinta como `<image>` en la planta, sobre el suelo y debajo de paredes, muebles y pantallas, sin capturar el puntero. Controles: ancho real en metros (por defecto, el de la sala), opacidad y «Quitar calco». Se ancla en la esquina superior izquierda de las paredes.
- **Xpacio sin plano** (por ejemplo `/plano.html?locationId=mi-tienda`): la página invita a subirlo y abre el panel. Con un JSON, se usa el JSON. Con una imagen o un PDF, se piden nombre, ancho, fondo y alto, y se crea una **sala rectangular** (`salaRectangular` en `plano-subida.mjs`: cuatro paredes F, D, P e I en el sentido de las agujas del reloj, como las de Starbucks, sin pantallas ni muebles) con el calco debajo. Las pantallas se añaden en «Propuesta de obra».

**Dónde se guarda:** solo en este navegador, en IndexedDB (base `admira-planos`, almacén `planos`, clave = id del Xpacio). Cada registro es `{id, plan | null, calco | null, fichero, subidoEn}`; `plan: null` es un calco sobre el plano publicado. Sin IndexedDB (modo privado, almacenamiento bloqueado), lo subido dura hasta recargar y la página lo avisa. **No hay backend:** no se crean APIs, no se escribe en D1 ni en Yokup, que sigue siendo el maestro del ITIL.

**Al cargar** `plano.html`, manda el plano subido en este navegador; si no hay, el publicado (`data/xpacios/<id>.json`). Con plano subido, la línea de fuente dice «Plano subido en este navegador · <fichero> · <fecha>» y ofrece «Volver al plano publicado» (el calco se conserva) o, si no hay publicado, «Borrar plano subido». Antes de cambiar de plano, si hay un borrador de propuesta (`admira.plano.<id>`), se pide confirmación y se descarta, para no mezclar propuestas de planos distintos. Un JSON que no existe en admira.biz responde con la portada (200, HTML): la página lo trata como «sin plano».

**Lógica pura:** `plano-subida.mjs` (sin DOM), con sus pruebas en `tests/plano-subida.test.mjs`. Se publica en admira.biz por `BIZ_ASSET_FILES`.

## Starbucks Paseo de Gracia 103 (`alsea-sbux-021`) · plano esquemático

- **Sala:** 14 × 8 m y 3,30 m de alto. Medidas, barra, caja, vitrina, pilar y acceso tomados de la rejilla del gemelo de XpaceOS (`admira-xp/scripts/starbucks-room.js`), que **no** es un levantamiento medido.
- **Pantallas:** mural doble H de la instalación `starbucks-six` de admira.studio: V–H–V–V–H–V, lienzo 8160×1920, players Mac Studio (H1) y Mac mini (H2), con la horizontal centrada entre sus verticales. Va sobre la barra, en la pared del fondo, con base a 1,75 m como en el gemelo.
- **Diagonal:** 55″ **supuesta**.
- **Fuentes que no coinciden:** el gemelo de Matrix pinta seis verticales en grupos 3/1/2. Falta confirmar en visita técnica cuál es la distribución real y las medidas.
- **ITIL:** los códigos de las pantallas están por cruzar con Yokup (maestro del ITIL). Fuera de las pruebas no hay códigos de pantalla en ningún repo.

## Siguientes pasos

1. Confirmar medidas y distribución real de Starbucks 103. Con «Subir plano» se puede superponer el plano real como calco para cotejarlo.
2. Leer y escribir el plano desde el modelo del gemelo (`xpaceos.xpacio.v1` y el layout `starbucks_pg103_v1` de admira.store), para que haya un solo plano.
3. Al aprobar una obra, dar de alta o de baja los CI en Yokup (`itil_ci_upsert` / `itil_ci_retire`) y rehacer la instalación de admira.studio.
