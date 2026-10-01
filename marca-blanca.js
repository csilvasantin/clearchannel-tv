// Marca blanca en admira.app / clearchannel.tv (FLT-101331).
// Viste la web con una marca del catálogo único de https://www.admiranext.com/marcablanca
// (tokens --mb-*, logo, nombre, favicon y tipografía) por encima de la identidad de
// dominio (brand.js: CLEAR·CHANNEL o ADMIRA·APP), sin tocar el mapa satélite.
//
// Un solo mecanismo para todas las páginas: la portada lo carga con
//   <script defer src="marca-blanca.js?v=…"></script>
// y el resto lo recibe de galaxy-shell.js, que lo carga con su mismo sello.
//
// Sin marca activa (ni ?marca=<id> ni marca recordada en la pestaña, o ?marca=admira)
// este fichero no hace nada más: no inserta estilos ni pide nada a admiranext.com.
// Con marca, carga marcablanca.css + marcablanca.js (plataforma «app», sin arranque
// automático) y marca-blanca.css (los ajustes propios de esta web), comprueba que la
// marca existe en el catálogo y solo entonces la aplica. Si admiranext.com no responde,
// la web se queda como estaba. Ver docs/marca-blanca.md.
(function (root) {
  'use strict';

  const BASE = 'https://www.admiranext.com/marcablanca/';
  const SESSION_KEY = 'mb:marca';        // la misma clave que usa el cargador común
  const MODE_KEY = 'mb:modo';
  const ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
  const OFF = ['off', 'admira', 'ninguna', 'ninguno', 'none', 'default', 'apagar', 'quitar', 'reset'];
  const MODES = ['marca', 'nativo', 'claro', 'oscuro', 'auto'];
  const SEED = [
    {id: 'admira', nombre: 'Admira', ejemplo: false},
    {id: 'lumbre', nombre: 'Lumbre Café', ejemplo: true},
    {id: 'brumelle', nombre: 'BRUMELLE', ejemplo: true},
    {id: 'frescaria', nombre: 'Frescaria Supermercados', ejemplo: true},
  ];
  const TIMEOUT = 8000;

  const fold = value => String(value == null ? '' : value).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const isOff = value => OFF.includes(fold(value).replace(/[^a-z]/g, ''));

  // ─── Qué marca toca en esta carga ───
  // ?marca=<id> manda y se recuerda en la pestaña (como el cargador común); ?marca=admira
  // (u off) la olvida; sin parámetro vale la recordada. Un id mal formado se ignora.
  function decide(search, storage) {
    let q = null;
    try { q = new URLSearchParams(search || '').get('marca'); } catch (_) {}
    let stored = null;
    try { stored = storage && storage.getItem(SESSION_KEY); } catch (_) {}
    if (q != null) {
      if (isOff(q) || !fold(q)) return {id: null, forget: true};
      const id = fold(q);
      if (ID_RE.test(id)) return {id, remember: true};
    }
    if (stored && ID_RE.test(stored) && !isOff(stored)) return {id: stored};
    return {id: null};
  }
  function decideMode(search, storage) {
    let q = null;
    try { q = new URLSearchParams(search || '').get('modo'); } catch (_) {}
    if (q && MODES.includes(q)) return q;
    try { const s = storage && storage.getItem(MODE_KEY); if (s && MODES.includes(s)) return s; } catch (_) {}
    return 'marca';
  }

  // ─── /marca <web>: algo que parezca un dominio o una URL http(s) ───
  function looksLikeUrl(value) {
    const v = String(value == null ? '' : value).trim();
    if (!v || /\s/.test(v)) return false;
    if (/^https?:\/\//i.test(v)) return true;
    return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i.test(v);
  }
  function normalizeUrl(value) {
    if (!looksLikeUrl(value)) return null;
    let v = String(value).trim();
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try {
      const u = new URL(v);
      if (!/^https?:$/.test(u.protocol) || u.username || u.password || !/\./.test(u.hostname)) return null;
      return u.href;
    } catch (_) { return null; }
  }
  const analyzerUrl = url => BASE + '?web=' + encodeURIComponent(url);

  // ─── Contraste: textos de la barra y los paneles siempre AA (≥ 4,5:1) ───
  function parseColor(value) {
    const s = String(value == null ? '' : value).trim().toLowerCase();
    let m = s.match(/^#([0-9a-f]{3,8})$/);
    if (m) {
      let h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
      if (h.length !== 6 && h.length !== 8) return null;
      const n = i => parseInt(h.slice(i, i + 2), 16);
      return {r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1};
    }
    m = s.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (m) {
      const ch = x => (x.endsWith('%') ? parseFloat(x) * 2.55 : parseFloat(x));
      const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return {r: ch(m[1]), g: ch(m[2]), b: ch(m[3]), a: Math.max(0, Math.min(1, a))};
    }
    return null;
  }
  const over = (fg, bg) => ({r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1});
  function luminance(c) {
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  }
  function contrast(a, b) {
    const ca = typeof a === 'string' ? parseColor(a) : a, cb = typeof b === 'string' ? parseColor(b) : b;
    if (!ca || !cb) return 0;
    const bg = cb.a < 1 ? over(cb, {r: 0, g: 0, b: 0, a: 1}) : cb;
    const fg = ca.a < 1 ? over(ca, bg) : ca;
    const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }
  // Primer candidato legible sobre todos los fondos; si ninguno lo es, negro o blanco.
  function pick(candidates, backgrounds, min = 4.5) {
    for (const c of candidates) {
      if (!parseColor(c)) continue;
      if (backgrounds.every(bg => contrast(c, bg) >= min)) return c;
    }
    const score = c => Math.min(...backgrounds.map(bg => contrast(c, bg)));
    return score('#000000') >= score('#ffffff') ? '#000000' : '#ffffff';
  }
  // Tokens --mbx-* que usa marca-blanca.css para textos y rellenos de la barra y los paneles.
  function shellTokens(vars, modo) {
    const g = name => (vars && vars['--mb-' + name]) || '';
    const base = modo === 'claro' ? {r: 255, g: 255, b: 255, a: 1} : {r: 0, g: 0, b: 0, a: 1};
    const solid = (value, under) => { const c = parseColor(value); return c ? (c.a < 1 ? over(c, under) : c) : under; };
    const fondo = solid(g('fondo'), base);
    const sup = solid(g('superficie'), fondo);
    // Los textos de la barra y los paneles van sobre el fondo o la superficie de la marca.
    const bgs = [fondo, sup];
    const ink = pick([g('texto')], bgs);
    const brand = pick([g('primario'), g('secundario'), g('texto')], bgs);
    const accent = pick([g('acento'), g('primario'), g('secundario'), g('texto')], bgs);
    const ok = pick([g('ok'), g('texto')], bgs);
    const solidOk = solid(g('ok'), sup);
    return {
      '--mbx-ink': ink,
      '--mbx-mut': pick([g('texto-suave'), g('texto')], bgs),
      '--mbx-brand': brand,
      '--mbx-accent': accent,
      '--mbx-ok': ok,
      '--mbx-error': pick([g('error'), g('texto')], bgs),
      '--mbx-on-brand': pick([g('primario-texto'), g('secundario-texto'), '#ffffff', '#000000'], [solid(brand, sup)]),
      '--mbx-on-accent': pick([g('acento-texto'), g('primario-texto'), '#ffffff', '#000000'], [solid(accent, sup)]),
      '--mbx-on-ok': pick(['#000000', '#ffffff'], [solidOk]),
      '--mbx-ok-fill': g('ok') || ok,
    };
  }

  const api = {BASE, SESSION_KEY, MODE_KEY, SEED, OFF, ID_RE, fold, isOff, decide, decideMode, looksLikeUrl, normalizeUrl, analyzerUrl, parseColor, contrast, pick, shellTokens};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined' || root.AdmiraMarca) return;

  // ─── Navegador ───
  const doc = document, html = doc.documentElement;
  const script = doc.currentScript;
  const LOCAL_CSS = (() => {
    try { const u = new URL('marca-blanca.css', script.src); u.search = new URL(script.src).search; return u.href; } catch (_) { return '/marca-blanca.css'; }
  })();
  const session = (() => { try { return root.sessionStorage; } catch (_) { return null; } })();
  const store = {
    get: k => { try { return session && session.getItem(k); } catch (_) { return null; } },
    set: (k, v) => { try { session && session.setItem(k, v); } catch (_) {} },
    del: k => { try { session && session.removeItem(k); } catch (_) {} },
  };
  const lang = () => (html.lang === 'en' ? 'en' : 'es');
  const T = (es, en) => (lang() === 'en' ? en : es);

  let current = null;          // {id, nombre, modo}
  let known = SEED.slice();
  let loaderPromise = null, cssPromise = null, catalogPromise = null;
  let snapshot = null;         // favicon, theme-color y título originales
  let titleObserver = null, mapTimer = null, mapHandler = null, mapRef = null, mapOriginal = null;

  function timeout(promise, ms, label) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(label + ': sin respuesta')), ms))]);
  }
  function addLink(href) {
    return new Promise((resolve, reject) => {
      const link = doc.createElement('link');
      link.rel = 'stylesheet'; link.href = href; link.setAttribute('data-admira-marca', '');
      link.onload = () => resolve(link);
      link.onerror = () => { link.remove(); reject(new Error('no se pudo cargar ' + href)); };
      doc.head.append(link);
    });
  }
  // Estilos: el puente común (admiranext.com) y los ajustes de esta web (local). Si el
  // común no llega, los locales bastan: llevan su propio puente para la plataforma app.
  function loadCss() {
    if (!cssPromise) {
      cssPromise = Promise.all([
        timeout(addLink(BASE + 'marcablanca.css'), TIMEOUT, 'marcablanca.css').catch(() => null),
        timeout(addLink(LOCAL_CSS), TIMEOUT, 'marca-blanca.css'),
      ]);
      cssPromise.catch(() => { cssPromise = null; });
    }
    return cssPromise;
  }
  function loadLoader(modo) {
    if (root.MarcaBlanca && root.MarcaBlanca.version) return Promise.resolve(root.MarcaBlanca);
    if (!loaderPromise) {
      loaderPromise = timeout(new Promise((resolve, reject) => {
        const s = doc.createElement('script');
        s.src = BASE + 'marcablanca.js';
        s.async = true;
        s.setAttribute('data-mb-plataforma', 'app');
        s.setAttribute('data-mb-modo', modo || 'marca');
        s.setAttribute('data-mb-auto', 'false');   // la aplica esta web cuando ha comprobado el catálogo
        s.setAttribute('data-admira-marca', '');
        s.onload = () => (root.MarcaBlanca ? resolve(root.MarcaBlanca) : reject(new Error('marcablanca.js sin MarcaBlanca')));
        s.onerror = () => { s.remove(); reject(new Error('no se pudo cargar marcablanca.js')); };
        doc.head.append(s);
      }), TIMEOUT, 'marcablanca.js');
      loaderPromise.catch(() => { loaderPromise = null; });
    }
    return loaderPromise;
  }
  function removeCss() {
    for (const link of doc.querySelectorAll('link[data-admira-marca]')) link.remove();
    cssPromise = null;
  }

  // Catálogo: solo se pide si hay marca o si se usa /marca (nunca en una visita normal).
  function listar() {
    if (!catalogPromise) {
      const get = url => fetch(url, {credentials: 'omit'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
      catalogPromise = timeout(get(BASE + 'api/marcas').catch(() => get(BASE + 'clientes/index.json')), TIMEOUT, 'catálogo')
        .then(index => {
          const list = (index && Array.isArray(index.clientes) ? index.clientes : [])
            .filter(c => c && ID_RE.test(c.id || ''))
            .map(c => ({id: c.id, nombre: String(c.nombre || c.id), ejemplo: !!c.ejemplo || !!(c.catalogo && c.catalogo.tipo === 'ejemplo'), propuesta: !!(c.catalogo && c.catalogo.propuesta)}));
          if (!list.length) throw new Error('catálogo vacío');
          known = list;
          const C = root.AdmiraExpertCommands;
          if (C && typeof C.setBrands === 'function') C.setBrands(list);
          doc.dispatchEvent(new CustomEvent('admira:marcas', {detail: {marcas: list}}));
          return list;
        });
      catalogPromise.catch(() => { catalogPromise = null; });
    }
    return catalogPromise;
  }

  // ─── Lo que la web añade a la marca: logo en la barra, título, «Volver a Admira», mapa ───
  function header() { return doc.querySelector('body > header.galaxy-shell') || doc.querySelector('body > header'); }
  function logoSlot(create) {
    let slot = doc.getElementById('mb-bar-logo');
    if (slot || !create) return slot;
    const logo = header() && header().querySelector('.logo');
    const home = logo && logo.querySelector('.logo-home');
    if (!logo || !home) return null;
    slot = doc.createElement('a');
    slot.id = 'mb-bar-logo';
    slot.className = 'mb-bar-logo mb-logo';
    slot.setAttribute('data-mb-logo', '');
    slot.href = home.getAttribute('href') || '/';
    // En la portada la marca es un botón que reencuadra el mapa: el logo hace lo mismo.
    slot.addEventListener('click', event => { if (home.tagName !== 'A') { event.preventDefault(); home.click(); } });
    logo.insertBefore(slot, home);
    return slot;
  }
  function backButton(create) {
    let b = doc.getElementById('mb-volver');
    if (b || !create) return b;
    const nav = doc.getElementById('header-navigation');
    if (!nav) return null;
    b = doc.createElement('button');
    b.type = 'button';
    b.id = 'mb-volver';
    b.className = 'mb-volver';
    b.dataset.shellTextEs = 'Volver a Admira';
    b.dataset.shellTextEn = 'Back to Admira';
    b.textContent = T('Volver a Admira', 'Back to Admira');
    b.addEventListener('click', () => { desactivar(); const t = doc.getElementById('header-menu-toggle'); if (t) t.focus(); });
    nav.insertBefore(b, nav.querySelector('.lang-switch'));
    return b;
  }
  function takeSnapshot() {
    if (snapshot) return;
    const theme = doc.querySelector('meta[name="theme-color"]');
    snapshot = {
      icons: [...doc.querySelectorAll('link[rel~="icon"]:not([data-mb-favicon])')].map(l => l.cloneNode(true)),
      theme: theme ? theme.getAttribute('content') : null,
    };
  }
  function restoreSnapshot() {
    if (!snapshot) return;
    for (const l of doc.querySelectorAll('link[data-mb-favicon]')) l.remove();
    for (const icon of snapshot.icons) if (!doc.querySelector(`link[rel~="icon"][href="${CSS.escape(icon.getAttribute('href') || '')}"]`)) doc.head.append(icon.cloneNode(true));
    const theme = doc.querySelector('meta[name="theme-color"]');
    if (snapshot.theme == null) { if (theme) theme.remove(); } else if (theme) theme.setAttribute('content', snapshot.theme);
    snapshot = null;
  }
  // Título de la pestaña: «Nombre del cliente · título de la página».
  let lastPrefix = '';
  const prefix = () => (current ? current.nombre + ' · ' : '');
  function paintTitle() {
    if (!current) return;
    let base = doc.title;
    if (lastPrefix && base.startsWith(lastPrefix)) base = base.slice(lastPrefix.length);
    lastPrefix = prefix();
    if (doc.title !== lastPrefix + base) doc.title = lastPrefix + base;
    if (!titleObserver) {
      // Si la página cambia su título (p. ej. al cambiar de idioma), se vuelve a anteponer el nombre.
      titleObserver = new MutationObserver(() => { if (current && !doc.title.startsWith(prefix())) paintTitle(); });
      titleObserver.observe(doc.head, {subtree: true, childList: true, characterData: true});
    }
  }
  function restoreTitle() {
    if (titleObserver) { titleObserver.disconnect(); titleObserver = null; }
    if (lastPrefix && doc.title.startsWith(lastPrefix)) doc.title = doc.title.slice(lastPrefix.length);
    lastPrefix = '';
  }

  // Clusters y anillo de selección del mapa con el color primario (los puntos sueltos
  // conservan el color de su circuito). El mapa es la constante global de app.js.
  const MAP_PAINT = [['clusters', 'circle-color', 'brand'], ['cluster-count', 'text-color', 'onBrand'], ['selected-ring', 'circle-stroke-color', 'brand']];
  function findMap() {
    let m = null;
    // eslint-disable-next-line no-undef
    try { m = typeof map !== 'undefined' ? map : null; } catch (_) {}
    return m && typeof m.getLayer === 'function' && typeof m.setPaintProperty === 'function' ? m : null;
  }
  function paintMap(colors) {
    const m = mapRef || findMap();
    if (!m || !m.getLayer('clusters')) return false;
    mapRef = m;
    mapOriginal = mapOriginal || {};
    for (const [layer, prop, token] of MAP_PAINT) {
      if (!m.getLayer(layer)) continue;
      const k = layer + '|' + prop;
      const now = m.getPaintProperty(layer, prop);
      if (colors) {
        // Lo que no es el color de la marca es el de serie (también si app.js recreó la capa).
        if (JSON.stringify(now) !== JSON.stringify(colors[token])) { mapOriginal[k] = now; m.setPaintProperty(layer, prop, colors[token]); }
      } else if (k in mapOriginal) m.setPaintProperty(layer, prop, mapOriginal[k]);
    }
    return true;
  }
  // En cuanto existe el mapa se escucha «styledata»: así se pintan las capas aunque app.js
  // las añada después (catálogo lento, bola aún cargando) o las recree al cambiar de capa.
  // Antes se daba por vencido a los 60 s si la capa «clusters» aún no existía.
  function brandMap(colors) {
    unbrandMap();
    let tries = 0;
    const attempt = () => {
      if (!current) return;
      const m = findMap();
      if (!m) { if (++tries < 240) mapTimer = setTimeout(attempt, 500); return; }
      mapRef = m;
      mapHandler = () => { if (current) paintMap(colors); };
      m.on('styledata', mapHandler);
      paintMap(colors);
    };
    attempt();
  }
  function unbrandMap() {
    clearTimeout(mapTimer);
    if (mapRef && mapHandler) { try { mapRef.off('styledata', mapHandler); } catch (_) {} }
    mapHandler = null;
    if (mapRef && mapOriginal) { try { paintMap(null); } catch (_) {} }
    mapOriginal = null;
  }

  // La entrada en vídeo de la portada (#4566) es una grabación de la bola con los clusters
  // naranja y magenta de serie: con marca no se enseña. Se ve el fondo del espacio hasta que
  // la bola real (ya con la marca) la sustituye. Sin marca no se toca.
  function hideIntro(hide) {
    const video = doc.getElementById('intro-video');
    if (video) video.style.visibility = hide ? 'hidden' : '';
    const intro = doc.getElementById('intro');
    if (intro) intro.style.backgroundImage = hide ? 'none' : '';
  }

  function clearRoot() {
    for (let i = html.style.length - 1; i >= 0; i--) {
      const prop = html.style[i];
      if (prop.startsWith('--mb-') || prop.startsWith('--mbx-')) html.style.removeProperty(prop);
    }
    html.style.removeProperty('color-scheme');
    for (const a of ['data-mb-marca', 'data-mb-modo', 'data-mb-plataforma', 'data-mb-ejemplo']) html.removeAttribute(a);
  }

  /**
   * Activa una marca del catálogo. Comprueba primero que existe; si no existe o
   * admiranext.com no responde, no aplica nada. → Promise<{ok, id, nombre} | {ok:false, reason}>
   */
  function activar(id, opts = {}) {
    id = fold(id);
    if (isOff(id)) return Promise.resolve(Object.assign({ok: true, off: true}, desactivar()));
    if (!ID_RE.test(id)) return Promise.resolve({ok: false, reason: 'invalid', id});
    const modo = opts.modo || decideMode(location.search, session);
    const previous = current;
    return Promise.all([loadLoader(modo), loadCss()])
      .then(([MB]) => MB.cargar(id).then(m => ({MB, m}), () => listar().then(
        list => { throw Object.assign(new Error('unknown'), {reason: list.some(c => c.id === id) ? 'network' : 'unknown'}); },
        () => { throw Object.assign(new Error('network'), {reason: 'network'}); })))
      .then(({MB, m}) => {
        takeSnapshot();
        const slot = logoSlot(true);
        if (slot && !previous) slot.hidden = true;
        return MB.aplicar(id, {plataforma: 'app', modo}).then(detail => ({detail, m}));
      })
      .then(({detail, m}) => {
        const marca = detail.marca || m;
        const nombre = String(marca.nombre || id);
        const catalogo = marca.catalogo || m.catalogo || {};
        const tokens = shellTokens(detail.variables, detail.modo);
        for (const [k, v] of Object.entries(tokens)) html.style.setProperty(k, v);
        // Una propuesta automática (analizada desde la web del cliente) nunca se presenta como la marca oficial.
        current = {id: detail.id || id, nombre, modo: detail.modo, ejemplo: !!marca.ejemplo, propuesta: !!catalogo.propuesta,
          aviso: catalogo.propuesta ? String(catalogo.aviso || '') : ''};
        store.set(SESSION_KEY, current.id);
        if (opts.modo || new URLSearchParams(location.search).get('modo')) store.set(MODE_KEY, modo);
        const slot = logoSlot(true);
        if (slot) {
          slot.hidden = false;
          slot.setAttribute('aria-label', nombre + T(' · volver al inicio', ' · back to home'));
          slot.title = nombre + (current.propuesta
            ? T(' · propuesta generada automáticamente, no es la marca oficial', ' · automatically generated proposal, not the official brand')
            : current.ejemplo ? T(' · marca ficticia de ejemplo', ' · fictional sample brand') : '');
          slot.toggleAttribute('data-mb-propuesta', current.propuesta);
          if (!slot.firstChild) slot.textContent = nombre;   // marca sin logo
        }
        backButton(true);
        hideIntro(true);
        paintTitle();
        brandMap({brand: tokens['--mbx-brand'], onBrand: tokens['--mbx-on-brand']});
        if (!known.some(k => k.id === current.id)) known = [...known, {id: current.id, nombre, ejemplo: current.ejemplo, propuesta: current.propuesta}];
        doc.dispatchEvent(new CustomEvent('admira:marca', {detail: Object.assign({}, current)}));
        return Object.assign({ok: true}, current);
      })
      .catch(error => {
        // Nada a medias: sin marca previa se deja la web como estaba.
        if (!previous || !current) { cleanup(); current = null; }
        const reason = (error && error.reason) || 'network';
        if (reason === 'unknown' && store.get(SESSION_KEY) === id) store.del(SESSION_KEY);
        return {ok: false, reason, id};
      });
  }

  function cleanup() {
    hideIntro(false);
    clearRoot();
    unbrandMap();
    const slot = logoSlot(false); if (slot) slot.remove();
    const b = backButton(false); if (b) b.remove();
    restoreTitle();
    restoreSnapshot();
    removeCss();
  }

  /** Vuelve a Admira (o a la identidad del dominio) en el sitio, sin recargar. */
  function desactivar() {
    const was = current;
    store.del(SESSION_KEY);
    store.del(MODE_KEY);
    try {
      const url = new URL(location.href);
      if (url.searchParams.has('marca') || url.searchParams.has('modo')) {
        url.searchParams.delete('marca'); url.searchParams.delete('modo');
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      }
    } catch (_) {}
    current = null;
    cleanup();
    if (was) doc.dispatchEvent(new CustomEvent('admira:marca', {detail: null}));
    return {ok: true, changed: !!was, previous: was};
  }

  /** /marca <web>: abre el analizador de admiranext.com en otra pestaña (allí se analiza y se guarda). */
  function analizar(value) {
    const url = normalizeUrl(value);
    if (!url) return {ok: false, reason: 'invalid'};
    const href = analyzerUrl(url);
    // Con noopener el navegador devuelve null aunque abra la pestaña: el CLI enseña el enlace igualmente.
    try { root.open(href, '_blank', 'noopener'); } catch (_) {}
    return {ok: true, href, url};
  }

  root.AdmiraMarca = Object.freeze(Object.assign({}, api, {
    actual: () => (current ? Object.assign({}, current) : null),
    conocidas: () => known.slice(),
    listar, activar, desactivar, analizar,
  }));

  // Arranque: solo si esta pestaña tiene marca.
  const decision = decide(location.search, session);
  if (decision.forget) { store.del(SESSION_KEY); store.del(MODE_KEY); }
  if (decision.id) {
    hideIntro(true);   // antes de hablar con admiranext.com: el vídeo no llega a verse con los colores de serie
    activar(decision.id).then(r => {
      if (!r.ok && root.console) console.warn('marca blanca: no se aplicó «' + decision.id + '» (' + r.reason + ')');
      if (r.ok) listar().catch(() => {});
    });
  }
})(typeof window === 'undefined' ? globalThis : window);
