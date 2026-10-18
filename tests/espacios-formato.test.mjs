// Los 18 espacios Altadis (DCL-d7966deb02734a6f34beb54e): lo puro de espacios-formato.mjs, los 37 ficheros compartidos,
// su sitio en el release de admira.biz y la opción «Espacio por formato · Altadis 18» del Arquitecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  FORMATOS_ALTADIS, FUENTE, PERFIL, SELLO, INDICE_SCHEMA, ZONAS, FISICO, TIPOS_ESPACIO, REJILLA_RE, gridDe, celdas, zonaDe, formatoDe,
  pantallasDeFormato, espacioDeFormato, resumenEspacio, indiceAltadis, ficherosAltadis, idEspacio, urlGemelo, urlStudio, urlArquitecto,
  parametrosEspacio, leerEspacio, aspectoDe, tipoEspacio, avisosEspacio, SINCRO
} from '../espacios-formato.mjs';
import { FORMAT_REFERENCE_MAP } from './fixtures/format-reference-map.mjs';
import { SCHEMA, validate, screenGeometry, footprint, panelSize, wallLength, furnitureAgainstWall } from '../plano-core.mjs';
import { leerPlanoJson } from '../plano-subida.mjs';
import { parseOrden, parametros } from '../arquitecto-core.mjs';
import { svgPlanta, svgAlzado, svgMiniatura } from '../arquitecto-dibujo.mjs';
import { BIZ_ASSET_FILES, bizAssetPath } from '../server/biz-assets.mjs';
import worker from '../_worker.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const TIPOS = Object.keys(TIPOS_ESPACIO);
const TODOS = TIPOS.flatMap(tipo => FORMATOS_ALTADIS.map(f => espacioDeFormato(f.id, tipo)));
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;

// Copia literal de la regla genérica de twinGeometry (admira-studio adaptaciones/gemelo-core.mjs, main 184f079): la
// rejilla de los espacios tiene que ser la misma que la del gemelo de admira.studio.
function twinGeometryStudio(f, size) {
  const { ancho, alto } = size;
  const match = String(f.nombre || '').match(/(?:VIDEOWALL|SINCRO VW)\s+(\d+)X(\d+)/i);
  const cols = match ? Number(match[1]) : 1, rows = match ? Number(match[2]) : 1;
  const segments = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) segments.push({ n: segments.length + 1, N: cols * rows, wall: { x: c * ancho / cols, y: r * alto / rows, w: ancho / cols, h: alto / rows } });
  return { pared: { ancho, alto }, segments, source: match ? 'named_demo_grid' : 'single_surface' };
}

test('los 18 formatos son los del perfil de admira.studio (cliente-01…18, sin MyBlu) con su procedencia', () => {
  const texto = read('tests/fixtures/perfil-cliente-18.json');
  assert.equal(createHash('sha256').update(texto).digest('hex'), PERFIL.sha256, 'la copia del perfil es la del commit citado');
  const perfil = JSON.parse(texto);
  assert.equal(perfil.source.sha256, FUENTE.sha256, 'sha256 del PDF de Altadis');
  assert.equal(perfil.source.page, 3);
  assert.match(perfil.source.requirements, /MP4 \/ H264 \/ 25fps/);
  assert.equal(FORMATOS_ALTADIS.length, 18);
  const altadis = perfil.formats.filter(f => !f.myblu);
  assert.equal(altadis.length, 18);
  assert.deepEqual(perfil.formats.filter(f => f.myblu).map(f => f.id), ['cliente-19', 'cliente-20', 'cliente-21', 'cliente-22', 'cliente-23', 'cliente-24']);
  FORMATOS_ALTADIS.forEach((f, i) => {
    const p = altadis[i];
    assert.deepEqual({ id: f.id, nombre: f.nombre, custom: [f.ancho, f.alto], uso: f.uso.es, useEn: f.uso.en, fps: f.fps }, { id: p.id, nombre: p.nombre, custom: p.custom, uso: p.uso, useEn: p.useEn, fps: p.fps }, p.id);
    assert.equal(f.n, i + 1);
    assert.equal(formatoDe(f.id), f);
  });
  assert.equal(formatoDe('cliente-19'), null, 'MyBlu queda fuera');
  assert.throws(() => espacioDeFormato('cliente-22', 'xtanco'), /desconocido/);
});

