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
<link rel="stylesheet" href="/galaxy-shell.css?v=20261001-shell-cafe-1">
<script defer src="/galaxy-shell.js?v=20261001-shell-cafe-1" data-section="/ nombre-de-la-página"></script>
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

## Modo experto fuera del mapa

`/help`, `/limpiar` y los verbos propios funcionan en la página. `/demo`, `/circuito` y `/buscar` necesitan el mapa: la página guarda la orden canónica en `sessionStorage` (`admira_expert_pending_v1`, caduca a los 2 minutos, nunca en la URL), abre la portada y esta la ejecuta al cargar. Rutinas e historial son los mismos en todas las páginas (`admira_expert_routines_v1`, `admira_expert_history_v1`). El backoffice añade `/nuevo` (alias `/new`): abre el alta de un Xpace si la cuenta gestiona el catálogo.

---

**Rule: every new admira.app / clearchannel.tv page uses the four-band shell.** Load `/galaxy-shell.css` and `/galaxy-shell.js` (snippet above), declare the page section, actions and links in `window.ADMIRA_SHELL` or with `data-shell-slot`, and the page gets the portada's exact header and Options, Advanced and Expert panels. Map verbs (`/demo`, `/circuito`, `/buscar`) are handed to the portada through `sessionStorage` and run there on load.
