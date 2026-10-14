// ▤ Creación de Xpacios · «Con foto o vídeo» (DCL-ddf3203078fe9471f3796130): lógica pura de plano-foto.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ESTIMADOR, MAX_FOTOS, MAX_BYTES_FOTO, urlEstimador, tiemposFotogramas, escalaFoto, bytesDataUrl, clasificarFicheros, claveError,
  elementosDeEstimacion, planoDesdeEstimacion, resumenEstimado, desolaparPantallas, origenEstimador
} from '../plano-foto.mjs';
import { leerPlanoJson } from '../plano-subida.mjs';
import { validate } from '../plano-core.mjs';
import { BIZ_ASSET_FILES } from '../server/biz-assets.mjs';

// Respuesta real de /xpacio/estimar (Gemini 3.1 Pro, 8 fotos del laboratorio de Gran de Gràcia 51), resumida.
const RESPUESTA = {
  ok: true, modelo: 'gemini-3.1-pro-preview', modeloNombre: 'Gemini 3.1 Pro', fotos: 8,
  estimacion: {
    ancho: 2.8, largo: 3.5, alto: 2.8, confianza: { ancho: 0.8, largo: 0.4, alto: 0.7, global: 0.6 },
    referencias: [{ objeto: 'Baldosa de suelo', supuesto: 'Baldosa hidráulica de 20x20 cm', foto: 7 }, { objeto: 'Puerta de paso', supuesto: 'Altura estándar de hoja de puerta' }],
    huecos: [{ tipo: 'puerta', nombre: 'Puerta doble', pared: 'F', desde: 0.8, ancho: 1.3, base: 0, alto: 2.1, confianza: 0.7 }, { tipo: 'puerta', nombre: '', pared: 'I', desde: 2.4, ancho: 0.8, base: 0, alto: 2.05, confianza: 0.6 }],
    mobiliario: [{ nombre: 'Mesa escritorio', x: 2.1, y: 0.6, w: 0.7, d: 2.4, alto: 0.75, confianza: 0.6 }, { nombre: 'Máquina Arcade', x: 0.2, y: 0, w: 0.6, d: 0.6, alto: 1.75, confianza: 0.6 }],
    pantallas: [
      { nombre: 'Portátil', pared: 'D', s: 0.8, z: 0.85, orientacion: 'horizontal', pulgadas: 15, confianza: 0.5 },
      { nombre: 'Monitor Izquierdo', pared: 'D', s: 1.1, z: 0.9, orientacion: 'vertical', pulgadas: 27, confianza: 0.6 },
      { nombre: 'Monitor Central', pared: 'D', s: 1.6, z: 0.95, orientacion: 'horizontal', pulgadas: 27, confianza: 0.6 },
      { nombre: 'Monitor Derecho', pared: 'D', s: 2.1, z: 0.9, orientacion: 'vertical', pulgadas: 27, confianza: 0.6 }
    ],
    notas: 'La pared P no se ve en ninguna toma.', descartes: []
  }
};

