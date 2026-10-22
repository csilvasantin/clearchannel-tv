// Estudio del Arquitecto (/arquitecto · DCL-66d9ae0d5e756d0067127f24): lo puro de arquitecto-core.mjs y
// arquitecto-dibujo.mjs, la página y su sitio en el release de admira.biz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ORDENES, ITIL_RE, parseOrden, parametros, tipoDe, paredDe, medidasDe, leerDescripcion, interpretarReforma, aplicarReforma, reformaDesdeEstimacion,
  planDesdeEstimacion, planDesdeDescripcion, prefijoDe, construirCis, revisarCis, ordenAlta, planConItil, inventarioTraspaso, codificarTraspaso,
  urlPortal, caraUrl, baseLocal, ordenDeNube, MAX_TRASPASO_JSON, MAX_ORDENES, MAX_PANTALLAS_NUEVAS, TRASPASO_SCHEMA, PORTAL_IMPORTAR, ESTIMAR_URL
} from '../arquitecto-core.mjs';
import { svgPlanta, svgAlzado } from '../arquitecto-dibujo.mjs';
import { generarXpacio } from '../plano-generador.mjs';
import { leerPlanoJson } from '../plano-subida.mjs';
import { validate, workOrder, exportOrder, restoreProposal, SCHEMA } from '../plano-core.mjs';
import { BIZ_ASSET_FILES, bizAssetPath } from '../server/biz-assets.mjs';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const errores = (plan, lista = plan.pantallas) => validate(plan, lista).filter(i => i.nivel === 'error');
// La sala del laboratorio con los errores típicos (la respuesta ?simula=1 de POST /xpacio/estimar, ya validada).
const ESTIMACION = {
  ancho: 3.4, largo: 3.6, alto: 3, confianza: { ancho: 0.6, largo: 0.5, alto: 0.55, global: 0.5 }, referencias: [],
  huecos: [{ tipo: 'puerta', nombre: 'Puerta doble', pared: 'P', desde: 1.5, ancho: 1.3, base: 0, alto: 2.3, confianza: 0.6 },
    { tipo: 'ventana', nombre: 'Ventana con cortina', pared: 'F', desde: 0.05, ancho: 0.8, base: 0, alto: 2.2, confianza: 0.4 }],
  mobiliario: [{ nombre: 'Mesa · puesto', x: 0.9, y: 0, w: 1.7, d: 0.7, alto: 0.75, confianza: 0.6 }],
  pantallas: [{ nombre: 'V izquierda', pared: 'F', s: 1.3, z: 0.85, orientacion: 'vertical', pulgadas: 27, confianza: 0.6 },
    { nombre: 'H centro', pared: 'F', s: 1.78, z: 0.9, orientacion: 'horizontal', pulgadas: 27, confianza: 0.6 },
    { nombre: 'H mesa larga', pared: 'I', s: 1.7, z: 0.95, orientacion: 'horizontal', pulgadas: 27, confianza: 0.4 }],
  notas: '', descartes: []
};

