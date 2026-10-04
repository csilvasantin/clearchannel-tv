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

  // Marcas blancas (FLT-101331): ids del catálogo único de admiranext.com/marcablanca.
  // La semilla vale sin red; marca-blanca.js la sustituye por el catálogo real (setBrands)
  // cuando ya se habla con admiranext.com (hay marca activa o se ha usado /marca).
  const BRAND_ID = /^[a-z0-9][a-z0-9-]{0,40}$/;
  const BRAND_OFF = ['off', 'admira', 'ninguna', 'ninguno', 'none', 'default', 'apagar', 'quitar', 'reset'];
  const BRAND_SEED = [
    {id: 'admira', nombre: 'Admira'}, {id: 'lumbre', nombre: 'Lumbre Café', ejemplo: true},
    {id: 'brumelle', nombre: 'BRUMELLE', ejemplo: true}, {id: 'frescaria', nombre: 'Frescaria Supermercados', ejemplo: true},
  ];
  let BRANDS = BRAND_SEED.slice();
  function setBrands(list) {
    const clean = (Array.isArray(list) ? list : []).filter(b => b && BRAND_ID.test(String(b.id || '')))
      .map(b => ({id: String(b.id), nombre: String(b.nombre || b.id), ejemplo: !!b.ejemplo, propuesta: !!b.propuesta}));
    if (clean.length) BRANDS = clean;
    return BRANDS.slice();
  }
  const brands = () => BRANDS.slice();
  // Algo que parezca un dominio o una URL http(s): se abre en el analizador de marca.
  function brandUrl(value) {
    let v = String(value == null ? '' : value).trim();
    if (!v || /\s/.test(v)) return null;
    if (!/^https?:\/\//i.test(v)) {
      if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i.test(v)) return null;
      v = 'https://' + v;
    }
    try {
      const u = new URL(v);
      return /^https?:$/.test(u.protocol) && !u.username && !u.password && /\./.test(u.hostname) ? u.href : null;
    } catch (_) { return null; }
  }
  // «off» (o admira) · URL · id del catálogo. El id se comprueba al ejecutar (catálogo vivo).
  function parseBrand(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return null;
    if (BRAND_OFF.includes(key(raw))) return 'off';
    const url = brandUrl(raw);
    if (url) return url;
    const id = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s_]+/g, '-');
    return BRAND_ID.test(id) ? id : null;
  }
  const brandList = lang => BRANDS.map(b => b.id + (b.propuesta ? L(lang, ' (propuesta)', ' (proposal)') : b.ejemplo ? L(lang, ' (ejemplo)', ' (sample)') : '')).join(', ');

  const ATTRIBUTES = {
    cliente: {id: 'cliente', aliases: ['client', 'customer', 'circuito', 'circuit'], es: 'cliente', en: 'client', values: CLIENTS},
    texto: {id: 'texto', aliases: ['text', 'q', 'query', 'lugar', 'place'], es: 'texto', en: 'text', free: true},
    marca: {id: 'marca', aliases: ['brand', 'id', 'web', 'url'], es: 'marca', en: 'brand', brands: true},
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
      id: 'demo', command: '/demo', aliases: ['cli'], attributes: ['cliente'], requires: [], map: true,
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
      id: 'circuito', command: '/circuito', aliases: ['circuit'], attributes: ['cliente'], requires: ['cliente'], map: true,
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
      id: 'buscar', command: '/buscar', aliases: ['search'], attributes: ['texto'], requires: ['texto'], map: true,
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
      id: 'marca', command: '/marca', aliases: ['brand', 'marcablanca'], attributes: ['marca'], requires: [],
      es: 'Marca blanca del catálogo de admiranext.com/marcablanca: /marca <id> viste la web con esa marca, /marca off vuelve a Admira, /marca sola dice cuál está activa y lista las disponibles, /marca <web> abre el analizador en otra pestaña.',
      en: 'White label from the admiranext.com/marcablanca catalogue: /marca <id> dresses the site in that brand, /marca off returns to Admira, /marca alone shows the active one and lists them, /marca <website> opens the analyser in a new tab.',
      run(args, ctx, lang) {
        const M = ctx && ctx.marca;
        // Segmentación del globo (cliente-segmento.js): /marca <cliente> deja solo sus puntos, aunque
        // el cliente no tenga marca blanca en el catálogo; /marca off vuelve a Admira (todos).
        const S = typeof root !== 'undefined' && root && root.AdmiraSegmento;
        const G = typeof root !== 'undefined' && root && root.AdmiraGlobo;
        const seg = () => (G ? G.segmento() : null);
        const segLine = () => { const g = seg(); return g ? (g.cliente === 'admira'
          ? L(lang, `Globo: Admira, todos los puntos (${g.puntos}).`, `Globe: Admira, all points (${g.puntos}).`)
          : g.puntos === g.total ? L(lang, `Globo: «${g.cliente}» no tiene puntos propios; se ven todos (${g.total}).`, `Globe: “${g.cliente}” has no points of its own; showing all (${g.total}).`)
          : L(lang, `Globo segmentado: ${g.cliente}, ${g.puntos} de ${g.total} puntos.`, `Globe segmented: ${g.cliente}, ${g.puntos} of ${g.total} points.`)) : null; };
        if (S && args.marca && !/^https?:\/\//.test(args.marca)) S.fijar(args.marca === 'off' ? null : args.marca);
        if (!M) return S && args.marca ? done(segLine()) : fail(L(lang, 'La marca blanca aún no está lista en esta página. Vuelve a intentarlo en un momento.', 'White label is not ready on this page yet. Try again in a moment.'));
        const value = args.marca;
        const tag = b => (b && b.propuesta ? L(lang, ' · propuesta automática, no es la marca oficial', ' · automatic proposal, not the official brand') : b && b.ejemplo ? L(lang, ' · marca ficticia de ejemplo', ' · fictional sample brand') : '');
        if (!value) {
          const now = M.actual();
          const head = now
            ? L(lang, `Marca activa: ${now.nombre} (${now.id})${tag(now)}. /marca off vuelve a Admira.`, `Active brand: ${now.nombre} (${now.id})${tag(now)}. /marca off returns to Admira.`)
            : L(lang, 'Sin marca blanca: ves el aspecto de Admira.', 'No white label: you see the Admira look.');
          const later = M.listar().then(
            list => { setBrands(list); return done(L(lang, 'Disponibles: ', 'Available: ') + brandList(lang) + '.'); },
            () => fail(L(lang, 'No se pudo leer el catálogo de admiranext.com. Conocidas: ', 'Could not read the admiranext.com catalogue. Known: ') + brandList(lang) + '.'));
          return {ok: true, lines: [head], later};
        }
        if (value === 'off') {
          const r = M.desactivar();
          return done(...(seg() ? [segLine()] : []), r.changed
            ? L(lang, `Marca ${r.previous.nombre} desactivada: vuelve Admira.`, `${r.previous.nombre} brand turned off: back to Admira.`)
            : L(lang, 'No había ninguna marca blanca activa: ya ves Admira.', 'No white label was active: you already see Admira.'));
        }
        if (/^https?:\/\//.test(value)) {
          const r = M.analizar(value);
          if (!r.ok) return fail(L(lang, `No parece una web válida: «${value}».`, `That does not look like a valid website: “${value}”.`));
          return done(L(lang, `Abriendo el analizador de marca blanca en otra pestaña: ${r.href}`, `Opening the white-label analyser in a new tab: ${r.href}`),
            L(lang, 'Allí se analiza la web y se guarda en el catálogo; después actívala aquí con /marca <id>.', 'There the site is analysed and saved to the catalogue; then turn it on here with /marca <id>.'));
        }
        const later = M.activar(value).then(r => {
          if (r.ok) { if (!BRANDS.some(b => b.id === r.id)) BRANDS = [...BRANDS, {id: r.id, nombre: r.nombre, ejemplo: !!r.ejemplo, propuesta: !!r.propuesta}];
            return done(...(seg() ? [segLine()] : []), L(lang, `Marca ${r.nombre} (${r.id}) activa${tag(r)}. Se mantiene al navegar en esta pestaña; /marca off vuelve a Admira.`, `${r.nombre} (${r.id}) brand on${tag(r)}. It stays while you browse in this tab; /marca off returns to Admira.`)); }
          if (r.reason === 'unknown' && S && seg() && seg().cliente !== 'admira') return done(segLine(), L(lang, `(«${value}» no tiene marca blanca en el catálogo: se mantiene el aspecto, solo cambian los puntos.)`, `(“${value}” has no white label in the catalogue: the look stays, only the points change.)`));
          if (r.reason === 'unknown') return fail(L(lang, `La marca «${value}» no está en el catálogo de admiranext.com. No se ha aplicado nada.`, `The brand “${value}” is not in the admiranext.com catalogue. Nothing was applied.`),
            L(lang, 'Disponibles: ', 'Available: ') + brandList(lang) + L(lang, '. Para crearla: /marca <web de la marca>.', '. To create it: /marca <brand website>.'));
          return fail(L(lang, 'No se pudo hablar con admiranext.com: la web sigue con su aspecto normal.', 'Could not reach admiranext.com: the site keeps its normal look.'));
        });
        return {ok: true, lines: [L(lang, `Aplicando la marca ${value}…`, `Applying the ${value} brand…`)], later};
      },
    },
    {
      id: 'help', command: '/help', aliases: ['ayuda', 'h'], attributes: [], requires: [],
      es: 'Lista verbos, atributos y rutinas.',
      en: 'Lists verbs, attributes and routines.',
      run(args, ctx, lang) { return done(...helpLines(lang, ctx.routines ? ctx.routines() : defaultRoutines(lang), {away: typeof ctx.handoff === 'function'})); },
    },
  ];
  const VERB_KEYS = new Map();
  for (const v of VERBS) for (const alias of [v.id, ...v.aliases]) VERB_KEYS.set(key(alias), v);

  // Verbos propios de una página del shell cuadrático (FLT-101311): solo existen
  // en esa página (local), no pisan verbos ni alias ya registrados y no se
  // guardan como rutinas, porque las rutinas se comparten entre páginas.
  function registerVerb(def) {
    const id = key(def && def.id);
    if (!id || typeof def.run !== 'function') throw new TypeError('registerVerb: id y run son obligatorios');
    const aliases = (Array.isArray(def.aliases) ? def.aliases : []).map(String);
    const attributes = (Array.isArray(def.attributes) ? def.attributes : []).filter(a => ATTRIBUTES[a]);
    const requires = (Array.isArray(def.requires) ? def.requires : []).filter(a => attributes.includes(a));
    if ([id, ...aliases].some(a => VERB_KEYS.has(key(a)))) throw new Error('registerVerb: el verbo /' + id + ' ya existe');
    const verb = {id, command: '/' + id, aliases, attributes, requires, local: true,
      es: String(def.es || def.en || ''), en: String(def.en || def.es || ''), run: def.run};
    VERBS.push(verb);
    for (const alias of [id, ...aliases]) VERB_KEYS.set(key(alias), verb);
    return verb;
  }

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
      } else if (ATTRIBUTES[attr].brands) {
        const brand = parseBrand(value);
        if (!brand) return {ok: false, error: 'invalid_brand', raw, verb, attribute: attr, input: value};
        args[attr] = brand;
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
      case 'invalid_brand': return [L(lang, `Marca no válida: «${parsed.input}».`, `Invalid brand: “${parsed.input}”.`),
        L(lang, `Usa un id del catálogo (${BRANDS.map(b => b.id).join(', ')}), off para volver a Admira o una web (starbucks.es) para analizarla.`, `Use a catalogue id (${BRANDS.map(b => b.id).join(', ')}), off to return to Admira or a website (starbucks.es) to analyse it.`)];
      case 'missing_attribute': return [L(lang, `Falta el ${ATTRIBUTES[parsed.attribute].es}. Uso: ${usage(parsed.verb, lang)}`, `Missing ${ATTRIBUTES[parsed.attribute].en}. Usage: ${usage(parsed.verb, lang)}`)];
      default: return [L(lang, 'Orden no válida.', 'Invalid command.')];
    }
  }

  // /cli sigue siendo alias de /demo. Solo /cli ayudante|helper (y /avatarDigital)
  // es el interruptor del avatar (FLT-101350).
  function isAvatarCommand(text) {
    const raw = String(text == null ? '' : text).trim();
    const m = raw.match(/^\/?([^\s@]+)(?:@\S+)?(?:\s+([\s\S]*))?$/);
    if (!m) return false;
    const verb = m[1].toLowerCase();
    if (verb === 'avatardigital' || verb === 'digitalavatar') return true;
    // Cargador común (encargo avatar · 4-oct-2026): /avatarON, /avatarOFF, /avatar [on|off|reset].
    if (verb === 'avataron' || verb === 'avataroff') return true;
    if (verb === 'avatar') return /^(on|off|reset|good|better|best)?$/i.test((m[2] || '').trim());
    if (verb !== 'cli') return false;
    return /^(ayudante|helper)(?:\s|$)/i.test(m[2] || '');
  }
  // El worker inyecta el cargador común (window.AdmiraAvatar). Si aún no ha llegado se
  // espera a su <script>; sin él, queda el módulo antiguo /avatar-digital.js.
  function loadAvatar() {
    if (root.AdmiraAvatar) return Promise.resolve(root.AdmiraAvatar);
    if (typeof document === 'undefined') return Promise.resolve(null);
    const tag = document.querySelector('script[data-admira-avatar]');
    if (tag) {
      return new Promise(resolve => {
        tag.addEventListener('load', () => resolve(root.AdmiraAvatar || null), {once: true});
        tag.addEventListener('error', () => resolve(null), {once: true});
        setTimeout(() => resolve(root.AdmiraAvatar || null), 4000);
      }).then(A => A || loadOldAvatar());
    }
    return loadOldAvatar();
  }
  function loadOldAvatar() {
    if (root.AvatarDigital) return Promise.resolve(root.AvatarDigital);
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = '/avatar-digital.js';
      s.async = true;
      s.onload = () => resolve(root.AvatarDigital || null);
      s.onerror = () => resolve(null);
      (document.head || document.documentElement).append(s);
    });
  }
  function execute(input, ctx, lang = 'es') {
    if (isAvatarCommand(input)) {
      const en = lang === 'en';
      const later = loadAvatar()
        .then(A => (A ? A.handle(input) : (en ? 'Digital avatar unavailable' : 'Avatar digital no disponible')))
        .then(text => ({ok: true, lines: [String(text || '')]}));
      return {
        ok: true, lines: ['…'], later, command: String(input || ''),
        parsed: {verb: {id: 'avatardigital', local: true}, raw: String(input || '')},
      };
    }
    const parsed = parse(input);
    if (!parsed.ok) return {ok: false, lines: errorLines(parsed, lang), parsed};
    // Fuera del mapa (cualquier página del shell salvo la portada) los verbos de
    // mapa se traspasan a la portada: la página guarda la orden y navega.
    if (parsed.verb.map && ctx && typeof ctx.handoff === 'function') {
      const r = ctx.handoff(parsed.command) || {};
      if (r.ok === false) return {ok: false, parsed, command: parsed.command, lines: [L(lang, 'No se pudo abrir el mapa de la portada.', 'The home map could not be opened.')]};
      return {ok: true, parsed, command: parsed.command, handoff: true,
        lines: [L(lang, `Abriendo el mapa de la portada para ejecutar ${parsed.command}…`, `Opening the home map to run ${parsed.command}…`)]};
    }
    const result = parsed.verb.run(parsed.args, ctx, lang);
    return Object.assign({parsed, command: parsed.command}, result);
  }

  // Orden pendiente de traspaso a la portada: solo la orden canónica de un verbo
  // de mapa, en sessionStorage (nunca en la URL) y con caducidad corta.
  const PENDING_KEY = 'admira_expert_pending_v1';
  const PENDING_TTL = 2 * 60 * 1000;
  function savePending(storage, command, now = Date.now()) {
    const parsed = parse(command);
    if (!parsed.ok || !parsed.verb.map) return false;
    try { storage.setItem(PENDING_KEY, JSON.stringify({command: parsed.command, at: now})); return true; } catch (_) { return false; }
  }
  function takePending(storage, now = Date.now()) {
    let raw = null;
    try { raw = storage.getItem(PENDING_KEY); storage.removeItem(PENDING_KEY); } catch (_) { return null; }
    try {
      const item = JSON.parse(raw || 'null');
      if (!item || typeof item.command !== 'string' || !(now - Number(item.at) >= 0 && now - Number(item.at) <= PENDING_TTL)) return null;
      const parsed = parse(item.command);
      return parsed.ok && parsed.verb.map ? parsed.command : null;
    } catch (_) { return null; }
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
    if (!ATTRIBUTES[attr].values && !ATTRIBUTES[attr].brands) return {value: raw, options: []};
    const typed = kv && attributeFor(verb, kv[1]) ? kv[2] : rest;
    const options = ATTRIBUTES[attr].brands
      ? [...BRANDS.map(b => b.id), 'off'].filter(id => id.startsWith(String(typed).trim().toLowerCase()))
      : clientCandidates(typed);
    const head = verb.command + ' ' + (kv && attributeFor(verb, kv[1]) ? attr + '=' : '');
    if (options.length === 1) return {value: head + options[0], options};
    const prefix = commonPrefix(options);
    return {value: prefix.length > String(typed).trim().length ? head + prefix : raw, options};
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
      if (!parsed.ok || parsed.verb.id === 'limpiar' || parsed.verb.local || seen.has(parsed.command)) continue;
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
    if (!parsed.ok || parsed.verb.id === 'limpiar' || parsed.verb.local) return {ok: false, list};
    if (list.some(r => r.command === parsed.command)) return {ok: false, duplicate: true, list};
    return {ok: true, list: sanitizeRoutines([...list, {label: label || parsed.command, command: parsed.command}])};
  }
  const removeRoutine = (list, id) => list.filter(r => r.id !== id);

  function helpLines(lang = 'es', routines = defaultRoutines(lang), {away = false} = {}) {
    const where = v => (away && v.map ? L(lang, ' · se ejecuta en el mapa de la portada', ' · runs on the home map') : v.local ? L(lang, ' · solo en esta página', ' · this page only') : '');
    return [
      L(lang, 'VERBOS', 'VERBS'),
      ...VERBS.map(v => `${usage(v, lang)} — ${L(lang, v.es, v.en)}${v.aliases.length ? ` (${L(lang, 'alias', 'aliases')}: ${v.aliases.map(a => '/' + a).join(', ')})` : ''}${where(v)}`),
      L(lang, 'ATRIBUTOS', 'ATTRIBUTES'),
      `${L(lang, 'cliente', 'client')}: ` + CLIENTS.map(c => `${c.id} (${L(lang, c.es, c.en)} · ${c.circuit})`).join(', '),
      `${L(lang, 'texto', 'text')}: ${L(lang, 'texto libre para /buscar', 'free text for /search')}`,
      `${L(lang, 'marca', 'brand')}: off (Admira), ${brandList(lang)} · ${L(lang, 'o una web para analizarla (starbucks.es)', 'or a website to analyse (starbucks.es)')}`,
      L(lang, 'Forma: /demo starbucks · /demo cliente=alcampo · mayúsculas y acentos dan igual.', 'Form: /demo starbucks · /demo client=alcampo · case and accents do not matter.'),
      L(lang, 'RUTINAS', 'ROUTINES'),
      ...routines.map(r => `${r.label} → ${r.command}${r.builtin ? '' : L(lang, ' (tuya)', ' (yours)')}`),
      L(lang, 'Avatar digital: /avatar good abre el calvo (cara 3D, 52 blendshapes) · /avatar better abre la chica (Ready Player Me, gafas) · /avatar best abre a Neo (MetaHuman; si el host de render está apagado, cae a la chica). /avatar sin nivel dice el estado. /avatarON lo muestra y /avatarOFF lo oculta. /avatar reset vuelve al interruptor del proyecto. También /avatarDigital (alias /digitalAvatar, /cli ayudante, /cli helper). /cli seguido de un cliente sigue siendo /demo.',
        'Digital avatar: /avatar good opens the bald 3D face (facecap, 52 blendshapes) · /avatar better opens the web girl (Ready Player Me, glasses) · /avatar best opens Neo (MetaHuman; if the render host is off, the girl takes over). /avatar alone shows the status. /avatarON shows it and /avatarOFF hides it. /avatar reset follows the project switch. Also /avatarDigital (alias /digitalAvatar, /cli ayudante, /cli helper). /cli followed by a client is still /demo.'),
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
    CLIENTS, ATTRIBUTES, VERBS, BRAND_SEED, setBrands, brands, parseBrand, brandUrl, ROUTINES_KEY, PENDING_KEY, PENDING_TTL, registerVerb, savePending, takePending, key, resolveClient, clientCandidates, parse, execute, isAvatarCommand, errorLines, usage,
    complete, defaultRoutines, sanitizeRoutines, loadRoutines, saveRoutines, addRoutine, removeRoutine, helpLines,
    pickDemoXpacio, demoScreens, liveSurfaces, demoSurfaces,
  });
  root.AdmiraExpertCommands = api;
  if (typeof document !== 'undefined') {
    try {
      // Sin cargador común (vista local sin worker) se respeta la elección antigua.
      if (!document.querySelector('script[data-admira-avatar]') && root.localStorage && root.localStorage.getItem('da-avatar:' + (root.location && root.location.host)) === '1') loadAvatar();
    } catch (_) {}
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
