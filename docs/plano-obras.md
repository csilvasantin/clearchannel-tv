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

- **⌘ Modo experto · admira.biz** (este proyecto; desde el intercambio de dominios de octubre, www.admira.app es Yokup): `/redistribucion [xpacio]`. Alias: `/redistribución`, `/redistribuir`, `/plano` y `/obras`. Sin xpacio, usa el de la ficha abierta en la portada. Abre `/plano.html?locationId=<id>&modo=obra`. Si el Xpacio no tiene plano registrado, la respuesta da el enlace para subirlo, con el id normalizado como en `plano-subida.mjs` («Café Gràcia» → `cafe-gracia`): `/plano.html?locationId=<id>&subir=1&lang=<es|en>`.
- **⌘ Modo experto · admira.store / xpaceos.com:** el mismo verbo en `assets/xpace-shell.js` (repo admira-store). Abre el plano en `https://www.admira.biz`. Sin argumento, toma el `?loc=` del gemelo.
- **▤ Modo avanzado de la portada:** «Subir plano» abre `/plano.html?locationId=<ficha abierta>&subir=1` (sin ficha abierta, el plano por defecto).
- **▤ Modo avanzado de la portada · «Creación de Xpacios»:** abre `/plano.html?locationId=<ficha abierta>&crear=1`. `?crear=1` abre el panel en la sección de creación y también se quita de la URL.
- **`?subir=1`** abre el panel ▤ de `plano.html` al cargar, enfoca «Subir plano» y se quita de la URL (`history.replaceState`), para que recargar no lo vuelva a abrir. Un Xpacio sin plano también abre el panel solo.

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
- **Dispositivos** (opcional): players, webcam y demás CI que no son pantallas, con `id`, `nombre`, `categoria` (`player` o `iot`), `rol`, `pared` e `itil`. Con `s` (y `z`) se sitúan en su pared; un player sin `s` se pinta al final de las pantallas que mueve (las de su mismo `player`). En planta salen como marcas pequeñas con su CI en el título, y en el inventario, en la tabla «Players y dispositivos · ITIL».
- **Yokup** (opcional): `yokup.site_id`, `yokup.portal` y `yokup.cis`, el establecimiento y sus CI en el maestro del ITIL. Con `yokup.portal` (https y dominio de Yokup), el enlace de vuelta de la página es «← Ver en Yokup (ITIL)» en lugar de «← Volver a la ficha», porque ese Xpacio no está en el mapa comercial.
- **Escala del dibujo:** los rótulos, los trazos finos y los márgenes se escalan con el tamaño del Xpacio (`--k`: 1 en un local de 14 m como Starbucks y proporcional en salas pequeñas), para que se lean igual en pantalla. Paredes, huecos, muebles y pantallas van siempre a su medida real.
- **Registros de Xpacios con plano:**
  - `PLANOS` en `expert-commands.js`, más su copia en `xpace-shell.js` de admira-store.
  - `BIZ_ASSET_FILES` (`server/biz-assets.mjs`) sirve el plano en admira.biz.
- **Propuesta:** borrador en `localStorage` del navegador (`admira.plano.<id>`). Se descarga como JSON con esquema `admira.orden-obra/1`. Las altas y bajas de CI **no** se escriben en Yokup desde aquí.

## Subir plano (▤ Modo avanzado)

