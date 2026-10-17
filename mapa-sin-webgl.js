// Portada sin WebGL (Morfeo, 17-oct-2026). `new maplibregl.Map()` lanza si el navegador no tiene WebGL
// (GPU bloqueada, equipo viejo, Chrome sin ventana) o si maplibre-gl no llegó del CDN. Como app.js es un
// script clásico, la excepción paraba todo lo que viene detrás (paneles ☰ ▤ ⌘, Experto, listas) y luego
// saltaba «Cannot access 'map' before initialization». ccCrearMapa() crea el mapa de verdad y, si no
// puede, devuelve un mapa mudo: acepta cualquier llamada sin hacer nada, así que el resto de la portada
// sigue en pie. Sobre el vídeo de la bola (intro.js lo deja puesto porque nunca llega cc:globe-ready)
// sale un aviso.
(function (root) {
  'use strict';

  const TEXTO = {
    es: 'Tu navegador no tiene WebGL: el mapa 3D no se puede mostrar. El resto de la portada funciona.',
    en: 'Your browser has no WebGL: the 3D map cannot be shown. The rest of the page works.',
  };

  // Lo que se lee del mapa como valor; todo lo demás devuelve el propio mapa mudo (encadenable).
  function valores(opciones, contenedor, lienzo) {
    const centro = Array.isArray(opciones.center) ? opciones.center : [0, 0];
    return {
      getZoom: () => opciones.zoom || 0, getPitch: () => opciones.pitch || 0, getBearing: () => 0,
      getCenter: () => ({ lng: centro[0], lat: centro[1] }),
      getBounds: () => null, getStyle: () => ({ version: 8, sources: {}, layers: [] }),
      getSource: () => undefined, getLayer: () => undefined, getImage: () => undefined, hasImage: () => false,
      queryRenderedFeatures: () => [], querySourceFeatures: () => [],
      project: () => ({ x: 0, y: 0 }), unproject: () => ({ lng: centro[0], lat: centro[1] }),
      isStyleLoaded: () => false, loaded: () => false, areTilesLoaded: () => false,
      isMoving: () => false, isZooming: () => false, isRotating: () => false,
      getCanvas: () => lienzo, getCanvasContainer: () => contenedor, getContainer: () => contenedor,
    };
  }

  function mapaMudo(opciones, contenedor, lienzo) {
    const fijos = valores(opciones, contenedor, lienzo);
    let mudo;
    const nada = function () { return mudo; };
    mudo = new Proxy(nada, {
      get(_, k) {
        if (k === 'sinWebGL') return true;
        if (k === 'then') return undefined; // que `await map` no se quede colgado
        if (k === Symbol.toPrimitive) return () => 0;
        if (k === Symbol.iterator) return function* () {};
        if (k === 'toJSON') return () => null;
        if (Object.prototype.hasOwnProperty.call(fijos, k)) return fijos[k];
        return mudo;
      },
      set() { return true; },
      apply() { return mudo; },
    });
    return mudo;
  }

  function avisar(contenedor, idioma) {
    if (!contenedor || !contenedor.ownerDocument) return;
    const doc = contenedor.ownerDocument;
    const aviso = doc.createElement('div');
    aviso.className = 'map-sin-webgl';
    aviso.setAttribute('role', 'status');
    aviso.textContent = TEXTO[idioma === 'en' ? 'en' : 'es'];
    aviso.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:5;max-width:min(560px,calc(100% - 32px));'
      + 'padding:10px 14px;border-radius:10px;background:rgba(10,14,22,.86);color:#e8eef7;font:500 14px/1.4 Inter,system-ui,sans-serif;'
      + 'text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35);pointer-events:none';
    (doc.body || contenedor).appendChild(aviso);
  }

  function ccCrearMapa(opciones, entorno) {
    const env = entorno || {};
    const doc = env.document || root.document;
    const maplibre = 'maplibregl' in env ? env.maplibregl : root.maplibregl;
    const idioma = env.idioma || (doc && doc.documentElement && doc.documentElement.lang) || 'es';
    let motivo;
    try {
      if (!maplibre || typeof maplibre.Map !== 'function') throw new Error('maplibre-gl no se ha cargado');
      return new maplibre.Map(opciones);
    } catch (e) {
      motivo = e;
    }
    const contenedor = doc && (typeof opciones.container === 'string' ? doc.getElementById(opciones.container) : opciones.container);
    const lienzo = doc ? doc.createElement('canvas') : null;
    if (doc && doc.documentElement) {
      doc.documentElement.dataset.mapa = 'sin-webgl';
      // El porqué, para diagnosticar desde el DOM (p. ej. «Failed to initialize WebGL»).
      doc.documentElement.dataset.mapaMotivo = String((motivo && motivo.message) || motivo).slice(0, 120);
    }
    avisar(contenedor, idioma);
    if (root.console) root.console.warn('[admira.biz] mapa sin WebGL, la portada sigue sin mapa:', motivo && motivo.message ? motivo.message.slice(0, 160) : motivo);
    return mapaMudo(opciones, contenedor, lienzo);
  }

  root.ccCrearMapa = ccCrearMapa;
  if (typeof module !== 'undefined' && module.exports) module.exports = { ccCrearMapa, mapaMudo, TEXTO };
})(typeof window !== 'undefined' ? window : globalThis);
