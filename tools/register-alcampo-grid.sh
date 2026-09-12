#!/usr/bin/env bash
# Da de alta en la parrilla (api.admira.store/grid/config) una pantalla por cada
# ubicación del circuito Alcampo que aún no exista en /grid/screens.
# Bandas y slotSeconds copiados de las 3 pantallas ya existentes (alcampo-esplugues…).
# GRID_KEY: bóveda admira-vault (GRID_KEY); ~/.agents-comms/.synckey NO vale (bad-key, 12-sep-2026). Nunca se imprime.
set -euo pipefail
SEED="${1:-/Users/Carlos/Claude/alcampo/alcampo-circuit-seed.json}"
[ -f "$SEED" ] || { echo "uso: register-alcampo-grid.sh [seed.json]"; exit 2; }
GRID_KEY="${GRID_KEY:-$(bash "$HOME/Claude/admira-vault/vault-get.sh" GRID_KEY 2>/dev/null || true)}"
[ -n "$GRID_KEY" ] || { echo "✗ sin GRID_KEY"; exit 1; }
GRID_KEY="$GRID_KEY" SEED="$SEED" python3 - <<'PY'
import os, json, urllib.request
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"  # Cloudflare devuelve 403 al UA de urllib
API="https://api.admira.store/grid"
key=os.environ["GRID_KEY"]; seed=json.load(open(os.environ["SEED"]))
seed=seed if isinstance(seed,list) else seed["locations"]  # seed v2: {locations, pendientes}
def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"Accept":"application/json","User-Agent":UA}), timeout=30))
existing={s["screen"] for s in get(API+"/screens").get("screens",[])}
# Bandas de referencia: las de la primera pantalla alcampo ya registrada.
ref=next((s for s in sorted(existing) if s.startswith("alcampo-")), None)
cfg=get(API+"/config?screen="+ref)["config"] if ref else {}
bands=cfg.get("bands") or [{"id":"manana","label":"Mañana","from":"08:00","to":"12:00","capacity":6},{"id":"mediodia","label":"Mediodía","from":"12:00","to":"16:00","capacity":6},{"id":"tarde","label":"Tarde","from":"16:00","to":"20:00","capacity":6},{"id":"noche","label":"Noche","from":"20:00","to":"23:59","capacity":6}]
print("referencia:", ref, "· bandas:", [b["id"] for b in bands])
made=[]; skipped=[]
for loc in seed:
    if loc["id"] in existing: skipped.append(loc["id"]); continue
    body={"key":key,"screen":loc["id"],"name":loc["name"][:80],"circuit":"alcampo","policy":"manual","slotSeconds":15,"pixerScreens":[],"bands":bands}
    req=urllib.request.Request(API+"/config", data=json.dumps(body).encode(), method="POST", headers={"Content-Type":"application/json","User-Agent":UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        d=json.load(r); assert d.get("ok") and d["screen"]==loc["id"], d
    made.append(loc["id"])
print("creadas=%d omitidas(ya existían)=%d" % (len(made), len(skipped)))
print("omitidas:", skipped)
after=[s for s in get(API+"/screens")["screens"] if s.get("circuit")=="alcampo"]
print("pantallas alcampo en /grid/screens:", len(after))
PY
