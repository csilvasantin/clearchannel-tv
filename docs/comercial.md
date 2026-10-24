# Comercial · campañas para anunciantes

Comercial es Admirito con corbata y maletín. Se abre en admira.biz desde `/comercial` o `/admirito comercial` en el motor Experto compartido. Pasos: `brief`, `audiencias`, `ubicaciones`, `propuesta`. `/admirito` o `/default` cierra el asistente y vuelve al verde estándar.

Recoge anunciante, objetivo, audiencia solicitada, fechas, presupuesto, pases y duración. «Elegir audiencias» y «Elegir ubicaciones» abren los selectores existentes. «Usar la selección del mapa» incorpora expresamente los IDs actuales. La propuesta reutiliza `CampaignPlanner.quote`, indica oportunidades estimadas y disponibilidad sin confirmar. Si falta CPM o impresiones, los deja pendientes. Si cambia la selección o el target, exige incorporarlos de nuevo. «Revisar en el planificador» transfiere la selección actual y el brief validado al planificador existente; no envía solicitudes ni publica campañas. El texto se puede descargar.

El brief vive en memoria de la pestaña; no se envía por URL ni se guarda en localStorage. No se añade una segunda API de precios, catálogo o publicación. No se modifican las autorizaciones de proyecto.

## English

Commercial is Admirito with a tie and briefcase, focused on advertiser campaigns. `/comercial` and `/admirito comercial` use the shared Expert engine. The assistant collects a brief, opens existing audience/location selectors and adopts the exact selected IDs. Proposals use the existing planner's quote and clearly distinguish estimated opportunities from unique people and confirmed availability. Missing price/audience inputs remain unknown. Selection changes require explicit re-adoption. Planner review transfers the validated brief and exact current selection; it does not submit, book or publish a campaign. Brief data stays in tab memory and downloadable text, outside URLs and persistent browser storage.

## Look and feel (20-oct-2026, orden de Carlos)

- **Viste con la marca de la página**: variables de `brand.css` (`--card`, `--card2`, `--line`, `--ink`, `--mut`, `--brand`), así sigue la marca blanca (Admira, Clear Channel) sin tocar nada. Su acento propio es el azul de la corbata (`--com`) y el oro del cierre del maletín (`--com-oro`, para los avisos), igual que el Arquitecto tiene su amarillo de obra y Bugito su rojo.
- **Cabecera**: la nube más pequeña (84 px), el rótulo «Admirito · comercial» sobre el título y el ✕ a la derecha. La cabecera es el asa de la ventana.
- **Ventana movible** (norma de Carlos del 15/16-oct-2026): se mueve por la cabecera, cambia de tamaño por la esquina de abajo a la derecha (también con el dedo), vuelve a su sitio con doble clic y recuerda dónde se dejó en este navegador (`movible.mjs`, copia del de xpaceos; sólo la posición, nunca el brief). En móvil ocupa el ancho y no se mueve.
- **Los dos modos** («Vender campañas» y «Captar comercios») son un selector: el activo lleva el azul de la corbata (`aria-pressed`).
- **Formulario y propuesta**: campos sobre `--card2` con borde `--line` y foco azul; la propuesta en una tarjeta con filete azul; el botón principal en el verde de marca (`--brand`); el cuerpo tiene su propio scroll bajo la cabecera.
- Sellos `?v=20261020-comercial-4` en `index.html`; `movible.mjs` en `BIZ_ASSET_FILES`.

## Entradas visibles (20-oct-2026, orden de Carlos)

- ~~**Botón en la cabecera de la portada**~~ (`#header-comercial-toggle`): retirado el 22-oct-2026 por orden de Carlos («no sé qué hace Admirito en el menú superior, pero no toca»). Comercial entra por «Anunciarme aquí» y por `/comercial` o `/admirito comercial` en Experto; `comercial.mjs` sigue tolerando que el botón no exista.
- **«Anunciarme aquí» en la ficha de cada Xpacio** (`#p-comercial`, en la botonera de la ficha; desde el 24-oct-2026, la primera y principal: ver más abajo): la selección del mapa pasa a ser sólo ese local (`AdmiraCommercialContext.seleccionar(id)`, como el borrador de Pixeria: ámbito local, circuito «all», sin autoselección) y Comercial se abre con él ya incorporado («1 ubicaciones incorporadas»). Si el catálogo aún no está listo, se abre igual y avisa.
- Sellos `?v=20261020-comercial-5` (comercial.css, comercial.mjs y app.js). Prueba: «commercial has visible entry points…» en `tests/comercial.test.mjs`.