test('/arquitecto: tres órdenes (y sus alias en inglés), el tipo al crear y nada más', () => {
  assert.deepEqual(ORDENES, ['crear', 'reformar', 'inventariar', 'detallar', 'modelar', 'video', 'fotos']);
  assert.deepEqual(parseOrden(''), { orden: '', tipo: '', resto: '' });
  assert.deepEqual(parseOrden('/arquitecto'), { orden: '', tipo: '', resto: '' });
  assert.equal(parseOrden('/arquitecto crear cafetería').orden, 'crear');
  assert.equal(parseOrden('/arquitecto crear cafetería').tipo, 'cafeteria');
  assert.equal(parseOrden(['crear', 'estanco']).tipo, 'estanco');
  assert.equal(parseOrden('/architect create coffee shop').tipo, 'cafeteria');
  for (const [t, o] of [['reformar', 'reformar'], ['reforma', 'reformar'], ['renovate', 'reformar'], ['inventariar', 'inventariar'], ['inventory', 'inventariar'], ['survey', 'inventariar'], ['nuevo', 'crear'], ['detallar', 'detallar'], ['detail', 'detallar'], ['texturas', 'detallar'], ['taller', 'detallar'], ['modelar', 'modelar'], ['cad', 'modelar'], ['dxf', 'modelar'], ['3d', 'modelar'], ['gemelo', 'modelar'], ['model', 'modelar'], ['video', 'video'], ['vídeo', 'video'], ['recorrido', 'video'], ['escanear', 'video'], ['xpacescan', 'video'], ['fotos', 'fotos'], ['360', 'fotos'], ['panorama', 'fotos'], ['matrix', 'fotos'], ['photos', 'fotos']]) assert.equal(parseOrden(t).orden, o, t);
  assert.equal(parseOrden('demoler el local'), null);
  assert.equal(parseOrden('/arquitectura'), null, '/arquitectura es el organigrama, no el Arquitecto');
  assert.deepEqual(parametros('?orden=crear&tipo=kiosco&locationId=lab-1'), { orden: 'crear', tipo: 'kiosco', locationId: 'lab-1' });
  assert.deepEqual(parametros('?orden=borrar&tipo=castillo&locationId=../x'), { orden: '', tipo: '', locationId: '' });
  // El cargador común (avatar.js, PERSONAJES) manda la orden en ?arg=: /arquitecto crear cafetería → crear-cafeteria.
  assert.deepEqual(parametros('?lang=es&arg=crear-cafeteria'), { orden: 'crear', tipo: 'cafeteria', locationId: '' });
  assert.deepEqual(parametros('?arg=inventariar'), { orden: 'inventariar', tipo: '', locationId: '' });
  assert.deepEqual(parametros('?arg=<script>'), { orden: '', tipo: '', locationId: '' });
  assert.equal(tipoDe('una farmacia de barrio'), 'farmacia');
  assert.equal(tipoDe('algo raro'), '');
});

test('lo que se cuenta de un local: medidas, pantallas, players, cámaras y audio', () => {
  assert.deepEqual(medidasDe('Una cafetería de 8 por 12 metros y 3 m de alto'), { ancho: 8, largo: 12, alto: 3 });
  assert.deepEqual(medidasDe('6,5 x 9'), { ancho: 6.5, largo: 9 });
  assert.deepEqual(medidasDe('un local de 100 m2'), { m2: 100 });
  assert.deepEqual(medidasDe('un videowall 2x2'), {}, 'un mosaico 2x2 no son las medidas de la sala');
  const d = leerDescripcion('Cafetería de 8 por 12 m con tres pantallas verticales de 43 pulgadas en la pared del fondo, un videowall 2x2 a la derecha, dos players, dos cámaras y hilo musical');
  assert.equal(d.tipo, 'cafeteria');
  assert.deepEqual(d.pantallas.map(p => [p.cantidad, p.orientacion, p.pulgadas, p.pared, p.mosaico && p.mosaico.tipo]), [[3, 'vertical', 43, 'F', null], [1, 'horizontal', null, 'D', 'rejilla']]);
  assert.equal(d.players, 2); assert.equal(d.camaras, 2); assert.equal(d.altavoces, 1);
  assert.equal(paredDe('en la izquierda'), 'I'); assert.equal(paredDe('on the back wall'), 'F'); assert.equal(paredDe('escaparate'), 'P');
});

