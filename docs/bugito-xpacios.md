# Bugito en Xpacios / Bugito in Xpaces

En https://www.admira.biz/bugito entra con tu cuenta de owner. Selecciona proyecto, establecimiento y pantalla/TPV, o escribe:

`/bugito genera una incidencia de popup en el proyecto Starbucks en el establecimiento alsea-sbux-021 y en la pantalla 1`

`/bugito genera una incidencia grave en el proyecto Starbucks en el establecimiento alsea-sbux-021 y en la pantalla 2`

English:

`/bugito create an incident in project Starbucks in store alsea-sbux-021 and on screen 1`

`/bugito create an incident critical in project Starbucks in store alsea-sbux-021 and on screen 2`

El verbo funciona en el Experto del mapa y en Bugito. Los nombres deben coincidir de forma única con el catálogo; se pueden usar identificadores. Un nombre ambiguo o fuera del proyecto no crea ninguna incidencia. La normal es amarilla; grave y total son rojas. / The verb works in the map Expert console and Bugito. Names must uniquely match the catalogue; identifiers are accepted. Ambiguous or out-of-project names never create incidents. Normal is yellow; severe and total are red.

Las incidencias son tickets canónicos de prueba, marcados PRUEBA BUGITO. Quedan abiertos para asignación, intervención y cierre en admira.app, aunque termine el banco virtual o se normalice el contenido. Repetir la misma orden reutiliza el ticket activo para el mismo destino, tipo y gravedad. Esta orden registra una prueba lógica: no prueba ni ejecuta una avería física. La inyección física conserva su autorización, nonce y comprobación del equipo. / These are canonical test tickets labelled PRUEBA BUGITO. They stay open for assignment, intervention and closure in admira.app even if the virtual bench ends or the content recovers. Repeating the same order reuses the active ticket for the same destination, type and severity. This command records a logical test: it does not prove or execute a physical fault. Hardware injection keeps its own authorization, nonce and device checks.

El mapa usa los tickets INC activos por identificador de establecimiento: verde sin incidencias, amarillo con normales/leves y rojo con al menos una alta/urgente. Las agrupaciones conservan la gravedad máxima. Recuperada sigue activa hasta su cierre. Se refresca cada quince segundos; un fallo de lectura conserva el último estado, con aviso, y el primer estado no disponible es gris. Las misiones, canceladas y cerradas quedan fuera. La lectura pública solo contiene totales, sin títulos, personas ni identificadores de tickets. / The map uses active INC tickets grouped by establishment ID: green with no incidents, yellow with normal/low incidents and red with at least one high/urgent incident. Clusters retain maximum severity. Recovered incidents remain active until closure. Refresh is every fifteen seconds; failed reads retain the last state with a warning, and the first unavailable state is grey. Missions, cancelled and closed tickets are excluded. Public reads expose totals only, without subjects, people or ticket identifiers.

`GET /api/bugito/targets` devuelve proyectos; `?project=…` devuelve establecimientos, y `&location=…` pantallas. `POST /api/bugito/incidents` acepta `{order}` o `{project,location,screen,severity,fault}`. Verifica el ID token de Google y el rol owner en servidor; las verificaciones de flota usan el login oficial de agentes. No acepta un rol local del navegador. / The targets endpoint lists projects, establishments and screens. The incident endpoint accepts a complete order or structured fields and verifies Google identity and owner permissions server-side. Fleet verification uses the official agent login; browser-local roles grant no access.
