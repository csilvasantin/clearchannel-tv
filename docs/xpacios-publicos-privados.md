# Xpacios públicos y privados

Orden de Carlos (29-oct-2026): «tenemos que ser capaces de tener unos sites o Xpacios públicos para que los vea todo el
mundo y que se puedan comercializar, y luego los sites privados, que solo se puede acceder con registro». Y: «una
ubicación de admira.biz puede no tener representación de gemelo digital en admira.store, por ejemplo mobiliario urbano o
transporte público».

## El modelo

| | Público | Privado |
|---|---|---|
| Campo en el catálogo | ninguno (o `visibilidad: "publico"`) | `visibilidad: "privado"` |
| Quién lo ve | todo el mundo | quien entra con Google y tiene acceso |
| Se comercializa (mapa, marketplace, sitemap, ficha compartible) | sí | no en abierto |
| Lista de acceso | — | `acceso`: emails (`ana@marca.com`) o dominios (`@marca.com`); vacía, basta con estar registrado |

- **Es de la ubicación, no del gemelo.** La visibilidad vive en la ficha del Xpacio de admira.biz. El «Xpacio asociado»
  (el gemelo en admira.store / xpaceos.com) sigue siendo opcional: un MUPI, una marquesina o un autobús sin gemelo pueden
  ser públicos o privados igual.
- **Todo lo que ya existe es público.** Ningún Xpacio cambia hasta que alguien lo marca como privado en el backoffice.
- **Quien gestiona el catálogo los ve todos**: @admira.com y la cuenta de Carlos, igual que para publicar.

## Dónde se decide

En la API del catálogo, no en la página: `omnipublicity-api` (brain.digitalavatar.ai), `src/visibilidad.js`. Sin sesión,
`GET /locations`, el ligero, el resumen y la ficha por id no traen los privados, y un privado por id da 404. Como todo lo
que lee el catálogo pasa por ahí (portada, ficha, buscador, Comercial, el sitemap y los metadatos de compartir de
`server/biz-seo.mjs`, Bugito), un privado no sale en ningún sitio público. Detalle en el README de la API.

## Qué hace esta web

- **Registro.** El botón de Google de la cabecera prueba primero la sesión de siempre (`/api/demo-session`: backoffice y
  demos, sólo @admira.com y las cuentas de Carlos). Si la cuenta no la tiene, entra como registrada por `/api/registro`
  (`server/demo-session.mjs` → `registroFromClaims`): cualquier cuenta de Google con el email verificado. Esa puerta no
  abre el backoffice, ni las demos, ni el semáforo de incidencias. El enlace de la cabecera dice «Registrado» y, al
  pulsarlo, ofrece cerrar la sesión.
- **Sesión en las lecturas.** `locations.js` (`omnipCatalogToken`, `omnipCatalogInit`) manda el ID token guardado
  (`omnip-bo-gtoken`) en cada lectura del catálogo, también en la del Web Worker de la portada (`catalogo-worker.js`, que
  lo recibe en el mensaje). Sin sesión, o con ella a menos de 30 s de caducar, se pide como siempre.
- **Al iniciar sesión** (`admira:session`) la portada vuelve a pedir el catálogo y añade los privados sin recargar
  (`traerXpaciosPrivados` en `app.js`). La ficha de un privado dice «🔒 Privado · solo con registro».
- **Backoffice.** La ficha de cada Xpacio tiene «Visibilidad» (Público / Privado) y, si es privado, «Acceso». «Privado»
  sólo se puede elegir cuando la API responde `visibilidad: 1` (ya filtra): antes, un privado se seguiría viendo en el
  mapa. La lista marca los privados con 🔒.
- **Publicar sin perder privados.** La API conserva los privados guardados que falten en un `PUT /locations` (una copia
  vieja o una herramienta que leyó sin sesión no los borra). Para borrar uno a propósito, el backoffice manda su id en
  `quitar`.

## Lo que queda fuera (de momento)

- El ID token de Google dura una hora. Al caducar, la página vuelve a pedir el catálogo público en la siguiente carga y
  hay que volver a entrar.
- Bugito y el semáforo de incidencias leen el catálogo sin sesión desde el servidor: no ven los privados.
- `/locations/iot/:idIoT`, `/locations/mode` y el avatar de la API no filtran, porque los consultan los propios equipos
  sin sesión. No exponen el catálogo y sus ids no salen en las respuestas públicas.
- Un privado no tiene aún su propio flujo de venta para quien tiene acceso: se ve, pero «Anunciarme aquí» es el de
  siempre.

## Tests

`npm test` (aquí, `tests/xpacios-privados.test.mjs`) y, en la API, `node --test test/*.test.mjs`
(`test/locations-visibilidad.test.mjs`).
