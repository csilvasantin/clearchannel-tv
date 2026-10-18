// Arquitecto · orden «modelar» en la página (lo puro está en arquitecto-modelar.mjs).
// Izquierda: el local, el resumen de su plano, los avisos y las salidas (gemelo 3D, colocación en JSON y planta en DXF).
// Derecha: la planta con cada pieza donde va y la tabla de la colocación. Nada sale del navegador salvo los enlaces
// al gemelo de xpaceos.com, que pinta el plano publicado.
import { resumenModelo, colocacionDatos, dxfPlanta, layoutGemelo, tipoMueble, urlGemelo3D, urlGemelo2D, urlCopiaPublica } from './arquitecto-modelar.mjs?v=20261018-modelar-1';

const TEXTOS = {
  es: {
    lead: 'Del plano del local al gemelo: cada pieza con su sitio como datos, el gemelo 3D con los modelos del catálogo y la planta en DXF para cualquier programa de CAD.',
    local: 'Local (Xpacio)', cargando: 'Buscando el plano del local…', sinPlano: id => `No encuentro el plano de «${id || '—'}». Créalo con /arquitecto crear o súbelo en plano.html.`,
    titulo: 'Gemelo desde el plano', resumen: 'El plano', sala: 'Sala', paredes: 'Paredes y huecos', muebles: 'Muebles', piezas: 'Piezas del catálogo', pantallas: 'Pantallas',
    ninguna: 'ninguna', salidas: 'Salidas', abrir3d: 'Abrir el gemelo 3D', abrir2d: 'Abrir el gemelo de la tienda', dxf: 'Descargar planta (DXF)', json: 'Descargar colocación (JSON)',
    descargado: f => `Descargado: ${f}.`, avisos: 'Avisos',
    aviso: { 'tipo-deducido': a => `${a.n} mueble${a.n === 1 ? '' : 's'} sin tipo en el plano: se deduce por el nombre.`, 'sin-gemelo-2d': () => 'Ningún mueble está enlazado con el gemelo de la tienda (campo «gemelo»).',
      fuera: a => `Fuera de la sala: ${a.ids.join(', ')}.`, esquematico: () => 'Plano esquemático: medidas nominales, por confirmar en visita técnica.' },
    tabla: ['Pieza', 'Tipo', 'x', 'y', 'Huella', 'Catálogo', 'Gemelo'], tablaTitulo: 'Colocación', leyenda: 'En amarillo, las piezas con modelo 3D del catálogo de xpaceos.',
    planoSala: (n, a, f) => `Planta de ${n}: sala de ${a} × ${f} m.`, solo3d: 'El gemelo 3D pinta el plano publicado del local; un plano que sólo está en este navegador aún no llega.',
    sinCopia: 'Este local aún no tiene copia pública en xpaceos: el gemelo 3D sólo se abre con la sesión de Admira iniciada (lee el plano de admira.biz).'
  },
  en: {
    lead: 'From the venue floor plan to its twin: every piece placed as data, the 3D twin with catalogue models and the floor plan as DXF for any CAD program.',
    local: 'Venue (Xpace)', cargando: 'Looking for the venue floor plan…', sinPlano: id => `I can’t find the floor plan of “${id || '—'}”. Create it with /arquitecto crear or upload it in plano.html.`,
    titulo: 'Twin from the floor plan', resumen: 'The floor plan', sala: 'Room', paredes: 'Walls and openings', muebles: 'Furniture', piezas: 'Catalogue pieces', pantallas: 'Screens',
    ninguna: 'none', salidas: 'Outputs', abrir3d: 'Open the 3D twin', abrir2d: 'Open the store twin', dxf: 'Download floor plan (DXF)', json: 'Download placement (JSON)',
    descargado: f => `Downloaded: ${f}.`, avisos: 'Warnings',
    aviso: { 'tipo-deducido': a => `${a.n} item${a.n === 1 ? '' : 's'} without a type in the plan: inferred from the name.`, 'sin-gemelo-2d': () => 'No item is linked to the store twin (“gemelo” field).',
      fuera: a => `Outside the room: ${a.ids.join(', ')}.`, esquematico: () => 'Schematic plan: nominal sizes, to be confirmed on a site visit.' },
    tabla: ['Piece', 'Type', 'x', 'y', 'Footprint', 'Catalogue', 'Twin'], tablaTitulo: 'Placement', leyenda: 'In yellow, pieces with a 3D model from the xpaceos catalogue.',
    planoSala: (n, a, f) => `Floor plan of ${n}: ${a} × ${f} m room.`, solo3d: 'The 3D twin draws the venue’s published floor plan; a plan that only lives in this browser does not reach it yet.',
    sinCopia: 'This venue has no public copy on xpaceos yet: the 3D twin only opens with an Admira session (it reads the plan from admira.biz).'
  }
};

const el = (tag, attrs = {}, ...hijos) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) { if (k === 'class') n.className = v; else if (k in n && k !== 'list') n[k] = v; else n.setAttribute(k, v === true ? '' : v); }
  n.append(...hijos.filter(h => h != null)); return n;
};
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, texto) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); if (texto != null) n.textContent = texto; return n; };

