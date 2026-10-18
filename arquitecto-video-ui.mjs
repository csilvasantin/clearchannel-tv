// Arquitecto · orden «video» en la página (lo puro está en arquitecto-video.mjs).
// Izquierda: grabar con XpaceScan, elegir la escena reconstruida, la medida tomada en el local y el plano resultante.
// Derecha: la nube vista desde arriba con la sala y los muebles que se ven en ella, y sus medidas.
// El vídeo no pasa por aquí: sólo se lee la nube de puntos de la escena (scan.admira.store).
import { SCAN_API, SCAN_APP, ALTO_SUPUESTO, REFERENCIAS, AJUSTES, leerPLY, levantar, escala, mueblesDetectados, planoDesdeLevantamiento } from './arquitecto-video.mjs?v=20261018-video-1';

const TEXTOS = {
  es: {
    lead: 'Del recorrido grabado con el móvil a un plano con medidas reales. XpaceScan graba y sube el vídeo; un Mac lo reconstruye en 3D; aquí saco el suelo, el techo y las paredes de la nube, y la escala con una medida que tomes en el local.',
    paso1: '1 · Graba el recorrido', grabar: 'Abrir XpaceScan en el móvil', consejos: 'Entre 60 y 120 segundos, andando despacio y sin girar de golpe. Que salgan todas las paredes, algo de suelo y de techo. Sin gente de frente si se puede.',
    paso2: '2 · Escena reconstruida', recargar: 'Recargar', cargando: 'Leyendo las escenas…', sinEscenas: 'Todavía no hay escenas.', escenasNo: 'No pude leer las escenas de XpaceScan.',
    estado: { uploading: 'subiendo', uploaded: 'subida, sin reconstruir', processing: 'reconstruyendo', ready: 'lista', error: 'error' },
    pendiente: id => `Esta escena aún no tiene nube: hay que reconstruirla en un Mac con COLMAP (scan-pull.sh ${id}).`,
    leyendo: 'Leyendo la nube de puntos…', nubeNo: 'No pude leer la nube de puntos de esta escena.',
    paso3: '3 · Una medida del local', ref: { alto: 'Alto libre (suelo a techo)', ancho: 'Ancho de la sala (lado largo)', fondo: 'Fondo de la sala (lado corto)' },
    valor: 'Metros', sinMedida: `Sin medida, supongo un techo de ${String(ALTO_SUPUESTO).replace('.', ',')} m: las medidas no serán reales.`,
    ajuste: 'Ajuste', ajustes: { paredes: 'Paredes claras (local rectangular)', envolvente: 'Todo lo que cubre la nube (local en L o con entrantes)' },
    invertir: 'Invertir suelo y techo', girar: 'Girar 90°', muebles: 'Incluir los muebles grandes que se ven',
    paso4: '4 · El plano', local: 'Local (id del plano)', nombre: 'Nombre', usar: 'Usar este plano', bajar: 'Descargar plano (JSON)', modelar: 'Pasar a «modelar»',
    usado: id => `Plano «${id}» guardado en este navegador: ábrelo en el plano o en «modelar».`, descargado: f => `Descargado: ${f}.`,
    titulo: 'Plano desde el vídeo', vacio: 'Elige una escena reconstruida a la izquierda.',
    datos: { puntos: 'Puntos', medidas: 'Sala', escala: 'Escala', confianza: 'Confianza', vistos: 'Suelo y techo en la nube', muebles: 'Muebles vistos' },
    conf: { alta: 'alta', media: 'media', baja: 'baja: revisa la vista y, si hace falta, gira, invierte o cambia el ajuste' },
    vistos: (s, t) => `${s ? 'suelo sí' : 'suelo no'} · ${t ? 'techo sí' : 'techo no'}`,
    consejoRef: 'El suelo o el techo apenas se ven: mejor una medida de ancho o de fondo que la del alto.',
    escalaTxt: e => e.supuesta ? `supuesta (techo ${String(ALTO_SUPUESTO).replace('.', ',')} m)` : `${e.tipo} = ${String(e.valor).replace('.', ',')} m`,
    leyenda: 'Vista desde arriba: en blanco las paredes y lo alto, en gris el suelo y lo bajo, en azul el techo; en rojo la sala; en amarillo, los muebles vistos.',
    idMal: 'El id del local: minúsculas, números y guiones (por ejemplo starbucks-diagonal).'
  },
  en: {
    lead: 'From a phone walkthrough to a floor plan with real measurements. XpaceScan records and uploads the video; a Mac rebuilds it in 3D; here I take the floor, ceiling and walls from the point cloud, and the scale from one measurement you take on site.',
    paso1: '1 · Record the walkthrough', grabar: 'Open XpaceScan on the phone', consejos: 'Between 60 and 120 seconds, walking slowly without sudden turns. Get every wall and some floor and ceiling. Avoid people facing the camera if possible.',
    paso2: '2 · Rebuilt scene', recargar: 'Reload', cargando: 'Reading the scenes…', sinEscenas: 'No scenes yet.', escenasNo: 'I could not read the XpaceScan scenes.',
    estado: { uploading: 'uploading', uploaded: 'uploaded, not rebuilt', processing: 'rebuilding', ready: 'ready', error: 'error' },
    pendiente: id => `This scene has no point cloud yet: it must be rebuilt on a Mac with COLMAP (scan-pull.sh ${id}).`,
    leyendo: 'Reading the point cloud…', nubeNo: 'I could not read this scene’s point cloud.',
    paso3: '3 · One on-site measurement', ref: { alto: 'Clear height (floor to ceiling)', ancho: 'Room width (long side)', fondo: 'Room depth (short side)' },
    valor: 'Metres', sinMedida: `Without a measurement I assume a ${ALTO_SUPUESTO} m ceiling: the sizes will not be real.`,
    ajuste: 'Fit', ajustes: { paredes: 'Clear walls (rectangular venue)', envolvente: 'Everything the cloud covers (L-shaped venue or recesses)' },
    invertir: 'Swap floor and ceiling', girar: 'Turn 90°', muebles: 'Include the large furniture seen',
    paso4: '4 · The floor plan', local: 'Venue (plan id)', nombre: 'Name', usar: 'Use this plan', bajar: 'Download plan (JSON)', modelar: 'Go to “model”',
    usado: id => `Plan “${id}” saved in this browser: open it in the floor plan or in “model”.`, descargado: f => `Downloaded: ${f}.`,
    titulo: 'Floor plan from the video', vacio: 'Pick a rebuilt scene on the left.',
    datos: { puntos: 'Points', medidas: 'Room', escala: 'Scale', confianza: 'Confidence', vistos: 'Floor and ceiling in the cloud', muebles: 'Furniture seen' },
    conf: { alta: 'high', media: 'medium', baja: 'low: check the view and turn, swap or change the fit if needed' },
    vistos: (s, t) => `${s ? 'floor yes' : 'floor no'} · ${t ? 'ceiling yes' : 'ceiling no'}`,
    consejoRef: 'Floor or ceiling barely show: a width or depth measurement is better than the height.',
    escalaTxt: e => e.supuesta ? `assumed (${ALTO_SUPUESTO} m ceiling)` : `${e.tipo} = ${e.valor} m`,
    leyenda: 'Top view: white for walls and tall things, grey for floor and low things, blue for the ceiling; the room in red; furniture seen in yellow.',
    idMal: 'The venue id: lowercase letters, digits and hyphens (for example starbucks-diagonal).'
  }
};

