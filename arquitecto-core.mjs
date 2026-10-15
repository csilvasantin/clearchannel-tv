// Estudio del Arquitecto (/arquitecto · DCL-66d9ae0d5e756d0067127f24). Sin DOM: lo usan arquitecto.mjs y los tests.
//
// Carlos, 14-oct-2026: «/arquitecto es el comando que se encarga de crear, reformar o inventariar espacios
// existentes; Admirito se disfraza de arquitecto y le podemos pedir crear (espacio nuevo inventado), reformar
// (desde una imagen, vídeo o descripción de audio) o inventariar (desde una imagen, vídeo o descripción) — da
// de alta el inventario ITIL al final».
//
// Este módulo junta las piezas que ya existen sin duplicarlas:
//   · crear      → generarXpacio (plano-generador.mjs, ▤ Creación de Xpacios).
//   · reformar   → la «Propuesta de obra» de plano-core.mjs (template, placeNew, moveGroup, reshape, workOrder,
//                  exportOrder → admira.orden-obra/1). Las órdenes salen de lo que se cuenta (intérprete propio,
//                  sin modelo) o de lo que estima POST /xpacio/estimar a partir de fotos o vídeo.
//   · inventariar→ /xpacio/estimar (fotos o vídeo) o la descripción → generarXpacio({elementos}) → lista de CI
//                  con códigos ITIL sugeridos (^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){1,3}$, el regex de Yokup).
//   · traspaso   → el plano y los CI viajan al Portal del comercio de Yokup (admira.app/retailer) en el FRAGMENTO
//                  de la URL (#arquitecto=…), que el navegador nunca manda a ningún servidor; allí el titular
//                  elige establecimiento y confirma. La cookie del portal es SameSite=Strict: desde admira.biz
//                  no se puede llamar a su API, y así no hace falta.
import { round, footprint, wallLength, validate, placeNew, moveGroup, reshape, clampToWall, newId, panelSize, groupOf, composition, template, hLayout } from './plano-core.mjs?v=20261014-plano-1';
import { TIPOS, generarXpacio } from './plano-generador.mjs?v=20261014-foto-1';
import { ID_RE, normalizarId } from './plano-subida.mjs?v=20261014-subir-1';
// «Con foto o vídeo» de la Creación de Xpacios (DCL-ddf3203078fe9471f3796130): la respuesta de /xpacio/estimar → plano,
// con su procedencia (modelo, confianza) y las pantallas vistas desolapadas. El Arquitecto la reutiliza tal cual.
import { planoDesdeEstimacion, ESTIMADOR } from './plano-foto.mjs?v=20261014-foto-2';

export const ORDENES = Object.freeze(['crear', 'reformar', 'inventariar']);
export const ESTUDIO_URL = 'https://www.admira.biz/arquitecto.html';
export const PORTAL_IMPORTAR = 'https://admira.app/retailer';
export const TRASPASO_SCHEMA = 'admira.arquitecto-inventario/1';
export const ITIL_RE = /^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){1,3}$/;
export const PREFIJO_RE = /^[A-Z0-9]{2,12}$/;
// Categorías del ITIL de Yokup (docs/itil-yokup.md).
export const CATEGORIAS = Object.freeze(['pantalla', 'player', 'tpv', 'audio', 'iot', 'red', 'kiosk', 'mobiliario', 'iluminacion', 'otro']);
export const MAX_CIS = 200;
export const MAX_TRASPASO_JSON = 256 * 1024;   // el plano compacto que Yokup admite (413 plan_too_large por encima)
export const MAX_FRAGMENTO = 120000;          // caracteres del #fragmento; por encima, se descarga el JSON
export const MAX_DESCRIPCION = 2000;
// Topes de trabajo (colocar cada pantalla recorre las paredes validando el plano): con textos largos o muchas órdenes,
// el navegador se quedaba ~30 s colgado. Lo que pase de aquí se dice («demasiadas») y no se hace.
export const MAX_ORDENES = 12;
export const MAX_PANTALLAS_NUEVAS = 40;
const PAREDES = ['F', 'D', 'P', 'I'];
const EPS = 1e-6;

const norm = t => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const limpio = (v, max = 160) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const num = v => typeof v === 'number' && Number.isFinite(v);
const clone = o => JSON.parse(JSON.stringify(o));

