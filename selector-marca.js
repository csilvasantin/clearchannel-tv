/* Selector visible de marca para el globo (Walt/Niobe, 23-oct-2026, misión aprobada por Jobs).
 * Por defecto «Admira · todos los puntos». Las opciones salen SOLO de las marcas que tienen puntos en
 * los datos cargados (AdmiraSegmento.clienteDe sobre AdmiraGlobo.todos()); no se inventan marcas.
 * Elegir una marca llama a AdmiraSegmento.fijar(id) → evento admira:segmento → app.js re-segmenta. */
(function () {
  'use strict';
  var NOMBRES = { admira: 'Admira · todos los puntos', altadis: 'Altadis', jti: 'JTI', starbucks: 'Starbucks (Alsea)',
    'starbucks-mexico': 'Starbucks México', alcampo: 'Alcampo', cafebreria: 'Cafebrería', admiraxperience: 'AdmiraXperience',
    caixabank: 'CaixaBank', elcorteingles: 'El Corte Inglés', canalkiosk: 'Canal Kiosk', bbva: 'BBVA', multiopticas: 'Multiópticas', palacio: 'El Palacio de Hierro', metro: 'Metro' };
  function nombre(id) { return NOMBRES[id] || (id.charAt(0).toUpperCase() + id.slice(1)); }
  var box, sel, firma = '';
  function montar() {
    if (box) return;
    box = document.createElement('div');
    box.id = 'brand-filter';
    box.setAttribute('style', 'position:fixed;left:16px;bottom:44px;z-index:60;background:rgba(10,14,24,.88);color:#fff;' +
      'border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:8px 12px;font:13px/1.3 system-ui,sans-serif;' +
      'display:flex;gap:8px;align-items:center;box-shadow:0 6px 20px rgba(0,0,0,.35)');
    var lab = document.createElement('label');
    lab.htmlFor = 'brand-filter-select'; lab.textContent = 'Marca';
    sel = document.createElement('select');
    sel.id = 'brand-filter-select';
    sel.setAttribute('aria-label', 'Filtrar el globo por marca');
    sel.setAttribute('style', 'font:inherit;background:#111827;color:#fff;border:1px solid #374151;border-radius:8px;padding:4px 6px');
    sel.addEventListener('change', function () {
      var v = sel.value === 'admira' ? null : sel.value;
      try { if (v) sessionStorage.setItem('mb:marca', v); else sessionStorage.removeItem('mb:marca'); } catch (_) {}
      window.AdmiraSegmento.fijar(v);
    });
    box.append(lab, sel);
    document.body.appendChild(box);
  }
  function pintar() {
    var S = window.AdmiraSegmento, G = window.AdmiraGlobo;
    if (!S || !G || typeof G.todos !== 'function' || !document.body) return;
    montar();
    var cuenta = {}, todos = G.todos();
    todos.forEach(function (l) { var c = S.clienteDe(l); if (c) cuenta[c] = (cuenta[c] || 0) + 1; });
    var ids = Object.keys(cuenta).filter(function (i) { return i !== 'admira'; }).sort(function (a, b) { return cuenta[b] - cuenta[a]; });
    var actual = S.actual() || 'admira';
    var f = actual + '|' + todos.length + '|' + ids.map(function (i) { return i + cuenta[i]; }).join(',');
    if (f === firma) return; firma = f;
    sel.textContent = '';
    var opt = new Option(nombre('admira') + ' (' + todos.length + ')', 'admira'); sel.add(opt);
    ids.forEach(function (id) { sel.add(new Option(nombre(id) + ' (' + cuenta[id] + ')', id)); });
    if (actual !== 'admira' && !cuenta[actual]) sel.add(new Option(nombre(actual) + ' (sin puntos en los datos)', actual));
    sel.value = actual;
    window.AdmiraSelectorMarca = { marcas: cuenta, total: todos.length };
  }
  document.addEventListener('admira:segmento', pintar);
  document.addEventListener('admira:globo-listo', pintar);
  window.addEventListener('load', pintar);
  setInterval(pintar, 3000);
})();
