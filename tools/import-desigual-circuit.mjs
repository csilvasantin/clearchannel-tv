#!/usr/bin/env node

const OMNIP_API = process.env.OMNIP_API || 'https://omnipublicity-api.csilvasantin.workers.dev';
const ADMIN_TOKEN = process.env.OMNIP_ADMIN_TOKEN || '';
const DEFAULT_RADIUS_KM = Number(process.env.DESIGUAL_RADIUS_KM || 75);
const SHOULD_PUBLISH = process.argv.includes('--publish');
const SHOULD_PRINT_JSON = process.argv.includes('--json');

const DEFAULT_SEEDS = [
  ['es_ES', 'Barcelona', 41.3874, 2.1686, 60],
  ['es_ES', 'Madrid', 40.4168, -3.7038, 60],
  ['es_ES', 'Valencia', 39.4699, -0.3763, 55],
  ['es_ES', 'Sevilla', 37.3891, -5.9845, 55],
  ['es_ES', 'Bilbao', 43.263, -2.935, 55],
  ['es_ES', 'Malaga', 36.7213, -4.4214, 55],
  ['es_ES', 'Palma', 39.5696, 2.6502, 55],
  ['fr_FR', 'Paris', 48.8566, 2.3522, 85],
  ['fr_FR', 'Lyon', 45.764, 4.8357, 75],
  ['fr_FR', 'Marseille', 43.2965, 5.3698, 75],
  ['it_IT', 'Milano', 45.4642, 9.19, 85],
  ['it_IT', 'Roma', 41.9028, 12.4964, 85],
  ['pt_PT', 'Lisboa', 38.7223, -9.1393, 75],
  ['pt_PT', 'Porto', 41.1579, -8.6291, 75],
  ['de_DE', 'Berlin', 52.52, 13.405, 100],
  ['de_DE', 'Munich', 48.1351, 11.582, 100],
  ['en_GB', 'London', 51.5072, -0.1276, 100],
  ['en_US', 'New York', 40.7128, -74.006, 120],
  ['en_US', 'Miami', 25.7617, -80.1918, 120],
  ['es_MX', 'Mexico City', 19.4326, -99.1332, 120],
].map(([locale, label, latitude, longitude, radius]) => ({locale, label, latitude, longitude, radius}));

function parseExtraSeeds() {
  const raw = process.env.DESIGUAL_SEEDS_JSON;
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('DESIGUAL_SEEDS_JSON must be an array');
  return parsed.map(seed => ({
    locale: seed.locale,
    label: seed.label || `${seed.latitude},${seed.longitude}`,
    latitude: Number(seed.latitude),
    longitude: Number(seed.longitude),
    radius: Number(seed.radius || DEFAULT_RADIUS_KM),
  }));
}

function endpointForLocale(locale) {
  const country = String(locale || '').split('_')[1];
  if (!country) throw new Error(`Invalid locale: ${locale}`);
  return `https://www.desigual.com/on/demandware.store/Sites-dsglcom_prod_${country.toLowerCase()}-Site/${locale}/Address-SearchStoreAddress`;
}

