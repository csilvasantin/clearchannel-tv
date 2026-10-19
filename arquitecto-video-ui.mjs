// Arquitecto · orden «video» en la página (lo puro está en arquitecto-video.mjs).
// Izquierda: grabar con XpaceScan, elegir la escena reconstruida, la medida tomada en el local y el plano resultante.
// Derecha: la nube vista desde arriba con la sala y los muebles que se ven en ella, y sus medidas.
// El vídeo no pasa por aquí: sólo se lee la nube de puntos de la escena (scan.admira.store).
// Desde el 19-oct-2026 también entra una escena de SuperSplat (superspl.at/scene/<id>): nube densa, ya en metros y con
// color, de la que se separan los objetos (muebles, lo que hay encima, lo que cuelga) con su código ITIL.
import { SCAN_API, SCAN_APP, ALTO_SUPUESTO, REFERENCIAS, AJUSTES, leerPLY, levantar, escala, mueblesDetectados, planoDesdeLevantamiento } from './arquitecto-video.mjs?v=20261019-splat-1';
import { cargarSuperSplat, decodificarWebp, urlSuperSplat, ALFA_MIN } from './arquitecto-splat.mjs?v=20261019-splat-1';
import { aSala, ampliarSala, objetosDetectados, clasificar, cruzarConInventario, cisDeObjetos } from './arquitecto-objetos.mjs?v=20261019-splat-1';
import { INVENTARIOS } from './arquitecto-detallar.mjs?v=20261018-detallar-3';
export const MIN_PUNTOS_OBJETOS = 100000;   // por debajo, la nube (COLMAP) no da para separar objetos: muebles grandes como antes

