#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
BIZ_AGENT="${ADMIRA_RELEASE_AGENT:-}"
BIZ_MACHINE="${ADMIRA_RELEASE_MACHINE:-}"
[[ -n "$BIZ_AGENT" && -n "$BIZ_MACHINE" ]] || { echo 'Declare ADMIRA_RELEASE_AGENT and ADMIRA_RELEASE_MACHINE.' >&2; exit 1; }
source ~/Claude/admira-vault/guarda-rama.sh
git push origin main
BIZ_DAY="$(TZ=Europe/Madrid date +%d.%m.%Y)"
BIZ_HOUR="$(TZ=Europe/Madrid date +%H:%M)"
BIZ_LIVE="$(curl -fsS https://admira.biz/version.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).version||""))')"
BIZ_RELEASE=1
if [[ "$BIZ_LIVE" =~ ^v\.${BIZ_DAY//./\.}\.r([0-9]+)\.[0-9]{2}:[0-9]{2}$ ]]; then
  BIZ_RELEASE="$((BASH_REMATCH[1] + 1))"
fi
BIZ_VERSION="v.${BIZ_DAY}.r${BIZ_RELEASE}.${BIZ_HOUR}"
BIZ_STAGE="$(mktemp -d)"
trap 'rm -rf "$BIZ_STAGE"' EXIT
node scripts/build-biz-release.mjs "$BIZ_STAGE" "$BIZ_VERSION" "$BIZ_AGENT" "$BIZ_MACHINE"
if [[ -n "${ADMIRA_WRANGLER_JS:-}" ]]; then
  node "$ADMIRA_WRANGLER_JS" pages deploy "$BIZ_STAGE" --project-name=clearchannel-tv --branch=main --commit-hash="$(git rev-parse HEAD)" --commit-dirty=false
else
  npx --yes wrangler@latest pages deploy "$BIZ_STAGE" --project-name=clearchannel-tv --branch=main --commit-hash="$(git rev-parse HEAD)" --commit-dirty=false
fi
echo "Published $BIZ_VERSION · $BIZ_AGENT · $BIZ_MACHINE · https://admira.biz/"
echo 'clearchannel.tv keeps the preserved revision from deployment-biz.json.'