async function fetchDesigualSeed(seed) {
  const url = new URL(endpointForLocale(seed.locale));
  url.searchParams.set('latitude', String(seed.latitude));
  url.searchParams.set('longitude', String(seed.longitude));
  url.searchParams.set('radius', String(seed.radius || DEFAULT_RADIUS_KM));
  url.searchParams.set('deliveryPoint', 'STORE');
  const res = await fetch(url, {headers:{Accept:'application/json'}});
  if (!res.ok) throw new Error(`${seed.locale}/${seed.label}: HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.shippingAddresses) ? data.shippingAddresses : [];
}

function surfacesFor(type) {
  const outlet = type === 'outlet';
  return [
    { name: outlet ? 'Escaparate outlet' : 'Escaparate flagship', desc: 'Surface exterior para creatividades de moda, rebajas y lanzamientos por zona', status:'live', impr: outlet ? 520 : 720, cpm: outlet ? '€6' : '€9', surface:'escaparate' },
    { name: 'Pantalla interior', desc: 'Digital signage en sala de venta · colecciones, looks y campañas contextuales', status:'live', impr: outlet ? 360 : 460, cpm: outlet ? '€5' : '€7', surface:'pantalla' },
    { name: 'Caja y probadores', desc: 'Impacto de cierre de compra, cross-sell y registro en club', status:'live', impr: outlet ? 140 : 180, cpm: outlet ? '€4' : '€5', surface:'mostrador' },
    { name: 'PWA Desigual Club', desc: 'Push de proximidad para socios, wishlist y promociones por tienda', status:'live', impr: outlet ? 180 : 260, cpm:'€3', surface:'pwa' },
  ];
}

function toOmniLocation(store) {
  const storeId = String(store.storeId || store.id || '').trim();
  const name = String(store.name || '').replace(/\s+/g, ' ').trim();
  const type = String(store.type || 'official').toLowerCase();
  const longitude = Number(store.longitude);
  const latitude = Number(store.latitude);
  if (!storeId || !name || !/desigual/i.test(name)) return null;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  const addr = [store.address, store.city, store.postalCode, store.region, store.countryName].filter(Boolean).join(' · ');
  return {
    id: `desigual-${storeId.toLowerCase()}`,
    name,
    kind: type === 'outlet' ? 'Desigual · Outlet' : 'Desigual · Tienda oficial',
    addr,
    coords: [longitude, latitude],
    music: 'fashion',
    cameras: true,
    external: {
      brand: 'Desigual',
      storeId,
      type,
      countryCode: store.countryCode || null,
      detailUrl: store.detailUrl || null,
      source: 'desigual-store-locator',
    },
    surfaces: surfacesFor(type),
  };
}

function uniqById(locations) {
  const out = [];
  const seen = new Set();
  for (const loc of locations) {
    if (!loc || !loc.id || seen.has(loc.id)) continue;
    seen.add(loc.id);
    out.push(loc);
  }
  return out;
}

async function loadCurrentOmniCatalog() {
  const res = await fetch(`${OMNIP_API}/locations`, {headers:{Accept:'application/json'}});
  if (!res.ok) throw new Error(`Omni catalog HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.locations) ? data.locations : [];
}

async function publishCatalog(locations) {
  if (!ADMIN_TOKEN) throw new Error('Set OMNIP_ADMIN_TOKEN before using --publish');
  const res = await fetch(`${OMNIP_API}/locations`, {
    method: 'PUT',
    headers: {'Content-Type':'application/json', Authorization:`Bearer ${ADMIN_TOKEN}`},
    body: JSON.stringify({locations}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Publish failed HTTP ${res.status}: ${data.error || 'unknown_error'}`);
  return data;
}

const seeds = DEFAULT_SEEDS.concat(parseExtraSeeds());
const fetched = [];
const failures = [];

for (const seed of seeds) {
  try {
    const stores = await fetchDesigualSeed(seed);
    fetched.push(...stores.map(toOmniLocation).filter(Boolean));
  } catch (err) {
    failures.push({seed: `${seed.locale}/${seed.label}`, error: String(err.message || err)});
  }
}

const desigualLocations = uniqById(fetched).sort((a, b) => a.name.localeCompare(b.name));
const current = await loadCurrentOmniCatalog();
const withoutDesigual = current.filter(loc => !/^desigual-/i.test(String(loc.id || '')));
const merged = withoutDesigual.concat(desigualLocations);

if (SHOULD_PUBLISH) await publishCatalog(merged);

const summary = {
  seeds: seeds.length,
  desigualLocations: desigualLocations.length,
  currentLocations: current.length,
  mergedLocations: merged.length,
  published: SHOULD_PUBLISH,
  failures,
};

if (SHOULD_PRINT_JSON) {
  console.log(JSON.stringify({summary, locations: desigualLocations}, null, 2));
} else {
  console.log(JSON.stringify(summary, null, 2));
}
