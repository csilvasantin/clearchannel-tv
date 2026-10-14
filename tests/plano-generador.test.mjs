import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIPOS, TITULO, TITULO_ESTIMADO, generarXpacio, medidasMedias, sortearMedidas, mulberry32, nuevaSemilla, resumenGenerado } from '../plano-generador.mjs';
import { leerPlanoJson } from '../plano-subida.mjs';
import { SCHEMA, validate, footprint, wallLength } from '../plano-core.mjs';
import { BIZ_ASSET_FILES } from '../server/biz-assets.mjs';

const SEEDS = Array.from({ length: 50 }, (_, i) => (i + 1) * 2654435761 % 4294967291 || 1);
const area = p => p.planta.ancho * p.planta.fondo;
const overlap = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.d - 1e-6 && b.y < a.y + a.d - 1e-6;

test('the type table is short, in Spanish and English, with consistent averages and ranges', () => {
  assert.ok(Object.keys(TIPOS).length >= 10);
  for (const [id, t] of Object.entries(TIPOS)) {
    assert.ok(t.es && t.en, id);
    assert.ok(t.m2[0] < t.m2[1] && t.m2[1] < t.m2[2], id);
    assert.ok(t.alto[0] <= t.alto[1] && t.alto[1] <= t.alto[2] && t.alto[0] >= 2.4 && t.alto[2] <= 3.5, id);
    assert.ok(t.proporcion[0] > 0 && t.proporcion[0] <= t.proporcion[1], id);
    const m = medidasMedias(id);
    assert.ok(Math.abs(m.ancho * m.largo - t.m2[1]) / t.m2[1] < 0.05, `${id}: la media precargada ronda ${t.m2[1]} m²`);
  }
  assert.deepEqual(TIPOS.cafeteria.m2, [70, 100, 140]);
  assert.equal(TIPOS.kiosco.m2[1], 8);
});

test('every type generates valid plans with 50 seeds: schema, no plano-core issues, a door on the front', () => {
  for (const tipo of Object.keys(TIPOS)) {
    for (const semilla of SEEDS) {
      const plan = generarXpacio({ tipo, total: true, semilla, id: 'prueba-' + tipo });
      const label = `${tipo} · semilla ${semilla}`;
      assert.equal(plan.schema, SCHEMA, label);
      const read = leerPlanoJson(JSON.stringify(plan), 'otro');
      assert.equal(read.ok, true, `${label}: ${JSON.stringify(read.errores)}`);
      assert.deepEqual(validate(plan), [], label); // sin solapes, sin tapar puertas ni huecos, sin muebles delante
      const door = plan.huecos.find(h => h.tipo === 'puerta');
      assert.equal(door.pared, 'P', label);
      const t = TIPOS[tipo];
      if (t.calle && tipo !== 'kiosco') assert.ok(plan.huecos.some(h => h.tipo === 'escaparate' && h.pared === 'P'), `${label}: escaparate en la fachada`);
      assert.ok(plan.pantallas.length >= 1, `${label}: al menos una pantalla`);
      for (const s of plan.pantallas) {
        assert.equal(s.estado, 'propuesta', label);
        assert.equal(s.itil, null, label);
        const f = footprint(s), w = plan.paredes.find(x => x.id === s.pared);
        assert.ok(f.x0 >= -1e-6 && f.x1 <= wallLength(w) + 1e-6, label);
      }
      // Muebles dentro de la sala, sin pisarse y sin nada delante de la puerta.
      const W = plan.planta.ancho, F = plan.planta.fondo, dx0 = W - door.desde - door.ancho;
      const doorZone = { x: dx0, y: F - 0.9, w: door.ancho, d: 0.9 };
      plan.mobiliario.forEach((m, i) => {
        assert.ok(m.x >= -1e-6 && m.y >= -1e-6 && m.x + m.w <= W + 1e-6 && m.y + m.d <= F + 1e-6, `${label}: ${m.nombre} dentro`);
        assert.ok(!overlap(m, doorZone), `${label}: ${m.nombre} no tapa la puerta`);
        for (const o of plan.mobiliario.slice(i + 1)) assert.ok(!overlap(m, o), `${label}: ${m.nombre} y ${o.nombre}`);
      });
      assert.ok(plan.fuente.titulo.startsWith(TITULO), label);
      assert.match(plan.fuente.titulo, new RegExp(`${t.es} · [\\d,]+ m² · semilla ${semilla}$`));
    }
  }
});

