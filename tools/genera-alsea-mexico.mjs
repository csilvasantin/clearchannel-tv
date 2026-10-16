// Starbucks México · Alsea · 10 estados (DCL-97f84ae3e5b2cb2311c55101, Carlos, 16-oct-2026): el Tour DooH de
// Alsea México al nivel del de Altadis España (tools/genera-altadis-espana.mjs), con cliente Starbucks y su marca.
// Los mismos 10 Starbucks reales de la semilla de septiembre (localizador starbucks.com.mx), en el mismo orden de
// tour, cada uno con uno de los 10 formatos de Altadis en su versión CAFETERÍA. Escribe, sin red y sin azar:
//   data/circuitos/circuito-alsea-mexico-10.seed.json   la semilla (mismo esquema que la de Altadis España)
//   data/xpacios/alsea-mexico-10.json                   el índice público (admira.circuito-demo/1) para el gemelo
//   locations.js (bloque <alsea-mexico>)                 los 10 puntos en OMNIP_LOCATIONS_EXTRA con bundleWins
// Las pantallas salen del plano compartido de su formato (data/xpacios/altadis-cafe-NN.json): no se inventan.
// El catálogo KV conserva sus 10 fichas de septiembre (3 superficies genéricas): no se toca. Por eso estas llevan
// `bundleWins: true` y mergeOmnipLocations (locations.js) las pone encima de las del KV y de la caché del navegador.
// Regenerar: node tools/genera-alsea-mexico.mjs · Comprobar sin escribir: node tools/genera-alsea-mexico.mjs --comprobar
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const CIRCUITO = 'alsea_mexico';
export const MARCA = 'starbucks';
export const RUTA_SEED = 'data/circuitos/circuito-alsea-mexico-10.seed.json';
export const RUTA_INDICE = 'data/xpacios/alsea-mexico-10.json';
export const RUTA_LOCATIONS = 'locations.js';
const INICIO = '// <alsea-mexico> generado por tools/genera-alsea-mexico.mjs: no editar a mano';
const FIN = '// </alsea-mexico>';

