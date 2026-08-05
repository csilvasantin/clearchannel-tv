#!/usr/bin/env bash
# Publica el núcleo compartido de clearchannel.tv + admira.app en Cloudflare Pages.
# La release se genera desde un commit limpio y queda firmada por agente+equipo.
set -euo pipefail
cd "$(dirname "$0")"

AGENT="${ADMIRANEXT_AGENT:-OraculoMBAPlata}"
MACHINE="${ADMIRANEXT_MACHINE:-MacBookAirPlata}"
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
export CLOUDFLARE_API_TOKEN="$(bash ~/Claude/admira-vault/vault-get.sh CLOUDFLARE_API_TOKEN)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git archive main | tar -x -C "$TMP"

find "$TMP" -type f -name '*.html' -exec sed -i '' "s/__ADMIRANEXT_VERSION__/$VERSION/g" {} +
jq -n \
  --arg version "$VERSION" \
  --arg agent "$AGENT" \
  --arg machine "$MACHINE" \
  --arg signature "$SIGNATURE" \
  --arg gitShort "$GIT_SHORT" \
  --arg deployedAt "$DEPLOYED_AT" \
  '{version:$version,agent:$agent,deployer:$agent,machine:$machine,signature:$signature,gitShort:$gitShort,deployedAt:$deployedAt,dirty:false,domains:["www.clearchannel.tv","www.admira.app"]}' \
  > "$TMP/version.json"

npx --yes wrangler@latest pages deploy "$TMP" --project-name=clearchannel-tv --branch=main --commit-dirty=false
echo "✓ $VERSION · $SIGNATURE · $GIT_SHORT"
echo "✓ https://www.clearchannel.tv · https://www.admira.app"
