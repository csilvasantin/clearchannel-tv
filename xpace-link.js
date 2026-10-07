/* Explicit XpaceOS association for profile navigation.
 * `xpaceUrl` is deliberately separate from legacy `twin`/`fly` links: only an
 * own, valid value or a curated stable-ID association enables a concrete Xpacio. An own
 * empty value explicitly removes an older association. */
(function(root) {
  'use strict';

  const owns = (value, key) => !!value && Object.prototype.hasOwnProperty.call(value, key);
  // Curated association by stable location ID, including slim/detail API records.
  // An explicit backend/backoffice value (even empty) still takes precedence.
  const STARBUCKS_PASEO_ID = 'alsea-sbux-021';
  const STARBUCKS_PASEO_TWIN = 'https://www.admira.store/admira-xp/?quality=matrix&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks';

  function validXpaceUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      // XpaceOS host + admira.store twins (demo circuits / hilomusical).
      const allowed = host === 'xpaceos.com' || host === 'www.xpaceos.com'
        || host === 'admira.store' || host === 'www.admira.store';
      if (url.protocol !== 'https:' || !allowed) return '';
      if (url.username || url.password || url.pathname === '/') return '';
      return url.href;
    } catch (_) {
      return '';
    }
  }

  function associationUrl(location) {
    if (owns(location, 'xpaceUrl')) return validXpaceUrl(location.xpaceUrl);
    return location && location.id === STARBUCKS_PASEO_ID ? STARBUCKS_PASEO_TWIN : '';
  }

  function httpsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function panelNavigation(location) {
    const special = location && location.flyLabel ? httpsUrl(location.fly) : '';
    if (special) return { kind: 'special', href: special, label: String(location.flyLabel) };
    const href = associationUrl(location);
    if (!href) return null;
    if (location.id === STARBUCKS_PASEO_ID) return { kind: 'xpacio', href, labelKey: 'visit_twin' };
    // Demo circuits (and any admira.store twin): short EN/ES label.
    const isDemo = /^demo_[a-z0-9_]{2,60}$/.test(String((location && location.circuit) || ''));
    const host = (() => { try { return new URL(href).hostname.toLowerCase(); } catch (_) { return ''; } })();
    const storeTwin = host === 'admira.store' || host === 'www.admira.store';
    if (isDemo || storeTwin) return { kind: 'xpacio', href, labelKey: 'digital_twin' };
    return { kind: 'xpacio', href };
  }

  const api = { associationUrl, panelNavigation, validXpaceUrl };
  root.XpaceLinks = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
