/* Visión general de un circuito (Carlos, 15-oct-2026 · FLT-102501): «/vision general alsea».
 * Alsea México entero visto desde arriba, cada Xpacio con su semáforo:
 *   verde    · todas sus pantallas en línea y sin incidencias
 *   amarillo · alguna incidencia o alguna pantalla sin conexión
 *   rojo     · todas sus pantallas apagadas
 *   gris     · sin datos: ninguna pantalla con telemetría (el catálogo no prueba una conexión)
 * Si ningún Xpacio del circuito tiene un solo dato real, la vista usa estados de DEMO fijos
 * (siempre los mismos para cada tienda) y lo dice en la leyenda: nunca se presentan como reales.
 * Las funciones de datos son puras (tests/vision-general.test.cjs); la capa y la ficha solo tocan
 * el mapa y el DOM que se les pasa. */
(function (root) {
  'use strict';

  const COLORS = {ok: '#22c55e', incidencia: '#facc15', apagado: '#ef4444', sin_datos: '#94a3b8'};
  const ORDER = ['ok', 'incidencia', 'apagado', 'sin_datos'];
  const TEXT = {
    es: {title: 'Visión general', ok: 'OK', incidencia: 'con incidencia', apagado: 'apagados', sin_datos: 'sin datos',
      demo: 'DEMO · estados simulados: estas tiendas aún no tienen pantallas conectadas', real: 'Telemetría de pantallas en vivo',
      screens: 'pantallas', close: 'Cerrar visión general'},
    en: {title: 'Overview', ok: 'OK', incidencia: 'with issues', apagado: 'off', sin_datos: 'no data',
      demo: 'DEMO · simulated states: these stores have no connected screens yet', real: 'Live screen telemetry',
      screens: 'screens', close: 'Close overview'},
  };
  const L = lang => TEXT[String(lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es'];
  const surfacesOf = loc => (Array.isArray(loc && loc.surfaces) ? loc.surfaces : []);

  // Estado de un Xpacio a partir de sus pantallas (connectionOf → online|offline|unknown) e incidencias.
  function storeHealth(loc, connectionOf, incidents = 0) {
    const counts = {online: 0, offline: 0, unknown: 0};
    for (const s of surfacesOf(loc)) {
      const c = connectionOf ? connectionOf(loc, s) : 'unknown';
      counts[c === 'online' || c === 'offline' ? c : 'unknown']++;
    }
    const total = counts.online + counts.offline + counts.unknown;
    const known = counts.online + counts.offline;
    let state = 'sin_datos';
    if (total && counts.offline === total) state = 'apagado';
    else if (incidents > 0 || counts.offline > 0) state = 'incidencia';
    else if (counts.online > 0) state = 'ok';
    return {state, ...counts, total, incidents, real: known > 0 || incidents > 0};
  }

  // Estados de demo deterministas: el mismo Xpacio sale siempre igual (demos repetibles).
  // Uno de cada diez apagado y dos de cada diez con incidencia; con menos de 4, todos OK.
  function hash(text) {
    let h = 2166136261;
    for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const DEMO_ISSUES = [
    {es: 'Pantalla recogida sin señal desde hace 25 min', en: 'Pickup screen without signal for 25 min'},
    {es: 'Escaparate con contenido caducado', en: 'Window screen showing expired content'},
    {es: 'Menu board reiniciándose en bucle', en: 'Menu board stuck in a reboot loop'},
  ];
  function demoHealth(items) {
    const ranked = items.map(l => ({l, h: hash(l.id)})).sort((a, b) => a.h - b.h);
    const n = ranked.length, off = n >= 4 ? Math.max(1, Math.round(n / 10)) : 0, warn = n >= 4 ? Math.max(1, Math.round(n / 5)) : 0;
    const out = new Map();
    ranked.forEach(({l}, i) => {
      const total = surfacesOf(l).length || 3;
      const state = i < off ? 'apagado' : i < off + warn ? 'incidencia' : 'ok';
      out.set(l.id, {state, total, demo: true,
        online: state === 'ok' ? total : state === 'incidencia' ? total - 1 : 0,
        offline: state === 'ok' ? 0 : state === 'incidencia' ? 1 : total, unknown: 0,
        // Cada incidencia de demo con su propio texto (por orden, no por hash: no se repiten).
        incidents: state === 'incidencia' ? 1 : 0, issue: state === 'incidencia' ? DEMO_ISSUES[(i - off) % DEMO_ISSUES.length] : null});
    });
    return out;
  }

  // Salud del circuito: real si algún Xpacio tiene un dato real; si no, la de demo.
  function circuitHealth(items, connectionOf, incidentsOf) {
    const real = new Map(items.map(l => [l.id, storeHealth(l, connectionOf, incidentsOf ? incidentsOf(l) : 0)]));
    const anyReal = [...real.values()].some(h => h.real);
    const byId = anyReal ? real : demoHealth(items);
    const totals = {ok: 0, incidencia: 0, apagado: 0, sin_datos: 0};
    for (const h of byId.values()) totals[h.state]++;
    return {byId, totals, demo: !anyReal, count: items.length};
  }

  function pointsData(items, health) {
    return {type: 'FeatureCollection', features: items.map(l => {
      const h = health.byId.get(l.id) || {state: 'sin_datos', online: 0, total: 0};
      return {type: 'Feature', geometry: {type: 'Point', coordinates: l.coords}, properties: {
        id: l.id, state: h.state, color: COLORS[h.state], rank: ORDER.indexOf(h.state),
        label: String(l.city || l.name || ''), screens: `${h.online}/${h.total}`,
      }};
    })};
  }

  // ─── Capas ──────────────────────────────────────────────────────
  const SOURCE = 'vision-general';
  const LAYERS = ['vg-halo', 'vg-dot', 'vg-label'];
  function addLayers(map, font) {
    if (!map.getSource(SOURCE)) map.addSource(SOURCE, {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
    const add = layer => { if (!map.getLayer(layer.id)) map.addLayer(layer); };
    add({id: 'vg-halo', type: 'circle', source: SOURCE, paint: {'circle-color': ['get', 'color'], 'circle-blur': 0.8,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['match', ['get', 'state'], 'ok', 16, 22], 12, 34],
      'circle-opacity': ['match', ['get', 'state'], 'sin_datos', 0.25, 0.55]}});
    add({id: 'vg-dot', type: 'circle', source: SOURCE, paint: {'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 8, 12, 12],
      'circle-stroke-color': '#0b1215', 'circle-stroke-width': 2}});
    add({id: 'vg-label', type: 'symbol', source: SOURCE, layout: {'text-field': ['get', 'label'], 'text-font': font, 'text-size': 12,
      'text-anchor': 'top', 'text-offset': [0, 1.1], 'symbol-sort-key': ['get', 'rank'], 'text-padding': 3},
      paint: {'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,.85)', 'text-halo-width': 1.6}});
  }
  function setData(map, data) { try { map.getSource(SOURCE)?.setData(data); } catch (_) {} }
  function removeLayers(map) {
    LAYERS.slice().reverse().forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {} });
    try { if (map.getSource(SOURCE)) map.removeSource(SOURCE); } catch (_) {}
  }

  // ─── Ficha: título, recuento por color, aviso de demo y lista de incidencias ──
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])); }
  const CSS = '.vg-card{position:fixed;top:68px;left:50%;transform:translateX(-50%);z-index:11;width:min(560px,calc(100vw - 24px));' +
    'box-sizing:border-box;padding:12px 16px;border-radius:16px;background:rgba(6,14,18,.93);border:1px solid rgba(255,255,255,.16);' +
    'box-shadow:0 18px 48px rgba(0,0,0,.45);color:#fff;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}' +
    '.vg-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.vg-head strong{font-size:16px}' +
    '.vg-head button{background:none;border:0;color:#fff;font:22px/1 system-ui;cursor:pointer;padding:2px 6px}' +
    '.vg-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.vg-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;' +
    'border-radius:999px;background:rgba(255,255,255,.07)}.vg-chip i,.vg-issues i{width:10px;height:10px;border-radius:50%;display:inline-block;flex:none}' +
    '.vg-issues{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:4px;max-height:132px;overflow:auto}' +
    '.vg-issues li{display:flex;align-items:center;gap:8px;color:#dbe7ea}' +
    '.vg-source{margin:10px 0 0;font-size:11.5px;color:#9fb6bd}.vg-source.is-demo{color:#facc15;font-weight:600}' +
    'body.vg-on .status-pill,body.vg-on .live-ticker{display:none!important}' +
    '@media (max-width:760px){.vg-card{top:60px;padding:10px 12px}.vg-head strong{font-size:14px}}';
  function createCard(doc, title, items, health, lang, onClose) {
    const t = L(lang), lk = String(lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es';
    if (!doc.getElementById('vision-general-style')) {
      const st = doc.createElement('style'); st.id = 'vision-general-style'; st.textContent = CSS; doc.head.append(st);
    }
    const card = doc.createElement('section');
    card.className = 'vg-card';
    card.setAttribute('role', 'status');
    const chips = ['ok', 'incidencia', 'apagado', 'sin_datos'].filter(s => health.totals[s] || s !== 'sin_datos')
      .map(s => `<span class="vg-chip"><i style="background:${COLORS[s]}"></i><b>${health.totals[s]}</b> ${esc(t[s])}</span>`).join('');
    const issues = items.map(l => ({l, h: health.byId.get(l.id)})).filter(x => x.h && (x.h.state === 'incidencia' || x.h.state === 'apagado'))
      .map(({l, h}) => `<li><i style="background:${COLORS[h.state]}"></i><b>${esc(l.city || l.name)}</b> · ${esc(h.issue ? h.issue[lk] : `${h.online}/${h.total} ${t.screens}`)}</li>`).join('');
    // Sin <header>: la regla global header{position:fixed;backdrop-filter…} de la página lo emborronaba.
    card.innerHTML = `<div class="vg-head"><strong>${esc(t.title)} · ${esc(title)}</strong><button type="button" aria-label="${esc(t.close)}">×</button></div>
      <div class="vg-chips">${chips}</div>${issues ? `<ul class="vg-issues">${issues}</ul>` : ''}
      <p class="vg-source${health.demo ? ' is-demo' : ''}">${esc(health.demo ? t.demo : t.real)}</p>`;
    card.querySelector('button').addEventListener('click', onClose);
    doc.body.append(card);
    return card;
  }

  root.VisionGeneral = {COLORS, storeHealth, demoHealth, circuitHealth, pointsData, addLayers, setData, removeLayers, createCard, hash};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.VisionGeneral;
})(typeof window === 'undefined' ? globalThis : window);