test('rejilla: la regla de twinGeometry de Studio, en 3 casos y en los 18', () => {
  // Tres casos a mano: un videowall con rejilla, un SINCRO VW sin rejilla (1×1) y una columna vertical.
  assert.deepEqual(gridDe(formatoDe('cliente-06')), { cols: 4, rows: 1 });
  assert.deepEqual(celdas('cliente-06').map(c => [c.x, c.y, c.w, c.h]), [[0, 0, 960, 540], [960, 0, 960, 540], [1920, 0, 960, 540], [2880, 0, 960, 540]]);
  assert.deepEqual(gridDe(formatoDe('cliente-05')), { cols: 1, rows: 1 }, '«SINCRO VW» sin CxR es una sola superficie');
  assert.deepEqual(celdas('cliente-05').map(c => [c.x, c.y, c.w, c.h]), [[0, 0, 1920, 540]]);
  assert.deepEqual(gridDe(formatoDe('cliente-12')), { cols: 1, rows: 2 });
  assert.deepEqual(celdas('cliente-12').map(c => [c.x, c.y, c.w, c.h]), [[0, 0, 540, 960], [0, 960, 540, 960]]);
  for (const id of ['cliente-06', 'cliente-05', 'cliente-12']) {
    const f = formatoDe(id), g = twinGeometryStudio(f, { ancho: f.ancho, alto: f.alto });
    assert.deepEqual(celdas(f).map(c => ({ n: c.n, ...{ x: c.x, y: c.y, w: c.w, h: c.h } })), g.segments.map(s => ({ n: s.n, ...s.wall })), id);
  }
  // Y los 18: mismas celdas (son enteras en todos) y misma fuente de la rejilla.
  for (const f of FORMATOS_ALTADIS) {
    const g = twinGeometryStudio(f, { ancho: f.ancho, alto: f.alto });
    assert.deepEqual(celdas(f).map(c => ({ n: c.n, x: c.x, y: c.y, w: c.w, h: c.h })), g.segments.map(s => ({ n: s.n, ...s.wall })), f.id);
    assert.equal(REJILLA_RE.test(f.nombre), g.source === 'named_demo_grid', f.id);
  }
  assert.deepEqual(FORMATOS_ALTADIS.map(f => gridDe(f).cols * gridDe(f).rows), [1, 1, 2, 1, 1, 4, 1, 1, 1, 1, 2, 2, 2, 3, 4, 4, 8, 1]);
  assert.throws(() => gridDe({ nombre: 'VIDEOWALL 9X9 H' }), /rejilla/);
});

test('zonas: las de FORMAT_REFERENCE_MAP de Studio (copia literal en tests/fixtures/format-reference-map.mjs)', () => {
  const fixture = read('tests/fixtures/format-reference-map.mjs');
  assert.match(fixture, /commit 0e93f881034fc80cf9b844131455476066f086f2/, 'la copia cita su commit de admira-studio');
  for (const f of FORMATOS_ALTADIS) assert.equal(zonaDe(f), FORMAT_REFERENCE_MAP[f.id], f.id);
  for (const [zona, z] of Object.entries(ZONAS)) assert.deepEqual([...z.formatos], FORMATOS_ALTADIS.map(f => f.id).filter(id => FORMAT_REFERENCE_MAP[id] === zona), zona);
  const esperado = { mostrador: ['01', '02', '04', '07'], mural: ['03', '05', '06', '14', '15', '16', '17'], columna: ['10', '11', '12', '13'], superstretch: ['09', '18'], cubo: ['08'] };
  for (const [zona, ns] of Object.entries(esperado)) {
    assert.deepEqual([...ZONAS[zona].formatos], ns.map(n => `cliente-${n}`), zona);
    for (const n of ns) assert.equal(zonaDe(`cliente-${n}`), zona);
  }
  assert.equal(Object.values(ZONAS).reduce((s, z) => s + z.formatos.length, 0), 18);
});

