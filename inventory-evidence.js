/* Shared evidence for catalogue labels. A catalogue state never proves a connection. */
(function (root) {
  'use strict';
  const MAX_AGE_MS = 120000;
  const owns = (value, key) => !!value && Object.prototype.hasOwnProperty.call(value, key);
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const illustrativeXtanco = loc => loc && ['xtanco-barcelona', 'xtanco-bcn'].includes(loc.id);
  const screenIds = surf => [...new Set([surf && surf.screen, ...(Array.isArray(surf && surf.pixerScreens) ? surf.pixerScreens : [])]
    .filter(id => typeof id === 'string' && id.length > 0))];

  function demonstration(loc, surf) {
    return !!(loc && (illustrativeXtanco(loc) || loc.demo === true || loc.testCircuit === true
      || (loc.external && loc.external.testCircuit === true)
      || /^(?:demo|sim)(?:[_-]|$)/i.test(String(loc.circuit || '')))
      || surf && (surf.demo === true || surf.testCircuit === true || surf.external && surf.external.testCircuit === true));
  }

  function surface(loc, surf, telemetry, now = Date.now()) {
    const result = { connection: 'unknown', demo: demonstration(loc, surf), checkedAt: 0, source: '' };
    const fetchedAt = telemetry && telemetry.fetchedAt;
    if (!record(telemetry) || telemetry.error || telemetry.ok === false || !record(telemetry.byScreen)
      || !Number.isFinite(fetchedAt) || fetchedAt <= 0 || !Number.isFinite(now)
      || now < fetchedAt || now - fetchedAt > MAX_AGE_MS) return result;
    const ids = screenIds(surf);
    if (!ids.length) return result;
    const matched = ids.map(id => owns(telemetry.byScreen, id) ? telemetry.byScreen[id] : null);
    if (matched.some(value => value !== null && (!record(value) || typeof value.online !== 'boolean'))) return result;
    const known = matched.filter(Boolean);
    if (!known.length) return result;
    // An online exact match proves connectivity; offline requires every mapped screen to be known.
    if (known.some(value => value.online)) result.connection = 'online';
    else if (known.length === ids.length) result.connection = 'offline';
    else return result;
    result.checkedAt = fetchedAt;
    result.source = '/signage/screens';
    return result;
  }

  function validSceneUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value);
      const allowed = ['xpaceos.com', 'www.xpaceos.com', 'admira.store', 'www.admira.store'];
      return url.protocol === 'https:' && allowed.includes(url.hostname.toLowerCase())
        && !url.username && !url.password && url.pathname !== '/' ? url.href : '';
    } catch (_) { return ''; }
  }

  function scene(loc) {
    let url = '';
    if (owns(loc, 'xpaceUrl')) url = validSceneUrl(loc.xpaceUrl);
    else if (root.XpaceLinks && typeof root.XpaceLinks.associationUrl === 'function') {
      // This includes the existing curated Starbucks association, never the legacy `twin` field.
      url = validSceneUrl(root.XpaceLinks.associationUrl(loc));
    }
    return { kind: url ? 'linked' : 'illustrative', url };
  }

  function kindLabel(loc, lang) {
    const en = lang === 'en';
    const translations = { Estanco:'Tobacco shop', 'Retail físico':'Physical retail', 'Xpacio 3D':'3D space',
      Cafebrería:'Book café', 'Proyecto independiente':'Independent project', 'Tienda oficial':'Official store',
      Loterías:'Lottery', 'Punto autorizado':'Authorized outlet', 'Circuito Admira':'Admira circuit', Oficina:'Office',
      'Quiosco de prensa':'Newsstand', 'DOOH exterior':'Outdoor DOOH', Quiosco:'Kiosk', Supermercado:'Supermarket',
      Vapeo:'Vape shop', 'Retail especializado':'Specialty retail' };
    const parts = String(loc && loc.kind || '').split(/\s*[·|]\s*/)
      .map(part => part.replace(/\b(?:gemelo\s+digital|digital\s+twin)(?:\s+(?:medido|measured))?\b/gi, '').trim())
      .filter(Boolean).map(part => en ? translations[part] || part : part);
    if (scene(loc).kind === 'linked') parts.push(en ? 'Linked scene' : 'Escena vinculada');
    else if (illustrativeXtanco(loc)) parts.push(en ? 'Illustrative view' : 'Vista ilustrativa');
    return parts.join(' · ');
  }

  function copy(state, lang) {
    const en = lang === 'en';
    const labels = en ? { online:'Connected · verified signal', offline:'Offline · verified signal', unknown:'Connection unverified' }
      : { online:'Conectada · señal verificada', offline:'Sin conexión · señal verificada', unknown:'Conexión sin verificar' };
    return { connectionLabel: labels[state && state.connection] || labels.unknown,
      demoLabel: state && state.demo ? (en ? 'DEMO' : 'DEMO') : '',
      sourceLabel: state && state.checkedAt ? (en ? 'Signal checked' : 'Señal comprobada') : '' };
  }

  const api = Object.freeze({ surface, scene, kindLabel, copy, MAX_AGE_MS });
  root.InventoryEvidence = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
