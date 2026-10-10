#!/usr/bin/env bash
# Publica el núcleo compartido de clearchannel.tv + admira.app en Cloudflare Pages.
# La release se genera desde un commit limpio y queda firmada por agente+equipo.
set -euo pipefail
cd "$(dirname "$0")"

# The domains are frozen independently. Never publish the corrected biz UI to
# every alias of the shared Pages project by archiving main at the root.
if [ -f deployment-biz.json ]; then
  exec bash ./deploy-biz.sh
fi

# La firma se DECLARA, no se hereda (norma 08). Antes, sin variables, firmaba en silencio
# como OraculoMBAPlata: el 1-oct-2026 una publicación de MorfeoMacMini salió con firma ajena.
# Acepta el par de la flota (ADMIRA_RELEASE_*) o el histórico (ADMIRANEXT_*); sin ninguno, aborta.
AGENT="${ADMIRA_RELEASE_AGENT:-${ADMIRANEXT_AGENT:-}}"
MACHINE="${ADMIRA_RELEASE_MACHINE:-${ADMIRANEXT_MACHINE:-}}"
[[ -n "$AGENT" && -n "$MACHINE" ]] || { echo "✗ Declara quién publica: ADMIRA_RELEASE_AGENT=<Persona><Equipo> ADMIRA_RELEASE_MACHINE=<Equipo> ./deploy.sh" >&2; exit 1; }
SIGNATURE="$AGENT · $MACHINE"

if [ -n "$(git status --porcelain)" ]; then
  echo "✗ No se publica desde un árbol sucio." >&2
  exit 1
fi

DAY="$(TZ=Europe/Madrid date +%d.%m.%Y)"
HOUR="$(TZ=Europe/Madrid date +%H:%M)"
DEPLOYED_AT="$(TZ=Europe/Madrid date +%Y-%m-%dT%H:%M:%S%z)"
GIT_SHORT="$(git rev-parse --short HEAD)"
LIVE_VERSION="$(curl -fsS https://www.clearchannel.tv/version.json 2>/dev/null | jq -r '.version // empty' 2>/dev/null || true)"
if [[ "$LIVE_VERSION" =~ ^v\.${DAY//./\.}\.r([0-9]+)\.[0-9]{2}:[0-9]{2}$ ]]; then
  RELEASE="$((BASH_REMATCH[1] + 1))"
else
  RELEASE=1
fi
VERSION="v.${DAY}.r${RELEASE}.${HOUR}"

echo "→ GitHub (push de código, backup)…"
# PRODUCCION ES LA RAMA PRINCIPAL. El 5-ago-2026 yokup.com estuvo horas
# sirviendo una rama de trabajo y nadie se entero. Este guarda lo impide:
# aborta si lo que tienes delante no es exactamente origin/main.
echo "→ Rama…"
source ~/Claude/admira-vault/guarda-rama.sh

git push origin main 2>&1 | tail -1
echo "→ Cloudflare Pages…"
# The existing Wrangler session can manage D1 bindings; the legacy Pages token
# remains available for machines that deploy with the vault credential.
if [ "${ADMIRANEXT_USE_WRANGLER_SESSION:-0}" != "1" ]; then
  export CLOUDFLARE_API_TOKEN="$(bash ~/Claude/admira-vault/vault-get.sh CLOUDFLARE_API_TOKEN)"
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git archive main | tar -x -C "$TMP"

# El sello también va en la puerta MCP propia de admira.app (mcp/admira-app/*).
find "$TMP" -type f \( -name '*.html' -o -path '*/mcp/admira-app/*' -o -path '*/mcp/manifest.json' \) -exec sed -i '' "s/__ADMIRANEXT_VERSION__/$VERSION/g" {} +
# NOVEDADES DEL SELLO (Merovingio, 06-10-2026 · sello con novedades en toda la suite).
# novedades.json[sello] o .default → version.json.novedades[] (2-4 líneas en español). Las
# pinta al pasar el ratón el cargador compartido https://www.admiranext.com/assets/sello-novedades.js
NOVEDADES_JSON='[]'
if [ -f novedades.json ]; then
  NOVEDADES_JSON="$(jq -c --arg v "$VERSION" '
    (if type=="object" then (.[$v] // .default // .novedades // []) elif type=="array" then . else [] end)
    | if type=="array" then . else [] end | map(tostring) | map(select(length>0)) | .[0:4]
  ' novedades.json 2>/dev/null || echo '[]')"
fi
[ -n "$NOVEDADES_JSON" ] || NOVEDADES_JSON='[]'
jq -n --argjson novedades "$NOVEDADES_JSON" \
  --arg version "$VERSION" \
  --arg agent "$AGENT" \
  --arg machine "$MACHINE" \
  --arg signature "$SIGNATURE" \
  --arg gitShort "$GIT_SHORT" \
  --arg deployedAt "$DEPLOYED_AT" \
  '{version:$version,agent:$agent,deployer:$agent,machine:$machine,signature:$signature,gitShort:$gitShort,deployedAt:$deployedAt,dirty:false,novedades:$novedades,domains:["www.clearchannel.tv","www.admira.app","www.admira.biz"]}' \
  > "$TMP/version.json"

npx --yes wrangler@latest pages deploy "$TMP" --project-name=clearchannel-tv --branch=main --commit-dirty=false
echo "✓ $VERSION · $SIGNATURE · $GIT_SHORT"
echo "✓ https://www.clearchannel.tv · https://www.admira.app"
