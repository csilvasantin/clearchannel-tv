// Arquitecto · orden «modelar» (Carlos, 18-oct-2026: «del plano del local al gemelo 3D con la colocación como datos y
// la planta en DXF»). Sin DOM: lo usan arquitecto-modelar-ui.mjs y los tests.
//
// El plano `admira.xpacio-plano/1` es la fuente: cada mueble puede decir su `tipo`, su pieza del catálogo de xpaceos
// (`catalogo: {id: 'native:…', numero}`), su elemento en el gemelo (`gemelo`), su altura de montaje (`base`) y su código
// ITIL (`itil`). De ahí salen:
//   · la colocación como datos (admira.xpacio-colocacion/1), con el layout del gemelo 2D/Matrix de XpaceOS
//     (col = x, row = y, fp = [w, d], origen en la esquina de la huella);
//   · el gemelo 3D, que pinta xpaceos.com/xpacios/… desde el mismo plano (con los modelos del catálogo);
//   · la planta en DXF (R12, metros), que abre cualquier programa de CAD.
// tipoMueble y layoutGemelo son copia de xpacios/gran-de-gracia-51/plano3d.mjs de xpaceos, para que el Arquitecto y
// el gemelo clasifiquen y coloquen igual (los tests de los dos repos comprueban Paseo de Gràcia pieza a pieza).

import { wallLength, pointOnWall, inwardNormal, footprint, round } from './plano-core.mjs?v=20261014-plano-1';

export const COLOCACION_SCHEMA = 'admira.xpacio-colocacion/1';
export const XPACEOS = 'https://www.xpaceos.com';
// Páginas propias del gemelo 3D; el resto de locales se pinta con la del laboratorio y ?loc=.
const PAGINAS_3D = { 'alsea-sbux-021': '/xpacios/starbucks-paseo-de-gracia/', 'lab-gran-de-gracia-51': '/xpacios/gran-de-gracia-51/' };
// Copia pública del plano en xpaceos (la que pinta el gemelo 3D sin sesión).
export const urlCopiaPublica = id => `${XPACEOS}/data/xpacios/${encodeURIComponent(id)}.json`;
export const urlGemelo3D = id => `${XPACEOS}${PAGINAS_3D[id] || `/xpacios/gran-de-gracia-51/?loc=${encodeURIComponent(id)}`}`;
// Gemelo 2D/Matrix de XpaceOS: sólo Paseo de Gràcia tiene hoy su sala dibujada (starbucks-room.js).
const GEMELOS_2D = { 'alsea-sbux-021': '/admira-xp/?loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks&quality=good' };
export const urlGemelo2D = id => (GEMELOS_2D[id] ? XPACEOS + GEMELOS_2D[id] : null);

// ── Tipos de mueble ─────────────────────────────────────────────────────────
export const TIPOS_MUEBLE = ['mesa', 'silla', 'nevera', 'recreativa', 'barra', 'caja', 'vitrina', 'estanteria', 'pilar', 'cesta', 'ipad', 'mueble'];
export function tipoMueble(m) {
  if (TIPOS_MUEBLE.includes(m.tipo)) return m.tipo;
  const t = `${m.id} ${m.nombre || ''}`.toLowerCase();
  if (/mesa|desk/.test(t)) return 'mesa';
  if (/silla|chair/.test(t)) return 'silla';
  if (/nevera|frigor|fridge/.test(t)) return 'nevera';
  if (/recreativa|arcade/.test(t)) return 'recreativa';
  if (/barra|mostrador|counter/.test(t)) return 'barra';
  if (/\bcaja\b|tpv|checkout/.test(t)) return 'caja';
  if (/vitrina|display case/.test(t)) return 'vitrina';
  if (/taza|estanter|shelf/.test(t)) return 'estanteria';
  if (/pilar|columna|pillar|column/.test(t)) return 'pilar';
  return 'mueble';
}
export const TIPO_GEMELO = { barra: 'counter', caja: 'counter', vitrina: 'vending', estanteria: 'shelves', pilar: 'custom', mesa: 'cafeTable',
  silla: 'chair', nevera: 'fridge', recreativa: 'arcade', mueble: 'custom' };
