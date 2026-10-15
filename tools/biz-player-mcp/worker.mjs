const HOSTS = new Set(['admira.biz', 'www.admira.biz']);
const FILES = new Map([
  ['/mcp/', '/hub.html'],
  ['/mcp/index.html', '/hub.html'],
  ['/mcp/manifest.json', '/manifest.json'],
  ['/mcp/llms.txt', '/llms.txt'],
  ['/mcp/native-players.md', '/native-players.md'],
  ['/mcp/bugito.md', '/bugito.md'],
]);
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!HOSTS.has(url.hostname)) return new Response('Not Found', {status:404});
    const evidence = /^\/mcp\/player-sync-evidence\/(?:(fronteras|reapertura|por-pieza)\.json|evidencias\.zip)$/.test(url.pathname);
    const mapped = FILES.get(url.pathname) || (evidence ? url.pathname.slice(4) : undefined);
    if (!mapped) return new Response('Not Found', {status:404});
    // Preserve the established authenticated RPC/SSE server, including cookies,
    // Authorization, request body and original URL. Documentation adds no tools.
    if (!['GET','HEAD'].includes(request.method) || request.headers.get('Accept')?.includes('text/event-stream')) {
      return env.GATE.fetch(request);
    }
    url.pathname = mapped;
    const response = await env.ASSETS.fetch(new Request(url, request));
    const headers = new Headers(response.headers);
    headers.set('X-Admira-Player-Docs', env.RELEASE);
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, {status:response.status, headers});
  }
};
