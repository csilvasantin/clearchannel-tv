/* Tour DooH global: el circuito entero a la vista y, de ahí, a la puerta de cada Xpacio.
 * Alsea México (Carlos, 15-oct-2026 · FLT-102469; marca Starbucks desde DCL-97f84ae3e5b2cb2311c55101):
 * 10 Starbucks en 10 estados. Antes de cada parada la cámara vuelve a México entero con la ruta trazada; después baja a pie de puerta
 * (zoom de calle, inclinada en 3D) y gira despacio alrededor de la tienda.
 * Las funciones de datos son puras (tests/global-tour.test.cjs); el HUD y las capas solo tocan
 * el DOM y el mapa que se les pasa. */
(function (root) {
  'use strict';

  const TOURS = {
    alsea_starbucks: {
      accent: '#00a862', deep: '#00704a', light: '#d4e9e2', ink: '#10251f', halo: 'rgba(10,28,23,.9)',
      bg: {top:'rgba(30,57,50,.95)', bottom:'rgba(16,36,30,.93)', card:'rgba(22,44,38,.95)', street:'#e8f2ed', stats:'#d9bf8c'},
      title: {es:'Starbucks España · Alsea', en:'Starbucks Spain · Alsea'},
      region: {es:'Barcelona', en:'Barcelona'},
      labels: {es:{stores:'destinos', states:'ciudad', screens:'superficies de catálogo'}, en:{stores:'destinations', states:'city', screens:'catalogue surfaces'}},
      liveHealth: true, overviewMaxZoom:12.7, doorZoom:18.2, doorPitch:60,
      stops: {
        'lab-gran-de-gracia-51': {state:'Laboratorio · Barcelona', short:'GDG', street:'Gran de Gràcia 51 · Laboratorio'},
        'alsea-sbux-021': {state:'Barcelona', short:'PG103', street:'Paseo de Gracia 103'},
        'alsea-sbux-014': {state:'Barcelona', short:'DIAG', street:'Diagonal 557 · L’Illa'},
      },
    },
    // Starbucks México (DCL-97f84ae3e5b2cb2311c55101, 16-oct-2026): al nivel del de Altadis España, con la marca
    // de Starbucks (verde #00704A, verde de la casa #1E3932 y el dorado #CBA258 de su marca blanca) y el formato de
    // cada tienda en la ficha de la puerta (uno de los 10 de Altadis en su versión cafetería: altadis-cafe-NN).
    alsea_mexico: {
      accent: '#00a862', deep: '#00704a', light: '#d4e9e2',
      ink: '#10251f', halo: 'rgba(10,28,23,.9)',
      bg: {top: 'rgba(30,57,50,.95)', bottom: 'rgba(16,36,30,.93)', card: 'rgba(22,44,38,.95)', street: '#e8f2ed', stats: '#d9bf8c'},
      title: {es: 'Starbucks México · Alsea', en: 'Starbucks Mexico · Alsea'},
      region: {es: 'México', en: 'Mexico'},
      presentation: 'mexico',
      timing: {intro:2200, leg:1000, flight:3000, door:8500, finale:6500},
      doorZoom: 18.2, doorPitch: 60,
      // Dirección corta y estado de cada tienda (las del localizador oficial vienen en
      // mayúsculas fiscales). Coordenadas: localizador starbucks.com.mx, 6-24 m de OSM.
      stops: {
        'alsea-mx-sbux-01-tijuana': {state: 'Baja California', short: 'BC', street: 'Paseo de los Héroes 95 · Zona Río', format: 'TABLET'},
        'alsea-mx-sbux-02-monterrey': {state: 'Nuevo León', short: 'NL', street: 'Av. Juárez 1102 · Centro', format: 'VIDEOWALL 8X1 H'},
        'alsea-mx-sbux-03-leon': {state: 'Guanajuato', short: 'GTO', street: 'Blvd. Francisco Villa 1820 · Oriental', format: 'VERTICAL'},
        'alsea-mx-sbux-04-guadalajara': {state: 'Jalisco', short: 'JAL', street: 'Degollado 202 · Centro', format: 'VIDEOWALL 4X1 V'},
        'alsea-mx-sbux-05-queretaro': {state: 'Querétaro', short: 'QRO', street: 'Av. Constituyentes 57 · Cimatario', format: 'LED CUBO MADRID-062'},
        'alsea-mx-sbux-06-cdmx': {state: 'Ciudad de México', short: 'CDMX', street: 'Madero 42 · Centro Histórico', format: 'GONDOLA LED LIMITS-006'},
        'alsea-mx-sbux-07-puebla': {state: 'Puebla', short: 'PUE', street: 'Av. 2 Oriente 203 · Centro Histórico', format: 'VIDEOWALL 2X1 V'},
        'alsea-mx-sbux-08-oaxaca': {state: 'Oaxaca', short: 'OAX', street: 'Calz. Porfirio Díaz 27 · Reforma', format: 'SHUTTLE STRETCH'},
        'alsea-mx-sbux-09-merida': {state: 'Yucatán', short: 'YUC', street: 'Calle 56A 465 · Paseo de Montejo', format: 'VIDEOWALL 1X2 V'},
        'alsea-mx-sbux-10-cancun': {state: 'Quintana Roo', short: 'QROO', street: 'Av. Bonampak · Puerto Cancún', format: 'LED GRANADA-021'},
      },
    },
    // Altadis España · 10 Xtancos (DCL-a6cb621be0ce5932f50960de, 16-oct-2026): la misma demo con la marca blanca
    // de Altadis (naranja #F47920 y marrón #3C3126). Un estanco real por ciudad, de A Coruña a Granada, cada uno
    // con un formato Altadis. Raíl con el código IATA de cada ciudad.
    altadis_espana: {
      accent: '#F47920', deep: '#3C3126', light: '#fcd9bd',
      ink: '#2a211a', halo: 'rgba(30,22,14,.9)',
      bg: {top: 'rgba(60,49,38,.94)', bottom: 'rgba(32,25,19,.92)', card: 'rgba(36,28,21,.94)', street: '#f3e6da', stats: '#e2c3a6'},
      title: {es: 'Altadis · Xtancos España', en: 'Altadis · Xtancos Spain'},
      region: {es: 'España', en: 'Spain'},
      labels: {es: {stores: 'Xtancos', states: 'ciudades', store: 'Estanco'}, en: {stores: 'Xtancos', states: 'cities', store: 'Tobacconist'}},
      doorZoom: 18.2, doorPitch: 60,
      stops: {
        'altadis-es-01-a-coruna': {state: 'Galicia', short: 'LCG', street: 'Rúa Rego da Auga 40 · Pescadería', format: 'TABLET'},
        'altadis-es-02-bilbao': {state: 'País Vasco', short: 'BIO', street: 'Bidebarrieta 2 · Casco Viejo', format: 'VIDEOWALL 8X1 H'},
        'altadis-es-03-barcelona': {state: 'Cataluña', short: 'BCN', street: 'Gran de Gràcia 61 · Gràcia', format: 'VERTICAL'},
        'altadis-es-04-zaragoza': {state: 'Aragón', short: 'ZAZ', street: 'San Ignacio de Loyola 7 · Centro', format: 'VIDEOWALL 4X1 V'},
        'altadis-es-05-madrid': {state: 'Comunidad de Madrid', short: 'MAD', street: 'Fuencarral 2 · Gran Vía', format: 'LED CUBO MADRID-062'},
        'altadis-es-06-valencia': {state: 'Comunitat Valenciana', short: 'VLC', street: 'Plaça de Sant Jaume 5 · Ciutat Vella', format: 'GONDOLA LED LIMITS-006'},
        'altadis-es-07-palma': {state: 'Illes Balears', short: 'PMI', street: "Plaça de l'Olivar 5 · El Mercat", format: 'VIDEOWALL 2X1 V'},
        'altadis-es-08-sevilla': {state: 'Andalucía', short: 'SVQ', street: "O'Donnell 5 · Casco Antiguo", format: 'SHUTTLE STRETCH'},
        'altadis-es-09-malaga': {state: 'Andalucía', short: 'AGP', street: 'Marqués de Larios 10 · Centro Histórico', format: 'VIDEOWALL 1X2 V'},
        'altadis-es-10-granada': {state: 'Andalucía', short: 'GRX', street: 'Reyes Católicos 47 · Centro', format: 'LED GRANADA-021'},
      },
    },
  };

  const TEXT = {
    es: {stores: 'Starbucks', states: 'estados', screens: 'pantallas DooH', screen: 'pantalla DooH', reach: 'impactos/día',
      store: 'Tienda', door: 'A pie de puerta', overview: 'Vista global', next: 'Siguiente',
      done: 'Tour completado', circuit: 'circuito DooH', perDay: 'impactos/día', format: 'Formato'},
    en: {stores: 'Starbucks', states: 'states', screens: 'DooH screens', screen: 'DooH screen', reach: 'impressions/day',
      store: 'Store', door: 'At the door', overview: 'Global view', next: 'Next',
      done: 'Tour completed', circuit: 'DooH circuit', perDay: 'impressions/day', format: 'Format'},
  };
  const lang2 = lang => (String(lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es');
  const pick = (value, lang) => (value && typeof value === 'object' ? (value[lang2(lang)] || value.es || '') : String(value || ''));
  // Textos del HUD: los de serie (Starbucks, estados) con los propios del circuito encima (Xtancos, ciudades).
  function text(cfg, lang) {
    const own = cfg && cfg.labels && cfg.labels[lang2(lang)];
    return Object.assign({}, TEXT[lang2(lang)], own || {});
  }

  function config(circuitId, definition) {
    if (Object.prototype.hasOwnProperty.call(TOURS, circuitId)) return TOURS[circuitId];
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(String(circuitId||'')) || ['__proto__','constructor','prototype'].includes(circuitId)
      || !definition || !Array.isArray(definition.items) || !definition.items.some(l=>Array.isArray(l.coords)&&l.coords.length===2&&l.coords.every(Number.isFinite))) return null;
    const label=definition.label||circuitId;
    return {accent:'#00a862',deep:'#155d45',light:'#d4e9e2',ink:'#10251f',halo:'rgba(10,28,23,.9)',
      title:label,region:label,presentation:'circuit',overviewMaxZoom:12.7,doorZoom:18.2,doorPitch:60,
      timing:{intro:2200,leg:1000,flight:3000,door:8500,finale:6500},stops:{},
      labels:{es:{stores:'Xpacios',states:'zonas',screens:'superficies de catálogo',screen:'superficie de catálogo',reach:'impactos estimados/día',perDay:'impactos estimados/día'},
        en:{stores:'Xpaces',states:'areas',screens:'catalogue surfaces',screen:'catalogue surface',reach:'estimated impressions/day',perDay:'estimated impressions/day'}}};
  }

  function totalCircuit(definitions, lang='es') {
    const unique=new Map();let circuits=0;
    for(const [id,def] of Object.entries(definitions||{})){
      if(['all','dooh_total'].includes(id)||!def||!Array.isArray(def.items))continue;
      const points=def.items.filter(l=>l&&l.id&&Array.isArray(l.coords)&&l.coords.length===2&&l.coords.every(Number.isFinite));
      if(!points.length)continue;
      circuits++;
      for(const loc of points)if(!unique.has(loc.id))unique.set(loc.id,{...loc,tourCircuitLabel:pick(def.label,lang)||id});
    }
    return {label:lang==='en'?'Total DooH Tour':'Tour DooH total',items:[...unique.values()],circuits};
  }

  function surfacesOf(loc) { return Array.isArray(loc && loc.surfaces) ? loc.surfaces : []; }
  function impressionsOf(loc) { return surfacesOf(loc).reduce((sum, s) => sum + (Number(s && s.impr) || 0), 0); }

  function stopInfo(cfg, loc, lang) {
    const extra = (cfg && cfg.stops && cfg.stops[loc.id]) || {};
    const addrHead = String(loc.addr || '').split(' · ')[0];
    const name = String(loc.name || '');
    return {
      id: loc.id,
      circuitLabel: String(loc.tourCircuitLabel||''),
      name,
      // «Starbucks Tijuana · Plaza Río» → «Plaza Río»; sin « · » queda el nombre entero.
      place: name.includes(' · ') ? name.split(' · ').slice(1).join(' · ') : name,
      city: String(loc.city || ''),
      state: extra.state || String(loc.province || ''),
      short: extra.short || String(loc.province || '').slice(0, 4).toUpperCase(),
      street: extra.street || addrHead,
      storeId: (loc.external && loc.external.storeId) ? String(loc.external.storeId) : '',
      format: extra.format || String(loc.format || surfacesOf(loc).map(s=>s.format||s.name).filter(Boolean).join(' · ')),
      screens: surfacesOf(loc).length,
      impressions: impressionsOf(loc),
      lang: lang2(lang),
    };
  }

  function totals(items) {
    const states = new Set(items.map(l => String(l.province || l.city || l.id)));
    return {
      stores: items.length,
      states: states.size,
      screens: items.reduce((sum, l) => sum + surfacesOf(l).length, 0),
      impressions: items.reduce((sum, l) => sum + impressionsOf(l), 0),
    };
  }

  function formatCount(n, lang) {
    const en = lang2(lang) === 'en';
    if (n >= 1000) {
      const k = Math.round(n / 100) / 10;
      return (en ? String(k) : String(k).replace('.', ',')) + ' K';
    }
    return String(n);
  }

  function bounds(items) {
    const pts = items.map(l => l.coords).filter(c => Array.isArray(c) && c.every(Number.isFinite));
    if (!pts.length) return null;
    const lngs = pts.map(c => c[0]), lats = pts.map(c => c[1]);
    return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
  }

  // Arco de vuelo entre dos paradas: curva cuadrática con el vértice desplazado a la
  // izquierda del trayecto, proporcional a su longitud (se lee como una ruta aérea).
  function arc(a, b, steps = 24, bend = 0.16) {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const ctrl = [mid[0] - dy * bend, mid[1] + dx * bend];
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0], u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1]]);
    }
    return out;
  }

  // progress: paradas ya alcanzadas, con fracción para el tramo en curso (2.5 = mitad del
  // tramo de la 3.ª a la 4.ª parada). La ruta pendiente se dibuja entera bajo la recorrida.
  function routeData(items, progress) {
    const coords = items.map(l => l.coords);
    const legs = [];
    for (let i = 1; i < coords.length; i++) legs.push(arc(coords[i - 1], coords[i], coords.length > 200 ? 1 : 24));
    const full = legs.reduce((line, leg, i) => line.concat(i ? leg.slice(1) : leg), []);
    const reached = Math.max(0, Math.min(legs.length, Number(progress) || 0));
    const whole = Math.floor(reached), part = reached - whole;
    let done = [];
    for (let i = 0; i < whole; i++) done = done.concat(i ? legs[i].slice(1) : legs[i]);
    if (part > 0 && legs[whole]) {
      const leg = legs[whole], cut = Math.max(1, Math.round(part * (leg.length - 1)));
      done = done.concat((whole ? leg.slice(1, cut + 1) : leg.slice(0, cut + 1)));
    }
    const features = [];
    if (full.length > 1) features.push({type: 'Feature', properties: {kind: 'pending'}, geometry: {type: 'LineString', coordinates: full}});
    if (done.length > 1) features.push({type: 'Feature', properties: {kind: 'done'}, geometry: {type: 'LineString', coordinates: done}});
    return {type: 'FeatureCollection', features};
  }

  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  function sameName(a, b) { return fold(a) === fold(b); }

  function stopsData(cfg, items, current, lang) {
    return {type: 'FeatureCollection', features: items.map((loc, i) => {
      const info = stopInfo(cfg, loc, lang);
      const status = i === current ? 'current' : i < current ? 'done' : 'next';
      return {type: 'Feature', geometry: {type: 'Point', coordinates: loc.coords}, properties: {
        id: loc.id, order: i + 1, status, rank: status === 'current' ? 0 : status === 'done' ? 1 : 2,
        // «Oaxaca · Oaxaca» se lee una sola vez.
        label: cfg.liveHealth ? info.street : (sameName(info.city, info.state) || !info.state ? info.city : info.city + '\n' + info.state),
      }};
    })};
  }

  function doorCamera(cfg, loc, index, view3d) {
    return {center: loc.coords, zoom: (cfg && cfg.doorZoom) || 18, pitch: view3d ? ((cfg && cfg.doorPitch) || 60) : 0,
      bearing: ((index * 37) % 360) - 20};
  }

  // ─── Capas del mapa ─────────────────────────────────────────────
  const ROUTE = 'global-tour-route', STOPS = 'global-tour-stops';
  const LAYERS = ['gt-route-pending', 'gt-route-glow', 'gt-route-done', 'gt-stop-halo', 'gt-stop', 'gt-stop-num', 'gt-stop-label', 'gt-door-outer', 'gt-door'];
  const BASE_LAYERS = ['clusters', 'cluster-count', 'locs-glow', 'unclustered-pulse', 'selected-ring', 'unclustered-point'];

  function setBaseLayers(map, visible) {
    BASE_LAYERS.forEach(id => { try { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); } catch (_) {} });
  }

  function addLayers(map, cfg, font) {
    if (!map.getSource(ROUTE)) map.addSource(ROUTE, {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
    if (!map.getSource(STOPS)) map.addSource(STOPS, {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
    const add = layer => { if (!map.getLayer(layer.id)) map.addLayer(layer); };
    add({id: 'gt-route-pending', type: 'line', source: ROUTE, maxzoom: 13, filter: ['==', ['get', 'kind'], 'pending'],
      layout: {'line-cap': 'round', 'line-join': 'round'},
      paint: {'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': 1.6, 'line-dasharray': [2, 2.5]}});
    add({id: 'gt-route-glow', type: 'line', source: ROUTE, maxzoom: 13, filter: ['==', ['get', 'kind'], 'done'],
      layout: {'line-cap': 'round', 'line-join': 'round'},
      paint: {'line-color': cfg.accent, 'line-opacity': 0.45, 'line-width': 9, 'line-blur': 5}});
    add({id: 'gt-route-done', type: 'line', source: ROUTE, maxzoom: 13, filter: ['==', ['get', 'kind'], 'done'],
      layout: {'line-cap': 'round', 'line-join': 'round'},
      paint: {'line-color': '#ffffff', 'line-width': 2.6}});
    add({id: 'gt-stop-halo', type: 'circle', source: STOPS, maxzoom: 13,
      paint: {'circle-color': cfg.accent, 'circle-blur': 0.7,
        'circle-radius': ['match', ['get', 'status'], 'current', 30, 'done', 18, 14],
        'circle-opacity': ['match', ['get', 'status'], 'current', 0.75, 'done', 0.4, 0.22]}});
    add({id: 'gt-stop', type: 'circle', source: STOPS, maxzoom: 13,
      paint: {'circle-radius': ['match', ['get', 'status'], 'current', 14, 11],
        'circle-color': ['match', ['get', 'status'], 'current', '#ffffff', 'done', cfg.deep, cfg.ink || '#0d1f19'],
        'circle-stroke-color': ['match', ['get', 'status'], 'current', cfg.accent, '#ffffff'],
        'circle-stroke-width': ['match', ['get', 'status'], 'current', 3, 1.6]}});
    add({id: 'gt-stop-num', type: 'symbol', source: STOPS, maxzoom: 13,
      layout: {'text-field': ['to-string', ['get', 'order']], 'text-font': font, 'text-size': 12,
        'text-allow-overlap': true, 'text-ignore-placement': true},
      paint: {'text-color': ['match', ['get', 'status'], 'current', cfg.deep, '#ffffff']}});
    add({id: 'gt-stop-label', type: 'symbol', source: STOPS, maxzoom: 13,
      layout: {'text-field': ['get', 'label'], 'text-font': font, 'text-size': ['match', ['get', 'status'], 'current', 15, 12],
        'text-anchor': 'top', 'text-offset': [0, 1.35], 'text-line-height': 1.15, 'symbol-sort-key': ['get', 'rank'],
        'text-padding': 4},
      paint: {'text-color': '#ffffff', 'text-halo-color': cfg.halo || 'rgba(0,20,14,.9)', 'text-halo-width': 1.8,
        'text-opacity': ['match', ['get', 'status'], 'next', 0.78, 1]}});
    // A pie de puerta solo un anillo alrededor de la tienda: nada tapa la fachada.
    add({id: 'gt-door-outer', type: 'circle', source: STOPS, minzoom: 13, filter: ['==', ['get', 'status'], 'current'],
      paint: {'circle-radius': 44, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': cfg.accent,
        'circle-stroke-width': 3, 'circle-stroke-opacity': 0.9, 'circle-pitch-alignment': 'map'}});
    add({id: 'gt-door', type: 'circle', source: STOPS, minzoom: 13, filter: ['==', ['get', 'status'], 'current'],
      paint: {'circle-radius': 34, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2.5, 'circle-stroke-opacity': 0.95, 'circle-pitch-alignment': 'map'}});
  }

  function setData(map, route, stops) {
    try { map.getSource(ROUTE)?.setData(route); map.getSource(STOPS)?.setData(stops); } catch (_) {}
  }

  function removeLayers(map) {
    LAYERS.slice().reverse().forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {} });
    [ROUTE, STOPS].forEach(id => { try { if (map.getSource(id)) map.removeSource(id); } catch (_) {} });
  }

  // ─── HUD: marca y raíl de estados arriba, ficha de la puerta abajo ──
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])); }

  // Fondo del HUD y de la ficha: el verde de serie (Alsea) salvo que el circuito traiga el suyo (Altadis, marrón).
  function paintBg(el, cfg) {
    const bg = cfg && cfg.bg;
    if (!bg) return;
    for (const [k, v] of Object.entries({'--gt-bg-top': bg.top, '--gt-bg-bottom': bg.bottom, '--gt-bg-card': bg.card,
      '--gt-street': bg.street, '--gt-stats': bg.stats})) if (v) el.style.setProperty(k, v);
  }

  function createHud(doc, cfg, items, lang) {
    const L = text(cfg, lang);
    const sum = totals(items);
    if (cfg.liveHealth) {
      sum.states = new Set(items.map(l => l.city || 'Barcelona')).size;
      sum.screens = items.filter(l=>l.monitoringKind!=='location-only').reduce((n,l)=>n+surfacesOf(l).length,0);
    }
    const infos = items.map(l => stopInfo(cfg, l, lang));
    const hud = doc.createElement('div');
    hud.className = 'gt-hud';
    const editorial = ['mexico','circuit'].includes(cfg.presentation);
    if (editorial) hud.classList.add('gt-mexico');
    hud.style.setProperty('--gt-accent', cfg.accent);
    hud.style.setProperty('--gt-deep', cfg.deep);
    hud.style.setProperty('--gt-light', cfg.light);
    paintBg(hud, cfg);
    hud.setAttribute('role', 'status');
    hud.innerHTML = `<div class="gt-brand"><span class="gt-dot" aria-hidden="true"></span><div>
      <strong>${esc(pick(cfg.title, lang))}</strong>
      <span class="gt-sub">${sum.stores} ${esc(L.stores)} · ${sum.states} ${esc(L.states)} · ${sum.screens} ${esc(L.screens)}${cfg.liveHealth ? '' : ` · ${esc(formatCount(sum.impressions, lang))} ${esc(L.reach)}`}</span>
      </div></div>
      <ol class="gt-rail">${infos.map((s, i) => `<li data-i="${i}" title="${esc(s.city + ' · ' + s.state)}"><b>${i + 1}</b><span>${esc(editorial ? (s.city || s.place) : s.short)}</span></li>`).join('')}</ol>`;
    const card = doc.createElement('aside');
    card.className = 'gt-card';
    if (editorial) card.classList.add('gt-mexico');
    card.hidden = true;
    card.style.setProperty('--gt-accent', cfg.accent);
    card.style.setProperty('--gt-deep', cfg.deep);
    paintBg(card, cfg);
    doc.body.append(hud, card);
    const rail = [...hud.querySelectorAll('.gt-rail li')];
    let journey;
    if (editorial) {
      journey = doc.createElement('div');
      journey.className = 'gt-journey';
      hud.append(journey);
    }
    const nextLabel = index => index + 1 < infos.length
      ? `${L.next} · ${infos[index + 1].city || infos[index + 1].place}`
      : (lang === 'en' ? 'Final stop' : 'Última parada');

    function setStop(index, phase) {
      const railStart=Math.max(0, Math.min(index-4, items.length-10));
      rail.forEach((li, i) => {
        li.hidden=editorial && items.length>10 && (i<railStart || i>=railStart+10);
        li.classList.toggle('done', i < index || (i === index && phase === 'door'));
        li.classList.toggle('current', i === index);
      });
      if (phase !== 'door') card.hidden = true;
      if (journey && infos[index]) {
        journey.innerHTML = `<span>${esc(phase === 'door' ? L.door : (lang === 'en' ? 'Flying to' : 'Rumbo a'))} <b>${esc(infos[index].city || infos[index].place)}</b></span><span>${String(index + 1).padStart(2,'0')} / ${items.length} · ${esc(nextLabel(index))}</span>`;
      }
    }
    function door(index) {
      const s = infos[index];
      card.innerHTML = `<div class="gt-card-num">${String(index + 1).padStart(2, '0')}<small>/${String(items.length).padStart(2, '0')}</small></div>
        <div class="gt-card-body"><span class="gt-card-kicker">${esc(L.door)} · ${esc(s.state)}${s.storeId ? ` · ${esc(L.store)} #${esc(s.storeId)}` : ''}${s.format ? ` · ${esc(L.format)} ${esc(s.format)}` : ''}</span>
        <strong>${esc(s.name)}</strong>
        <span class="gt-card-street">${esc(s.street)} · ${esc(s.city)}</span>
        <span class="gt-card-stats">${s.screens} ${esc(s.screens === 1 ? L.screen : L.screens)}${cfg.liveHealth ? '' : ` · ${esc(formatCount(s.impressions, lang))} ${esc(L.perDay)}`}</span></div>`;
      if (editorial) {
        card.innerHTML = `<div class="gt-card-body"><span class="gt-card-kicker">${esc(s.circuitLabel || s.state)} · ${String(index + 1).padStart(2,'0')} / ${items.length}</span>
          <strong class="gt-city">${esc(s.city || s.place)}</strong><span class="gt-store-name">${esc(s.name)}</span>
          <span class="gt-card-street">${esc(s.street)}</span>
          <span class="gt-format">${esc(s.format)}</span>
          <span class="gt-card-stats">${s.screens} ${esc(s.screens === 1 ? L.screen : L.screens)} · ${esc(formatCount(s.impressions, lang))} ${esc(L.perDay)}</span>
          <span class="gt-next">${esc(nextLabel(index))}</span></div>`;
        const progress = doc.createElement('div');
        progress.className = 'gt-reading-progress';
        progress.style.setProperty('--gt-dwell', `${cfg.timing.door}ms`);
        card.append(progress);
      }
      card.hidden = false;
      setStop(index, 'door');
    }
    function finish() {
      if (journey) journey.textContent = lang === 'en' ? `${infos[0].city||infos[0].name} → ${infos.at(-1).city||infos.at(-1).name} · Tour completed` : `${infos[0].city||infos[0].name} → ${infos.at(-1).city||infos.at(-1).name} · Tour completado`;
      rail.forEach(li => { li.classList.add('done'); li.classList.remove('current'); });
      card.innerHTML = `<div class="gt-card-num">✓</div><div class="gt-card-body"><span class="gt-card-kicker">${esc(L.done)} · ${esc(pick(cfg.region, lang))}</span>
        <strong>${sum.stores} ${esc(L.stores)} · ${sum.states} ${esc(L.states)}</strong>
        <span class="gt-card-stats">${sum.screens} ${esc(L.screens)}${cfg.liveHealth ? '' : ` · ${esc(formatCount(sum.impressions, lang))} ${esc(L.perDay)}`} · 1 ${esc(L.circuit)}</span></div>`;
      card.hidden = false;
    }
    function destroy() { hud.remove(); card.remove(); }
    return {setStop, door, finish, destroy, element: hud};
  }

  root.GlobalTour = {config, totalCircuit, stopInfo, totals, formatCount, bounds, arc, routeData, stopsData, doorCamera,
    addLayers, setData, removeLayers, setBaseLayers, createHud, sameName, text, TOURS};
})(typeof window === 'undefined' ? globalThis : window);
