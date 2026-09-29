import { handleOrders } from './server/orders.mjs';
import { handleDemoSession } from './server/demo-session.mjs';

const ADMIRA_HOST = /(^|\.)admira\.app$/i;

// La puerta MCP de admira.app tiene voz propia (7-sep-2026). Los dos dominios se
// sirven del mismo proyecto Pages y el reescritor de marca solo toca HTML, así
// que /mcp/manifest.json y /mcp/llms.txt salían en admira.app diciendo
// "clearchannel-tv-audience" y describiendo Clear Channel. Cada uno tiene ahora
// su fichero bajo mcp/admira-app/ y el worker lo sirve cuando el Host es admira.app.
const ADMIRA_MCP_FILES = {
  '/mcp/manifest.json': '/mcp/admira-app/manifest.json',
  '/mcp/llms.txt': '/mcp/admira-app/llms.txt'
};

function replaceBrand(value) {
  if (!value) return value;
  return String(value)
    .replace(/www\.clearchannel\.tv/gi, 'www.admira.app')
    .replace(/clearchannel\.tv/gi, 'admira.app')
    .replace(/CLEAR(?:\s*<[^>]+>\s*)?·(?:\s*<[^>]+>\s*)?CHANNEL/g, 'ADMIRA·APP')
    .replace(/CLEAR·CHANNEL/g, 'ADMIRA·APP')
    .replace(/Clear\s+Channel/gi, 'Admira App');
}

function admiraRewriter(pathname) {
  var rewriter = new HTMLRewriter()
    .on('html', {
      element(element) {
        element.setAttribute('data-brand', 'admira');
      }
    })
    .on('title', {
      text(text) {
        var branded = replaceBrand(text.text);
        // text.text llega tal cual está en el HTML (entidades incluidas): se devuelve como
        // HTML para no escaparlo dos veces (el <title> salía con &amp;amp;).
        if (branded !== text.text) text.replace(branded, { html: true });
      }
    })
    .on('meta[content]', {
      element(element) {
        var content = element.getAttribute('content');
        var branded = replaceBrand(content);
        if (branded !== content) element.setAttribute('content', branded);
      }
    })
    .on('link[rel="canonical"]', {
      element(element) {
        element.setAttribute('href', 'https://www.admira.app' + pathname);
      }
    });
  // En la puerta /mcp/ la marca también va en el cuerpo (título, copy, enlaces al
  // informe): ahí se reescribe el texto y los href, no solo <title> y <meta>.
  if (pathname.startsWith('/mcp')) {
    rewriter
      .on('body *', {
        text(text) {
          var branded = replaceBrand(text.text);
          // text.text llega tal cual está en el HTML (entidades incluidas): se devuelve como
        // HTML para no escaparlo dos veces (el <title> salía con &amp;amp;).
        if (branded !== text.text) text.replace(branded, { html: true });
        }
      })
      .on('a[href]', {
        element(element) {
          var href = element.getAttribute('href');
          var branded = replaceBrand(href);
          if (branded !== href) element.setAttribute('href', branded);
        }
      });
  }
  return rewriter;
}

const DEMO_SALA = 'demo-sala-macmini';
const SIGNAGE_ORIGIN = 'https://api.admira.store';

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// El preview de Pages no está en la lista de orígenes de la antena. Este puente
// solo habla con la pantalla de sala de la demo y no reenvía un destino distinto.
async function proxyDemoSignage(request, url) {
  const tail = url.pathname.slice('/api/demo-signage/'.length);
  if (request.method === 'GET' && tail === 'feed') {
    return fetch(SIGNAGE_ORIGIN + '/signage/feed?screen=' + DEMO_SALA + '&limit=20', { headers: { accept: 'application/json' } });
  }
  if (request.method === 'GET' && tail === 'now') {
    return fetch(SIGNAGE_ORIGIN + '/signage/now?screen=' + DEMO_SALA, { headers: { accept: 'application/json' } });
  }
  if (request.method === 'POST' && tail === 'push') {
    let body = {};
    try { body = await request.json(); } catch { return jsonResponse({ error: 'bad-json' }, 400); }
    body.target = DEMO_SALA;
    body.interrupt = false;
    delete body.loc;
    delete body.locName;
    delete body.machine;
    return fetch(SIGNAGE_ORIGIN + '/signage/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
  if (request.method === 'POST' && tail === 'now') {
    let body = {};
    try { body = await request.json(); } catch { return jsonResponse({ error: 'bad-json' }, 400); }
    body.screen = DEMO_SALA;
    body.producer = DEMO_SALA;
    delete body.loc;
    delete body.locName;
    delete body.machine;
    return fetch(SIGNAGE_ORIGIN + '/signage/now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
  if (request.method === 'POST' && tail.indexOf('ack/') === 0) {
    const id = tail.slice(4);
    if (!/^[A-Za-z0-9-]+$/.test(id)) return jsonResponse({ error: 'bad-id' }, 400);
    return fetch(SIGNAGE_ORIGIN + '/signage/ack/' + id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen: DEMO_SALA })
    });
  }
  return jsonResponse({ error: 'not-found' }, 404);
}

export default {
  async fetch(request, env) {
    var early = new URL(request.url);
    if (early.pathname.startsWith('/api/demo-signage/')) return proxyDemoSignage(request, early);
    if (early.pathname === '/api/demo-session') return handleDemoSession(request);
    if (early.pathname.startsWith('/api/orders')) return handleOrders(request, env);
    var url = new URL(request.url);
    if (ADMIRA_HOST.test(url.hostname) && ADMIRA_MCP_FILES[url.pathname]) {
      var twin = new URL(request.url);
      twin.pathname = ADMIRA_MCP_FILES[url.pathname];
      return env.ASSETS.fetch(new Request(twin.toString(), request));
    }
    var response = await env.ASSETS.fetch(request);
    var contentType = response.headers.get('content-type') || '';
    if (!ADMIRA_HOST.test(url.hostname) || !contentType.includes('text/html')) return response;
    return admiraRewriter(url.pathname).transform(response);
  }
};

export { ADMIRA_HOST, ADMIRA_MCP_FILES, replaceBrand };