const catalogoDe = m => (m.catalogo && /^native:[A-Za-z0-9]{1,64}$/.test(m.catalogo.id || '') && Number.isSafeInteger(m.catalogo.numero) && m.catalogo.numero > 0) ? m.catalogo : null;
export const modeloCatalogo = (m, calidad = 'better') => (catalogoDe(m) ? `${XPACEOS}/inventario/assets/catalog/${m.catalogo.numero}/${calidad}.glb` : null);

// Layout del gemelo 2D/Matrix de XpaceOS a partir del plano.
export function layoutGemelo(plan) {
  return ((plan && plan.mobiliario) || []).map(m => {
    const tipo = tipoMueble(m), cat = catalogoDe(m);
    return { id: m.gemelo || m.id, type: cat ? cat.id.slice(7) : TIPO_GEMELO[tipo] || 'custom', ...(cat ? { inventoryAssetId: cat.id } : {}),
      col: m.x, row: m.y, fp: [m.w, m.d], label: m.nombre || m.id, ...(m.base > 0 ? { mountY: m.base } : {}) };
  });
}

// ── Resumen y avisos del plano para modelar ─────────────────────────────────
const planoValido = p => !!(p && p.planta && p.planta.ancho > 0 && p.planta.fondo > 0 && p.planta.alto > 0 && Array.isArray(p.paredes) && p.paredes.length >= 3);
export function resumenModelo(plan) {
  if (!planoValido(plan)) return { ok: false, errores: ['plano'], avisos: [] };
  const muebles = plan.mobiliario || [], pantallas = plan.pantallas || [];
  const avisos = [];
  const deducidos = muebles.filter(m => !TIPOS_MUEBLE.includes(m.tipo)).length;
  if (deducidos) avisos.push({ codigo: 'tipo-deducido', n: deducidos });
  const sinGemelo = muebles.filter(m => !m.gemelo).length;
  if (muebles.length && sinGemelo === muebles.length) avisos.push({ codigo: 'sin-gemelo-2d' });
  const fuera = muebles.filter(m => !(m.x >= -1e-6 && m.y >= -1e-6 && m.x + m.w <= plan.planta.ancho + 1e-6 && m.y + m.d <= plan.planta.fondo + 1e-6)).map(m => m.id);
  if (fuera.length) avisos.push({ codigo: 'fuera', ids: fuera });
  if (/esquem|por confirmar|supuest/i.test(JSON.stringify(plan.fuente || {}))) avisos.push({ codigo: 'esquematico' });
  return {
    ok: true, errores: [], avisos,
    sala: { ancho: plan.planta.ancho, fondo: plan.planta.fondo, alto: plan.planta.alto },
    paredes: plan.paredes.length, huecos: (plan.huecos || []).length, muebles: muebles.length,
    piezasCatalogo: muebles.filter(catalogoDe).map(m => ({ id: m.id, nombre: m.nombre, numero: m.catalogo.numero })),
    pantallas: pantallas.length
  };
}

// ── Colocación como datos ───────────────────────────────────────────────────
export function colocacionDatos(plan, { fecha = new Date().toISOString().slice(0, 10) } = {}) {
  if (!planoValido(plan)) throw new Error('plano');
  return {
    schema: COLOCACION_SCHEMA, xpacio: plan.id, nombre: plan.nombre || plan.id,
    plano: { id: plan.id, version: plan.version || null }, generado: { por: 'admira.biz/arquitecto · modelar', fecha },
    unidades: 'metros · x a lo ancho, y hacia el fondo, origen en la esquina de la huella',
    sala: { ancho: plan.planta.ancho, fondo: plan.planta.fondo, alto: plan.planta.alto },
    piezas: (plan.mobiliario || []).map(m => ({
      id: m.id, nombre: m.nombre || m.id, tipo: tipoMueble(m), x: m.x, y: m.y, w: m.w, d: m.d, alto: m.alto,
      ...(m.base > 0 ? { base: m.base } : {}), ...(catalogoDe(m) ? { catalogo: { id: m.catalogo.id, numero: m.catalogo.numero }, modelo: modeloCatalogo(m) } : {}),
      ...(m.gemelo ? { gemelo: m.gemelo } : {}), ...(m.itil ? { itil: m.itil } : {})
    })),
    pantallas: (plan.pantallas || []).map(s => { const f = footprint(s); return { id: s.id, nombre: s.nombre || s.id, pared: s.pared, s: s.s, z: s.z, w: round(f.w), h: round(f.h), orientacion: s.orientacion || 'horizontal' }; }),
    gemelo: { layout: layoutGemelo(plan), url3d: urlGemelo3D(plan.id), url2d: urlGemelo2D(plan.id) }
  };
}

