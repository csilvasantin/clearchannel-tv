#!/usr/bin/env node
// Buzones de Correos fuera del catálogo (Morfeo, 29-oct-2026 · estado de los circuitos Biz, prioridad 1). El circuito
// Correos · España se importó de OpenStreetMap (external.source «overpass-osm») y se trajo también los buzones de calle
// (amenity=post_box): 3.167 Xpacios «Correos Oficina» con la dirección «Correos · post_box», sin calle ni ciudad, cada
// uno con tres superficies que no existen (pantalla de turno, escaparate y taquillas). Son 9.501 superficies y unas
// 2,79 M de impresiones al día, el 28 % del catálogo. Las oficinas (post_office) y los CityPaq (parcel_locker) se quedan.
//
// Uso:
//   node tools/quitar-buzones-correos.mjs                         → en seco: baja el catálogo, cuenta y no escribe nada
//   node tools/quitar-buzones-correos.mjs --informe=<ruta.json>   → en seco, y guarda la lista de lo que se quitaría
//   OMNIP_ADMIN_TOKEN=… node tools/quitar-buzones-correos.mjs --publish
//        → GET /locations (copia previa en OMNIP_BACKUP_DIR/locations-<fecha>-pre-quitar-buzones.json)
//          → quita los buzones → vuelve a pedir el catálogo y, si alguien ha escrito entretanto, para sin escribir
//          → PUT /locations → comprueba que el KV ya no tiene ninguno
//   OMNIP_ADMIN_TOKEN=… node tools/quitar-buzones-correos.mjs --restaurar=<copia.json>
//        → vuelta atrás: añade al catálogo de ahora los buzones de la copia (unión por id, sin pisar lo escrito después)
//
// Patrón: tools/import-alcampo-circuit.mjs (OMNIP_API, OMNIP_ADMIN_TOKEN, --publish y copia previa).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Dominio propio: LaLiga bloquea workers.dev/r2.dev en horas de fútbol (FLT-1633).
const OMNIP_API = process.env.OMNIP_API || 'https://brain.digitalavatar.ai';
const ADMIN_TOKEN = process.env.OMNIP_ADMIN_TOKEN || '';
const BACKUP_DIR = process.env.OMNIP_BACKUP_DIR || path.join(os.homedir(), 'Documents/Admirito/backups');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Topes de seguridad: el 29-oct son 3.167 buzones en un catálogo de 9.140. Si el filtro cogiera muchos más, o el
// catálogo llegara medio vacío, algo ha cambiado en la fuente y no se escribe.
export const MAX_QUITAR = 3500;
export const MIN_QUEDAN = 5000;

// Un buzón: Xpacio de Correos importado de OSM cuya dirección acaba en la etiqueta «post_box». No se toca nada con
// gemelo ni ningún alta propia de la flota (selfReg), aunque la dirección lo pareciera.
export function esBuzonCorreos(loc) {
  if (!loc || typeof loc !== 'object') return false;
  if (!String(loc.id || '').startsWith('correos-')) return false;
  if (!loc.external || loc.external.brand !== 'Correos') return false;
  if (loc.twin || loc.selfReg) return false;
  return /(^|·)\s*post_box\s*$/.test(String(loc.addr || ''));
}

export function quitarBuzones(locations) {
  const quedan = [], quitados = [];
  for (const loc of locations) (esBuzonCorreos(loc) ? quitados : quedan).push(loc);
  const superficies = quitados.reduce((n, l) => n + (Array.isArray(l.surfaces) ? l.surfaces.length : 0), 0);
  const impresiones = quitados.reduce((n, l) => n + (Array.isArray(l.surfaces) ? l.surfaces : []).reduce((m, s) => m + (Number(s && s.impr) || 0), 0), 0);
  const correos = l => String(l.id || '').startsWith('correos-');
  return {
    quedan, quitados,
    resumen: { antes: locations.length, despues: quedan.length, quitados: quitados.length, superficies, impresiones,
      correosAntes: locations.filter(correos).length, correosDespues: quedan.filter(correos).length },
  };
}

export function comprobarRetirada({ resumen }) {
  if (!resumen.quitados) throw new Error('No hay buzones que quitar: el catálogo ya está limpio');
  if (resumen.quitados > MAX_QUITAR) throw new Error(`Saldrían ${resumen.quitados} Xpacios (tope ${MAX_QUITAR}): revisa el filtro antes de escribir`);
  if (resumen.despues < MIN_QUEDAN) throw new Error(`Quedarían ${resumen.despues} Xpacios (mínimo ${MIN_QUEDAN}): el catálogo ha llegado incompleto`);
}

