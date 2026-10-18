// Un único manejador de comandos de la suite (admira-next-web AGENTS.md, Carlos, 12-10-2026).
// El ⌘ Experto de admira.biz y de los clones nativos de clearchannel.tv es el de admiranext.com/suite/experto.js.
// Hasta el 18-oct-2026 el repo guardaba una copia en suite/experto.js que se publicaba en www.admira.biz/suite/
// y en www.clearchannel.tv/suite/ sin que ninguna página la cargara: se quedó en avatar.js 20261014 y sin
// /supervisor estado. Estas pruebas impiden que vuelva una copia y que una página la cargue en lugar del canónico.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIZ_ASSET_FILES, SUITE_CANONICAL_ORIGIN, suiteCanonicalURL } from '../server/biz-assets.mjs';
import { CC_NATIVE_FILES } from '../server/native-clear-channel.mjs';
import worker from '../_worker.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const CANONICAL = 'https://www.admiranext.com/suite/experto';

test('el repo no guarda copia del motor de la suite: de suite/ sólo queda el contexto propio de Biz', () => {
  assert.equal(SUITE_CANONICAL_ORIGIN + '/suite/experto', CANONICAL);
  assert.deepEqual(readdirSync(join(root, 'suite')), ['biz-native-context.js']);
  for (const file of ['experto.js', 'experto.css', 'demo-ios.mjs', 'demo-android.mjs', 'demo-control.js']) {
    assert.equal(existsSync(join(root, 'suite', file)), false, 'suite/' + file);
  }
  assert.deepEqual(BIZ_ASSET_FILES.filter(file => file.startsWith('suite/')), ['suite/biz-native-context.js']);
  assert.deepEqual(CC_NATIVE_FILES.filter(file => file.startsWith('suite/')), ['suite/biz-native-context.js']);
});

test('todas las páginas y shells cargan el motor y la piel de admiranext.com, nunca una ruta local', () => {
  const files = execFileSync('git', ['ls-files', '*.html', '*.js', '*.mjs', '*.cjs'], {cwd:root, encoding:'utf8'})
    .split('\n').filter(file => file && !file.startsWith('tests/'));
  const loaders = [];
  for (const file of files) {
    // La guarda «ya cargado» (script[src*="/suite/experto.js"]) vale para cualquier origen: no es un cargador.
    const text = readFileSync(join(root, file), 'utf8').replace(/\[src[*^]?=\s*["'][^"'\n]*["']\]/g, '[src]');
    // Literales de una línea que nombran el motor: src/href de HTML, cadenas JS y plantillas.
    for (const [, , literal] of text.matchAll(/(["'`])([^"'`\n]*suite\/experto(?:\.(?:js|css))?\b[^"'`\n]*)\1/g)) loaders.push([file, literal]);
  }
  assert.ok(loaders.length >= 5, 'se encuentran los cargadores de la portada, los shells y la ayuda');
  for (const [file, literal] of loaders) assert.ok(literal.startsWith(CANONICAL), `${file}: ${literal}`);
  // Los tres cargadores que dan el ⌘ Experto a admira.biz, sus páginas interiores y sus clones.
  assert.match(readFileSync(join(root, 'index.html'), 'utf8'), /engine\.src = 'https:\/\/www\.admiranext\.com\/suite\/experto\.js\?v=/);
  assert.match(readFileSync(join(root, 'galaxy-shell.js'), 'utf8'), /const EXPERTO = 'https:\/\/www\.admiranext\.com\/suite\/experto'/);
  assert.match(readFileSync(join(root, 'expert-panel.js'), 'utf8'), /s\.src="https:\/\/www\.admiranext\.com\/suite\/experto\.js\?v=/);
});

test('el worker manda /suite/ de admira.biz y clearchannel.tv al canónico y sirve local el contexto de Biz', async () => {
  const seen = [];
  const env = {ASSETS:{fetch(request) {
    seen.push(new URL(request.url).pathname);
    return new Response('asset', {headers:{'content-type':'application/javascript'}});
  }}};
  for (const host of ['admira.biz', 'www.admira.biz', 'clearchannel.tv', 'www.clearchannel.tv', 'preview.clearchannel-tv.pages.dev']) {
    for (const path of ['/suite/experto.js?v=20261012-android-1', '/suite/experto.css?v=20261005-experto-idioma-1',
      '/suite/demo-android.mjs?v=20261012-android-1', '/suite/demo-ios.mjs', '/suite/demo-control.js?v=20261012-unified-1']) {
      for (const method of ['GET', 'HEAD']) {
        const response = await worker.fetch(new Request('https://' + host + path, {method}), env);
        assert.equal(response.status, 302, method + ' ' + host + path);
        assert.equal(response.headers.get('location'), 'https://www.admiranext.com' + path, host + path);
        assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
      }
    }
  }
  assert.deepEqual(seen, [], 'ningún /suite/ del motor llega a los assets publicados');
  await worker.fetch(new Request('https://www.admira.biz/suite/biz-native-context.js?v=20261012-1'), env);
  await worker.fetch(new Request('https://www.clearchannel.tv/suite/biz-native-context.js?v=20261012-android-five-1'), env);
  assert.deepEqual(seen, ['/__admira_biz/suite/biz-native-context.js', '/__admira_cc_native/suite/biz-native-context.js']);
  // Fuera de admira.biz y clearchannel.tv, de GET/HEAD y de /suite/, nada cambia.
  assert.equal(suiteCanonicalURL(new URL('https://www.admira.app/suite/experto.js')), '');
  assert.equal(suiteCanonicalURL(new URL('https://admira.biz.evil.example/suite/experto.js')), '');
  assert.equal(suiteCanonicalURL(new URL('https://www.admira.biz/suite/experto.js'), 'POST'), '');
  assert.equal(suiteCanonicalURL(new URL('https://www.admira.biz/suitex/experto.js')), '');
  assert.equal(suiteCanonicalURL(new URL('https://www.admira.biz/app.js')), '');
  assert.equal(suiteCanonicalURL(new URL('https://www.admira.biz/suite/biz-native-context.js')), '');
  assert.equal((await worker.fetch(new Request('https://www.admira.biz/__admira_biz/suite/experto.js'), env)).status, 404);
});
