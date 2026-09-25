# Circuitos JTI · Xtanco y Alsea · Starbucks — Fase 1 (25-sep-2026)

Misión Yokup: FLT-100992 (proyecto admiranext). Autor: Walt Disney (CCO, Consejo de Silicio).

## 1. Listas (datos reales, nada inventado)
| Fichero | Puntos | Fuente |
|---|---|---|
| starbucks-100.csv | 100 de 194 Starbucks ES | Store locator oficial Starbucks (starbucks.co.uk/api/v2/stores) vía AllThePlaces run 2026-09-19 (spider starbucks_eu); 57/100 cruzados con OSM (≤150 m) |
| xtancos-100.csv | 100 de 3.207 estancos OSM | OpenStreetMap shop=tobacco, extracto Geofabrik spain-latest (24-sep-2026); 21 ciudades/CP completados con Nominatim reverse |
| mapa-starbucks.png / mapa-xtancos.png | — | matplotlib sobre provincias (Canarias desplazada) |

Reparto ~ por población (Madrid y Barcelona en cabeza, luego Valencia, Alicante, Sevilla, Málaga…). Canarias sin estancos en la lista (en OSM no hay estancos canarios con dirección; allí el régimen del tabaco es distinto).

## 2. Cómo se da de alta un circuito en admira.app (= clearchannel.tv)
- admira.app y clearchannel.tv son EL MISMO proyecto Cloudflare Pages `clearchannel-tv` (repo csilvasantin/clearchannel-tv). El repo `admira-app` está DEPRECADO (19-jul-2026).
- Datos: la app lee los puntos del KV del worker `omnipublicity-api` → `GET https://brain.digitalavatar.ai/locations` (alias de omnipublicity-api.csilvasantin.workers.dev). Hoy: 8.891 puntos (102 alcampo-*, 0 Starbucks).
- Alta: `PUT /locations` con `{"locations":[...unión completa...]}` + `Authorization: Bearer <ADMIN_TOKEN>` (patrón GET → backup → unión por id → PUT). Herramientas: `clearchannel-tv/tools/import-alcampo-circuit.mjs --publish` (OMNIP_ADMIN_TOKEN) y `tools/merge-circuit-kv.sh <seed.json>`.
- El circuito como tal (desplegable) se define en código: `clearchannel-tv/app.js` → `CIRCUIT_IDS_BY_SCOPE`, función `isXLocation()`, entrada en `circuitDefinitions()` y etiqueta i18n `circuit_<id>`. Deploy = push a clearchannel-tv (Cloudflare Pages).
- Opcional (parrilla/pantallas): `tools/register-alcampo-grid.sh` → `POST https://api.admira.store/grid/config` con GRID_KEY (una pantalla por punto, circuit:<id>).
- Gemelo: campo `twin` de cada punto (el botón abre el gemelo). Ej. xtanco-valencia → https://www.xpaceos.com/admira-xp/?autostart=xtanco&loc=xtanco-valencia
- Fuente de datos crudos por marca: repo `admira-app-data/circuits/*.json` (no se sirve).

## 3. Preparado (NO publicado)
- `circuito-alsea-starbucks-100.seed.json` (ids alsea-sbux-001…100, circuit "alsea_starbucks", twin → `?autostart=cafeteria&loc=<id>`, pendiente de que exista el vertical cafetería).
- `circuito-jti-xtanco-100.seed.json` (ids jti-xtanco-001…100, circuit "jti_xtanco", twin → `?autostart=xtanco&loc=<id>`).
- `clearchannel-tv-circuitos-jti-alsea.patch`: rama LOCAL `propuesta/circuitos-jti-alsea` en /workspace/repos/clearchannel-tv (no pusheada). Añade circuitos "Circuito JTI Xtanco España 100" y "Circuito Alsea Starbucks España 100" (scope national). node --check OK; tests 40/41 (el fallo orders.test.mjs ya existe en main).
- Ojo: `isEstancoLocation()` casa con cualquier id/nombre con "xtanco"/"estanco" → los 100 JTI aparecerán también en "Xtanco Nacional" (hoy 5 puntos). Decidir si se quiere.

## 4. Para publicar (necesita OK de Carlos)
1. ADMIN_TOKEN de omnipublicity (bóveda admira-vault / Llavero del Mac; NO está en /workspace/secrets).
2. `OMNIP_ADMIN_TOKEN=… node tools/merge-circuit-kv.sh circuito-*.seed.json` (backup previo del KV).
3. Push de la rama a clearchannel-tv → deploy Pages → smoke `https://admira.app/?circuit=alsea_starbucks` y `?circuit=jti_xtanco`.
4. (Opcional) GRID_KEY para alta de pantallas en la parrilla.

## 5. Gemelo Xtanco → cafetería estilo Starbucks
Gemelo base: https://www.xpaceos.com/admira-xp/?autostart=xtanco (Good 8 bits / Better `&visual=better` / Best 32 bits), repo csilvasantin/xpaceos, carpeta `admira-xp/` (index.html monolítico ~1,8 MB + scripts/life-*.mjs, premium-*.mjs). Editor 3D de Xpacio: https://www.xpaceos.com/xpacios/xtanco-barcelona/ (y xtanco-valencia, grok, lab, crear). Inventario: https://www.xpaceos.com/inventario/ (registry.json, 43 ids permanentes). Mobiliario: https://www.xpaceos.com/mobiliario/.
Precedente: el vertical `supermercado` reutiliza el motor Xtanco re-etiquetando el mismo mobiliario (`CLIENTS` + `FACTORY_LAYOUTS` en admira-xp/index.html ~l.6537 y ~l.7216; `?play=`/`?autostart=`).
Cambios para "cafeteria":
- Vertical: añadir `{id:'cafeteria'}` a CLIENTS, `FACTORY_LAYOUTS.cafeteria`, textos clientTracks/clientNames, `autostart=cafeteria`, `netVerticalFor()`.
- Mostrador (native:counter nº1): barra de café larga con máquina espresso, vitrina de bollería y caja; zona de recogida "pedido listo".
- Pantallas: menu boards digitales (tríptico sobre la barra, TFT nº13 / LED nº12), pantalla de recogida, escaparate; mismas surfaces DOOH.
- Mobiliario: estantería nº2 → merchandising/café en grano; botellero nº3 → nevera de bebidas frías; lotería nº4 y revistero nº6 → fuera (o barra de condimentos); vending nº5 → nevera grab&go; escritorio nº7 → trastienda. Añadir mesas y sillas (nº43 silla, mesas nº33/36/37 son Pixeria "fantasía": conviene crear mesa de café, taburete alto, sofá lounge y mesa comunal nuevos, nº44+), plantas nº9, lámparas colgantes, alfombra nº11.
- Ambiente: ya existe motor de sonido "cafetera" (assets/js/ambient.js), hilo musical lounge; aroma nº16 → café.
- Personajes: cajero → barista; cola y recogida por nombre.
- Marca: no usar logo/sirena Starbucks sin permiso de Alsea; paleta verde/madera "estilo" cafetería.
