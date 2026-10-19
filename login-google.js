/* Login con Google en la cabecera de admira.biz (Carlos, 15-oct-2026 · FLT-102490).
 * El «Login» llevaba a backoffice.html. Ahora es el botón oficial de Google Identity Services:
 * un clic abre el popup de cuentas de Google sin salir de la página. La credencial se verifica
 * en /api/demo-session (la misma regla de acceso que el backoffice) y se guarda donde la lee el
 * backoffice (omnip-bo-gtoken), así que al entrar en él la sesión ya está abierta. Si Google no
 * carga (bloqueado, sin red, origen no autorizado), el enlace de siempre sigue funcionando. */
(function (root) {
  'use strict';
  const GSI = 'https://accounts.google.com/gsi/client';
  // Mismos clientes que backoffice.html: admira.biz entra con el de la suite (el del sitio da
  // «origin_mismatch» allí); clearchannel.tv y admira.app, con el del sitio.
  const SUITE_CLIENT = '861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com';
  const SITE_CLIENT = '861856772040-quq6ut76k4mqj3fdq87h6g6caht3nm4l.apps.googleusercontent.com';
  const KEY = 'omnip-bo-gtoken';

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
      return {token: o.token, email: String(o.email || claims.email || '')};
    } catch (_) { return null; }
  }

  async function serverSession(fetcher) {
    try {
      const r = await fetcher('https://api.admira.biz/auth/session', {credentials:'include',cache:'no-store',signal:AbortSignal.timeout(5000)});
      if (!r.ok) return null;
      const s = await r.json();
      return s.ok === true && typeof s.email === 'string' && s.email.trim() ? {email:s.email,source:'server'} : null;
    } catch (_) { return null; }
  }
  const api = {clientFor, isBackoffice, parseJwt, stored, serverSession, KEY};
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
    if (document.getElementById('login-google-style')) return;
    const s = document.createElement('style');
    s.id = 'login-google-style';
    // color-scheme light: el iframe de Google es claro y, en una página oscura, Chrome le pinta
    // un fondo blanco opaco alrededor del botón. [hidden] tiene que ganar al display de la cabecera.
    s.textContent = '.header-login-gis{display:inline-flex;align-items:center;min-height:36px;flex:none;color-scheme:light}' +
      '.header-login-gis[hidden],#header-login[hidden]{display:none!important}' +
      '.login-google-toast{position:fixed;top:64px;right:16px;z-index:2147483000;max-width:min(360px,calc(100vw - 32px));' +
      'padding:10px 14px;border-radius:10px;background:rgba(10,22,32,.96);border:1px solid rgba(120,243,255,.35);color:#e6f6ff;' +
      'font:13px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4)}';
    document.head.append(s);
  }
  function toast(text) {
    style();
    const el = document.createElement('div');
    el.className = 'login-google-toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.append(el);
    setTimeout(() => el.remove(), 4500);
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

  let link = null, host = null, shownLocale = '', repaint = 0, verifiedSession = false;
  function signedIn(session) {
    marcarSesion();
    verifiedSession = true;
    if (!link) return;
    if (host) host.hidden = true;
    link.hidden = false;
    link.removeAttribute('data-i18n');   // el traductor de la portada no debe volver a poner «Login»
    // …ni el de la cabecera común (responsive-shell.js reescribe data-shell-text-es/en al arrancar y al cambiar de
    // idioma): en las páginas interiores el enlace volvía a decir «Login» con la sesión abierta (18-oct-2026).
    link.dataset.shellTextEs = link.dataset.shellTextEn = 'Backoffice';
    link.textContent = 'Backoffice';
    link.title = (session.source === 'server' ? T('Sesión verificada: ', 'Verified session: ') : T('Sesión de Google: ', 'Google session: ')) + session.email;
    link.classList.add('is-signed');
  }
  function renderButton() {
    if (!host || !(root.google && root.google.accounts && root.google.accounts.id)) return false;
    shownLocale = lang();
    host.replaceChildren();
    root.google.accounts.id.renderButton(host, {type: 'standard', theme: 'filled_black', size: 'medium',
      shape: 'pill', text: 'signin', logo_alignment: 'left', locale: lang()});
    return true;
  }
  async function verify(token) {
    const r = await fetch('/api/demo-session', {method: 'POST', headers: {Authorization: 'Bearer ' + token}, cache: 'no-store'});
    if (!r.ok) { const e = new Error('session_' + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  async function onCredential(resp) {
    const token = resp && resp.credential;
    if (!token) return;
    try {
      const session = await verify(token);
      try { root.localStorage.setItem(KEY, JSON.stringify({token, email: session.email})); } catch (_) {}
      signedIn({email: session.email});
      toast(T('Sesión iniciada · ', 'Signed in · ') + session.email);
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
    let session = null;
    try { session = stored(root.localStorage); } catch (_) {}
    if (session) { signedIn(session); return; }
    style();
    host = document.createElement('span');
    host.className = 'header-login-gis';
    host.hidden = true;
    link.after(host);
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
    }).catch(() => { /* sin Google: el enlace al backoffice sigue ahí */ });
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
