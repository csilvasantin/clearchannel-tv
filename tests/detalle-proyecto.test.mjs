import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';
import { detalleProyectoURL } from '../server/detalle-proyecto.mjs';

// El detalle de un proyecto solo vive en la zona protegida de admiranext.com (Carlos, 20-10-2026).
const Z = 'https://www.admiranext.com/proyectos/';
const assets = { ASSETS: { fetch(req) { return new Response('asset:' + new URL(req.url).pathname, { headers: { 'content-type': 'text/plain' } }); } } };

test('las rutas de detalle de proyecto van a la zona protegida en todos los dominios', async () => {
  const casos = [['/cafebreria/', Z + 'cafebreria/'], ['/cafebreria', Z + 'cafebreria/'], ['/cafebreria/index.html', Z + 'cafebreria/'],
    ['/laboratorio/?lang=en', Z + 'laboratorio/'], ['/Laboratorio', Z + 'laboratorio/'], ['/docs/cafebreria.md', Z + 'cafebreria/'],
    ['/docs/laboratorio-admiranext.md', Z + 'laboratorio/'], ['/data/projects/cafebreria.json', Z + 'cafebreria/'],
    ['/docs/starbucks-digital-twin.md', Z], ['/docs/', Z], ['/data/projects/otro.json', Z], ['/%64ocs/cafebreria.md', Z + 'cafebreria/']];
  for (const host of ['www.admira.biz', 'admira.biz', 'www.admira.app', 'www.clearchannel.tv']) {
    for (const [path, destino] of casos) {
      const res = await worker.fetch(new Request(`https://${host}${path}`), assets);
      assert.equal(res.status, 302, `${host}${path}`);
      assert.equal(res.headers.get('location'), destino, `${host}${path}`);
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
    }
  }
});

test('el resto de rutas no cambia: planos compartidos, ayuda y portada', async () => {
  for (const path of ['/', '/help/', '/data/xpacios/lab-gran-de-gracia-51.json', '/documentacion/', '/cafebreria-x', '/docsx', '/mcp/manifest.json']) {
    assert.equal(detalleProyectoURL(path), '', path);
  }
  const res = await worker.fetch(new Request('https://www.clearchannel.tv/about.html'), assets);
  assert.equal(res.status, 200);
});