// ── Órdenes: /arquitecto [crear [tipo]|reformar|inventariar], ?orden= y lo que se le dice a la nube ──────────
const ALIAS_ORDEN = {
  crear: 'crear', crea: 'crear', create: 'crear', nuevo: 'crear', nueva: 'crear', new: 'crear', inventar: 'crear',
  reformar: 'reformar', reforma: 'reformar', reform: 'reformar', renovar: 'reformar', renovate: 'reformar', renovation: 'reformar', obra: 'reformar', obras: 'reformar',
  inventariar: 'inventariar', inventario: 'inventariar', inventaria: 'inventariar', inventory: 'inventariar', survey: 'inventariar', levantamiento: 'inventariar', itil: 'inventariar',
  // /arquitecto formatos [NN] [xtanco|starbucks]: «Espacio por formato · Altadis 18» dentro de crear (DCL-d7966deb02734a6f34beb54e).
  formatos: 'crear', formato: 'crear', formats: 'crear', format: 'crear', altadis: 'crear'
};
const FORMATOS_RE = /^(formatos?|formats?|altadis)$/;
const ALIAS_TIPO = [
  [/\b(cafeteria|cafe|coffee ?shop|coffee)\b/, 'cafeteria'], [/\b(estanco|tobacconist|tobacco)\b/, 'estanco'], [/\b(kiosco|quiosco|kiosk)\b/, 'kiosco'],
  [/\b(farmacia|pharmacy|drugstore)\b/, 'farmacia'], [/\b(moda|ropa|fashion|clothing|boutique)\b/, 'moda'], [/\b(restaurante|restaurant)\b/, 'restaurante'],
  [/\b(supermercado|super|grocery|supermarket)\b/, 'supermercado'], [/\b(panaderia|bakery|horno)\b/, 'panaderia'],
  [/\b(oficina bancaria|sucursal|banco|bank)\b/, 'banco'], [/\b(oficina|office)\b/, 'oficina'], [/\b(laboratorio|showroom|lab)\b/, 'laboratorio']
];
export function tipoDe(texto) {
  const t = norm(texto);
  if (Object.hasOwn(TIPOS, t)) return t;
  for (const [re, tipo] of ALIAS_TIPO) if (re.test(t)) return tipo;
  return '';
}
// «crear cafeteria» · ['reformar'] · '' → {orden, tipo, resto}. orden '' = sin orden (ayuda); null = no es una orden.
// «formatos 15 starbucks» → {orden: 'crear', tipo: '', resto: '15 starbucks', formatos: true}.
export function parseOrden(entrada) {
  const partes = (Array.isArray(entrada) ? entrada.join(' ') : String(entrada ?? '')).trim().replace(/^\/?(arquitecto|architect)(@\S+)?\b\s*/i, '');
  if (!partes) return { orden: '', tipo: '', resto: '' };
  const [primera, ...resto] = partes.split(/\s+/);
  const orden = ALIAS_ORDEN[norm(primera)];
  if (!orden) return null;
  const texto = resto.join(' ').slice(0, MAX_DESCRIPCION);
  // «formatos» no inventa un tipo de Xpacio: el resto dice el formato y el espacio (Xtanco o Starbucks).
  if (FORMATOS_RE.test(norm(primera))) return { orden, tipo: '', resto: texto, formatos: true };
  return { orden, tipo: orden === 'crear' || orden === 'inventariar' ? tipoDe(texto) : '', resto: texto };
}
// Parámetros de la página: ?orden=crear&tipo=cafeteria&locationId=…&lang=es (todo validado). El cargador común
// (admiranext.com/assets/avatar.js, tabla PERSONAJES) manda /arquitecto crear cafetería como ?arg=crear-cafeteria.
export function parametros(search = '') {
  const q = new URLSearchParams(search);
  const arg = /^[a-z0-9-]{1,40}$/.test(q.get('arg') || '') ? parseOrden(q.get('arg').replace(/-/g, ' ')) : null;
  const orden = ORDENES.includes(q.get('orden')) ? q.get('orden') : (arg && arg.orden) || '';
  const tipo = Object.hasOwn(TIPOS, q.get('tipo') || '') ? q.get('tipo') : (arg && arg.tipo) || '';
  const locationId = ID_RE.test(q.get('locationId') || '') ? q.get('locationId') : '';
  return { orden, tipo, locationId };
}

// ── Números, paredes y pantallas en lo que se cuenta (castellano e inglés) ────────────────────────────────
const NUMEROS = { un: 1, una: 1, uno: 1, one: 1, a: 1, an: 1, dos: 2, two: 2, par: 2, pair: 2, tres: 3, three: 3, cuatro: 4, four: 4, cinco: 5, five: 5,
  seis: 6, six: 6, siete: 7, seven: 7, ocho: 8, eight: 8, nueve: 9, nine: 9, diez: 10, ten: 10, doce: 12, twelve: 12 };
