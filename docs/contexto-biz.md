# Contexto común en admira.biz / Shared context in admira.biz

Encargo #5977 · admira.biz sobre el código común. Revisión en borrador para Walt. Plazo: 15 de octubre de 2026, 14:00 Europe/Madrid. Sin merge ni despliegue; la preview se ejecuta sólo en loopback.

## Español

`/marca <id>` cambia colores, logo y tipografía. Conserva el proyecto. `/marca off` restaura el aspecto de Admira. `/marca <web>` abre el analizador. `/proyecto <id>` cambia exclusivamente el filtro del mapa y de las lecturas de pantallas; conserva la marca. `/proyecto off` retira el filtro. `/marca` y `/proyecto` consultan el contexto. Las órdenes se ejecutan desde el CLI Experto existente, con historial y autocompletado.

Los módulos de `shared/admira-design/` son copias exactas del PR [admira-design · módulos comunes de marca y proyecto](https://github.com/csilvasantin/admira-design/pull/1), fijadas en `provenance.json`. El adaptador de Biz conserva el chrome, carga el contexto antes del filtro y entrega `/ctx` y `/signage/screens` a la API del PR [pixer-worker · contexto por sesión](https://github.com/csilvasantin/pixer-worker/pull/22). Las copias del handler y verificador en `tests/fixtures/pixer-context/` son exclusivamente para pruebas y preview local, fijadas a `be5a51e7a438f1ebc99d85bdd8c0aa5e45c262b1` · contexto de sesión rebasado y validado.

La credencial Google ya utilizada por el backoffice se intercambia mediante `POST /api/context-session`, con Authorization Bearer y comprobación de origen. El servidor verifica Google, audiencia, emisor, caducidad, email verificado y acceso existente. Emite una identidad firmada durante un máximo de cinco minutos, limitada también por la caducidad Google. No emite un rol. El servidor de la API consulta su whitelist en cada cambio y lectura filtrada. Un usuario normal no puede seleccionar **ni quitar** un proyecto. Ningún email guardado, `pixeria:admin`, bandera o rol local concede permisos.

Prerequisito de una futura release: configurar `PIXERIA_SIGNING_KEY` en el servidor de Biz mediante la bóveda y el flujo aprobado, con el mismo firmante que reconoce pixer-worker. No se ha consultado, copiado ni provisionado esa clave durante este encargo. Sin ella, el intercambio devuelve 503 y los proyectos no se activan. No confundir el permiso de catálogo del backoffice con superusuario de proyecto. Los PR de dependencia continúan en borrador; no se presume que `/ctx` esté disponible en producción.

Starbucks usa sólo el prefijo exacto `alsea-sbux-` del locationId; México, nombres, marcas visuales y tags contradictorios no amplían el filtro. Otros proyectos requieren `projects[]` explícitos. Los catálogos públicos sin filtro conservan su acceso; esto no convierte el mapa público en un inventario privado. Un proyecto desconocido muestra cero puntos, sin fallback a todos. Mientras se restaura la sesión o si se rechaza un proyecto solicitado, el mapa no publica una vista sin validar. Las respuestas antiguas de pantallas no sobrescriben un contexto nuevo. Un rechazo 401/403 invalida la vista y la señal de pantallas.

Los enlaces entre las cinco soluciones conservan ruta, idioma, IDs y parámetros funcionales; sólo añaden marca/proyecto validados. El parámetro funcional `project` de otras integraciones no se convierte en permiso de `/proyecto`.

### Tutorial para Walt

1. Ejecuta `node preview/server.mjs` y abre `http://127.0.0.1:5977/preview/`.
2. Selecciona **Superusuario de fixture**, ejecuta `/proyecto starbucks` y luego `/marca lumbre`.
3. Comprueba dos pantallas Starbucks, proyecto conservado, logo/colores Lumbre y enlaces con ambos campos.
4. Ejecuta `/proyecto off`: conserva Lumbre. Cambia a **Usuario normal de fixture** y prueba seleccionar o quitar el proyecto: ambos deben rechazarse con 403.
5. Abre **Mapa Biz** para comprobar la integración de la portada. Los fixtures son sintéticos, no inventario real ni prueba de playback. La preview no tiene secretos, D1, cron ni proveedores de producción y deshabilita sus mutaciones.

## English

`/brand <id>` changes colours, logo and typography while retaining the project. `/brand off` restores Admira. `/brand <website>` opens the analyser. `/project <id>` changes the map and screen-read filter while retaining the brand; `/project off` clears it. Commands without arguments show context. The existing Expert CLI, history and completion remain in place.

Shared design modules are unmodified upstream copies pinned in `provenance.json`. Biz initializes shared context before segmentation and uses the pixer-worker draft API for `/ctx` and scoped screen reads. The API handler under test fixtures is pinned to the rebased API draft and is never a production entrypoint.

`POST /api/context-session` verifies the existing Google credential on the server and returns a signed identity, valid for up to five minutes and never beyond Google's expiry. It grants no role. The API rechecks its canonical whitelist on every project change and filtered read. Normal users cannot select or clear a project; local flags, stored emails and local admin settings grant nothing. A future authorized release requires approved provisioning of `PIXERIA_SIGNING_KEY`, recognized by the API. No secret was fetched or provisioned here. Missing signing configuration returns 503. Both upstream dependencies remain drafts; production availability is not assumed.

Starbucks requires the exact `alsea-sbux-` location prefix. Mexico, names, visual branding and conflicting tags do not extend it. Other projects require explicit `projects[]`. Unknown projects return no locations. Public unfiltered catalogues remain public. Pending or denied scope cannot produce an unverified map view; stale screen responses cannot overwrite a newer context. Unauthorized reads invalidate the view. Links retain routes, language, functional parameters and IDs, adding only validated context. A legacy functional `project` parameter does not grant `/project` access.

For review, run `node preview/server.mjs`, open `http://127.0.0.1:5977/preview/`, choose the server-side superuser fixture, run `/project starbucks` then `/brand lumbre`, and verify two matching synthetic screens and independent context fields. Clear the project and retain the brand. Switch to the normal-user fixture and verify 403 on both select and clear. Open **Biz map** to review homepage integration. The local sandbox has synthetic identities, random runtime signing, in-memory context and no production mutation bindings. No merge or deployment is authorized by this PR.