// ── Planta en DXF (AutoCAD R12, ASCII, metros) ───────────────────────────────
// Capas: MUROS, PUERTAS, HUECOS, MOBILIARIO, PIEZAS, PANTALLAS, COTAS, TEXTOS. El eje y del DXF sube: se dibuja
// Y = fondo − y, así la pared del fondo (y = 0) queda arriba, como en el plano del Arquitecto.
export const CAPAS_DXF = Object.freeze({ MUROS: 7, PUERTAS: 3, HUECOS: 4, MOBILIARIO: 8, PIEZAS: 2, PANTALLAS: 5, COTAS: 1, TEXTOS: 7 });
const GROSOR = 0.12;
const nf = v => { const r = Math.round(v * 10000) / 10000; return Object.is(r, -0) ? '0' : String(r); };
// R12 es ANSI y cada programa lee los códigos \U+ a su manera: los textos van en ASCII llano (sin tildes, «·» → «-»).
const ASCII = { '·': '-', '×': 'x', '–': '-', '—': '-', '«': '"', '»': '"', '“': '"', '”': '"', '‘': "'", '’': "'", 'º': 'o', 'ª': 'a', '°': 'o', 'ß': 'ss', 'ø': 'o', 'Ø': 'O', 'æ': 'ae', 'Æ': 'AE' };
export const txt = s => String(s ?? '').replace(/[\r\n]+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x20-\x7e]/g, c => ASCII[c] ?? '?');
const grados = (x, y) => { const a = Math.atan2(y, x) * 180 / Math.PI; return a < 0 ? a + 360 : a; };

