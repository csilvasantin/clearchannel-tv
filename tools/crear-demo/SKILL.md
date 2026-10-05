# Skill · «créame demo de <cliente>»

Una sola petición («créame demo de Lenovo», «créame demo de Nike con París y Milán») monta la
cadena completa Admira para un cliente nuevo, con el patrón del hilo musical de Starbucks
(`cliente.xpacio.hilomusical`).

| # | Paso | Producto | Qué crea | Endpoint | Secreto (bóveda) |
|---|------|----------|----------|----------|------------------|
| 1 | marca | admiranext.com/marcablanca | Marca blanca `<id>` (colores, wordmark de demo, tono) | POST /marcablanca/api/analizar → POST/PUT /presentaciones/api/marcas | ADMIRANEXT_PRESENTACIONES_MACHINE_KEY |
| 2 | circuito | admira.biz (= admira.app, Pages clearchannel-tv) | Circuito `demo_<id>` con N Xpacios céntricos; **tipo Xpacio** fija `kind` + gemelo | GET→backup→unión→PUT brain.digitalavatar.ai/locations | ADMIN_TOKEN |
| 3 | grid | api.admira.store | 1 pantalla por Xpacio, circuit `demo_<id>` | POST /grid/config | GRID_KEY |
| 4 | audio | admira.studio motores (api.admira.store) | Canciones EN+ES (Lyria 3) + locuciones de cierre | POST /lyria3/generate · /hilomusical/push · /megafonia/push | NOTIFY_KEY (solo Lyria) |
| 5 | xpl | xpl.admira.store | Playlist exacta `<id>.xpacio.hilomusical` | POST /playlists | XPL_TOKEN |
| 6 | book | api.admira.store GRID | Reservas «own» en la banda actual | POST /grid/book | GRID_KEY |
| 7 | twins | admira.store | Gemelo por Xpacio con `autostart` según **tipo Xpacio** | campos `twin` + `xpaceUrl` | — |
| 8 | resumen | — | `~/Claude/demos/<id>/demo-<id>-RESUMEN.md` + estado JSON | — | — |

## Tipo de Xpacio (obligatorio en demos formales)

Carlos (05-10-2026): no basta el nombre de compañía. El tipo fija la escena del gemelo
y el `kind` del catálogo. **Lenovo = DemoStores**, no Estancos ni Cafeterías.

| `--xpacio-tipo` | Escena (`autostart`) | Uso |
|-----------------|----------------------|-----|
| `demostore` (default) | `shoptalk` | DemoStores / retail demo (Lenovo, Apple Store demo…) |
| `estanco` | `xtanco` | Estancos / Xtanco |
| `cafeteria` | `cafeteria` | Cafeterías / Cafebrería / Starbucks-like |
| `other` | `xtanco` | Con `--xpacio-otro "Gimnasio"` para la etiqueta |

Formulario público: **https://www.admiranext.com/demo** → POST `/api/demo` encola la solicitud
(KV). El Mac Mini la procesa con `crear_demo.py` (o `procesar_cola.py`). Si no hay pipeline,
la API guarda la petición y notifica Agora.

## Cómo se invoca

En el Mac Mini (bóveda), desde un clon de `clearchannel-tv`:

```bash
python3 tools/crear-demo/crear_demo.py --cliente "Lenovo" --web https://www.lenovo.com/es/es/ \
  --color '#E2231A' --xpacio-tipo demostore \
  --ciudades london,newyork,barcelona,madrid --cierre 20:00 --idiomas en,es
```

Cola desde el formulario:

```bash
python3 tools/crear-demo/procesar_cola.py          # una pendiente
python3 tools/crear-demo/procesar_cola.py --dry-run
```

- `--dry-run` enseña el plan sin escribir. `--pasos audio,xpl,book` repite solo esos pasos.
- Idempotente: no duplica Xpacios, pantallas ni playlist; audio ya publicado se reutiliza
  (`~/Claude/demos/<id>/`). `--rehacer` regenera marca y audio.
- Ciudades con preset: london, newyork, barcelona, madrid, paris, milano, lisboa, valencia, mexico.
- Secretos solo con `~/Claude/admira-vault/vault-get.sh`; nunca se imprimen ni se guardan (`scrub`).

Un agente (GrokBot / Arquitecto / Smith) que reciba «créame demo de X» debe:
1. Etiquetar `retorno/pre-demo-<id>-AAAAMMDD` en clearchannel-tv, admira-store y xpaceos antes de deploy.
2. Lanzar el comando en el Mac Mini **con `--xpacio-tipo` correcto** (Lenovo → `demostore`).
3. Capturar evidencias en `/workspace/uploads/demo-<id>-*.png`.
4. Encargar verificación MCP a Merovingio (XPL/GRID), Smith (deploy/rollback) y Morfeo (audio).

## Deshacer una demo

- Catálogo: restaurar `backup-omnipublicity-*.json` con el mismo PUT, o quitar ids `<id>-demo-*`.
- XPL: quitar playlist `<id>.xpacio.hilomusical` y volver a POST.
- Marca: PUT otra versión o retirar desde /marcablanca.
- Código: `git checkout retorno/pre-demo-<id>-AAAAMMDD` (o `retorno/pre-demo-form-20261005` para el form) y redeploy.
