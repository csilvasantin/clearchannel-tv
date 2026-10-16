// Altadis España · 10 Xtancos (DCL-a6cb621be0ce5932f50960de, Carlos, 16-oct-2026): la misma demo que las
// 10 cafeterías de Alsea México, con otro cliente y otro look and feel. Un estanco real por ciudad, en orden
// de tour, cada uno con un formato de pantalla Altadis distinto. Escribe, sin red y sin azar:
//   data/circuitos/circuito-altadis-espana-10.seed.json   la semilla (mismo esquema que la de Alsea México)
//   data/xpacios/altadis-espana-10.json                   el índice público (admira.circuito-demo/1) para el gemelo
//   locations.js (bloque <altadis-espana>)                 los 10 puntos en OMNIP_LOCATIONS_EXTRA, sin tocar el KV
// Las pantallas salen del plano compartido de su formato (data/xpacios/altadis-xtanco-NN.json): no se inventan.
// Los estancos son nodos shop=tobacco de OpenStreetMap (Overpass, 16-oct-2026) con la dirección de sus etiquetas
// addr:* o, si no las tienen, la del punto de dirección de Nominatim a menos de 5 m. Ninguno sale del circuito
// de JTI (circuito-jti-xtanco-100, xtancos-100.csv): JTI es competidor de Altadis (encargo #4969).
// Regenerar: node tools/genera-altadis-espana.mjs · Comprobar sin escribir: node tools/genera-altadis-espana.mjs --comprobar
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const CIRCUITO = 'altadis_espana';
export const MARCA = 'altadis';
export const RUTA_SEED = 'data/circuitos/circuito-altadis-espana-10.seed.json';
export const RUTA_INDICE = 'data/xpacios/altadis-espana-10.json';
export const RUTA_LOCATIONS = 'locations.js';
const INICIO = '// <altadis-espana> generado por tools/genera-altadis-espana.mjs: no editar a mano';
const FIN = '// </altadis-espana>';

const OSM = 'openstreetmap shop=tobacco (Overpass API, 16-oct-2026)';
const NOMINATIM = 'dirección: punto de dirección de Nominatim a menos de 5 m (16-oct-2026)';
const ETIQUETAS = 'dirección: etiquetas addr:* del nodo';
// Orden de tour, formato Altadis asignado y estanco real de cada ciudad.
export const ESTANCOS = [
  {n: 1, slug: 'a-coruna', ciudad: 'A Coruña', provincia: 'A Coruña', region: 'Galicia', corto: 'LCG', formato: 7,
    nombre: 'Estanco Riego de Agua', calle: 'Rúa Rego da Auga 40', cp: '15001',
    coords: [-8.398132, 43.3706048], osm: 'node/5633143391', fuente: ETIQUETAS},
  {n: 2, slug: 'bilbao', ciudad: 'Bilbao', provincia: 'Bizkaia', region: 'País Vasco', corto: 'BIO', formato: 17,
    nombre: 'Estanco Exp. nº 2 · Bidebarrieta', calle: 'Calle Bidebarrieta 2', cp: '48005',
    coords: [-2.9246562, 43.2589959], osm: 'node/4703389822', fuente: NOMINATIM},
  // Barcelona: el mismo estanco real que altadis-bcn-001 (circuito altadis_bcn, que no se toca).
  {n: 3, slug: 'barcelona', ciudad: 'Barcelona', provincia: 'Barcelona', region: 'Cataluña', corto: 'BCN', formato: 1,
    nombre: 'Estanc Gran de Gràcia 61', calle: 'Carrer Gran de Gràcia 61', cp: '08012',
    coords: [2.155556, 41.3996304], osm: 'node/12875861930', fuente: 'dirección y nombre: altadis-bcn-001 (circuito-altadis-bcn-9.seed.json)'},
  {n: 4, slug: 'zaragoza', ciudad: 'Zaragoza', provincia: 'Zaragoza', region: 'Aragón', corto: 'ZAZ', formato: 16,
    nombre: 'Estanco nº 53 · San Ignacio de Loyola', calle: 'Calle de San Ignacio de Loyola 7', cp: '50008',
    coords: [-0.8834096, 41.646698], osm: 'node/5630827829', fuente: ETIQUETAS + ' (código postal de Nominatim)'},
  {n: 5, slug: 'madrid', ciudad: 'Madrid', provincia: 'Madrid', region: 'Comunidad de Madrid', corto: 'MAD', formato: 8,
    nombre: 'Estanco Exp. nº 167 · Fuencarral', calle: 'Calle de Fuencarral 2', cp: '28004',
    coords: [-3.7015004, 40.420283], osm: 'node/5395666964', fuente: ETIQUETAS},
  {n: 6, slug: 'valencia', ciudad: 'València', provincia: 'Valencia', region: 'Comunitat Valenciana', corto: 'VLC', formato: 10,
    nombre: 'Estanco Del Carmen', calle: 'Plaça de Sant Jaume 5', cp: '46003',
    coords: [-0.3799721, 39.4766998], osm: 'node/5250590422', fuente: ETIQUETAS},
  {n: 7, slug: 'palma', ciudad: 'Palma', provincia: 'Illes Balears', region: 'Illes Balears', corto: 'PMI', formato: 13,
    nombre: "Estanc de l'Olivar · Exp. nº 21", calle: "Plaça de l'Olivar 5", cp: '07002',
    coords: [2.6528323, 39.5732702], osm: 'node/5332998570', fuente: NOMINATIM},
  {n: 8, slug: 'sevilla', ciudad: 'Sevilla', provincia: 'Sevilla', region: 'Andalucía', corto: 'SVQ', formato: 18,
    nombre: 'El Palacio del Fumador', calle: "Calle O'Donnell 5", cp: '41001',
    coords: [-5.9953245, 37.3923553], osm: 'node/11275600736', fuente: NOMINATIM},
  {n: 9, slug: 'malaga', ciudad: 'Málaga', provincia: 'Málaga', region: 'Andalucía', corto: 'AGP', formato: 12,
    nombre: 'Tabacos Estanco Larios', calle: 'Calle Marqués de Larios 10', cp: '29005',
    coords: [-4.4216755, 36.7191336], osm: 'node/5581097900', fuente: ETIQUETAS},
  {n: 10, slug: 'granada', ciudad: 'Granada', provincia: 'Granada', region: 'Andalucía', corto: 'GRX', formato: 9,
    nombre: 'Estanco Reyes Católicos · Exp. nº 24', calle: 'Calle Reyes Católicos 47', cp: '18001',
    coords: [-3.5979781, 37.1756873], osm: 'node/10696872109', fuente: NOMINATIM},
];