// El gemelo Matrix de Starbucks Paseo de Gràcia 103 (alsea-sbux-021) que llevaban los 10 hasta hoy (FLT-101244):
// se queda en la ficha como enlace secundario.
export const GEMELO_MATRIX = 'https://www.admira.store/admira-xp/?quality=matrix&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks';
const FUENTE = 'starbucks.com.mx store locator (/api/getStores, 2026-09-28)';
// Orden de tour, formato Altadis (versión cafetería) asignado y Starbucks real de cada estado. La dirección fiscal es
// la del localizador oficial tal cual; `calle` y `colonia` son esa misma dirección escrita para la ficha.
export const CAFETERIAS = [
  {n: 1, slug: 'tijuana', storeId: '38252', formato: 7, nombre: 'Starbucks Tijuana · Plaza Río',
    ciudad: 'Tijuana', province: 'BCN', estado: 'Baja California', cp: '22010', coords: [-117.018754, 32.527349],
    calle: 'Av. Paseo de los Héroes 95, local E-5', colonia: 'Zona Urbana Río',
    fiscal: 'AVENIDA PASEO DE LOS HEROES  95 LOCAL E-5 ZONA URBANA RIO TIJUANA CP 22010 TIJUANA BAJA CALIFORNIA · Tijuana · 22010 · México'},
  {n: 2, slug: 'monterrey', storeId: '38670', formato: 17, nombre: 'Starbucks Monterrey · Pabellón M',
    ciudad: 'Monterrey', province: 'NLE', estado: 'Nuevo León', cp: '64000', coords: [-100.319595336914, 25.666903660561],
    calle: 'Av. Juárez 1102, nivel 1, local PB-C17', colonia: 'Centro',
    fiscal: 'AV. JUAREZ 1102 Y 1102-1 AL 1102-12 NIVEL 1 PB-C17 MONTERREY CENTRO CP 64000 MONTERREY NUEVO LEÓN · Monterrey · 64000 · México'},
  {n: 3, slug: 'leon', storeId: '38453', formato: 1, nombre: 'Starbucks León · Poliforum (Blvd. Francisco Villa)',
    ciudad: 'León', province: 'GUA', estado: 'Guanajuato', cp: '37510', coords: [-101.656140089035, 21.1155645766608],
    calle: 'Blvd. Francisco Villa 1820, locales 1-172 y 1-173', colonia: 'Oriental',
    fiscal: 'BLVD. FRANCISCO VILLA 1820 LOCALES  1-172 Y 1-173 ORIENTAL CP 37510 LEON GUANAJUATO · León · 37500 · México'},
  {n: 4, slug: 'guadalajara', storeId: '38624', formato: 16, nombre: 'Starbucks Guadalajara · Centro Gdl',
    ciudad: 'Guadalajara', province: 'JAL', estado: 'Jalisco', cp: '44100', coords: [-103.3448156, 20.6741566],
    calle: 'Degollado 202', colonia: 'Centro',
    fiscal: 'DEGOLLADO 202,211,213 Y 217 10,201-207 A GUADALAJARA CENTRO CP 44100 GUADALAJARA JALISCO · Guadalajara · 44100 · México'},
  {n: 5, slug: 'queretaro', storeId: '38467', formato: 8, nombre: 'Starbucks Querétaro · Constituyentes',
    ciudad: 'Querétaro', province: 'QUE', estado: 'Querétaro', cp: '76030', coords: [-100.393291, 20.584085],
    calle: 'Av. Constituyentes 57', colonia: 'Cimatario',
    fiscal: 'AVENIDA CONSTITUYENTES 57 1 CIMATARIO CP 76030 QUERETARO QUERETARO · Querétaro · 76030 · México'},
  {n: 6, slug: 'cdmx', storeId: '38487', formato: 10, nombre: 'Starbucks CDMX · Madero',
    ciudad: 'Ciudad de México', province: 'CDMX', estado: 'Ciudad de México', cp: '06000', coords: [-99.137403, 19.433649],
    calle: 'Francisco I. Madero 42', colonia: 'Centro Histórico, Cuauhtémoc',
    fiscal: 'FRANCISCO I MADERO MANZANA 14 42 S/N CENTRO DE LA CUIDAD DE MEXICO AREA 1 CP 06000 CUAUHTEMOC CIUDAD DE MEXICO · Ciudad de México · 06000 · México'},
  {n: 7, slug: 'puebla', storeId: '38699', formato: 13, nombre: 'Starbucks Puebla · Puebla Centro',
    ciudad: 'Puebla', province: 'PUE', estado: 'Puebla', cp: '72000', coords: [-98.1967163077206, 19.0441844167093],
    calle: 'Av. 2 Oriente 203, local B', colonia: 'Centro',
    fiscal: 'AVENIDA 2 ORIENTE 203 LOCAL B PUEBLA CENTRO CP 72000 PUEBLA PUEBLA · Puebla · 72000 · México'},
  {n: 8, slug: 'oaxaca', storeId: '38519', formato: 18, nombre: 'Starbucks Oaxaca · Plaza del Parque',
    ciudad: 'Oaxaca', province: 'OAX', estado: 'Oaxaca', cp: '68050', coords: [-96.71906, 17.078757],
    calle: 'Calz. Porfirio Díaz 27, kiosko', colonia: 'Reforma',
    fiscal: 'CALZADA PORFIRIO DIAZ 27 KIOSKO REFORMA CP 68050 OAXACA DE JUAREZ OAXACA · Oaxaca · 68050 · México'},
  {n: 9, slug: 'merida', storeId: '38435', formato: 12, nombre: 'Starbucks Mérida · Paseo de Montejo',
    ciudad: 'Mérida', province: 'YUC', estado: 'Yucatán', cp: '97000', coords: [-89.6182096999999, 20.9850204],
    calle: 'Calle 56 A 465', colonia: 'Centro',
    fiscal: 'CALLE 56 A 465  CENTRO CP 97000 MERIDA YUCATAN · Mérida · 97000 · México'},
  {n: 10, slug: 'cancun', storeId: '38723', formato: 9, nombre: 'Starbucks Cancún · Puerto Cancún',
    ciudad: 'Cancún', province: 'ROO', estado: 'Quintana Roo', cp: '77500', coords: [-86.80794, 21.160301],
    calle: 'Av. Bonampak, local L-1-02 A-49C', colonia: 'Zona Hotelera',
    fiscal: 'AV. BONAMPAK L-1-02 A-49C ZONA HOTELERA CP 77500  QUINTANA ROO · Cancún · 77500 · México'},
];

const nn = n => String(n).padStart(2, '0');
export const idDe = c => `alsea-mx-sbux-${nn(c.n)}-${c.slug}`;
export const espacioDe = c => `altadis-cafe-${nn(c.formato)}`;
export const mapaUrl = id => `https://www.admira.biz/?circuit=${CIRCUITO}&loc=${encodeURIComponent(id)}&marca=${MARCA}`;
export const gemeloUrl = c => `https://www.admira.store/xpacios/altadis-18/?espacio=${espacioDe(c)}&loc=${idDe(c)}&marca=${MARCA}`;
export const planoJsonUrl = c => `https://www.admira.biz/data/xpacios/${espacioDe(c)}.json`;

