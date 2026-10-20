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

- **Botón en la cabecera de la portada** (`#header-comercial-toggle`, la nube de Comercial junto a «Iniciar sesión»): abre y cierra Comercial. Viene oculto en el HTML y lo enseña `comercial.mjs` al cargar, así en clearchannel.tv (donde el módulo no carga) no aparece.
- **«Anunciarme aquí» en la ficha de cada Xpacio** (`#p-comercial`, en la fila de acciones junto a Tour DooH y gemelo): la selección del mapa pasa a ser sólo ese local (`AdmiraCommercialContext.seleccionar(id)`, como el borrador de Pixeria: ámbito local, circuito «all», sin autoselección) y Comercial se abre con él ya incorporado («1 ubicaciones incorporadas»). Si el catálogo aún no está listo, se abre igual y avisa.
- Sellos `?v=20261020-comercial-5` (comercial.css, comercial.mjs y app.js). Prueba: «commercial has visible entry points…» en `tests/comercial.test.mjs`.

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