const nn = n => String(n).padStart(2, '0');
export const idDe = e => `altadis-es-${nn(e.n)}-${e.slug}`;
export const espacioDe = e => `altadis-xtanco-${nn(e.formato)}`;
export const mapaUrl = id => `https://www.admira.biz/?circuit=${CIRCUITO}&loc=${encodeURIComponent(id)}&marca=${MARCA}`;
export const gemeloUrl = e => `https://www.admira.store/xpacios/altadis-18/?espacio=${espacioDe(e)}&loc=${idDe(e)}&marca=${MARCA}`;
export const planoJsonUrl = e => `https://www.admira.biz/data/xpacios/${espacioDe(e)}.json`;

// Audiencia de demo: 700 impactos/día por estanco (la plantilla de altadis-bcn-001: 250 + 450), repartidos
// entre sus pantallas. Es una estimación de catálogo, no una medida (lo dice _nota en cada punto).
const IMPACTOS_ESTANCO = 700;
const tecnologia = t => (t === 'led' ? 'LED' : 'LCD');
const pulgadas = p => String(p).replace('.', ',') + '″';
const MONTAJE = {'junto-caja': 'junto a la caja', 'pared-fondo': 'pared del fondo', escaparate: 'escaparate', peana: 'peana',
  'cabecera-lineal': 'cabecera de lineal', 'banda-alta': 'banda alta'};

function superficies(e, plano) {
  const pantallas = plano.pantallas;
  const base = Math.floor(IMPACTOS_ESTANCO / pantallas.length);
  const resto = IMPACTOS_ESTANCO - base * pantallas.length;
  return pantallas.map((p, i) => ({
    name: p.nombre,
    desc: `${tecnologia(p.tecnologia)} ${pulgadas(p.pulgadas)} ${p.orientacion} · ${p.resolucion[0]}×${p.resolucion[1]} · ${MONTAJE[p.montaje] || p.montaje} · formato ${plano.formato.id} (${plano.formato.nombre})`,
    orient: p.orientacion,
    w: p.resolucion[0],
    h: p.resolucion[1],
    status: 'sched',
    impr: base + (i === 0 ? resto : 0),
    cpm: p.tecnologia === 'led' ? '€8' : '€6',
    surface: p.montaje === 'escaparate' ? 'escaparate' : 'pantalla',
    formato: plano.formato.id,
    pantalla: p.id,
    itil: null,
  }));
}

