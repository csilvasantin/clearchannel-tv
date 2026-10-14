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
3. **Con foto o vídeo:** estima el Xpacio a partir de fotos o de un vídeo del local, como el levantamiento del laboratorio con la webcam (ver «Con foto o vídeo», abajo). Su entrada en el generador es `generarXpacio({ tipo, ancho, largo, alto, elementos })`, donde `elementos = { huecos?, mobiliario?, pantallas? }` son los elementos ya situados con el convenio de la sala.
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

### Con foto o vídeo

Misión DCL-ddf3203078fe9471f3796130 (Hoy #403), orden de Carlos del 14-oct-2026: la tercera vía de «Creación de Xpacios», para dar de alta Xpacios que no podremos visitar con lo que nos manden del local.

- **Entrada:** hasta 8 fotos (cualquier imagen que el navegador sepa leer) o un vídeo. Del vídeo, el navegador saca 6 fotogramas si dura menos de 4 s y 8 si no, en el centro de tramos iguales (`<video>` + canvas); el vídeo no sale del equipo. Cada foto o fotograma se reescala a JPEG de 1600 px de lado mayor y, si pasa de 800 KB, baja calidad y tamaño (`ESCALONES`): el worker admite fotos de 1 MB y un cuerpo de 9 MB, y así 8 caben siempre. Se ven en miniaturas con su número y se pueden quitar.
- **Tipo y pistas:** el tipo de Xpacio (los mismos 11 del generador) y unas pistas opcionales (300 caracteres; p. ej. qué puerta es la entrada). El worker las pasa a Gemini como datos, no como instrucciones.
- **Estimación:** `POST https://api.admira.store/xpacio/estimar` (worker pixer-eleven, `src/xpacio-estimar.mjs`) con `{tipo, fotos:[dataURL], notas, lang}`. El worker llama a **Gemini 3.1 Pro** (preview) con visión, razonamiento alto y salida JSON estructurada; Gemini 2.5 Pro ya no se ofrece a proyectos nuevos de la Gemini API (404). Tarda de 1 a 2 minutos: la página enseña un progreso con los segundos y corta a los 180 s. Devuelve medidas, confianza por medida y global, las referencias de tamaño usadas (objeto, tamaño supuesto y foto) y los huecos, muebles y pantallas vistos, con las paredes F, D, P e I de este esquema. El worker valida y acota todo (rangos físicos, número de elementos, tipos) y descarta lo incoherente.
- **Plano:** `plano-foto.mjs` (puro) pasa la respuesta a `generarXpacio`: lo visto se respeta tal cual (pantallas en estado «estimada», con su confianza) y lo que falta lo pone el generador según el tipo (si no se ve ninguna puerta, una en la fachada; sin muebles o sin pantallas vistos, los típicos en propuesta). Dos pantallas vistas que se pisan en la misma pared se separan lo justo (`desolaparPantallas`, con los 5 cm de separación de `plano-core`).
- **Vista previa:** tipo, m² y confianza (con su barra), medidas y confianza de cada una, qué se ha visto y qué ha completado el generador, elementos descartados, referencias y las notas del modelo. «Usar este plano» lo guarda como los otros (IndexedDB, confirmación del borrador). La fuente dice «Plano estimado desde fotos · Gemini 3.1 Pro · confianza N %» y «Medidas aproximadas, por confirmar en el sitio»: nunca se presenta como medido. `generador.estimacion` guarda modelo, fotos, confianza, referencias, notas y descartes.
- **Privacidad y coste:** las fotos solo viajan a Gemini en esa petición; el worker no las guarda. Cada estimación cuesta unos 0,13–0,15 $ (≈ 10.000 tokens de entrada y 9.000–11.000 de salida con el razonamiento, al precio de lista de Gemini 3 Pro: 2 $ y 12 $ por millón; por confirmar en la factura de Google). Para que no se pueda quemar la clave (topes decididos por Carlos el 14-oct-2026):
  - CORS y `Origin` solo de admira.biz y admira.store. localhost solo con el worker en `wrangler dev`. Desde otro dominio (clearchannel.tv, admira.app) la pestaña lo dice sin intentarlo.
  - Cupo **atómico** en un Durable Object propio del worker (`XpacioCupo`): **30 estimaciones al día** en total, **5 por IP** (las IPv6 se agrupan por /64) y **5 $ de coste al día**. Cada reserva aparta el peor caso de una llamada (0,168 $: la salida va acotada a 12.000 tokens) y se liquida con el coste real. El cupo se reserva antes de leer las fotos; si el DO no responde, no se estima (429 `cupo-no-disponible`).
  - Vars `XPACIO_ESTIMAR_TOPE_DIA`, `XPACIO_ESTIMAR_TOPE_IP` y `XPACIO_ESTIMAR_TOPE_USD`. `XPACIO_ESTIMAR_OFF=1` la corta (403).
  - Pendiente de Carlos: una clave de Gemini propia en un proyecto de GCP con cuota diaria y alerta de presupuesto, y Turnstile o sesión para exigir que sea una persona.
- **Pruebas sin Gemini:** con la página en localhost, `?estimador=http://localhost:<puerto>` apunta a un worker local (`wrangler dev`); fuera de localhost se ignora, para que un enlace no pueda mandar las fotos a otro sitio. Con ese worker local, `?simula=1` pide una respuesta fija (sin Gemini y sin gastar cupo), y la fuente lo dice («respuesta simulada»). En producción el worker no la da.

**Validación con el laboratorio** (`lab-gran-de-gracia-51`, 3,45 × 3,50 × 3,10 m ± 15 cm, 7 pantallas), con las fotos de la webcam PTZ: el error en ancho y largo va del 0 al 30 % (casi siempre se queda corto) y en el alto del 6 al 16 %. Encuentra las pantallas que salen en las fotos (las 4 de la mesa larga, en su pared, en 3 de 4 pruebas) y no inventa las 3 del puesto de Carlos, que quedan detrás de la cámara; a veces cuenta como pantalla la de la recreativa (en el plano es un mueble). Sirve para dar de alta un Xpacio que no se puede visitar, no para pedir una obra sin medir. Detalle en el PR del 14-oct-2026.

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
