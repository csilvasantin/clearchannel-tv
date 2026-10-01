# Shell cuadrático universal / Universal four-band shell

**Regla: toda página nueva de admira.app / clearchannel.tv usa el shell cuadrático.** Ninguna página trae su propia cabecera ni su propia navegación.

## Qué es

La interfaz que define la portada (`index.html`) en cuatro bandas:

- **Barra superior**: a la izquierda ☰ Opciones + marca (`data-brand-wordmark`: CLEAR·CHANNEL o ADMIRA·APP según dominio) y, si la página lo declara, su sección discreta (`/ backoffice`); a la derecha Login, ▤ Modo avanzado y ⌘ Modo experto.
- **☰ Opciones** (panel izquierdo): Inicio, Player virtual, Ayuda, los enlaces generales de la página y el botón de idioma ENG/ESP.
- **▤ Modo avanzado** (panel derecho): las acciones de trabajo de la página.
- **⌘ Modo experto** (panel inferior): CLI · Verbos · Rutinas.

El comportamiento es el de la portada porque es el mismo código: `responsive-shell.js/.css` (abrir/cerrar independiente, `admira_panel_*`, redimensionado, Esc, i18n `data-shell-*`), `expert-commands.js` (verbos) y `expert-panel.js` (los tres bloques). `galaxy-shell.js` solo inyecta el marcado y carga esos tres scripts en orden; `galaxy-shell.css` importa `responsive-shell.css` y añade lo que en la portada vive en su `<style>` (cabecera fija, marca, idioma). Los paneles empiezan cerrados en una visita nueva y recuerdan su estado, compartido entre páginas.

## Cómo la adopta una página

En el `<head>`, después de `brand.js`/`brand.css` y de los estilos propios:

```html
<link rel="stylesheet" href="/galaxy-shell.css?v=20261001-marca-1">
<script defer src="/galaxy-shell.js?v=20261001-marca-1" data-section="/ nombre-de-la-página"></script>
```

Opcionalmente, antes del script, `window.ADMIRA_SHELL = {...}`:

| Clave | Uso |
|---|---|
| `section` | Texto junto a la marca: `'/ backoffice'` o `{es, en}`. |
| `advanced` | Acciones simples del panel ▤: `[{href, es, en, id?, newTab?}]` (o `{id, es, en}` para un botón). |
| `options` | Enlaces extra de ☰: `[{href, es, en}]`. |
| `setLang` | Si la página tiene su propio i18n: `lang => setLang(lang)`. Si no, el shell aplica el idioma como la portada (`?lang=` > `<marca>-lang` > idioma de la marca). Se emite `admira:lang`. |
| `verbs` | Verbos propios del CLI (`{id, aliases, es, en, attributes, requires, run(args, ctx, lang)}`), solo válidos en esa página y nunca guardados como rutinas compartidas. |
| `login` | `false` para ocultar Login, o `{href, es, en}`. |

Para conservar los manejadores de elementos que ya existen, la página los marca y el shell los mueve al panel:

```html
<div data-shell-slots hidden>
  <button type="button" id="btn-logout" data-shell-slot="advanced">Logout</button>
  <a href="about.html" data-shell-slot="options">Concepto RTB</a>
</div>
```

El shell elimina la cabecera propia (`body > header`, salvo `data-shell-keep`) y el contenedor `[data-shell-slots]` tras mover lo marcado. El contenido debe calcular su altura con `var(--app-header-height)` (y `var(--shell-bottom)` si quiere apartarse del panel experto abierto), y las capas que deban tapar el shell (puertas de login, modales) usan `z-index` ≥ 9100.

### Reglas comunes (FLT-101311 c)