## La ficha pensada para el comprador (24-oct-2026 · misión FLT-102664 · encargo #7138)

- **«Anunciarme aquí» es la acción principal de la ficha**: va la primera de la botonera y con el estilo primario de la página (`class="p-comercial primary"`). El Tour DooH pasa a secundario mientras «Anunciarme aquí» está a la vista (`#p-comercial:not([hidden]) ~ #p-tour.primary` en `index.html`). Si el botón está oculto (sin Comercial: el módulo no carga fuera de admira.biz), el Tour DooH vuelve a ser el principal. Se conservan los ids, `data-commercial="here"`, el texto ES/EN y la lógica que lo muestra.
- **Botonera 2×2**: rejilla de dos columnas (`grid-template-columns:repeat(2,minmax(0,1fr))`). Los botones ocultos no ocupan celda y los rótulos se parten por palabras (`word-break`, `overflow-wrap` normales y `hyphens:manual`): antes salían «EXPLORA/R ESCENA VINCULA/DA» y «ANUNCIA/RME AQUÍ».
- **Ficha por enlace rápida**: con `/?circuit=…&loc=<id>`, la portada pide ese local con `GET https://brain.digitalavatar.ai/locations/:id` (`loadOmnipLocationDetail`) en cuanto arranca. Lo cose como el catálogo (`mergeOmnipLocations`), pinta la ficha y deja que la cámara vuele detrás (`flyToLocation(loc, {fichaAbierta:true})`, que no la cierra). Antes esperaba al catálogo completo, al estilo del mapa y al aterrizaje, y salía a los ~15 s. El circuito se sigue aplicando al llegar el catálogo, con el selector plegado. Si el local no llega, manda el camino de antes (`applyCircuitDeepLink`). «Anunciarme aquí» sigue esperando al catálogo (hasta 3 minutos) antes de incorporar el local.
- **Comercial opaco**: la ventana y su cabecera ya no son translúcidas. Al abrir Comercial desde la ficha ya no se lee el nombre del local debajo de «Comercial». La nube pasa de 230 a 350-370 px: en modo dock su consola ocupa 148 px, y con 230 px quedaban 82 px para Admirito y el bocadillo, que salía cortado por arriba. En el móvil (≤ 600 px) toda la ventana hace scroll bajo la cabecera fija, y la nube tiene 360-400 px (caben tres líneas de bocadillo).
- **Pendiente fuera de este repo**: los atajos de la nube («Vender una campaña», «Captar un comercio», «Prepara la propuesta», «¿Quién eres?») viven dentro del iframe de digitalavatar.ai, en una fila con `flex-wrap:nowrap` y `overflow-x:auto` (se desplazan, pero sin barra visible). Para que pasen a varias líneas hay que cambiarlo en ese repo.
- Sellos `?v=20261024-ficha-comprador-1` (app.js, comercial.css y comercial.mjs). Pruebas: `tests/ficha-comprador.test.mjs`.

### English

- **“Advertise here” is the card’s main action.** It comes first and uses the page’s primary style. The DooH Tour becomes secondary while “Advertise here” is visible. When the button is hidden (no Commercial module outside admira.biz), the Tour is the main action again.
- **2×2 action grid.** Hidden buttons take no cell. Labels wrap between words, never inside one.
- **Fast deep-linked card.** With `/?circuit=…&loc=<id>`, the page fetches that single venue (`GET /locations/:id`) at start-up and paints its card straight away. The camera flies in behind it. The full 10 MB catalogue still applies the circuit when it arrives. If the venue cannot be fetched, the previous path takes over.
- **Opaque Commercial window.** The venue card no longer shows through the header. The cloud is 350-370 px tall (360-400 px on phones), so Admirito and the speech bubble fit. On phones the whole window scrolls under a sticky header.
- **Pending elsewhere:** the cloud’s shortcut chips sit inside the digitalavatar.ai iframe on a single scrolling row. Wrapping them needs a change in that repository.

