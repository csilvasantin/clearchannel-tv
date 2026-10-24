import { handleBugitoXpacios } from './server/bugito-xpacios.mjs';
import { handleBugitoCommand } from './server/bugito-command.mjs';
import {clearChannelNativePath,CC_NATIVE_PREFIX} from './server/native-clear-channel.mjs';
import { handleOrders } from './server/orders.mjs';
import { handleDemoSession } from './server/demo-session.mjs';
import {handleGlobalDemo} from './server/global-demo.mjs';
import {onRequest as avatarAsk} from './avatar-ask.js';
import { bizAssetPath, BIZ_ASSET_PREFIX, suiteCanonicalURL } from './server/biz-assets.mjs';
import { detalleProyectoURL } from './server/detalle-proyecto.mjs';
import { esPrevioCircuito, handlePrevioCircuito } from './server/previo-circuito.mjs';

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
const AVATAR_TAG = '<script defer src="https://www.admiranext.com/assets/avatar.js?v=20261007-demo-ack-1" data-brain="/avatar-ask" data-admira-avatar></script>';
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

// Comprobar la sesión del navegador (20-10-2026): la cookie __Host-yk_session la pone el POST a /auth/agente de este
// mismo origen, así que la página pregunta aquí (GET /auth/sesion) y el worker reenvía la cookie al API. Un visitante
// sin sesión recibe 200 {ok:false}, no un 401: la consola de la portada queda limpia (antes la página llamaba a
// api.admira.biz directamente y Chrome anotaba el 401 como error). Sólo GET.
const SESSION_PATH = '/auth/sesion', SESSION_UPSTREAM = '/auth/session';
async function agentLogin(request, url) {
  if (url.pathname !== '/auth/agente' && url.pathname !== SESSION_PATH) return null;
  var target = agentUpstream(url.hostname);
  if (!target) return null;
  if (url.pathname === SESSION_PATH) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('{"ok":false,"error":"method_not_allowed"}', { status: 405, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Allow': 'GET, HEAD' } });
    var sh = new Headers();
    ['cookie', 'user-agent', 'cf-connecting-ip', 'accept-language'].forEach(function (name) { var v = request.headers.get(name); if (v) sh.set(name, v); });
    sh.set('Origin', target.origin); sh.set('Accept', 'application/json');
    var sr;
    try { sr = await fetch(new URL(SESSION_UPSTREAM, target.api), { method: 'GET', headers: sh, redirect: 'manual' }); }
    catch (e) { return new Response('{"ok":false,"error":"upstream_unreachable"}', { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
    var sinSesion = sr.status === 401 || sr.status === 403;
    var body = sinSesion ? '{"ok":false,"sesion":false}' : await sr.text();
    return new Response(body, { status: sinSesion ? 200 : sr.status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
  }
  var headers = new Headers();
  AGENT_LOGIN_PASS.forEach(function (name) {
    var value = request.headers.get(name);
    if (value) headers.set(name, value);
  });
  headers.set('Origin', target.origin);
  var init = { method: request.method, headers: headers, redirect: 'manual' };
  if (!['GET','HEAD','OPTIONS'].includes(request.method)) init.body = await request.arrayBuffer();
  var response = await fetch(new URL('/auth/agente' + url.search, target.api), init);
  var out = new Headers(response.headers);
  out.set('Cache-Control', 'no-store');
  out.set('Referrer-Policy', 'no-referrer');
  out.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, { status: response.status, headers: out });
}

// Plano compartido (DCL-6ae9d5b0e2d48ee2fd9c7b19): los clientes globales comparten planos e
// inventario ITIL entre las cinco soluciones, y /data/xpacios/<id>.json se lee desde fuera
// (gemelo de admira.store, adaptaciones de admira.studio, admira.tv). Son planos ya públicos:
// CORS abierto solo para leer (GET/HEAD, sin credenciales) y 5 min de caché. Las cabeceras van
// aquí y no en _headers porque la release de admira.biz conserva el _headers de la base y este
// worker sí se copia de la raíz (scripts/build-biz-release.mjs). Un id sin plano da 404 en JSON
// (Pages respondería con la portada, 200 HTML).
const PLANO_JSON = /^\/data\/xpacios\/[a-z0-9][a-z0-9-]{0,79}\.json$/;
const PLANO_CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'X-Content-Type-Options': 'nosniff' };
function sharedPlanPreflight() {
  return new Response(null, { status: 204, headers: Object.assign({ 'Access-Control-Max-Age': '86400', 'Cache-Control': 'public, max-age=86400' }, PLANO_CORS) });
}
function sharedPlan(response, pathname) {
  var type = response.headers.get('content-type') || '';
  // Un 304 (If-None-Match del navegador) es el plano vigente sin cuerpo, no un «sin plano»:
  // tratarlo como error devolvía 404 en cada segunda carga y el gemelo caía a su copia local.
  var notModified = response.status === 304;
  if (!notModified && (!response.ok || type.includes('text/html'))) {
    var id = pathname.split('/').pop().replace(/\.json$/, '');
    return new Response(JSON.stringify({ error: 'sin-plano', id: id }), { status: 404, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' }, PLANO_CORS) });
  }
  var headers = new Headers(response.headers);
  for (var name in PLANO_CORS) headers.set(name, PLANO_CORS[name]);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=300');
  headers.delete('Access-Control-Allow-Credentials');
  headers.delete('Set-Cookie');
  return new Response(notModified ? null : response.body, { status: response.status, headers: headers });
}

export default {
  async fetch(request, env, ctx) {
    // Previo del circuito para el mapa y la ficha (FLT-102666): sólo en admira.biz, su vista previa y local.
    if (esPrevioCircuito(new URL(request.url))) return handlePrevioCircuito(request, { waitUntil: ctx && typeof ctx.waitUntil === 'function' ? p => ctx.waitUntil(p) : null });
    if (['/api/bugito/commands','/api/bugito/status','/api/bugito/launch'].includes(new URL(request.url).pathname)) return handleBugitoCommand(request,env);
    if (['/api/bugito/targets','/api/bugito/incidents','/api/bugito/owner'].includes(new URL(request.url).pathname)) return handleBugitoXpacios(request,env);
    if (new URL(request.url).pathname === '/avatar-ask') return avatarAsk({request});
    if (new URL(request.url).pathname === '/api/demo-global') return handleGlobalDemo(request, env);
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
    // Internal release assets are selected by Host, never by a visitor-supplied
    // prefix. Keep other customer domains on their preserved release.
    let publicPath=url.pathname;
    try {publicPath=decodeURIComponent(publicPath);} catch (_) {}
    if ([BIZ_ASSET_PREFIX,CC_NATIVE_PREFIX].some(prefix=>publicPath===prefix||publicPath.startsWith(prefix+'/'))) return new Response('Not found', {status:404});
    // Detalle de proyecto: solo en la zona protegida de admiranext.com (server/detalle-proyecto.mjs).
    var detalle = detalleProyectoURL(url.pathname);
    if (detalle) return new Response(null, {status:302, headers:{location:detalle, 'cache-control':'private, no-store', 'x-robots-tag':'noindex'}});
    var plano = PLANO_JSON.test(url.pathname);
    if (plano && request.method === 'OPTIONS') return sharedPlanPreflight();
    var assetPath = bizAssetPath(url, request.method) || clearChannelNativePath(url, request.method);
    // ⌘ Experto: sin copia local del motor de la suite; /suite/ va a admiranext.com (server/biz-assets.mjs).
    var suite = !assetPath && suiteCanonicalURL(url, request.method);
    if (suite) return new Response(null, {status:302, headers:{location:suite, 'cache-control':'public, max-age=300'}});
    var assetRequest = request;
    if (assetPath) {
      var assetUrl = new URL(request.url);
      assetUrl.pathname = assetPath;
      assetRequest = new Request(assetUrl, request);
    }
    var response = await env.ASSETS.fetch(assetRequest);
    if (plano && (request.method === 'GET' || request.method === 'HEAD')) return sharedPlan(response, url.pathname);
    var contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;
    var avatar = wantsAvatar(url, response);
    if (!ADMIRA_HOST.test(url.hostname)) return avatar ? avatarRewriter().transform(response) : response;
    return admiraRewriter(url.pathname, admiraApex(url.hostname), avatar).transform(response);
  }
};

export { PLANO_JSON, AVATAR_TAG, SELLO_TAG, ADMIRA_HOST, AGENT_LOGIN_HOST, agentLogin, agentUpstream, ADMIRA_MCP_FILES, YOKUP_MOVED_HOST, admiraApex, isYokupPath, replaceBrand, yokupMoved };