const NUM_TXT = '(\\d{1,2}|' + Object.keys(NUMEROS).filter(k => k.length > 2).join('|') + ')';
const aNumero = v => /^\d+$/.test(v) ? parseInt(v, 10) : (NUMEROS[v] || null);
export function paredDe(texto) {
  const t = norm(texto);
  if (/\b(fondo|al fondo|back wall|rear|back)\b/.test(t)) return 'F';
  if (/\b(derecha|derecho|right)\b/.test(t)) return 'D';
  if (/\b(izquierda|izquierdo|left)\b/.test(t)) return 'I';
  if (/\b(fachada|frente|entrada|escaparate|front|facade|shop ?window|window)\b/.test(t)) return 'P';
  return '';
}
const orientacionDe = t => /\b(vertical(es)?|portrait|de pie)\b/.test(t) ? 'vertical' : /\b(horizontal(es)?|landscape|apaisad[ao]s?)\b/.test(t) ? 'horizontal' : '';
const pulgadasDe = t => { const m = /(\d{2,3})\s*(?:"|″|''|pulgadas|pulgada|inch(?:es)?|in\b|pulg)/.exec(t); const n = m ? parseInt(m[1], 10) : null; return n && n >= 10 && n <= 110 ? n : null; };
const PANTALLA_RE = /\b(pantallas?|teles?|televisores?|televisiones?|monitor(es)?|screens?|displays?|menu ?boards?|videowall|video ?wall|mosaicos?|tvs?)\b/;
function mosaicoDe(t) {
  const g = /(\d)\s*(?:x|×|por|by)\s*(\d)/.exec(t);
  if (/\b(videowall|video ?wall|mosaico|mosaic)\b/.test(t) && g) {
    const filas = Math.min(4, Math.max(1, +g[1])), cols = Math.min(6, Math.max(1, +g[2]));
    return { tipo: 'rejilla', filas, cols };
  }
  if (/\bdoble h\b|\bdouble h\b/.test(t)) return { tipo: 'mosaico-doble-h' };
  if (/\b(mosaico|mosaic) (en )?h\b|\ben h\b|\bh mosaic\b/.test(t)) return { tipo: 'mosaico-h' };
  if (/\b(videowall|video ?wall)\b/.test(t)) return { tipo: 'rejilla', filas: 2, cols: 2 };
  return null;
}
// Cuántas: el número pegado a «pantallas» («tres pantallas verticales», «2 teles»); si no, uno que no sea una medida
// («8 por 12», «43 pulgadas», «3 m»).
const PANTALLA_PAL = '(?:pantallas?|teles?|televisores?|monitor(?:es)?|screens?|displays?|menu ?boards?|tvs?|verticales?|horizontales?)';
const cantidadDe = (t, def = 1) => {
  const pegado = new RegExp('\\b' + NUM_TXT + '\\s+(?:[a-z]+\\s+){0,2}?' + PANTALLA_PAL + '\\b').exec(t);
  if (pegado) return Math.min(12, aNumero(pegado[1]) || def);
  const re = new RegExp('\\b' + NUM_TXT + '\\b(?!\\s*(?:[.,]\\d|m\\b|m2|m²|metros|meters|por\\b|x\\b|×|by\\b|pulgadas|pulgada|inch|in\\b|"|″|\'\'))', 'g');
  let m;
  while ((m = re.exec(t))) { if (!/(?:x|×|por|by)\s*$/.test(t.slice(0, m.index))) return Math.min(12, aNumero(m[1]) || def); }
  return def;
};

// Medidas: «8 por 12», «8x12 m», «de 3 m de alto», «100 m²».
export function medidasDe(texto) {
  const t = norm(texto).replace(/(\d),(\d)/g, '$1.$2');
  const out = {};
  const dims = /(\d+(?:\.\d+)?)\s*(?:m|metros|meters)?\s*(?:x|×|por|by)\s*(\d+(?:\.\d+)?)\s*(?:m\b|metros|meters)?/.exec(t);
  if (dims && !/(videowall|video ?wall|mosaico|mosaic)\s*(de\s*)?$/.test(t.slice(0, dims.index).trim().split(/[,;.]/).pop())) {
    const a = parseFloat(dims[1]), b = parseFloat(dims[2]);
    if (a >= 1 && a <= 500 && b >= 1 && b <= 500 && (a > 6 || b > 6 || /m\b|metros|meters/.test(dims[0]))) { out.ancho = a; out.largo = b; }
  }
  const alto = /(\d+(?:\.\d+)?)\s*(?:m|metros|meters)?\s*(?:de (?:alto|altura)|high|tall|de techo)|(?:alto|altura|techo|height|ceiling)\s*(?:de|of)?\s*(\d+(?:\.\d+)?)/.exec(t);
  if (alto) { const v = parseFloat(alto[1] || alto[2]); if (v >= 2 && v <= 8) out.alto = v; }
  const area = /(\d+(?:\.\d+)?)\s*(?:m2|m²|metros cuadrados|square meters|sqm)/.exec(t);
  if (area && !out.ancho) { const v = parseFloat(area[1]); if (v >= 4 && v <= 2000) out.m2 = v; }
  return out;
}

// Trocea lo que se cuenta en frases («…, y …», «… and …», «; », «. »). Cada una: {orig, f} (f, normalizada).
function trozos(texto) {
  return String(texto ?? '').replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, ' ')
    .split(/[;.\n]+|,\s*|\s+y\s+(?=(?:\d|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|añade|anade|añadir|pon|poner|quita|quitar|retira|retirar|saca|elimina|mueve|mover|traslada|lleva|gira|girar|rota|cambia|cambiar|sustituye|instala|coloca|mete|haz|pinta|otra|otro|el|la|los|las|hay|tiene)\b)|\s+and\s+/i)
    .map(o => o.trim()).filter(Boolean).map(orig => ({ orig: orig.slice(0, 200), f: norm(orig) }));
}
const frases = texto => trozos(texto).map(t => t.f);

// Lo que se cuenta de un local (crear e inventariar): tipo, medidas, pantallas, players, cámaras y audio.
export function leerDescripcion(texto) {
  const t = String(texto ?? '').slice(0, MAX_DESCRIPCION);
  const d = { tipo: tipoDe(t), ...medidasDe(t), pantallas: [], players: null, camaras: 0, altavoces: 0 };
  for (const f of frases(t)) {
    if (PANTALLA_RE.test(f)) {
      const mosaico = mosaicoDe(f);
      d.pantallas.push({ cantidad: mosaico ? 1 : cantidadDe(f), orientacion: orientacionDe(f) || 'horizontal', pulgadas: pulgadasDe(f), pared: paredDe(f), mosaico, escaparate: /\bescaparate|shop ?window\b/.test(f) });
    }
    const pl = new RegExp('\\b' + NUM_TXT + '\\s+(players?|reproductores?|media ?players?)\\b').exec(f);
    if (pl) d.players = (d.players || 0) + (aNumero(pl[1]) || 1);
    const cam = new RegExp('\\b' + NUM_TXT + '\\s+(camaras?|cameras?|webcams?)\\b').exec(f);
    if (cam) d.camaras += aNumero(cam[1]) || 1; else if (/\b(camara|camera|webcam)\b/.test(f)) d.camaras += 1;
    const alt = new RegExp('\\b' + NUM_TXT + '\\s+(altavoces|altavoz|speakers?)\\b').exec(f);
    if (alt) d.altavoces = Math.max(d.altavoces, aNumero(alt[1]) || 1); else if (/\b(altavoces|altavoz|hilo musical|speakers?|musica ambiente|audio)\b/.test(f)) d.altavoces = Math.max(d.altavoces, 1);
  }
  return d;
}

// ── Pantallas nuevas (relativas a s=0, z=0, como template() de plano-core) ─────────────────────────────────
function panel(orientacion, pulgadas, extra = {}) {
  return { id: '', itil: null, nombre: '', tipo: 'pantalla', estado: 'propuesta', orientacion, pulgadas, resolucion: [1920, 1080], fuente: 'Arquitecto', s: 0, z: 0, ...extra };
}
// Rejilla filas × columnas pegada (videowall), con su grupo. La fila de abajo en z = 0.
function rejilla(existentes, filas, cols, pulgadas, orientacion = 'horizontal') {
  const { w, h } = panelSize({ pulgadas, orientacion }), grupo = newId(existentes, 'videowall'), out = [];
  for (let r = 0; r < filas; r++) for (let c = 0; c < cols; c++) {
    const id = newId(existentes.concat(out), 'arq');
    out.push(panel(orientacion, pulgadas, { id, nombre: `Videowall ${filas}×${cols} · ${r * cols + c + 1} (nueva)`, corto: `VW${r * cols + c + 1}`, grupo, grupoNombre: `Videowall ${filas}×${cols}`, subgrupo: `F${r + 1}`, s: round(w / 2 + c * w, 3), z: round(r * h, 3) }));
  }
  return out;
}
// H y doble H de plano-core (template), con las pulgadas que se pidan.
function mosaicoHConPulgadas(existentes, tipo, pulgadas) {
  const items = template(tipo, existentes);
  if (!pulgadas || pulgadas === 55) return items;
  const h = hLayout(pulgadas), width = h[2].s + h[0].s;
  return items.map((s, i) => { const k = Math.floor(i / 3), p = h[i % 3]; return { ...s, pulgadas, s: round(p.s + k * width, 3), z: round(p.z, 3) }; });
}

// Coloca un conjunto (relativo) en su pared preferida o, si no cabe, en la primera pared con sitio.
function colocar(plan, resto, items, pared) {
  const placed = placeNew(plan, resto, items, pared || undefined);
  const ids = new Set(placed.map(p => p.id));
  const errores = validate(plan, resto.concat(placed)).filter(i => i.nivel === 'error' && (ids.has(i.pantalla) || i.codigo === 'solape'));
  return { placed, ok: !errores.length, pared: placed[0] && placed[0].pared };
}
// Relativo a s=0, z=0 (para volver a colocar un conjunto ya situado).
function relativo(items) {
  const fs = items.map(footprint), x0 = Math.min(...fs.map(f => f.x0)), z0 = Math.min(...fs.map(f => f.z0));
  return items.map(s => ({ ...s, s: round(s.s - x0, 3), z: round(s.z - z0, 3) }));
}

// ── Reformar: órdenes a partir de lo que se cuenta ─────────────────────────────────────────────────────────
const VERBO = [
  [/\b(quita|quitar|retira|retirar|elimina|eliminar|saca|sacar|remove|take out|delete|desmonta|desmontar)\b/, 'retirar'],
  [/\b(mueve|mover|traslada|trasladar|pasa|pasar|lleva|llevar|move|relocate)\b/, 'mover'],
  [/\b(gira|girar|rota|rotar|rotate|turn|pon(?:la|las|lo|los)? en (?:vertical|horizontal))\b/, 'girar'],
  [/\b(cambia|cambiar|sustituye|sustituir|replace|change|agranda|amplia|resize)\b.*\d{2,3}\s*(?:"|″|''|pulgadas|inch|in\b)/, 'tamano'],
  [/\b(anade|anadir|añade|añadir|pon|poner|instala|instalar|mete|meter|coloca|colocar|add|install|put|quiero|necesito|want|need|monta|montar|haz|hacer)\b/, 'anadir']
];
const verboDe = f => { for (const [re, v] of VERBO) if (re.test(f)) return v; return ''; };
// A qué pantallas se refiere una frase: «la 3», «las del fondo», «el mosaico», «la del escaparate», «todas», un nombre.
export function objetivoDe(frase, pantallas) {
  const f = norm(frase);
  if (/\b(todas|todo|all of them|all screens|everything)\b/.test(f)) return pantallas.map(s => s.id);
  const n = /\b(?:pantalla|screen|la|el|number|n[ºo]?\.?|#)\s*#?(\d{1,3})\b/.exec(f);
  if (n && +n[1] >= 1 && +n[1] <= pantallas.length && !/(\d{2,3})\s*(?:"|″|pulgadas|inch)/.test(f.slice(n.index, n.index + 12))) return [pantallas[+n[1] - 1].id];
  const pared = /\b(del|de la|en el|en la|on the|of the|at the)\s+(fondo|derecha|izquierda|fachada|frente|entrada|back|right|left|front)\b/.exec(f) ? paredDe(f.replace(/\ba la pared\b.*$/, '')) : '';
  let lista = pantallas;
  if (/\b(mosaico|videowall|video ?wall|menu ?boards?|grupo|mosaic)\b/.test(f)) lista = lista.filter(s => s.grupo);
  if (/\bescaparate|shop ?window\b/.test(f) && lista.some(s => s.escaparate)) lista = lista.filter(s => s.escaparate);
  else if (pared) lista = lista.filter(s => s.pared === pared);
  if (lista !== pantallas) return lista.map(s => s.id);
  // Por nombre: una palabra de 4+ letras que esté en el nombre o el código corto de alguna.
  const palabras = f.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !/^(pantalla|pantallas|screen|screens|quita|quitar|retira|retirar|mueve|mover|gira|girar|pared|wall|vertical|horizontal|cambia|para|hacia|desde)$/.test(w));
  const porNombre = pantallas.filter(s => palabras.some(w => norm(s.nombre).includes(w) || norm(s.corto).includes(w)));
  return porNombre.map(s => s.id);
}
// Destino de «mueve … a la pared X» / «… to the left wall».
const destinoDe = f => { const m = /\b(?:a|hacia|al|to|onto)\s+(?:la\s+)?(?:pared\s+)?(?:del?\s+)?(fondo|derecha|izquierda|fachada|frente|entrada|back|right|left|front)\b(?!.*\b(?:a|hacia|al|to|onto)\s+(?:la\s+)?(?:pared\s+)?(?:del?\s+)?(?:fondo|derecha|izquierda|fachada|frente|entrada|back|right|left|front)\b)/.exec(f); return m ? paredDe(m[1]) : ''; };

// Lo que se cuenta → órdenes de reforma (sin aplicar). Las frases que no se entienden vuelven en `dudas`.
export function interpretarReforma(texto, pantallas = []) {
  const ops = [], dudas = [];
  let ultimo = '';
  for (const { orig, f } of trozos(String(texto ?? '').slice(0, MAX_DESCRIPCION))) {
    const verbo = verboDe(f) || ((PANTALLA_RE.test(f) || /\b(vertical|horizontal)(es)?\b/.test(f)) && ultimo === 'anadir' ? 'anadir' : '');
    if (!verbo) { if (f.length > 2) dudas.push(orig); continue; }
    ultimo = verbo;
    if (verbo === 'anadir') {
      if (!PANTALLA_RE.test(f) && !/\b(vertical|horizontal)(es)?\b/.test(f)) { dudas.push(orig); continue; }
      const mosaico = mosaicoDe(f);
      ops.push({ op: 'anadir', cantidad: mosaico ? 1 : cantidadDe(f), orientacion: orientacionDe(f) || (mosaico && mosaico.tipo !== 'rejilla' ? 'vertical' : 'horizontal'), pulgadas: pulgadasDe(f) || 55, pared: paredDe(f), mosaico, escaparate: /\bescaparate|shop ?window\b/.test(f), texto: orig });
      continue;
    }
    const ids = objetivoDe(f, pantallas);
    if (!ids.length) { dudas.push(orig); continue; }
    if (verbo === 'retirar') ops.push({ op: 'retirar', ids, texto: orig });
    else if (verbo === 'mover') { const pared = destinoDe(f); if (pared) ops.push({ op: 'mover', ids, pared, texto: orig }); else dudas.push(orig); }
    else if (verbo === 'girar') { const o = orientacionDe(f.replace(/^.*\b(en|a|to|into)\b/, '$1')) || ''; ops.push({ op: 'girar', ids, orientacion: o, texto: orig }); }
    else if (verbo === 'tamano') { const p = pulgadasDe(f); if (p) ops.push({ op: 'tamano', ids, pulgadas: p, texto: orig }); else dudas.push(orig); }
  }
  return { ops: ops.slice(0, MAX_ORDENES), dudas: dudas.slice(0, MAX_ORDENES), demasiadas: Math.max(0, ops.length - MAX_ORDENES) };
}

// Reformar desde fotos o vídeo: lo que estima /xpacio/estimar (las pantallas que se ven) frente al plano.
// Una pantalla estimada sin pareja en su pared (a menos de 0,6 m de centro) es un alta en esa posición; con
// pareja y otra orientación, un giro; con otra diagonal (≥ 5″), un cambio de tamaño. Las del plano que no salen
// en las fotos se conservan: una foto no ve todo el local, así que no se propone retirar nada por no verlo.
export function reformaDesdeEstimacion(plan, pantallas, estimacion) {
  const ops = [], usadas = new Set();
  for (const e of (estimacion && Array.isArray(estimacion.pantallas) ? estimacion.pantallas : [])) {
    if (!PAREDES.includes(e.pared) || !num(e.s) || !num(e.z) || !num(e.pulgadas)) continue;
    const cand = pantallas.filter(s => s.pared === e.pared && !usadas.has(s.id)).map(s => ({ s, d: Math.abs(s.s - e.s) })).filter(x => x.d < 0.6).sort((a, b) => a.d - b.d)[0];
    if (!cand) { ops.push({ op: 'anadir', cantidad: 1, orientacion: e.orientacion === 'vertical' ? 'vertical' : 'horizontal', pulgadas: Math.round(e.pulgadas), pared: e.pared, posicion: { s: e.s, z: e.z }, nombre: limpio(e.nombre, 60), texto: `foto: ${limpio(e.nombre, 60) || 'pantalla'}` }); continue; }
    usadas.add(cand.s.id);
    if (e.orientacion && e.orientacion !== cand.s.orientacion) ops.push({ op: 'girar', ids: [cand.s.id], orientacion: e.orientacion, texto: `foto: ${limpio(e.nombre, 60) || cand.s.nombre}` });
    if (Math.abs(e.pulgadas - cand.s.pulgadas) >= 5) ops.push({ op: 'tamano', ids: [cand.s.id], pulgadas: Math.round(e.pulgadas), texto: `foto: ${limpio(e.nombre, 60) || cand.s.nombre}` });
  }
  return { ops, dudas: [] };
}

// Aplica las órdenes sobre la propuesta (lista de pantallas) con las piezas de plano-core. Devuelve la nueva
// propuesta y, por orden, qué se hizo: {op, texto, ok, ids, pared?, motivo?}.
export function aplicarReforma(plan, propuesta, ops) {
  let lista = clone(propuesta);
  const hechos = [], base = new Set(propuesta.map(s => s.id));
  const nuevas = () => lista.filter(s => !base.has(s.id)).length;
  for (const op of (ops || []).slice(0, MAX_ORDENES)) {
    if (op.op === 'anadir') {
      for (let k = 0; k < Math.max(1, Math.min(12, op.cantidad || 1)); k++) {
        if (nuevas() >= MAX_PANTALLAS_NUEVAS) { hechos.push({ op: 'anadir', texto: op.texto, ok: false, ids: [], motivo: 'demasiadas' }); break; }
        let items;
        if (op.mosaico && op.mosaico.tipo === 'rejilla') items = rejilla(lista, op.mosaico.filas, op.mosaico.cols, op.pulgadas || 55);
        else if (op.mosaico) items = mosaicoHConPulgadas(lista, op.mosaico.tipo, op.pulgadas || 55);
        else items = [panel(op.orientacion || 'horizontal', op.pulgadas || 55, { id: newId(lista, 'arq'), nombre: op.nombre || `Pantalla ${op.orientacion || 'horizontal'} ${op.pulgadas || 55}″ (nueva)`, escaparate: !!op.escaparate || undefined })];
        if (!items[0].escaparate) items.forEach(s => { delete s.escaparate; });
        if (nuevas() + items.length > MAX_PANTALLAS_NUEVAS) { hechos.push({ op: 'anadir', texto: op.texto, ok: false, ids: [], motivo: 'demasiadas' }); break; }
        // Con posición (de la foto): se prueba ahí; si choca, a la primera posición libre.
        if (op.posicion && items.length === 1) {
          const exacto = clampToWall(plan, { ...items[0], pared: op.pared, s: op.posicion.s, z: op.posicion.z });
          const errs = validate(plan, lista.concat(exacto)).filter(i => i.nivel === 'error' && (i.pantalla === exacto.id || i.codigo === 'solape'));
          if (!errs.length) { lista = lista.concat(exacto); hechos.push({ op: 'anadir', texto: op.texto, ok: true, ids: [exacto.id], pared: exacto.pared }); continue; }
        }
        const r = colocar(plan, lista, items, op.pared);
        if (!r.ok) { hechos.push({ op: 'anadir', texto: op.texto, ok: false, ids: [], motivo: 'no-cabe' }); break; }
        lista = lista.concat(r.placed);
        hechos.push({ op: 'anadir', texto: op.texto, ok: true, ids: r.placed.map(s => s.id), pared: r.pared, otraPared: !!(op.pared && r.pared !== op.pared) });
      }
    } else if (op.op === 'retirar') {
      const set = new Set(op.ids), antes = lista.length;
      lista = lista.filter(s => !set.has(s.id));
      hechos.push({ op: 'retirar', texto: op.texto, ok: lista.length < antes, ids: op.ids, motivo: lista.length < antes ? undefined : 'no-esta' });
    } else if (op.op === 'mover') {
      // El conjunto entero (si es un mosaico, con sus compañeras) a la pared pedida, en la primera posición libre.
      const ids = new Set(op.ids.flatMap(id => { const s = lista.find(x => x.id === id); return s && s.grupo ? groupOf(lista, s.grupo).map(x => x.id) : [id]; }));
      const mueven = lista.filter(s => ids.has(s.id)), resto = lista.filter(s => !ids.has(s.id));
      if (!mueven.length) { hechos.push({ op: 'mover', texto: op.texto, ok: false, ids: [], motivo: 'no-esta' }); continue; }
      const r = colocar(plan, resto, relativo(mueven), op.pared);
      if (!r.ok || r.pared !== op.pared) {
        const movido = moveGroup(plan, lista, [...ids], { pared: op.pared });
        const errs = validate(plan, movido).filter(i => i.nivel === 'error' && ids.has(i.pantalla));
        if (errs.length) { hechos.push({ op: 'mover', texto: op.texto, ok: false, ids: [...ids], motivo: 'no-cabe' }); continue; }
        lista = movido;
      } else lista = resto.concat(r.placed);
      hechos.push({ op: 'mover', texto: op.texto, ok: true, ids: [...ids], pared: op.pared });
    } else if (op.op === 'girar' || op.op === 'tamano') {
      const set = new Set(op.ids);
      if (!lista.some(s => set.has(s.id))) { hechos.push({ op: op.op, texto: op.texto, ok: false, ids: op.ids, motivo: 'no-esta' }); continue; }
      let cambia = 0;
      lista = lista.map(s => {
        if (!set.has(s.id)) return s;
        const patch = op.op === 'girar' ? { orientacion: op.orientacion || (s.orientacion === 'vertical' ? 'horizontal' : 'vertical') } : { pulgadas: op.pulgadas };
        if (patch.orientacion === s.orientacion || patch.pulgadas === s.pulgadas) return s;
        cambia++;
        return clampToWall(plan, reshape(s, patch));
      });
      const errs = validate(plan, lista).filter(i => i.nivel === 'error' && set.has(i.pantalla));
      hechos.push({ op: op.op, texto: op.texto, ok: cambia > 0 && !errs.length, ids: op.ids, motivo: !cambia ? 'sin-cambio' : errs.length ? 'choca' : undefined });
    }
  }
  return { propuesta: lista, hechos };
}

// ── Inventariar: plano estimado (fotos/vídeo o descripción) ───────────────────────────────────────────────
// Desde la respuesta de /xpacio/estimar: el plano de «Con foto o vídeo» (planoDesdeEstimacion de plano-foto.mjs, con su
// procedencia y las pantallas desolapadas). Para un INVENTARIO, sólo las pantallas que se han visto: las típicas del tipo
// que el generador añade cuando no se ve ninguna se quitan (serían CI inventados).
export function planDesdeEstimacion({ respuesta, estimacion, tipo = 'cafeteria', id, nombre, semilla } = {}) {
  const r = respuesta || { estimacion };
  if (!r.estimacion || ![r.estimacion.ancho, r.estimacion.largo, r.estimacion.alto].every(num)) throw new TypeError('estimacion-sin-medidas');
  const plan = planoDesdeEstimacion({ respuesta: r, tipo: TIPOS[tipo] ? tipo : 'cafeteria', id, nombre, semilla });
  const vistas = plan.pantallas.filter(s => s.estado === 'estimada');
  if (vistas.length !== plan.pantallas.length) {
    plan.pantallas = vistas;
    plan.fuente.pantallas = vistas.length ? `${vistas.length} ${vistas.length === 1 ? 'pantalla vista' : 'pantallas vistas'} en las fotos, sin código ITIL hasta darlas de alta en Yokup` : 'Ninguna pantalla vista en las fotos';
  }
  return plan;
}
// Desde la descripción: la sala del tipo (con las medidas dichas o la media del tipo), sin pantallas inventadas,
// y las pantallas descritas colocadas en su pared con placeNew. Nada que no se haya dicho.
export function planDesdeDescripcion({ descripcion, tipo, id, nombre, semilla } = {}) {
  const d = leerDescripcion(descripcion);
  const t = TIPOS[tipo] ? tipo : (d.tipo || 'cafeteria');
  let { ancho, largo, alto } = d;
  if (!ancho && d.m2) { const r = (TIPOS[t].proporcion[0] + TIPOS[t].proporcion[1]) / 2; ancho = round(Math.sqrt(d.m2 / r), 1); largo = round(d.m2 / ancho, 1); }
  const plan = generarXpacio({ tipo: t, ancho, largo, alto, id, nombre, semilla, elementos: { pantallas: [] } });
  plan.fuente.pantallas = 'Pantallas descritas, sin código ITIL hasta darlas de alta en Yokup';
  // Todas las pantallas descritas en una sola pasada: así cuenta el tope de pantallas nuevas de la reforma.
  const descritas = d.pantallas.slice(0, MAX_ORDENES);
  const r = aplicarReforma(plan, [], descritas.map((p, i) => ({ op: 'anadir', cantidad: p.cantidad, orientacion: p.orientacion, pulgadas: p.pulgadas || 55, pared: p.pared, mosaico: p.mosaico, escaparate: p.escaparate, texto: String(i) })));
  const lista = r.propuesta, malas = new Set(r.hechos.filter(h => !h.ok).map(h => h.texto));
  const noCaben = descritas.filter((_, i) => malas.has(String(i)));
  const cuenta = {};
  plan.pantallas = lista.map(s => {
    const pared = (plan.paredes.find(w => w.id === s.pared) || {}).nombre || s.pared, k = (cuenta[s.grupo || s.pared] = (cuenta[s.grupo || s.pared] || 0) + 1);
    const nombre = s.grupo ? `${s.grupoNombre} · ${k}` : `${s.orientacion === 'vertical' ? 'Vertical' : 'Horizontal'} ${s.pulgadas}″ · ${pared} ${k}`;
    return { ...s, nombre, estado: 'estimada', fuente: 'Descripción del local' };
  });
  return { plan, descripcion: d, noCaben };
}

// ── Inventario ITIL: CI sugeridos con códigos <PREFIJO>-PAN-01… ───────────────────────────────────────────
// Prefijo a partir del id del Xpacio: mayúsculas y cifras, 2-12 caracteres (lab-gran-de-gracia-51 → LABGRANDEGR5).
export function prefijoDe(id) {
  const partes = String(id ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Z0-9]+/).filter(Boolean);
  let p = partes.join('');
  // Largo: la primera palabra (hasta 4 letras), las iniciales del resto y las cifras enteras (LAB·G·D·G·51).
  if (p.length > 12) p = partes.map((w, i) => /^\d+$/.test(w) ? w : i === 0 ? w.slice(0, 4) : w[0]).join('').slice(0, 12);
  return PREFIJO_RE.test(p) ? p : 'XPACIO';
}
const dos = n => String(n).padStart(2, '0');
const nombreParedDe = (plan, id) => (plan.paredes.find(w => w.id === id) || {}).nombre || id;
const fmt = n => String(round(n, 2)).replace('.', ',');
// Los CI del plano: un player por mosaico y uno por pantalla suelta (cada pantalla depende de su player), más las
// cámaras y el audio que se hayan contado. Los códigos se sugieren; el titular los revisa antes del alta.
export function construirCis(plan, { prefijo, camaras = 0, altavoces = 0, players = null } = {}) {
  const P = PREFIJO_RE.test(prefijo || '') ? prefijo : prefijoDe(plan.id);
  const pantallas = plan.pantallas || [];
  const cis = [], porConjunto = new Map();
  let nPly = 0, nPan = 0;
  // Con un número de players dicho («dos players»), los conjuntos (mosaico o pantalla suelta) se reparten entre ellos.
  const conjuntos = [...new Set(pantallas.map(s => s.grupo ? 'g:' + s.grupo : 's:' + s.id))];
  const reparto = Number.isInteger(players) && players > 0 && players < conjuntos.length ? new Map(conjuntos.map((c, i) => [c, 'r:' + (i % players)])) : null;
  const playerDe = s => {
    const clave = reparto ? reparto.get(s.grupo ? 'g:' + s.grupo : 's:' + s.id) : s.grupo ? 'g:' + s.grupo : 's:' + s.id;
    if (porConjunto.has(clave)) return porConjunto.get(clave);
    const code = `${P}-PLY-${dos(++nPly)}`;
    const nombre = reparto ? `Player ${nPly}` : s.grupo ? `Player · ${s.grupoNombre || s.grupo}` : `Player · ${s.nombre || s.id}`;
    cis.push({ itil_code: code, name: limpio(nombre), category: 'player', role: s.grupo ? 'player del mosaico' : 'player', group_name: limpio(s.grupoNombre || nombreParedDe(plan, s.pared), 80), position: limpio(`Pared ${nombreParedDe(plan, s.pared)}`, 120), orientation: '', parent_itil_code: '' });
    porConjunto.set(clave, code);
    return code;
  };
  for (const s of pantallas) {
    const parent = playerDe(s);
    cis.push({ itil_code: `${P}-PAN-${dos(++nPan)}`, name: limpio(s.nombre || `Pantalla ${nPan}`), category: 'pantalla', role: limpio(s.grupoNombre ? `${s.grupoNombre}` : s.escaparate ? 'escaparate' : 'pantalla', 80),
      group_name: limpio(s.grupoNombre || nombreParedDe(plan, s.pared), 80), position: limpio(`Pared ${nombreParedDe(plan, s.pared)} · centro a ${fmt(s.s)} m · base a ${fmt(s.z)} m`, 120),
      orientation: s.orientacion === 'vertical' ? 'vertical' : 'horizontal', parent_itil_code: parent, pantalla: s.id });
  }
  // Players primero (el orden de alta los necesita antes que sus pantallas).
  cis.sort((a, b) => (a.category === 'player' ? 0 : 1) - (b.category === 'player' ? 0 : 1));
  for (let i = 1; i <= Math.min(20, camaras); i++) cis.push({ itil_code: `${P}-CAM-${dos(i)}`, name: `Cámara ${i}`, category: 'iot', role: 'cámara', group_name: 'Sensores', position: '', orientation: '', parent_itil_code: '' });
  for (let i = 1; i <= Math.min(20, altavoces); i++) cis.push({ itil_code: `${P}-AUD-${dos(i)}`, name: `Audio ${i}`, category: 'audio', role: 'hilo musical', group_name: 'Audio', position: '', orientation: '', parent_itil_code: '' });
  return cis.slice(0, MAX_CIS);
}
// Revisión de la lista (lo que el usuario editó): códigos con el regex de Yokup, únicos, categorías válidas y
// relaciones a CI de la propia lista. Devuelve los errores por fila y el orden de alta (padres antes).
export function revisarCis(cis) {
  const errores = [], codes = new Map();
  (cis || []).forEach((c, i) => {
    const code = String(c.itil_code || '');
    if (!ITIL_RE.test(code)) errores.push({ fila: i, campo: 'itil_code', codigo: 'formato' });
    else if (codes.has(code)) errores.push({ fila: i, campo: 'itil_code', codigo: 'repetido' });
    codes.set(code, i);
    if (!limpio(c.name)) errores.push({ fila: i, campo: 'name', codigo: 'vacio' });
    if (!CATEGORIAS.includes(c.category)) errores.push({ fila: i, campo: 'category', codigo: 'categoria' });
  });
  (cis || []).forEach((c, i) => {
    if (c.parent_itil_code && !codes.has(c.parent_itil_code)) errores.push({ fila: i, campo: 'parent_itil_code', codigo: 'padre' });
    if (c.parent_itil_code && c.parent_itil_code === c.itil_code) errores.push({ fila: i, campo: 'parent_itil_code', codigo: 'ciclo' });
  });
  if ((cis || []).length > MAX_CIS) errores.push({ fila: -1, campo: '', codigo: 'demasiados' });
  return { ok: !errores.length, errores, orden: ordenAlta(cis || []) };
}
// Padres antes que hijos (players antes que pantallas); los ciclos quedan al final, marcados por revisarCis.
export function ordenAlta(cis) {
  const porCode = new Map(cis.map(c => [c.itil_code, c])), hecho = new Set(), out = [];
  const visita = (c, pila = new Set()) => {
    if (hecho.has(c.itil_code) || pila.has(c.itil_code)) return;
    pila.add(c.itil_code);
    const p = c.parent_itil_code && porCode.get(c.parent_itil_code);
    if (p) visita(p, pila);
    hecho.add(c.itil_code); out.push(c);
  };
  cis.forEach(c => visita(c));
  return out;
}
// Pone los códigos en el plano: cada pantalla con su CI y los players como dispositivos (yokup.itil cruza los dos).
export function planConItil(plan, cis) {
  const p = clone(plan), porPantalla = new Map(cis.filter(c => c.pantalla).map(c => [c.pantalla, c]));
  p.pantallas = (p.pantallas || []).map(s => { const c = porPantalla.get(s.id); return c ? { ...s, itil: c.itil_code, player: c.parent_itil_code || s.player } : s; });
  const players = cis.filter(c => c.category === 'player');
  const otros = (p.dispositivos || []).filter(d => !players.some(c => c.itil_code === d.itil));
  p.dispositivos = otros.concat(players.map(c => {
    const hija = cis.find(x => x.parent_itil_code === c.itil_code && x.pantalla), s = hija && p.pantallas.find(x => x.id === hija.pantalla);
    return { id: c.itil_code.toLowerCase(), nombre: c.name, categoria: 'player', rol: c.role, itil: c.itil_code, ...(s ? { pared: s.pared } : {}) };
  }));
  p.fuente = { ...(p.fuente || {}), itil: 'Códigos ITIL sugeridos por el Arquitecto; el alta la confirma el titular en Yokup, el maestro del ITIL' };
  return p;
}

// ── Traspaso al Portal del comercio de Yokup (sin servidores: en el #fragmento) ───────────────────────────
// {schema, creado, origen, xpacio:{id, nombre, tipo}, prefijo, plan, cis}. v0 = base64url del JSON; v1 = el JSON
// comprimido (deflate-raw) en base64url. El portal (yokup-site/arquitecto-traspaso.js) lo lee con los mismos límites.
export function inventarioTraspaso({ plan, cis, tipo, prefijo, creado = new Date().toISOString() }) {
  const limpios = (cis || []).map(c => ({ itil_code: c.itil_code, name: limpio(c.name), category: c.category, role: limpio(c.role, 80), group_name: limpio(c.group_name, 80), position: limpio(c.position, 120), orientation: c.orientation || '', parent_itil_code: c.parent_itil_code || '' }));
  return { schema: TRASPASO_SCHEMA, creado, origen: ESTUDIO_URL, xpacio: { id: plan.id, nombre: limpio(plan.nombre, 120), tipo: TIPOS[tipo] ? tipo : (plan.generador && plan.generador.tipo) || '' }, prefijo: prefijo || '', plan: planConItil(plan, cis || []), cis: limpios };
}
const b64url = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
async function deflar(bytes) {
  const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
// → {ok, fragmento, bytes, formato} | {ok:false, error:'grande'|'json'}.
export async function codificarTraspaso(inv, { comprimir = typeof CompressionStream === 'function' } = {}) {
  let json;
  try { json = JSON.stringify(inv); } catch { return { ok: false, error: 'json' }; }
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > MAX_TRASPASO_JSON) return { ok: false, error: 'grande', bytes: bytes.length };
  const fragmento = comprimir ? 'v1.' + b64url(await deflar(bytes)) : 'v0.' + b64url(bytes);
  if (fragmento.length > MAX_FRAGMENTO) return { ok: false, error: 'grande', bytes: bytes.length, fragmento: fragmento.length };
  return { ok: true, fragmento, bytes: bytes.length, formato: fragmento.slice(0, 2) };
}
export const urlPortal = (fragmento, base = PORTAL_IMPORTAR) => `${base}#arquitecto=${fragmento}`;

// ── Mensajes con la nube (digitalavatar.ai/nube.html?personaje=arquitecto) ────────────────────────────────
export const ESTADOS_NUBE = Object.freeze(['reposo', 'escuchando', 'midiendo', 'dibujando', 'entregando', 'dudando']);
export const CARA_ORIGEN = 'https://digitalavatar.ai';
export function caraUrl({ base = CARA_ORIGEN + '/nube.html', lang = 'es' } = {}) {
  const u = new URL(base);
  u.searchParams.set('personaje', 'arquitecto'); u.searchParams.set('embed', '0'); u.searchParams.set('dock', '1');
  u.searchParams.set('lang', lang === 'en' ? 'en' : 'es'); u.searchParams.set('tier', 'good');
  return u.href;
}
// Solo en localhost se puede apuntar a copias locales (?cara=, ?estimar=): en producción, siempre las de verdad.
export function baseLocal(valor, origenPagina) {
  try {
    if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(new URL(origenPagina).origin)) return '';
    const u = new URL(valor);
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(u.origin) ? u.href.replace(/\/$/, '') : '';
  } catch { return ''; }
}
// Lo que manda la nube: {type:'da-arquitecto-orden', orden, texto}. Sólo de su ventana y su origen.
export function ordenDeNube(ev, { ventana, origen }) {
  const d = ev && ev.data;
  if (!d || typeof d !== 'object' || d.type !== 'da-arquitecto-orden') return null;
  if (ev.source !== ventana || ev.origin !== origen) return null;
  return { orden: ORDENES.includes(d.orden) ? d.orden : '', texto: limpio(d.texto, MAX_DESCRIPCION) };
}
export const ESTIMAR_URL = ESTIMADOR;
export { composition, footprint, wallLength, normalizarId };
