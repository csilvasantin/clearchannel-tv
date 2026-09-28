/* Explicit XpaceOS association for profile navigation.
 * `xpaceUrl` is deliberately separate from legacy `twin`/`fly` links: only an
 * own, valid value means this location has a concrete Xpacio to open. An own
 * empty value explicitly removes an older association. */
(function(root) {
  'use strict';

  const owns = (value, key) => !!value && Object.prototype.hasOwnProperty.call(value, key);

  function validXpaceUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      if (url.protocol !== 'https:' || (host !== 'xpaceos.com' && host !== 'www.xpaceos.com')) return '';
      if (url.username || url.password || url.pathname === '/') return '';
      return url.href;
    } catch (_) {
      return '';
    }
  }

  function associationUrl(location) {
    return owns(location, 'xpaceUrl') ? validXpaceUrl(location.xpaceUrl) : '';
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
    return href ? { kind: 'xpacio', href } : null;
  }

  const api = { associationUrl, panelNavigation, validXpaceUrl };
  root.XpaceLinks = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
