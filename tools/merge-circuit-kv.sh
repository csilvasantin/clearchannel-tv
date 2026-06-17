#!/usr/bin/env bash
# Fusiona un circuito (fichero JSON de tiendas) en el KV de omnipublicity-api,
# preservando todo lo que ya hay (GET -> unión por id -> PUT).
# Uso:  merge-circuit-kv.sh <seed.json>
# ADMIN_TOKEN se lee de la bóveda admira-vault (fuente de verdad), fallback Llavero.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
SEED="${1:-}"
[ -f "$SEED" ] || { echo "uso: merge-circuit-kv.sh <seed.json>"; exit 2; }

GRID="$(cat "$HOME/.agents-comms/.synckey" 2>/dev/null || true)"
export ADMIN_TOKEN="$(curl -fsS -m 12 "https://admira-vault.csilvasantin.workers.dev/secret/ADMIN_TOKEN?key=$GRID" -H 'User-Agent: Mozilla/5.0' 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)["value"])' 2>/dev/null || true)"
[ -n "$ADMIN_TOKEN" ] || export ADMIN_TOKEN="$(security find-generic-password -s omnipublicity-admin-token -w 2>/dev/null)"
[ -n "$ADMIN_TOKEN" ] || { echo "✗ sin ADMIN_TOKEN (ni bóveda ni Llavero)"; exit 1; }

SEED="$SEED" python3 - <<'PY'
import os, json, urllib.request, urllib.error
API="https://omnipublicity-api.csilvasantin.workers.dev/locations"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
tok=os.environ["ADMIN_TOKEN"]; seed=json.load(open(os.environ["SEED"]))
d=json.load(urllib.request.urlopen(urllib.request.Request(API, headers={"User-Agent":UA,"Accept":"application/json"}), timeout=25))
cur=d if isinstance(d,list) else (d.get("items") or d.get("locations") or [])
ids={l.get("id") for l in cur}
new=[p for p in seed if p.get("id") not in ids]
union=cur+new
print("KV actual=%d  +nuevos=%d  -> union=%d" % (len(cur),len(new),len(union)))
if not new: print("(nada que añadir)"); raise SystemExit(0)
body=json.dumps({"locations":union}).encode()
put=urllib.request.Request(API, data=body, method="PUT",
    headers={"Content-Type":"application/json","Authorization":"Bearer "+tok,"User-Agent":UA})
try:
    with urllib.request.urlopen(put, timeout=60) as r:
        print("PUT", r.status, r.read(160).decode()); print("✅ fusionado en el KV")
except urllib.error.HTTPError as e:
    print("PUT", e.code, e.read(300).decode()); raise SystemExit(1)
PY