## Previos de lo que emiten las pantallas, al hacer zoom y en la ficha (24-oct-2026 · misión FLT-102666 · encargo #7145)

Carlos: «cuando hagamos zoom poder ver previos de lo que emiten las pantallas en el lugar de anunciarme aquí y pon encima anunciarme aquí». Eligió «En los dos sitios».

- **Mapa** (`previos-zoom.js`, montado en `app.js`): desde zoom 14 (unos 5 km de ancho en escritorio; se ven a la vez varios Alcampo de Zaragoza o los Altadis de l'Eixample), los Xpacios visibles llevan una tarjeta flotante (marcador HTML de MapLibre anclado al punto) con **«💼 Anunciarme aquí» encima** del previo. Como mucho 6 en escritorio y 3 en el móvil, enteras en la vista, sin solaparse y fuera de lo que tapan la ficha, Comercial o el selector de circuitos. Primero los que tienen previo y, entre ellos, los más cercanos al centro: en el centro de Zaragoza los tres más cercanos eran Correos y BBVA sin previo, con 30 Alcampo alrededor. Por debajo de 14 vuelven los puntos de siempre.
- «Anunciarme aquí» de la tarjeta hace lo mismo que `#p-comercial` para ESE Xpacio (`AdmiraComercial.anunciarAqui(id)` en `comercial.mjs`). El clic en el previo abre su ficha, como el clic en el punto (`abrirXpacioDelMapa`). Sin Comercial no hay botón, y una tarjeta sin previo no se pinta.
- **Ficha**: bajo «Anunciarme aquí» (ahora a lo ancho), el previo grande (`#p-emite`). En Previo DooH, «▶ Ver emitiendo» abre el previo de siempre (`openPrevio`, con el canal deformado sobre la fachada). Con vídeo de la pieza, «▶ Ver la pieza» lo reproduce mudo. Tour DooH, Escena y Plano siguen debajo, en la rejilla 2×2.
- **Niveles, con la etiqueta que dice de dónde sale lo que se ve**: 1 «En directo» (la pantalla publica en `/signage/now` una pieza de menos de 170 s; se reutiliza el sondeo de `pollEmissionStatus`, sin peticiones nuevas); 2 «Previo DooH» (la foto de fachada ampliada alrededor de la pantalla, con el póster del circuito encajado en el `quad`); 3 «Programación del circuito» (el póster de la primera pieza del Stock con el hashtag del circuito); 4 nada: tarjeta compacta con «Sin previo todavía». Si una imagen falla, el Xpacio baja al nivel siguiente; la pantalla del Previo DooH tiene fondo de marca mientras llega el póster. Reparto el 24-oct-2026: 0 en directo (las 61 pantallas vinculadas daban `item:null`), 102 Previo DooH (Alcampo), 229 de programación (100 JTI, 110 Starbucks, 19 Altadis) y 8.809 sin previo.
- **`GET /api/previo/circuito?tag=<hashtag>`** (`server/previo-circuito.mjs`, sólo en admira.biz, su vista previa y local): pregunta a `api.admira.store/stock/list?tag=…&type=video` (unos 22 s) y guarda la respuesta en la Cache API. Pasados 15 min se sirve al instante y se renueva por detrás; a las 24 h caduca; un fallo del Stock se recuerda 1 min y no pisa una copia buena. Tags `[a-z0-9_-]{1,40}` (si no, 400). Devuelve `{ok, tag, poster, video, title, vertical, horizontal}` o `{ok:true, poster:null}`. El previo grande de siempre (`previoPoster`) también lo usa ahora.
- **Rendimiento**: con el zoom alejado, ninguna petición nueva (sólo el propio `previos-zoom.js`); en el mapa, ni iframes ni vídeo en autoplay (el vídeo, mudo, sólo en la tarjeta que se mira). Antirrebote de 180 ms tras `moveend`. Las tarjetas se ocultan durante los vuelos de cámara, el Tour DooH y el previo abierto. Elegir y montar las tarjetas cuesta ~1 ms con 263 puntos visibles (Barcelona, zoom 14).
- **Llegar de golpe al zoom de calle (arreglo del 24-oct, v.24.10.2026.r3.15:58):** tras un `jumpTo`, un `flyTo` del buscador, el clic en un grupo o un enlace profundo, el `moveend` podía llegar antes de que la fuente `locs` tuviera sus teselas de ese zoom: `calcular()` veía 0 puntos y no salía ninguna tarjeta hasta mover el mapa. Ahora, si no hay puntos o la fuente no ha terminado de cargar, se espera al aviso `sourcedata` de `locs` (con `isSourceLoaded`) y, por si ya pasó, se reintenta cada 700 ms hasta 6 veces. No sirve `idle`: el latido de los puntos en vivo (`animatePulse`) repinta en cada fotograma y el mapa nunca llega a `idle`. Mientras la fuente recarga (llega el catálogo, cambia la emisión), las tarjetas que haya se quedan.
- Sellos `?v=20261024-previos-zoom-1` (app.js, comercial.mjs) y `?v=20261024-previos-zoom-idle-1` (previos-zoom.js). Pruebas: `tests/previos-zoom.test.cjs` y `tests/previo-circuito.test.mjs`.

### English

- **Map.** From zoom 14, visible venues get a floating card anchored to their dot, with **“💼 Advertise here” above** a preview of what their screens show. At most 6 on desktop and 3 on phones, fully in view, never overlapping each other or the open card, Commercial or the circuit picker. Venues with a preview come first, nearest to the centre. Below zoom 14 the usual dots return.
- The card’s “Advertise here” does what the venue card’s button does for that venue. Clicking the preview opens the venue card, like clicking the dot.
- **Venue card.** Under “Advertise here” (now full width) comes the large preview. For a DooH preview, “▶ Watch it playing” opens the usual storefront preview. Tour, Scene and Floor plan stay below in the 2×2 grid.
- **Levels, each labelled honestly:** “Live” (a fresh item on `/signage/now`), “DooH preview” (storefront photo with the circuit’s poster fitted to the screen), “Circuit programme” (poster of the first Stock item with the circuit hashtag) or a compact “No preview yet”. A failing image drops the venue to the next level.
- **`GET /api/previo/circuito?tag=…`** caches the slow Stock answer (~22 s) at the edge for 15 minutes, then serves it instantly while refreshing in the background.
- Zoomed out, the page makes no new requests. There are no iframes or autoplaying videos on the map.
- **Arriving straight at street level** (jump, search, cluster click, deep link): if the dots are not loaded yet, the cards wait for the `locs` source to finish loading (or retry every 700 ms, up to 6 times) instead of staying hidden until the map moves.

## El Xpacio destino parpadea en el mapa (24-oct-2026 · misión FLT-102668 · encargo #7151)

Carlos: «haz que la pantalla destino (en este caso era CanalKiosk Gràcia) parpadee para que sepas cuál es rápidamente». Eligió «El punto en el mapa». CanalKiosk Gràcia está a ~200 m del MUPI «gracia» y en su mismo punto hay otros dos Xpacios (`ipad-luna`, `bcn-kiosk-016`): al aterrizar no se sabía cuál era el destino.

- `flyToLocation` marca el destino (`destino-mapa.js`). Pasan por ahí el buscador, el enlace `?circuit=…&loc=…`, el clic en un punto o en el previo de una tarjeta y los tours.
- Al aterrizar, el punto late 5 s: anillo blanco y magenta que parpadea y una onda que se agranda. Después queda un anillo blanco fijo mientras su ficha siga abierta. Al cerrar la ficha o abrir la de otro Xpacio, se quita.
- En los tours, sólo el anillo fijo. Con «reducir movimiento» (`prefers-reduced-motion`), también.
- Es un marcador HTML, no una capa: no toca la fuente `locs`, ni la selección (`selected-ring`, cian), ni el semáforo de incidencias. A zoom bajo queda sobre el grupo que contiene el punto. Sin bucles: animaciones CSS con vueltas contadas y un temporizador que lo pasa a fijo.
- En el móvil la ficha tapaba el destino (aterrizaba en el centro, bajo la hoja). El vuelo lleva ahora un relleno abajo (la hoja) y arriba (la cabecera), y el punto queda a la vista. Al cerrar la ficha, el mapa recupera todo su alto. En escritorio, relleno cero.
- Sellos `?v=20261024-destino-1` (app.js y destino-mapa.js). Pruebas: `tests/destino-mapa.test.cjs`.

### English

- When the map flies to a venue (search, `?loc=` link, clicking a dot or a preview card), its dot pulses for 5 seconds on arrival: a white and magenta ring plus an expanding wave. It then keeps a steady white ring while the venue card is open. Closing the card or opening another venue removes it.
- Tours and reduced-motion get the steady ring only. It is an HTML marker: no new layer, and the selection ring and the incident colours are untouched.
- On phones the flight now pads for the bottom sheet, so the destination stays visible above the card.

## Elegir entre Xpacios del mismo punto (24-oct-2026 · misión FLT-102672 · encargo #7155)

En Plaça de la Vila de Gràcia, `ipad-luna` y `canalkiosk-gracia` comparten coordenada, y `bcn-kiosk-016` está a ~7 m. El clic en ese punto abría el primero sin dejar elegir.

- **Clic en un punto** (`unclustered-point`): sale un selector anclado al punto (popup de MapLibre) si bajo el clic hay más de un Xpacio. Cuentan los de la misma coordenada, los que están a 8 px o menos y los que se solapan justo bajo el clic. Muestra el nombre, el tipo y, si ya se sabe sin pedir nada, el nivel de previo.
  - Al elegir, `flyToLocation` abre la ficha y marca el destino.
  - Con un solo Xpacio, abre directo, como antes.
  - El selector se abre arriba o abajo del punto, según dónde haya sitio libre bajo la cabecera y el selector de circuitos. Si hay muchos Xpacios, la lista hace scroll.
- **Clic en un grupo (cluster)**: vuelve a acercar el mapa. MapLibre 5 devuelve una promesa en `getClusterExpansionZoom` y la función `(err, z)` ya no se llamaba, así que el clic no hacía nada en main. Se vio al verificar este cambio.
- **Orden**: primero la incidencia más grave (el semáforo de los owners, como el clic de siempre), luego lo más cercano al clic y luego por nombre.
- **Accesible**: es un menú de botones. Flechas, Inicio y Fin mueven el foco, Intro elige y Escape cierra y devuelve el foco. Los botones miden al menos 44 px. Un vuelo de cámara lo cierra.
- **Tarjetas de previo**: en un punto compartido, la tarjeta es de un Xpacio. Debajo del previo lleva su nombre y «+N», que abre el mismo selector. El clic en el previo abre el Xpacio de la tarjeta.
- Una tarjeta ajena ya no tapa un punto compartido: hay que poder hacer clic en él para elegir. En Gràcia, la tarjeta de `altadis-bcn-002` tapaba el punto de CanalKiosk e `ipad-luna`.
- Al pasar el ratón por un punto compartido, el tooltip añade «y N más en este punto · clic para elegir».
- La parte pura (agrupar, ordenar, vecinos con rejilla, teclado y el HTML del selector) está en `mismo-punto.js`. Sellos `?v=20261024-mismo-punto-1` (app.js, previos-zoom.js, mismo-punto.js). Pruebas: `tests/mismo-punto.test.cjs`.

### English

- Clicking a dot shared by several venues (same coordinates, within 8 px, or overlapping right under the click) opens a small chooser anchored to the dot, with each venue’s name, type and, when already known, its preview level. Choosing one flies there, opens its card and marks the destination. A single venue opens straight away, and clusters still zoom in.
- Keyboard: arrows, Home and End move between options, Enter chooses, Escape closes. Buttons are at least 44 px tall.
- A preview card on a shared dot shows its venue’s name and a “+N” button that opens the same chooser. Other venues’ cards no longer cover a shared dot.
- Clicking a cluster zooms in again. MapLibre 5 returns a promise from `getClusterExpansionZoom`, so the old callback never ran.

## Propuesta en PDF con marca (20-oct-2026, orden de Carlos)

- Botón **«Propuesta en PDF»** (principal) junto a «Revisar en el planificador» y «Descargar texto», en cuanto hay propuesta.
- `proposalHtml(p, {lang, brand, contact, colors})` en `comercial-core.mjs` maqueta un documento A4: banda con la marca de la página (`window.ADMIRA_SITE_BRAND`, colores `--card` y `--brand`), anunciante y objetivo, brief (audiencia, segmentación, circuito, fechas, emisión), tres cifras clave (ubicaciones, oportunidades estimadas, importe orientativo con el presupuesto), tabla de ubicaciones y los avisos de siempre (estimación, disponibilidad sin confirmar, demostraciones, presupuesto superado, datos pendientes). Pie con el contacto comercial (`info@admira.com`) y «Preparado por Comercial (Admirito)». Todo el texto del brief va escapado.
- Lo imprime el navegador desde un iframe oculto (`srcdoc` + `print()`): en el diálogo, «Guardar como PDF»; el nombre sugerido es el `<title>` («Propuesta de campaña · anunciante · fecha»). Sin librerías ni API: el brief sigue sin salir de la pestaña.
- `window.AdmiraComercial.propuestaHtml()` devuelve el documento (pruebas y depuración). Prueba: «the branded proposal document…» en `tests/comercial.test.mjs`. Sellos `?v=20261020-comercial-6`.

## Enviar por correo (20-oct-2026, orden de Carlos)

- El brief admite un **correo del anunciante** opcional (`email`, sólo si es un correo válido; sigue en memoria de la pestaña).
- Botón **«Enviar por correo»** junto a «Propuesta en PDF»: `proposalMailto(p, {lang, contact})` abre el correo del propio equipo (`mailto:`) con el anunciante de destinatario (si dio su correo), `info@admira.com` en copia, el asunto «Propuesta de campaña · anunciante · fecha» y un cuerpo con saludo, el resumen de la propuesta y la firma de Comercial. El PDF se adjunta a mano (un `mailto:` no adjunta): el aviso lo dice.
- Los clientes de correo recortan los enlaces largos: el cuerpo se limita a 1.800 caracteres y, si hay muchas ubicaciones, se listan 5 y «… y N más (en el PDF)».
- `window.AdmiraComercial.correoPropuesta()` devuelve el enlace (pruebas). Sellos `?v=20261020-comercial-7`.

## Ficha de captación en PDF y por correo (20-oct-2026, orden de Carlos)

- Mismo molde que la propuesta: `merchantHtml(m, {lang, brand, contact, colors, today})` maqueta la ficha A4 (banda de marca, comercio y dirección, datos, cifras clave con las pantallas, siguientes pasos en el portal de comercios, aviso de que no crea cuenta ni incorpora nada, pie con el contacto). `merchantMailto` abre el correo con el contacto del comercio de destinatario **si es un correo** (si es un teléfono, sin destinatario), `info@admira.com` en copia, asunto «Incorporación de pantallas · comercio · ciudad» y el resumen; cuerpo acotado a 1.800 caracteres.
- Botones en el modo «Captar comercios»: **«Ficha en PDF»** (principal), «Enviar por correo» y «Descargar texto». `window.AdmiraComercial.fichaHtml()` y `correoFicha()` para pruebas. Sellos `?v=20261020-comercial-8`.

## Mapa y fotos en el PDF de la propuesta (20-oct-2026, orden de Carlos)

- **Mapa**: `mapaPropuesta(locations)` monta un mosaico de teselas del mismo satélite de la portada (Esri World Imagery, Web Mercator, `tile/{z}/{y}/{x}`) recortado a 744 × 420 px, con un marcador numerado por ubicación (el número es el de la tabla). Zoom: el mayor en el que caben todas con 40 px de margen; una sola ubicación, zoom 16. Sin librerías: las teselas las carga el propio documento al imprimir, con su atribución. Sin coordenadas, no hay mapa.
- **Fotos**: la selección del mapa (`AdmiraCommercialContext.snapshot()`) lleva ahora `coords` y `foto` (la fachada del previo del KV, si la hay); la propuesta las conserva (`foto` sólo si es `https:`) y la tabla de ubicaciones añade una columna con miniaturas cuando alguna tiene foto.
- Antes de imprimir, `imprimir()` espera a que las imágenes del documento (teselas y fotos) hayan cargado, 4 s como mucho.
- Sellos `?v=20261020-comercial-9` (comercial.css, comercial.mjs, comercial-core.mjs y app.js).

## Voz y oído: la nube de Admirito (20-oct-2026, orden de Carlos)

- **La cara y la voz** son la nube de digitalavatar.ai con la piel «comercial» (corbata y maletín): `nube.html?personaje=comercial&embed=0&dock=1&tier=good&lang=…`, en un iframe bajo la cabecera del panel, que aparece cuando la nube avisa de que está lista (`da-comercial-listo`). Comercial le cuenta en qué está con `{type:'da-comercial', estado, texto, silencio}` (estados: reposo, escuchando, apuntando, proponiendo, entregando, dudando) y la nube lo dice con la voz y el lip-sync de Admirito. Sólo se aceptan mensajes de ese iframe y de `https://digitalavatar.ai`.
- **Lo que se le dice** (por el micro o el texto de la nube) llega como `{type:'da-comercial-texto', texto}` y `briefDesdeTexto` lo convierte en brief: anunciante, objetivo, audiencia, presupuesto, fechas, pases y duración, sin inventar nada; lo que falta se dice («Me falta el presupuesto»). Si la frase pide otra cosa («captar un comercio», «abre las ubicaciones», «elige audiencias», «prepara la propuesta»), Comercial cambia de paso.
- **Micro propio** (🎙️ en la cabecera, Web Speech API). **Voz de Admirito con audio** desde el 20-oct-2026 (noche): la propia nube sintetiza lo que Comercial dice con ElevenLabs por el cerebro (`POST https://brain.digitalavatar.ai/tts`, voz es/en de las demos de Admirito, con marcas de tiempo para el lip-sync; `api.admira.store/tts` es puerta de pago y no sirve sin credencial) y lo dice con lip-sync; `decir()` ya no duplica la voz con la del navegador: `speechSynthesis` sólo suena si la nube no ha cargado. El iframe lleva `allow="microphone; autoplay"` (el clic en «Anunciarme aquí» vale como gesto para que suene); mientras la nube carga, la frase espera a su aviso de lista (8 s como mucho). Al abrirse con un local, si el catálogo aún carga, Comercial espera hasta 3 minutos avisando en el estado («Incorporando el local en cuanto cargue el catálogo…») y después lo incorpora; agotado el plazo, pide pulsar «Usar la selección del mapa». Al abrirse con un local, Comercial dice su nombre: «Incorporado Starbucks Paseo de Gracia. Cuéntame la campaña o pulsa el micro»; «Usar la selección» y la propuesta dicen los nombres de las ubicaciones (`nombresDeUbicaciones` en `comercial-core.mjs`: hasta tres y «y N más»; en inglés «and N more»; sin nombres, «N ubicaciones»).
- `window.AdmiraComercial.dictado(texto)` aplica un dictado (pruebas). Sin `fetch` ni almacenamiento: el brief sigue en la pestaña. Sellos `?v=20261020-comercial-10`. La piel vive en el repo `digitalavatar.ai` (`tests/comercial.test.mjs` allí).

- **Tabla de ubicaciones en el PDF (21-oct-2026):** foto de fachada (o «sin foto»), nombre con su id debajo y dirección (`addr` del catálogo, que viaja en el snapshot de `AdmiraCommercialContext` y en `proposal().locations`), además del mapa.
- **Foto de fachada del Stock como respaldo (21-oct-2026):** si el local no tiene previo en el KV, la portada comprueba con HEAD `https://stock.admira.store/espacios/fachadas/<id>.webp` (o `.jpg`) al incorporar la selección (`AdmiraCommercialContext.prepararFotos`) y, si existe, el PDF la usa. Subir la foto a R2 `pixer-stock` con esa clave basta para que aparezca.