- **Reparto**: lo que lleva a otra página o a otro sitio (volver al mapa, PixerIA, XpaceOS, Contacto, Documentación…) va a **☰ Opciones**; lo que trabaja sobre la página (emitir, publicar, exportar) y los atajos a sus secciones (`#flujo`, `#api`…) van a **▤ Avanzado**. Los filtros que se usan a diario (selectores de Xpacio, pantalla, día, buscador) se quedan en el contenido, nunca en una barra propia.
- **Textos de los slots** en los dos idiomas con `data-shell-text-es` / `data-shell-text-en`: el shell los traduce con el resto.
- **Un solo idioma**: no hay selectores propios. Las páginas con i18n declaran `setLang` (target y tutorial llaman a `setLang` de `target-assets/app.js`) o escuchan `admira:lang` (`walk.mjs`); todas leen y guardan la misma preferencia `<marca>-lang` que la portada (nunca `omnip-lang`).
- **Cabeceras de contenido**: un `<header>` que es el título de la página dentro de un contenedor (`help`, escena de `store-3d`) se queda, con su CSS acotado (`.wrap > header`, `.app > header`) para no tocar la barra. Uno que sea hijo directo de `body` y deba quedarse lleva `data-shell-keep` (hero de `presentation/`). La barra del kit `admira-design` (`nav.admira-nav` + `nav.css`) desaparece.
- **Alturas y capas**: nada de `100vh - 42/65/76px` ni `top` fijos de la cabecera vieja: `var(--app-header-height)` y `var(--shell-bottom)`. La barra tiene `z-index: 8900` (por encima del contenido de cualquier página, por debajo de los paneles, 9000); avisos, modales y puertas propios van a ≥ 9100 (el panel de contacto del kit, a 9300). Las anclas internas respetan la barra con `scroll-padding-top`.
- **Misma barra en todas las páginas**: `galaxy-shell.css` fija en la barra y los paneles los colores de la portada (los de `index.html` en clearchannel.tv y los de `brand.css` en admira.app), aunque la página tenga otra paleta, y aísla el shell de los selectores de elemento de cada página (`section`, `li`, `strong`, `input`, `button`, `.logo`…).
- **Atajos de teclado** de la página (diapositivas, escena 3D) ignoran el CLI y los paneles: `if (event.target.closest('input,textarea,select,[contenteditable],.mode-panel')) return;`.
- **Caché**: un fichero que cambia lleva el sello nuevo en su `?v=` (el service worker sirve los estáticos de caché y los refresca por detrás). Si cambia `galaxy-shell.js/.css`, se sube el sello en todas las páginas a la vez.

## Marca blanca

El shell carga también `marca-blanca.js` (el mismo fichero que la portada, con el sello de `galaxy-shell.js`). Sin marca activa no hace nada más; con `?marca=<id>` o `/marca <id>` viste la barra, los paneles y la página con la marca del catálogo de admiranext.com/marcablanca. Detalles en `docs/marca-blanca.md`.

## Páginas

Guardián: `tests/galaxy-shell.test.cjs` recorre todos los `.html` del repo. Cada uno carga `galaxy-shell.css` y `galaxy-shell.js` con el mismo `?v=` (después de sus estilos), es la portada (que trae el shell en línea) o figura en `SHELL_EXCEPTIONS` con su motivo. Una página nueva sin shell hace fallar el test.

