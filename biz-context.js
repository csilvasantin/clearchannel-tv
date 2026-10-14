/* Biz host adapter. Shared modules remain byte-for-byte upstream copies. */
(function (root) {
  'use strict';
  const API = 'https://api.admira.store';
  function belongs(location, project) {
    if (!project) return true;
    const locationId = String(location?.locationId || location?.loc || location?.id || '');
    if (project === 'starbucks') return locationId.startsWith('alsea-sbux-');
    return Array.isArray(location?.projects) && location.projects.includes(project);
  }
  function filterLocations(items, context, blocked = false) {
    if (blocked) return [];
    return (Array.isArray(items) ? items : []).filter(item => belongs(item, context?.proyecto));
  }
  async function tokenProvider(win, fetcher = win.fetch.bind(win)) {
    // Existing Google credential is transport, never evidence of a local role.
    let credential;
    try {
      const raw = win.localStorage.getItem('omnip-bo-gtoken') || win.sessionStorage.getItem('omnip-bo-gtoken');
      credential = JSON.parse(raw || 'null')?.token;
    } catch { return null; }
    if (typeof credential !== 'string' || !credential) return null;
    const response = await fetcher('/api/context-session', {method:'POST',credentials:'same-origin',cache:'no-store',headers:{Authorization:'Bearer ' + credential}});
    return response.ok ? response.json() : null;
  }
  const exported = {belongs, filterLocations, tokenProvider};
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (!root.document) return;
  let pending = true;
  let blocked = new URL(root.location.href).searchParams.has('proyecto');
  const startup = new URL(root.location.href);
  for (const field of ['marca','proyecto']) {
    if (startup.searchParams.has(field) && !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(startup.searchParams.get(field) || '')) startup.searchParams.delete(field);
  }
  if (startup.href !== root.location.href) root.history.replaceState(root.history.state, '', startup.href);
  root.ADMIRA_CONTEXT_OPTIONS = {
    api:API, tokenProvider:() => tokenProvider(root),
    expert:() => root.AdmiraExperto?.isOpen?.() === true || root.AdmiraExpert?.isOpen?.() === true || root.document.getElementById('expert-panel')?.hidden === false
  };
  const doc = root.document;
  doc.addEventListener('admira:contexto-error', event => {
    const denied = ['session-required','invalid-session','superuser-required','project-not-authorized','whitelist-unavailable'].includes(event.detail?.error);
    if (blocked || (denied && root.AdmiraContexto?.actual().proyecto)) blocked = true;
    doc.dispatchEvent(new root.CustomEvent('admira:segmento', {detail:{cliente:null}}));
  });
  doc.addEventListener('admira:contexto', event => {
    pending = false;
    if (event.detail.synced && event.detail.superusuario) blocked = false;
    doc.documentElement.dataset.proyecto = event.detail.proyecto || '';
    doc.dispatchEvent(new root.CustomEvent('admira:segmento', {detail:{cliente:event.detail.proyecto}}));
  });
  root.AdmiraBizContext = Object.freeze({
    actual:() => root.AdmiraContexto?.actual().proyecto || null,
    filtrar:items => filterLocations(items, root.AdmiraContexto?.actual(), pending || blocked),
    bloquear:() => {blocked = true; doc.dispatchEvent(new root.CustomEvent('admira:segmento', {detail:{cliente:null}}));},
    async request(path, init) {
      const response = await root.AdmiraContexto.request(path, init);
      if ([401,403].includes(response.status)) this.bloquear();
      return response;
    }
  });
  // Expose the existing Biz chrome to the common brand loader's native selectors.
  function chrome() {
    doc.querySelector('header.topbar, header')?.classList.add('pf-topbar');
    doc.querySelector('[data-brand-wordmark]')?.classList.add('pf-topbar-brand');
    doc.getElementById('options-panel')?.classList.add('rail-left');
  }
  doc.addEventListener('DOMContentLoaded', chrome);
  doc.addEventListener('admira:shell-ready', chrome);
  chrome();
})(typeof window === 'undefined' ? globalThis : window);
