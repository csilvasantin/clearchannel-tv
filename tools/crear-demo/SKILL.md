# Skill · «créame demo de <cliente>»

Una sola petición («créame demo de Lenovo», «créame demo de Nike con París y Milán») monta la
cadena completa Admira para un cliente nuevo, con el patrón del hilo musical de Starbucks
(`cliente.xpacio.hilomusical`).

| # | Paso | Producto | Qué crea | Endpoint | Secreto (bóveda) |
|---|------|----------|----------|----------|------------------|
| 1 | marca | admiranext.com/marcablanca | Marca blanca `<id>` (colores, wordmark de demo, tono) | POST /marcablanca/api/analizar → POST/PUT /presentaciones/api/marcas | ADMIRANEXT_PRESENTACIONES_MACHINE_KEY |
| 2 | circuito | admira.biz (= admira.app, Pages clearchannel-tv) | Circuito `demo_<id>` con 4 Xpacios céntricos (London, New York, Barcelona, Madrid) | GET→backup→unión→PUT brain.digitalavatar.ai/locations | ADMIN_TOKEN |
| 3 | grid | api.admira.store | 1 pantalla por Xpacio, circuit `demo_<id>` | POST /grid/config | GRID_KEY |
| 4 | audio | admira.studio motores (api.admira.store) | 2 canciones EN+ES (Lyria 3) en Stock + hilo `store=<id>`; 2 locuciones ES+EN «hoy cerramos antes de las 20:00» (ElevenLabs) | POST /lyria3/generate · /hilomusical/push · /megafonia/push | NOTIFY_KEY (solo Lyria) |
| 5 | xpl | xpl.admira.store | Playlist exacta `<id>.xpacio.hilomusical` (EN/ES + locuciones, activeLang) | POST /playlists (fusión, conserva las demás) | XPL_TOKEN |
| 6 | book | api.admira.store GRID | Reservas «own» de las 4 piezas en la banda actual de cada Xpacio | POST /grid/book | GRID_KEY |
| 7 | twins | admira.store | Gemelo por Xpacio: `admira.store/admira-xp/?autostart=xtanco&visual=better&marca=<id>&loc=<loc>&store=<id>` | campos `twin` + `xpaceUrl` del Xpacio + GET de comprobación | — |
| 8 | resumen | — | `~/Claude/demos/<id>/demo-<id>-RESUMEN.md` + estado JSON | — | — |

## Cómo se invoca

En el Mac Mini (donde está la bóveda), desde un clon de `clearchannel-tv`:

```bash
python3 tools/crear-demo/crear_demo.py --cliente "Lenovo" --web https://www.lenovo.com/es/es/ \
  --color '#E2231A' --sector 'Tecnología · retail' \
  --ciudades london,newyork,barcelona,madrid --cierre 20:00
```

- `--dry-run` enseña el plan sin escribir nada. `--pasos audio,xpl,book` repite solo esos pasos.
- Idempotente: no duplica Xpacios, pantallas ni playlist; el audio ya publicado se reutiliza (estado en `~/Claude/demos/<id>/`). `--rehacer` regenera marca y audio.
- Ciudades con preset: london, newyork, barcelona, madrid, paris, milano, lisboa, valencia, mexico (añadir en `CIUDADES`).
- Los secretos se leen con `~/Claude/admira-vault/vault-get.sh` y nunca se imprimen ni se guardan (la salida pasa por `scrub`).

Un agente (GrokBot / Arquitecto / Smith) que reciba «créame demo de X» debe:
1. Etiquetar `retorno/pre-demo-<id>-AAAAMMDD` en clearchannel-tv, admira-store y xpaceos antes de cualquier deploy.
2. Lanzar el comando en el Mac Mini (Shell con machineId del MacMini).
3. Capturar evidencias en `/workspace/uploads/demo-<id>-*.png` (admira.biz con `?marca=<id>&circuit=demo_<id>`, marca blanca, feed, XPL, gemelo).
4. Encargar verificación por MCP (agente_encargar) a Merovingio (XPL/GRID), Smith (deploy/rollback) y Morfeo (audio).

## Gemelo

`visual=better` y no `visual=matrix`: Matrix es la escena fotográfica de Starbucks y fuerza su marca.
Con `visual=better` el gemelo genérico de XpaceOS se viste con `?marca=<id>`, el hilo y la megafonía
leen `store=<id>` y el «Circuit tour» recorre los Xpacios `demo_<id>`.

## Sin tocar código (casi)

`app.js` pinta como circuito propio cualquier punto con `circuit: "demo_<id>"` (etiqueta en `circuitLabel`),
y `cliente-segmento.js` lo asigna al cliente `<id>`, de modo que `?marca=<id>` filtra el globo a sus Xpacios.
Al lado de cada ubicación del circuito, y también en la ficha, aparece **Gemelo Digital** (ES) / **Digital Twin** (EN).
Abre `admira.store/admira-xp/?autostart=xtanco&visual=better&marca=<id>&loc=<loc>&store=<id>` (hilo musical).
`crear_demo.py` escribe `twin` y `xpaceUrl` con esa URL. Si el catálogo solo trae `twin`, `stampDemoTwin`
copia la URL válida a `xpaceUrl`. Un cliente nuevo no exige otro deploy: el código base ya está en Pages.

## Deshacer una demo

- Catálogo: restaurar la copia `backup-omnipublicity-*.json` con el mismo PUT, o quitar los ids `<id>-demo-*`.
- XPL: quitar la playlist `<id>.xpacio.hilomusical` y volver a POST.
- Marca: PUT con otra versión o retirar desde /marcablanca (generador).
- Código: `git checkout retorno/pre-demo-<id>-AAAAMMDD` y redeploy.
