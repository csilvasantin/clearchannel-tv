# Publicación de admira.biz

Desde el 14-oct-2026, **cada merge en `main` publica admira.biz solo**. Lo hace GitHub Actions
(`.github/workflows/publicar-admira-biz.yml`) con el mismo `deploy-biz.sh` de siempre. Antes solo se
podía publicar desde el Mac Mini, y un cambio mergeado se quedaba sin salir hasta que alguien se acordaba.

## Qué hace

0. **Tests primero (17-oct-2026).** En cada PR contra `main` y en cada merge corre `npm test`
   (ver [Tests](#tests)). En un PR solo prueba. En un merge, si algún test falla, no se publica.
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

## Tests

Antes de publicar o de revertir, se pasan así, desde la raíz del repo:

```bash
npm test
```

Es lo mismo que corre el flujo: `node --test tests/*.test.mjs tests/*.test.cjs`. No hay nada que
instalar.

**Da lo mismo en cualquier carpeta (18-oct-2026).** En el Mac Mini el repo vive bajo
`~/Documents/Admirito`, que tiene su propio `package.json` con `"type": "module"`. Sin uno en la raíz,
Node lo heredaba: los `.js` clásicos (`login-google.js`, `galaxy-shell.js`, `expert-panel.js`…) se
cargaban como ESM, y los `.cjs` que les hacen `require()` daban unos 128 fallos falsos. Fuera de esa
carpeta, o en CI, pasaba entero. Ese día hubo que repetir varias baterías en un worktree en `/tmp`.

El `package.json` de la raíz corta esa herencia. No lleva `"type"`, y es a propósito:

- Con `"type": "commonjs"`, Node ya no detecta la sintaxis y `_worker.js` (ESM) no carga: fallan 6
  ficheros de test.
- Con `"type": "module"`, vuelve el problema de los `.js` clásicos.
- Sin `"type"`, Node carga como CommonJS los `.js` clásicos y detecta que `_worker.js` y `avatar-ask.js`
  son ESM. Al hacerlo avisa con `MODULE_TYPELESS_PACKAGE_JSON`, y `npm test` calla ese aviso con
  `--disable-warning`. La detección necesita Node 22.7 o posterior; el flujo usa Node 22.

No se publica. El release de admira.biz parte de la revisión preservada de clearchannel.tv y copia una
lista cerrada de ficheros (`server/biz-assets.mjs`), que no lo incluye. Cloudflare Pages recibe un
paquete ya montado (*direct upload*), así que no hay build que cambie al verlo. Lo comprueba
`tests/publicar-biz.test.mjs`.

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
