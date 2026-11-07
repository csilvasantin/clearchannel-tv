# Tema «netflix»: intro de PortAventura NeXT

Encargo **«2026-11-07 · admira.biz · PortAventuraNext intro»** (Carlos, 7-nov-2026). Vertical admira.biz (Morfeo).

La portada de admira.biz rebrandeada con el look de Netflix (negro y rojo) para servir de intro de
`portaventuranext.com/intro`: el logo **PORTAVENTURA NEXT** entra a golpes con un «ta-dum» y después llega la
vuelta al mundo de admira.biz —la misma bola satélite girando— con **una sola opción: viajar a PortAventura**.

## Cómo se activa

| Cómo | Efecto |
|---|---|
| ⌘ Experto → `/brand netflix` (o `/marca netflix`) | Monta el tema sin recargar. Con el Enter de la orden como gesto, la intro suena al instante. |
| `?marca=netflix` en la URL | Igual al abrir la página. Sin gesto previo sale antes «Pulsa para empezar» (los navegadores no dejan sonar audio sin un gesto). |

Se recuerda en la pestaña (`sessionStorage` `mb:marca`), como cualquier marca blanca. `/brand` es alias de `/marca`.

## Vuelta atrás

- **En la página**: `/brand off` (o `/marca off`), o `?marca=off` en la URL. Se deshace en el sitio: se quitan los nodos
  `#nfx-*`, el pin, la hoja y el atributo `data-netflix`; vuelven a verse las capas del mapa con su visibilidad de serie;
  el encuadre (padding), el zoom, la inclinación, el giro, el título y el `theme-color` vuelven a los de serie; se cierra
  el audio y se olvida la marca de la pestaña.
- **Sin activar no cambia nada**: `index.html` no carga el tema; `marca-blanca.js` solo descarga `marca-netflix.js` y
  `marca-netflix.css` al activarlo. Una visita normal no pide ni un byte más.
- **Apagado de emergencia en código**: quitar la entrada `netflix` de `LOCALES` en `marca-blanca.js` (una línea). Desde
  ese momento `/brand netflix` contesta que la marca no está en el catálogo y no se aplica nada.
- **Revertir el cambio entero**: `git revert` del commit del encargo. Toca solo los ficheros de la tabla de abajo.

## Qué hace

1. **Golpe del logo**: negro, «PORTAVENTURA» en rojo con las letras más altas en los extremos (rótulo sobre pantalla
   curva) entra con el primer golpe; «NEXT» con el segundo, con sacudida y destello rojo; luego el logo se atraviesa
   con cintas de luz rojas y se funde con la bola. Botón «Saltar intro» (y Esc).
2. **Sonido**: «ta-dum» **sintetizado con Web Audio** (dos golpes graves con caída de tono, un acorde que se abre y
   reverberación generada). No usa ninguna grabación ni logotipo ajeno. Botón 🔊/🔇 en la cabecera.
3. **La vuelta al mundo**: la bola satélite de admira.biz (mismo mapa, mismo giro) sobre cielo negro con halo rojo,
   desplazada a la derecha (arriba en móvil) para dejar sitio al cartel. Se esconden todas las capas del mapa que no
   son la imagen satélite (clusters, puntos, rutas…) y lo de serie que no pinta aquí (buscador, ticker, controles,
   espacio y planetas, Iniciar sesión). Queda un único pin: PortAventura, que se oculta cuando gira detrás de la bola.
4. **Cartel**: «La vuelta al mundo» y un solo botón, **Viajar a PortAventura** (también el pin). Vuelo `flyTo` de ~8 s
   con la cuenta atrás de kilómetros; al llegar, órbita lenta sobre el parque y cartel «PortAventura World» con
   **Entrar** (`https://www.portaventuranext.com/`) y **Otra vuelta** (vuelve a la bola).

Idioma: castellano e inglés según la página; cambia en vivo. Ojo: el motor común del ⌘ pone la interfaz en el idioma
del verbo, así que `/brand netflix` la deja en inglés y `/marca netflix` en castellano.

`prefers-reduced-motion`: sin sacudida, sin cintas, sin órbita y vuelos cortos.

## Ficheros

| Fichero | Papel |
|---|---|
| `marca-netflix.js` | El tema (`window.MarcaNetflix`: `activar`, `desactivar`, `viajar`, `otraVuelta`, `saltar`, `estado`). Funciones puras probadas en `tests/marca-netflix.test.cjs`. |
| `marca-netflix.css` | Todo bajo `html[data-netflix]` o `#nfx-*`/`.nfx-*` (lo comprueba el test). |
| `marca-blanca.js` | Registro `LOCALES` de temas locales (hoy solo `netflix`): se activan y se quitan como una marca blanca, pero no pasan por el catálogo de admiranext.com. |
| `expert-commands.js` | `/marca`/`/brand` lista y completa `netflix` aunque llegue el catálogo; respuesta propia del tema. |
| `cliente-segmento.js` | `netflix` no es un cliente: no segmenta el globo ni mueve la cámara. |
| `server/biz-assets.mjs` | Los dos ficheros nuevos entran en el paquete de admira.biz. |
| `index.html`, `_headers` | Sellos `?v=20261107-netflix-1` y caché `max-age=0` de los ficheros nuevos. |

## Publicación

**Publicado en admira.biz el 7-nov-2026 con el OK de Carlos.** Cada merge en `main` publica admira.biz solo
(`docs/publicacion-biz.md`); por eso la rama esperó a su autorización. Enlace directo:
`https://www.admira.biz/?marca=netflix` (y `?marca=off` para volver).

Para que `portaventuranext.com/intro` la enseñe hace falta además una ruta en el worker de PortAventuraNext (lo publica
Oráculo con Sites de Codex) que lleve a `https://www.admira.biz/?marca=netflix` (redirección o marco a pantalla
completa). Se le pide a Oráculo por encargo MCP, como manda la Cúpula §21. Ojo con la regla de Neo de ese sitio: todo lo
de PortAventura, solo en la zona protegida (DMZ).
