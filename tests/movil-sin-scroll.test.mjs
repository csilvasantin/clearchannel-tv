// Móvil sin scroll lateral (26-oct-2026): a 390 px la ficha de un Xpacio medía 410 px y la ayuda 463 px.
// En la ficha, la columna de .lower y la de .surface no podían encoger por debajo de su contenido (1fr = minmax(auto,1fr))
// y la etiqueta de conexión no partía línea; en la ayuda, la lista de órdenes de Bugito era un <pre> sin scroll propio.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('la ficha deja encoger sus columnas y en móvil baja la etiqueta de conexión bajo el texto',()=>{
  const detail=read('detail.html');
  assert.match(detail,/\.surface\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;/);
  assert.match(detail,/\.surface p\{[^}]*overflow-wrap:anywhere\}/);
  assert.match(detail,/@media \(max-width:980px\)\{[^\n]*\.hero,\.lower\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(detail,/@media \(max-width:560px\)\{[^\n]*\.surface\{grid-template-columns:minmax\(0,1fr\)\}\.pill\{justify-self:start;white-space:normal\}\}/);
  assert.doesNotMatch(detail,/\.(hero|lower|surface)\{[^}]*grid-template-columns:1fr[;}]/,'ninguna columna única de 1fr a secas en la ficha');
});

test('en la ayuda ningún bloque de código ensancha la página y las órdenes de Bugito se leen enteras',()=>{
  const help=read('help/index.html');
  assert.match(help,/\n  pre\{max-width:100%;overflow-x:auto\}/);
  assert.match(help,/#bugito pre\{white-space:pre-wrap;overflow-wrap:anywhere\}/);
  assert.match(help,/\.loop pre\{[^}]*white-space:pre;/,'el diagrama del bucle conserva su dibujo y desplaza dentro de su caja');
  assert.match(help,/<section id="bugito">[\s\S]*?<pre>\/bugito error starbucks/);
});

// 29-oct-2026: /mcp/ medía 806 px a 390 px (tabla de la Galaxia de 784 px) y a 320 px no cabía la tabla de herramientas.
// La sirve el Worker de tools/biz-player-mcp con esta copia; la fuente es yokup-site/mcp/index.html del repo tool.
test('en /mcp/ la Galaxia desplaza dentro de su caja y los nombres de herramienta parten línea',()=>{
  const hub=read('tools/biz-player-mcp/assets/hub.html');
  assert.match(hub,/\n\.galaxia\{overflow-x:auto\}\.galaxia table\{font-size:12\.5px\}/);
  assert.match(hub,/\ntd code\{font-size:12px;overflow-wrap:anywhere\}\n/);
});
