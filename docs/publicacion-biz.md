# Publicación de admira.biz

Desde el 14-oct-2026, **cada merge en `main` publica admira.biz solo**. Lo hace GitHub Actions
(`.github/workflows/publicar-admira-biz.yml`) con el mismo `deploy-biz.sh` de siempre. Antes solo se
podía publicar desde el Mac Mini, y un cambio mergeado se quedaba sin salir hasta que alguien se acordaba.

## Qué hace

0. **Tests primero (17-oct-2026).** En cada PR contra `main` y en cada merge corre `npm test`
   (ver [Tests](#tests)). En un PR solo prueba. En un merge, si algún test falla, no se publica.
1. Al mergear en `main`, el flujo saca el repo con todo el historial (la revisión preservada de
   clearchannel.tv sale de git) y lanza `deploy-biz.sh`.
2. **Firma:** el agente que hizo el cambio (el autor del último commit del PR) · `GitHubActions`,
   por ejemplo `NeoMacStudio · GitHubActions`.
3. **Sello:** `v.DD.MM.AAAA.rN.HH:MM`, hora de Madrid. La `r` sube sobre la versión que hay en producción.
4. **Ritmo:** como mucho 4 publicaciones por hora. Si la última salió hace menos de 15 minutos,
   espera. Si mientras tanto entra otro merge, publica solo el último.
5. **Comprobación:** al final verifica que `admira.biz/version.json` sirve el commit publicado.
6. **Consola (17-oct-2026):** después, `tools/consola-produccion.mjs` abre en un Chrome sin ventana
   la portada, el backoffice, Bugito y el plano, y si alguna tiene errores de consola el flujo sale
   en rojo. No despublica: se arregla con otro merge o se vuelve a la versión anterior. El ruido de
   Google sin sesión (FedCM) no cuenta; `--estricto` lo cuenta también. A mano, desde un Mac con Chrome:
   `node tools/consola-produccion.mjs`.

## Tests

Antes de publicar o de revertir, se pasan así, desde la raíz del repo:

```bash
npm test
```

Es lo mismo que corre el flujo: `node --test tests/*.test.mjs tests/*.test.cjs`. No hay nada que
instalar.

**Da lo mismo en cualquier carpeta (18-oct-2026).** En el Mac Mini el repo vive bajo
`~/Documents/Admirito`, que tiene su propio `package.json` con `"type": "module"`. Sin uno en la raíz,
Node lo heredaba: los `.js` clásicos (`login-google.js`, `galaxy-shell.js`, `expert-panel.js`…) se
cargaban como ESM, y los `.cjs` que les hacen `require()` daban unos 128 fallos falsos. Fuera de esa
carpeta, o en CI, pasaba entero. Ese día hubo que repetir varias baterías en un worktree en `/tmp`.

El `package.json` de la raíz corta esa herencia. No lleva `"type"`, y es a propósito:

- Con `"type": "commonjs"`, Node ya no detecta la sintaxis y `_worker.js` (ESM) no carga: fallan 6
  ficheros de test.
- Con `"type": "module"`, vuelve el problema de los `.js` clásicos.
- Sin `"type"`, Node carga como CommonJS los `.js` clásicos y detecta que `_worker.js` y `avatar-ask.js`
  son ESM. Al hacerlo avisa con `MODULE_TYPELESS_PACKAGE_JSON`, y `npm test` calla ese aviso con
  `--disable-warning`. La detección necesita Node 22.7 o posterior; el flujo usa Node 22.

No se publica. El release de admira.biz parte de la revisión preservada de clearchannel.tv y copia una
lista cerrada de ficheros (`server/biz-assets.mjs`), que no lo incluye. Cloudflare Pages recibe un
paquete ya montado (*direct upload*), así que no hay build que cambie al verlo. Lo comprueba
`tests/publicar-biz.test.mjs`.

## Qué necesita

En el repo, dos secretos de GitHub Actions, los mismos que ya usan admira-store y pixeria:

- `CLOUDFLARE_API_TOKEN`, con permiso para editar Cloudflare Pages.
- `CLOUDFLARE_ACCOUNT_ID`.

Sin ellos, el flujo falla en el paso «Publicar» y lo dice.

## A mano

Sigue valiendo desde cualquier Mac con el vault (incluye el guarda de rama y el `git push`):

```bash
ADMIRA_RELEASE_AGENT=MorfeoMacMini ADMIRA_RELEASE_MACHINE=MacMini ./deploy-biz.sh
```

También se puede relanzar el flujo desde la pestaña Actions de GitHub («Run workflow»).

## SEO y compartir (24-oct-2026 · misión FLT-102678 · encargo #7161)

El mismo proyecto Pages sirve www.admira.biz y www.clearchannel.tv, y la release de admira.biz parte de la de clearchannel.tv. Por eso admira.biz servía el `robots.txt` y el `sitemap.xml` de clearchannel.tv (con `store-3d.html`, que da 308), y un enlace a un Xpacio compartido por WhatsApp, LinkedIn o Slack salía con la vista genérica. Todo lo nuevo está en `server/biz-seo.mjs` y sólo actúa con Host `(www.)admira.biz`. clearchannel.tv sirve lo mismo que antes (comprobado contra la release de `main`, fichero a fichero).

- **`/robots.txt` propio.** Los mismos `Disallow` del backoffice que clearchannel.tv, más `Disallow: /backoffice` para su URL limpia (Pages sirve `/backoffice` con 200). `Sitemap: https://www.admira.biz/sitemap.xml`.
- **`/sitemap.xml` es un índice** con dos sitemaps:
  - `/sitemap-paginas.xml`: las páginas públicas que responden 200 sin redirigir y sin `noindex` (`/`, `/marketplace`, `/about`, `/help/`, `/tutorial/`, `/target/`, `/wututu/`, `/mcp/`). Fuera quedan `store-3d.html` (308), `/parrilla/` (`noindex`), el backoffice y las herramientas. Si se publica una página nueva, se añade a `PAGINAS_PUBLICAS`.
  - `/sitemap-xpacios.xml`: generado del catálogo ligero (`GET /locations?slim=1`) y guardado en la Cache API del borde. Pasada 1 h, sale la copia al instante y se renueva detrás. La copia dura 24 h. Sin copia y sin catálogo responde 503 con `Retry-After`, nunca un sitemap vacío.
  - Entran los Xpacios con al menos una pantalla, que no sean altas propias de la flota (`selfReg`) y cuyo nombre no se repita más de 20 veces (`MAX_NOMBRE_REPETIDO`). Hoy son 3.541 «Correos Oficina» con la dirección «Correos · post_box», 1.095 «BBVA España», 975 «Correos Oficina de», 738 «Mango»… Son páginas con el mismo título y la misma descripción, y Google las trataría como duplicadas. Esas fichas siguen abiertas e indexables: sólo no se empujan. El 24-oct salen 2.476 Xpacios. El slim no trae dirección ni ciudad; con ellas se podría filtrar por título.
- **La URL canónica de un Xpacio es `/detail?loc=<id>`.**
  - Abre la ficha de cualquier Xpacio sólo con su id. La portada sólo la abre con `?circuit=…&loc=…`.
  - Es una página de texto ligera, sin WebGL ni los ~10 MB del catálogo.
  - Tiene un solo formato por Xpacio. Su «Volver al mapa» lleva al punto en el mapa.
- **Metadatos por Xpacio en el servidor**, para `/detail?loc=<id>` y para la portada con `?loc=<id>` (con o sin `circuit`):
  - Con HTMLRewriter, en una segunda pasada después de la de marca, se cambian `<title>` («Nombre · ciudad o dirección | admira.biz»), `description`, `canonical`, Open Graph y Twitter, y se añade un JSON-LD `Place` con nombre, dirección y coordenadas.
  - La descripción lleva el tipo, la dirección, los dispositivos, las impresiones al día y el CPM, siempre como «estimadas» y «orientativo», nunca como audiencia medida. Las cifras se calculan como en la ficha.
  - Los datos salen de `GET /locations/:id`, pedido a la vez que el HTML, con un tope de 1,5 s y 2 min de caché en el borde. Si el catálogo falla, vale la última copia buena de las últimas 24 h; si no hay, la página sale con los metadatos genéricos de siempre. Un id que el catálogo no conoce (404) pone `noindex` en `/detail`.
  - La dirección de relleno de OpenStreetMap («Correos · post_box») no sale en el título.
  - Todo lo que viene del catálogo sale escapado (comillas, `<`, `&`), y el JSON-LD no puede cerrar su `<script>`.
  - `og:image`, por prioridad: el Previo DooH de la fachada (`previo.imagen`, de admira.tv), el póster del circuito si ya está en la caché de `/api/previo/circuito` (no se pregunta al Stock) y, si no, la imagen de la portada.
  - En la portada con ficha (`?circuit=…&loc=…`), `og:url` es la propia URL compartida, sin parámetros ajenos, para que la tarjeta lleve al mapa con la ficha abierta. La `canonical` es la de la ficha.
  - `detail.html` conserva el título del servidor (`<meta name="admira:xpacio">`). `brand.js` ya no le quita la query a una canónica propia: con la query fuera, los Xpacios eran duplicados de `/detail`. Entra en la lista cerrada de admira.biz; clearchannel.tv sigue con el suyo.
- **Idioma.** La cara Admira es española: `og:locale` `es_ES` con alternate `en_GB` en la portada. El worker corrige igual cualquier página de admira.biz que lo declare al revés. Sin `hreflang`: `?lang=en` traduce la interfaz, pero el contenido del catálogo está en español y comparte la canónica.
- **Imágenes sin cifras.**
  - `assets/og-admira-biz.jpg` (1200×630, 165 KB) es la imagen de compartir de admira.biz: Barcelona en 3D con los puntos por circuito, el logotipo y una frase. Sustituye al cockpit ilustrativo con «$1,85» y «2.456.789 impresiones».
  - En la ficha, la ilustración es `assets/xpacio-ilustrativo.webp`, el plano 3D de `store-3d` sin interfaz.
  - De paso, la ilustración respeta su proporción (`height:auto`). Antes medía 941 px de alto también en el móvil.
  - La imagen de clearchannel.tv no se toca.
- **Fuera de este repo.** El sitemap se envía en Google Search Console; eso lo hace Carlos.

### English

- admira.biz now serves its own `robots.txt` and a sitemap index (`/sitemap.xml` → public pages + venues). The venue sitemap is built from the slim catalogue and kept in the edge Cache API (refreshed in the background after 1 h, kept 24 h, 503 when there is no copy and no catalogue).
- Venues with no screens, fleet self-registrations and names repeated more than 20 times are left out of the sitemap: thousands of “Correos Oficina” pages share the same title and description.
- The canonical venue URL is `/detail?loc=<id>`. It works for any id, it is light, and there is one URL per venue.
- `/detail?loc=<id>` and the home page with `?loc=<id>` get server-side title, description, canonical, Open Graph, Twitter and a `Place` JSON-LD. Figures are labelled as estimated or indicative, never as measured audience. If the catalogue fails, the generic metadata stays. Unknown ids get `noindex` on `/detail`.
- `og:image`: the venue’s DooH preview photo, the cached circuit poster, or the new home image. Everything from the catalogue is escaped.
- `og:locale` is `es_ES` with `en_GB` as alternate. There is no `hreflang`: `?lang=en` only translates the interface and shares the Spanish canonical.
- A new share image without made-up figures (`assets/og-admira-biz.jpg`), and a figure-free illustration on the detail page. clearchannel.tv is unchanged.
