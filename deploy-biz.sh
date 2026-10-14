#!/usr/bin/env bash
# Publica admira.biz en Cloudflare Pages (proyecto clearchannel-tv).
#
# Desde el 14-oct-2026 lo lanza solo GitHub Actions al mergear en main
# (.github/workflows/publicar-admira-biz.yml, ver docs/publicacion-biz.md): antes solo se podía
# publicar desde el Mac Mini y un cambio mergeado se quedaba sin salir hasta que alguien se acordaba.
# A mano sigue valiendo desde cualquier Mac con el vault:
#   ADMIRA_RELEASE_AGENT=MorfeoMacMini ADMIRA_RELEASE_MACHINE=MacMini ./deploy-biz.sh
set -euo pipefail
cd "$(dirname "$0")"
BIZ_AGENT="${ADMIRA_RELEASE_AGENT:-}"
BIZ_MACHINE="${ADMIRA_RELEASE_MACHINE:-}"
[[ -n "$BIZ_AGENT" && -n "$BIZ_MACHINE" ]] || { echo 'Declare ADMIRA_RELEASE_AGENT and ADMIRA_RELEASE_MACHINE.' >&2; exit 1; }
BIZ_CI=0; [[ "${GITHUB_ACTIONS:-}" == "true" ]] && BIZ_CI=1

# En CI no hay vault ni nada que empujar: el commit ya está en main. Si mientras tanto alguien ha
# mergeado otra cosa, se sale sin publicar: la ejecución siguiente trae este cambio y el nuevo.
biz_al_dia() {
  git fetch --quiet origin main
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]]
}
if (( BIZ_CI )); then
  biz_al_dia || { echo '· main ya va por delante de este commit: lo publica la siguiente ejecución.'; exit 0; }
  # Normativa: como mucho 4 publicaciones por hora. Si la última salió hace menos de 15 min, se espera.
  BIZ_LAST="$(curl -fsS https://admira.biz/version.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let t=0;try{t=Date.parse(JSON.parse(s).deployedAt)||0}catch(_){}process.stdout.write(String(Math.floor(t/1000)))})')"
  BIZ_WAIT=$(( BIZ_LAST + 900 - $(date +%s) ))
  if (( BIZ_WAIT > 0 )); then
    echo "· máximo 4 publicaciones por hora: la última fue hace menos de 15 min, espero ${BIZ_WAIT}s."
    sleep "$BIZ_WAIT"
    biz_al_dia || { echo '· mientras esperaba entró otro merge: lo publica la siguiente ejecución.'; exit 0; }
  fi
else
  source ~/Claude/admira-vault/guarda-rama.sh
  git push origin main
fi

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