| Página | Sección | ☰ Opciones (además de Inicio · Player virtual · Ayuda) | ▤ Avanzado |
|---|---|---|---|
| `index.html` | — | Es la portada: el shell va en línea. | Planificar, circuito, target, Neo, sala de emisión, vista del mapa |
| `backoffice.html` | `/ backoffice` | Concepto RTB | Estado, Target Model, Mis demos, Xpace OS, Logout (sin Login) |
| `about.html` | `/ concepto RTB` | El mercado, Xpace OS ↗ | Concepto, Flujo, Stack, Métricas |
| `marketplace.html` | `/ mercado` | Concepto RTB, PixerIA ↗, XpaceOS ↗, Contacto | Ecosistema, Anunciantes, Espacios, Gemelo digital, Motor RTB |
| `detail.html` | `/ detalle` | ← Volver al mapa (con `?loc=`), PixerIA ↗, XpaceOS ↗, Contacto | Entrar al mapa 3D, Live bidding, Inventario disponible |
| `store-3d.html` | `/ mapa 3D` | ← Detalle Xpace (con `?loc=`), PixerIA ↗, XpaceOS ↗, Contacto | — (los controles 3D siguen sobre la escena) |
| `walk.html` | `/ recorre tu campaña` | — | — (el aviso «sin emisión» pasa al contenido) |
| `players/` | `/ player virtual` | — | — |
| `documentacion/` | `/ documentación` | ← Presentación | Resúmenes, Diapositivas, Documentos, Infografía, Interactivo |
| `help/` | `/ ayuda` | — | 3 pasos, Piezas, Bucle, Ventajas, Pruébalo, Enlaces, Navegación ☰ ▤ ⌘, Modo experto |
| `mcp/` | `/ MCP` | — | API, Informe, Privacidad, Conectar, llms.txt |
| `parrilla/` | `/ parrilla` | — | ▶ Emitir auto, Emitir ahora, Target Model (Xpacio · Pantalla · Día quedan en el contenido) |
| `presentacion/` | `/ presentación` | — | — (diapositivas bajo la barra; ‹ › y teclado siguen) |
| `presentation/` | `/ presentación` | Documentación | La tesis, Agéntica, CanalKiosk, Xtanco, Contacto |
| `target/` | `/ target model` | Tutorial | Publicar en Clear Channel, Cambiar modo de datos, Exportar modelo (el buscador pasa al carril izquierdo) |
| `tutorial/` | `/ tutorial` | Abrir backoffice Target Model | Flujo, Métricas, Privacidad |

### Excepciones

| Página | Motivo |
|---|---|
| `backoffice/index.html` | Redirección inmediata a `/backoffice.html`; no pinta nada. |
| `presentation/cc/index.html` | Redirección inmediata a `/presentation/`; no pinta nada. |
| `wututu/index.html` | Bundle Vite compilado fuera de este repo: demo de contador de audiencias para iPad que se proyecta en un MUPI a pantalla completa (`100vh`, overflow oculto). Una barra encima cortaría el escenario y el HTML se regenera en cada build. |

Las dos presentaciones y los visores (`store-3d`, `walk`, `players`) **sí** llevan el shell: con los paneles cerrados la barra solo ocupa su altura y el contenido empieza debajo.

## Modo experto fuera del mapa

`/help`, `/limpiar` y los verbos propios funcionan en la página. `/demo`, `/circuito` y `/buscar` necesitan el mapa: la página guarda la orden canónica en `sessionStorage` (`admira_expert_pending_v1`, caduca a los 2 minutos, nunca en la URL), abre la portada y esta la ejecuta al cargar. Rutinas e historial son los mismos en todas las páginas (`admira_expert_routines_v1`, `admira_expert_history_v1`). El backoffice añade `/nuevo` (alias `/new`): abre el alta de un Xpace si la cuenta gestiona el catálogo.

---

**Rule: every new admira.app / clearchannel.tv page uses the four-band shell.** Load `/galaxy-shell.css` and `/galaxy-shell.js` (snippet above), declare the page section, actions and links in `window.ADMIRA_SHELL` or with `data-shell-slot`, and the page gets the portada's exact header and Options, Advanced and Expert panels. Map verbs (`/demo`, `/circuito`, `/buscar`) are handed to the portada through `sessionStorage` and run there on load. Every page of the site already does (table above); the only exceptions are two redirects and the compiled Wututu kiosk bundle, and `tests/galaxy-shell.test.cjs` fails if a new page skips the shell. Navigation goes to ☰ Options, page work and section shortcuts to ▤ Advanced, there is a single language switch (per-brand `<brand>-lang` key), and the bar always wears the portada colours.
