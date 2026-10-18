// Arquitecto · orden «detallar» en la página (lo puro está en arquitecto-detallar.mjs).
// Izquierda: local, fotos, piezas y recortes. Derecha: la foto elegida; se marcan 4 esquinas de una cara plana (cartel,
// cara de bolsa, logo de vaso) y el navegador la endereza. «Descargar receta» da el JSON del Taller 3D de xpaceos, con
// los recortes dentro. Las fotos no salen del navegador ni se suben a ningún sitio.
import { MUEBLES, CONTENIDOS, ROLES, MAX_PIEZAS, MAX_RECORTES, REGISTRO_URL, ordenarEsquinas, validarEsquinas, tamRecorte, enderezar, siguientesNumeros, revisarEncargo, recetaDetallar } from './arquitecto-detallar.mjs?v=20261018-detallar-1';
import { prepararFotos } from './arquitecto-fotos.mjs?v=20261014-arquitecto-1';

const TEXTOS = {
  es: {
    lead: 'Fotos de los objetos de un local → receta del Taller 3D. Marca las 4 esquinas de cada cara plana (cartel, cara de una bolsa, logo de un vaso) y la enderezo. Las fotos no salen de este navegador: la receta sólo lleva los recortes.',
    local: 'Local (Xpacio)', encargo: 'Nombre del encargo', autor: 'Quién hizo las fotos', fotos: 'Fotos o vídeo de los objetos (hasta 8 fotos; de un vídeo saco fotogramas)',
    piezas: 'Piezas', addPieza: '+ Pieza', nombre: 'Nombre', numero: 'Nº catálogo', mueble: 'Mueble', contenido: 'Contenido', cantidad: 'Cantidad',
    cartel: 'Lleva cartel', poste: 'en poste', ancho: 'Ancho (m)', alto: 'Alto (m)', quitar: 'Quitar', recortes: 'Recortes',
    sinRecortes: 'Todavía no hay recortes: elige una foto a la derecha y marca 4 esquinas.', descargar: 'Descargar receta para el taller (JSON)',
    taller: 'Taller de recortes', pieza: 'Pieza', rol: 'Cara', recortar: 'Recortar', deshacer: 'Deshacer esquina', borrar: 'Borrar esquinas',
    ayudaFoto: n => n < 4 ? `Marca ${4 - n} esquina${4 - n === 1 ? '' : 's'} más de una cara plana (en cualquier orden).` : 'Listo: pulsa «Recortar».',
    sinFotos: 'Sube fotos o un vídeo a la izquierda.', preparando: 'Preparando fotos…', fotosListas: n => `${n} foto${n === 1 ? '' : 's'} lista${n === 1 ? '' : 's'}.`,
    recortado: (rol, p) => `Recorte «${rol}» para ${p}.`, cruzadas: 'Las esquinas se cruzan: márcalas otra vez.', registroNo: 'No pude leer el catálogo: pon los números a mano o déjalos por asignar.',
    revisa: 'Antes de la receta:', listo: 'Receta lista para el Taller 3D.', descargada: f => `Receta descargada: ${f}.`, avisos: 'Avisos',
    err: { local: 'falta el local', 'sin-piezas': 'añade al menos una pieza', 'demasiadas-piezas': 'demasiadas piezas', 'demasiados-recortes': 'demasiados recortes',
      nombre: 'una pieza sin nombre', mueble: 'una pieza sin mueble', contenido: 'una pieza sin contenido', 'falta-logo': 'los vasos piden el logo del vaso',
      'falta-frente': 'las bolsas de pie piden la cara frontal', 'falta-diseno': 'las bolsas almohada piden un diseño de bolsa', 'falta-cartel': 'marcaste «lleva cartel» y falta su recorte',
      numero: 'número de catálogo por asignar', png: 'un recorte no es una imagen' }
  },
  en: {
    lead: 'Photos of a venue’s objects → a 3D-workshop recipe. Mark the 4 corners of each flat face (a sign, a bag face, a cup logo) and I straighten it. Photos never leave this browser: the recipe only carries the crops.',
    local: 'Venue (Xpace)', encargo: 'Job name', autor: 'Who took the photos', fotos: 'Photos or video of the objects (up to 8 photos; I take frames from a video)',
    piezas: 'Pieces', addPieza: '+ Piece', nombre: 'Name', numero: 'Catalogue no.', mueble: 'Fixture', contenido: 'Contents', cantidad: 'Quantity',
    cartel: 'Has a sign', poste: 'on a pole', ancho: 'Width (m)', alto: 'Height (m)', quitar: 'Remove', recortes: 'Crops',
    sinRecortes: 'No crops yet: pick a photo on the right and mark 4 corners.', descargar: 'Download recipe for the workshop (JSON)',
    taller: 'Crop workshop', pieza: 'Piece', rol: 'Face', recortar: 'Crop', deshacer: 'Undo corner', borrar: 'Clear corners',
    ayudaFoto: n => n < 4 ? `Mark ${4 - n} more corner${4 - n === 1 ? '' : 's'} of a flat face (any order).` : 'Ready: press “Crop”.',
    sinFotos: 'Upload photos or a video on the left.', preparando: 'Preparing photos…', fotosListas: n => `${n} photo${n === 1 ? '' : 's'} ready.`,
    recortado: (rol, p) => `“${rol}” crop for ${p}.`, cruzadas: 'The corners cross: mark them again.', registroNo: 'I could not read the catalogue: type the numbers or leave them unassigned.',
    revisa: 'Before the recipe:', listo: 'Recipe ready for the 3D workshop.', descargada: f => `Recipe downloaded: ${f}.`, avisos: 'Warnings',
    err: { local: 'the venue is missing', 'sin-piezas': 'add at least one piece', 'demasiadas-piezas': 'too many pieces', 'demasiados-recortes': 'too many crops',
      nombre: 'a piece without a name', mueble: 'a piece without a fixture', contenido: 'a piece without contents', 'falta-logo': 'cups need the cup logo',
      'falta-frente': 'standing bags need the front face', 'falta-diseno': 'pillow bags need a bag design', 'falta-cartel': '“has a sign” is ticked but its crop is missing',
      numero: 'catalogue number to be assigned', png: 'a crop is not an image' }
  }
};