const TEXTOS = {
  es: {
    lead: 'Del recorrido grabado con el móvil a un plano con medidas reales. XpaceScan graba y sube el vídeo; un Mac lo reconstruye en 3D; aquí saco el suelo, el techo y las paredes de la nube, y la escala con una medida que tomes en el local.',
    paso1: '1 · Graba el recorrido', grabar: 'Abrir XpaceScan en el móvil', consejos: 'Entre 60 y 120 segundos, andando despacio y sin girar de golpe. Que salgan todas las paredes, algo de suelo y de techo. Sin gente de frente si se puede.',
    paso2: '2 · Escena reconstruida', recargar: 'Recargar', cargando: 'Leyendo las escenas…', sinEscenas: 'Todavía no hay escenas.', escenasNo: 'No pude leer las escenas de XpaceScan.',
    estado: { uploading: 'subiendo', uploaded: 'subida, sin reconstruir', processing: 'reconstruyendo', ready: 'lista', error: 'error' },
    pendiente: id => `Esta escena aún no tiene nube: hay que reconstruirla en un Mac con COLMAP (scan-pull.sh ${id}).`,
    leyendo: 'Leyendo la nube de puntos…', nubeNo: 'No pude leer la nube de puntos de esta escena.',
    oSplat: 'O una escena de SuperSplat (escaneo 3D del móvil, en metros y con color):', splatPh: 'https://superspl.at/scene/8f6bd2f6', leerSplat: 'Leer la escena',
    splatLeyendo: (h, t) => `Leyendo la escena de SuperSplat… ${h} de ${t} trozos`, splatNo: 'No pude leer esa escena de SuperSplat: comprueba el enlace (superspl.at/scene/…) y que la escena sea pública o no listada.',
    splatOk: o => `Escena ${o.id || ''} leída: ${o.gaussianas.toLocaleString('es-ES')} gaussianas (nivel ${o.nivel + 1} de ${o.niveles}), ${o.alfaMin ? 'sin las translúcidas' : ''}.`,
    separar: 'Separar los objetos (nube densa): muebles, lo que hay encima y lo que cuelga', ampliar: 'Ampliar la sala hasta lo que hay delante de la barra',
    paso3: '3 · Una medida del local', ref: { alto: 'Alto libre (suelo a techo)', ancho: 'Ancho de la sala (lado largo)', fondo: 'Fondo de la sala (lado corto)', metrica: 'La nube ya está en metros (SuperSplat)' },
    valor: 'Metros', sinMedida: `Sin medida, supongo un techo de ${String(ALTO_SUPUESTO).replace('.', ',')} m: las medidas no serán reales.`,
    ajuste: 'Ajuste', ajustes: { paredes: 'Paredes claras (local rectangular)', envolvente: 'Todo lo que cubre la nube (local en L o con entrantes)' },
    invertir: 'Invertir suelo y techo', girar: 'Girar 90°', muebles: 'Incluir los muebles grandes que se ven',
    paso4: '4 · El plano', local: 'Local (id del plano)', nombre: 'Nombre', usar: 'Usar este plano', bajar: 'Descargar plano (JSON)', modelar: 'Pasar a «modelar»',
    usado: id => `Plano «${id}» guardado en este navegador: ábrelo en el plano o en «modelar».`, descargado: f => `Descargado: ${f}.`,
    titulo: 'Plano desde el vídeo', vacio: 'Elige una escena reconstruida a la izquierda.',
    datos: { puntos: 'Puntos', medidas: 'Sala', escala: 'Escala', confianza: 'Confianza', vistos: 'Suelo y techo en la nube', muebles: 'Muebles vistos', objetos: 'Objetos separados', ampliada: 'Sala ampliada' },
    objetosTxt: r => `${r.total} (${r.cuerpo} muebles · ${r.encima} encima · ${r.flotante} colgados) · ITIL: ${r.existente} ya dados de alta · ${r.propuesto} propuestos · ${r.menor} pequeños sin inventariar`,
    ampliadaTxt: a => `${String(a.fondo).replace('.', ',')} m por delante · ${String(a.izquierda).replace('.', ',')} m a la izquierda · ${String(a.derecha).replace('.', ',')} m a la derecha (paredes vistas: ${String(a.paredes.ancho).replace('.', ',')} × ${String(a.paredes.fondo).replace('.', ',')} m)`,
    tabla: { n: '#', objeto: 'Objeto', medidas: 'Ancho × fondo × alto', base: 'Base', sobre: 'Sobre', itil: 'ITIL' }, estados: { existente: 'ya en el ITIL', propuesto: 'propuesto', menor: 'pequeño, sin código', 'sin-codigo': 'sin código' },
    bajarObjetos: 'Descargar objetos e ITIL (JSON)', noVistos: l => `En el ITIL y no vistos en el escaneo: ${l.join(', ')}.`,
    notaItil: 'Los códigos propuestos no se dan de alta desde aquí: el titular los confirma en Yokup, el maestro del ITIL.',
    conf: { alta: 'alta', media: 'media', baja: 'baja: revisa la vista y, si hace falta, gira, invierte o cambia el ajuste' },
    vistos: (s, t) => `${s ? 'suelo sí' : 'suelo no'} · ${t ? 'techo sí' : 'techo no'}`,
    consejoRef: 'El suelo o el techo apenas se ven: mejor una medida de ancho o de fondo que la del alto.',
    escalaTxt: e => e.tipo === 'metrica' ? 'real: la nube ya está en metros' : e.supuesta ? `supuesta (techo ${String(ALTO_SUPUESTO).replace('.', ',')} m)` : `${e.tipo} = ${String(e.valor).replace('.', ',')} m`,
    leyenda: 'Vista desde arriba: en blanco las paredes y lo alto, en gris el suelo y lo bajo, en azul el techo; en rojo la sala; en amarillo, los muebles vistos.',
    leyendaObjetos: 'Vista desde arriba con los objetos separados: trazo continuo los muebles, discontinuo lo que hay encima, punteado lo que cuelga; el número es el de la tabla.',
    idMal: 'El id del local: minúsculas, números y guiones (por ejemplo starbucks-diagonal).'
  },
  en: {
    lead: 'From a phone walkthrough to a floor plan with real measurements. XpaceScan records and uploads the video; a Mac rebuilds it in 3D; here I take the floor, ceiling and walls from the point cloud, and the scale from one measurement you take on site.',
    paso1: '1 · Record the walkthrough', grabar: 'Open XpaceScan on the phone', consejos: 'Between 60 and 120 seconds, walking slowly without sudden turns. Get every wall and some floor and ceiling. Avoid people facing the camera if possible.',
    paso2: '2 · Rebuilt scene', recargar: 'Reload', cargando: 'Reading the scenes…', sinEscenas: 'No scenes yet.', escenasNo: 'I could not read the XpaceScan scenes.',
    estado: { uploading: 'uploading', uploaded: 'uploaded, not rebuilt', processing: 'rebuilding', ready: 'ready', error: 'error' },
    pendiente: id => `This scene has no point cloud yet: it must be rebuilt on a Mac with COLMAP (scan-pull.sh ${id}).`,
    leyendo: 'Reading the point cloud…', nubeNo: 'I could not read this scene’s point cloud.',
    oSplat: 'Or a SuperSplat scene (phone 3D scan, in metres and in colour):', splatPh: 'https://superspl.at/scene/8f6bd2f6', leerSplat: 'Read the scene',
    splatLeyendo: (h, t) => `Reading the SuperSplat scene… ${h} of ${t} chunks`, splatNo: 'I could not read that SuperSplat scene: check the link (superspl.at/scene/…) and that the scene is public or unlisted.',
    splatOk: o => `Scene ${o.id || ''} read: ${o.gaussianas.toLocaleString('en-GB')} gaussians (level ${o.nivel + 1} of ${o.niveles})${o.alfaMin ? ', translucent ones left out' : ''}.`,
    separar: 'Separate the objects (dense cloud): furniture, what sits on it and what hangs', ampliar: 'Grow the room to what lies in front of the counter',
    paso3: '3 · One on-site measurement', ref: { alto: 'Clear height (floor to ceiling)', ancho: 'Room width (long side)', fondo: 'Room depth (short side)', metrica: 'The cloud is already in metres (SuperSplat)' },
    valor: 'Metres', sinMedida: `Without a measurement I assume a ${ALTO_SUPUESTO} m ceiling: the sizes will not be real.`,
    ajuste: 'Fit', ajustes: { paredes: 'Clear walls (rectangular venue)', envolvente: 'Everything the cloud covers (L-shaped venue or recesses)' },
    invertir: 'Swap floor and ceiling', girar: 'Turn 90°', muebles: 'Include the large furniture seen',
    paso4: '4 · The floor plan', local: 'Venue (plan id)', nombre: 'Name', usar: 'Use this plan', bajar: 'Download plan (JSON)', modelar: 'Go to “model”',
    usado: id => `Plan “${id}” saved in this browser: open it in the floor plan or in “model”.`, descargado: f => `Downloaded: ${f}.`,
    titulo: 'Floor plan from the video', vacio: 'Pick a rebuilt scene on the left.',
    datos: { puntos: 'Points', medidas: 'Room', escala: 'Scale', confianza: 'Confidence', vistos: 'Floor and ceiling in the cloud', muebles: 'Furniture seen', objetos: 'Separated objects', ampliada: 'Room grown' },
    objetosTxt: r => `${r.total} (${r.cuerpo} furniture · ${r.encima} on top · ${r.flotante} hanging) · ITIL: ${r.existente} already registered · ${r.propuesto} proposed · ${r.menor} small, not inventoried`,
    ampliadaTxt: a => `${a.fondo} m in front · ${a.izquierda} m to the left · ${a.derecha} m to the right (walls seen: ${a.paredes.ancho} × ${a.paredes.fondo} m)`,
    tabla: { n: '#', objeto: 'Object', medidas: 'Width × depth × height', base: 'Base', sobre: 'On', itil: 'ITIL' }, estados: { existente: 'already in ITIL', propuesto: 'proposed', menor: 'small, no code', 'sin-codigo': 'no code' },
    bajarObjetos: 'Download objects and ITIL (JSON)', noVistos: l => `In ITIL but not seen in the scan: ${l.join(', ')}.`,
    notaItil: 'Proposed codes are not registered from here: the owner confirms them in Yokup, the ITIL master.',
    conf: { alta: 'high', media: 'medium', baja: 'low: check the view and turn, swap or change the fit if needed' },
    vistos: (s, t) => `${s ? 'floor yes' : 'floor no'} · ${t ? 'ceiling yes' : 'ceiling no'}`,
    consejoRef: 'Floor or ceiling barely show: a width or depth measurement is better than the height.',
    escalaTxt: e => e.tipo === 'metrica' ? 'real: the cloud is already in metres' : e.supuesta ? `assumed (${ALTO_SUPUESTO} m ceiling)` : `${e.tipo} = ${e.valor} m`,
    leyenda: 'Top view: white for walls and tall things, grey for floor and low things, blue for the ceiling; the room in red; furniture seen in yellow.',
    leyendaObjetos: 'Top view with the separated objects: solid for furniture, dashed for what sits on top, dotted for what hangs; the number is the table row.',
    idMal: 'The venue id: lowercase letters, digits and hyphens (for example starbucks-diagonal).'
  }
};

