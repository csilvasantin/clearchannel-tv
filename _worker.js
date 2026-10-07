import { handleOrders } from './server/orders.mjs';
import { handleDemoSession } from './server/demo-session.mjs';
import {onRequest as avatarAsk} from './avatar-ask.js';

// admira.app (hoy) y admira.biz (tras el intercambio de dominios con Yokup, oct-2026)
// son la misma cara Admira de este proyecto: la marca sale del apex del Host.
const ADMIRA_HOST = /(^|\.)admira\.(app|biz)$/i;

// Apex de marca del Host: 'admira.biz' en (www.)admira.biz; en cualquier otro caso
// 'admira.app', que es la marca histórica de esta cara.
function admiraApex(hostname) {
  var match = /(?:^|\.)admira\.(app|biz)$/i.exec(String(hostname || ''));
  return 'admira.' + (match ? match[1].toLowerCase() : 'app');
}

// Intercambio de dominios (paso 1, sin corte): cuando admira.biz sirva este proyecto,
// las rutas que hoy son de Yokup en admira.biz se mandan a www.admira.app (que pasará a
// ser Yokup). Solo actúa con Host (www.)admira.biz: con admira.app o clearchannel.tv es inerte.
const YOKUP_MOVED_HOST = /^(www\.)?admira\.biz$/i;
const YOKUP_MOVED_ORIGIN = 'https://www.admira.app';
const YOKUP_PAGES = new Set(['retailer', 'retailer-incidencia', 'incidencias', 'ticket', 'intervencion',
  'informe-incidencia', 'instalador', 'alta-instalador', 'alta-punto', 'asistencia', 'dashboard', 'agentica',
  'carbono', 'agentes', 'agentDetail', 'consumos', 'supervisor', 'superusuario', 'misiones', 'tareas',
  'objetivos', 'decisiones', 'ideas', 'informes', 'notificaciones', 'normativa', 'equipo', 'equipo-inventario',
  'estrategia', 'entrenamiento', 'entrar', 'recuperar', 'contactanos', 'circuitos', 'highscore',
  'highscoreDetail', 'status', 'llamadas', 'llamadas-mcp', 'demo-llamadas', 'trackandfield', 'admira-live']);
const YOKUP_PREFIXES = ['/app/', '/asignaciones/', '/pruebas/', '/mcp/portales', '/mcp/smith-',
  '/mcp/installer.json', '/mcp/portals.json', '/mcp/retailer.json', '/mcp/portals-llms.txt', '/yk-',
  '/manifest.webmanifest', '/instalador.webmanifest', '/api/fleet-census'];

function isYokupPath(pathname) {
  var page = /^\/([^/]+?)(?:\.html|\/)?$/.exec(pathname);
  if (page && YOKUP_PAGES.has(page[1])) return true;
  return YOKUP_PREFIXES.some(function (prefix) { return pathname.startsWith(prefix); });
}

