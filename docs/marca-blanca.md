# Marca blanca en admira.app / White label (FLT-101331)

admira.app (y clearchannel.tv, que es el mismo proyecto) puede vestirse con la marca de un cliente del **catálogo único** de https://www.admiranext.com/marcablanca (semillas Admira, Lumbre, BRUMELLE y Frescaria, y las marcas guardadas después, p. ej. `starbucks`). Es la primera de las cuatro patas en adoptarla.

## Cómo se activa

| Cómo | Efecto |
|---|---|
| `?marca=<id>` en cualquier URL | Aplica la marca y la recuerda en la pestaña (`sessionStorage` `mb:marca`, la misma clave que el cargador común). |
| ⌘ Experto → `/marca <id>` | Igual, sin recargar. Tab completa los ids conocidos y `off`. |
| `?modo=marca\|nativo\|claro\|oscuro\|auto` | Modo de color (por defecto `marca`: el del cliente, claro u oscuro). |

La marca se mantiene al navegar entre páginas de la misma pestaña (portada, backoffice, ayuda…). Una pestaña nueva empieza sin marca.

## Cómo se vuelve a Admira

`/marca off` (o `/marca admira`), **«Volver a Admira»** en ☰ Opciones (solo aparece con marca activa) o `?marca=admira` en la URL. Se deshace en el sitio, sin recargar: variables, atributos, logo, favicon, título, colores del mapa y hojas cargadas; también se quitan `?marca=`/`?modo=` de la URL.

## Cómo se carga (un solo mecanismo)

- `marca-blanca.js` es el único punto de entrada. La portada lo carga con `<script defer src="marca-blanca.js?v=…">`; el resto de páginas lo reciben de `galaxy-shell.js`, que lo carga con su mismo sello.
- **Sin marca activa no hace nada más**: no inserta estilos, no carga el cargador común y no pide nada a admiranext.com. La web queda exactamente igual que antes.
- Con marca: inserta `https://www.admiranext.com/marcablanca/marcablanca.css`, `marca-blanca.css` (los ajustes propios de esta web) y `marcablanca.js` con `data-mb-plataforma="app"` y `data-mb-auto="false"`; comprueba la marca en el catálogo (`/marcablanca/api/marcas/<id>`, con los JSON estáticos de respaldo) y **solo entonces** llama a `MarcaBlanca.aplicar(id, {plataforma: 'app'})`.
- Si el id no existe en el catálogo, o admiranext.com no responde (8 s como mucho por pieza), no se aplica nada: la web sigue con su aspecto normal y solo queda un aviso en la consola (en el CLI, un mensaje claro).
- El catálogo completo (`/marcablanca/api/marcas`) solo se pide con una marca activa o al usar `/marca`; mientras, el Tab-completado usa la semilla.

## Qué cambia

- **Barra**: fondo de la marca casi opaco, con borde inferior. Composición: **logo del cliente** (enlace al inicio; en la portada reencuadra el mapa como la marca de siempre) **│ powered by ADMIRA·APP** (o CLEAR·CHANNEL en clearchannel.tv), en pequeño y en el gris de la marca, seguido de la sección de la página (`/ backoffice`). Bajo 600 px solo queda el logo. Si la marca no tiene logo, su nombre. El `title` del logo avisa si es una **propuesta automática** («no es la marca oficial») o una marca ficticia de ejemplo.
- **Colores** de la barra, los paneles ☰ ▤ ⌘, los botones, chips y rutinas del modo experto, las fichas (`aside.panel`), los paneles de circuito y target, el ticker, la tarjeta de la demo, el aviso del mapa, los controles del mapa y la firma de versión. En las demás páginas, sus variables `--bg --ink --mut --brand --accent --good --warn --card --card2 --line` (y las de `/help/`) pasan a la marca.
- **Legibilidad (AA)**: `marca-blanca.js` calcula unos tokens `--mbx-*` a partir de la marca: para cada texto de la barra y los paneles toma el color de la marca si contrasta ≥ 4,5:1 con su fondo y su superficie; si no, el siguiente candidato (primario → secundario → texto) y, en último caso, negro o blanco. Igual para el texto sobre los botones rellenos. Así una marca clara (Lumbre, Frescaria, Starbucks) sigue siendo legible.
- **Tipografía**: textos con `--mb-fuente-texto`, etiquetas y botones con `--mb-fuente-etiquetas`, CLI con `--mb-fuente-mono`, títulos de fichas con `--mb-fuente-titulos` (el cargador carga las fuentes del catálogo). Radios de la marca en botones, chips y paneles.
- **Pestaña**: favicon de la marca y título «Nombre del cliente · título de la página».
- **Mapa**: los clusters, su número y el anillo de selección toman el color primario. Los puntos sueltos conservan el color de su circuito.

## Qué no cambia

- El mapa satélite, el globo, el espacio y los planetas.
- La identidad de dominio de `brand.js` / `_worker.js` (ADMIRA·APP o CLEAR·CHANNEL): la marca blanca va por encima y deja intacta su reescritura (el «powered by» es justamente esa marca).
- Los colores de los circuitos y de los estados de emisión de los puntos.
- La puerta de login del backoffice y los paneles largos que no se han revisado uno a uno (planificador, compra RTB) toman los colores por sus variables, pero conservan algunos detalles escritos a mano.

## Ficheros

| Fichero | Papel |
|---|---|
| `marca-blanca.js` | Decide la marca, carga lo necesario, aplica, deshace y expone `window.AdmiraMarca` (`actual`, `conocidas`, `listar`, `activar`, `desactivar`, `analizar`). Sus funciones puras (`decide`, `normalizeUrl`, `contrast`, `shellTokens`…) se prueban en `tests/marca-blanca.test.cjs`. |
| `marca-blanca.css` | Todo bajo `:root[data-mb-marca][data-mb-plataforma="app"]`. Solo se descarga con marca. |
| `expert-commands.js` | Verbo `/marca` y atributo `marca`. |
| `expert-panel.js` | Respuesta diferida de `/marca` en el CLI y chips de marcas en Verbos. |
| `index.html` | Carga `marca-blanca.js`; los estilos en línea del editor de CPM y la compra RTB leen `--mbx-*` con el color de siempre como valor por defecto. |

## Límites conocidos

- `POST /marcablanca/api/analizar` exige mismo origen: desde admira.app no se puede analizar una web; `/marca <web>` abre el analizador de admiranext.com en otra pestaña.
- La marca por dominio (`<cliente>.admira.app`) del cargador común no se usa aquí: admira.app solo se viste con `?marca=` o `/marca`.

---

**English.** admira.app can wear a client brand from the admiranext.com/marcablanca catalogue. Turn it on with `?marca=<id>` or `/marca <id>` in Expert; it stays for the tab. `/marca off`, `?marca=admira` or “Back to Admira” in ☰ Options undo it in place. `marca-blanca.js` is the single entry point (the portada loads it, `galaxy-shell.js` loads it on every other page); without a brand it loads nothing and never contacts admiranext.com. With a brand it loads the common stylesheet and loader plus `marca-blanca.css`, checks the catalogue first and only then applies the brand; if the id is unknown or admiranext.com is down nothing is applied. The bar shows the client logo │ “powered by ADMIRA·APP”; bar, panels, profiles, demo card, ticker and map clusters take the brand colours with text colours corrected to WCAG AA; the satellite map and the domain identity stay as they are.
