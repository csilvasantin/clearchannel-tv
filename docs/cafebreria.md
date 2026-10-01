# Cafebrería · handON del proyecto independiente

Proyecto `cafebreria`, circuito `cafebreria`, ficha estable `cafebreria-barcelona`.
La ficha previa se reutiliza sin duplicarla ni mezclarla en Alsea/Starbucks.
Passeig de Gràcia 103 se conserva como dirección de referencia; no acredita un nuevo local físico.
Starbucks conserva `alsea-sbux-021` y su gemelo Matrix.

## Acceso

- [Ficha en admira.app](https://admira.app/?locationId=cafebreria-barcelona&lang=es).
- Avanzado → Seleccionar circuito → Todos, Ciudad o Local → Cafebrería · Proyecto independiente.
- Experto → `/circuito cafebreria`; las rutinas incluyen Circuito y Demo de Cafebrería.
- Ficha → Ver Gemelo Digital → Pixeria Stock #1202 → maximizar Xpaces.
- [Manifiesto del proyecto](https://admira.app/data/projects/cafebreria.json).

## Modelado 3D recuperado

La cafetería base mide 11 × 7,5 × 3,2 m. El GLB original #1112 (`1790364696893-14ykfy`) documenta 34 elementos medidos con tolerancia ±2 cm, verificados en Blender y GLB reimportado. La revisión corregida #1182 (`1790370079244-cv7t5i`) dispone de fuente Blender base `1790370032661-p2nbzi`.

El modelo actual #1202 (`1790375438696-1ladz7`, FLT-101050) añade estantería y seis libros reales y conserva el original. Su inventario `alsea-4380.json`, revisión 4397 sobre 4380, contiene 81 objetos: 35 medidos y 46 adicionales. Se comprobó en el visor público el contador 81/81, el inventario y «Ver» de la estantería. El botón Blender de esta versión actual está deshabilitado: la fuente base no equivale a un editable de #1202.

La estantería de nogal mide 1,6 × 0,28 × 1,1 m y está detrás del sofá verde. Los seis modelos de semilla son The Hero with a Thousand Faces (1790374898228-sylcvc), Sapiens (1790374957269-cqttzk), Creatividad, S.A. (1790375013351-f6ip4j), The Impossible Factory (1790375069695-idmmd3), Co-Intelligence (1790375124838-wgsi5x) y Creative Confidence (1790375180840-lnodeq).

Las cápsulas mostradas se actualizan desde los libros del día de Stock cada cinco minutos; pueden diferir de esos títulos de semilla. En la comprobación, al tocar un libro se abrió The Science of Storytelling, de Will Storr, con cápsula de George Lucas, voz del navegador, Comprar en Casa del Libro y Vender.

## Interacciones recuperadas

- Inventario por categorías, mostrar/ocultar objetos, centrar con Ver, vistas isométrica/planta/frontal, iluminación día/atardecer/noche, exportación JSON/CSV y fichas/QR por elemento. Garantía, fabricante y números de serie desconocidos se muestran pendientes.
- Libro: selección y panel de resumen; vídeo/audio de cápsula cuando está disponible, o voz del navegador señalada. Comprar abre Casa del Libro, con búsqueda de respaldo.
- Wallapop: Vender abre su formulario y prepara/copia título, autor e ISBN. No fija precio ni publica automáticamente. Enlaces verificados en el panel real; no se publicó un anuncio durante esta recuperación.
- eBay: no se encontró implementación en los módulos, pruebas y documentación recuperados. Queda pendiente definirla; no se presenta como conexión activa.
- Vinilos: Billie Jean y Beat It (Michael Jackson), 1999 y When Doves Cry (Prince), Careless Whisper y Faith (George Michael). Selección, resumen con voz del navegador, muestra oficial Apple de hasta 20 s y compra en Apple Music. No son MP3 alojados ni la playlist Starbucks.
- Tele: canal virtual Sabías Qué de admira.tv, vinculado al visor. Conserva IDs heredados `virtual-pixeria-alsea-sabiasque` y `pixeria-alsea`.

## Límites y continuación

La capa ITIL tiene 19 elementos: 11 posicionados en 3D y ocho sin posición; cinco usan icono genérico pendiente. Sus estados son DEMO (11 operativos, dos avisos, uno caído, cinco sin dato), no telemetría física. 8/16/32/64 cambia el aspecto de esa capa; el renderer completo activo es Better 16. Los importes e impresiones de la ficha son estimados y las superficies no tienen heartbeat verificado.

La independencia se establece en catálogo, circuito y accesos del backoffice. Los assets, título del visor y namespaces Alsea de Pixeria se mantienen como fuentes heredadas; no se ha duplicado el GLB ni reasignado hardware. Próximo trabajo: identidad propia, fuente Blender actual, correspondencia entre modelos y cápsulas rotativas, flujo eBay y asignación de equipos cuando exista.

Misión Yokup: `DCL-6cfcfd8f6fdfec77c4c79179` (Hoy #56). El minitutorial oficial es una guía animada, no una grabación de pantalla.

## English handON

Cafebrería is an independent prototype project and circuit (`cafebreria`) using the existing profile `cafebreria-barcelona`. Passeig de Gràcia 103 is its reference address. Starbucks remains `alsea-sbux-021` with its own Matrix twin. Access: Advanced → Select circuit → All/City/Local → Cafebrería, or Expert → `/circuito cafebreria`. View Digital Twin opens Pixeria Stock #1202.

Recovered: 81 inventory objects (35 measured, 46 additional), a walnut shelf, six seeded book GLBs and six interactive vinyl records. Stock book-of-the-day capsules rotate and may differ from the seeded model titles. A real UI check opened The Science of Storytelling with browser narration and Casa del Libro/Wallapop links. Wallapop prepares a listing; it neither sets a price nor publishes automatically. No eBay implementation was found in the recovered sources. Vinyl playback uses up to 20 seconds of official Apple previews.

All 19 ITIL statuses are simulated. Eight ITIL items lack a 3D position; five glyphs are generic. The 8/16/32/64 choices style ITIL glyphs; Better 16 is the active full-scene renderer. The latest GLB has no downloadable Blender source; the older base does. Physical devices and telemetry have not been assigned. Legacy Pixeria Alsea names and IDs remain for compatibility. See the project manifest and public guide for sources and next steps.

Minitutorial exportado y verificado (H.264/AAC, 1080×1920, 15,07 s): https://api.yokup.com/media/fleet/229e706ba84f6952.mp4
