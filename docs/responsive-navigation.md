# Modos de navegación / Navigation modes

La cabecera mantiene el buscador y tres botones: ☰ Opciones abre la barra vertical izquierda (player virtual, acceso, ayuda e idioma); ▤ Modo avanzado abre la barra derecha con Planificar campaña, Seleccionar circuito, Seleccionar target, Mis solicitudes y Sala de emisión; ⌘ Modo experto abre la barra horizontal inferior. Los paneles se superponen al contenido y entran cerrados en cada carga: al abrirlos, el cuerpo central no cambia de posición, ancho ni alto (principio de Carlos, 3-oct-2026; ver `docs/galaxy-shell.md`). No se recuerda si estaban abiertos; solo su tamaño. Se pueden abrir de forma independiente. En Experto escribe /cli y pulsa Enter o Ejecutar para iniciar la demo guiada; /help muestra los comandos. Ya no hay un botón flotante Empezar la demo. La compra de la demo sigue siendo simulada: no cobra ni reserva parrilla.

The header keeps search and three buttons: ☰ Options opens the left vertical bar (virtual player, login, help and language); ▤ Advanced mode opens the right bar with Plan campaign, Select circuit, Select target, My requests and Emission room; ⌘ Expert mode opens the bottom horizontal bar. Panels overlay the content and start closed on every load: opening one never moves or resizes the central content. Only their resized size is remembered. They open independently. In Expert, type /cli and press Enter or Run to start the guided demo; /help shows commands. There is no floating Start demo button. Demo purchases remain simulated: no charge or airtime booking.

Implementación compartida admira.app/clearchannel.tv. Se conservan IDs y funciones de los selectores. ResizeObserver mide la cabecera; aria-expanded y aria-controls reflejan el estado. Escape cierra el panel que tiene el foco. / Shared implementation: existing selector IDs/actions retained; measured header height, accessible toggle state; Escape closes the focused panel. /cli invokes AdmiraDemo.start, not an arbitrary script evaluator.


## Identidad y posición / Identity and position

El botón ☰ Opciones se encuentra justo a la izquierda del logo. ▤ Avanzado y ⌘ Experto permanecen a la derecha. Los tres paneles se abren y cierran de forma independiente. admira.app conserva su identidad y metaestilo, con castellano por defecto; clearchannel.tv conserva la marca Clear Channel y su metaestilo, con inglés por defecto. La preferencia de idioma se guarda por marca; un cambio voluntario de idioma no cambia su identidad. /cli sigue iniciando la demo desde Experto.

The ☰ Options button sits immediately to the left of the logo. ▤ Advanced and ⌘ Expert remain on the right. Each panel opens and closes independently. admira.app retains its identity and visual theme with Spanish by default; clearchannel.tv retains Clear Channel branding and its visual theme with English by default. Language preferences are stored per brand; choosing another language does not change brand identity. /cli still starts the guided demo from Expert.

## Neo · Avanzado / Advanced

«Habla con Neo» está dentro de ▤ Modo avanzado. La home no muestra el botón flotante. Abre Avanzado y pulsa Habla con Neo; el panel se carga bajo demanda. Cerrar o Escape vuelve al botón Avanzado.

“Talk to Neo” is inside ▤ Advanced mode. The home page has no floating Neo button. Open Advanced and select Talk to Neo; the panel loads on demand. Close or Escape returns focus to Advanced.

## Modo experto en 3 bloques / Expert mode in three blocks

⌘ Modo experto se divide en tres bloques, como en admira.live: **CLI** (izquierda: línea de órdenes y salida), **Verbos** (centro: un botón por verbo con sus atributos) y **Rutinas** (derecha: combinaciones verbo + atributo de un clic). Cada bloque se mueve con su asa (arrastrar o ←/→), se cierra con × y se recupera con ⋯; el borde derecho reparte el ancho con su vecino (15–85 %, flechas, Home, doble clic). El orden, los bloques cerrados y los anchos se guardan en el navegador (`admira_expert_layout_v1`). Bajo 600 px los bloques se apilan. La altura del panel se sigue ajustando con el asa superior.

Verbos (registro en `expert-commands.js`):

- `/demo [cliente]` (alias `/cli`): demo guiada con compra simulada. Sin cliente, Xtanco Valencia como siempre. Con cliente recorre un Xpacio real de su circuito: prefiere pantallas en directo, con precio y enlazadas a la parrilla; si el circuito solo tiene pantallas programadas lo dice, y si el Xpacio no tiene pantallas en la parrilla no muestra ventas reales. No hay cápsula grabada para otros clientes, así que no se muestra imagen ni audio.
- `/circuito <cliente>`: abre Seleccionar circuito con ese circuito, lo selecciona entero y encuadra el mapa.
- `/buscar <texto>`: igual que el buscador de la cabecera (Xpacios y después direcciones).
- `/parar` (alias `/stop`): para la demo y los recorridos del mapa.
- `/limpiar` (alias `/clear`): vacía la salida del CLI.
- `/marca [marca|off|web]` (alias `/brand`, `/marcablanca`): marca blanca del catálogo único de admiranext.com/marcablanca. `/marca <id>` viste la web con esa marca (comprueba antes que existe; si no, no aplica nada), `/marca off` (o `/marca admira`) vuelve a Admira, `/marca` sola dice cuál está activa y lista las disponibles, y `/marca <web>` (algo con forma de dominio o URL, p. ej. `starbucks.es`) abre `https://www.admiranext.com/marcablanca/?web=<url>` en otra pestaña para analizarla y guardarla. Tab completa los ids del catálogo y `off`. Ver `docs/marca-blanca.md`.
- `/help`: lista verbos, atributos y rutinas.

