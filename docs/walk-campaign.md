# Walk the campaign / Recorre tu campaña

Entrega 05/09/2026 · TrinityMBP14 · MacBookProNegro14.
Misión Yokup **0542**, `DCL-155a7f1270945df8b606870f`.

## Resultado

Cada superficie de la ficha del mapa dispone de **Preview campaign / Previsualizar campaña**. Abre `walk.html` con la ubicación y superficie exactas. El anunciante nombra la campaña, elige una pieza de la biblioteca visual compartida de Pixeria, cambia de pantalla, prueba perspectiva e iluminación y vuelve a la red. Cada superficie conserva su propia creatividad al cambiar, recargar o volver desde el mapa, dentro de la misma pestaña.

La composición es una **ubicación ilustrativa**, identificada expresamente como tal; muestra la pieza real con sus proporciones conservadas. La dimensión procede de la ficha de la pantalla cuando está disponible; de lo contrario se etiqueta como formato de prueba. Un gemelo registrado se abre en otra pestaña mediante su URL exacta. Esta entrega no proyecta automáticamente la creatividad dentro del gemelo ni envía contenido a dispositivos.

Inglés en Clear Channel y castellano por defecto en una sesión nueva de Admira App. Se respeta el idioma elegido. La vista conecta Pixeria/XpaceOS en inglés y Admira Studio/Admira Store en castellano. El estudio se abre en otra pestaña: al terminar se refresca la biblioteca compartida o se pega la URL publicada de la pieza. No se presupone un retorno autenticado del editor.

## Datos y continuidad

- `walk-core.mjs`: contrato puro de idioma, URLs HTTPS, identidad de superficies, formato, normalización de assets y restauración de campañas.
- `walk-launch.mjs`: recoge la superficie exacta del mapa y entrega una instantánea mínima de la ubicación. Esto conserva las identidades de pantallas enriquecidas localmente por el mapa que pueden faltar en el catálogo base del servidor.
- `walk.mjs`: usa `GET https://api.admira.store/stock/list?limit=160`; solo imágenes y vídeos, sin escrituras a campañas, pagos o signage. La biblioteca informa de errores y permite reintentar.
- Campaña y asignaciones en `sessionStorage`, separadas por `campaignId` y por `[locationId, surfaceId]`. La instantánea se etiqueta como selección guardada; se actualiza entrando nuevamente desde el mapa. No se presenta como disponibilidad en tiempo real.
- La URL de regreso conserva idioma, ubicación y campaña. La URL por sí sola no comparte creatividades con otro navegador; para ello haría falta persistencia autenticada en servidor.
- La falta de almacenamiento, espacio, superficie, gemelo, dimensiones, versión o archivo multimedia tiene estado explícito. No se inventan IDs de players, geometría medida, confirmaciones de pago ni recibos de reproducción.
- Solo URLs HTTPS sin credenciales; assets HTML/interactive no se ejecutan. Datos del catálogo y títulos se insertan como texto. Los enlaces externos usan `noopener noreferrer`.

## Verificación

- Seis pruebas del contrato: URLs no ejecutables; idioma por dominio; aislamiento entre espacios; restauración por campaña; dimensión desconocida explícita; conservación de IDs enriquecidos del mapa.
- Prueba existente de marca del Worker y comprobación de sintaxis de los módulos y `app.js`.
- Navegador: biblioteca real de Pixeria; una imagen real seleccionada y cargada; LED horizontal → vertical sin copiar la pieza; retorno a horizontal recupera su pieza; recarga conserva título y asignación; mapa → vista → mapa → vista conserva campaña y creatividad.
- Corrección encontrada en QA: el mapa tenía IDs físicos que el catálogo base no incluía. Se entrega la selección exacta; no se sustituye silenciosamente por otra pantalla.
- Revisión visual en escritorio y marco móvil de 390 px con tema Admira. Corrección de desbordamiento del estado vacío horizontal.
- Los formatos, la escena, los controles y estados del recorrido están traducidos. Los nombres/descripciones aportados por el catálogo se conservan tal como están registrados.

## Publicación y reversión

Núcleo único Cloudflare Pages `clearchannel-tv`, dominios `www.clearchannel.tv` y `www.admira.app`. Se publica desde una copia limpia de `main`, firmada por TrinityMBP14/MacBookProNegro14 mediante `deploy.sh`. La base previa de producción es `aa61a60`, versión `v.04.09.2026.r1.22:35`. El sello final y pruebas de producción se registran en el reporte de cierre Yokup.

Reversión: revertir el commit de esta entrega en `main`, verificar y ejecutar el despliegue normal con una nueva firma. No sobrescribir la rama principal ni el cambio local previo ajeno `b59b807`, que permanece en su clon original.