Misión DCL-58288891486617b36ed8777d (Hoy #86), orden de Carlos del 14-oct-2026. En `plano.html`, el panel derecho ▤ Modo avanzado lleva la sección «Subir plano» (`data-shell-slot="advanced"`). Acepta:

- **Plano en JSON** (`admira.xpacio-plano/1`, hasta 2 MB). Se valida el esquema y la estructura mínima: sala (`planta` con ancho, fondo y alto), al menos 3 paredes con sus extremos `a` y `b`, y pantallas con `id`, `pared`, `s`, `z`, `orientacion` y `pulgadas`. Los errores bloquean; los avisos no: paredes en sentido antihorario o abiertas y la validación de `plano-core` (solapes, techo, puertas tapadas…). El id sale del JSON si es válido (`^[a-z0-9][a-z0-9-]{0,79}$`); si no, el de la URL. Si es de otro Xpacio, al aplicarlo se abre su página.
- **Imagen (PNG, JPG, WebP o SVG) o PDF como calco** (hasta 25 MB): se reescala en el navegador a 2400 px de lado mayor, con fondo blanco, y se guarda como dataURL (WebP, o PNG si el navegador no codifica WebP). Del PDF se pinta la página 1 con pdf.js 3.11.174, que se carga de cdnjs solo al subir un PDF (versión fijada y `isEvalSupported: false`). `pdf.min.js` lleva SRI y el worker se descarga con `fetch` e `integrity` y se sirve desde un blob propio. El calco se pinta como `<image>` en la planta, sobre el suelo y debajo de paredes, muebles y pantallas, sin capturar el puntero. Controles: ancho real en metros (por defecto, el de la sala), opacidad y «Quitar calco». Se ancla en la esquina superior izquierda de las paredes.
- **Xpacio sin plano** (por ejemplo `/plano.html?locationId=mi-tienda`): la página invita a subirlo y abre el panel. Con un JSON, se usa el JSON. Con una imagen o un PDF, se piden nombre, ancho, fondo y alto, y se crea una **sala rectangular** (`salaRectangular` en `plano-subida.mjs`: cuatro paredes F, D, P e I en el sentido de las agujas del reloj, como las de Starbucks, sin pantallas ni muebles) con el calco debajo. Las pantallas se añaden en «Propuesta de obra».

**Dónde se guarda:** solo en este navegador, en IndexedDB (base `admira-planos`, almacén `planos`, clave = id del Xpacio). Cada registro es `{id, plan | null, calco | null, fichero, subidoEn}`; `plan: null` es un calco sobre el plano publicado. Sin IndexedDB (modo privado, almacenamiento bloqueado, `indexedDB` que lanza al leerlo u `open` que no responde en 1,5 s), lo subido dura hasta recargar y la página lo avisa; el plano publicado se pinta igual. **No hay backend:** no se crean APIs, no se escribe en D1 ni en Yokup, que sigue siendo el maestro del ITIL.

**Al cargar** `plano.html`, manda el plano subido en este navegador; si no hay, el publicado (`data/xpacios/<id>.json`). Con plano subido, la línea de fuente dice «Plano subido en este navegador · <fichero> · <fecha>» y ofrece «Volver al plano publicado» (el calco se conserva) o, si no hay publicado, «Borrar plano subido». Antes de cambiar de plano, si hay un borrador de propuesta (`admira.plano.<id>`), se pide confirmación y se descarta, para no mezclar propuestas de planos distintos. Un JSON que no existe en admira.biz responde con la portada (200, HTML): la página lo trata como «sin plano».

**Lógica pura:** `plano-subida.mjs` (sin DOM), con sus pruebas en `tests/plano-subida.test.mjs`. Se publica en admira.biz por `BIZ_ASSET_FILES`.

## Starbucks Paseo de Gracia 103 (`alsea-sbux-021`) · plano esquemático

- **Sala:** 14 × 8 m y 3,30 m de alto. Medidas, barra, caja, vitrina, pilar y acceso tomados de la rejilla del gemelo de XpaceOS (`admira-xp/scripts/starbucks-room.js`), que **no** es un levantamiento medido.
- **Pantallas:** mural doble H de la instalación `starbucks-six` de admira.studio: V–H–V–V–H–V, lienzo 8160×1920, players Mac Studio (H1) y Mac mini (H2), con la horizontal centrada entre sus verticales. Va sobre la barra, en la pared del fondo, con base a 1,75 m como en el gemelo.
- **Diagonal:** 55″ **supuesta**.
- **Fuentes que no coinciden:** el gemelo de Matrix pinta seis verticales en grupos 3/1/2. Falta confirmar en visita técnica cuál es la distribución real y las medidas.
- **ITIL:** los códigos de las pantallas están por cruzar con Yokup (maestro del ITIL). Fuera de las pruebas no hay códigos de pantalla en ningún repo.

## Creación de Xpacios (▤ Modo avanzado)

Misión DCL-35708977d7b8520386dad95f (Hoy #225), orden de Carlos del 14-oct-2026: «si no tenemos los planos de un Xpacio, nos lo inventamos». La idea es dar de alta Xpacios que no podremos visitar. En `plano.html`, debajo de «Subir plano», la sección «Creación de Xpacios» tiene tres vías en pestañas:

1. **Aleatorio:** el generador, que se describe abajo.
2. **Con plano:** es «Subir plano». La pestaña lo explica y lleva a esa sección; no lo duplica.
3. **Con foto o vídeo:** **próximamente, todavía no funciona**. La pestaña lo dice y explica lo que hará: estimar el Xpacio a partir de fotos o de un vídeo del local, como el levantamiento del laboratorio con la webcam. Usará tamaños conocidos (pantallas de 27″ o 55″, puertas de unos 2,1 m, baldosa de 20 cm) y los ángulos de la óptica. Su punto de entrada ya está en el generador: `generarXpacio({ tipo, ancho, largo, alto, elementos })`, donde `elementos = { huecos?, mobiliario?, pantallas? }` son los elementos ya situados con el convenio de la sala.
   - Los elementos se respetan tal cual y no se inventan los de una categoría que ya venga dada. Si no hay puerta, se pone una.
   - Las pantallas dadas quedan en `estado: "estimada"`.
   - Los muebles inventados no pueden quedar delante de ellas.
   - La fuente dice «Plano estimado · medidas y elementos aproximados, no es un levantamiento».

La pestaña «Aleatorio» funciona así:

- **Formulario:** tipo de Xpacio y ancho (fachada), largo (fondo) y alto en metros, precargados con la media del tipo. Los m² se calculan al vuelo.
- **Crear con estas medidas** usa las medidas del formulario.
- **Creación total** sortea las medidas según la media del tipo. Cada clic hace otro sorteo y escribe las medidas sorteadas en el formulario.
- **Vista previa:** m², puertas y escaparate, muebles, pantallas y semilla.
- **Usar este plano** lo guarda como plano subido: mismo IndexedDB y misma confirmación del borrador de propuesta. La línea de fuente dice «Plano generado en este navegador · inventado». Si el Xpacio ya tiene un plano real, el generado conserva su nombre y su dirección.
- **Xpacio sin plano:** la invitación ofrece las dos vías, subir o crear.

**Generador:** `plano-generador.mjs`, lógica pura con pruebas en `tests/plano-generador.test.mjs`. `generarXpacio({tipo, ancho?, largo?, alto?, semilla?, total?, id?, nombre?, direccion?})` devuelve un `admira.xpacio-plano/1`. Parte de `salaRectangular`; `validate()` no da errores ni avisos.

- **Medidas:** las dadas a mano se respetan y las que faltan salen de la media. Con `total`, se sortean así:
  - la superficie, con una distribución triangular entre el mínimo y el máximo y la moda en la media;
  - la proporción largo/ancho, uniforme dentro del rango del tipo;
  - el alto, triangular.
- **Semilla:** el azar es mulberry32 con una semilla de 32 bits. La semilla queda en `generador` con el tipo y las medidas, y con ella se regenera el mismo plano.
- **Huecos:** la puerta va en la fachada (pared P), a un lado sorteado. Los tipos de calle llevan escaparate en el resto de la fachada. En el kiosco es una ventanilla, que va al lateral si la fachada no da.
- **Mobiliario típico:**
  - Cafetería, restaurante y panadería: contrabarra, barra y mesas.
  - Estanco: expositor, mostrador y lineal.
  - Farmacia: cajonera, mostrador, lineales murales y góndola.
  - Moda: murales, probadores, caja y burros.
  - Supermercado: murales, góndolas y cajas.
  - Banco: puestos de atención, sillas de espera y cajero.
  - Oficina: ventana, mesa de reunión y puestos.
  - Laboratorio: mesas de trabajo.
  - En todos, nada delante de la puerta ni en la franja de entrada.
- **Pantallas típicas:** menu boards sobre la contrabarra, una vertical junto a la caja, la de escaparate (que mira a la calle), las de sección del supermercado, el V–H–V del laboratorio… Todas van con `estado: "propuesta"` e `itil: null`. Cada una se coloca deslizándola por su pared hasta que `validate()` no se queja (sin solapes, sin tapar huecos, sin muebles delante, bajo el techo); si no cabe, no se pone.
- **`fuente.titulo`:** «Plano generado · inventado, no es un levantamiento · <tipo> · <m²> m² · semilla <n>».

**Tipos y medias.** Son una estimación de la casa, no una estadística oficial: superficie de sala de venta de locales de calle en ciudad.

| Tipo | m² media (rango) | Alto (m) | Largo/ancho |
|---|---|---|---|
| Cafetería | 100 (70–140) | 2,8–3,4 | 1,2–2,0 |
| Estanco | 45 (25–70) | 2,7–3,2 | 1,2–2,2 |
| Kiosco | 8 (4–12) | 2,4–2,8 | 0,7–1,3 |
| Farmacia | 120 (80–180) | 2,8–3,4 | 1,0–1,8 |
| Tienda de moda | 150 (80–250) | 3,0–3,5 | 1,4–2,6 |
| Restaurante | 160 (100–250) | 2,8–3,5 | 1,2–2,2 |
| Supermercado de proximidad | 400 (250–600) | 3,0–3,5 | 1,0–2,0 |
| Panadería | 60 (35–90) | 2,7–3,2 | 1,0–2,0 |
| Oficina bancaria | 150 (90–250) | 2,7–3,3 | 1,0–2,0 |
| Oficina | 90 (40–200) | 2,6–3,0 | 1,0–1,8 |
| Laboratorio / showroom | 40 (15–80) | 2,7–3,3 | 0,8–1,6 |

Un plano generado es una hipótesis para enseñar y comercializar el Xpacio; no es un levantamiento. Lo que se instale de verdad se da de alta en Yokup, el maestro del ITIL.

## Laboratorio AdmiraNeXT · Gran de Gràcia 51 (`lab-gran-de-gracia-51`)

Misión DCL-6ae9d5b0e2d48ee2fd9c7b19 (Hoy #152). Es el laboratorio de Carlos, en la 1.ª planta de Carrer Gran de Gràcia 51 (Barcelona). Experto: `/plano lab` (también `laboratorio`, `gran de gracia 51` y `gdg51`).

- **Levantamiento por cámara:** Neo lo levantó con la webcam PTZ de admira.live (Insta360 Link 2, encima de la pantalla H del puesto de Carlos). Hizo un barrido de -120° a +120° y midió con los ángulos de la óptica y con tamaños conocidos: pantallas de 27″, recreativa, silla, puerta doble y baldosa hidráulica de 20 cm.
- **Medidas estimadas:** la sala es de 3,45 × 3,50 m y 3,10 m de alto, con un margen de **±15 cm** en paredes y de ±10 cm en las posiciones de las pantallas. Están por confirmar con metro. Las paredes son F (ventana y puesto de Carlos), D (puerta al pasillo), P (puerta doble de las pizarras) e I (paneles 3D y mesa larga).
- **Pantallas:** dos V–H–V de 27″ de la instalación `starbucks-six` de admira.studio (prueba de hardware r2 del 13-oct-2026). Una es la del Mac mini, en el puesto de Carlos junto a la ventana; la otra es la del Mac Studio, en la mesa larga. Se añade la pantalla integrada del MacBook Pro 16.
- **ITIL en Yokup:** el establecimiento «Laboratorio AdmiraNeXT · Gran de Gràcia 51» del Portal del comercio tiene 11 CI dados de alta el 14-oct-2026: 7 pantallas (`GDG51-PAN-01…07`), 3 players (`GDG51-PLY-01…03`) y la webcam (`GDG51-CAM-01`). Los códigos del JSON son los de Yokup y no se cambian aquí.

## Plano compartido

Los clientes globales comparten planos e inventario ITIL entre las cinco soluciones (orden de Carlos, 14-oct-2026):

- admira.biz comercializa.
- admira.app, que es Yokup, mantiene.
- admira.studio adapta los contenidos.
- admira.store lo demuestra con el gemelo.
- Todo se lanza desde admira.tv.

El primer paso es que el plano publicado en admira.biz se pueda leer desde las otras soluciones.

- **URL canónica:** `https://www.admira.biz/data/xpacios/<id>.json`, por ejemplo `https://www.admira.biz/data/xpacios/lab-gran-de-gracia-51.json`.
- **Cabeceras:** `Access-Control-Allow-Origin: *`, solo lectura (GET, HEAD y el preflight OPTIONS, sin credenciales ni cookies), `Cache-Control: public, max-age=300` y `Content-Type: application/json; charset=utf-8`. Un id sin plano responde `404` con `{"error":"sin-plano","id":…}`, en lugar de la portada que daría Pages.
  - Las pone `_worker.js` y no `_headers`: la release de admira.biz conserva el `_headers` de la base (`scripts/build-biz-release.mjs`), mientras que el worker sí se copia de la raíz.
  - Pruebas: `tests/biz-assets.test.mjs`, con el worker y con la release construida.
- **Quién lo lee:**
  - El gemelo 3D de admira.store / XpaceOS.
  - Las adaptaciones de admira.studio, por el bloque `contenidos` y las pantallas con `screenId`.
  - admira.tv, que lanza las soluciones.
- **Maestro del ITIL:** Yokup. El establecimiento y sus CI van en el bloque `yokup` del JSON (`site_id`, `portal`, `cis`) y en el `itil` de cada pantalla y dispositivo. El plano de admira.biz es una vista: las altas y bajas de CI se hacen en Yokup.
- **Siguiente paso propuesto:** que Yokup guarde también el plano junto al establecimiento y que admira.biz lo lea de allí, para que haya un solo plano.

## Siguientes pasos

1. Confirmar medidas y distribución real de Starbucks 103. Con «Subir plano» se puede superponer el plano real como calco para cotejarlo.
2. Leer y escribir el plano desde el modelo del gemelo (`xpaceos.xpacio.v1` y el layout `starbucks_pg103_v1` de admira.store), para que haya un solo plano.
3. Al aprobar una obra, dar de alta o de baja los CI en Yokup (`itil_ci_upsert` / `itil_ci_retire`) y rehacer la instalación de admira.studio.
