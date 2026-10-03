(function () {
  'use strict';

  var hostname = String(window.location.hostname || '').toLowerCase();
  var forced = new URLSearchParams(window.location.search).get('brand');
  // admira.app (hoy) y admira.biz (tras el intercambio de dominios con Yokup) son la
  // misma cara Admira: nombre, dominio y origen salen del apex del Host.
  var admiraHost = /(^|\.)admira\.(app|biz)$/.exec(hostname);
  var isAdmira = !!admiraHost || (!/(^|\.)clearchannel\.tv$/.test(hostname) && forced === 'admira');
  var admiraApex = 'admira.' + (admiraHost ? admiraHost[2] : 'app');

  var brands = {
    clearchannel: {
      id: 'clearchannel',
      defaultLanguage: 'en',
      name: 'Clear Channel',
      wordmark: 'CLEAR·CHANNEL',
      domain: 'www.clearchannel.tv',
      origin: 'https://www.clearchannel.tv'
    },
    admira: {
      id: 'admira',
      defaultLanguage: 'es',
      name: admiraApex,
      wordmark: admiraApex.replace('.', '·').toUpperCase(),
      domain: 'www.' + admiraApex,
      origin: 'https://www.' + admiraApex
    }
  };
  var brand = isAdmira ? brands.admira : brands.clearchannel;

  document.documentElement.dataset.brand = brand.id;
  window.ADMIRA_SITE_BRAND = brand;
  document.documentElement.lang = brand.defaultLanguage;

  function replaceBrand(value) {
    if (!isAdmira || !value) return value;
    return String(value)
      .replace(/www\.clearchannel\.tv/gi, brand.domain)
      .replace(/clearchannel\.tv/gi, brand.name)
      .replace(/CLEAR(?:\s*<[^>]+>\s*)?·(?:\s*<[^>]+>\s*)?CHANNEL/g, brand.wordmark)
      .replace(/CLEAR·CHANNEL/g, brand.wordmark)
      .replace(/Clear\s+Channel/gi, brand.name);
  }

  function rewriteElement(element) {
    if (!element || element.nodeType !== 1) return;
    ['title', 'aria-label', 'content'].forEach(function (attribute) {
      if (!element.hasAttribute(attribute)) return;
      var current = element.getAttribute(attribute);
      var next = replaceBrand(current);
      if (next !== current) element.setAttribute(attribute, next);
    });
    if (element.tagName === 'LINK' && element.getAttribute('rel') === 'canonical') {
      element.setAttribute('href', brand.origin + window.location.pathname);
    }
    if (element.matches('[data-brand-name]')) element.textContent = brand.name;
    if (element.matches('[data-brand-wordmark]')) element.textContent = brand.wordmark;
  }

  function rewriteTree(root) {
    if (!isAdmira || !root) return;
    if (root.nodeType === 1) rewriteElement(root);
    var elements = root.querySelectorAll ? root.querySelectorAll('[title],[aria-label],[content],link[rel="canonical"],[data-brand-name],[data-brand-wordmark]') : [];
    Array.prototype.forEach.call(elements, rewriteElement);

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) {
      var parent = walker.currentNode.parentElement;
      if (parent && !/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(parent.tagName)) nodes.push(walker.currentNode);
    }
    nodes.forEach(function (node) {
      var next = replaceBrand(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  }

  function exposeVersion() {
    fetch('/version.json', { cache: 'no-store' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (release) {
        if (!release || !release.version) return;
        document.documentElement.dataset.version = release.version;
        var meta = document.querySelector('meta[name="admiranext-version"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'admiranext-version');
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', release.version);
        var badge = document.createElement('div');
        badge.className = 'release-signature';
        badge.setAttribute('aria-label', (document.documentElement.lang === 'en' ? 'Version ' : 'Versión ') + release.version + ' · ' + release.signature);
        badge.textContent = release.version + ' · ' + release.signature;
        document.body.appendChild(badge);
      })
      .catch(function () {});
  }

  function ready() {
    rewriteTree(document.documentElement);
    exposeVersion();
    if (!isAdmira) return;
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        Array.prototype.forEach.call(record.addedNodes || [], function (node) {
          if (node.nodeType === 1) rewriteTree(node);
          if (node.nodeType === 3 && node.parentElement && !/^(SCRIPT|STYLE)$/.test(node.parentElement.tagName)) {
            node.nodeValue = replaceBrand(node.nodeValue);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
}());