test('el estimador es api.admira.store; un enlace no puede desviar las fotos a otro host', () => {
  assert.equal(urlEstimador('', 'www.admira.biz'), ESTIMADOR);
  assert.equal(urlEstimador('?simula=1', 'www.admira.biz'), ESTIMADOR + '?simula=1');
  // Fuera de localhost, ?estimador se ignora siempre.
  for (const otro of ['http://localhost:8787', 'https://evil.example', 'http://127.0.0.1:1']) assert.equal(urlEstimador('?estimador=' + encodeURIComponent(otro), 'www.admira.biz'), ESTIMADOR);
  // En localhost, solo hacia otro localhost (worker local para pruebas).
  assert.equal(urlEstimador('?estimador=http://127.0.0.1:8799', 'localhost'), 'http://127.0.0.1:8799/xpacio/estimar');
  assert.equal(urlEstimador('?estimador=https://evil.example', 'localhost'), ESTIMADOR);
  assert.equal(urlEstimador('?estimador=http://localhost.evil.example', '127.0.0.1'), ESTIMADOR);
  assert.match(ESTIMADOR, /^https:\/\/api\.admira\.store\//);
});

test('fotogramas de un vídeo: 6 si es corto, 8 si no, dentro del vídeo y sin el primero ni el último', () => {
  assert.equal(tiemposFotogramas(3).length, 6);
  const t = tiemposFotogramas(40);
  assert.equal(t.length, 8);
  assert.ok(t.every((x, i) => x > 0 && x < 40 && (i === 0 || x > t[i - 1])));
  assert.deepEqual(tiemposFotogramas(0.2, 6).every(x => x <= 0.15), true);
  for (const d of [0, -1, NaN, Infinity, undefined]) assert.deepEqual(tiemposFotogramas(d), []);
  assert.equal(tiemposFotogramas(60, 20).length, MAX_FOTOS);
});

test('reescalado y tamaño de la foto', () => {
  assert.deepEqual(escalaFoto(4032, 3024), { w: 1600, h: 1200 });
  assert.deepEqual(escalaFoto(800, 551), { w: 800, h: 551 }, 'no se agranda');
  assert.deepEqual(escalaFoto(1080, 1920, 1280), { w: 720, h: 1280 });
  assert.equal(bytesDataUrl('data:image/jpeg;base64,QUJD'), 3);
  assert.equal(bytesDataUrl('data:image/jpeg;base64,QUI='), 2);
  // 8 fotos de 800 KB en base64 caben en el cuerpo de 9 MB del worker (fotos de hasta 1 MB).
  assert.equal(MAX_BYTES_FOTO, 800 * 1024);
  assert.ok(8 * Math.ceil(MAX_BYTES_FOTO / 3) * 4 + 4096 < 9 * 1024 * 1024);
});

test('ficheros: un vídeo manda; si no, hasta 8 imágenes', () => {
  const f = (name, type, size = 1000) => ({ name, type, size });
  const v = clasificarFicheros([f('a.jpg', 'image/jpeg'), f('paseo.mp4', 'video/mp4')]);
  assert.equal(v.video.name, 'paseo.mp4'); assert.deepEqual(v.errores.map(e => e.error), ['soloVideo']);
  assert.equal(clasificarFicheros([f('enorme.mov', 'video/quicktime', 2 * 1024 ** 3)]).errores[0].error, 'videoGrande');
  const fotos = clasificarFicheros(Array.from({ length: 10 }, (_, i) => f(`${i}.jpg`, 'image/jpeg')), 0);
  assert.equal(fotos.fotos.length, 8); assert.equal(fotos.errores.filter(e => e.error === 'maxFotos').length, 2);
  assert.equal(clasificarFicheros([f('x.jpg', 'image/jpeg')], 8).errores[0].error, 'maxFotos');
  assert.deepEqual(clasificarFicheros([f('plano.pdf', 'application/pdf'), f('sin-tipo.HEIC', '')]).fotos.map(x => x.name), ['sin-tipo.HEIC']);
});

test('errores del worker → mensaje claro', () => {
  assert.equal(claveError(429, { error: 'limite', motivo: 'ip' }), 'phLimitIp');
  assert.equal(claveError(429, { error: 'limite', motivo: 'dia' }), 'phLimitDay');
  assert.equal(claveError(413, null), 'phTooBig');
  assert.equal(claveError(403, { error: 'origen-no-permitido' }), 'phOrigin');
  assert.equal(claveError(504, { error: 'gemini-sin-respuesta' }), 'phTimeout');
  assert.equal(claveError(502, { error: 'estimacion-no-valida' }), 'phInvalid');
  assert.equal(claveError(503, { error: 'gemini-saturado' }), 'phBusy');
  assert.equal(claveError(500, null), 'phError');
  assert.equal(claveError(429, { error: 'cupo-no-disponible' }), 'phQuotaDown');
  assert.equal(claveError(429, { error: 'limite', motivo: 'coste' }), 'phLimitDay');
  assert.equal(claveError(403, { error: 'desactivado' }), 'phOff');
  assert.equal(claveError(403, { error: 'origen-no-permitido' }), 'phOrigin');
  // El origen se comprueba antes de llamar: desde otro dominio, «origen no permitido», no «sin red».
  for (const o of ['https://www.admira.biz', 'https://admira.store', 'http://localhost:8765']) assert.ok(origenEstimador(o), o);
  for (const o of ['https://www.clearchannel.tv', 'https://www.admira.app', 'https://evil.example', 'http://localhost.evil.example']) assert.ok(!origenEstimador(o), o);
});

test('la estimación se convierte en elementos del generador; lo vacío no se pasa', () => {
  const e = elementosDeEstimacion(RESPUESTA.estimacion, 'Gemini 3.1 Pro');
  assert.equal(e.huecos.length, 2); assert.equal(e.huecos[1].nombre, 'Puerta');
  assert.deepEqual(e.mobiliario.map(m => m.id), ['est-m-1', 'est-m-2']);
  assert.deepEqual(e.pantallas.map(p => p.corto), ['E1', 'E2', 'E3', 'E4']);
  assert.equal(e.pantallas[0].fuente, 'Estimada desde fotos · Gemini 3.1 Pro');
  const vacio = elementosDeEstimacion({ ...RESPUESTA.estimacion, huecos: [], mobiliario: [], pantallas: [] });
  assert.deepEqual(vacio, { huecos: null, mobiliario: null, pantallas: null });
});

test('plano estimado: válido, con lo visto tal cual y la fuente «estimado desde fotos», nunca «levantamiento»', () => {
  const plan = planoDesdeEstimacion({ respuesta: RESPUESTA, tipo: 'laboratorio', id: 'lab-gran-de-gracia-51', nombre: 'Laboratorio', semilla: 7 });
  assert.equal(leerPlanoJson(JSON.stringify(plan), 'x').ok, true);
  assert.deepEqual([plan.planta.ancho, plan.planta.fondo, plan.planta.alto], [2.8, 3.5, 2.8]);
  assert.equal(plan.fuente.titulo, 'Plano estimado desde fotos · Gemini 3.1 Pro · confianza 60 %');
  assert.ok(!/levantamiento/i.test(JSON.stringify(plan.fuente)));
  assert.match(plan.fuente.medidas, /Baldosa de suelo/);
  assert.equal(plan.pantallas.filter(p => p.estado === 'estimada').length, 4, 'las cuatro pantallas vistas, tal cual');
  assert.ok(plan.pantallas.every(p => p.itil === null));
  assert.equal(plan.huecos.filter(h => h.tipo === 'puerta').length, 2, 'no se inventa otra puerta');
  assert.equal(plan.mobiliario.length, 2, 'con muebles vistos no se inventan más');
  // El portátil (15″) y el monitor vertical se pisaban: se separan lo justo (en cadena, unos
  // centímetros cada una) y el plano no da errores.
  assert.equal(plan.generador.estimacion.ajustadas, 3);
  const ss = plan.pantallas.filter(p => p.estado === 'estimada').map(p => p.s);
  assert.equal(ss[0], 0.8); assert.ok(ss.every((x, i) => !i || x > ss[i - 1]));
  assert.deepEqual(validate(plan).filter(i => i.nivel === 'error'), []);
  assert.equal(plan.generador.estimacion.modelo, 'gemini-3.1-pro-preview');
  assert.equal(plan.generador.estimacion.confianza.global, 0.6);
  assert.match(plan.version, /^estimado-laboratorio-7$/);
  const r = resumenEstimado(plan);
  assert.deepEqual([r.pantallasEstimadas, r.mueblesEstimados, r.huecosEstimados, r.fotos], [4, 2, 2, 8]);
});

test('desolapar: separa en orden sin salirse de la pared y deja quietas las que no se pisan', () => {
  const p = (s, z = 1, pulgadas = 27, orientacion = 'horizontal') => ({ pared: 'F', s, z, pulgadas, orientacion });
  const lista = [p(1.0), p(1.2), p(3.0, 2.5)];
  assert.equal(desolaparPantallas(lista, { F: 4 }), 1);
  assert.ok(lista[1].s - lista[0].s >= 0.6);
  assert.equal(lista[2].s, 3.0, 'la que está más arriba no se toca');
  const borde = [p(3.5), p(3.6)];
  desolaparPantallas(borde, { F: 4 });
  assert.ok(borde[1].s + 0.299 <= 4 + 1e-3 && borde[1].s - borde[0].s >= 0.598 + 0.06 - 1e-3, String(borde.map(x => x.s)));
});

test('sin pantallas vistas, el generador pone las típicas del tipo en propuesta; la simulada se dice', () => {
  const respuesta = { ...RESPUESTA, simulada: true, estimacion: { ...RESPUESTA.estimacion, pantallas: [], mobiliario: [] } };
  const plan = planoDesdeEstimacion({ respuesta, tipo: 'cafeteria', id: 'cafe-x', semilla: 3 });
  assert.ok(plan.pantallas.length > 0 && plan.pantallas.every(p => p.estado === 'propuesta'));
  assert.ok(plan.mobiliario.length > 0);
  assert.match(plan.fuente.titulo, /respuesta simulada$/);
  assert.match(plan.fuente.pantallas, /típicas? del tipo en propuesta/);
  assert.equal(plan.generador.estimacion.simulada, true);
  assert.throws(() => planoDesdeEstimacion({ respuesta: { ok: true, estimacion: { ancho: 3 } } }));
});

test('«Con foto o vídeo» funciona en la página: sin «próximamente» y publicado en admira.biz', () => {
  assert.ok(BIZ_ASSET_FILES.includes('plano-foto.mjs'));
  const html = readFileSync(new URL('../plano.html', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../plano.mjs', import.meta.url), 'utf8');
  assert.match(page, /plano-foto\.mjs\?v=20261014-foto-2/);
  assert.match(html, /plano\.mjs\?v=20261014-foto-2/);
  assert.match(html, /id="photo-file"[^>]*multiple/);
  assert.match(html, /id="photo-estimate"/);
  assert.doesNotMatch(html, /Próximamente · todavía no funciona/);
  assert.doesNotMatch(page, /crSoon/);
});