const el = (tag, attrs = {}, ...hijos) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) { if (k === 'class') n.className = v; else if (k in n && k !== 'list') n[k] = v; else n.setAttribute(k, v === true ? '' : v); }
  n.append(...hijos.filter(h => h != null)); return n;
};
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function montarVideo({ pane, card, getLang = () => 'es', status = () => {}, localInicial = '', usarPlano = async () => {}, abrirModelar = () => {}, fetchImpl = (...a) => fetch(...a), decodificar = decodificarWebp }) {
  const st = { escenas: null, escena: null, nube: null, lev: null, error: '', cargando: false, opciones: { ajuste: 'paredes', invertir: false, girar: false }, muebles: true,
    origen: null, separar: true, ampliar: true, levA: null, sala: null, objetos: null, inventario: null, inventarioDe: '' };
  const t = (k, ...a) => { const v = TEXTOS[getLang() === 'en' ? 'en' : 'es'][k]; return typeof v === 'function' ? v(...a) : v; };
  const T = () => TEXTOS[getLang() === 'en' ? 'en' : 'es'];
  const num = (v, d = 2) => Number(v).toLocaleString(getLang() === 'en' ? 'en-GB' : 'es-ES', { maximumFractionDigits: d });

  // ── Izquierda ──
  const lead = el('p', { class: 'arq-lead' });
  const h1 = el('strong'), h2 = el('strong'), h3 = el('strong'), h4 = el('strong');
  const aGrabar = el('a', { id: 'vd-grabar', class: 'arq-btn', href: SCAN_APP, target: '_blank', rel: 'noopener' }), consejos = el('p', { class: 'hint' });
  const selEscena = el('select', { id: 'vd-escena' }), bRecargar = el('button', { type: 'button', class: 'arq-mini', id: 'vd-recargar' }), notaEscena = el('p', { class: 'hint', id: 'vd-nota-escena' });
  const lSplat = el('span'), inSplat = el('input', { id: 'vd-splat', type: 'url', maxlength: 300, autocomplete: 'off', spellcheck: false }), bSplat = el('button', { type: 'button', class: 'arq-mini', id: 'vd-leer-splat' }), notaSplat = el('p', { class: 'hint', id: 'vd-nota-splat' });
  const cSeparar = el('input', { type: 'checkbox', id: 'vd-separar', checked: true }), cAmpliar = el('input', { type: 'checkbox', id: 'vd-ampliar', checked: true }), lSeparar = el('span'), lAmpliar = el('span');
  const selRef = el('select', { id: 'vd-ref' }), inValor = el('input', { id: 'vd-valor', type: 'number', min: 0.5, max: 200, step: 0.01, inputmode: 'decimal' }), lValor = el('span'), notaRef = el('p', { class: 'hint', id: 'vd-nota-ref' });
  const selAjuste = el('select', { id: 'vd-ajuste' }), lAjuste = el('span');
  const cInvertir = el('input', { type: 'checkbox', id: 'vd-invertir' }), cGirar = el('input', { type: 'checkbox', id: 'vd-girar' }), cMuebles = el('input', { type: 'checkbox', id: 'vd-muebles', checked: true });
  const lInvertir = el('span'), lGirar = el('span'), lMuebles = el('span');
  const inLocal = el('input', { id: 'vd-local', maxlength: 80, autocomplete: 'off', spellcheck: false, value: localInicial || '' }), inNombre = el('input', { id: 'vd-nombre', maxlength: 80, autocomplete: 'off' });
  const lLocal = el('span'), lNombre = el('span');
  const bUsar = el('button', { type: 'button', id: 'vd-usar', class: 'arq-btn arq-btn-ok' }), bBajar = el('button', { type: 'button', id: 'vd-bajar', class: 'arq-btn' }), bModelar = el('button', { type: 'button', id: 'vd-modelar', class: 'arq-btn' });
  const bObjetos = el('button', { type: 'button', id: 'vd-bajar-objetos', class: 'arq-btn' });
  pane.replaceChildren(lead,
    el('div', { class: 'arq-cis-head' }, h1), el('div', { class: 'arq-actions' }, aGrabar), consejos,
    el('div', { class: 'arq-cis-head' }, h2, bRecargar), el('label', { class: 'arq-field' }, selEscena), notaEscena,
    el('label', { class: 'arq-field' }, lSplat, el('span', { class: 'vd-splat-fila' }, inSplat, bSplat)), notaSplat,
    el('div', { class: 'vd-opciones' }, el('label', { class: 'arq-check' }, cSeparar, lSeparar), el('label', { class: 'arq-check' }, cAmpliar, lAmpliar)),
    el('div', { class: 'arq-cis-head' }, h3), el('div', { class: 'arq-dims arq-dims-2' }, el('label', {}, selRef), el('label', {}, lValor, inValor)), notaRef,
    el('label', { class: 'arq-field' }, lAjuste, selAjuste),
    el('div', { class: 'vd-opciones' }, el('label', { class: 'arq-check' }, cInvertir, lInvertir), el('label', { class: 'arq-check' }, cGirar, lGirar), el('label', { class: 'arq-check' }, cMuebles, lMuebles)),
    el('div', { class: 'arq-cis-head' }, h4), el('div', { class: 'arq-dims arq-dims-2' }, el('label', {}, lLocal, inLocal), el('label', {}, lNombre, inNombre)),
    el('div', { class: 'arq-actions md-salidas' }, bUsar, bBajar, bModelar, bObjetos));

  // ── Derecha ──
  const titulo = el('h2', { id: 'vd-titulo' }), lienzo = el('canvas', { id: 'vd-lienzo', class: 'vd-lienzo', width: 800, height: 500 }), leyenda = el('p', { class: 'hint' });
  const datos = el('dl', { id: 'vd-datos', class: 'md-resumen' });
  const tablaWrap = el('div', { class: 'md-tabla-wrap', id: 'vd-objetos' }), tabla = el('table', { class: 'md-tabla' }), notaObjetos = el('p', { class: 'hint', id: 'vd-nota-objetos' });
  tablaWrap.append(tabla);
  card.replaceChildren(el('div', { class: 'card-head' }, titulo), el('div', { class: 'dt-plano' }, lienzo), leyenda, datos, tablaWrap, notaObjetos);

  // ── Escena de SuperSplat ──
  async function leerSplat() {
    const ref = urlSuperSplat(inSplat.value);
    if (!ref) { st.error = t('splatNo'); pintar(); status(t('splatNo'), { error: true }); return; }
    st.cargando = true; st.error = ''; st.nube = null; st.lev = null; st.objetos = null; st.origen = null; st.escena = { id: ref.id || 'supersplat', name: `SuperSplat ${ref.id || ''}`.trim(), status: 'ready', splat: true }; pintar();
    try {
      const r = await cargarSuperSplat(ref, { fetchImpl, decodificar, progreso: (h, tt) => { notaSplat.textContent = t('splatLeyendo', h, tt); status(t('splatLeyendo', h, tt)); } });
      st.nube = r.nube; st.origen = r.origen; selRef.value = 'metrica';
      if (!inNombre.value) inNombre.value = st.escena.name;
      if (!inLocal.value || !ID_RE.test(inLocal.value)) inLocal.value = `supersplat-${ref.id || 'escena'}`;
      relevantar(); status(t('splatOk', r.origen));
    } catch (e) { st.error = t('splatNo'); console.warn('[arquitecto/video] SuperSplat:', e && e.message); }
    st.cargando = false; pintar();
  }
  // Inventario ITIL público del local (si lo hay), para cruzar los objetos con los códigos ya dados de alta.
  async function inventarioDe(localId) {
    const url = INVENTARIOS[localId]; if (!url) { st.inventario = null; st.inventarioDe = localId; return null; }
    if (st.inventarioDe === localId && st.inventario) return st.inventario;
    try { const r = await fetchImpl(url, { cache: 'no-store' }); st.inventario = r.ok ? await r.json() : null; } catch { st.inventario = null; }
    st.inventarioDe = localId; return st.inventario;
  }
  // Separar los objetos de la nube densa (en el marco ampliado si se pide) y cruzarlos con el ITIL.
  let separando = 0;
  async function separarObjetos() {
    st.objetos = null; st.levA = null; st.sala = null;
    if (!st.lev || !st.nube || !st.separar || st.nube.n < MIN_PUNTOS_OBJETOS) { pintar(); return; }
    const mio = ++separando, k = escala(st.lev, referencia()).k, localId = inLocal.value.trim();
    const inv = await inventarioDe(ID_RE.test(localId) ? localId : '');
    if (mio !== separando) return;
    try {
      let lev = st.lev, sala = aSala(lev, st.nube, { alfaMin: st.nube.alfa ? ALFA_MIN : 0 });
      if (st.ampliar) { const amp = ampliarSala(lev, sala, k); if (amp !== lev) { lev = amp; sala = aSala(lev, st.nube, { alfaMin: st.nube.alfa ? ALFA_MIN : 0 }); } }
      const det = objetosDetectados(lev, k, sala), H = lev.unidades.alto * k;
      const cruce = cruzarConInventario(det.objetos.map(o => clasificar(o, { H })), inv, { localId: ID_RE.test(localId) ? localId : '' });
      st.levA = lev; st.sala = sala; st.objetos = { ...cruce, rejilla: det.rejilla, sala: det.sala };
    } catch (e) { console.warn('[arquitecto/video] objetos:', e && e.message); st.objetos = null; }
    pintar();
  }

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
    separarObjetos();
  }
  const referencia = () => { if (selRef.value === 'metrica') return { tipo: 'metrica' }; const v = parseFloat(String(inValor.value).replace(',', '.')); return v > 0 ? { tipo: selRef.value, valor: v } : null; };
  const levPlano = () => (st.objetos && st.levA) || st.lev;
  const plano = () => (st.lev && ID_RE.test(inLocal.value.trim()))
    ? planoDesdeLevantamiento(levPlano(), { id: inLocal.value.trim(), nombre: inNombre.value, escena: st.escena && st.escena.id, referencia: referencia(), muebles: st.muebles,
      objetos: st.objetos ? st.objetos.objetos : null, origen: st.origen }) : null;
  const paqueteObjetos = () => st.objetos && { schema: 'admira.arquitecto-objetos/1', creado: new Date().toISOString(), local: inLocal.value.trim(), escena: st.origen ? st.origen.enlace : st.escena && st.escena.id,
    sala: st.objetos.sala, prefijo: st.objetos.prefijo, objetos: st.objetos.objetos, noVistos: st.objetos.noVistos,
    cis: cisDeObjetos(st.objetos.objetos, { local: inLocal.value.trim(), escena: st.origen ? st.origen.enlace.replace(/^https?:\/\//, '') : String(st.escena && st.escena.id || '') }) };

  selEscena.addEventListener('change', () => { st.origen = null; inSplat.value = ''; elegirEscena(selEscena.value); });
  bRecargar.addEventListener('click', cargarEscenas);
  bSplat.addEventListener('click', leerSplat); inSplat.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); leerSplat(); } });
  cSeparar.addEventListener('change', () => { st.separar = cSeparar.checked; separarObjetos(); });
  cAmpliar.addEventListener('change', () => { st.ampliar = cAmpliar.checked; separarObjetos(); });
  let temporizador = 0; const reseparar = () => { clearTimeout(temporizador); temporizador = setTimeout(separarObjetos, 400); };
  for (const n of [selRef, inValor, inLocal, inNombre]) n.addEventListener('input', pintar);
  for (const n of [selRef, inValor, inLocal]) n.addEventListener('input', reseparar);
  bObjetos.addEventListener('click', () => {
    const p = paqueteObjetos(); if (!p) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2) + '\n'], { type: 'application/json' })), nombre = `${ID_RE.test(p.local) ? p.local : 'objetos'}.objetos.json`;
    const a = el('a', { href: url, download: nombre }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    status(t('descargado', nombre));
  });
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
    const L = levPlano(), u = L.unidades, s = st.lev.sala, ref = referencia(), k = escala(L, ref).k, A = u.ancho, F = u.fondo, H = u.alto, m = 0.12 * Math.max(A, F);
    const esc = (W - 20) / (A + 2 * m), Hc = lienzo.height = Math.round((F + 2 * m) * esc + 20);
    ctx.fillStyle = '#0b0f0e'; ctx.fillRect(0, 0, W, Hc);
    const X = x => 10 + (x + m) * esc, Y = y => 10 + (y + m) * esc;
    // La submuestra del levantamiento está en el marco sin ampliar: se desplaza lo que haya crecido la sala.
    const dx = L.ampliada ? L.ampliada.izquierda / k : 0, dy = L.ampliada ? L.ampliada.fondo / k : 0;
    for (let i = 0; i < s.length; i += 3) {
      const h = s[i + 2] / H; ctx.fillStyle = h < 0.2 ? 'rgba(150,160,155,.35)' : h < 0.85 ? 'rgba(235,240,236,.75)' : 'rgba(120,150,255,.4)';
      ctx.fillRect(X(s[i] + dx), Y(s[i + 1] + dy), 1.4, 1.4);
    }
    ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.strokeRect(X(0), Y(0), A * esc, F * esc);
    if (L.ampliada) { ctx.setLineDash([6, 4]); ctx.strokeStyle = 'rgba(255,77,77,.6)'; ctx.lineWidth = 1; ctx.strokeRect(X(dx), Y(dy), L.ampliada.paredes.ancho / k * esc, L.ampliada.paredes.fondo / k * esc); ctx.setLineDash([]); }
    if (st.objetos) {
      ctx.font = 'bold 12px system-ui';
      st.objetos.objetos.forEach((o, i) => {
        const color = o.clase === 'cuerpo' ? '#ffc44d' : o.clase === 'encima' ? '#7ee0a0' : '#8fb8ff';
        ctx.setLineDash(o.clase === 'cuerpo' ? [] : o.clase === 'encima' ? [5, 3] : [2, 3]); ctx.strokeStyle = color; ctx.lineWidth = o.clase === 'cuerpo' ? 2 : 1.2;
        ctx.strokeRect(X(o.x / k), Y(o.y / k), o.w / k * esc, o.d / k * esc);
        ctx.setLineDash([]); ctx.fillStyle = color; ctx.fillText(String(i + 1), X(o.x / k) + 3, Y(o.y / k) + 12);
      });
    } else if (st.muebles) { ctx.strokeStyle = '#ffc44d'; ctx.lineWidth = 1.5; for (const mb of mueblesDetectados(L, k)) ctx.strokeRect(X(mb.x / k), Y(mb.y / k), mb.w / k * esc, mb.d / k * esc); }
    ctx.fillStyle = '#ffd0d0'; ctx.font = 'bold 14px system-ui';
    ctx.fillText(`${num(A * k)} m`, X(A / 2) - 20, Y(0) - 6); ctx.fillText(`${num(F * k)} m`, X(A) + 6, Y(F / 2));
  }
  function pintarDatos() {
    if (!st.lev) { datos.replaceChildren(); tabla.replaceChildren(); notaObjetos.textContent = ''; return; }
    const L = levPlano(), e = escala(L, referencia()), k = e.k, mb = st.muebles && !st.objetos ? mueblesDetectados(st.lev, k).length : 0, fila = (a, b) => [el('dt', {}, a), el('dd', {}, b)], D = T().datos, tx = T();
    const O = st.objetos && st.objetos.objetos, resumen = O && { total: O.length, cuerpo: O.filter(o => o.clase === 'cuerpo').length, encima: O.filter(o => o.clase === 'encima').length, flotante: O.filter(o => o.clase === 'flotante').length,
      existente: O.filter(o => o.itilEstado === 'existente').length, propuesto: O.filter(o => o.itilEstado === 'propuesto').length, menor: O.filter(o => o.itilEstado === 'menor').length };
    datos.replaceChildren(...fila(D.puntos, num(L.puntos, 0)), ...fila(D.medidas, `${num(L.unidades.ancho * k)} × ${num(L.unidades.fondo * k)} m · ${getLang() === 'en' ? 'height' : 'alto'} ${num(L.unidades.alto * k)} m${L.techoVisible && L.sueloVisible ? '' : getLang() === 'en' ? ' (approximate)' : ' (aproximado)'}`),
      ...fila(D.escala, tx.escalaTxt(e)), ...fila(D.confianza, tx.conf[L.confianza]), ...fila(D.vistos, tx.vistos(L.sueloVisible, L.techoVisible)),
      ...(L.ampliada ? fila(D.ampliada, tx.ampliadaTxt(L.ampliada)) : []), ...(resumen ? fila(D.objetos, tx.objetosTxt(resumen)) : fila(D.muebles, String(mb))));
    // Tabla de objetos: número, objeto, medidas, base, sobre qué está y su código ITIL.
    if (!O) { tabla.replaceChildren(); notaObjetos.textContent = ''; return; }
    const th = Object.values(tx.tabla).map(x => el('th', {}, x)), porId = new Map(O.map((o, i) => [o.id, i + 1]));
    tabla.replaceChildren(el('thead', {}, el('tr', {}, ...th)), el('tbody', {}, ...O.map((o, i) => el('tr', { class: `vd-${o.clase}` },
      el('td', {}, String(i + 1)), el('td', {}, `${o.nombre}${o.tipo !== 'mueble' ? ` · ${o.tipo}` : ''}`), el('td', {}, `${num(o.w)} × ${num(o.d)} × ${num(o.alto)} m`),
      el('td', {}, o.base > 0 ? `${num(o.base)} m` : '—'), el('td', {}, o.apoyadoEn && porId.has(o.apoyadoEn) ? `#${porId.get(o.apoyadoEn)}` : '—'),
      el('td', {}, o.itil ? `${o.itil} · ${tx.estados[o.itilEstado] || o.itilEstado}` : tx.estados[o.itilEstado] || '—')))));
    notaObjetos.textContent = `${tx.notaItil}${st.objetos.noVistos.length ? ' ' + tx.noVistos(st.objetos.noVistos.map(u => u.itil_code)) : ''}`;
  }
  function pintar() {
    const tx = T();
    lead.textContent = t('lead'); h1.textContent = t('paso1'); h2.textContent = t('paso2'); h3.textContent = t('paso3'); h4.textContent = t('paso4');
    aGrabar.textContent = t('grabar'); consejos.textContent = t('consejos'); bRecargar.textContent = t('recargar');
    const lista = st.escenas;
    if (!lista) opciones(selEscena, [['', t('cargando')]], '');
    else if (!lista.length) opciones(selEscena, [['', st.error || t('sinEscenas')]], '');
    else opciones(selEscena, [['', '—'], ...lista.map(e => [e.id, `${e.name || e.id} · ${tx.estado[e.status] || e.status}${e.created ? ' · ' + String(e.created).slice(0, 10) : ''}`])], st.escena ? st.escena.id : '');
    notaEscena.textContent = st.error && !st.origen && !(st.escena && st.escena.splat) ? st.error : (st.escena && st.escena.status !== 'ready' ? t('pendiente', st.escena.id) : '');
    lSplat.textContent = t('oSplat'); inSplat.placeholder = t('splatPh'); bSplat.textContent = t('leerSplat'); bSplat.disabled = st.cargando;
    notaSplat.textContent = st.escena && st.escena.splat ? (st.error || (st.cargando ? t('leyendo') : st.origen ? t('splatOk', st.origen) : '')) : '';
    lSeparar.textContent = t('separar'); lAmpliar.textContent = t('ampliar'); cAmpliar.disabled = !st.separar;
    opciones(selRef, REFERENCIAS.map(r => [r, tx.ref[r]]), selRef.value || 'alto'); lValor.textContent = t('valor'); inValor.disabled = selRef.value === 'metrica';
    const L = st.lev;
    notaRef.textContent = !referencia() ? t('sinMedida') : (L && selRef.value === 'alto' && !(L.sueloVisible && L.techoVisible) ? t('consejoRef') : '');
    lAjuste.textContent = t('ajuste'); opciones(selAjuste, AJUSTES.map(a => [a, tx.ajustes[a]]), st.opciones.ajuste);
    lInvertir.textContent = t('invertir'); lGirar.textContent = t('girar'); lMuebles.textContent = t('muebles');
    lLocal.textContent = t('local'); lNombre.textContent = t('nombre'); bUsar.textContent = t('usar'); bBajar.textContent = t('bajar'); bModelar.textContent = t('modelar'); bObjetos.textContent = t('bajarObjetos');
    const listo = !!(L && ID_RE.test(inLocal.value.trim())); for (const b of [bUsar, bBajar, bModelar]) b.disabled = !listo;
    bObjetos.hidden = !st.objetos; bObjetos.disabled = !listo;
    titulo.textContent = st.escena ? `${t('titulo')} · ${st.escena.name || st.escena.id}` : t('titulo'); leyenda.textContent = L ? (st.objetos ? t('leyendaObjetos') : t('leyenda')) : '';
    dibujar(); pintarDatos();
  }
  pintar(); cargarEscenas();
  return { setLang: pintar, estado: () => st, elegirEscena, leerSplat: url => { inSplat.value = url; return leerSplat(); } };
}
