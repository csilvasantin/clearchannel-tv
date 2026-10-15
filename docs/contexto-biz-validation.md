# Validación / Validation · encargo #5977 · admira.biz sobre el código común

Fecha: 14 de octubre de 2026. Identidad: OraculoMacMini. Base `bbba105` · novedades del Arquitecto en admira.biz. Preview local, HTTP 200: http://127.0.0.1:5977/preview/.

## Español

- **61 pruebas relevantes correctas**: módulos comunes, sesión Google, firma compatible con el verificador real de la API, cambios independientes, autorización select/reset, revocación, filtro estricto, enlaces, CLI, build de release y aislamiento de dominios. Comando reproducible:

```sh
node --test tests/biz-context.test.cjs tests/biz-context-session.test.mjs tests/expert-commands.test.cjs tests/marca-blanca.test.cjs tests/biz-assets.test.mjs tests/cliente-segmento.test.cjs tests/native-demo-context.test.cjs tests/demo-session.test.mjs
```

- La suite completa registra **281 pruebas correctas y 7 fallos**. Los siete fallos están también en la base limpia, comprobada en un clon separado. La base presenta 270 correctas y 8 fallos; se actualizó el test del antiguo cargador de marca para la integración común. Los fallos restantes: expectativa antigua de routing en brand-worker, tres expectativas de versión/carga en navegación y shell, inventario de páginas sin shell, expectativa anterior de CLI oculto y URL antigua del gemelo de Paseo de Gracia 103. No se declara la suite completa verde.
- Navegador headless: la sandbox ejecuta el handler exacto del PR API y su verificador, con firmante aleatorio local y whitelist de fixture. `/proyecto starbucks` + `/marca lumbre`: HTTP 200, dos pantallas sintéticas con prefijo exacto, sin México. Logo Lumbre visible y contexto conservado en enlaces; la ruta, `screen`, idioma y hash permanecen. `/proyecto off` conserva Lumbre.
- Cuenta normal: tanto seleccionar como quitar proyecto devuelve rechazo de servidor. Pruebas de rol revocado: lecturas filtradas HTTP 403. Sin firmante: HTTP 503. Credencial inválida/caducada o audiencia errónea: HTTP 401. Sin sesión no se activa proyecto.
- Portada real en sandbox: 100 ubicaciones del catálogo público `alsea-sbux-*` de 9133, y dos pantallas conectadas **de fixture**. No son dos ubicaciones reales ni prueba de playback. El CLI existente ejecuta `/brand brumelle` y `/project off`, conserva BRUMELLE y vuelve a la vista general. Cero excepciones JavaScript en la preview y la portada; screenshots revisadas localmente.
- `git diff --check` y sintaxis correctos. El test de build confirma los ficheros de Biz en su namespace y mantiene la base de los otros dominios. El servidor de preview sólo escucha en loopback, rechaza mutaciones de producción y no sale hacia Google/whitelist reales: ambos son fixtures en memoria.

Para repetir la prueba de navegador con Playwright disponible:

```sh
node preview/server.mjs
# En otro terminal, con playwright resoluble o BIZ_PLAYWRIGHT_MODULE apuntando al módulo:
node preview/verify.cjs
```

La comprobación de marcas lee el catálogo público de admiranext.com. Las capturas y el informe de navegador se guardan en un directorio temporal anunciado al terminar. Ninguna credencial se guarda en el informe.

Límites de entrega: dependencias en borrador, sin merge ni despliegue. No se ha provisionado `PIXERIA_SIGNING_KEY`; la futura sesión humana requiere la orden de Carlos y el firmante aprobado compatible con la API. No se ha verificado inventario real ni emisión física. Para revisar desde otro ordenador, Walt debe obtener esta rama y ejecutar la preview local; no existe una URL de preview alojada de este encargo.

## English

61 relevant tests pass. The full suite reports 281 passing tests and 7 failures, all reproduced on the clean base; its previous brand-loader assertion was updated for shared integration. The remaining baseline failures concern old routing, version pins, page inventory, hidden CLI and twin URL expectations. The full suite is not claimed green.

Headless review confirms Lumbre branding with Starbucks retained, two strictly matching synthetic API screens, context-carrying links that preserve functional parameters, brand retained after project reset, and server rejection for a normal user on both select and clear. The actual Biz homepage filters 100 public prefix-matching locations out of 9133; its two connected screens are sandbox fixtures, not real playback evidence. The existing homepage CLI successfully runs the English brand and project commands, preserving BRUMELLE after project reset. No JavaScript exceptions were observed. Release-build tests preserve the other domains. Missing signing configuration returns 503; invalid sessions return 401; revoked or normal-user scoped operations return 403.

The preview is loopback-only, reproducible with `node preview/server.mjs`; browser checks use `node preview/verify.cjs` with Playwright installed or BIZ_PLAYWRIGHT_MODULE supplied. No hosting, merge, secret provisioning or production deployment occurred. Human-session production verification remains contingent on Carlos's direct authorization, compatible signing configuration and the draft upstream dependencies. Walt can clone this branch and run the local preview on another machine.
