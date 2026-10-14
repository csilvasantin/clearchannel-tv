import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { CATALOGO, orden, tipoIncidencia } from '../incidencias-core.mjs';
import { resolverIncidencia } from '../bugito-core.mjs';

const screen = 'virtual-lab-bugito';
const ui = readFileSync(new URL('../bugito.mjs', import.meta.url), 'utf8');
const textos = ui.slice(ui.indexOf('const textos ='), ui.indexOf('const LANGUAGE_KEY'));
const menuCode = ui.slice(ui.indexOf('function pintarMenu()'), ui.indexOf('function acuseTexto('));
const enviarCode = ui.slice(ui.indexOf('async function lanzar('), ui.indexOf('function gesto()'));

test('retirada individual: las cuatro órdenes exactas y la misma salvaguarda de pantalla', () => {
  for (const t of CATALOGO) {
    assert.deepEqual(orden(t.id, screen, { vuelta: true, individual: true }),
      { ok: true, body: { id: screen, screen, cmd: `${t.orden} off` } });
    assert.equal(orden(t.id, screen, { vuelta: true }).body.cmd, 'fault-clear');
    for (const no of ['', 'macbookpro16', 'alsea_starbucks'])
      assert.deepEqual(orden(t.id, no, { vuelta: true, individual: true }), { ok: false, error: 'pantalla_no_lab' });
  }
  assert.deepEqual(orden('desconocido', screen, { vuelta: true, individual: true }), { ok: false, error: 'tipo_desconocido' });
});

function banco() {
  class Elemento {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.listeners = {}; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(k, v) { this.attrs[k] = v; }
    addEventListener(k, v) { this.listeners[k] = v; }
    click() { return this.listeners.click(); }
  }
  const menu = new Elemento('div'), titulo = new Elemento('p'), posts = [], guardados = [];
  const prueba = { tipo: '', retirando: false, envio: null, vuelta: null, marcas: new Set() };
  const incidencias = Object.fromEntries(CATALOGO.map((t, i) => [t.id, { id: `INC-BOTON${i}`, stage: 'abierta' }]));
  const detectores = Object.fromEntries(CATALOGO.map((t, i) => [t.id, { incidencia: `INC-BOTON${i}`, fase: 'fallo', ultima: null }]));
  const context = vm.createContext({
    CATALOGO, tipoIncidencia, orden, resolverIncidencia, prueba, incidencias, detectores,
    objetivo: { screen }, P: { screen, lab: true }, ocupado: false, pausado: '',
    ICONO: {}, params: new URLSearchParams(),
    $: id => id === 'bb-menu' ? menu : titulo,
    document: { createElement: tag => new Elemento(tag) },
    gesto() {}, reanudarPlayer() {}, pintar() {}, guardar: id => guardados.push(id), vuelta: () => Promise.resolve(),
    red: { mando: { enviar: async body => { posts.push({ ...body }); return { ok: true, id: 'order-1', action: 'receipt-1' }; } } }
  });
  vm.runInContext(`${textos}
    let lang='es';
    const tr=(k,...a)=>{const v=textos[lang][k];return typeof v==='function'?v(...a):v;};
    const nombre=id=>{const t=tipoIncidencia(id);return t?(t[lang]||t.es):tr('normal');};
    ${menuCode}
    ${enviarCode}
    pintarMenu();`, context);
  return { menu, posts, prueba, incidencias, detectores, guardados, context };
}

test('los cuatro botones reales envían retiradas individuales sin perder las incidencias ni otros detectores', async () => {
  const b = banco();
  const antes = JSON.stringify({ incidencias: b.incidencias, detectores: b.detectores });
  const filas = b.menu.children.slice(1);
  assert.equal(filas.length, 4);
  assert.deepEqual(filas.map(f => f.children[1].textContent), ['Quitar giro', 'Quitar resolución', 'Quitar popup', 'Quitar apertura parcial']);
  for (const [i, fila] of filas.entries()) {
    assert.equal(fila.children.length, 2, 'provocar y quitar están juntos');
    await fila.children[1].click();
    assert.equal(b.posts.length, i + 1, 'un único envío por clic');
    assert.deepEqual(b.posts[i], { id: screen, screen, cmd: `${CATALOGO[i].orden} off` });
    assert.equal(b.prueba.retirando, true);
    assert.equal(b.prueba.tipo, CATALOGO[i].id);
    assert.equal(b.prueba.envio.cmd, b.posts[i].cmd, 'el acuse sigue la orden de retirada');
    assert.equal(JSON.stringify({ incidencias: b.incidencias, detectores: b.detectores }), antes);
    assert.deepEqual(b.guardados, [], 'no se simula el cierre ni se borra el estado del vigilante');
  }
  assert.ok(b.posts.every(p => p.cmd !== 'fault-clear'), 'ningún botón quita los otros fallos');
});

test('traducción, destino escogido y botón global conservan sus contratos', async () => {
  const b = banco();
  vm.runInContext('lang="en";pintarMenu()', b.context);
  assert.deepEqual(b.menu.children.slice(1).map(f => f.children[1].textContent),
    ['Remove rotation', 'Remove resolution change', 'Remove popup', 'Remove partial opening']);
  b.context.objetivo.screen = 'virtual-lab-alsea-starbucks-escaparate';
  await b.menu.children[1].children[1].click();
  assert.equal(b.posts[0].screen, 'virtual-lab-alsea-starbucks-escaparate');
  b.context.objetivo.screen = 'macbookpro16';
  await b.menu.children[2].children[1].click();
  assert.equal(b.posts.length, 1, 'la UI rechaza una pantalla real antes de llamar al mando');
  b.context.objetivo.screen = screen;
  await vm.runInContext('lanzar("normal")', b.context);
  assert.equal(b.posts.at(-1).cmd, 'fault-clear', 'volver a la normalidad sigue retirando todo');
});