export function montarModelar({ pane, card, getLang = () => 'es', status = () => {}, localInicial = '', leerPlano = async () => null }) {
  const st = { plano: null, local: null, buscando: false, copia: null };
  const t = (k, ...a) => { const v = TEXTOS[getLang() === 'en' ? 'en' : 'es'][k]; return typeof v === 'function' ? v(...a) : v; };
  const num = (v, d = 2) => Number(v).toLocaleString(getLang() === 'en' ? 'en-GB' : 'es-ES', { maximumFractionDigits: d });

  // ── Izquierda ──
  const lead = el('p', { class: 'arq-lead' });
  const inLocal = el('input', { id: 'md-local', maxlength: 80, autocomplete: 'off', spellcheck: false, value: localInicial || 'alsea-sbux-021' });
  const lLocal = el('span');
  const resumen = el('dl', { id: 'md-resumen', class: 'md-resumen' });
  const avisos = el('ul', { id: 'md-avisos', class: 'arq-dudas', hidden: true });
  const a3d = el('a', { id: 'md-3d', class: 'arq-btn arq-btn-ok', target: '_blank', rel: 'noopener' });
  const a2d = el('a', { id: 'md-2d', class: 'arq-btn', target: '_blank', rel: 'noopener', hidden: true });
  const bDxf = el('button', { type: 'button', id: 'md-dxf', class: 'arq-btn' }), bJson = el('button', { type: 'button', id: 'md-json', class: 'arq-btn' });
  const nota = el('p', { class: 'hint', id: 'md-nota' });
  const lSalidas = el('strong');
  pane.replaceChildren(lead, el('label', { class: 'arq-field' }, lLocal, inLocal), resumen, avisos,
    el('div', { class: 'arq-cis-head' }, lSalidas), el('div', { class: 'arq-actions md-salidas' }, a3d, a2d, bDxf, bJson), nota);

  // ── Derecha ──
  const titulo = el('h2', { id: 'md-titulo' });
  const caja = el('div', { id: 'md-plano', class: 'dt-plano' });
  const leyenda = el('p', { class: 'hint', id: 'md-leyenda' });
  const tTabla = el('h3', { class: 'dt-titulo-plano' });
  const tabla = el('table', { id: 'md-tabla', class: 'md-tabla' });
  card.replaceChildren(el('div', { class: 'card-head' }, titulo), caja, leyenda, tTabla, el('div', { class: 'md-tabla-wrap' }, tabla));

  // ── Plano del local ──
  let pedido = 0, espera = 0;
  async function cargar() {
    const id = inLocal.value.trim(); if (id === st.local) return;
    const n = ++pedido; st.local = id; st.plano = null; st.buscando = true; pintar();
    const plano = await leerPlano(id).catch(() => null);
    if (n !== pedido) return;
    st.buscando = false; st.plano = resumenModelo(plano).ok ? plano : null; st.copia = null; pintar();
    // ¿Tiene el local copia pública en xpaceos? Sin ella, el gemelo 3D sólo se abre con sesión.
    if (st.plano) {
      const copia = await fetch(urlCopiaPublica(st.plano.id), { cache: 'no-store' }).then(r => r.ok && /json/.test(r.headers.get('content-type') || '')).catch(() => false);
      if (n === pedido) { st.copia = copia; pintar(); }
    }
  }
  inLocal.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(cargar, 600); });
  inLocal.addEventListener('change', () => { clearTimeout(espera); cargar(); });

  // ── Descargas ──
  const fecha = () => new Date().toISOString().slice(0, 10);
  function bajar(nombre, texto, tipo) {
    const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
    const a = el('a', { href: url, download: nombre }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    status(t('descargado', nombre));
  }
  bDxf.addEventListener('click', () => { if (st.plano) bajar(`${st.plano.id}-planta.dxf`, dxfPlanta(st.plano, { fecha: fecha() }).dxf, 'application/dxf'); });
  bJson.addEventListener('click', () => { if (st.plano) bajar(`${st.plano.id}-colocacion.json`, JSON.stringify(colocacionDatos(st.plano, { fecha: fecha() }), null, 1) + '\n', 'application/json'); });

  // ── Pintar ──
  function pintarResumen() {
    const pl = st.plano, r = pl && resumenModelo(pl);
    if (!r) { resumen.replaceChildren(el('dd', {}, st.buscando ? t('cargando') : t('sinPlano', st.local || inLocal.value.trim()))); avisos.hidden = true; return; }
    const fila = (k, v) => [el('dt', {}, t(k)), el('dd', {}, v)];
    resumen.replaceChildren(
      ...fila('sala', `${num(r.sala.ancho)} × ${num(r.sala.fondo)} m · ${getLang() === 'en' ? 'ceiling' : 'techo'} ${num(r.sala.alto)} m`),
      ...fila('paredes', `${r.paredes} · ${r.huecos}`), ...fila('muebles', String(r.muebles)),
      ...fila('piezas', r.piezasCatalogo.length ? r.piezasCatalogo.map(p => `${p.nombre} (#${p.numero})`).join(' · ') : t('ninguna')),
      ...fila('pantallas', String(r.pantallas)));
    const textos = r.avisos.map(a => (TEXTOS[getLang() === 'en' ? 'en' : 'es'].aviso[a.codigo] || (() => a.codigo))(a));
    avisos.replaceChildren(...(textos.length ? [el('li', { class: 'cab' }, t('avisos')), ...textos.map(x => el('li', { class: 'aviso' }, x))] : []));
    avisos.hidden = !textos.length;
  }
  function pintarSalidas() {
    const pl = st.plano;
    for (const b of [bDxf, bJson]) b.disabled = !pl;
    a3d.textContent = t('abrir3d'); a2d.textContent = t('abrir2d'); bDxf.textContent = t('dxf'); bJson.textContent = t('json');
    if (pl) { a3d.href = urlGemelo3D(pl.id); a3d.removeAttribute('aria-disabled'); } else { a3d.removeAttribute('href'); a3d.setAttribute('aria-disabled', 'true'); }
    const u2 = pl && urlGemelo2D(pl.id); a2d.hidden = !u2; if (u2) a2d.href = u2;
  }
  function pintarPlano() {
    const pl = st.plano;
    titulo.textContent = pl ? `${t('titulo')} · ${pl.nombre || pl.id}` : t('titulo');
    if (!pl) { caja.replaceChildren(); tabla.replaceChildren(); leyenda.textContent = ''; tTabla.textContent = ''; return; }
    const { ancho, fondo } = pl.planta, m = 0.35;
    const svg = sv('svg', { viewBox: `${-m} ${-m} ${ancho + 2 * m} ${fondo + 2 * m}`, class: 'dt-plano-svg md-plano-svg', id: 'md-plano-svg', role: 'img', 'aria-label': t('planoSala', pl.nombre || pl.id, num(ancho), num(fondo)) });
    svg.append(sv('rect', { x: 0, y: 0, width: ancho, height: fondo, class: 'sala' }));
    for (const h of pl.huecos || []) {
      const w = (pl.paredes || []).find(q => q.id === h.pared); if (!w) continue;
      const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1, ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L, d0 = +h.desde || 0, d1 = d0 + (+h.ancho || 0);
      svg.append(sv('line', { x1: w.a[0] + ux * d0, y1: w.a[1] + uy * d0, x2: w.a[0] + ux * d1, y2: w.a[1] + uy * d1, class: 'hueco' }));
    }
    for (const it of pl.mobiliario || []) {
      if (![it.x, it.y, it.w, it.d].every(Number.isFinite)) continue;
      const cat = it.catalogo && it.catalogo.numero, cesta = tipoMueble(it) === 'cesta', g = sv('g', { class: cat ? 'md-pieza-cat' : 'md-pieza' });
      g.append(sv('title', {}, `${it.nombre || it.id} · ${tipoMueble(it)}${cat ? ` · #${cat}` : ''}`));
      g.append(cesta ? sv('circle', { cx: it.x + it.w / 2, cy: it.y + it.d / 2, r: Math.min(it.w, it.d) / 2, class: cat ? 'pieza-cat' : 'mueble' })
        : sv('rect', { x: it.x, y: it.y, width: it.w, height: it.d, class: cat ? 'pieza-cat' : 'mueble' }));
      if (!cat) g.append(sv('text', { x: it.x + it.w / 2, y: it.y + it.d / 2, class: 'mueble-txt', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 0.24 }, String(it.nombre || it.id)));
      else g.append(sv('text', { x: it.x + it.w / 2, y: it.y + it.d + 0.2, class: 'pieza-cat-txt', 'text-anchor': 'middle', 'font-size': 0.2 }, `#${cat}`));
      svg.append(g);
    }
    caja.replaceChildren(svg);
    leyenda.textContent = t('leyenda');
    tTabla.textContent = t('tablaTitulo');
    const lay = new Map(layoutGemelo(pl).map((x, i) => [i, x]));
    tabla.replaceChildren(el('thead', {}, el('tr', {}, ...t('tabla').map(h => el('th', {}, h)))),
      el('tbody', {}, ...(pl.mobiliario || []).map((it, i) => el('tr', {},
        el('td', {}, it.nombre || it.id), el('td', {}, tipoMueble(it)), el('td', {}, num(it.x)), el('td', {}, num(it.y)), el('td', {}, `${num(it.w)} × ${num(it.d)}`),
        el('td', {}, it.catalogo && it.catalogo.numero ? `#${it.catalogo.numero}` : '—'), el('td', {}, it.gemelo ? lay.get(i).id : '—')))));
  }
  function pintar() {
    lead.textContent = t('lead'); lLocal.textContent = t('local'); lSalidas.textContent = t('salidas'); nota.textContent = st.plano && st.copia === false ? t('sinCopia') : t('solo3d');
    pintarResumen(); pintarSalidas(); pintarPlano();
  }
  pintar(); cargar();
  return { setLang: pintar, estado: () => st };
}
