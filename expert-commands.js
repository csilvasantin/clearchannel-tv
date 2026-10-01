// Modo experto · registro de VERBOS y ATRIBUTOS (encargo FLT-101307, 1-oct-2026).
// Un verbo es una orden con funcionalidad propia (/demo); un atributo es el dato
// que la concreta (cliente=alcampo). Una rutina es una orden verbo+atributo lista
// para un clic. Los clientes son los circuitos reales de app.js (CIRCUIT_IDS_BY_SCOPE):
// aquí solo se les da nombre y alias tolerantes; nada se ejecuta por eval.
// El módulo es puro: la página inyecta las acciones reales en `ctx` al ejecutar.
(function (root) {
  'use strict';

  const L = (lang, es, en) => (lang === 'en' ? en : es);
  // Mayúsculas, acentos, espacios, guiones y guiones bajos no distinguen alias.
  const key = value => String(value == null ? '' : value).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');

  // Clientes = circuitos de app.js. `featured` genera rutinas de un clic.
  const CLIENTS = [
    {id: 'cafebreria', circuit: 'cafebreria', label: 'Cafebrería', es: 'Cafebrería · Proyecto independiente', en: 'Cafebrería · Independent project', aliases: ['cafebreria barcelona'], featured: true},
    {id: 'starbucks', circuit: 'alsea_starbucks', label: 'Starbucks', es: 'Starbucks España (Alsea)', en: 'Starbucks Spain (Alsea)', aliases: ['sbux', 'alsea', 'alsea starbucks', 'starbucks espana', 'starbucks spain'], featured: true},
    {id: 'starbucks-mexico', circuit: 'alsea_mexico', label: 'Starbucks México', es: 'Starbucks México (Alsea)', en: 'Starbucks Mexico (Alsea)', aliases: ['starbucks mx', 'sbux mx', 'alsea mexico', 'alsea mx'], featured: true},
    {id: 'alcampo', circuit: 'alcampo', label: 'Alcampo', es: 'Alcampo · supermercados', en: 'Alcampo · supermarkets', aliases: ['auchan'], featured: true},
    {id: 'canalkiosk', circuit: 'kioskos', label: 'CanalKiosk', es: 'CanalKiosk · kioskos de prensa', en: 'CanalKiosk · press kiosks', aliases: ['canal kiosk', 'kioskos', 'kiosko', 'kioscos', 'kiosco', 'kiosk', 'kiosks'], featured: true},
    {id: 'jti', circuit: 'jti_xtanco', label: 'JTI Xtanco', es: 'JTI Xtanco España', en: 'JTI Xtanco Spain', aliases: ['jti xtanco', 'xtanco'], featured: true},
    {id: 'estancos', circuit: 'estancos', label: 'Estancos', es: 'Xtanco Nacional · estancos', en: 'National Xtanco · tobacconists', aliases: ['estanco', 'xtanco nacional', 'tobacconists']},
    {id: 'decathlon', circuit: 'decathlon', label: 'Decathlon', es: 'Decathlon España', en: 'Decathlon Spain', aliases: []},
    {id: 'bbva', circuit: 'bbva', label: 'BBVA', es: 'BBVA España', en: 'BBVA Spain', aliases: []},
    {id: 'caixabank', circuit: 'caixabank', label: 'CaixaBank', es: 'La Caixa / CaixaBank', en: 'La Caixa / CaixaBank', aliases: ['la caixa', 'caixa']},
    {id: 'banorte', circuit: 'banorte_mx', label: 'Banorte', es: 'Banorte México', en: 'Banorte Mexico', aliases: ['banorte mx']},
    {id: 'elcorteingles', circuit: 'elcorteingles', label: 'El Corte Inglés', es: 'El Corte Inglés', en: 'El Corte Inglés', aliases: ['el corte ingles', 'corte ingles', 'eci']},
    {id: 'correos', circuit: 'correos', label: 'Correos', es: 'Correos España', en: 'Correos Spain', aliases: []},
    {id: 'multiopticas', circuit: 'multiopticas', label: 'MultiÓpticas', es: 'MultiÓpticas España', en: 'MultiÓpticas Spain', aliases: ['multi opticas']},
    {id: 'palacio', circuit: 'palacio', label: 'El Palacio de Hierro', es: 'El Palacio de Hierro · México', en: 'El Palacio de Hierro · Mexico', aliases: ['palacio de hierro', 'el palacio de hierro']},
    {id: 'liverpool', circuit: 'liverpool_mx', label: 'Liverpool', es: 'Liverpool · México', en: 'Liverpool · Mexico', aliases: ['liverpool mx']},
    {id: 'desigual', circuit: 'desigual', label: 'Desigual', es: 'Desigual', en: 'Desigual', aliases: []},
    {id: 'mango', circuit: 'mango', label: 'Mango', es: 'Mango', en: 'Mango', aliases: []},
    {id: 'admiraxperience', circuit: 'admiraxperience', label: 'AdmiraXperience', es: 'AdmiraXperience', en: 'AdmiraXperience', aliases: ['admira xperience', 'xperience']},
    {id: 'metro', circuit: 'metro_bcn', label: 'Metro BCN', es: 'Metro de Barcelona', en: 'Barcelona Metro', aliases: ['metro bcn', 'metro barcelona']},
  ];
  const CLIENT_KEYS = new Map();
  for (const c of CLIENTS) for (const alias of [c.id, c.circuit, c.label, ...c.aliases]) if (!CLIENT_KEYS.has(key(alias))) CLIENT_KEYS.set(key(alias), c);

  // Exacto por id/alias/circuito; si no, prefijo único de al menos 3 letras.
  function resolveClient(value) {
    const k = key(value);
    if (!k) return null;
    if (CLIENT_KEYS.has(k)) return CLIENT_KEYS.get(k);
    const found = k.length >= 3 ? new Set([...CLIENT_KEYS].filter(([alias]) => alias.startsWith(k)).map(([, c]) => c)) : new Set();
    return found.size === 1 ? [...found][0] : null;
  }
  function clientCandidates(prefix) {
    const k = key(prefix);
    return CLIENTS.filter(c => !k || [c.id, c.circuit, c.label, ...c.aliases].some(a => key(a).startsWith(k))).map(c => c.id);
  }

  const ATTRIBUTES = {
    cliente: {id: 'cliente', aliases: ['client', 'customer', 'circuito', 'circuit'], es: 'cliente', en: 'client', values: CLIENTS},
    texto: {id: 'texto', aliases: ['text', 'q', 'query', 'lugar', 'place'], es: 'texto', en: 'text', free: true},
  };
  function attributeFor(verb, name) {
    const k = key(name);
    return verb.attributes.find(id => id === k || ATTRIBUTES[id].aliases.some(a => key(a) === k)) || null;
  }

  const fail = (...lines) => ({ok: false, lines});
  const done = (...lines) => ({ok: true, lines});
  const clientName = (c, lang) => (c ? L(lang, c.es, c.en) : '');

  // run(args, ctx, lang) → {ok, lines}. ctx devuelve {ok:false, reason} si no puede.
  const VERBS = [
    {
      id: 'demo', command: '/demo', aliases: ['cli'], attributes: ['cliente'], requires: [],
      es: 'Demo guiada con compra simulada. Sin cliente: Xtanco Valencia; con cliente: un Xpacio real de su circuito.',
      en: 'Guided demo with a simulated purchase. No client: Xtanco Valencia; with a client: a real Xpacio from its circuit.',
      run(args, ctx, lang) {
        const client = args.cliente ? resolveClient(args.cliente) : null;
        const r = ctx.demo(client ? client.id : null) || {};
        if (r.ok === false) {
          if (r.reason === 'loading') return fail(L(lang, 'La demo está cargando. Vuelve a ejecutar la orden.', 'The demo is loading. Run the command again.'));
          if (r.reason === 'no_xpacio') return fail(L(lang, `El catálogo cargado no tiene ningún Xpacio de ${clientName(client, lang)} con pantallas en directo o programadas: no hay recorrido que mostrar.`, `The loaded catalogue has no ${clientName(client, lang)} Xpacio with live or scheduled screens: there is no tour to show.`));
          return fail(L(lang, 'No se pudo iniciar la demo.', 'The demo could not start.'));
        }
        const where = (r.name ? ' · ' + r.name : '') + (r.live === false ? L(lang, ' (pantallas programadas, aún no en directo)', ' (scheduled screens, not live yet)') : '');
        return done(client
          ? L(lang, `Demo de ${clientName(client, lang)} iniciada${where}. Compra simulada.`, `${clientName(client, lang)} demo started${where}. Simulated purchase.`)
          : L(lang, `Demo guiada iniciada${where || ' · Xtanco Valencia'}. Compra simulada.`, `Guided demo started${where || ' · Xtanco Valencia'}. Simulated purchase.`));
      },
    },
    {
      id: 'circuito', command: '/circuito', aliases: ['circuit'], attributes: ['cliente'], requires: ['cliente'],
      es: 'Abre «Seleccionar circuito» con el circuito del cliente, lo selecciona entero y encuadra el mapa.',
      en: 'Opens “Select circuit” on the client’s circuit, selects all of it and frames the map.',
      run(args, ctx, lang) {
        const client = resolveClient(args.cliente);
        const r = ctx.circuit(client.circuit) || {};
        if (r.ok === false) return fail(r.reason === 'empty'
          ? L(lang, `El circuito ${clientName(client, lang)} no tiene puntos en el catálogo cargado.`, `The ${clientName(client, lang)} circuit has no points in the loaded catalogue.`)
          : L(lang, 'El selector de circuitos aún no está listo. Vuelve a intentarlo.', 'The circuit selector is not ready yet. Try again.'));
        return done(L(lang, `Circuito ${clientName(client, lang)} seleccionado${r.count ? ` · ${r.count} puntos` : ''}.`, `${clientName(client, lang)} circuit selected${r.count ? ` · ${r.count} points` : ''}.`));
      },
    },
    {
      id: 'buscar', command: '/buscar', aliases: ['search'], attributes: ['texto'], requires: ['texto'],
      es: 'Busca en el mapa como el buscador de la cabecera: primero Xpacios, luego direcciones.',
      en: 'Searches the map like the header search: Xpacios first, then addresses.',
      run(args, ctx, lang) {
        const r = ctx.search(args.texto) || {};
        if (r.ok === false) return fail(L(lang, 'El buscador del mapa aún no está listo.', 'The map search is not ready yet.'));
        return done(L(lang, `Buscando «${args.texto}» en el mapa.`, `Searching “${args.texto}” on the map.`));
      },
    },
    {
      id: 'parar', command: '/parar', aliases: ['stop', 'salir'], attributes: [], requires: [],
      es: 'Para la demo guiada y cualquier recorrido del mapa en curso.',
      en: 'Stops the guided demo and any map tour in progress.',
      run(args, ctx, lang) { ctx.stop(); return done(L(lang, 'Demo y recorridos detenidos.', 'Demo and tours stopped.')); },
    },
    {
      id: 'limpiar', command: '/limpiar', aliases: ['clear', 'cls'], attributes: [], requires: [],
      es: 'Vacía la salida del CLI (el historial ↑/↓ se conserva).',
      en: 'Clears the CLI output (↑/↓ history is kept).',
      run(args, ctx) { ctx.clear(); return {ok: true, lines: [], cleared: true}; },
    },
    {
      id: 'help', command: '/help', aliases: ['ayuda', 'h'], attributes: [], requires: [],
      es: 'Lista verbos, atributos y rutinas.',
      en: 'Lists verbs, attributes and routines.',
      run(args, ctx, lang) { return done(...helpLines(lang, ctx.routines ? ctx.routines() : defaultRoutines(lang))); },
    },
  ];
  const VERB_KEYS = new Map();
  for (const v of VERBS) for (const alias of [v.id, ...v.aliases]) VERB_KEYS.set(key(alias), v);

  function usage(verb, lang) {
    return verb.command + verb.attributes.map(a => (verb.requires.includes(a) ? ` <${L(lang, ATTRIBUTES[a].es, ATTRIBUTES[a].en)}>` : ` [${L(lang, ATTRIBUTES[a].es, ATTRIBUTES[a].en)}]`)).join('');
  }

  // «/demo starbucks», «/demo cliente=alcampo», «demo cliente: Starbucks México».
  function parse(input) {
    const raw = String(input == null ? '' : input).trim();
    if (!raw) return {ok: false, error: 'empty', raw};
    const m = raw.match(/^\/?(\S+)\s*([\s\S]*)$/);
    const verb = VERB_KEYS.get(key(m[1]));
    if (!verb) return {ok: false, error: 'unknown_verb', raw, input: m[1], suggestions: VERBS.filter(v => v.id.startsWith(key(m[1]).slice(0, 2))).map(v => v.command)};
    const rest = m[2].trim(), args = {};
    if (rest) {
      const kv = rest.match(/^([^\s=:]+)\s*[=:]\s*([\s\S]+)$/);
      const named = kv && attributeFor(verb, kv[1]);
      const attr = named || verb.attributes[0];
      if (!attr) return {ok: false, error: 'no_attributes', raw, verb};
      const value = (named ? kv[2] : rest).trim();
      if (ATTRIBUTES[attr].values) {
        const client = resolveClient(value);
        if (!client) return {ok: false, error: 'unknown_value', raw, verb, attribute: attr, input: value, suggestions: clientCandidates(value.slice(0, 3))};
        args[attr] = client.id;
      } else args[attr] = value;
    }
    const missing = verb.requires.find(a => !args[a]);
    if (missing) return {ok: false, error: 'missing_attribute', raw, verb, attribute: missing};
    return {ok: true, raw, verb, args, command: canonical(verb, args)};
  }
  const canonical = (verb, args) => [verb.command, ...verb.attributes.filter(a => args[a]).map(a => args[a])].join(' ');

  function errorLines(parsed, lang) {
    const verbs = VERBS.map(v => v.command).join(', ');
    switch (parsed.error) {
      case 'empty': return [L(lang, 'Escribe una orden. /help lista los verbos.', 'Type a command. /help lists the verbs.')];
      case 'unknown_verb': return [L(lang, `Comando no reconocido: ${parsed.input}. Verbos: ${verbs}.`, `Unknown command: ${parsed.input}. Verbs: ${verbs}.`)];
      case 'no_attributes': return [L(lang, `${parsed.verb.command} no admite atributos.`, `${parsed.verb.command} takes no attributes.`)];
      case 'unknown_value': return [L(lang, `Cliente no reconocido: «${parsed.input}».`, `Unknown client: “${parsed.input}”.`),
        L(lang, 'Clientes: ', 'Clients: ') + (parsed.suggestions.length ? parsed.suggestions : CLIENTS.map(c => c.id)).join(', ') + '.'];
      case 'missing_attribute': return [L(lang, `Falta el ${ATTRIBUTES[parsed.attribute].es}. Uso: ${usage(parsed.verb, lang)}`, `Missing ${ATTRIBUTES[parsed.attribute].en}. Usage: ${usage(parsed.verb, lang)}`)];
      default: return [L(lang, 'Orden no válida.', 'Invalid command.')];
    }
  }

  function execute(input, ctx, lang = 'es') {
    const parsed = parse(input);
    if (!parsed.ok) return {ok: false, lines: errorLines(parsed, lang), parsed};
    const result = parsed.verb.run(parsed.args, ctx, lang);
    return Object.assign({parsed, command: parsed.command}, result);
  }

  // Tab: completa el verbo y después el valor del atributo enumerado.
  function commonPrefix(list) {
    if (!list.length) return '';
    return list.reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
  }
  function complete(input) {
    const raw = String(input == null ? '' : input).replace(/^\s+/, '');
    const text = raw.startsWith('/') ? raw : '/' + raw;
    const space = text.search(/\s/);
    if (space < 0) {
      const options = VERBS.filter(v => v.command.startsWith(text.toLowerCase())).map(v => v.command);
      if (options.length === 1) { const verb = VERB_KEYS.get(key(options[0])); return {value: options[0] + (verb.attributes.length ? ' ' : ''), options}; }
      return {value: options.length ? commonPrefix(options) : raw, options};
    }
    const verb = VERB_KEYS.get(key(text.slice(1, space)));
    if (!verb || !verb.attributes.length) return {value: raw, options: []};
    const rest = text.slice(space).trim();
    const kv = rest.match(/^([^\s=:]+)\s*[=:]\s*(.*)$/);
    const attr = (kv && attributeFor(verb, kv[1])) || verb.attributes[0];
    if (!ATTRIBUTES[attr].values) return {value: raw, options: []};
    const options = clientCandidates(kv && attributeFor(verb, kv[1]) ? kv[2] : rest);
    const head = verb.command + ' ' + (kv && attributeFor(verb, kv[1]) ? attr + '=' : '');
    if (options.length === 1) return {value: head + options[0], options};
    const prefix = commonPrefix(options);
    return {value: prefix.length > key(rest).length ? head + prefix : raw, options};
  }

  // Rutinas generadas del registro: verbo × cliente destacado.
  function defaultRoutines(lang = 'es') {
    const featured = CLIENTS.filter(c => c.featured);
    return [
      ...featured.map(c => ({id: 'demo:' + c.id, label: 'Demo ' + c.label, command: '/demo ' + c.id, builtin: true})),
      ...featured.map(c => ({id: 'circuito:' + c.id, label: L(lang, 'Circuito ', 'Circuit ') + c.label, command: '/circuito ' + c.id, builtin: true})),
    ];
  }

  // Rutinas propias: solo órdenes válidas, sin duplicados, persistidas por el navegador.
  const ROUTINES_KEY = 'admira_expert_routines_v1';
  const MAX_ROUTINES = 24;
  function sanitizeRoutines(raw) {
    const seen = new Set(), list = [];
    for (const item of Array.isArray(raw) ? raw : []) {
      const parsed = parse(item && item.command);
      if (!parsed.ok || parsed.verb.id === 'limpiar' || seen.has(parsed.command)) continue;
      seen.add(parsed.command);
      const label = String((item && item.label) || parsed.command).trim().slice(0, 60) || parsed.command;
      list.push({id: 'mine:' + parsed.command, label, command: parsed.command, builtin: false});
    }
    return list.slice(-MAX_ROUTINES);
  }
  function loadRoutines(storage) {
    try { return sanitizeRoutines(JSON.parse(storage.getItem(ROUTINES_KEY) || '[]')); } catch (_) { return []; }
  }
  function saveRoutines(storage, list) {
    try { storage.setItem(ROUTINES_KEY, JSON.stringify(sanitizeRoutines(list).map(({label, command}) => ({label, command})))); return true; } catch (_) { return false; }
  }
  function addRoutine(list, command, label) {
    const parsed = parse(command);
    if (!parsed.ok || parsed.verb.id === 'limpiar') return {ok: false, list};
    if (list.some(r => r.command === parsed.command)) return {ok: false, duplicate: true, list};
    return {ok: true, list: sanitizeRoutines([...list, {label: label || parsed.command, command: parsed.command}])};
  }
  const removeRoutine = (list, id) => list.filter(r => r.id !== id);

  function helpLines(lang = 'es', routines = defaultRoutines(lang)) {
    return [
      L(lang, 'VERBOS', 'VERBS'),
      ...VERBS.map(v => `${usage(v, lang)} — ${L(lang, v.es, v.en)}${v.aliases.length ? ` (${L(lang, 'alias', 'aliases')}: ${v.aliases.map(a => '/' + a).join(', ')})` : ''}`),
      L(lang, 'ATRIBUTOS', 'ATTRIBUTES'),
      `${L(lang, 'cliente', 'client')}: ` + CLIENTS.map(c => `${c.id} (${L(lang, c.es, c.en)} · ${c.circuit})`).join(', '),
      `${L(lang, 'texto', 'text')}: ${L(lang, 'texto libre para /buscar', 'free text for /search')}`,
      L(lang, 'Forma: /demo starbucks · /demo cliente=alcampo · mayúsculas y acentos dan igual.', 'Form: /demo starbucks · /demo client=alcampo · case and accents do not matter.'),
      L(lang, 'RUTINAS', 'ROUTINES'),
      ...routines.map(r => `${r.label} → ${r.command}${r.builtin ? '' : L(lang, ' (tuya)', ' (yours)')}`),
      L(lang, 'Atajos: Tab completa · ↑/↓ historial · Esc cierra.', 'Shortcuts: Tab completes · ↑/↓ history · Esc closes.'),
    ];
  }

  // Xpacio de demo de un circuito: el que tenga pantallas en directo, mejor si
  // están enlazadas a la parrilla (ventas reales) y tiene Xpacio 3D asociado.
  // Si el circuito solo tiene pantallas programadas (sched), se usan esas y la
  // demo lo dice: nunca se presentan como emisión en directo.
  const surfacesWith = (loc, status) => (loc && Array.isArray(loc.surfaces) ? loc.surfaces : []).filter(s => s && s.status === status && s.surface !== 'pwa');
  const liveSurfaces = loc => surfacesWith(loc, 'live');
  function demoSurfaces(loc) {
    const live = surfacesWith(loc, 'live');
    return live.length ? {live: true, surfaces: live} : {live: false, surfaces: surfacesWith(loc, 'sched')};
  }
  function demoScreens(loc) {
    const ids = new Set();
    for (const s of loc && Array.isArray(loc.surfaces) ? loc.surfaces : []) {
      if (typeof s.screen === 'string' && s.screen) ids.add(s.screen);
      for (const id of Array.isArray(s.pixerScreens) ? s.pixerScreens : []) if (typeof id === 'string' && id) ids.add(id);
    }
    return [...ids];
  }
  function pickDemoXpacio(items) {
    let best = null, bestScore = -1;
    for (const loc of Array.isArray(items) ? items : []) {
      const {live, surfaces} = demoSurfaces(loc);
      if (!surfaces.length || !Array.isArray(loc.coords)) continue;
      const priced = surfaces.some(s => Number(s.impr) > 0 && Number(String(s.cpm || '').replace(/[^\d.]/g, '')) > 0);
      const score = (live ? 16 : 0) + Math.min(3, surfaces.length) + (priced ? 8 : 0) + (demoScreens(loc).length ? 4 : 0) + (loc.xpaceUrl ? 2 : 0);
      if (score > bestScore) { best = loc; bestScore = score; }
    }
    return best;
  }

  const api = Object.freeze({
    CLIENTS, ATTRIBUTES, VERBS, ROUTINES_KEY, key, resolveClient, clientCandidates, parse, execute, errorLines, usage,
    complete, defaultRoutines, sanitizeRoutines, loadRoutines, saveRoutines, addRoutine, removeRoutine, helpLines,
    pickDemoXpacio, demoScreens, liveSurfaces, demoSurfaces,
  });
  root.AdmiraExpertCommands = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
