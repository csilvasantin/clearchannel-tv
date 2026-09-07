import { handleOrders } from './server/orders.mjs';

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
        if (branded !== text.text) text.replace(branded);
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
          if (branded !== text.text) text.replace(branded);
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

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/api/orders')) return handleOrders(request, env);
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