export function dxfPlanta(plan, { fecha = new Date().toISOString().slice(0, 10) } = {}) {
  if (!planoValido(plan)) throw new Error('plano');
  const F = plan.planta.fondo, A = plan.planta.ancho;
  const P = ([x, y]) => [x, F - y];                        // plano → DXF
  const out = [], cuenta = {};
  const g = (...pares) => { for (let i = 0; i < pares.length; i += 2) out.push(String(pares[i]), String(pares[i + 1])); };
  const ent = capa => { cuenta[capa] = (cuenta[capa] || 0) + 1; };
  const linea = (capa, a, b) => { ent(capa); const [x1, y1] = P(a), [x2, y2] = P(b); g(0, 'LINE', 8, capa, 10, nf(x1), 20, nf(y1), 30, 0, 11, nf(x2), 21, nf(y2), 31, 0); };
  const poli = (capa, pts) => { ent(capa); g(0, 'POLYLINE', 8, capa, 66, 1, 10, 0, 20, 0, 30, 0, 70, 1); for (const p of pts) { const [x, y] = P(p); g(0, 'VERTEX', 8, capa, 10, nf(x), 20, nf(y), 30, 0); } g(0, 'SEQEND', 8, capa); };
  const circulo = (capa, c, r) => { ent(capa); const [x, y] = P(c); g(0, 'CIRCLE', 8, capa, 10, nf(x), 20, nf(y), 30, 0, 40, nf(r)); };
  const arco = (capa, c, r, a0, a1) => { ent(capa); const [x, y] = P(c); g(0, 'ARC', 8, capa, 10, nf(x), 20, nf(y), 30, 0, 40, nf(r), 50, nf(a0), 51, nf(a1)); };
  const texto = (capa, p, h, s, centrado = true) => {
    ent(capa); const [x, y] = P(p);
    if (centrado) g(0, 'TEXT', 8, capa, 10, nf(x), 20, nf(y), 30, 0, 40, nf(h), 1, txt(s), 72, 1, 11, nf(x), 21, nf(y), 31, 0, 73, 2);
    else g(0, 'TEXT', 8, capa, 10, nf(x), 20, nf(y), 30, 0, 40, nf(h), 1, txt(s));
  };
  const mas = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];

  // Muros: tramos macizos entre huecos, con su grueso hacia fuera; los tramos de los extremos tapan la esquina.
  for (const w of plan.paredes) {
    const len = wallLength(w), u = [(w.b[0] - w.a[0]) / len, (w.b[1] - w.a[1]) / len], n = inwardNormal(w), fuera = [-n[0], -n[1]];
    const huecos = (plan.huecos || []).filter(h => h.pared === w.id).map(h => [Math.max(0, h.desde), Math.min(len, h.desde + h.ancho), h]).sort((a, b) => a[0] - b[0]);
    let s = 0;
    const tramo = (s0, s1) => {
      if (s1 - s0 < 1e-6) return;
      const e0 = s0 <= 1e-6 ? -GROSOR : 0, e1 = s1 >= len - 1e-6 ? GROSOR : 0;
      const p0 = pointOnWall(w, s0), p1 = pointOnWall(w, s1), q0 = mas(mas(p0, u, e0), fuera, GROSOR), q1 = mas(mas(p1, u, e1), fuera, GROSOR);
      poli('MUROS', [p0, p1, q1, q0]);
    };
    for (const [s0, s1, h] of huecos) {
      tramo(s, s0); s = Math.max(s, s1);
      const p0 = pointOnWall(w, s0), p1 = pointOnWall(w, s1);
      if (h.tipo === 'puerta') {
        // Hoja abierta hacia dentro con la bisagra en `desde` y su barrido de 90°.
        const r = s1 - s0, hoja = mas(p0, n, r);
        linea('PUERTAS', p0, hoja);
        const [ux, uy] = [u[0], -u[1]], [vx, vy] = [n[0], -n[1]];          // direcciones en el DXF (y invertida)
        const au = grados(ux, uy), an = grados(vx, vy), ccw = ((an - au + 360) % 360) <= 180;
        arco('PUERTAS', p0, r, ccw ? au : an, ccw ? an : au);
      } else {
        // Ventana o escaparate: el vidrio, en el medio del grueso del muro.
        const m0 = mas(p0, fuera, GROSOR / 2), m1 = mas(p1, fuera, GROSOR / 2);
        linea('HUECOS', m0, m1); linea('HUECOS', p0, mas(p0, fuera, GROSOR)); linea('HUECOS', p1, mas(p1, fuera, GROSOR));
      }
    }
    tramo(s, len);
  }

  // Mobiliario y piezas del catálogo (las cestas, en círculo).
  for (const m of plan.mobiliario || []) {
    const cat = catalogoDe(m), capa = cat ? 'PIEZAS' : 'MOBILIARIO', tipo = tipoMueble(m), c = [m.x + m.w / 2, m.y + m.d / 2];
    if (tipo === 'cesta') circulo(capa, c, Math.min(m.w, m.d) / 2);
    else poli(capa, [[m.x, m.y], [m.x + m.w, m.y], [m.x + m.w, m.y + m.d], [m.x, m.y + m.d]]);
    // Las piezas del catálogo son pequeñas: su nombre va debajo, no encima del dibujo.
    const h = cat ? 0.09 : Math.max(0.07, Math.min(0.16, Math.min(m.w, m.d) * 0.22));
    texto('TEXTOS', cat ? [c[0], m.y + m.d + 0.12] : c, h, `${(m.nombre || m.id).slice(0, 28)}${cat ? ` #${cat.numero}` : ''}`);
  }

  // Pantallas: su ancho sobre la pared, 6 cm hacia dentro, con orientación y pulgadas.
  for (const sc of plan.pantallas || []) {
    const w = plan.paredes.find(x => x.id === sc.pared); if (!w) continue;
    const f = footprint(sc), n = inwardNormal(w), p0 = pointOnWall(w, f.x0), p1 = pointOnWall(w, f.x1);
    poli('PANTALLAS', [p0, p1, mas(p1, n, 0.06), mas(p0, n, 0.06)]);
    texto('TEXTOS', mas(pointOnWall(w, sc.s), n, 0.25), 0.1, `${sc.corto || (sc.orientacion === 'vertical' ? 'V' : 'H')} ${sc.pulgadas || ''}"`.trim());
  }

  // Cotas generales y cajetín.
  const m2 = v => String(round(v, 2)).replace('.', ',');
  linea('COTAS', [0, -0.45], [A, -0.45]); linea('COTAS', [0, -0.35], [0, -0.55]); linea('COTAS', [A, -0.35], [A, -0.55]);
  texto('COTAS', [A / 2, -0.62], 0.16, `${m2(A)} m`);
  linea('COTAS', [A + 0.45, 0], [A + 0.45, F]); linea('COTAS', [A + 0.35, 0], [A + 0.55, 0]); linea('COTAS', [A + 0.35, F], [A + 0.55, F]);
  texto('COTAS', [A + 0.8, F / 2], 0.16, `${m2(F)} m`);
  texto('TEXTOS', [0, F + 0.55], 0.2, `${plan.nombre || plan.id} · planta · ${m2(A)} x ${m2(F)} m · techo ${m2(plan.planta.alto)} m`, false);
  texto('TEXTOS', [0, F + 0.85], 0.12, `Plano ${plan.id} ${plan.version || ''} · Arquitecto de admira.biz (modelar) · ${fecha} · unidades: metros${/esquem|por confirmar/i.test(JSON.stringify(plan.fuente || {})) ? ' · plano esquematico, medidas por confirmar' : ''}`, false);

  // Cabecera y tablas mínimas de R12.
  const head = [];
  const h = (...pares) => { for (let i = 0; i < pares.length; i += 2) head.push(String(pares[i]), String(pares[i + 1])); };
  h(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$DWGCODEPAGE', 3, 'ANSI_1252', 9, '$INSBASE', 10, 0, 20, 0, 30, 0,
    9, '$EXTMIN', 10, nf(-1), 20, nf(-1.2), 30, 0, 9, '$EXTMAX', 10, nf(A + 1.5), 20, nf(F + 1.2), 30, 0, 0, 'ENDSEC');
  h(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LTYPE', 70, 1, 0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, 0, 0, 'ENDTAB');
  h(0, 'TABLE', 2, 'LAYER', 70, Object.keys(CAPAS_DXF).length + 1, 0, 'LAYER', 2, '0', 70, 0, 62, 7, 6, 'CONTINUOUS');
  for (const [capa, color] of Object.entries(CAPAS_DXF)) h(0, 'LAYER', 2, capa, 70, 0, 62, color, 6, 'CONTINUOUS');
  h(0, 'ENDTAB', 0, 'TABLE', 2, 'STYLE', 70, 1, 0, 'STYLE', 2, 'STANDARD', 70, 0, 40, 0, 41, 1, 50, 0, 71, 0, 42, 0.2, 3, 'txt', 4, '', 0, 'ENDTAB', 0, 'ENDSEC');
  const cuerpo = ['0', 'SECTION', '2', 'ENTITIES', ...out, '0', 'ENDSEC', '0', 'EOF'];
  return { dxf: [...head, ...cuerpo].join('\n') + '\n', entidades: cuerpo.filter((v, i) => i % 2 === 1 && /^(LINE|POLYLINE|CIRCLE|ARC|TEXT)$/.test(v) && cuerpo[i - 1] === '0').length, capas: cuenta };
}