test('reformar: lo contado → órdenes, y las órdenes → Propuesta de obra válida (plano-core)', () => {
  const plan = generarXpacio({ tipo: 'laboratorio', total: true, semilla: 11, id: 'lab-reforma' });
  const { ops, dudas } = interpretarReforma('Añade un videowall 2x2 de 43 pulgadas en la pared izquierda, quita la pantalla de la puerta y pinta la pared de rojo', plan.pantallas);
  assert.deepEqual(ops.map(o => o.op), ['anadir', 'retirar']);
  assert.equal(ops[0].pared, 'I'); assert.deepEqual(ops[0].mosaico, { tipo: 'rejilla', filas: 2, cols: 2 }); assert.equal(ops[0].pulgadas, 43);
  assert.deepEqual(ops[1].ids, plan.pantallas.filter(s => /puerta/i.test(s.nombre)).map(s => s.id));
  assert.deepEqual(dudas, ['pinta la pared de rojo'], 'lo que no entiende lo dice, no lo inventa');
  const r = aplicarReforma(plan, plan.pantallas, ops);
  assert.ok(r.hechos.every(h => h.ok), JSON.stringify(r.hechos));
  assert.deepEqual(errores(plan, r.propuesta), [], 'sin solapes, puertas tapadas ni techo');
  const vw = r.propuesta.filter(s => s.grupoNombre === 'Videowall 2×2');
  assert.equal(vw.length, 4); assert.ok(vw.every(s => s.pared === 'I' && s.pulgadas === 43 && s.estado === 'propuesta' && s.itil === null));
  const orden = workOrder(plan, r.propuesta);
  assert.deepEqual(orden.resumen, { alta: 1, baja: 1 }, 'el videowall entra como una sola alta de mosaico');
  // Se guarda como la Propuesta de obra de plano.html y plano.html la recupera.
  const guardada = exportOrder(plan, r.propuesta, { titulo: 'Propuesta del Arquitecto' });
  assert.deepEqual(restoreProposal(JSON.parse(JSON.stringify(guardada)), plan).propuesta, r.propuesta);
});

test('reformar: mover, girar, cambiar de tamaño y retirar por pared, número o mosaico', () => {
  const plan = generarXpacio({ tipo: 'cafeteria', ancho: 8, largo: 12, alto: 3, semilla: 5, id: 'cafe-reforma' });
  const mb = plan.pantallas.filter(s => s.grupo);
  let { ops, dudas } = interpretarReforma('mueve los menu boards a la pared izquierda', plan.pantallas);
  assert.deepEqual(dudas, []); assert.equal(ops[0].op, 'mover'); assert.equal(ops[0].pared, 'I');
  let r = aplicarReforma(plan, plan.pantallas, ops);
  assert.ok(r.hechos[0].ok, JSON.stringify(r.hechos));
  assert.ok(r.propuesta.filter(s => s.grupo === mb[0].grupo).every(s => s.pared === 'I'), 'el mosaico se mueve entero');
  assert.deepEqual(errores(plan, r.propuesta), []);
  ({ ops } = interpretarReforma('gira la pantalla 1 a vertical y cambia la 2 a 55 pulgadas', plan.pantallas));
  assert.deepEqual(ops.map(o => [o.op, o.ids]), [['girar', [plan.pantallas[0].id]], ['tamano', [plan.pantallas[1].id]]]);
  r = aplicarReforma(plan, plan.pantallas, ops);
  assert.equal(r.propuesta.find(s => s.id === plan.pantallas[0].id).orientacion, 'vertical');
  assert.equal(r.propuesta.find(s => s.id === plan.pantallas[1].id).pulgadas, 55);
  ({ ops } = interpretarReforma('quita todas', plan.pantallas));
  assert.equal(aplicarReforma(plan, plan.pantallas, ops).propuesta.length, 0);
  // Lo que no cabe se dice: 12 videowalls 4×6 de 85″ no caben en una cafetería.
  r = aplicarReforma(plan, plan.pantallas, [{ op: 'anadir', cantidad: 3, pulgadas: 85, mosaico: { tipo: 'rejilla', filas: 4, cols: 6 }, pared: 'F', texto: 'x' }]);
  assert.equal(r.hechos.at(-1).ok, false); assert.equal(r.hechos.at(-1).motivo, 'no-cabe');
  assert.deepEqual(errores(plan, r.propuesta), []);
  // Una orden sobre una pantalla que ya no está no rompe nada.
  r = aplicarReforma(plan, plan.pantallas, [{ op: 'retirar', ids: [plan.pantallas[0].id] }, { op: 'girar', ids: [plan.pantallas[0].id], orientacion: 'vertical' }]);
  assert.equal(r.hechos[1].motivo, 'no-esta');
});