test('«creación total» draws sizes within the type ranges', () => {
  for (const [tipo, t] of Object.entries(TIPOS)) {
    const areas = [];
    for (const semilla of SEEDS) {
      const p = generarXpacio({ tipo, total: true, semilla });
      areas.push(area(p));
      assert.ok(area(p) >= t.m2[0] - 1e-6 && area(p) <= t.m2[2] + 1e-6, `${tipo}: ${area(p)} m²`);
      assert.ok(p.planta.alto >= t.alto[0] - 1e-6 && p.planta.alto <= t.alto[2] + 1e-6, `${tipo}: alto ${p.planta.alto}`);
      const ratio = p.planta.fondo / p.planta.ancho;
      assert.ok(ratio >= t.proporcion[0] * 0.85 && ratio <= t.proporcion[1] * 1.15, `${tipo}: proporción ${ratio}`);
      assert.equal(p.generador.total, true);
    }
    // Alrededor de la media: la media de las 50 superficies queda cerca de la del tipo.
    const mean = areas.reduce((a, b) => a + b, 0) / areas.length;
    assert.ok(Math.abs(mean - (t.m2[0] + t.m2[1] + t.m2[2]) / 3) / t.m2[1] < 0.15, `${tipo}: media ${mean}`);
  }
});

test('the same seed regenerates the same plan; another seed gives another one', () => {
  const a = generarXpacio({ tipo: 'cafeteria', total: true, semilla: 12345, id: 'mi-cafe' });
  const b = generarXpacio({ tipo: 'cafeteria', total: true, semilla: 12345, id: 'mi-cafe' });
  assert.deepEqual(a, b);
  assert.deepEqual(a.generador, { tipo: 'cafeteria', semilla: 12345, total: true, medidas: { ancho: a.planta.ancho, largo: a.planta.fondo, alto: a.planta.alto }, version: 1 });
  // Con la semilla y las medidas del JSON se vuelve a sacar el mismo plano.
  assert.deepEqual(generarXpacio({ tipo: a.generador.tipo, total: true, semilla: a.generador.semilla, id: 'mi-cafe' }), a);
  assert.notDeepEqual(generarXpacio({ tipo: 'cafeteria', total: true, semilla: 54321, id: 'mi-cafe' }), a);
  const r1 = mulberry32(7), r2 = mulberry32(7);
  assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()]);
  const s = nuevaSemilla();
  assert.ok(Number.isInteger(s) && s > 0 && s <= 0xffffffff);
  // Sin semilla se sortea una y queda en el plano.
  assert.ok(generarXpacio({ tipo: 'kiosco', total: true }).generador.semilla > 0);
});

test('sizes given by hand are kept; missing ones come from the type average', () => {
  const p = generarXpacio({ tipo: 'farmacia', ancho: 9.3, largo: 14.2, alto: 3.15, semilla: 99, id: 'farmacia-sol', nombre: 'Farmacia Sol', direccion: 'Calle Mayor 1' });
  assert.deepEqual(p.planta, { ancho: 9.3, fondo: 14.2, alto: 3.15 });
  assert.deepEqual(p.generador.medidas, { ancho: 9.3, largo: 14.2, alto: 3.15 });
  assert.equal(p.generador.total, false);
  assert.equal(p.nombre, 'Farmacia Sol');
  assert.equal(p.direccion, 'Calle Mayor 1');
  assert.match(p.fuente.medidas, /con las medidas indicadas/);
  // `total` manda sobre las medidas a mano.
  const t = generarXpacio({ tipo: 'farmacia', ancho: 9.3, largo: 14.2, alto: 3.15, semilla: 99, total: true });
  assert.notDeepEqual(t.planta, p.planta);
  const media = medidasMedias('estanco'), m = generarXpacio({ tipo: 'estanco', ancho: 5, semilla: 3 });
  assert.deepEqual(m.planta, { ancho: 5, fondo: media.largo, alto: media.alto });
  assert.equal(generarXpacio({ tipo: 'oficina', semilla: 1 }).nombre, 'Oficina · xpacio-generado');
  // Medidas absurdas o tipo desconocido: error claro.
  assert.throws(() => generarXpacio({ tipo: 'cafeteria', ancho: 0.5, largo: 10, alto: 3 }), RangeError);
  assert.throws(() => generarXpacio({ tipo: 'nave-industrial' }), TypeError);
  assert.throws(() => generarXpacio({ tipo: 'cafeteria', id: 'Mi Café' }), TypeError);
  // Un local pequeño a mano también sale válido (menos muebles y pantallas, pero sin choques).
  for (const tipo of Object.keys(TIPOS)) assert.deepEqual(validate(generarXpacio({ tipo, ancho: 3, largo: 4, alto: 2.6, semilla: 5 })), [], tipo);
});