// Respuesta de compatibilidad para Yokup en admira.biz, o null si la petición es de este sitio.
function yokupMoved(request, url) {
  if (!YOKUP_MOVED_HOST.test(url.hostname)) return null;
  if (url.pathname === '/auth/callback' && request.method === 'POST') {
    return new Response(null, { status: 303, headers: { Location: YOKUP_MOVED_ORIGIN + '/entrar', 'Cache-Control': 'no-store' } });
  }
  if (url.pathname === '/auth/challenge' && request.method === 'POST') {
    return new Response(JSON.stringify({ moved_to: YOKUP_MOVED_ORIGIN }), { status: 410, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  if (!isYokupPath(url.pathname)) return null;
  return new Response(null, { status: 308, headers: { Location: YOKUP_MOVED_ORIGIN + url.pathname + url.search } });
}

// La puerta MCP de admira.app tiene voz propia (7-sep-2026). Los dos dominios se
// sirven del mismo proyecto Pages y el reescritor de marca solo toca HTML, así
// que /mcp/manifest.json y /mcp/llms.txt salían en admira.app diciendo
// "clearchannel-tv-audience" y describiendo Clear Channel. Cada uno tiene ahora
// su fichero bajo mcp/admira-app/ y el worker lo sirve cuando el Host es admira.app
// (o admira.biz, que hereda esta cara tras el intercambio de dominios).
const ADMIRA_MCP_FILES = {
  '/mcp/manifest.json': '/mcp/admira-app/manifest.json',
  '/mcp/llms.txt': '/mcp/admira-app/llms.txt'
};

function replaceBrand(value, apex) {
  if (!value) return value;
  apex = apex || 'admira.app';
  var wordmark = apex.replace('.', '·').toUpperCase();
  return String(value)
    .replace(/www\.clearchannel\.tv/gi, 'www.' + apex)
    .replace(/clearchannel\.tv/gi, apex)
    .replace(/CLEAR(?:\s*<[^>]+>\s*)?·(?:\s*<[^>]+>\s*)?CHANNEL/g, wordmark)
    .replace(/CLEAR·CHANNEL/g, wordmark)
    .replace(/Clear\s+Channel/gi, apex);
}

// Avatar digital (encargo avatar · 4-oct-2026): el cargador común de admiranext.com
// decide si se ve (elección del visitante > interruptor del proyecto > apagado; los
// interruptores clearchannel-tv y admira-biz están apagados). Va en toda página HTML
// servida con 200 salvo /auth/, en clearchannel.tv y en la cara Admira. Las preguntas
// van a /avatar-ask de este mismo worker.
const AVATAR_TAG = '<script defer src="https://www.admiranext.com/assets/avatar.js?v=20261007-pill-1" data-brain="/avatar-ask" data-admira-avatar></script>';
function wantsAvatar(url, response) {
  return response.status === 200 && !url.pathname.startsWith('/auth/');
}
// Sello de versión con novedades (Merovingio, 06-10-2026): mismo cargador común de admiranext.com,
// que lee el /version.json de este sitio y enseña sus novedades al pasar el ratón.
const SELLO_TAG = '<script defer src="https://www.admiranext.com/assets/sello-novedades.js?v=20261006-options-sello-4" data-admira-sello-loader></script>';
function avatarRewriter() {
  return new HTMLRewriter().on('head', {element(el) {el.append(AVATAR_TAG + SELLO_TAG, {html:true});}});
}

function admiraRewriter(pathname, apex, avatar) {
  apex = apex || 'admira.app';
  var homeTitle = 'Mapa de espacios comerciales | ' + apex;
  var rewriter = new HTMLRewriter()
    .on('head', {element(el) {el.append('<script defer src="https://www.admiranext.com/assets/live-presence.js?v=2"></script>' + (avatar ? AVATAR_TAG + SELLO_TAG : ''), {html:true});}})
    .on('html', {
      element(element) {
        element.setAttribute('data-brand', 'admira');
        element.setAttribute('lang', 'es');
      }
    })
    .on('title', {
      element(element) {
        if (pathname === '/' || pathname === '/index.html') element.setInnerContent(homeTitle);
      },
      text(text) {
        if (pathname === '/' || pathname === '/index.html') return;
        var branded = replaceBrand(text.text, apex);
        // text.text llega tal cual está en el HTML (entidades incluidas): se devuelve como
        // HTML para no escaparlo dos veces (el <title> salía con &amp;amp;).
        if (branded !== text.text) text.replace(branded, { html: true });
      }
    })
    .on('meta[content]', {
      element(element) {
        var content = element.getAttribute('content');
        var branded = replaceBrand(content, apex);
        if (pathname === '/' || pathname === '/index.html') {
          var name = element.getAttribute('name') || element.getAttribute('property');
          if (name === 'description' || name === 'og:description' || name === 'twitter:description') branded = 'Mapa de espacios comerciales de ' + apex + '. Busca un punto, consulta sus pantallas y planifica campañas.';
          if (name === 'og:title' || name === 'twitter:title') branded = homeTitle;
        }
        if (branded !== content) element.setAttribute('content', branded);
      }
    })
    .on('link[rel="canonical"]', {
      element(element) {
        element.setAttribute('href', 'https://www.' + apex + pathname);
      }
    });
  // En la puerta /mcp/ la marca también va en el cuerpo (título, copy, enlaces al
  // informe): ahí se reescribe el texto y los href, no solo <title> y <meta>.
  if (pathname.startsWith('/mcp')) {
    rewriter
      .on('body *', {
        text(text) {
          var branded = replaceBrand(text.text, apex);
          // text.text llega tal cual está en el HTML (entidades incluidas): se devuelve como
        // HTML para no escaparlo dos veces (el <title> salía con &amp;amp;).
        if (branded !== text.text) text.replace(branded, { html: true });
        }
      })
      .on('a[href]', {
        element(element) {
          var href = element.getAttribute('href');
          var branded = replaceBrand(href, apex);
          if (branded !== href) element.setAttribute('href', branded);
        }
      });
  }
  return rewriter;
}

// Entrada de agentes sin Google (encargo #5067 en admira.app; encargo #5083 en admira.biz).
// La lógica y el secret viven en el API de la casa. Aquí solo se reenvía lo que no es
// GET/HEAD y se devuelve tal cual, Set-Cookie incluida. El GET sigue en la página estática.
// admira.app y la vista previa van a api.admira.app. (www.)admira.biz va a api.admira.biz,
// que es la misma mesa y su propia cookie. clearchannel.tv no reenvía.
const AGENT_LOGIN_HOST = /^(www\.)?admira\.app$|(^|\.)clearchannel-tv\.pages\.dev$/i;
const AGENT_LOGIN_API = 'https://api.admira.app';
const AGENT_LOGIN_PASS = ['authorization', 'content-type', 'cookie', 'x-agente', 'x-return-to', 'user-agent', 'cf-connecting-ip'];

function agentUpstream(hostname) {
  var host = String(hostname || '').toLowerCase();
  if (host === 'admira.biz' || host === 'www.admira.biz') {
    return { api: 'https://api.admira.biz', origin: 'https://' + host };
  }
  if (AGENT_LOGIN_HOST.test(host)) {
    return { api: AGENT_LOGIN_API, origin: 'https://www.admira.app' };
  }
  return null;
}

async function agentLogin(request, url) {
  if (url.pathname !== '/auth/agente' || request.method === 'GET' || request.method === 'HEAD') return null;
  var target = agentUpstream(url.hostname);
  if (!target) return null;
  var headers = new Headers();
  AGENT_LOGIN_PASS.forEach(function (name) {
    var value = request.headers.get(name);
    if (value) headers.set(name, value);
  });
  headers.set('Origin', target.origin);
  var init = { method: request.method, headers: headers, redirect: 'manual' };
  if (request.method !== 'OPTIONS') init.body = await request.arrayBuffer();
  var response = await fetch(new URL('/auth/agente' + url.search, target.api), init);
  var out = new Headers(response.headers);
  out.set('Cache-Control', 'no-store');
  out.set('Referrer-Policy', 'no-referrer');
  out.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, { status: response.status, headers: out });
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/avatar-ask') return avatarAsk({request});
    if (new URL(request.url).pathname === '/api/demo-session') return handleDemoSession(request);
    if (new URL(request.url).pathname.startsWith('/api/orders')) return handleOrders(request, env);
    var url = new URL(request.url);
    var agent = await agentLogin(request, url);
    if (agent) return agent;
    var moved = yokupMoved(request, url);
    if (moved) return moved;
    if (ADMIRA_HOST.test(url.hostname) && ADMIRA_MCP_FILES[url.pathname]) {
      var twin = new URL(request.url);
      twin.pathname = ADMIRA_MCP_FILES[url.pathname];
      return env.ASSETS.fetch(new Request(twin.toString(), request));
    }
    var response = await env.ASSETS.fetch(request);
    var contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;
    var avatar = wantsAvatar(url, response);
    if (!ADMIRA_HOST.test(url.hostname)) return avatar ? avatarRewriter().transform(response) : response;
    return admiraRewriter(url.pathname, admiraApex(url.hostname), avatar).transform(response);
  }
};

export { AVATAR_TAG, SELLO_TAG, ADMIRA_HOST, AGENT_LOGIN_HOST, agentLogin, agentUpstream, ADMIRA_MCP_FILES, YOKUP_MOVED_HOST, admiraApex, isYokupPath, replaceBrand, yokupMoved };
