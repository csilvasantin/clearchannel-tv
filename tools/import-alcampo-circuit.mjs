#!/usr/bin/env node
// Circuito Alcampo (FLT-100351 · misión Yokup #3192): 36 supermercados geolocalizados
// (Zaragoza, Logroño, Burgos, Madrid…) + los 3 hipermercados catalanes que ya tenían
// pantalla en la parrilla (alcampo-esplugues, alcampo-vilanova, alcampo-salt).
//
// Uso:
//   node tools/import-alcampo-circuit.mjs               → escribe la semilla y resume
//   node tools/import-alcampo-circuit.mjs --json        → imprime las 39 ubicaciones
//   OMNIP_ADMIN_TOKEN=… node tools/import-alcampo-circuit.mjs --publish
//        → GET /locations (copia previa en ALCAMPO_DIR/kv-locations-backup-<fecha>.json)
//          → unión por id (sustituye alcampo-*, conserva todo lo demás) → PUT /locations
//
// Patrón: tools/import-desigual-circuit.mjs (toOmniLocation + surfacesFor + --publish).

import fs from 'node:fs';
import path from 'node:path';

// Dominio propio: LaLiga bloquea workers.dev/r2.dev en horas de fútbol (FLT-1633).
const OMNIP_API = process.env.OMNIP_API || 'https://brain.digitalavatar.ai';
const ADMIN_TOKEN = process.env.OMNIP_ADMIN_TOKEN || '';
const ALCAMPO_DIR = process.env.ALCAMPO_DIR || '/Users/Carlos/Claude/alcampo';
const GEO_FILE = process.env.ALCAMPO_GEO || path.join(ALCAMPO_DIR, 'alcampo-36-geo.json');
const OFICIAL_FILE = process.env.ALCAMPO_OFICIAL || path.join(ALCAMPO_DIR, 'alcampo-tiendas-oficial.json');
const SEED_FILE = process.env.ALCAMPO_SEED || path.join(ALCAMPO_DIR, 'alcampo-circuit-seed.json');
const SHOULD_PUBLISH = process.argv.includes('--publish');
const SHOULD_PRINT_JSON = process.argv.includes('--json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Nombre bonito por tienda (el Excel viene en mayúsculas sin acentos; el " 2" final es
// un índice interno de Alcampo, no parte del nombre).
const PRETTY_NAMES = {
  'ANDRES VICENTE': 'Andrés Vicente', 'DELICIAS 22': 'Delicias', 'CESAR AUGUSTO': 'César Augusto',
  'OLIVA DE PLASENCIA 2': 'Oliva de Plasencia', 'LA ALMOZARA': 'La Almozara', 'LAS FUENTES': 'Las Fuentes',
  'ALCORCON 2': 'Alcorcón', 'TUDELA': 'Tudela', 'GLORIETA': 'Glorieta', 'AVENIDA MADRID': 'Avenida Madrid',
  'COSCULLUELA': 'Cosculluela', 'VILLIMAR': 'Villímar', 'AVENIDA': 'Avenida', 'FERNANDO CATOLICO': 'Fernando el Católico',
  'TENOR FLETA': 'Tenor Fleta', 'SARMIENTO': 'Sarmiento', 'PUENTE VIRREY': 'Puente Virrey', 'TRES CANTOS': 'Tres Cantos',
  'CALVO SOTELO': 'Calvo Sotelo', '12 DE OCTUBRE': 'Doce de Octubre', 'LA PINEDA': 'La Pineda',
  'LAS PROVINCIAS 2': 'Las Provincias', 'GAMONAL': 'Gamonal', 'PASEO DE LA ESPERANZA': 'Paseo de la Esperanza',
  'MENDEZ ALVARO 2': 'Méndez Álvaro', 'EDGAR NEVILLE': 'Edgar Neville', 'JUAN PABLO BONET': 'Juan Pablo Bonet',
  'CIGUEÑA': 'Cigüeña', 'LORCA': 'Lorca', 'TORRERO': 'Torrero', 'VALCUERNA': 'Valcuerna', 'BRETON': 'Bretón',
  'SAMBIL 2': 'Sambil', 'PROGRESO': 'Progreso', 'AVILA': 'Ávila', 'LIBERTAD': 'Libertad',
};

// Hipermercados catalanes ya presentes en api.admira.store/grid/screens (circuit:"alcampo").
// Sus coordenadas salen de la fuente oficial (store-locator Woosmap de Alcampo).
const HYPERS = [
  { id: 'alcampo-esplugues', ciudad: 'Esplugues de Llobregat', provincia: 'Barcelona', match: 'Esplugues' },
  { id: 'alcampo-vilanova', ciudad: 'Vilanova i la Geltrú', provincia: 'Barcelona', match: 'Vilanova' },
  { id: 'alcampo-salt', ciudad: 'Salt', provincia: 'Girona', match: 'Salt' },
];

// Orden del recorrido DOOH: por ciudad (Zaragoza → Logroño → Burgos → Madrid → resto,
// con Cataluña al final) y dentro de cada ciudad por nombre.
const CITY_ORDER = ['Zaragoza', 'Logroño', 'Burgos', 'Madrid'];

function cityRank(city) {
  const i = CITY_ORDER.indexOf(city);
  return i >= 0 ? i : CITY_ORDER.length;
}

function cleanAddr(s) {
  return String(s || '').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
}

// Estimación de impresiones/día de la pantalla de caja por formato de tienda.
function imprFor(format) {
  if (format === 'hiper') return 900;
  if (/supermercado/i.test(format)) return 800;
  if (/^mi alcampo/i.test(format)) return 450;
  return 650;
}

function surfacesFor(format) {
  const caja = imprFor(format);
  return [
    { name: 'Pantalla caja', desc: 'Pantalla vertical 9:16 en línea de cajas', status: 'sched', impr: caja, cpm: '€6', surface: 'pantalla' },
    { name: 'Escaparate', desc: 'Pantalla de escaparate a pie de calle, entrada del supermercado', status: 'idle', impr: Math.round(caja * 0.6), cpm: '€4', surface: 'escaparate' },
  ];
}

function toOmniLocation(store) {
  const lng = Number(store.lng);
  const lat = Number(store.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const pretty = PRETTY_NAMES[store.nombre_excel] || store.nombre_excel;
  const format = String(store.nombre_maps || 'Alcampo');
  return {
    id: store.slug,
    name: `Alcampo Supermercado ${pretty}`,
    kind: 'Supermercado · Alcampo · Circuito DOOH',
    addr: [cleanAddr(store.direccion), store.ciudad, store.cp].filter(Boolean).join(' · '),
    coords: [lng, lat],
    music: 'retail',
    cameras: false,
    city: store.ciudad,
    external: { brand: 'Alcampo', storeId: store.store_id_alcampo || null, network: 'alcampo espana', source: 'alcampo-36-geo' },
    alcampo: {
      store_id: store.store_id_alcampo || null,
      place_id: store.place_id || null,
      maps_url: store.maps_url || null,
      nombre_excel: store.nombre_excel,
      formato: format,
      confianza: store.confianza || 'alta',
      motivo: store.motivo || '',
    },
    surfaces: surfacesFor(format),
  };
}

function hyperLocation(def, feature) {
  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  return {
    id: def.id,
    name: `Alcampo ${def.ciudad}`,
    kind: 'Hipermercado · Alcampo · Circuito DOOH',
    addr: [cleanAddr((p.address.lines || []).filter(l => l && l !== 'n').join(', ')), p.address.city, p.address.zipcode].filter(Boolean).join(' · '),
    coords: [Number(lng), Number(lat)],
    music: 'retail',
    cameras: false,
    city: def.ciudad,
    external: { brand: 'Alcampo', storeId: p.store_id, network: 'alcampo espana', source: 'alcampo-store-locator' },
    alcampo: {
      store_id: p.store_id,
      place_id: p.user_properties?.mapsPlaceId || null,
      maps_url: p.user_properties?.mapsUri || null,
      nombre_excel: null,
      formato: 'hiper',
      confianza: 'alta',
      motivo: 'Hipermercado ya registrado en la parrilla; coordenadas de la fuente oficial',
    },
    surfaces: surfacesFor('hiper'),
  };
}

function findHyperFeature(features, def) {
  const hits = features.filter(f => {
    const p = f.properties || {};
    const city = String(p.address?.city || '');
    return /^sup_/.test(p.store_id || '') && new RegExp(def.match, 'i').test(city);
  });
  if (!hits.length) throw new Error(`Sin hipermercado oficial para ${def.id} (${def.match})`);
  return hits[0];
}

function sortForTour(items) {
  return items.slice().sort((a, b) => {
    const r = cityRank(a.city) - cityRank(b.city);
    if (r) return r;
    const c = String(a.city).localeCompare(String(b.city), 'es');
    if (c) return c;
    return a.name.localeCompare(b.name, 'es');
  });
}

function buildAlcampoLocations() {
  const geo = JSON.parse(fs.readFileSync(GEO_FILE, 'utf8'));
  const oficial = JSON.parse(fs.readFileSync(OFICIAL_FILE, 'utf8'));
  const stores = Array.isArray(geo) ? geo : geo.tiendas;
  const supers = stores.map(toOmniLocation).filter(Boolean);
  const hypers = HYPERS.map(def => hyperLocation(def, findHyperFeature(oficial.features, def)));
  const all = sortForTour(supers.concat(hypers));
  const seen = new Set();
  for (const loc of all) {
    if (!/^alcampo-[a-z0-9-]+$/.test(loc.id)) throw new Error(`id inválido: ${loc.id}`);
    if (seen.has(loc.id)) throw new Error(`id duplicado: ${loc.id}`);
    seen.add(loc.id);
  }
  return all;
}

async function loadCurrentOmniCatalog() {
  const res = await fetch(`${OMNIP_API}/locations`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Omni catalog HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (Array.isArray(data.locations) ? data.locations : []);
}

async function publishCatalog(locations) {
  if (!ADMIN_TOKEN) throw new Error('Set OMNIP_ADMIN_TOKEN before using --publish');
  const res = await fetch(`${OMNIP_API}/locations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}`, 'User-Agent': UA },
    body: JSON.stringify({ locations }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Publish failed HTTP ${res.status}: ${data.error || 'unknown_error'}`);
  return data;
}

const alcampoLocations = buildAlcampoLocations();
fs.writeFileSync(SEED_FILE, JSON.stringify(alcampoLocations, null, 1));

const summary = {
  alcampoLocations: alcampoLocations.length,
  supermercados: alcampoLocations.filter(l => l.alcampo.formato !== 'hiper').length,
  hipermercados: alcampoLocations.filter(l => l.alcampo.formato === 'hiper').length,
  confianza: alcampoLocations.reduce((acc, l) => { acc[l.alcampo.confianza] = (acc[l.alcampo.confianza] || 0) + 1; return acc; }, {}),
  seedFile: SEED_FILE,
  published: false,
};

if (SHOULD_PUBLISH) {
  const current = await loadCurrentOmniCatalog();
  if (current.length < 1000) throw new Error(`El catálogo actual solo tiene ${current.length} ubicaciones: no se publica (¿KV vacío o respuesta parcial?)`);
  const stamp = new Date().toISOString().slice(0, 10);
  const backupFile = path.join(ALCAMPO_DIR, `kv-locations-backup-${stamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ locations: current }));
  const withoutAlcampo = current.filter(loc => !/^alcampo-/i.test(String(loc.id || '')));
  const merged = withoutAlcampo.concat(alcampoLocations);
  await publishCatalog(merged);
  const after = await loadCurrentOmniCatalog();
  Object.assign(summary, {
    published: true,
    backupFile,
    currentLocations: current.length,
    replacedAlcampo: current.length - withoutAlcampo.length,
    mergedLocations: merged.length,
    liveLocations: after.length,
    liveAlcampo: after.filter(loc => /^alcampo-/i.test(String(loc.id || ''))).length,
  });
}

if (SHOULD_PRINT_JSON) {
  console.log(JSON.stringify({ summary, locations: alcampoLocations }, null, 2));
} else {
  console.log(JSON.stringify(summary, null, 2));
}