test('topes: muchas órdenes o pantallas no cuelgan el navegador; lo que sobra se dice', () => {
  const plan = generarXpacio({ tipo: 'supermercado', total: true, semilla: 3, id: 'super-topes' });
  const largo = Array.from({ length: 40 }, (_, i) => `añade doce pantallas verticales de 85 pulgadas en la pared ${['del fondo', 'derecha', 'izquierda'][i % 3]}`).join(', ');
  // Se cuenta la CPU de este proceso, no el reloj: lo que cuelga el navegador es el trabajo en su hilo. En el runner
  // compartido de GitHub el reloj sumaba esperas ajenas: 8,05 s el 22-oct-2026 con unos 2 s de CPU (M4) y el
  // merge se quedaba sin publicar. El límite de 8 s es el mismo.
  const cpu0 = process.cpuUsage();
  const r = interpretarReforma(largo, plan.pantallas);
  assert.equal(r.ops.length, MAX_ORDENES); assert.ok(r.demasiadas > 0, "las que sobran se cuentan");
  const ap = aplicarReforma(plan, plan.pantallas, r.ops);
  assert.equal(ap.propuesta.length - plan.pantallas.length, MAX_PANTALLAS_NUEVAS);
  assert.ok(ap.hechos.some(h => h.motivo === 'demasiadas'));
  const d = planDesdeDescripcion({ descripcion: 'supermercado de 30 por 40 m con ' + largo, id: 'desc-topes', semilla: 1 });
  assert.ok(d.plan.pantallas.length <= MAX_PANTALLAS_NUEVAS);
  const cpu = process.cpuUsage(cpu0), ms = Math.round((cpu.user + cpu.system) / 1000);
  assert.ok(ms < 8000, 'en segundos, no en medio minuto: ' + ms + ' ms de CPU');
});

test('reformar desde fotos: las pantallas estimadas sin pareja son altas en su sitio; nada se retira por no verse', () => {
  const plan = planDesdeEstimacion({ estimacion: { ...ESTIMACION, pantallas: ESTIMACION.pantallas.slice(0, 1) }, tipo: 'laboratorio', id: 'lab-foto', semilla: 3 });
  const foto = { pantallas: [ESTIMACION.pantallas[0], { ...ESTIMACION.pantallas[1], s: 2.6 }, ESTIMACION.pantallas[2]] };
  const { ops } = reformaDesdeEstimacion(plan, plan.pantallas, foto);
  assert.deepEqual(ops.map(o => [o.op, o.pared]), [['anadir', 'F'], ['anadir', 'I']], 'la V izquierda ya estaba');
  assert.deepEqual(ops[0].posicion, { s: 2.6, z: 0.9 });
  const r = aplicarReforma(plan, plan.pantallas, ops);
  assert.equal(r.propuesta.length, 3);
  assert.ok(r.propuesta.some(s => s.pared === 'F' && Math.abs(s.s - 2.6) < 0.01), 'en la posición de la foto');
  assert.deepEqual(errores(plan, r.propuesta), []);
  // Si en la posición de la foto chocaría (pegada a otra sin ser del mismo mosaico), va a la primera libre.
  const pegada = aplicarReforma(plan, plan.pantallas, reformaDesdeEstimacion(plan, plan.pantallas, ESTIMACION).ops);
  assert.equal(pegada.propuesta.length, 3); assert.ok(pegada.hechos.every(h => h.ok));
  assert.deepEqual(errores(plan, pegada.propuesta), []);
  const girada = reformaDesdeEstimacion(plan, plan.pantallas, { pantallas: [{ ...ESTIMACION.pantallas[0], orientacion: 'horizontal', pulgadas: 43 }] });
  assert.deepEqual(girada.ops.map(o => o.op), ['girar', 'tamano']);
});