test('each type gets its typical furniture and screens', () => {
  const cafe = generarXpacio({ tipo: 'cafeteria', total: true, semilla: 2024 });
  assert.ok(cafe.mobiliario.some(m => /^Barra/.test(m.nombre)) && cafe.mobiliario.some(m => m.nombre === 'Mesa'));
  const boards = cafe.pantallas.filter(s => s.grupo === 'menu-boards');
  assert.ok(boards.length >= 1 && boards.every(s => s.pared === 'F' && s.orientacion === 'horizontal'), 'menu boards sobre la contrabarra');
  assert.ok(cafe.pantallas.some(s => s.escaparate && s.pared === 'P'), 'pantalla de escaparate');
  assert.ok(cafe.pantallas.some(s => s.corto === 'CAJA' && s.orientacion === 'vertical'), 'vertical junto a caja');
  const estanco = generarXpacio({ tipo: 'estanco', total: true, semilla: 2024 });
  assert.ok(estanco.mobiliario.some(m => /Mostrador/.test(m.nombre)) && estanco.mobiliario.some(m => /Expositor/.test(m.nombre)));
  const farmacia = generarXpacio({ tipo: 'farmacia', total: true, semilla: 2024 });
  assert.ok(farmacia.mobiliario.some(m => /Mostrador/.test(m.nombre)) && farmacia.mobiliario.some(m => /Lineal/.test(m.nombre)));
  const moda = generarXpacio({ tipo: 'moda', total: true, semilla: 2024 });
  assert.ok(moda.mobiliario.some(m => m.nombre === 'Probador') && moda.mobiliario.some(m => /Burro/.test(m.nombre)));
  const kiosco = generarXpacio({ tipo: 'kiosco', total: true, semilla: 2024 });
  assert.ok(area(kiosco) <= 12 && kiosco.pantallas.length >= 1);
  const r = resumenGenerado(cafe);
  assert.equal(r.tipo, 'cafeteria'); assert.equal(r.puertas, 1); assert.equal(r.escaparates, 1);
  assert.equal(r.pantallas, cafe.pantallas.length); assert.equal(r.muebles, cafe.mobiliario.length);
});

test('elements already placed (the photo or video path) are kept as they are and not invented again', () => {
  const elementos = {
    huecos: [{ tipo: 'puerta', pared: 'D', desde: 2, ancho: 0.9, alto: 2.1 }, { tipo: 'escaparate', pared: 'P', desde: 0.5, ancho: 4, base: 0.3, alto: 2.2 }, { pared: 'X', desde: 1, ancho: 1, alto: 1 }],
    mobiliario: [{ nombre: 'Barra vista en el vídeo', x: 1, y: 1, w: 4, d: 0.6, alto: 1.1 }, { nombre: 'fuera', x: 50, y: 1, w: 1, d: 1, alto: 1 }],
    pantallas: [{ nombre: 'Menu board visto', orientacion: 'horizontal', pulgadas: 55, pared: 'F', s: 3, z: 2 }, { nombre: 'mal', orientacion: 'diagonal', pulgadas: 55, pared: 'F', s: 1, z: 1 }]
  };
  const p = generarXpacio({ tipo: 'cafeteria', ancho: 8, largo: 12, alto: 3.1, semilla: 11, id: 'cafe-por-video', elementos });
  assert.deepEqual(p.planta, { ancho: 8, fondo: 12, alto: 3.1 });
  assert.equal(p.huecos.length, 2, 'los huecos dados, sin inventar puerta ni escaparate');
  assert.deepEqual(p.huecos.map(h => [h.tipo, h.pared, h.nombre]), [['puerta', 'D', 'Puerta'], ['escaparate', 'P', 'Escaparate']]);
  assert.deepEqual(p.mobiliario.map(m => m.nombre), ['Barra vista en el vídeo'], 'con muebles dados no se inventan más');
  assert.deepEqual(p.pantallas.map(s => [s.nombre, s.estado, s.itil]), [['Menu board visto', 'estimada', null]], 'con pantallas dadas no se añaden las típicas');
  assert.deepEqual(p.generador.elementos, { huecos: 2, mobiliario: 1, pantallas: 1 });
  assert.ok(p.fuente.titulo.startsWith(TITULO_ESTIMADO));
  assert.equal(leerPlanoJson(JSON.stringify(p), 'x').ok, true);
  // Solo pantallas: la puerta y los muebles se inventan alrededor, sin taparlas ni tapar la puerta.
  const q = generarXpacio({ tipo: 'cafeteria', ancho: 8, largo: 12, alto: 3.1, semilla: 11, elementos: { pantallas: [{ orientacion: 'vertical', pulgadas: 43, pared: 'I', s: 6, z: 1.0 }] } });
  assert.equal(q.huecos.filter(h => h.tipo === 'puerta').length, 1);
  assert.ok(q.mobiliario.length > 3);
  assert.equal(q.pantallas.length, 1);
  assert.deepEqual(validate(q), []);
  // Sin elementos, igual que siempre.
  assert.deepEqual(generarXpacio({ tipo: 'cafeteria', total: true, semilla: 5 }), generarXpacio({ tipo: 'cafeteria', total: true, semilla: 5, elementos: null }));
});

test('the generator ships with the floor plan page on admira.biz', () => {
  assert.ok(BIZ_ASSET_FILES.includes('plano-generador.mjs'));
  const html = readFileSync(new URL('../plano.html', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../plano.mjs', import.meta.url), 'utf8');
  assert.match(page, /plano-generador\.mjs\?v=20261014-foto-1/);
  assert.match(html, /id="create"[^>]*data-shell-slot="advanced"/);
  assert.ok(html.indexOf('id="upload"') < html.indexOf('id="create"'), '«Creación de Xpacios» va debajo de «Subir plano»');
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(index, /id="header-create-xpacio-btn"/);
});