// Audiencia de demo: 1.550 impactos/día por cafetería (la plantilla de la semilla de septiembre: menu board 700 +
// recogida 450 + escaparate 400), repartidos entre sus pantallas. CPM como en Altadis: €8 LED, €6 LCD. Es una
// estimación de catálogo, no una medida (lo dice _nota en cada punto).
const IMPACTOS_CAFETERIA = 1550;
const tecnologia = t => (t === 'led' ? 'LED' : 'LCD');
const pulgadas = p => String(p).replace('.', ',') + '″';
const MONTAJE = {'junto-caja': 'junto a la caja', 'pared-fondo': 'pared del fondo', escaparate: 'escaparate', peana: 'peana',
  'cabecera-lineal': 'cabecera de lineal', 'banda-alta': 'banda alta'};

function superficies(plano) {
  const pantallas = plano.pantallas;
  const base = Math.floor(IMPACTOS_CAFETERIA / pantallas.length);
  const resto = IMPACTOS_CAFETERIA - base * pantallas.length;
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

function punto(c, plano) {
  const id = idDe(c);
  const surfaces = superficies(plano);
  const exterior = surfaces.some(s => s.surface === 'escaparate');
  return {
    id,
    name: c.nombre,
    kind: `Cafetería · Starbucks · Alsea México · ${plano.formato.nombre}`,
    addr: `${c.calle} · ${c.colonia} · ${c.cp} ${c.ciudad}`,
    coords: c.coords,
    music: 'lounge',
    cameras: false,
    city: c.ciudad,
    province: c.province,
    region: c.estado,
    country: 'MX',
    circuit: CIRCUITO,
    tourOrder: c.n,
    formato: plano.formato.id,
    espacio: espacioDe(c),
    external: {
      brand: 'Starbucks',
      operator: 'Alsea',
      storeId: c.storeId,
      network: 'starbucks mexico',
      source: FUENTE,
      url: 'https://www.starbucks.com.mx/stores',
      addr: c.fiscal,
    },
    twin: gemeloUrl(c),
    surfaces,
    _nota: `impr/cpm estimados para la demo (${IMPACTOS_CAFETERIA} impactos/día por cafetería repartidos entre sus pantallas), no medidos; pantallas del plano compartido ${espacioDe(c)}`,
    segmentation: {
      required: false,
      schedule: {start: '07:00', end: '22:00'},
      typologies: exterior ? ['exterior', 'interior'] : ['interior'],
      genders: ['hombre', 'mujer'],
      ages: ['joven', 'adulto', 'senior'],
      timeSlots: ['manana', 'mediodia', 'tarde'],
    },
    xpaceUrl: gemeloUrl(c),
    twinOnClick: true,
    twinNote: `Gemelo del espacio tipo Altadis 18 de su formato en versión cafetería (${espacioDe(c)}, plano tipo, no un levantamiento) con la marca Starbucks.`,
    twinAlt: {url: GEMELO_MATRIX, es: 'Gemelo Matrix · Paseo de Gràcia 103 ↗', en: 'Matrix twin · Paseo de Gràcia 103 ↗'},
    plano: planoJsonUrl(c),
    bundleWins: true,
  };
}

function leerPlano(root, c) {
  const plano = JSON.parse(readFileSync(root + `data/xpacios/${espacioDe(c)}.json`, 'utf8'));
  if (plano.id !== espacioDe(c) || plano.formato.id !== `cliente-${nn(c.formato)}` || !plano.espacio || plano.espacio.tipo !== 'cafe') {
    throw new Error(`plano inesperado: ${espacioDe(c)}`);
  }
  return plano;
}

export function puntos(root = ROOT) {
  return CAFETERIAS.map(c => punto(c, leerPlano(root, c)));
}

export function indice(lista) {
  return {
    schema: 'admira.circuito-demo/1',
    circuito: CIRCUITO,
    cliente: 'Starbucks (Alsea)',
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
    '// Starbucks México · Alsea (DCL-97f84ae3e5b2cb2311c55101): fichas del mapa de admira.biz sin tocar el catálogo KV.',
    `// Semilla: ${RUTA_SEED}. bundleWins: mandan sobre la ficha de septiembre que sigue en el KV.`,
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
    if (comprobar) console.error(`✗ ${ruta} no coincide con tools/genera-alsea-mexico.mjs`);
    else { writeFileSync(ROOT + ruta, texto); console.log(`· ${ruta}`); }
  }
  if (comprobar && distintos) process.exit(1);
  console.log(comprobar ? '✓ Starbucks México: semilla, índice y locations.js al día' : `✓ ${distintos} ficheros escritos (de 3)`);
}