test('inventariar desde fotos o vídeo: el plano de «Con foto o vídeo» (plano-foto.mjs), sólo con lo que se ve', () => {
  const respuesta = { ok: true, simulada: true, modelo: 'gemini-3.1-pro-preview', modeloNombre: 'Gemini 3.1 Pro', fotos: 3, estimacion: ESTIMACION };
  const plan = planDesdeEstimacion({ respuesta, tipo: 'laboratorio', id: 'lab-inventario', nombre: 'Lab inventario', semilla: 9 });
  assert.equal(plan.schema, SCHEMA);
  assert.deepEqual(plan.planta, { ancho: 3.4, fondo: 3.6, alto: 3 });
  assert.equal(plan.pantallas.length, 3); assert.ok(plan.pantallas.every(s => s.estado === 'estimada' && s.itil === null));
  assert.match(plan.fuente.titulo, /Plano estimado desde fotos · Gemini 3\.1 Pro · confianza 50 %/, 'con su procedencia');
  assert.deepEqual(errores(plan), [], 'las pantallas vistas, desolapadas');
  assert.ok(leerPlanoJson(JSON.stringify(plan)).ok, 'Subir plano lo acepta');
  // Sin pantallas vistas, el generador pondría las típicas: en un inventario serían CI inventados, se quitan.
  const sinVer = planDesdeEstimacion({ respuesta: { ...respuesta, estimacion: { ...ESTIMACION, pantallas: [] } }, tipo: 'laboratorio', id: 'lab-sin', semilla: 9 });
  assert.equal(sinVer.pantallas.length, 0); assert.equal(sinVer.fuente.pantallas, 'Ninguna pantalla vista en las fotos');
  assert.equal(planDesdeEstimacion({ estimacion: ESTIMACION, tipo: 'laboratorio', id: 'lab-solo', semilla: 2 }).pantallas.length, 3, 'también con la estimación sola');
  assert.throws(() => planDesdeEstimacion({ estimacion: { pantallas: [] } }), /estimacion-sin-medidas/);
});

test('inventariar desde una descripción: sólo lo que se cuenta (sin pantallas inventadas)', () => {
  const { plan, noCaben } = planDesdeDescripcion({ descripcion: 'Cafetería de 8 por 12 m con tres pantallas verticales de 43″ en la pared del fondo y un videowall 2x2 a la derecha', id: 'cafe-desc', semilla: 2 });
  assert.equal(noCaben.length, 0);
  assert.deepEqual(plan.planta, { ancho: 8, fondo: 12, alto: 3 });
  assert.deepEqual(plan.pantallas.map(s => s.pared), ['F', 'F', 'F', 'D', 'D', 'D', 'D']);
  assert.ok(plan.pantallas.every(s => s.estado === 'estimada' && !/nueva/.test(s.nombre)));
  assert.deepEqual(errores(plan), []);
  const vacia = planDesdeDescripcion({ descripcion: 'un estanco pequeño', id: 'estanco-desc', semilla: 2 }).plan;
  assert.equal(vacia.generador.tipo, 'estanco'); assert.equal(vacia.pantallas.length, 0, 'sin pantallas descritas, ninguna inventada');
});