Atributo `cliente` (alias tolerantes a mayúsculas, acentos y espacios): `cafebreria` (Cafebrería independiente), `starbucks` (alsea_starbucks), `starbucks-mexico` (alsea_mexico), `alcampo`, `canalkiosk` (kioskos), `jti` (jti_xtanco), `estancos`, `decathlon`, `bbva`, `caixabank`, `banorte`, `elcorteingles`, `correos`, `multiopticas`, `palacio`, `liverpool`, `desigual`, `mango`, `admiraxperience`, `metro`. Formas válidas: `/demo starbucks`, `/demo cliente=alcampo`, `/demo Starbucks México`. Atributo `texto`: texto libre para `/buscar`. Atributo `marca`: id del catálogo (`lumbre`, `brumelle`, `frescaria`, `starbucks`…), `off` o una web.

Rutinas: Demo y Circuito de Starbucks, Starbucks México, Alcampo, CanalKiosk y JTI se generan desde el registro. «＋ Guardar última orden» guarda la última orden válida como rutina propia (`admira_expert_routines_v1`); × la borra. En el CLI, Tab completa verbos y clientes; ↑/↓ recorre el historial.

Expert mode is split into three blocks like admira.live: **CLI** (left), **Verbs** (centre) and **Routines** (right). Blocks can be moved, closed, restored, resized in pairs and are remembered per browser; they stack below 600 px. Verbs: `/demo [client]` (`/cli`), `/circuito <client>`, `/buscar <text>`, `/parar` (`/stop`), `/limpiar` (`/clear`), `/marca [brand|off|website]` (`/brand`: white label from the admiranext.com catalogue; off returns to Admira; a website opens the analyser in a new tab), `/help`. `/demo <client>` tours a real Xpacio from that client’s circuit and says so honestly when screens are only scheduled or not linked to the sales grid; the purchase stays simulated. Routines are generated from the registry, and the last valid command can be saved as your own routine and deleted later. Every new command must be implemented in `expert-commands.js`, documented here and in `/help/`, and listed by `/help`.

Cafebrería tiene circuito propio: `/circuito cafebreria` y las rutinas Demo/Circuito. Su gemelo abre Pixeria desde la ficha; los importes son estimados y el proyecto no tiene emisión física verificada. / Cafebrería has its own circuit and Demo/Circuit routines; its profile opens the Pixeria twin. Figures are estimates and physical emission is unverified.

## Shell universal en todas las páginas / Universal shell on every page

Las demás páginas (empezando por el backoffice) cargan `galaxy-shell.css` + `galaxy-shell.js` y obtienen exactamente esta barra y estos tres paneles; ver `docs/galaxy-shell.md`. Fuera de la portada, `/demo`, `/circuito` y `/buscar` abren la portada y se ejecutan allí; `/help` y `/limpiar` funcionan en sitio. El backoffice añade el verbo local `/nuevo` (alta de un Xpace).

Other pages (starting with the backoffice) load `galaxy-shell.css` + `galaxy-shell.js` and get exactly this header and these three panels; see `docs/galaxy-shell.md`. Away from the home page, `/demo`, `/circuito` and `/buscar` open the home map and run there; `/help` and `/limpiar` run in place. The backoffice adds the page-local verb `/nuevo` (register an Xpace).

## Versión en Opciones / Version in Options

ES: La versión aparece al pie de Opciones y desaparece al plegarlo. Sólo la primera novedad sin reconocer permite un aviso exterior; abrir Opciones o leer y cerrar el aviso lo reconoce por navegador y dominio. El pie queda sobre la barra inferior de Experto, incluso minimizada. Pasar el ratón sobre el sello muestra novedades; una versión pendiente mantiene Recargar.

EN: The version appears at the bottom of Options and disappears when collapsed. Only the first unacknowledged news allows an outside notice; opening Options or reading and closing the notice acknowledges it per browser and domain. The footer remains above the bottom Expert bar, including its minimized state. Hovering over the stamp shows news; a pending version retains Reload.

Shared loader / Cargador: https://www.admiranext.com/assets/sello-novedades.js · /version.json · No new MCP tools / Sin herramientas MCP nuevas.

Tutorial ES: ☰ Opciones → sello inferior → pasar el ratón → plegar Opciones. EN: ☰ Options → bottom stamp → hover → collapse Options.
