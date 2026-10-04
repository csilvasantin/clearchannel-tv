/* Segmentación del globo por cliente/marca (Carlos, 4-oct-2026, 21:55).
 * Igual que Contenidos en Pixeria (assets/cliente-activo.js): por defecto el cliente es Admira y
 * Admira lo ve TODO; con otro cliente activo el globo, los clusters, los contadores, la lista de
 * circuitos y el buscador solo enseñan los puntos de ese proyecto. Altadis y JTI nunca se mezclan.
 *
 * Cliente activo (por orden): ?marca=<id> → ?cliente=<id> (enlaces que llegan desde Pixeria) →
 * sessionStorage mb:marca (la marca recordada por marca-blanca.js). ?marca=admira|off = todo.
 * En vivo: evento `admira:marca` (marca-blanca.js) y /marca <id> en el modo Experto
 * (expert-commands.js llama a AdmiraSegmento.fijar). Al cambiar se emite `admira:segmento`.
 *
 * Los puntos no traen campo de cliente: se deduce por circuito (loc.circuit), prefijo del id,
 * external.brand / external.sponsor, experienceId y el tipo (kind). Ver clienteDe().
 */
(function (root) {
  'use strict';
  var fold = function (v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
  var plano = function (v) { return fold(v).replace(/[^a-z0-9]+/g, ''); };
  var TODOS = /^(admira|todos|todas|all|off|none|ninguna|ninguno|default|reset|quitar|apagar)$/;
  var SESSION_KEY = 'mb:marca';

  // Alias de nombres de cliente → id del censo de admiranext.com/api/clientes.
  var ALIAS = {
    altadis: 'altadis', estancosaltadis: 'altadis',
    jti: 'jti', jtixtanco: 'jti', xtanco: 'jti',
    starbucks: 'starbucks', alsea: 'starbucks', alseastarbucks: 'starbucks',
    starbucksmexico: 'starbucks-mexico', alseamexico: 'starbucks-mexico',
    alcampo: 'alcampo', cafebreria: 'cafebreria', admiraxperience: 'admiraxperience',
    desigual: 'desigual', mango: 'mango', decathlon: 'decathlon', bbva: 'bbva', banorte: 'banorte',
    caixabank: 'caixabank', lacaixa: 'caixabank', correos: 'correos', elcorteingles: 'elcorteingles',
    liverpool: 'liverpool', palacio: 'palacio', elpalaciodehierro: 'palacio', multiopticas: 'multiopticas',
    metro: 'metro', metrobcn: 'metro', metrobarcelona: 'metro', estancos: 'estancos', canalkiosk: 'canalkiosk',
    kioscos: 'canalkiosk', quioscos: 'canalkiosk'
  };
  // Un cliente puede incluir sub-proyectos: Starbucks (Alsea) ve también Starbucks México.
  var INCLUYE = { starbucks: ['starbucks', 'starbucks-mexico'] };

  function resolver(texto) {
    var t = plano(String(texto || '').replace(/^\//, '').replace(/^proyecto/i, ''));
    if (!t || TODOS.test(t)) return null;
    return ALIAS[t] || fold(texto).replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || null;
  }

  /** Cliente (id del censo) al que pertenece un punto, o null si no se puede deducir. */
  function clienteDe(loc) {
    if (!loc) return null;
    var id = String(loc.id || ''), circuit = fold(loc.circuit), ext = loc.external || {};
    var brand = plano(ext.brand), sponsor = plano(ext.sponsor), osmBrand = plano(loc.osm && loc.osm.brand);
    var kind = fold(loc.kind), name = fold(loc.name);
    // 1 · Circuitos con dueño explícito (Altadis y JTI primero: nunca se mezclan).
    if (/^altadis-bcn-/i.test(id) || circuit === 'altadis_bcn' || sponsor === 'altadis' || /circuito dooh altadis/.test(kind)) return 'altadis';
    // Xtanco es la enseña de JTI: el circuito de 100 y los gemelos xtanco, xtanco-bcn, xtanco-valencia.
    if (/^jti-xtanco-/i.test(id) || circuit === 'jti_xtanco' || /circuito dooh jti/.test(kind) || /^xtanco(-|$)/i.test(id) || /^xtanco\b/.test(name) || brand === 'xtanco') return 'jti';
    if (/^alsea-mx-/i.test(id) || circuit === 'alsea_mexico') return 'starbucks-mexico';
    if (id === 'cafebreria-barcelona' || circuit === 'cafebreria') return 'cafebreria';
    if (/^alsea-sbux-/i.test(id) || circuit === 'alsea_starbucks' || brand === 'starbucks' || osmBrand === 'starbucks') return 'starbucks';
    if (loc.experienceId === 'admiraxperience' || brand === 'admiraxperience') return 'admiraxperience';
    // 2 · Marca del establecimiento (external.brand / osm.brand) o tipo del punto.
    if (/^alcampo-/i.test(id) || brand === 'alcampo' || /alcampo/.test(kind + ' ' + name)) return 'alcampo';
    var hay = brand + ' ' + osmBrand + ' ' + plano(kind.split('·')[0]) + ' ' + plano(kind);
    var REGLAS = [
      ['desigual', /desigual/], ['correos', /correos/], ['bbva', /bbva/], ['mango', /mango/],
      ['decathlon', /decathlon/], ['elcorteingles', /elcorteingles/], ['liverpool', /liverpool/],
      ['palacio', /palaciodehierro/], ['banorte', /banorte/], ['caixabank', /caixabank|lacaixa/],
      ['multiopticas', /multiopticas/], ['metro', /metrobarcelona/]
    ];
    for (var i = 0; i < REGLAS.length; i++) if (REGLAS[i][1].test(hay)) return REGLAS[i][0];
    if (/kiosko|quiosco|prensa/.test(kind)) return 'canalkiosk';
    if (/estanco/.test(kind + ' ' + name)) return 'estancos';
    if (/kiosko|quiosco|prensa/.test(fold(id) + ' ' + name)) return 'canalkiosk';
    if (fold(loc.network) === 'admira' || /circuito admira/.test(kind)) return 'admira';
    return null;
  }

  /** ¿Se ve el punto con el cliente `cliente` activo? null/admira = todo. */
  function visible(loc, cliente) {
    if (!cliente || cliente === 'admira') return true;
    var c = clienteDe(loc);
    return (INCLUYE[cliente] || [cliente]).indexOf(c) >= 0;
  }

  /** Filtra la lista. Un cliente sin ningún punto (marca de ejemplo, propuesta) no vacía el globo. */
  function filtrar(list, cliente) {
    var all = Array.isArray(list) ? list : [];
    if (!cliente || cliente === 'admira') return all;
    var out = all.filter(function (l) { return visible(l, cliente); });
    return out.length ? out : all;
  }

  function decidir(search, storage) {
    var p = null;
    try { p = new URLSearchParams(search || ''); } catch (_) {}
    if (p && p.has('marca')) return resolver(p.get('marca'));
    if (p && p.has('cliente')) return resolver(p.get('cliente'));
    var s = null;
    try { s = storage && storage.getItem(SESSION_KEY); } catch (_) {}
    return s ? resolver(s) : null;
  }

  var api = { clienteDe: clienteDe, visible: visible, filtrar: filtrar, resolver: resolver, decidir: decidir, ALIAS: ALIAS, INCLUYE: INCLUYE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined' || root.AdmiraSegmento) return;

  var session = null;
  try { session = root.sessionStorage; } catch (_) {}
  var actual = decidir(root.location.search, session);

  function fijar(valor) {
    var next = resolver(valor);
    if (next === actual) return actual;
    actual = next;
    try { document.documentElement.toggleAttribute('data-segmento', !!actual); if (actual) document.documentElement.setAttribute('data-segmento', actual); } catch (_) {}
    document.dispatchEvent(new CustomEvent('admira:segmento', { detail: { cliente: actual } }));
    return actual;
  }
  if (actual) document.documentElement.setAttribute('data-segmento', actual);
  // marca-blanca.js aplica (o quita) una marca del catálogo: el globo la sigue.
  document.addEventListener('admira:marca', function (e) { fijar(e.detail && e.detail.id ? e.detail.id : null); });

  root.AdmiraSegmento = Object.freeze(Object.assign({}, api, {
    actual: function () { return actual; },
    fijar: fijar,
    filtrarActual: function (list) { return filtrar(list, actual); }
  }));
})(typeof window === 'undefined' ? globalThis : window);
