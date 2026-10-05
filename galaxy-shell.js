// Shell cuadrático universal de admira.app / clearchannel.tv (FLT-101311).
// La portada (index.html) define la interfaz de cuatro bandas: barra superior con
// ☰ Opciones + marca a la izquierda y Login · ▤ Avanzado · ⌘ Experto a la derecha,
// panel izquierdo de Opciones, panel derecho de Modo avanzado y panel inferior de
// Modo experto (CLI · Verbos · Rutinas). Cualquier otra página obtiene exactamente
// el mismo marcado cargando este fichero:
//
//   <link rel="stylesheet" href="/galaxy-shell.css?v=…">
//   <script defer src="/galaxy-shell.js?v=…"></script>
//
// La página declara lo suyo en window.ADMIRA_SHELL (antes del script) o con
// atributos: data-section en el <script>, y data-shell-slot="advanced|options" en
// los elementos que deben pasar a los paneles (se mueven con sus manejadores).
// El comportamiento lo siguen dando responsive-shell.js, expert-commands.js y
// expert-panel.js: este fichero solo inyecta el marcado y los carga en orden.
(function (root) {
  'use strict';

  const PANEL_IDS = ['header-menu-toggle', 'header-advanced-toggle', 'header-expert-toggle', 'header-navigation', 'advanced-tools', 'expert-panel'];
  const COMMON_OPTIONS = [
    {href: '/', es: 'Inicio', en: 'Home'},
    {href: '/players/', es: 'Player virtual', en: 'Virtual player'},
    {href: '/help/#navigation-modes', es: 'Ayuda', en: 'Help'},
  ];
  const DEFAULT_BRAND = {id: 'clearchannel', defaultLanguage: 'en', wordmark: 'CLEAR·CHANNEL'};

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const pick = (lang, item) => (typeof item === 'string' ? item : lang === 'en' ? (item.en || item.es || '') : (item.es || item.en || ''));
  // Texto bilingüe que responsive-shell.js traduce al cambiar el idioma.
  const bilingual = (lang, item) => (typeof item === 'string'
    ? ` data-shell-text-es="${esc(item)}" data-shell-text-en="${esc(item)}">${esc(item)}`
    : ` data-shell-text-es="${esc(item.es || item.en)}" data-shell-text-en="${esc(item.en || item.es)}">${esc(pick(lang, item))}`);
  const safeHref = href => (/^\s*javascript:/i.test(String(href || '')) ? '#' : String(href || '#'));

  // Idioma: el mismo criterio que la portada (app.js): ?lang= > preferencia por marca > idioma de la marca.
  function languageKey(brand) { return ((brand && brand.id) || DEFAULT_BRAND.id) + '-lang'; }
  function preferredLanguage(search, storage, brand) {
    const explicit = new URLSearchParams(search || '').get('lang');
    if (explicit === 'en' || explicit === 'es') return explicit;
    try { const saved = storage && storage.getItem(languageKey(brand)); if (saved === 'en' || saved === 'es') return saved; } catch (_) {}
    return ((brand && brand.defaultLanguage) || DEFAULT_BRAND.defaultLanguage) === 'es' ? 'es' : 'en';
  }

  function normalizeConfig(raw, attrs) {
    const cfg = Object.assign({}, raw || {});
    const data = attrs || {};
    if (cfg.section == null && data.section) cfg.section = data.sectionEn ? {es: data.section, en: data.sectionEn} : data.section;
    const list = value => (Array.isArray(value) ? value.filter(item => item && (item.href || item.id) && (item.es || item.en || typeof item === 'string')) : []);
    cfg.options = list(cfg.options);
    cfg.advanced = list(cfg.advanced);
    cfg.verbs = Array.isArray(cfg.verbs) ? cfg.verbs : [];
    cfg.login = cfg.login === false ? false : Object.assign({href: '/backoffice.html', es: 'Login', en: 'Login'}, typeof cfg.login === 'object' ? cfg.login : {});
    cfg.home = typeof cfg.home === 'string' && /^\/(?![\/\\])/.test(cfg.home) ? cfg.home : '/';
    return cfg;
  }

  function actionMarkup(lang, item) {
    const label = bilingual(lang, item);
    const id = item.id ? ` id="${esc(item.id)}"` : '';
    if (item.href) return `<a class="header-circuit-btn"${id} href="${esc(safeHref(item.href))}"${item.newTab ? ' target="_blank" rel="noopener"' : ''}${label}</a>`;
    return `<button type="button" class="header-circuit-btn"${id}${label}</button>`;
  }

  // Marcado del shell: mismos ids, clases e iconos que index.html.
  function markup(rawCfg, {lang = 'es', wordmark = DEFAULT_BRAND.wordmark} = {}) {
    const cfg = normalizeConfig(rawCfg);
    const T = (es, en) => (lang === 'en' ? en : es);
    const section = cfg.section ? `<span class="sub galaxy-shell-section"${bilingual(lang, cfg.section)}</span>` : '';
    const login = cfg.login ? `<a id="header-login" class="mode-toggle header-login" href="${esc(safeHref(cfg.login.href))}"${bilingual(lang, cfg.login)}</a>` : '';
    const header = `<header class="galaxy-shell">
  <div class="brand-heading">
    <button type="button" id="header-menu-toggle" class="mode-toggle" aria-expanded="false" aria-controls="header-navigation" data-mode="options" data-shell-es="Opciones" data-shell-en="Options" title="${T('Opciones', 'Options')}">☰</button>
    <span class="logo"><a class="logo-home" id="logo-home" href="${esc(cfg.home)}" data-brand-wordmark title="${T('Volver al inicio', 'Back to home')}">${esc(wordmark)}</a>${section}</span>
  </div>
  <div class="header-controls">
    <div class="mode-switches" role="group" aria-label="Modos / Modes">
      ${login}
      <button type="button" id="header-advanced-toggle" class="mode-toggle" aria-expanded="false" aria-controls="advanced-tools" data-mode="advanced" data-shell-es="Modo avanzado" data-shell-en="Advanced mode" title="${T('Modo avanzado', 'Advanced mode')}">▤</button>
      <button type="button" id="header-expert-toggle" class="mode-toggle" aria-expanded="false" aria-controls="expert-panel" data-mode="expert" data-shell-es="Modo experto" data-shell-en="Expert mode" title="${T('Modo experto', 'Expert mode')}">⌘</button>
    </div>
  </div>
</header>`;
    const links = [...COMMON_OPTIONS.map(o => (o.href === '/' ? Object.assign({}, o, {href: cfg.home}) : o)), ...cfg.options]
      .map(o => `<a href="${esc(safeHref(o.href))}"${o.id ? ` id="${esc(o.id)}"` : ''}${bilingual(lang, o)}</a>`).join('\n  ');
    const options = `<nav id="header-navigation" class="mode-panel options-panel" aria-label="${T('Opciones', 'Options')}" hidden>
  <div class="mode-panel-head"><strong data-shell-text-es="Opciones" data-shell-text-en="Options">${T('Opciones', 'Options')}</strong><button type="button" data-close-mode="options" aria-label="Cerrar / Close">×</button></div>
  ${links}
  <div class="lang-switch" id="lang-switch" role="group" aria-label="Idioma / Language"><button type="button" class="lang-btn" id="lang-toggle" data-lang-target="${lang === 'en' ? 'es' : 'en'}" aria-label="${lang === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés'}">${lang === 'en' ? 'ESP' : 'ENG'}</button></div>
</nav>`;
    const advanced = `<details id="advanced-tools" class="mode-panel advanced-panel">
  <summary class="mode-panel-head"><strong data-shell-text-es="Modo avanzado" data-shell-text-en="Advanced mode">${T('Modo avanzado', 'Advanced mode')}</strong><span aria-hidden="true">×</span></summary>
  <div class="advanced-actions">
    ${cfg.advanced.map(item => actionMarkup(lang, item)).join('\n    ')}
  </div>
  <p class="galaxy-shell-empty" data-shell-text-es="Esta página no tiene acciones avanzadas." data-shell-text-en="This page has no advanced actions.">${T('Esta página no tiene acciones avanzadas.', 'This page has no advanced actions.')}</p>
</details>`;
    const expert = `<section id="expert-panel" class="mode-panel expert-panel" aria-label="${T('Modo experto', 'Expert mode')}" hidden>
  <div class="expert-bar">
    <strong data-shell-text-es="Modo Experto" data-shell-text-en="Expert Mode">${T('Modo Experto', 'Expert Mode')}</strong>
    <details class="expert-layout-menu"><summary aria-label="Restaurar o mostrar bloques">⋯</summary><div class="expert-layout-tools" role="group"></div></details>
    <button type="button" class="expert-close" data-close-mode="expert" aria-label="Cerrar / Close">×</button>
  </div>
  <div class="expert-blocks">
    <section class="expert-module" data-module="cli" aria-label="CLI">
      <div class="expert-module-content">
        <form id="expert-command-form" class="expert-command-form">
          <input id="expert-command" type="text" placeholder="/demo starbucks" aria-label="Orden del modo experto" autocomplete="off" spellcheck="false">
          <button type="submit" data-shell-text-es="Ejecutar" data-shell-text-en="Run">${T('Ejecutar', 'Run')}</button>
        </form>
        <ol id="expert-command-result" class="expert-log" role="log" aria-live="polite"></ol>
        <p class="expert-hint">Tab completa · ↑/↓ historial · /help ayuda</p>
      </div>
    </section>
    <section class="expert-module" data-module="verbos" aria-label="Verbos">
      <div class="expert-module-content"><ul id="expert-verbs" class="expert-verbs"></ul></div>
    </section>
    <section class="expert-module" data-module="rutinas" aria-label="Rutinas">
      <div class="expert-module-content">
        <button type="button" id="expert-save-routine" class="expert-save-routine" disabled>＋ Guardar última orden</button>
        <ul id="expert-routines" class="expert-routines"></ul>
      </div>
    </section>
  </div>
</section>`;
    return {header, options, advanced, expert, html: [header, options, advanced, expert].join('\n')};
  }

  const api = {PANEL_IDS, COMMON_OPTIONS, esc, languageKey, preferredLanguage, normalizeConfig, markup};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const script = document.currentScript;
  // La portada trae el shell en línea: no se duplica nada.
  if (document.getElementById('expert-panel') || document.getElementById('header-menu-toggle')) {
    root.AdmiraShell = root.AdmiraShell || Object.assign({away: false}, api);
    return;
  }
  const cfg = normalizeConfig(root.ADMIRA_SHELL, script ? script.dataset : {});
  const brand = root.ADMIRA_SITE_BRAND || DEFAULT_BRAND;
  const store = (() => { try { return root.localStorage; } catch (_) { return null; } })();
  const html = document.documentElement;
  // Sin manejador propio, el shell aplica la preferencia de idioma como la portada.
  if (typeof cfg.setLang !== 'function') html.lang = preferredLanguage(location.search, store, brand);
  const lang = () => (html.lang === 'en' ? 'en' : 'es');

  const parts = markup(cfg, {lang: lang(), wordmark: brand.wordmark || DEFAULT_BRAND.wordmark});
  const tpl = document.createElement('template');
  tpl.innerHTML = parts.html;
  const shellNodes = [...tpl.content.children];
  const [header, optionsPanel, advancedPanel] = shellNodes;

  // Los elementos que la página marca con data-shell-slot pasan a los paneles con
  // sus manejadores; la cabecera propia de la página deja paso a la universal.
  const advancedActions = advancedPanel.querySelector('.advanced-actions');
  const langSwitch = optionsPanel.querySelector('.lang-switch');
  for (const node of document.querySelectorAll('[data-shell-slot]')) {
    const slot = node.dataset.shellSlot;
    if (slot === 'advanced') {
      if (/^(A|BUTTON)$/.test(node.tagName)) node.classList.add('header-circuit-btn');
      advancedActions.append(node);
    } else if (slot === 'options') optionsPanel.insertBefore(node, langSwitch);
  }
  advancedPanel.querySelector('.galaxy-shell-empty').hidden = !!advancedActions.children.length;
  for (const old of document.querySelectorAll('body > header:not(.galaxy-shell):not([data-shell-keep]), [data-shell-slots]')) old.remove();
  document.body.prepend(...shellNodes);
  document.body.classList.add('galaxy-shell-page');
  html.dataset.shell = 'galaxy';

  // Idioma: mismo botón ENG/ESP que la portada.
  const toggle = document.getElementById('lang-toggle');
  const logoHome = document.getElementById('logo-home');
  function paintLanguage() {
    const en = lang() === 'en';
    toggle.dataset.langTarget = en ? 'es' : 'en';
    toggle.textContent = en ? 'ESP' : 'ENG';
    toggle.setAttribute('aria-label', en ? 'Switch to Spanish' : 'Cambiar a inglés');
    logoHome.title = en ? 'Back to home' : 'Volver al inicio';
    optionsPanel.setAttribute('aria-label', en ? 'Options' : 'Opciones');
  }
  function setLanguage(next) {
    next = next === 'en' ? 'en' : 'es';
    try { store && store.setItem(languageKey(brand), next); } catch (_) {}
    if (typeof cfg.setLang === 'function') cfg.setLang(next); else html.lang = next;
    html.lang = next;
    document.dispatchEvent(new CustomEvent('admira:lang', {detail: {lang: next}}));
  }
  toggle.addEventListener('click', () => setLanguage(toggle.dataset.langTarget));
  new MutationObserver(paintLanguage).observe(html, {attributes: true, attributeFilter: ['lang']});
  paintLanguage();

  // Traspaso a la portada de los verbos que necesitan el mapa.
  root.AdmiraShell = Object.assign({}, api, {
    away: true,
    home: cfg.home,
    config: cfg,
    lang,
    setLang: setLanguage,
    handoff(command) {
      const C = root.AdmiraExpertCommands;
      let session = null;
      try { session = root.sessionStorage; } catch (_) {}
      if (!C || !session || !C.savePending(session, command)) return {ok: false};
      setTimeout(() => location.assign(cfg.home), 350);
      return {ok: true};
    },
  });

  // Mismo comportamiento que la portada: se cargan en el mismo orden con el sello de este fichero.
  const version = (() => { try { return new URL(script.src).searchParams.get('v') || ''; } catch (_) { return ''; } })();
  const base = (() => { try { return new URL('./', script.src).href; } catch (_) { return '/'; } })();
  const load = name => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = base + name + (version ? '?v=' + encodeURIComponent(version) : '');
    s.async = false;
    s.onload = resolve;
    s.onerror = () => reject(new Error('galaxy-shell: no se pudo cargar ' + name));
    document.head.append(s);
  });
  const registerVerbs = () => {
    const C = root.AdmiraExpertCommands;
    for (const verb of cfg.verbs) { try { C.registerVerb(verb); } catch (error) { console.warn(error); } }
  };
  // Marca blanca (FLT-101331): el mismo fichero que carga la portada. Sin marca activa no
  // inserta nada ni habla con admiranext.com; con marca, viste la barra y los paneles.
  load('marca-blanca.js').catch(error => console.warn(error));
  // ⌘ EXPERTO · CLI con el look de digitalavatar.ai (Carlos, 4-oct-2026): piel compartida de
  // la suite servida desde admiranext.com/suite. Reviste el panel; los verbos siguen siendo estos.
  (() => {
    const EXPERTO = 'https://www.admiranext.com/suite/experto', V = '20261005-experto-idioma-1';
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = EXPERTO + '.css?v=' + V;
    document.head.append(css);
    const js = document.createElement('script');
    js.src = EXPERTO + '.js?v=' + V; js.defer = true;
    document.head.append(js);
  })();
  load('responsive-shell.js')
    .then(() => (root.AdmiraExpertCommands ? null : load('expert-commands.js')))
    .then(registerVerbs)
    .then(() => (root.AdmiraExpert ? null : load('expert-panel.js')))
    .then(() => document.dispatchEvent(new CustomEvent('admira:shell-ready')))
    .catch(error => console.error(error));
})(typeof window === 'undefined' ? globalThis : window);
