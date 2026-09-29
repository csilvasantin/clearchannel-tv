

## Navegación responsive / Responsive navigation · admira.app

La cabecera de admira.app ya no incluye Contacto. En móvil (hasta 720 px), el buscador permanece visible y «Menú» reúne planificación, circuitos, target, solicitudes, modo avanzado, player, acceso e idioma. Pulsa Menú para abrir o cerrar; Escape lo cierra con teclado. En tableta y escritorio las opciones se distribuyen según el ancho. La ficha del punto y los selectores móviles se ajustan a la altura de la cabecera.

The admira.app header no longer includes Contact. On mobile (up to 720 px), search stays visible and “Menu” contains planning, circuits, target, requests, advanced mode, player, login and language. Toggle Menu to open or close it; Escape closes it from the keyboard. Tablet and desktop options wrap to fit the available width. Location profiles and mobile selectors adapt to the header height.

Help: https://admira.app/help/#responsive-navigation
Tutorial: https://admira.app/tutorial/#responsive-navigation

Implementación compartida admira.app/clearchannel.tv: responsive-shell.css y responsive-shell.js; ResizeObserver mide la cabecera y actualiza --app-header-height. Menú accesible con aria-expanded/aria-controls; no cambia el estado de selección ni el destino del Digital Twin. / Shared implementation: measured header height, accessible menu state, existing location selection and twin destination preserved.