// Vuelta atrás: los buzones de la copia que no estén ahora en el catálogo, añadidos al final.
export function restaurarBuzones(actuales, copia) {
  const ids = new Set(actuales.map(l => l && l.id));
  const vuelven = copia.filter(l => esBuzonCorreos(l) && !ids.has(l.id));
  return { locations: actuales.concat(vuelven), vuelven: vuelven.length };
}

async function leerCatalogo() {
  const res = await fetch(`${OMNIP_API}/locations`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET /locations HTTP ${res.status}`);
  const data = await res.json();
  const locations = Array.isArray(data) ? data : (data.locations || []);
  if (data.source && data.source !== 'kv') throw new Error(`El catálogo no viene del KV (source=${data.source})`);
  return { locations, updatedAt: data.updatedAt ?? null };
}

async function escribirCatalogo(locations) {
  if (!ADMIN_TOKEN) throw new Error('Define OMNIP_ADMIN_TOKEN antes de usar --publish o --restaurar');
  const res = await fetch(`${OMNIP_API}/locations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}`, 'User-Agent': UA },
    body: JSON.stringify({ locations }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PUT /locations HTTP ${res.status}: ${data.error || 'unknown_error'}`);
  return data;
}

const fmt = n => Number(n).toLocaleString('es-ES');

async function main(argv) {
  const opcion = nombre => (argv.find(a => a.startsWith(`--${nombre}=`)) || '').split('=').slice(1).join('=');
  const restaurar = opcion('restaurar');
  if (restaurar) {
    const copia = JSON.parse(fs.readFileSync(restaurar, 'utf8'));
    const { locations } = await leerCatalogo();
    const r = restaurarBuzones(locations, Array.isArray(copia) ? copia : copia.locations || []);
    if (!r.vuelven) return console.log('La copia no trae buzones que falten: nada que restaurar');
    const out = await escribirCatalogo(r.locations);
    return console.log(`Restaurados ${fmt(r.vuelven)} buzones: el catálogo vuelve a ${fmt(out.count)} Xpacios`);
  }

  const antes = await leerCatalogo();
  const r = quitarBuzones(antes.locations);
  const s = r.resumen;
  console.log(`Catálogo: ${fmt(s.antes)} Xpacios (updatedAt ${antes.updatedAt})`);
  console.log(`Buzones de Correos: ${fmt(s.quitados)} Xpacios, ${fmt(s.superficies)} superficies, ${fmt(s.impresiones)} impresiones al día`);
  console.log(`Después: ${fmt(s.despues)} Xpacios; Correos pasa de ${fmt(s.correosAntes)} a ${fmt(s.correosDespues)}`);
  const informe = opcion('informe');
  if (informe) {
    fs.writeFileSync(informe, JSON.stringify({ resumen: s, updatedAt: antes.updatedAt, quitados: r.quitados.map(l => ({ id: l.id, addr: l.addr, coords: l.coords })) }, null, 1));
    console.log(`Lista en ${informe}`);
  }
  comprobarRetirada(r);
  if (!argv.includes('--publish')) return console.log('En seco: no se ha escrito nada. Con --publish (y OMNIP_ADMIN_TOKEN) se aplica.');

  if (!ADMIN_TOKEN) throw new Error('Define OMNIP_ADMIN_TOKEN antes de usar --publish');
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const copia = path.join(BACKUP_DIR, `locations-${new Date().toISOString().slice(0, 10)}-pre-quitar-buzones.json`);
  fs.writeFileSync(copia, JSON.stringify({ locations: antes.locations, updatedAt: antes.updatedAt }));
  console.log(`Copia previa: ${copia}`);
  // PUT reescribe el catálogo entero: si alguien ha escrito desde la primera lectura, su cambio se perdería.
  const ahora = await leerCatalogo();
  if (ahora.updatedAt !== antes.updatedAt) throw new Error('El catálogo ha cambiado mientras tanto: no se escribe; vuelve a lanzarlo');
  const out = await escribirCatalogo(r.quedan);
  const despues = await leerCatalogo();
  const restan = despues.locations.filter(esBuzonCorreos).length;
  console.log(`Escrito: ${fmt(out.count)} Xpacios; el KV sirve ${fmt(despues.locations.length)} y ${fmt(restan)} buzones`);
  if (restan || despues.locations.length !== r.quedan.length) throw new Error('El KV no sirve lo escrito: compruébalo antes de seguir');
  console.log(`Vuelta atrás: node tools/quitar-buzones-correos.mjs --restaurar=${copia}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch(e => { console.error('✗ ' + e.message); process.exit(1); });
}
