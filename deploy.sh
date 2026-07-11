#!/usr/bin/env bash
# Publica clearchannel.tv en CLOUDFLARE PAGES (proyecto 'clearchannel-tv').
# git push = backup; el origen de producción es Cloudflare Pages. Uso: ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
echo "→ GitHub (push de código, backup)…"
git push origin main 2>&1 | tail -1 || echo "  (nada que pushear)"
echo "→ Cloudflare Pages…"
export CLOUDFLARE_API_TOKEN="$(bash ~/Claude/admira-vault/vault-get.sh CLOUDFLARE_API_TOKEN)"
TMP="$(mktemp -d)"; git archive main | tar -x -C "$TMP"
npx --yes wrangler@latest pages deploy "$TMP" --project-name=clearchannel-tv --branch=main --commit-dirty=true
rm -rf "$TMP"
echo "✓ https://www.clearchannel.tv (Cloudflare Pages) · mirror https://clearchannel-tv.pages.dev"
