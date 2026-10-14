// Bugito · login de superusuario para el dispositivo REAL (Opción B). La cuenta PROPIA de quien
// entra, por Google Identity Services, igual que backoffice.html de admira.biz: el ID token de
// Google (corto, firmado por Google) se manda como Authorization a api.admira.store, que lo
// verifica y decide si esa persona es owner. NO hay ningún token maestro pegado en la página.
(function () {
  'use strict';
  var SUITE = '861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com';
  var SITE = '861856772040-quq6ut76k4mqj3fdq87h6g6caht3nm4l.apps.googleusercontent.com';
  var CLIENT_ID = /(^|\.)admira\.biz$/i.test(location.hostname) ? SUITE : SITE;
  var KEY = 'bugito-super-gtoken';   // sólo el ID token de Google del propio usuario, en sessionStorage
  var listeners = [];

  function parseJwt(tok) {
    try {
      var p = String(tok).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';
      return JSON.parse(decodeURIComponent(atob(p).split('').map(function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join('')));
    } catch (e) { return null; }
  }
  function stored() {
    try {
      var raw = sessionStorage.getItem(KEY); if (!raw) return null;
      var o = JSON.parse(raw); if (!o || !o.token) return null;
      var pl = parseJwt(o.token);
      if (!pl || !pl.exp || pl.exp * 1000 < Date.now()) { sessionStorage.removeItem(KEY); return null; }
      return o;
    } catch (e) { return null; }
  }
  function emit() { var e = stored(); listeners.forEach(function (cb) { try { cb(e ? e.email : ''); } catch (_) {} }); }
  function onCredential(resp) {
    var token = resp && resp.credential; if (!token) return;
    var pl = parseJwt(token);
    try { sessionStorage.setItem(KEY, JSON.stringify({ token: token, email: pl && pl.email || '' })); } catch (e) {}
    emit();
  }
  window.BugitoSuper = {
    token: function () { var o = stored(); return o ? o.token : ''; },
    email: function () { var o = stored(); return o ? o.email : ''; },
    signedIn: function () { return !!stored(); },
    onChange: function (cb) { if (typeof cb === 'function') { listeners.push(cb); } },
    signOut: function () {
      try { sessionStorage.removeItem(KEY); } catch (e) {}
      try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
      emit();
    },
    renderButton: function (host, lang) {
      if (!host || !(window.google && google.accounts && google.accounts.id)) return false;
      try { host.replaceChildren(); google.accounts.id.renderButton(host, { theme: 'filled_blue', size: 'medium', shape: 'pill', text: 'signin_with', width: 220, locale: lang === 'en' ? 'en' : 'es' }); return true; } catch (e) { return false; }
    },
    init: function (host, lang) {
      if (!(window.google && google.accounts && google.accounts.id)) return false;
      try {
        google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential, auto_select: false, cancel_on_tap_outside: true });
        if (host) this.renderButton(host, lang);
        return true;
      } catch (e) { return false; }
    }
  };
})();
