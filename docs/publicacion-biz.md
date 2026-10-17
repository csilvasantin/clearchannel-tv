# Publicación de admira.biz

Desde el 14-oct-2026, **cada merge en `main` publica admira.biz solo**. Lo hace GitHub Actions
(`.github/workflows/publicar-admira-biz.yml`) con el mismo `deploy-biz.sh` de siempre. Antes solo se
podía publicar desde el Mac Mini, y un cambio mergeado se quedaba sin salir hasta que alguien se acordaba.

## Qué hace

0. **Tests primero (17-oct-2026).** En cada PR contra `main` y en cada merge corre
   `node --test tests/*.test.mjs tests/*.test.cjs`. En un PR solo prueba. En un merge, si algún test
   falla, no se publica.
1. Al mergear en `main`, el flujo saca el repo con todo el historial (la revisión preservada de
   clearchannel.tv sale de git) y lanza `deploy-biz.sh`.
2. **Firma:** el agente que hizo el cambio (el autor del último commit del PR) · `GitHubActions`,
   por ejemplo `NeoMacStudio · GitHubActions`.
3. **Sello:** `v.DD.MM.AAAA.rN.HH:MM`, hora de Madrid. La `r` sube sobre la versión que hay en producción.
4. **Ritmo:** como mucho 4 publicaciones por hora. Si la última salió hace menos de 15 minutos,
   espera. Si mientras tanto entra otro merge, publica solo el último.
5. **Comprobación:** al final verifica que `admira.biz/version.json` sirve el commit publicado.
6. **Consola (17-oct-2026):** después, `tools/consola-produccion.mjs` abre en un Chrome sin ventana
   la portada, el backoffice, Bugito y el plano, y si alguna tiene errores de consola el flujo sale
   en rojo. No despublica: se arregla con otro merge o se vuelve a la versión anterior. El ruido de
   Google sin sesión (FedCM) no cuenta; `--estricto` lo cuenta también. A mano, desde un Mac con Chrome:
   `node tools/consola-produccion.mjs`.

## Qué necesita

En el repo, dos secretos de GitHub Actions, los mismos que ya usan admira-store y pixeria:

- `CLOUDFLARE_API_TOKEN`, con permiso para editar Cloudflare Pages.
- `CLOUDFLARE_ACCOUNT_ID`.

Sin ellos, el flujo falla en el paso «Publicar» y lo dice.

## A mano

Sigue valiendo desde cualquier Mac con el vault (incluye el guarda de rama y el `git push`):

```bash
ADMIRA_RELEASE_AGENT=MorfeoMacMini ADMIRA_RELEASE_MACHINE=MacMini ./deploy-biz.sh
```

También se puede relanzar el flujo desde la pestaña Actions de GitHub («Run workflow»).
