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

## Demo completa v2 · ejecutor paso a paso (`demo_completa.py`, 06-10-2026)

«Preparalo y aprendemos a medida que hacemos» (Carlos). Ejecuta el plan `admiranext.demo-completa/2`
que genera www.admiranext.com/demo (copia en `planes/demo-365-bcn-plan.json`: 365 Barcelona,
4 locales reales, 12 equipos ITIL, 16 playlists, 48 huecos, 12 piezas compartidas).

- **Ensayo por defecto** (solo lecturas públicas). Escribir exige `--real`.
- `--paso N` (uno) · `--hasta N` (1..N) · `--paso A --hasta B` (A..B). En `--real` la cadena se
  para en el primer paso bloqueado o con error.
- Idempotente: cada paso comprueba antes de crear. Estado en `~/Claude/demos/365-bcn/365-bcn-estado.json`
  y evidencias (solo se añaden) en `365-bcn-evidencias.jsonl`.
- Secretos: variable de entorno con su nombre o la bóveda; nunca se imprimen ni se guardan.
  `--preflight` enseña qué hay (solo nombres) y dónde puede correr cada paso.

| # | Paso | Escribe | Credencial | Dónde |
|---|------|---------|------------|-------|
| 1 | marca | catálogo /marcablanca (`tipo real`, `propuesta:false`) → `/marca 365` | ADMIRANEXT_PRESENTACIONES_MACHINE_KEY | Mac Mini |
| 2 | circuito | `demo_365_bcn` en brain.digitalavatar.ai/locations (coords reales, copia previa) | ADMIN_TOKEN | Mac Mini |
| 3 | gemelos | nada (comprueba gemelo + campo twin) | — | cualquiera |
| 4 | itil | `itil_ci_upsert` ×12 (MCP yokup.com/mcp) cuando Yokup ya sincronizó el Xpacio | `YOKUP_MCP_CREDENTIAL` (fichero ykm_, scopes read,itil,itil:write) | Mac Mini |
| 5 | playlists | 16 playlists en xpl.admira.store (unión) + 12 borradores admira.tv | XPL_TOKEN, NOTIFY_KEY | Mac Mini |
| 6 | piezas | 3 canciones (Lyria 3) + 3 locuciones (/tts) + 6 visuales (`GET imagen.admira.store/img`, Gemini Pro y si falla Flash → MP4) en el Stock, catálogo `demo-365-bcn`; asigna los 48 huecos. `POST /imagen/generate` quedó en 404: Imagen 4 se apagó el 17-ago-2026 | NOTIFY_KEY, XPL_TOKEN | Mac Mini (de pago) |
| 7 | checker | nada (lecturas) + presencia SIMULADA local | — (`--presencia yokup`: INSTALLER_ADMIRA_SECRET) | cualquiera |

```bash
python3 tools/crear-demo/demo_completa.py --preflight
python3 tools/crear-demo/demo_completa.py                    # ensayo de los 7 pasos
python3 tools/crear-demo/demo_completa.py --paso 1 --real    # marca blanca real 365
python3 tools/crear-demo/demo_completa.py --paso 4 --real    # re-lanzar hasta que Yokup sincronice (≤15 min)
python3 tools/crear-demo/demo_completa.py --disparar cierre --sitio bcn-tetuan --lang es --real   # TPV manual
python3 -m unittest discover -s tools/crear-demo/tests
```

Riesgos: `--presencia yokup` deja los equipos vigilados (si dejan de latir, Yokup abre «Equipo sin
conexión» y avisa a instaladores): solo si Carlos lo pide. El disparo desde el TPV real aún no existe
(`--disparar` es el sustituto manual vía /megafonia/push). Paso 4 depende de la sincronización de Yokup
(cron 2 min, tanda ≤15 min, solo Xpacios con gemelo).
