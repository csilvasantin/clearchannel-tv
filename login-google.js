/* Login con Google en la cabecera de admira.biz (Carlos, 15-oct-2026 · FLT-102490;
 * selector de proyecto entre buscador y Backoffice, 9-nov-2026 · t848u).
 * Sin sesión: «Entrar» (botón de Google Identity Services). Con sesión: el proyecto
 * activo y un desplegable para cambiarlo; Backoffice es un enlace aparte
 * (#header-backoffice). La lista de proyectos solo llega tras autenticar
 * (GET /api/proyectos con el Bearer). */
(function (root) {
  'use strict';
  const GSI = 'https://accounts.google.com/gsi/client';
  // Mismos clientes que backoffice.html: admira.biz entra con el de la suite (el del sitio da
  // «origin_mismatch» allí); clearchannel.tv y admira.app, con el del sitio.
  const SUITE_CLIENT = '861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com';
  const SITE_CLIENT = '861856772040-quq6ut76k4mqj3fdq87h6g6caht3nm4l.apps.googleusercontent.com';
  const KEY = 'omnip-bo-gtoken';
  const PROJECT_KEY = 'admira-proyecto-activo';

  const clientFor = host => (/(^|\.)admira\.biz$/i.test(String(host || '')) ? SUITE_CLIENT : SITE_CLIENT);
  // El backoffice ya tiene su propia puerta de Google: allí el enlace se queda como está.
  const isBackoffice = path => /^\/backoffice(?:\.html)?\/?$/i.test(String(path || ''));

  function parseJwt(token) {
    try {
      let p = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';
      const text = typeof atob === 'function' ? atob(p) : Buffer.from(p, 'base64').toString('binary');
      return JSON.parse(decodeURIComponent(text.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
    } catch (_) { return null; }
  }
  // Sesión guardada y vigente (el ID token de Google caduca en una hora).
  function stored(storage, now = Date.now()) {
    try {
      const o = JSON.parse((storage && storage.getItem(KEY)) || 'null');
      const claims = o && o.token ? parseJwt(o.token) : null;
      if (!claims || !claims.exp || claims.exp * 1000 <= now) return null;
      return {token: o.token, email: String(o.email || claims.email || ''), registrado: o.registrado === true};
    } catch (_) { return null; }
  }
  function readProject(storage) {
    try {
      const o = JSON.parse((storage && storage.getItem(PROJECT_KEY)) || 'null');
      if (!o || typeof o.id !== 'string' || typeof o.label !== 'string' || typeof o.circuit !== 'string') return null;
      return {id: o.id, label: o.label, circuit: o.circuit};
    } catch (_) { return null; }
  }
  function writeProject(storage, project) {
    try {
      if (!project) storage.removeItem(PROJECT_KEY);
      else storage.setItem(PROJECT_KEY, JSON.stringify({id: project.id, label: project.label, circuit: project.circuit}));
    } catch (_) {}
  }

  // Por el mismo origen (/auth/sesion → el worker pregunta al API con la cookie de este sitio, 20-10-2026): un visitante
  // sin sesión recibe 200 {ok:false} y la consola queda limpia. Antes iba a api.admira.biz y el 401 salía como error.
  async function serverSession(fetcher) {
    try {
      const r = await fetcher('/auth/sesion', {credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(5000)});
      if (!r.ok) return null;
      const s = await r.json();
      return s.ok === true && typeof s.email === 'string' && s.email.trim() ? {email:s.email,source:'server'} : null;
    } catch (_) { return null; }
  }
  const api = {clientFor, isBackoffice, parseJwt, stored, serverSession, readProject, writeProject, KEY, PROJECT_KEY};
  root.AdmiraLoginGoogle = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  // Con sesión, ⌘ ocupa el sitio de la pastilla de idioma (Carlos, 18-oct-2026): la marca vive en <html> y la
  // leen las reglas de la portada (index.html) y de la cabecera común (galaxy-shell.js).
  const marcarSesion = () => document.documentElement.classList.add('admira-con-sesion');
  try { if (stored(root.localStorage)) marcarSesion(); } catch (_) {}
  const lang = () => (String(document.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es');
  const T = (es, en) => (lang() === 'en' ? en : es);

  function style() {
    if (!document || typeof document.createElement !== 'function') return;
    if (document.getElementById('login-google-style')) return;
    const s = document.createElement('style');
    s.id = 'login-google-style';
    // color-scheme light: el iframe de Google es claro y, en una página oscura, Chrome le pinta
    // un fondo blanco opaco alrededor del botón. [hidden] tiene que ganar al display de la cabecera.
    s.textContent = '.header-login-gis{display:inline-flex;align-items:center;min-height:36px;flex:none;color-scheme:light}' +
      '.header-login-gis[hidden],#header-login[hidden],#header-backoffice[hidden]{display:none!important}' +
      '.header-project{display:inline-flex;align-items:center;gap:6px;min-height:36px;flex:none;max-width:min(240px,42vw)}' +
      '.header-project select{appearance:none;-webkit-appearance:none;max-width:100%;min-width:120px;height:36px;' +
      'padding:0 28px 0 12px;border-radius:8px;border:1px solid rgba(255,216,102,.45);background:rgba(10,22,32,.92) ' +
      'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27 viewBox=%270 0 12 8%27><path fill=%27%23ffd866%27 d=%27M1 1l5 5 5-5%27/></svg>") no-repeat right 10px center;' +
      'color:#ffd866;font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em;' +
      'text-transform:uppercase;cursor:pointer}' +
      '.header-project select:focus{outline:1px solid rgba(120,243,255,.55);outline-offset:1px}' +
      '.header-backoffice{white-space:nowrap}' +
      '.login-google-toast{position:fixed;top:64px;right:16px;z-index:2147483000;max-width:min(360px,calc(100vw - 32px));' +
      'padding:10px 14px;border-radius:10px;background:rgba(10,22,32,.96);border:1px solid rgba(120,243,255,.35);color:#e6f6ff;' +
      'font:13px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4)}';
    document.head.append(s);
  }
  function toast(text) {
    try {
      style();
      if (!document || !document.body || typeof document.createElement !== 'function') return;
      const el = document.createElement('div');
      el.className = 'login-google-toast';
      el.setAttribute('role', 'status');
      el.textContent = text;
      document.body.append(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 4500);
    } catch (_) {}
  }

  let gsiPromise = null;
  function loadGsi() {
    if (root.google && root.google.accounts && root.google.accounts.id) return Promise.resolve(root.google);
    if (gsiPromise) return gsiPromise;
    gsiPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('gsi_timeout')), 10000);
      const done = () => { clearTimeout(timer); root.google && root.google.accounts && root.google.accounts.id ? resolve(root.google) : reject(new Error('gsi_missing')); };
      let tag = document.querySelector('script[src^="' + GSI + '"]');
      if (!tag) {
        tag = document.createElement('script');
        tag.src = GSI; tag.async = true; tag.defer = true;
        document.head.append(tag);
      }
      tag.addEventListener('load', done, {once: true});
      tag.addEventListener('error', () => { clearTimeout(timer); reject(new Error('gsi_error')); }, {once: true});
    });
    return gsiPromise;
  }

  let link = null, host = null, projectHost = null, shownLocale = '', repaint = 0, verifiedSession = false, currentSession = null;

  function backofficeLink() {
    return document.getElementById('header-backoffice');
  }
  function showBackoffice(show) {
    const bo = backofficeLink();
    if (!bo) return;
    bo.hidden = !show;
  }

  function cerrarSesion(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!root.confirm(T('¿Cerrar la sesión? Dejarás de ver los Xpacios privados y el proyecto activo.', 'Sign out? You will no longer see private Xpacios or the active project.'))) return;
    try { root.localStorage.removeItem(KEY); } catch (_) {}
    try { root.sessionStorage.removeItem(KEY); } catch (_) {}
    try { writeProject(root.localStorage, null); } catch (_) {}
    try { root.google.accounts.id.disableAutoSelect(); } catch (_) {}
    root.location.reload();
  }

  function emitProject(project) {
    try { root.dispatchEvent(new CustomEvent('admira:proyecto', {detail: project ? {id: project.id, label: project.label, circuit: project.circuit} : null})); } catch (_) {}
  }

  function applyProject(project, {persist = true, emit = true} = {}) {
    if (persist) writeProject(root.localStorage, project);
    if (emit) emitProject(project);
    if (projectHost) {
      const sel = projectHost.querySelector('select');
      if (sel && project && [...sel.options].some(o => o.value === project.id)) sel.value = project.id;
    }
  }

  async function loadProjects(token) {
    const r = await fetch('/api/proyectos', {method: 'GET', headers: {Authorization: 'Bearer ' + token}, cache: 'no-store'});
    if (!r.ok) { const e = new Error('projects_' + r.status); e.status = r.status; throw e; }
    const d = await r.json();
    if (!d || d.ok !== true || !Array.isArray(d.projects)) throw Object.assign(Error('projects_invalid'), {status: 503});
    return d;
  }

  function renderProjectSelect(projects, active) {
    style();
    if (!projectHost) {
      projectHost = document.createElement('span');
      projectHost.className = 'header-project';
      projectHost.setAttribute('role', 'group');
      projectHost.setAttribute('aria-label', T('Proyecto activo', 'Active project'));
      if (link && link.parentNode) link.after(projectHost);
      else if (host && host.parentNode) host.after(projectHost);
    }
    projectHost.hidden = false;
    const sel = document.createElement('select');
    sel.id = 'header-project-select';
    sel.setAttribute('aria-label', T('Elegir proyecto', 'Choose project'));
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = T('Elegir proyecto', 'Choose project');
    sel.append(placeholder);
    for (const p of projects) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label;
      opt.dataset.circuit = p.circuit;
      sel.append(opt);
    }
    const logout = document.createElement('option');
    logout.value = '__logout__';
    logout.textContent = T('— Cerrar sesión —', '— Sign out —');
    sel.append(logout);
    if (active && projects.some(p => p.id === active.id)) sel.value = active.id;
    sel.addEventListener('change', () => {
      if (sel.value === '__logout__') {
        if (active) sel.value = active.id;
        else sel.value = '';
        cerrarSesion();
        return;
      }
      const p = projects.find(x => x.id === sel.value);
      if (!p) { applyProject(null); return; }
      applyProject(p);
      toast(T('Proyecto · ', 'Project · ') + p.label);
    });
    projectHost.replaceChildren(sel);
  }

  async function bootProjects(session) {
    if (!session || !session.token) {
      // Sesión de cookie de servidor sin ID token: no podemos pedir /api/proyectos.
      // Mostramos el email y dejamos elegir tras un login Google completo.
      if (projectHost) projectHost.hidden = true;
      if (link) {
        link.hidden = false;
        link.removeAttribute('data-i18n');
        link.dataset.shellTextEs = 'Entrar';
        link.dataset.shellTextEn = 'Sign in';
        link.textContent = T('Entrar', 'Sign in');
        link.title = T('Sesión verificada: ', 'Verified session: ') + session.email + T(' · entra con Google para elegir proyecto', ' · sign in with Google to choose a project');
        link.href = 'backoffice.html';
      }
      return;
    }
    try {
      const data = await loadProjects(session.token);
      const saved = readProject(root.localStorage);
      const active = (saved && data.projects.some(p => p.id === saved.id))
        ? data.projects.find(p => p.id === saved.id)
        : (data.projects[0] || null);
      if (link) link.hidden = true;
      if (host) host.hidden = true;
      renderProjectSelect(data.projects, active);
      // Backoffice solo con sesión de gestión (demo-session / canManageCatalog). Registrado puro: no.
      showBackoffice(data.canManageCatalog === true);
      applyProject(active, {persist: !!active, emit: true});
    } catch (e) {
      // El UI provisional de signedIn (Registrado / Entrar) ya cubre el fallo; no reenganchar listeners.
      showBackoffice(session.registrado ? false : true);
      if (!session.registrado && link) {
        link.hidden = false;
        link.removeAttribute('data-i18n');
        link.dataset.shellTextEs = 'Entrar';
        link.dataset.shellTextEn = 'Sign in';
        link.textContent = T('Entrar', 'Sign in');
        link.title = T('Sesión de Google: ', 'Google session: ') + session.email;
      }
      toast(e.status === 401
        ? T('Sesión caducada. Vuelve a entrar.', 'Session expired. Sign in again.')
        : T('No se pudo cargar la lista de proyectos.', 'Could not load the project list.'));
    }
  }

  function signedIn(session) {
    marcarSesion();
    verifiedSession = true;
    currentSession = session;
    if (!link) return;
    if (host) host.hidden = true;
    link.removeAttribute('data-i18n');
    link.classList.add('is-signed');
    // UI inmediata mientras llega /api/proyectos (y para el caso registrado sin lista aún).
    if (session.registrado) {
      link.hidden = false;
      link.dataset.shellTextEs = 'Registrado';
      link.dataset.shellTextEn = 'Registered';
      link.textContent = T('Registrado', 'Registered');
      link.title = T('Sesión de Google: ', 'Google session: ') + session.email + T(' · ves los Xpacios privados a los que tienes acceso', ' · you see the private Xpacios you have access to');
      link.addEventListener('click', cerrarSesion);
      showBackoffice(false);
    } else if (!session.token) {
      link.hidden = false;
      link.dataset.shellTextEs = 'Entrar';
      link.dataset.shellTextEn = 'Sign in';
      link.textContent = T('Entrar', 'Sign in');
      link.title = T('Sesión verificada: ', 'Verified session: ') + session.email;
    } else {
      link.hidden = true;
    }
    // Sesión con token → selector de proyecto (sustituye el enlace provisional).
    if (session.token) bootProjects(session);
  }

  function renderButton() {
    if (!host || !(root.google && root.google.accounts && root.google.accounts.id)) return false;
    shownLocale = lang();
    host.replaceChildren();
    root.google.accounts.id.renderButton(host, {type: 'standard', theme: 'filled_black', size: 'medium',
      shape: 'pill', text: 'signin', logo_alignment: 'left', locale: lang()});
    return true;
  }
  // Primero la sesión de siempre (backoffice, demos). Si esa cuenta no la tiene, entra como registrada (/api/registro):
  // cualquier cuenta de Google verificada, para ver los Xpacios privados a los que tenga acceso.
  async function verify(token) {
    const init = {method: 'POST', headers: {Authorization: 'Bearer ' + token}, cache: 'no-store'};
    let r = await fetch('/api/demo-session', init);
    if (r.status === 401) r = await fetch('/api/registro', init);
    if (!r.ok) { const e = new Error('session_' + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  async function onCredential(resp) {
    const token = resp && resp.credential;
    if (!token) return;
    try {
      const session = await verify(token);
      const registrado = session.registrado === true;
      try { root.localStorage.setItem(KEY, JSON.stringify({token, email: session.email, registrado})); } catch (_) {}
      signedIn({email: session.email, registrado, token});
      try { root.dispatchEvent(new CustomEvent('admira:session', {detail: {source: 'google'}})); } catch (_) {}
      toast(registrado
        ? T('Registrado · ', 'Registered · ') + session.email + T('. Ya ves los Xpacios privados a los que tienes acceso.', '. You now see the private Xpacios you have access to.')
        : T('Sesión iniciada · ', 'Signed in · ') + session.email);
    } catch (e) {
      try { root.google.accounts.id.disableAutoSelect(); } catch (_) {}
      toast(e.status === 503
        ? T('No se pudo verificar el acceso. Vuelve a intentarlo.', 'Access could not be verified. Try again.')
        : T('Esta cuenta de Google no tiene acceso a admira.biz.', 'This Google account has no access to admira.biz.'));
    }
  }
  function mount(el) {
    if (link || !el || isBackoffice(root.location.pathname)) return;
    link = el;
    // Texto por defecto sin sesión: Entrar (Carlos, 9-nov-2026).
    if (!(link.classList && typeof link.classList.contains === 'function' && link.classList.contains('is-signed'))) {
      link.removeAttribute('data-i18n');
      link.dataset.shellTextEs = 'Entrar';
      link.dataset.shellTextEn = 'Sign in';
      link.textContent = T('Entrar', 'Sign in');
    }
    // Backoffice permanece visible en la cabecera (entre él y el buscador va Entrar/proyecto).
    // Solo se oculta para cuentas «registrado» sin gestión de catálogo.
    let session = null;
    try { session = stored(root.localStorage); } catch (_) {}
    if (session) { signedIn(session); return; }
    style();
    host = document.createElement('span');
    host.className = 'header-login-gis';
    host.hidden = true;
    link.after(host);
    // Google pinta el botón de forma asíncrona: si dos pintados se solapan (cambio de idioma al arrancar), quedaban
    // dos botones «Iniciar sesión» (visto en producción el 19-oct-2026). Se conserva sólo el último pintado.
    new MutationObserver(() => { while (host.children.length > 1) host.firstElementChild.remove(); }).observe(host, {childList: true});
    if (/^(www\.)?admira\.biz$/i.test(root.location.hostname)) serverSession(root.fetch.bind(root)).then(s => { if (s) signedIn(s); });
    loadGsi().then(google => {
      if (verifiedSession) return;
      google.accounts.id.initialize({client_id: clientFor(root.location.hostname), callback: onCredential,
        ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true});
      if (!renderButton()) return;
      host.hidden = false;
      link.hidden = true;
      // Al cambiar de idioma se repinta una sola vez: Google pinta el botón de forma asíncrona y
      // dos repintados seguidos dejaban dos botones (pasaba en el móvil al fijarse el idioma).
      const relocalize = () => {
        clearTimeout(repaint);
        repaint = setTimeout(() => { if (lang() !== shownLocale && !host.hidden) renderButton(); }, 150);
      };
      document.addEventListener('admira:lang', relocalize);
      new MutationObserver(relocalize).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
    }).catch(() => { /* sin Google: el enlace «Entrar» (a backoffice) sigue ahí */ });
  }
  // La portada trae el enlace en el HTML; galaxy-shell lo pinta después en las demás páginas.
  function find() {
    const el = document.getElementById('header-login');
    if (el) { mount(el); return true; }
    return false;
  }
  if (!find()) {
    const mo = new MutationObserver(() => { if (find()) mo.disconnect(); });
    mo.observe(document.documentElement, {childList: true, subtree: true});
    setTimeout(() => mo.disconnect(), 15000);
  }
})(typeof window === 'undefined' ? globalThis : window);
