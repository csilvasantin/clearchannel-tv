# Retirar fallos desde el banco Bugito

En `bugito.html`, cada fallo tiene un botón de retirada al lado: Quitar giro, Quitar resolución, Quitar popup y Quitar apertura parcial. Cada botón envía al player de laboratorio escogido su orden `fault-<tipo> off` por el mismo adaptador del mando.

El acuse del player y los detectores siguen visibles. La interfaz conserva la incidencia y el estado del vigilante; sólo la recuperación medida por el player permite que el vigilante cierre la incidencia en Yokup. Los otros fallos permanecen activos. El botón Volver a la normalidad conserva la retirada global.

Los controles se traducen a inglés y permanecen utilizables con teclado o pantalla táctil. La salvaguarda de la orden sigue exigiendo una pantalla virtual de laboratorio.

Validación: `node --test tests/bugito-retirada.test.mjs tests/bugito.test.mjs tests/incidencias*.test.mjs tests/biz-assets.test.mjs tests/publicar-biz.test.mjs`. El ensayo de interfaz ejecuta los cuatro manejadores reales, comprueba un único envío por clic, el destino seleccionado, la preservación de las incidencias y el rechazo de pantallas reales.