const el = (tag, attrs = {}, ...hijos) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) { if (k === 'class') n.className = v; else if (k in n && k !== 'list') n[k] = v; else n.setAttribute(k, v === true ? '' : v); }
  n.append(...hijos.filter(h => h != null)); return n;
};
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function montarVideo({ pane, card, getLang = () => 'es', status = () => {}, localInicial = '', usarPlano = async () => {}, abrirModelar = () => {}, fetchImpl = (...a) => fetch(...a) }) {
  const st = { escenas: null, escena: null, nube: null, lev: null, error: '', cargando: false, opciones: { ajuste: 'paredes', invertir: false, girar: false }, muebles: true };
  const t = (k, ...a) => { const v = TEXTOS[getLang() === 'en' ? 'en' : 'es'][k]; return typeof v === 'function' ? v(...a) : v; };
  const T = () => TEXTOS[getLang() === 'en' ? 'en' : 'es'];
  const num = (v, d = 2) => Number(v).toLocaleString(getLang() === 'en' ? 'en-GB' : 'es-ES', { maximumFractionDigits: d });

  // ── Izquierda ──
  const lead = el('p', { class: 'arq-lead' });
  const h1 = el('strong'), h2 = el('strong'), h3 = el('strong'), h4 = el('strong');
  const aGrabar = el('a', { id: 'vd-grabar', class: 'arq-btn', href: SCAN_APP, target: '_blank', rel: 'noopener' }), consejos = el('p', { class: 'hint' });
  const selEscena = el('select', { id: 'vd-escena' }), bRecargar = el('button', { type: 'button', class: 'arq-mini', id: 'vd-recargar' }), notaEscena = el('p', { class: 'hint', id: 'vd-nota-escena' });
  const selRef = el('select', { id: 'vd-ref' }), inValor = el('input', { id: 'vd-valor', type: 'number', min: 0.5, max: 200, step: 0.01, inputmode: 'decimal' }), lValor = el('span'), notaRef = el('p', { class: 'hint', id: 'vd-nota-ref' });
  const selAjuste = el('select', { id: 'vd-ajuste' }), lAjuste = el('span');
  const cInvertir = el('input', { type: 'checkbox', id: 'vd-invertir' }), cGirar = el('input', { type: 'checkbox', id: 'vd-girar' }), cMuebles = el('input', { type: 'checkbox', id: 'vd-muebles', checked: true });
  const lInvertir = el('span'), lGirar = el('span'), lMuebles = el('span');
  const inLocal = el('input', { id: 'vd-local', maxlength: 80, autocomplete: 'off', spellcheck: false, value: localInicial || '' }), inNombre = el('input', { id: 'vd-nombre', maxlength: 80, autocomplete: 'off' });
  const lLocal = el('span'), lNombre = el('span');
  const bUsar = el('button', { type: 'button', id: 'vd-usar', class: 'arq-btn arq-btn-ok' }), bBajar = el('button', { type: 'button', id: 'vd-bajar', class: 'arq-btn' }), bModelar = el('button', { type: 'button', id: 'vd-modelar', class: 'arq-btn' });
  pane.replaceChildren(lead,
    el('div', { class: 'arq-cis-head' }, h1), el('div', { class: 'arq-actions' }, aGrabar), consejos,
    el('div', { class: 'arq-cis-head' }, h2, bRecargar), el('label', { class: 'arq-field' }, selEscena), notaEscena,
    el('div', { class: 'arq-cis-head' }, h3), el('div', { class: 'arq-dims arq-dims-2' }, el('label', {}, selRef), el('label', {}, lValor, inValor)), notaRef,
    el('label', { class: 'arq-field' }, lAjuste, selAjuste),
    el('div', { class: 'vd-opciones' }, el('label', { class: 'arq-check' }, cInvertir, lInvertir), el('label', { class: 'arq-check' }, cGirar, lGirar), el('label', { class: 'arq-check' }, cMuebles, lMuebles)),
    el('div', { class: 'arq-cis-head' }, h4), el('div', { class: 'arq-dims arq-dims-2' }, el('label', {}, lLocal, inLocal), el('label', {}, lNombre, inNombre)),
    el('div', { class: 'arq-actions md-salidas' }, bUsar, bBajar, bModelar));

  // ── Derecha ──
  const titulo = el('h2', { id: 'vd-titulo' }), lienzo = el('canvas', { id: 'vd-lienzo', class: 'vd-lienzo', width: 800, height: 500 }), leyenda = el('p', { class: 'hint' });
  const datos = el('dl', { id: 'vd-datos', class: 'md-resumen' });
  card.replaceChildren(el('div', { class: 'card-head' }, titulo), el('div', { class: 'dt-plano' }, lienzo), leyenda, datos);

  // ── Escenas de XpaceScan ──
  async function cargarEscenas() {
    st.escenas = null; st.error = ''; pintar();
    try {
      const r = await fetchImpl(`${SCAN_API}/scenes`, { cache: 'no-store' }); const j = r.ok ? await r.json() : null;
      st.escenas = (j && Array.isArray(j.scenes)) ? j.scenes : [];
      if (!j) st.error = t('escenasNo');
    } catch { st.escenas = []; st.error = t('escenasNo'); }
    pintar();
  }
  async function elegirEscena(id) {
    const e = (st.escenas || []).find(x => x.id === id); st.escena = e || null; st.nube = null; st.lev = null; st.error = '';
    if (!e) { pintar(); return; }
    if (!inNombre.value) inNombre.value = e.name || e.id;
    if (!inLocal.value || !ID_RE.test(inLocal.value)) inLocal.value = String(e.name || e.id).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    if (e.status !== 'ready') { pintar(); return; }
    st.cargando = true; pintar(); status(t('leyendo'));
    try {
      const m = await (await fetchImpl(`${SCAN_API}/scenes/${encodeURIComponent(e.id)}`, { cache: 'no-store' })).json();
      const sc = m && m.scene, fichero = sc && ((sc.files || []).find(f => f.name === sc.primary && /\.ply$/i.test(f.name)) || (sc.files || []).find(f => /\.ply$/i.test(f.name)));
      if (!fichero) throw new Error('sin-ply');
      const buf = await (await fetchImpl(`${SCAN_API}/scenes/${encodeURIComponent(e.id)}/files/${encodeURIComponent(fichero.name)}`)).arrayBuffer();
      st.nube = leerPLY(buf); relevantar();
    } catch { st.error = t('nubeNo'); }
    st.cargando = false; pintar();
  }
  function relevantar() {
    if (!st.nube) return;
    try { st.lev = levantar(st.nube, st.opciones); st.error = ''; } catch { st.lev = null; st.error = t('nubeNo'); }
  }
  const referencia = () => { const v = parseFloat(String(inValor.value).replace(',', '.')); return v > 0 ? { tipo: selRef.value, valor: v } : null; };
  const plano = () => (st.lev && ID_RE.test(inLocal.value.trim()))
    ? planoDesdeLevantamiento(st.lev, { id: inLocal.value.trim(), nombre: inNombre.value, escena: st.escena && st.escena.id, referencia: referencia(), muebles: st.muebles }) : null;

  selEscena.addEventListener('change', () => elegirEscena(selEscena.value));
  bRecargar.addEventListener('click', cargarEscenas);
  for (const n of [selRef, inValor, inLocal, inNombre]) n.addEventListener('input', pintar);
  selAjuste.addEventListener('change', () => { st.opciones.ajuste = selAjuste.value; relevantar(); pintar(); });
  cInvertir.addEventListener('change', () => { st.opciones.invertir = cInvertir.checked; relevantar(); pintar(); });
  cGirar.addEventListener('change', () => { st.opciones.girar = cGirar.checked; relevantar(); pintar(); });
  cMuebles.addEventListener('change', () => { st.muebles = cMuebles.checked; pintar(); });
  bUsar.addEventListener('click', async () => { const p = plano(); if (!p) { status(t('idMal'), { error: true }); return; } await usarPlano(p); status(t('usado', p.id)); });
  bBajar.addEventListener('click', () => {
    const p = plano(); if (!p) { status(t('idMal'), { error: true }); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2) + '\n'], { type: 'application/json' })), nombre = `${p.id}.json`;
    const a = el('a', { href: url, download: nombre }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    status(t('descargado', nombre));
  });
  bModelar.addEventListener('click', async () => { const p = plano(); if (!p) { status(t('idMal'), { error: true }); return; } await usarPlano(p); abrirModelar(p.id); });

  // ── Pintar ──
  function opciones(sel, pares, valor) { sel.replaceChildren(...pares.map(([v, txt]) => el('option', { value: v, selected: v === valor }, txt))); }
  function dibujar() {
    const ctx = lienzo.getContext('2d'), W = lienzo.width = 800;
    if (!st.lev) { lienzo.height = 160; ctx.fillStyle = '#0b0f0e'; ctx.fillRect(0, 0, W, 160); ctx.fillStyle = '#8a958f'; ctx.font = '15px system-ui'; ctx.fillText(st.cargando ? t('leyendo') : t('vacio'), 20, 85); return; }
    const L = st.lev, u = L.unidades, s = L.sala, ref = referencia(), k = escala(L, ref).k, A = u.ancho, F = u.fondo, H = u.alto, m = 0.12 * Math.max(A, F);
    const esc = (W - 20) / (A + 2 * m), Hc = lienzo.height = Math.round((F + 2 * m) * esc + 20);
    ctx.fillStyle = '#0b0f0e'; ctx.fillRect(0, 0, W, Hc);
    const X = x => 10 + (x + m) * esc, Y = y => 10 + (y + m) * esc;
    for (let i = 0; i < s.length; i += 3) {
      const h = s[i + 2] / H; ctx.fillStyle = h < 0.2 ? 'rgba(150,160,155,.35)' : h < 0.85 ? 'rgba(235,240,236,.75)' : 'rgba(120,150,255,.4)';
      ctx.fillRect(X(s[i]), Y(s[i + 1]), 1.4, 1.4);
    }
    ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.strokeRect(X(0), Y(0), A * esc, F * esc);
    if (st.muebles) { ctx.strokeStyle = '#ffc44d'; ctx.lineWidth = 1.5; for (const mb of mueblesDetectados(L, k)) ctx.strokeRect(X(mb.x / k), Y(mb.y / k), mb.w / k * esc, mb.d / k * esc); }
    ctx.fillStyle = '#ffd0d0'; ctx.font = 'bold 14px system-ui';
    ctx.fillText(`${num(A * k)} m`, X(A / 2) - 20, Y(0) - 6); ctx.fillText(`${num(F * k)} m`, X(A) + 6, Y(F / 2));
  }
  function pintarDatos() {
    if (!st.lev) { datos.replaceChildren(); return; }
    const L = st.lev, e = escala(L, referencia()), k = e.k, mb = st.muebles ? mueblesDetectados(L, k).length : 0, fila = (a, b) => [el('dt', {}, a), el('dd', {}, b)], D = T().datos;
    datos.replaceChildren(...fila(D.puntos, num(L.puntos, 0)), ...fila(D.medidas, `${num(L.unidades.ancho * k)} × ${num(L.unidades.fondo * k)} m · ${getLang() === 'en' ? 'height' : 'alto'} ${num(L.unidades.alto * k)} m${L.techoVisible && L.sueloVisible ? '' : getLang() === 'en' ? ' (approximate)' : ' (aproximado)'}`),
      ...fila(D.escala, T().escalaTxt(e)), ...fila(D.confianza, T().conf[L.confianza]), ...fila(D.vistos, T().vistos(L.sueloVisible, L.techoVisible)), ...fila(D.muebles, String(mb)));
  }
  function pintar() {
    const tx = T();
    lead.textContent = t('lead'); h1.textContent = t('paso1'); h2.textContent = t('paso2'); h3.textContent = t('paso3'); h4.textContent = t('paso4');
    aGrabar.textContent = t('grabar'); consejos.textContent = t('consejos'); bRecargar.textContent = t('recargar');
    const lista = st.escenas;
    if (!lista) opciones(selEscena, [['', t('cargando')]], '');
    else if (!lista.length) opciones(selEscena, [['', st.error || t('sinEscenas')]], '');
    else opciones(selEscena, [['', '—'], ...lista.map(e => [e.id, `${e.name || e.id} · ${tx.estado[e.status] || e.status}${e.created ? ' · ' + String(e.created).slice(0, 10) : ''}`])], st.escena ? st.escena.id : '');
    notaEscena.textContent = st.error || (st.escena && st.escena.status !== 'ready' ? t('pendiente', st.escena.id) : '');
    opciones(selRef, REFERENCIAS.map(r => [r, tx.ref[r]]), selRef.value || 'alto'); lValor.textContent = t('valor');
    const L = st.lev;
    notaRef.textContent = !referencia() ? t('sinMedida') : (L && selRef.value === 'alto' && !(L.sueloVisible && L.techoVisible) ? t('consejoRef') : '');
    lAjuste.textContent = t('ajuste'); opciones(selAjuste, AJUSTES.map(a => [a, tx.ajustes[a]]), st.opciones.ajuste);
    lInvertir.textContent = t('invertir'); lGirar.textContent = t('girar'); lMuebles.textContent = t('muebles');
    lLocal.textContent = t('local'); lNombre.textContent = t('nombre'); bUsar.textContent = t('usar'); bBajar.textContent = t('bajar'); bModelar.textContent = t('modelar');
    const listo = !!(L && ID_RE.test(inLocal.value.trim())); for (const b of [bUsar, bBajar, bModelar]) b.disabled = !listo;
    titulo.textContent = st.escena ? `${t('titulo')} · ${st.escena.name || st.escena.id}` : t('titulo'); leyenda.textContent = L ? t('leyenda') : '';
    dibujar(); pintarDatos();
  }
  pintar(); cargarEscenas();
  return { setLang: pintar, estado: () => st, elegirEscena };
}