test('recortes: cubren el lienzo exacto, sin huecos ni solapes, y cada pantalla lleva el suyo', () => {
  for (const f of FORMATOS_ALTADIS) {
    const cs = celdas(f);
    assert.equal(cs.reduce((s, c) => s + c.w * c.h, 0), f.ancho * f.alto, f.id + ': área');
    for (const c of cs) {
      assert.ok([c.x, c.y, c.w, c.h].every(Number.isInteger) && c.x >= 0 && c.y >= 0 && c.x + c.w <= f.ancho && c.y + c.h <= f.alto, f.id);
    }
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) assert.ok(!overlap(cs[i], cs[j]), `${f.id}: ${i} y ${j}`);
  }
  for (const plan of TODOS) {
    const f = formatoDe(plan.formato.id);
    const s0 = plan.pantallas[0];
    if (s0.forma) {
      // El cubo: sus 4 caras cubren el lienzo y la pantalla del plano es la cara que da a la sala.
      const caras = s0.cubo.caras.map(c => c.recorte);
      assert.equal(caras.reduce((a, c) => a + c.w * c.h, 0), f.ancho * f.alto, plan.id);
      for (let i = 0; i < caras.length; i++) for (let j = i + 1; j < caras.length; j++) assert.ok(!overlap(caras[i], caras[j]), plan.id);
      const w = plan.paredes.find(x => x.id === s0.pared), n = [-(w.b[1] - w.a[1]) / wallLength(w), (w.b[0] - w.a[0]) / wallLength(w)];
      assert.deepEqual(s0.recorte, s0.cubo.caras.find(c => c.n[0] === n[0] && c.n[1] === n[1]).recorte, `${plan.id}: la cara que mira a la sala`);
    } else assert.deepEqual(plan.pantallas.map(s => s.recorte), celdas(f).map(({ x, y, w, h }) => ({ x, y, w, h })), plan.id);
    for (const s of plan.pantallas) {
      assert.deepEqual(s.lienzo, [f.ancho, f.alto]);
      assert.deepEqual(s.resolucion, [s.recorte.w, s.recorte.h], 'resolucion = [recorte.w, recorte.h]');
      // La orientación cuadra con el recorte: plano-core lo pinta con su lienzo (screenGeometry) sin girarlo.
      assert.deepEqual(screenGeometry(s).lienzo, s.resolucion, `${s.id}: orientación`);
      const g = panelSize(s), r = s.recorte.w / s.recorte.h;
      assert.ok(Math.abs(g.w / g.h - r) / r < 0.01, `${plan.id} ${s.id}: proporción física ${g.w / g.h} frente a la del recorte ${r}`);
    }
  }
});

test('los 36 planos: validate() sin un solo aviso, leerPlanoJson los acepta y llevan formato, espacio y fuente', () => {
  assert.equal(TODOS.length, 36);
  for (const plan of TODOS) {
    const f = formatoDe(plan.formato.id), N = gridDe(f).cols * gridDe(f).rows;
    assert.equal(plan.schema, SCHEMA);
    assert.deepEqual(validate(plan), [], plan.id);
    const leido = leerPlanoJson(JSON.stringify(plan), plan.id);
    assert.equal(leido.ok, true, `${plan.id}: ${JSON.stringify(leido.errores)}`);
    assert.deepEqual(leido.avisos, [], plan.id);
    assert.equal(plan.id, idEspacio(f, plan.espacio.tipo));
    assert.match(plan.id, /^altadis-(xtanco|cafe)-(0[1-9]|1[0-8])$/);
    assert.deepEqual(plan.espacio, { serie: 'altadis-18', tipo: plan.espacio.tipo, n: f.n });
    assert.deepEqual(plan.formato, { id: f.id, nombre: f.nombre, ancho: f.ancho, alto: f.alto, grid: gridDe(f), fps: 25, uso: { es: f.uso.es, en: f.uso.en }, zona: zonaDe(f) });
    assert.equal(plan.nombre, `${plan.espacio.tipo === 'xtanco' ? 'Xtanco' : 'Starbucks'} · ${f.nombre} (${f.ancho}×${f.alto})`);
    assert.match(plan.fuente.titulo, /plano tipo inventado, no es un levantamiento/);
    assert.equal(plan.version, SELLO);
    assert.equal(plan.publico, true, 'plano tipo sin datos de un local real: el gemelo no lo recorta');
    assert.equal(plan.generador.tipo, TIPOS_ESPACIO[plan.espacio.tipo].tipoArquitecto);
    assert.equal(plan.pantallas.length, N, plan.id);
    for (const s of plan.pantallas) {
      assert.equal(s.formato, f.id); assert.equal(s.itil, null); assert.equal(s.estado, 'propuesta');
      assert.equal(s.tecnologia, FISICO[f.id].tecnologia);
      if (N > 1) assert.equal(s.grupo, `formato-${String(f.n).padStart(2, '0')}`); else assert.equal(s.grupo, undefined);
      assert.equal(typeof s.separacion, 'number', 'el gemelo no la toma por un monitor sobre una mesa');
    }
  }
});

