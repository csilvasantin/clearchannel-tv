# Modos de navegación / Navigation modes

La cabecera mantiene el buscador y tres botones: ☰ Opciones abre la barra vertical izquierda (player virtual, acceso, ayuda e idioma); ▤ Modo avanzado abre la barra derecha con Planificar campaña, Seleccionar circuito, Seleccionar target, Mis solicitudes y Sala de emisión; ⌘ Modo experto abre la barra horizontal inferior. Los paneles empiezan cerrados y se pueden abrir de forma independiente. En Experto escribe /cli y pulsa Enter o Ejecutar para iniciar la demo guiada; /help muestra los comandos. Ya no hay un botón flotante Empezar la demo. La compra de la demo sigue siendo simulada: no cobra ni reserva parrilla.

The header keeps search and three buttons: ☰ Options opens the left vertical bar (virtual player, login, help and language); ▤ Advanced mode opens the right bar with Plan campaign, Select circuit, Select target, My requests and Emission room; ⌘ Expert mode opens the bottom horizontal bar. Panels start closed and can be opened independently. In Expert, type /cli and press Enter or Run to start the guided demo; /help shows commands. There is no floating Start demo button. Demo purchases remain simulated: no charge or airtime booking.

Implementación compartida admira.app/clearchannel.tv. Se conservan IDs y funciones de los selectores. ResizeObserver mide la cabecera; aria-expanded y aria-controls reflejan el estado. Escape cierra el panel que tiene el foco. / Shared implementation: existing selector IDs/actions retained; measured header height, accessible toggle state; Escape closes the focused panel. /cli invokes AdmiraDemo.start, not an arbitrary script evaluator.


## Identidad y posición / Identity and position

El botón ☰ Opciones se encuentra justo a la izquierda del logo. ▤ Avanzado y ⌘ Experto permanecen a la derecha. Los tres paneles se abren y cierran de forma independiente. admira.app conserva su identidad y metaestilo, con castellano por defecto; clearchannel.tv conserva la marca Clear Channel y su metaestilo, con inglés por defecto. La preferencia de idioma se guarda por marca; un cambio voluntario de idioma no cambia su identidad. /cli sigue iniciando la demo desde Experto.

The ☰ Options button sits immediately to the left of the logo. ▤ Advanced and ⌘ Expert remain on the right. Each panel opens and closes independently. admira.app retains its identity and visual theme with Spanish by default; clearchannel.tv retains Clear Channel branding and its visual theme with English by default. Language preferences are stored per brand; choosing another language does not change brand identity. /cli still starts the guided demo from Expert.