function punto(e, plano) {
  const id = idDe(e);
  const surfaces = superficies(e, plano);
  const exterior = surfaces.some(s => s.surface === 'escaparate');
  return {
    id,
    name: e.nombre,
    kind: `Estanco · Xtanco Altadis · ${plano.formato.nombre}`,
    addr: `${e.calle} · ${e.cp} ${e.ciudad}`,
    coords: e.coords,
    music: 'retail',
    cameras: false,
    city: e.ciudad,
    province: e.provincia,
    region: e.region,
    country: 'ES',
    circuit: CIRCUITO,
    tourOrder: e.n,
    formato: plano.formato.id,
    espacio: espacioDe(e),
    osm: {id: e.osm},
    external: {
      brand: 'Estanco',
      sponsor: 'Altadis',
      network: 'altadis estancos espana',
      source: `${OSM} · ${e.fuente}`,
      url: `https://www.openstreetmap.org/${e.osm}`,
    },
    twin: gemeloUrl(e),
    surfaces,
    _nota: `impr/cpm estimados para la demo (${IMPACTOS_ESTANCO} impactos/día por estanco repartidos entre sus pantallas), no medidos; pantallas del plano compartido ${espacioDe(e)}`,
    segmentation: {
      required: false,
      schedule: {start: '08:00', end: '20:00'},
      typologies: exterior ? ['exterior', 'interior'] : ['interior'],
      genders: ['hombre', 'mujer'],
      ages: ['adulto', 'senior', 'vejez'],
    },
    xpaceUrl: gemeloUrl(e),
    twinOnClick: true,
    twinNote: `Gemelo del espacio tipo Altadis 18 de su formato (${espacioDe(e)}, plano tipo, no un levantamiento) rotulado con este estanco.`,
    plano: planoJsonUrl(e),
  };
}

function leerPlano(root, e) {
  const plano = JSON.parse(readFileSync(root + `data/xpacios/${espacioDe(e)}.json`, 'utf8'));
  if (plano.id !== espacioDe(e) || plano.formato.id !== `cliente-${nn(e.formato)}`) throw new Error(`plano inesperado: ${espacioDe(e)}`);
  return plano;
}

export function puntos(root = ROOT) {
  return ESTANCOS.map(e => punto(e, leerPlano(root, e)));
}

export function indice(lista) {
  return {
    schema: 'admira.circuito-demo/1',
    circuito: CIRCUITO,
    cliente: 'Altadis',
    marca: MARCA,
    locales: lista.map(l => ({
      id: l.id,
      nombre: l.name,
      direccion: l.addr,
      ciudad: l.city,
      coords: l.coords,
      tourOrder: l.tourOrder,
      formato: l.formato,
      espacio: l.espacio,
      mapa: mapaUrl(l.id),
    })),
  };
}

function bloqueLocations(lista) {
  return [INICIO,
    '// Altadis España · 10 Xtancos (DCL-a6cb621be0ce5932f50960de): fichas del mapa de admira.biz sin tocar el catálogo KV.',
    `// Semilla: ${RUTA_SEED}.`,
    'window.OMNIP_LOCATIONS_EXTRA.push(...[',
    ...lista.map(l => JSON.stringify(l) + ','),
    ']);',
    FIN].join('\n');
}

export function conBloque(texto, lista) {
  const bloque = bloqueLocations(lista);
  const a = texto.indexOf(INICIO), b = texto.indexOf(FIN);
  if (a >= 0 && b > a) return texto.slice(0, a) + bloque + texto.slice(b + FIN.length);
  // Primera vez: justo antes de mergeOmnipLocations, tras el resto de OMNIP_LOCATIONS_EXTRA.
  const ancla = texto.indexOf('window.mergeOmnipLocations = function');
  if (ancla < 0) throw new Error('locations.js sin mergeOmnipLocations');
  return texto.slice(0, ancla) + bloque + '\n\n' + texto.slice(ancla);
}

export function ficheros(root = ROOT) {
  const lista = puntos(root);
  return [
    {ruta: RUTA_SEED, texto: JSON.stringify(lista, null, 1) + '\n'},
    {ruta: RUTA_INDICE, texto: JSON.stringify(indice(lista), null, 1) + '\n'},
    {ruta: RUTA_LOCATIONS, texto: conBloque(readFileSync(root + RUTA_LOCATIONS, 'utf8'), lista)},
  ];
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const comprobar = process.argv.includes('--comprobar');
  let distintos = 0;
  for (const {ruta, texto} of ficheros()) {
    if (existsSync(ROOT + ruta) && readFileSync(ROOT + ruta, 'utf8') === texto) continue;
    distintos++;
    if (comprobar) console.error(`✗ ${ruta} no coincide con tools/genera-altadis-espana.mjs`);
    else { writeFileSync(ROOT + ruta, texto); console.log(`· ${ruta}`); }
  }
  if (comprobar && distintos) process.exit(1);
  console.log(comprobar ? '✓ Altadis España: semilla, índice y locations.js al día' : `✓ ${distintos} ficheros escritos (de 3)`);
}