test('CI ITIL: códigos con el regex de Yokup, únicos, players antes que sus pantallas y relaciones cerradas', () => {
  assert.equal(prefijoDe('lab-gran-de-gracia-51'), 'LABGDG51');
  assert.equal(prefijoDe('alsea-sbux-021'), 'ALSEASBUX021');
  assert.equal(prefijoDe('cafe'), 'CAFE');
  assert.equal(prefijoDe('-'), 'XPACIO');
  const { plan } = planDesdeDescripcion({ descripcion: 'tres pantallas verticales en el fondo y un videowall 2x2 a la derecha', tipo: 'cafeteria', id: 'cafe-itil', semilla: 4 });
  const cis = construirCis(plan, { prefijo: 'CAFE01', camaras: 2, altavoces: 1 });
  assert.ok(cis.every(c => ITIL_RE.test(c.itil_code)), cis.map(c => c.itil_code).join());
  assert.equal(new Set(cis.map(c => c.itil_code)).size, cis.length);
  assert.deepEqual(cis.map(c => c.category).filter((c, i, a) => a.indexOf(c) === i), ['player', 'pantalla', 'iot', 'audio']);
  assert.equal(cis.filter(c => c.category === 'player').length, 4, 'uno por pantalla suelta y uno por mosaico');
  const vw = cis.filter(c => c.category === 'pantalla' && /Videowall/.test(c.name));
  assert.equal(new Set(vw.map(c => c.parent_itil_code)).size, 1, 'el videowall cuelga de un solo player');
  assert.ok(revisarCis(cis).ok);
  assert.equal(construirCis(plan, { prefijo: 'CAFE01', players: 2 }).filter(c => c.category === 'player').length, 2, '«dos players»: se reparten');
  // El orden de alta pone a los padres delante aunque la lista venga desordenada.
  const orden = ordenAlta(cis.slice().reverse()).map(c => c.itil_code);
  for (const c of cis) if (c.parent_itil_code) assert.ok(orden.indexOf(c.parent_itil_code) < orden.indexOf(c.itil_code), c.itil_code);
  // Errores de lo editado a mano.
  const mal = [{ itil_code: 'cafe-pan-1', name: 'x', category: 'pantalla' }, { itil_code: 'CAFE-PAN-01', name: '', category: 'tele' }, { itil_code: 'CAFE-PAN-01', name: 'b', category: 'pantalla', parent_itil_code: 'CAFE-PLY-09' },
    { itil_code: 'CAFE-PLY-01', name: 'c', category: 'player', parent_itil_code: 'CAFE-PLY-01' }];
  assert.deepEqual(revisarCis(mal).errores.map(e => e.codigo), ['formato', 'vacio', 'categoria', 'repetido', 'padre', 'ciclo']);
  // Los códigos van al plano: pantallas con su CI y players como dispositivos.
  const conItil = planConItil(plan, cis);
  assert.ok(conItil.pantallas.every(s => ITIL_RE.test(s.itil)));
  assert.equal(conItil.dispositivos.filter(d => d.categoria === 'player').length, 4);
  assert.equal(plan.pantallas[0].itil, null, 'sin tocar el plano original');
});

test('traspaso a Yokup: en el #fragmento, con tope de tamaño, y el contrato compartido con el portal', async () => {
  const fixture = JSON.parse(read('tests/fixtures/arquitecto-traspaso.json'));
  const v0 = await codificarTraspaso(fixture.inventario, { comprimir: false });
  assert.equal(v0.fragmento, fixture.v0, 'el portal (yokup-site/arquitecto-traspaso.js) decodifica exactamente esto');
  const v1 = await codificarTraspaso(fixture.inventario);
  assert.equal(v1.formato, 'v1'); assert.ok(v1.fragmento.length < v0.fragmento.length);
  const b = v1.fragmento.slice(3).replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b + '='.repeat((4 - b.length % 4) % 4)), c => c.charCodeAt(0));
  const json = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  assert.deepEqual(JSON.parse(json), fixture.inventario);
  assert.equal(urlPortal('v1.abc'), 'https://admira.app/retailer#arquitecto=v1.abc');
  assert.equal(PORTAL_IMPORTAR, 'https://admira.app/retailer');
  const enorme = { ...fixture.inventario, plan: { ...fixture.inventario.plan, relleno: 'x'.repeat(MAX_TRASPASO_JSON) } };
  assert.equal((await codificarTraspaso(enorme)).error, 'grande');
  // Lo que viaja: el plano con los códigos y los CI, sin campos internos.
  const plan = planDesdeEstimacion({ estimacion: ESTIMACION, tipo: 'laboratorio', id: 'lab-traspaso', semilla: 1 });
  const cis = construirCis(plan, { prefijo: 'LABT' });
  const inv = inventarioTraspaso({ plan, cis, tipo: 'laboratorio', prefijo: 'LABT', creado: '2026-10-14T00:00:00Z' });
  assert.equal(inv.schema, TRASPASO_SCHEMA);
  assert.deepEqual(Object.keys(inv.cis[0]).sort(), ['category', 'group_name', 'itil_code', 'name', 'orientation', 'parent_itil_code', 'position', 'role']);
  assert.ok(inv.plan.pantallas.every(s => s.itil));
});

