const ADMIRA_HOST = /(^|\.)admira\.app$/i;

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
  return new HTMLRewriter()
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
}

export default {
  async fetch(request, env) {
    var response = await env.ASSETS.fetch(request);
    var url = new URL(request.url);
    var contentType = response.headers.get('content-type') || '';
    if (!ADMIRA_HOST.test(url.hostname) || !contentType.includes('text/html')) return response;
    return admiraRewriter(url.pathname).transform(response);
  }
};

export { ADMIRA_HOST, replaceBrand };