test('cada zona va donde toca y con tamaños físicos plausibles', () => {
  for (const plan of TODOS) {
    const f = formatoDe(plan.formato.id), zona = zonaDe(f), fs = plan.pantallas.map(footprint), s0 = plan.pantallas[0];
    const z0 = Math.min(...fs.map(x => x.z0)), z1 = Math.max(...fs.map(x => x.z1));
    const label = plan.id;
    assert.ok(plan.pantallas.every(s => s.pared === s0.pared), label + ': un solo conjunto, en una pared');
    if (zona === 'mural') { assert.equal(s0.pared, 'F', label); assert.ok(z0 >= 1.1 - 1e-6 && z0 <= 1.3 + 1e-6, `${label}: base ${z0}`); }
    if (zona === 'superstretch') { assert.equal(s0.pared, 'F', label); assert.ok(z0 >= 2.2 - 1e-6 && z1 <= 2.9 + 1e-6, `${label}: banda ${z0}–${z1}`); }
    if (zona === 'columna') {
      const lineal = plan.mobiliario.find(m => /^Lineal/.test(m.nombre));
      assert.ok(lineal, label + ': hay lineal');
      const w = plan.paredes.find(x => x.id === s0.pared), p = furnitureAgainstWall(lineal, w);
      assert.ok(p.dist <= 0.05, label + ': la columna está en la pared del lineal');
      const hueco = Math.max(p.s0 - Math.max(...fs.map(x => x.x1)), Math.min(...fs.map(x => x.x0)) - p.s1);
      assert.ok(hueco >= -1e-6 && hueco <= 0.12, `${label}: junto al lineal, sin pisarlo (${hueco} m)`);
      assert.equal(z0, 0.9, label);
    }
    if (zona === 'mostrador') {
      if (f.id === 'cliente-01') { assert.equal(s0.escaparate, true); assert.equal(s0.pared, 'P'); }
      else if (f.id === 'cliente-07') assert.ok(z0 >= 1.0 && z0 <= 1.2, `${label}: tablet a la altura del mostrador`);
      else { assert.equal(s0.pared, 'F'); assert.ok(z0 >= 1.3 - 1e-6 && z1 <= plan.planta.alto - 0.05, label); }
    }
    if (zona === 'cubo') {
      assert.equal(s0.forma, 'cubo-4-caras'); assert.equal(s0.cubo.caras.length, 4);
      assert.deepEqual(s0.cubo.caras.map(c => c.recorte.x), [0, 400, 800, 1200]);
      const peana = plan.mobiliario.find(m => m.id === 'm-peana');
      assert.ok(peana, label + ': peana');
      // En el plano, UNA cara (0,75 × 1,125 m, 400×600 px), donde está la cara que da a la sala: no un LED plano de 3 m.
      assert.deepEqual(s0.dimensiones, { ancho: 0.75, alto: 1.125 }); assert.deepEqual(s0.resolucion, [400, 600]);
      assert.equal(s0.orientacion, 'vertical'); assert.equal(s0.pulgadas, 53.2);
      assert.deepEqual(screenGeometry(s0).lienzo, [400, 600]);
      assert.equal(s0.separacion, Math.round((furnitureAgainstWall(peana, plan.paredes.find(x => x.id === s0.pared)).dist + s0.cubo.lado) * 1000) / 1000);
      assert.equal(s0.z, s0.cubo.peana);
      assert.match(plan.fuente.pantallas, /^1 × cubo LED de 4 caras de 400×600 px \(0,75 × 1,125 m cada una, paso 1,875 mm\) sobre peana de 0,9 m/);
      assert.doesNotMatch(plan.fuente.avisos.join(' '), /`|campo|desplegad/, 'aviso sin jerga');
    }
    for (const s of plan.pantallas) {
      if (s.tecnologia === 'lcd') { assert.ok(s.pulgadas >= 9.7 && s.pulgadas <= 88, `${label}: ${s.pulgadas}″`); assert.equal(s.dimensiones, undefined); }
      else { assert.equal(s.dimensiones.ancho, Math.round(s.recorte.w * s.pasoPixelMm) / 1000); assert.equal(s.dimensiones.alto, Math.round(s.recorte.h * s.pasoPixelMm) / 1000); }
    }
  }
  // Los ejemplos del encargo: góndola de 64×384 a 2,5 mm, Granada 1536×192, cubo de 4 caras, tablet 9,7″, stretch de ~2,2 m.
  const p = id => pantallasDeFormato(id);
  assert.deepEqual(p('cliente-10')[0].dimensiones, { ancho: 0.16, alto: 0.96 });
  assert.deepEqual(p('cliente-09')[0].dimensiones, { ancho: 3.84, alto: 0.48 });
  assert.equal(p('cliente-07')[0].pulgadas, 9.7); assert.deepEqual(p('cliente-07')[0].aspecto, [4, 3]); assert.equal(p('cliente-07')[0].orientacion, 'vertical');
  assert.ok(Math.abs(panelSize(p('cliente-18')[0]).w - 2.2) < 0.05, 'stretch de unos 2,2 m');
  assert.deepEqual(aspectoDe(1920, 540), [32, 9]); assert.equal(aspectoDe(960, 540), null); assert.equal(aspectoDe(480, 852), null);
  const vw = TODOS.find(x => x.id === 'altadis-xtanco-15');
  assert.ok(vw.pantallas.every(s => s.pulgadas === 49 && s.orientacion === 'horizontal'));
  // Sin redondeos intermedios: el conjunto son las pantallas pegadas, exactas (la página redondea una vez).
  const r = resumenEspacio(vw);
  assert.equal(r.conjunto.w, 4 * r.panel.w); assert.equal(r.conjunto.h, r.panel.h);
  assert.equal(r.conjunto.h, panelSize({ pulgadas: 49 }).h);
  // La columna 1X2 V: 46″ donde cabe (Starbucks, 3 m) y 43″ donde no (Xtanco, 2,9 m), y el aviso sólo donde va de 43″.
  const c12 = tipo => TODOS.find(x => x.id === `altadis-${tipo}-12`);
  assert.ok(c12('cafe').pantallas.every(s => s.pulgadas === 46)); assert.deepEqual(avisosEspacio(c12('cafe')), []); assert.equal(c12('cafe').fuente.avisos, undefined);
  assert.ok(c12('xtanco').pantallas.every(s => s.pulgadas === 43));
  assert.match(c12('xtanco').fuente.avisos[0], /43″: con 46″ la columna no cabe bajo el techo de 2,9 m/);
  assert.match(c12('xtanco').fuente.pantallas, /LCD de 43″ vertical/); assert.match(c12('cafe').fuente.pantallas, /LCD de 46″ vertical/);
  // Sincronía: SINCRO LOGO con los dos SINCRO VW (cliente-05 y cliente-06), con la misma duración.
  assert.deepEqual([...SINCRO['cliente-04']], ['cliente-05', 'cliente-06']); assert.deepEqual([...SINCRO['cliente-06']], ['cliente-04']);
  for (const id of ['cliente-04', 'cliente-05', 'cliente-06']) for (const plan of TODOS.filter(x => x.formato.id === id)) assert.match(plan.fuente.sincro, /misma duración/, plan.id);
  assert.match(TODOS.find(x => x.id === 'altadis-cafe-06').fuente.sincro, /cliente-04 \(SINCRO LOGO\)/);
});

test('regenerar da ficheros idénticos a los publicados, y el índice cumple el contrato admira.espacios-formato/1', () => {
  const a = ficherosAltadis(), b = ficherosAltadis();
  assert.equal(a.length, 37);
  assert.deepEqual(a, b, 'determinista');
  for (const { ruta, texto } of a) assert.equal(read(ruta), texto, `${ruta}: regenera con node tools/genera-espacios-altadis.mjs`);
  const indice = JSON.parse(read('data/xpacios/altadis-18.json'));
  assert.deepEqual(indice, indiceAltadis());
  assert.deepEqual(Object.keys(indice), ['schema', 'version', 'cliente', 'fuente', 'tipos', 'formatos']);
  assert.equal(indice.schema, INDICE_SCHEMA); assert.equal(indice.cliente, 'Altadis');
  assert.match(indice.version, /^v\.\d{2}\.\d{2}\.\d{4}\.r\d+\.\d{2}:\d{2}$/, 'normativa 07');
  assert.deepEqual(indice.fuente, { perfil: 'admira.studio/adaptaciones/perfil-cliente-18.json', sha256: FUENTE.sha256, pdf: 'ALTADIS Resoluciones y formatos, p. 3' });
  assert.deepEqual(indice.tipos, { xtanco: { es: 'Xtanco', en: 'Xtanco', tipoArquitecto: 'estanco' }, cafe: { es: 'Cafetería Starbucks', en: 'Starbucks café', tipoArquitecto: 'cafeteria' } });
  assert.deepEqual(indice.formatos[0], { formato: 'cliente-01', n: 1, nombre: 'VERTICAL', ancho: 1080, alto: 1920, grid: { cols: 1, rows: 1 }, pantallas: 1, uso: { es: 'tótem / escaparate', en: 'totem / shop window' }, zona: 'mostrador', espacios: { xtanco: 'altadis-xtanco-01', cafe: 'altadis-cafe-01' } });
  for (const f of indice.formatos) {
    assert.deepEqual(Object.keys(f), ['formato', 'n', 'nombre', 'ancho', 'alto', 'grid', 'pantallas', 'uso', 'zona', 'espacios']);
    for (const id of Object.values(f.espacios)) assert.equal(JSON.parse(read(`data/xpacios/${id}.json`)).formato.id, f.formato);
  }
});

test('se publican en admira.biz con CORS de lectura (y no en clearchannel.tv)', async () => {
  for (const f of ['espacios-formato.mjs', 'data/xpacios/altadis-18.json', 'data/xpacios/altadis-xtanco-01.json', 'data/xpacios/altadis-cafe-18.json']) assert.ok(BIZ_ASSET_FILES.includes(f), f);
  // Los 36 planos y su índice; altadis-espana-10.json es el índice del circuito Altadis España (otra cosa).
  assert.equal(BIZ_ASSET_FILES.filter(f => /^data\/xpacios\/altadis-(?:18|xtanco-|cafe-)/.test(f)).length, 37);
  assert.equal(bizAssetPath(new URL('https://www.admira.biz/data/xpacios/altadis-cafe-08.json')), '/__admira_biz/data/xpacios/altadis-cafe-08.json');
  assert.equal(bizAssetPath(new URL('https://www.clearchannel.tv/data/xpacios/altadis-cafe-08.json')), '');
  const env = { ASSETS: { fetch(request) {
    const path = new URL(request.url).pathname;
    return path.startsWith('/__admira_biz/data/xpacios/altadis-') ? new Response('{"schema":"x"}', { headers: { 'content-type': 'application/json' } }) : new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
  } } };
  const r = await worker.fetch(new Request('https://www.admira.biz/data/xpacios/altadis-18.json', { headers: { Origin: 'https://www.admira.store' } }), env);
  assert.equal(r.status, 200); assert.equal(r.headers.get('access-control-allow-origin'), '*');
  const cc = await worker.fetch(new Request('https://www.clearchannel.tv/data/xpacios/altadis-18.json'), env);
  assert.equal(cc.status, 404, 'clearchannel.tv conserva su revisión: allí no hay espacios Altadis');
});

test('enlaces, parámetros y /arquitecto formatos', () => {
  assert.equal(urlGemelo('altadis-xtanco-03'), 'https://www.admira.store/xpacios/altadis-18/?espacio=altadis-xtanco-03');
  assert.equal(urlStudio('cliente-03'), 'https://admira.studio/adaptaciones/?formato=cliente-03');
  assert.equal(urlArquitecto('cliente-15', 'cafe'), 'arquitecto.html?formato=cliente-15&tipo=cafe');
  assert.deepEqual(parametrosEspacio('?formato=cliente-15&tipo=cafe'), { formato: 'cliente-15', tipo: 'cafe' });
  assert.deepEqual(parametrosEspacio('?formato=cliente-08'), { formato: 'cliente-08', tipo: 'xtanco' });
  assert.deepEqual(parametrosEspacio('?formato=cliente-03&tipo=starbucks'), { formato: 'cliente-03', tipo: 'cafe' });
  assert.deepEqual(parametrosEspacio('?espacio=altadis-cafe-12'), { formato: 'cliente-12', tipo: 'cafe' });
  assert.deepEqual(parametrosEspacio('?arg=formatos-cliente-08-cafe'), { formato: 'cliente-08', tipo: 'cafe' });
  assert.deepEqual(parametrosEspacio('?arg=formatos'), { formato: 'cliente-01', tipo: 'xtanco' });
  assert.deepEqual(parametrosEspacio('?arg=formatos-99-cafe'), { formato: 'cliente-01', tipo: 'cafe', desconocido: true }, 'un formato que no existe se dice');
  assert.deepEqual(leerEspacio('pantalla gigante'), { formato: '', tipo: '', desconocido: true });
  assert.deepEqual(leerEspacio('cubos de basura'), { formato: '', tipo: '', desconocido: true }, '\\b(cubo|cube)\\b');
  // Claves del prototipo: nunca son un tipo de espacio; con un tipo no válido, el Xtanco.
  for (const raro of ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', undefined, null]) {
    assert.equal(tipoEspacio(raro), 'xtanco', String(raro));
    assert.equal(espacioDeFormato('cliente-03', raro).id, 'altadis-xtanco-03', String(raro));
    assert.equal(urlArquitecto('cliente-03', raro), 'arquitecto.html?formato=cliente-03&tipo=xtanco', String(raro));
  }
  for (const raro of ['constructor', '__proto__', 'toString']) assert.deepEqual(parametrosEspacio(`?formato=cliente-03&tipo=${raro}`), { formato: 'cliente-03', tipo: 'xtanco' }, raro);
  for (const q of ['', '?formato=cliente-19', '?formato=../x', '?arg=crear-cafeteria', '?espacio=altadis-bar-01', '?tipo=cafe']) assert.equal(parametrosEspacio(q), null, q);
  assert.deepEqual(leerEspacio('15 starbucks'), { formato: 'cliente-15', tipo: 'cafe' });
  assert.deepEqual(leerEspacio('el sincro vw 4x1 h en un estanco'), { formato: 'cliente-06', tipo: 'xtanco' });
  assert.deepEqual(leerEspacio('cubo'), { formato: 'cliente-08', tipo: '' });
  assert.deepEqual(parseOrden('/arquitecto formatos 15 starbucks'), { orden: 'crear', tipo: '', resto: '15 starbucks', formatos: true });
  assert.deepEqual(parseOrden('formatos 15'), { orden: 'crear', tipo: '', resto: '15', formatos: true });
  // «formato» / «format» sueltos por voz: sólo desde Crear (la página mira `contextual`); con /arquitecto, siempre.
  assert.equal(parseOrden('formato vertical de la pantalla 3').contextual, true);
  assert.equal(parseOrden('format 12').contextual, true);
  assert.equal(parseOrden('/arquitecto formato 12').contextual, undefined);
  assert.equal(parseOrden('arquitecto format 12').contextual, undefined);
  assert.deepEqual(parametros('?arg=formatos-15-cafe'), { orden: 'crear', tipo: '', locationId: '' }, 'no lanza una creación por tipo');
});

test('dibujo: el cubo en su sitio de la sala y su cara a la sala en el alzado; miniaturas de la galería', () => {
  const cubo = TODOS.find(p => p.id === 'altadis-cafe-08'), s = cubo.pantallas[0];
  const planta = svgPlanta(cubo, cubo.pantallas, { wallId: s.pared, nuevos: new Set([s.id]) });
  assert.match(planta.cuerpo, /class="scr scr-cubo new"/);
  const alzado = svgAlzado(cubo, cubo.pantallas, s.pared, { nuevos: new Set([s.id]) });
  assert.equal((alzado.cuerpo.match(/class="scr-body"/g) || []).length, 1, 'una cara, no un LED desplegado');
  assert.match(alzado.cuerpo, new RegExp(`width="${Math.round(s.dimensiones.ancho * 100 * 10) / 10}"`));
  const mini = svgMiniatura({ ancho: 3840, alto: 540, celdas: celdas('cliente-15') });
  assert.equal((mini.match(/class="mini-celda"/g) || []).length, 3);
  assert.match(svgMiniatura({ ancho: 1920, alto: 2160, celdas: celdas('cliente-11') }), /<line class="mini-celda" x1="[\d.]+" y1="17"/);
});

test('la página: «Espacio por formato · Altadis 18» en crear, con galería, ficha y enlaces', () => {
  const html = read('arquitecto.html'), js = read('arquitecto.mjs');
  for (const id of ['cr-modo', 'cr-por-tipo', 'cr-por-formato', 'cr-formato', 'cr-espacio', 'cr-ficha', 'cr-gemelo', 'cr-studio', 'cr-plano', 'cr-directo', 'cr-galeria', 'cr-usar'])
    assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /Espacio por formato · Altadis 18/);
  assert.match(html, /\/arquitecto formatos/);
  assert.match(html, /arquitecto\.mjs\?v=20261018-detallar-1/);
  assert.match(js, /from '\.\/espacios-formato\.mjs\?v=20261015-altadis-1'/);
  assert.match(read('espacios-formato.mjs'), /from '\.\/plano-core\.mjs\?v=20261014-plano-1'/, 'el mismo plano-core que el resto del estudio');
  assert.match(read('espacios-formato.mjs'), /from '\.\/plano-generador\.mjs\?v=20261014-foto-1'/);
  assert.match(js, /parametrosEspacio\(location\.search\)/);
  assert.match(js, /if \(p\.formatos\) return abrirFormatos\(p\.resto\);/, '/arquitecto formatos desde el ⌘ Experto');
  assert.match(js, /if \(parsed\.formatos && parsed\.contextual && st\.orden !== 'crear'\) parsed = \{ orden: '', tipo: '', resto: texto \};/, 'por voz, «formato» no saca de Reformar');
  assert.match(js, /catch \{ status\(tr\('espacioFallo'/, 'si falla el espacio, un mensaje del formato y no el de las medidas');
  assert.match(js, /los18Hint: 'una celda por pantalla física'/);
  assert.match(html, /data-t="los18Hint">una celda por pantalla física</, 'el texto fijo es el mismo que el traducido');
  assert.doesNotMatch(js + read('espacios-formato.mjs'), /TIPOS_ESPACIO\[(q\.get|u\.searchParams|tipoPedido)|!TIPOS_ESPACIO\[|TIPOS_ESPACIO\[[^\]]+\] \?/, 'sin buscar tipos por claves sin validar');
});