test('la nube del Arquitecto: su URL, sus órdenes sólo desde su ventana y su origen, y copias locales sólo en localhost', () => {
  assert.equal(caraUrl({ lang: 'en' }), 'https://digitalavatar.ai/nube.html?personaje=arquitecto&embed=0&dock=1&lang=en&tier=good');
  const ventana = {};
  const ev = (data, origin = 'https://digitalavatar.ai', source = ventana) => ({ data, origin, source });
  assert.deepEqual(ordenDeNube(ev({ type: 'da-arquitecto-orden', orden: 'crear', texto: 'una cafetería' }), { ventana, origen: 'https://digitalavatar.ai' }), { orden: 'crear', texto: 'una cafetería' });
  assert.equal(ordenDeNube(ev({ type: 'da-arquitecto-orden', orden: 'crear' }, 'https://evil.example'), { ventana, origen: 'https://digitalavatar.ai' }), null);
  assert.equal(ordenDeNube(ev({ type: 'da-arquitecto-orden', orden: 'crear' }, undefined, {}), { ventana, origen: 'https://digitalavatar.ai' }), null);
  assert.equal(ordenDeNube(ev({ type: 'da-arquitecto-orden', orden: 'demoler', texto: 'x'.repeat(5000) }), { ventana, origen: 'https://digitalavatar.ai' }).orden, '');
  assert.equal(baseLocal('http://127.0.0.1:8871', 'http://127.0.0.1:8872'), 'http://127.0.0.1:8871');
  assert.equal(baseLocal('http://127.0.0.1:8871', 'https://www.admira.biz'), '', 'en producción, siempre la de verdad');
  assert.equal(baseLocal('https://evil.example', 'http://localhost:8080'), '');
  assert.equal(ESTIMAR_URL, 'https://api.admira.store/xpacio/estimar', 'el ESTIMADOR de plano-foto.mjs');
});

test('planta y alzado en SVG: las clases de plano.css, nuevas en lima y los nombres escapados', () => {
  const plan = generarXpacio({ tipo: 'laboratorio', total: true, semilla: 8, id: 'lab-svg' });
  plan.pantallas[0].nombre = '<img src=x onerror=alert(1)>';
  plan.mobiliario[0].nombre = '"><script>';
  const nuevos = new Set([plan.pantallas[1].id]);
  const p = svgPlanta(plan, plan.pantallas, { wallId: 'F', nuevos, retiradas: [plan.pantallas[0]] });
  assert.match(p.viewBox, /^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/);
  for (const c of ['floor', 'wall active', 'scr-body', 'scr new', 'scr-ghost', 'wall-label']) assert.ok(p.cuerpo.includes(`class="${c}"`) || p.cuerpo.includes(`class="${c} `) || p.cuerpo.includes(c), c);
  assert.doesNotMatch(p.cuerpo, /<img|<script/);
  const a = svgAlzado(plan, plan.pantallas, plan.pantallas[0].pared, { nuevos });
  assert.match(a.cuerpo, /class="elev-wall"/); assert.doesNotMatch(a.cuerpo, /<img|<script/);
});

