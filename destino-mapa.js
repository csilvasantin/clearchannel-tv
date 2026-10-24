/* destino-mapa.js — El Xpacio destino parpadea en el mapa (FLT-102668 · encargo #7151, 24-oct-2026).
 * Carlos: «haz que la pantalla destino (en este caso era CanalKiosk Gràcia) parpadee para que sepas cuál es
 * rápidamente». Eligió «El punto en el mapa». CanalKiosk Gràcia está a ~200 m del MUPI «gracia» y al aterrizar no se
 * sabía cuál de los dos puntos era el destino.
 *  · Al volar o saltar a un Xpacio (buscador, enlace ?loc=, clic en un punto o en una tarjeta de previo), su punto
 *    late unos 5 s con un anillo de alto contraste que se agranda y parpadea; después queda un anillo fijo y discreto
 *    mientras su ficha siga abierta. Al cerrar la ficha o pasar a otro Xpacio, se quita.
 *  · En los tours (Tour DooH, recorrido de la red), sólo el anillo fijo: van de punto en punto y no hace falta buscar.
 *  · Con «reducir movimiento» (prefers-reduced-motion), anillo fijo sin latido.
 *  · Es un marcador HTML de MapLibre, no una capa: no depende de la fuente `locs` ni de sus filtros, sobrevive a los
 *    cambios de estilo y, a zoom bajo, el anillo queda sobre el grupo (cluster) que contiene el punto, sin fallar.
 *    No usa la capa selected-ring (#78f3ff, la selección del planificador): el destino es blanco y magenta.
 *  · Sin bucles: el latido es una animación CSS de 5 vueltas y un temporizador lo pasa a fijo; no hay
 *    requestAnimationFrame ni nada que corra con el zoom alejado.
 * Mismo patrón que previo.js: window.AdmiraDestinoMapa en el navegador y require() en node:test. */
(function (root) {
  'use strict';
  const PARPADEO_MS = 5000;     // 5 latidos de 1 s (la animación CSS dura lo mismo: destinoLatido 1s × 5)

  // ── Estado (funciones puras) ──
  // {id, coords, parpadeo, reducido, volando, llegada}: parpadeo = este destino quiere latir (no en tours ni con
  // movimiento reducido); llegada = cuándo aterrizó la cámara (el latido empieza ahí, no al despegar).
  function marcar(_previo, loc, { parpadeo = true, reducido = false } = {}) {
    if (!loc || loc.id == null || !Array.isArray(loc.coords) || loc.coords.length < 2 || !loc.coords.every(Number.isFinite)) return null;
    return { id: String(loc.id), coords: [loc.coords[0], loc.coords[1]], parpadeo: !!parpadeo && !reducido, reducido: !!reducido, volando: true, llegada: null };
  }
  // La cámara llegó (o la ficha se abrió en el destino): empieza el latido. Una sola vez por destino.
  function llegar(estado, id, ahora) {
    if (!estado || estado.id !== String(id)) return estado;
    if (estado.llegada != null) return estado.volando ? Object.assign({}, estado, { volando: false }) : estado;
    return Object.assign({}, estado, { volando: false, llegada: ahora });
  }
  // 'ninguno' · 'parpadeo' (los PARPADEO_MS tras llegar) · 'estable' (en camino, después del latido, en tours o
  // con movimiento reducido).
  function fase(estado, ahora) {
    if (!estado) return 'ninguno';
    if (!estado.parpadeo || estado.llegada == null) return 'estable';
    return ahora - estado.llegada < PARPADEO_MS ? 'parpadeo' : 'estable';
  }
  // Cuánto falta para pasar de latir a fijo (0 si ya no late).
  function msHastaEstable(estado, ahora) {
    return fase(estado, ahora) === 'parpadeo' ? Math.max(0, PARPADEO_MS - (ahora - estado.llegada)) : 0;
  }
  // ¿Se quita? Sí al cerrar su ficha (salvo en pleno vuelo hacia él) o al abrirse la de otro Xpacio.
  function debeQuitarse(estado, { fichaAbierta, activa }) {
    if (!estado) return false;
    if (estado.volando) return false;
    if (!fichaAbierta) return true;
    return activa != null && String(activa) !== estado.id;
  }

  // ── El marcador ──
  // deps: map, maplibregl, document, reducido() (prefers-reduced-motion), ahora().
  function crear(deps) {
    const d = Object.assign({ document: root.document, ahora: () => Date.now(), reducido: () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } } }, deps || {});
    let estado = null, marker = null, el = null, timer = 0;
    function pintar() {
      clearTimeout(timer); timer = 0;
      const f = fase(estado, d.ahora());
      if (f === 'ninguno') { if (marker) { try { marker.remove(); } catch (_) {} } marker = null; el = null; return; }
      if (!marker) {
        if (!d.maplibregl || typeof d.maplibregl.Marker !== 'function' || !d.document) return;
        el = d.document.createElement('div');
        el.className = 'destino-mapa';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<i class="destino-onda"></i><i class="destino-anillo"></i>';
        marker = new d.maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(estado.coords).addTo(d.map);
      } else marker.setLngLat(estado.coords);
      el.dataset.destino = estado.id;
      el.classList.toggle('reducido', !!estado.reducido);
      if (f === 'parpadeo') {
        // Volver a poner la clase reinicia la animación CSS (otro aterrizaje en el mismo punto).
        el.classList.remove('parpadeo', 'estable');
        void el.offsetWidth;
        el.classList.add('parpadeo');
        timer = setTimeout(pintar, msHastaEstable(estado, d.ahora()) + 20);
      } else { el.classList.remove('parpadeo'); el.classList.add('estable'); }
    }
    return {
      marcar(loc, opciones = {}) { estado = marcar(estado, loc, Object.assign({ reducido: d.reducido() }, opciones)); pintar(); return !!estado; },
      llegar(id) { const antes = estado; estado = llegar(estado, id, d.ahora()); if (estado !== antes) pintar(); },
      quitar() { estado = null; pintar(); },
      // Llamar al cambiar la ficha (abrir, cerrar, otro Xpacio): quita el destino si ya no toca.
      revisar(ficha) { if (debeQuitarse(estado, ficha)) { estado = null; pintar(); } },
      refrescar: pintar,
      id: () => estado ? estado.id : null,
      volando: () => !!(estado && estado.volando),
      estado: () => ({ id: estado ? estado.id : null, fase: fase(estado, d.ahora()), volando: !!(estado && estado.volando), reducido: !!(estado && estado.reducido), marcador: !!marker }),
    };
  }

  const api = { PARPADEO_MS, marcar, llegar, fase, msHastaEstable, debeQuitarse, crear };
  root.AdmiraDestinoMapa = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