const el = (tag, attrs = {}, ...hijos) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) { if (k === 'class') n.className = v; else if (k in n && k !== 'list') n[k] = v; else n.setAttribute(k, v === true ? '' : v); }
  n.append(...hijos.filter(h => h != null)); return n;
};

export function montarDetallar({ pane, card, getLang = () => 'es', status = () => {}, localInicial = '' }) {
  const st = { fotos: [], foto: -1, puntos: [], piezas: [], recortes: [], registro: null, numerosLibres: [], pieza: 0, rol: 'cartel', img: null };
  const t = (k, ...a) => { const v = TEXTOS[getLang() === 'en' ? 'en' : 'es'][k]; return typeof v === 'function' ? v(...a) : v; };
  const nombreRol = r => (ROLES[r] || {})[getLang() === 'en' ? 'en' : 'es'] || r;

  // ── Izquierda ─────────────────────────────────────────────────────────────
  const lead = el('p', { class: 'arq-lead' });
  const inLocal = el('input', { id: 'dt-local', maxlength: 80, autocomplete: 'off', spellcheck: false, value: localInicial || 'alsea-sbux-021' });
  const inNombre = el('input', { id: 'dt-nombre', maxlength: 80, autocomplete: 'off', value: 'detalle' });
  const inAutor = el('input', { id: 'dt-autor', maxlength: 80, autocomplete: 'off' });
  const inFotos = el('input', { id: 'dt-fotos', type: 'file', accept: 'image/*,video/*', multiple: true });
  const lbl = { local: el('span'), nombre: el('span'), autor: el('span'), fotos: el('span'), piezas: el('strong'), recortes: el('strong') };
  const fotosN = el('span', { class: 'arq-drop-n' });
  const addPieza = el('button', { type: 'button', class: 'arq-mini', id: 'dt-add-pieza' });
  const listaPiezas = el('div', { id: 'dt-piezas', class: 'dt-piezas' });
  const listaRecortes = el('div', { id: 'dt-recortes', class: 'dt-recortes' });
  const revision = el('ul', { id: 'dt-revision', class: 'arq-dudas', hidden: true });
  const descargar = el('button', { type: 'button', id: 'dt-descargar', class: 'arq-btn arq-btn-ok' });
  pane.replaceChildren(lead,
    el('div', { class: 'arq-dims arq-dims-2' }, el('label', {}, lbl.local, inLocal), el('label', {}, lbl.nombre, inNombre)),
    el('label', { class: 'arq-field' }, lbl.autor, inAutor),
    el('label', { class: 'arq-drop' }, inFotos, lbl.fotos, fotosN),
    el('div', { class: 'arq-cis-head' }, lbl.piezas, addPieza), listaPiezas,
    el('div', { class: 'arq-cis-head' }, lbl.recortes), listaRecortes, revision,
    el('div', { class: 'arq-actions' }, descargar));

  // ── Derecha ───────────────────────────────────────────────────────────────
  const titulo = el('h2', { id: 'dt-titulo' });
  const selPieza = el('select', { id: 'dt-sel-pieza' }), selRol = el('select', { id: 'dt-sel-rol' });
  const lPieza = el('span'), lRol = el('span');
  const btnDeshacer = el('button', { type: 'button', class: 'arq-mini', id: 'dt-deshacer' }), btnBorrar = el('button', { type: 'button', class: 'arq-mini', id: 'dt-borrar' });
  const btnRecortar = el('button', { type: 'button', class: 'arq-btn', id: 'dt-recortar', disabled: true });
  const tira = el('div', { class: 'dt-tira', id: 'dt-tira', role: 'listbox' });
  const lienzo = el('canvas', { id: 'dt-lienzo', class: 'dt-lienzo', width: 800, height: 600 });
  const ayuda = el('p', { class: 'hint', id: 'dt-ayuda' });
  const vista = el('canvas', { id: 'dt-vista', class: 'dt-vista', width: 1, height: 1, hidden: true });
  card.replaceChildren(el('div', { class: 'card-head' }, titulo),
    el('div', { class: 'dt-barra' }, el('label', {}, lPieza, selPieza), el('label', {}, lRol, selRol), btnDeshacer, btnBorrar, btnRecortar),
    tira, el('div', { class: 'dt-foto' }, lienzo), ayuda, vista);

  // ── Catálogo: números libres desde el registro público de xpaceos ─────────
  fetch(REGISTRO_URL, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(reg => { st.registro = reg; numerar(); pintar(); })
    .catch(() => status(t('registroNo')));
  function numerar() {
    if (!st.registro) return;
    const usados = st.piezas.map(p => p.numero).filter(Number.isSafeInteger);
    const libres = siguientesNumeros({ numbers: { ...st.registro.numbers, ...Object.fromEntries(usados.map((n, i) => ['x' + i, n])) } }, st.piezas.length);
    for (const p of st.piezas) if (!Number.isSafeInteger(p.numero)) p.numero = libres.shift();
  }

  // ── Piezas ────────────────────────────────────────────────────────────────
  function nuevaPieza() {
    if (st.piezas.length >= MAX_PIEZAS) return;
    st.piezas.push({ nombre: '', numero: null, mueble: 'cesta_alta', contenido: 'bolsas_de_pie', cantidad: CONTENIDOS.bolsas_de_pie.cantidad, cartel: null });
    numerar(); st.pieza = st.piezas.length - 1; pintar();
  }
  addPieza.addEventListener('click', nuevaPieza);
  function opciones(sel, pares, valor) { sel.replaceChildren(...pares.map(([v, txt]) => el('option', { value: v, selected: v === valor }, txt))); }
  function filaPieza(p, i) {
    const lang = getLang() === 'en' ? 'en' : 'es';
    const nombre = el('input', { value: p.nombre, maxlength: 80, 'aria-label': t('nombre'), placeholder: t('nombre') });
    nombre.addEventListener('input', () => { p.nombre = nombre.value; pintarBarra(); pintarRecortes(); });
    const numero = el('input', { type: 'number', min: 1, max: 9999, value: p.numero ?? '', 'aria-label': t('numero') });
    numero.addEventListener('change', () => { const n = parseInt(numero.value, 10); p.numero = Number.isSafeInteger(n) && n > 0 ? n : null; });
    const mueble = el('select', { 'aria-label': t('mueble') }); opciones(mueble, Object.entries(MUEBLES).map(([k, m]) => [k, m[lang]]), p.mueble);
    mueble.addEventListener('change', () => { p.mueble = mueble.value; });
    const contenido = el('select', { 'aria-label': t('contenido') }); opciones(contenido, Object.entries(CONTENIDOS).map(([k, c]) => [k, c[lang]]), p.contenido);
    const cantidad = el('input', { type: 'number', min: 0, max: 60, value: p.cantidad, 'aria-label': t('cantidad') });
    contenido.addEventListener('change', () => { p.contenido = contenido.value; p.cantidad = CONTENIDOS[p.contenido].cantidad; cantidad.value = p.cantidad; pintarBarra(); });
    cantidad.addEventListener('change', () => { p.cantidad = Math.max(0, Math.min(60, parseInt(cantidad.value, 10) || 0)); });
    const conCartel = el('input', { type: 'checkbox', checked: !!p.cartel });
    const poste = el('input', { type: 'checkbox', checked: !!(p.cartel && p.cartel.poste) });
    const ancho = el('input', { type: 'number', min: 0.05, max: 0.6, step: 0.01, value: p.cartel ? p.cartel.ancho : 0.3, 'aria-label': t('ancho') });
    const alto = el('input', { type: 'number', min: 0.1, max: 1.4, step: 0.01, value: p.cartel ? p.cartel.alto : 0.8, 'aria-label': t('alto') });
    const leerCartel = () => { p.cartel = conCartel.checked ? { ancho: parseFloat(ancho.value) || 0.3, alto: parseFloat(alto.value) || 0.8, poste: poste.checked } : null; pintarBarra(); };
    for (const n of [conCartel, poste, ancho, alto]) n.addEventListener('change', leerCartel);
    const quitar = el('button', { type: 'button', class: 'arq-mini' }, t('quitar'));
    quitar.addEventListener('click', () => { st.piezas.splice(i, 1); st.recortes = st.recortes.filter(r => r.pieza !== i).map(r => ({ ...r, pieza: r.pieza > i ? r.pieza - 1 : r.pieza })); st.pieza = 0; pintar(); });
    return el('fieldset', { class: 'dt-pieza' + (i === st.pieza ? ' activa' : '') },
      el('legend', {}, `${t('pieza')} ${i + 1}`),
      el('div', { class: 'arq-dims arq-dims-2' }, el('label', {}, el('span', {}, t('nombre')), nombre), el('label', {}, el('span', {}, t('numero')), numero)),
      el('div', { class: 'arq-dims arq-dims-2' }, el('label', {}, el('span', {}, t('mueble')), mueble), el('label', {}, el('span', {}, t('contenido')), contenido)),
      el('div', { class: 'arq-dims dt-cartel' }, el('label', {}, el('span', {}, t('cantidad')), cantidad),
        el('label', { class: 'arq-check' }, conCartel, el('span', {}, t('cartel'))), el('label', { class: 'arq-check' }, poste, el('span', {}, t('poste'))),
        el('label', {}, el('span', {}, t('ancho')), ancho), el('label', {}, el('span', {}, t('alto')), alto)),
      el('div', { class: 'arq-actions' }, quitar));
  }

  // ── Recortes ──────────────────────────────────────────────────────────────
  function pintarRecortes() {
    if (!st.recortes.length) { listaRecortes.replaceChildren(el('p', { class: 'hint' }, t('sinRecortes'))); return; }
    listaRecortes.replaceChildren(...st.recortes.map((r, i) => {
      const quitar = el('button', { type: 'button', class: 'arq-mini', 'aria-label': t('quitar') }, '✕');
      quitar.addEventListener('click', () => { st.recortes.splice(i, 1); pintarRecortes(); revisar(); });
      const p = st.piezas[r.pieza];
      return el('figure', { class: 'dt-recorte' }, el('img', { src: r.png, alt: '' }),
        el('figcaption', {}, `${nombreRol(r.rol)} · ${(p && p.nombre) || `${t('pieza')} ${r.pieza + 1}`}`), quitar);
    }));
  }

  // ── Barra del taller: pieza y cara ────────────────────────────────────────
  function pintarBarra() {
    opciones(selPieza, st.piezas.map((p, i) => [String(i), p.nombre || `${t('pieza')} ${i + 1}`]), String(st.pieza));
    const p = st.piezas[st.pieza], roles = p ? [...(p.cartel ? ['cartel'] : []), ...CONTENIDOS[p.contenido].roles] : [];
    if (!roles.includes(st.rol)) st.rol = roles[0] || '';
    opciones(selRol, roles.map(r => [r, nombreRol(r)]), st.rol);
    btnRecortar.disabled = !(st.puntos.length === 4 && p && st.rol);
  }
  selPieza.addEventListener('change', () => { st.pieza = parseInt(selPieza.value, 10) || 0; pintar(); });
  selRol.addEventListener('change', () => { st.rol = selRol.value; });

  // ── Fotos y lienzo ────────────────────────────────────────────────────────
  inFotos.addEventListener('change', async () => {
    if (!inFotos.files.length) return;
    status(t('preparando'));
    const { fotos } = await prepararFotos(inFotos.files);
    st.fotos = fotos; fotosN.textContent = fotos.length ? `(${fotos.length})` : ''; status(t('fotosListas', fotos.length));
    if (fotos.length) elegirFoto(0); else pintarTira();
  });
  function pintarTira() {
    tira.replaceChildren(...st.fotos.map((src, i) => {
      const b = el('button', { type: 'button', role: 'option', 'aria-selected': String(i === st.foto), class: 'dt-miniatura' }, el('img', { src, alt: `${i + 1}` }));
      b.addEventListener('click', () => elegirFoto(i)); return b;
    }));
  }
  function elegirFoto(i) {
    st.foto = i; st.puntos = []; pintarTira();
    const img = new Image(); img.onload = () => { st.img = img; dibujar(); }; img.src = st.fotos[i];
  }
  const escala = () => (st.img ? lienzo.width / st.img.naturalWidth : 1);
  function dibujar() {
    const ctx = lienzo.getContext('2d');
    if (!st.img) { lienzo.width = 800; lienzo.height = 200; ctx.clearRect(0, 0, 800, 200); ayuda.textContent = t('sinFotos'); pintarBarra(); return; }
    const w = Math.min(1200, st.img.naturalWidth); lienzo.width = w; lienzo.height = Math.round(st.img.naturalHeight * w / st.img.naturalWidth);
    ctx.drawImage(st.img, 0, 0, lienzo.width, lienzo.height);
    const k = escala(), pts = st.puntos.length === 4 ? ordenarEsquinas(st.puntos) : st.puntos;
    ctx.lineWidth = 3; ctx.strokeStyle = '#7CFFB2'; ctx.fillStyle = 'rgba(124,255,178,.18)';
    if (pts.length) { ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k))); if (pts.length === 4) { ctx.closePath(); ctx.fill(); } ctx.stroke(); }
    pts.forEach(([x, y], j) => { ctx.beginPath(); ctx.arc(x * k, y * k, 9, 0, Math.PI * 2); ctx.fillStyle = '#0b3d2e'; ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui'; ctx.fillText(String(j + 1), x * k - 4, y * k + 4); ctx.fillStyle = 'rgba(124,255,178,.18)'; });
    ayuda.textContent = t('ayudaFoto', st.puntos.length); pintarBarra();
  }
  lienzo.addEventListener('click', ev => {
    if (!st.img || st.puntos.length >= 4) return;
    const r = lienzo.getBoundingClientRect(), k = escala() * (r.width / lienzo.width);
    st.puntos.push([(ev.clientX - r.left) / k, (ev.clientY - r.top) / k]); dibujar();
  });
  btnDeshacer.addEventListener('click', () => { st.puntos.pop(); dibujar(); });
  btnBorrar.addEventListener('click', () => { st.puntos = []; dibujar(); });
  btnRecortar.addEventListener('click', () => {
    if (st.puntos.length !== 4 || !st.img || st.recortes.length >= MAX_RECORTES) return;
    const esquinas = ordenarEsquinas(st.puntos);
    try { validarEsquinas(esquinas); } catch { status(t('cruzadas'), { error: true }); st.puntos = []; dibujar(); return; }
    const W = st.img.naturalWidth, H = st.img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(st.img, 0, 0);
    const tam = tamRecorte(esquinas), out = enderezar(ctx.getImageData(0, 0, W, H), esquinas, tam);
    vista.width = out.width; vista.height = out.height; vista.hidden = false;
    vista.getContext('2d').putImageData(new ImageData(out.data, out.width, out.height), 0, 0);
    const p = st.piezas[st.pieza];
    st.recortes.push({ nombre: (p && p.nombre) || `${t('pieza')} ${st.pieza + 1}`, pieza: st.pieza, rol: st.rol, png: vista.toDataURL('image/png'), tam, foto: st.foto, esquinas: esquinas.map(q => q.map(v => Math.round(v))) });
    status(t('recortado', nombreRol(st.rol), (p && p.nombre) || `${t('pieza')} ${st.pieza + 1}`));
    st.puntos = []; dibujar(); pintarRecortes(); revisar();
  });

  // ── Revisión y receta ─────────────────────────────────────────────────────
  const encargo = () => ({ nombre: inNombre.value, local: inLocal.value.trim(), autor: inAutor.value, piezas: st.piezas, recortes: st.recortes });
  function textoError(code) {
    const m = String(code).match(/^pieza-(\d+)-(.+)$/), err = t('err');
    if (m) { const p = st.piezas[+m[1]]; return `${(p && p.nombre) || `${t('pieza')} ${+m[1] + 1}`}: ${err[m[2]] || m[2]}`; }
    return err[code] || err[String(code).replace(/^recorte-.*-/, '')] || code;
  }
  function revisar() {
    const r = revisarEncargo(encargo());
    const filas = [...r.errores.map(e => el('li', {}, textoError(e))), ...r.avisos.filter(a => !/sin-uso$/.test(a)).map(a => el('li', { class: 'aviso' }, `${t('avisos')}: ${textoError(a)}`))];
    revision.replaceChildren(...(filas.length ? [el('li', { class: 'cab' }, t('revisa')), ...filas] : []));
    revision.hidden = !filas.length; descargar.disabled = !r.ok; return r;
  }
  descargar.addEventListener('click', () => {
    if (!revisar().ok) return;
    const receta = recetaDetallar(encargo()), nombre = receta.encargo + '.receta.json';
    const url = URL.createObjectURL(new Blob([JSON.stringify(receta, null, 1) + '\n'], { type: 'application/json' }));
    const a = el('a', { href: url, download: nombre }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    status(t('descargada', nombre));
  });
  for (const n of [inLocal, inNombre]) n.addEventListener('input', revisar);

  function pintarTextos() {
    lead.textContent = t('lead'); lbl.local.textContent = t('local'); lbl.nombre.textContent = t('encargo'); lbl.autor.textContent = t('autor'); lbl.fotos.textContent = t('fotos');
    lbl.piezas.textContent = t('piezas'); lbl.recortes.textContent = t('recortes'); addPieza.textContent = t('addPieza'); descargar.textContent = t('descargar');
    titulo.textContent = t('taller'); lPieza.textContent = t('pieza'); lRol.textContent = t('rol'); btnRecortar.textContent = t('recortar'); btnDeshacer.textContent = t('deshacer'); btnBorrar.textContent = t('borrar');
  }
  function pintar() { pintarTextos(); listaPiezas.replaceChildren(...st.piezas.map(filaPieza)); pintarRecortes(); dibujar(); revisar(); }
  nuevaPieza();
  return { setLang: pintar, estado: () => st };
}