test('la página: shell cuadrático, el Arquitecto a un lado y el plano al otro, y en el release de admira.biz', () => {
  const html = read('arquitecto.html'), js = read('arquitecto.mjs');
  assert.match(html, /<link rel="stylesheet" href="\/galaxy-shell\.css\?v=20261006-experto-tecla-1">/);
  assert.match(html, /<script defer src="\/galaxy-shell\.js\?v=20261020-sesion-1"><\/script>/);
  assert.ok(html.indexOf('window.ADMIRA_SHELL') < html.indexOf('/galaxy-shell.js?v='));
  const head = html.slice(html.indexOf('/galaxy-shell.css'), html.indexOf('</head>'));
  assert.doesNotMatch(head, /rel="stylesheet"|<style[\s>]/, 'ninguna hoja de la página después del shell');
  for (const id of ['arq-cara-frame', 'tab-crear', 'tab-reformar', 'tab-inventariar', 'tab-detallar', 'tab-modelar', 'tab-video', 'tab-fotos', 'arq-crear', 'arq-reformar', 'arq-inventariar', 'arq-detallar', 'arq-modelar', 'arq-video', 'arq-fotos', 'dt-card', 'md-card', 'vd-card', 'ft-card', 'arq-plano-card', 'arq-planta', 'arq-alzado', 'in-tabla', 'in-yokup', 'rf-mic', 'in-mic'])
    assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /allow="autoplay; microphone"/, 'el micro de la nube también vale');
  assert.match(js, /window\.AdmiraArquitecto = \{/);
  assert.match(js, /toggle\(\) \{ mostrarArquitecto\(true\); abrirAyuda\(\);/, '/arquitecto sin nada: lo saca y explica');
  assert.match(js, /lanzar\(arg\) \{/, 'el contrato de personajes del cargador (toggle/lanzar)');
  assert.match(js, /'admira\.plano\.' \+ id/, 'la misma clave de propuesta que plano.html');
  assert.match(js, /registroSubida\(/, 'el mismo almacén de planos que plano.html');
  assert.doesNotMatch(js, /fetch\([^)]*yokup/i, 'el estudio no llama a la API de Yokup: traspasa al portal');
  const fotos = read('arquitecto-fotos.mjs');
  assert.match(fotos, /from '\.\/plano-foto\.mjs\?v=20261014-foto-2'/, 'las reglas de fotos y vídeo de «Con foto o vídeo», no una copia');
  assert.match(js, /urlEstimador\(location\.search, location\.hostname\)/, 'en producción, siempre api.admira.store');
  assert.match(js, /if \(!origenEstimador\(location\.origin\)\) return \{ ok: false, error: 'phOrigin' \};/, 'fuera de admira.biz/admira.store ni se intenta');
  assert.match(js, /proponerReforma\(\{ conFotos: false \}\)/, 'por voz o por la nube, nunca al estimador');
  assert.match(js, /inventariar\(\{ conFotos: false \}\)/);
  assert.doesNotMatch(js, /traspasoBloqueado|w === null/, 'window.open con noopener siempre da null: no se dice que se bloqueó');
  assert.match(html, /id="in-yokup-link"[^>]*rel="noopener"/, 'el enlace queda a mano');
  assert.match(html, /<header class="arq-head" data-shell-keep>/);
  assert.match(html, /href="plano\.css\?v=20261014-foto-2"/);
  assert.match(read('arquitecto-core.mjs'), /from '\.\/plano-foto\.mjs\?v=20261014-foto-2'/);
  for (const f of ['arquitecto.html', 'arquitecto.mjs', 'arquitecto.css', 'arquitecto-core.mjs', 'arquitecto-dibujo.mjs', 'arquitecto-fotos.mjs']) assert.ok(BIZ_ASSET_FILES.includes(f), f);
  assert.equal(bizAssetPath(new URL('https://www.admira.biz/arquitecto')), '/__admira_biz/arquitecto');
  assert.equal(bizAssetPath(new URL('https://www.admira.biz/arquitecto-core.mjs?v=1')), '/__admira_biz/arquitecto-core.mjs');
  assert.equal(bizAssetPath(new URL('https://www.clearchannel.tv/arquitecto')), '');
});
