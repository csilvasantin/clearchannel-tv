// Arquitecto · orden «fotos» en la página (lo puro está en arquitecto-galeria.mjs).
// Izquierda: el local, las fotos de cada pared (se quedan en este navegador) y la foto 360.
// Derecha: la foto elegida en grande o el editor de la 360 (vista inicial y esquinas de cada pantalla) y su publicación.
import { LADO_FOTO, MAX_FOTOS_LOCAL, SIN_PARED, escalaFoto, fotosPorPared, nombrePared, esEquirectangular, tamanos360, vistaDesdePixel, pixelDesdeVista,
  rutas360, urlDe, bloquePanorama, revisarPanorama, desenvolver } from './arquitecto-galeria.mjs?v=20261018-fotos-1';
import { urlGemelo3D } from './arquitecto-modelar.mjs?v=20261018-modelar-1';

const TEXTOS = {
  es: {
    lead: 'Las fotos del local, cada una en su pared del plano, y su foto 360 como vista Matrix del gemelo. Las fotos de las paredes se quedan en este navegador: pueden salir personas y no se publican.',
    local: 'Local (Xpacio)', sinPlano: id => `No encuentro el plano de «${id || '—'}». Créalo o súbelo antes: las fotos van a sus paredes.`,
    paredes: 'Fotos de las paredes', subir: 'Fotos (se pueden elegir varias)', pared: 'Pared', sinPared: 'Sin pared', quitar: 'Quitar', ninguna: 'Todavía no hay fotos.',
    guardadas: n => `${n} foto${n === 1 ? '' : 's'} guardada${n === 1 ? '' : 's'} en este navegador.`, tope: `Como mucho ${MAX_FOTOS_LOCAL} fotos por local.`, sinAlmacen: 'Este navegador no deja guardar las fotos (modo privado o almacenamiento bloqueado).',
    p360: 'Foto 360', publicada: 'Este local ya tiene su 360 publicada.', verGemelo: 'Verla en el gemelo (360 · Matrix)', editarPublicada: 'Abrir la publicada para marcar sus pantallas',
    subir360: 'Foto 360 nueva (equirectangular 2:1, Insta360)', no360: (w, h) => `Esa foto no es una 360 equirectangular (2:1): mide ${w} × ${h}.`, preparando: 'Preparando la 360 (tres tamaños)…', lista360: '360 lista para marcar.',
    titulo: 'Fotos y 360', fotoTitulo: 'Foto de la pared', editor: 'Editor de la 360', modo: 'Marcar', mVista: 'Vista inicial', mPantalla: 'Pantalla', idPantalla: 'Pantalla',
    nueva: 'otra…', deshacer: 'Deshacer esquina', quitarPantalla: 'Quitar pantalla', ayudaVista: 'Toca el punto que se ve primero al abrir la 360.',
    ayudaPantalla: (id, n) => `«${id}»: toca ${4 - n} esquina${4 - n === 1 ? '' : 's'} más (en cualquier orden).`, marcada: id => `Pantalla «${id}» marcada.`,
    marcadas: 'Pantallas marcadas', ningunaMarcada: 'ninguna', vistaTxt: v => `yaw ${v.yaw}° · pitch ${v.pitch}°`,
    publicar: 'Publicar en el gemelo', sinPersonas: 'Confirmo que la 360 no muestra personas reconocibles (o van difuminadas).',
    bajarBloque: 'Descargar el bloque «panorama» (JSON)', bajarFotos: 'Descargar las imágenes', notaPublicar: 'Las imágenes van a xpaceos y admira.store (/xpacios/360/<local>/) y el bloque al plano del local; se publican con respaldo. Hasta entonces la vista 360 del gemelo no las ve.',
    descargado: f => `Descargado: ${f}.`, revisa: 'Antes de publicar:',
    err: { src: 'falta la foto', base: 'la foto no es 2:1', vista: 'falta la vista inicial', 'pantalla-id': 'una pantalla sin id', repetida: 'pantalla repetida', esquinas: 'faltan esquinas',
      fuera: 'esquinas fuera de la foto', cruzada: 'esquinas cruzadas', personas: 'confirma que no salen personas' }
  },
  en: {
    lead: 'The venue photos, each on its wall of the floor plan, and its 360 photo as the twin’s Matrix view. Wall photos stay in this browser: people may appear and they are never published.',
    local: 'Venue (Xpace)', sinPlano: id => `I can’t find the floor plan of “${id || '—'}”. Create or upload it first: photos go to its walls.`,
    paredes: 'Wall photos', subir: 'Photos (you can pick several)', pared: 'Wall', sinPared: 'No wall', quitar: 'Remove', ninguna: 'No photos yet.',
    guardadas: n => `${n} photo${n === 1 ? '' : 's'} saved in this browser.`, tope: `At most ${MAX_FOTOS_LOCAL} photos per venue.`, sinAlmacen: 'This browser does not let me save the photos (private mode or blocked storage).',
    p360: '360 photo', publicada: 'This venue already has its 360 published.', verGemelo: 'See it in the twin (360 · Matrix)', editarPublicada: 'Open the published one to mark its screens',
    subir360: 'New 360 photo (equirectangular 2:1, Insta360)', no360: (w, h) => `That photo is not an equirectangular 360 (2:1): it is ${w} × ${h}.`, preparando: 'Preparing the 360 (three sizes)…', lista360: '360 ready to mark.',
    titulo: 'Photos and 360', fotoTitulo: 'Wall photo', editor: '360 editor', modo: 'Mark', mVista: 'Starting view', mPantalla: 'Screen', idPantalla: 'Screen',
    nueva: 'other…', deshacer: 'Undo corner', quitarPantalla: 'Remove screen', ayudaVista: 'Tap the point seen first when the 360 opens.',
    ayudaPantalla: (id, n) => `“${id}”: tap ${4 - n} more corner${4 - n === 1 ? '' : 's'} (any order).`, marcada: id => `Screen “${id}” marked.`,
    marcadas: 'Marked screens', ningunaMarcada: 'none', vistaTxt: v => `yaw ${v.yaw}° · pitch ${v.pitch}°`,
    publicar: 'Publish in the twin', sinPersonas: 'I confirm the 360 shows no recognisable people (or they are blurred).',
    bajarBloque: 'Download the “panorama” block (JSON)', bajarFotos: 'Download the images', notaPublicar: 'The images go to xpaceos and admira.store (/xpacios/360/<venue>/) and the block to the venue plan; they are published with a backup. Until then the twin’s 360 view does not see them.',
    descargado: f => `Downloaded: ${f}.`, revisa: 'Before publishing:',
    err: { src: 'the photo is missing', base: 'the photo is not 2:1', vista: 'starting view missing', 'pantalla-id': 'a screen without id', repetida: 'repeated screen', esquinas: 'corners missing',
      fuera: 'corners outside the photo', cruzada: 'crossed corners', personas: 'confirm that no people appear' }
  }
};

const el = (tag, attrs = {}, ...hijos) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) { if (k === 'class') n.className = v; else if (k in n && k !== 'list') n[k] = v; else n.setAttribute(k, v === true ? '' : v); }
  n.append(...hijos.filter(h => h != null)); return n;
};

// ── Almacén en este navegador: IndexedDB «admira-fotos», un registro por local {id, fotos:[…], panorama:{…}} con Blobs ──
function almacenFotos() {
  let db = null;
  const abrir = () => db || (db = new Promise((ok, mal) => {
    try { const r = indexedDB.open('admira-fotos', 1); r.onupgradeneeded = () => r.result.createObjectStore('locales', { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); }
    catch (e) { mal(e); }
  }));
  const tx = async (modo, f) => { const d = await abrir(); return new Promise((ok, mal) => { const t = d.transaction('locales', modo), s = t.objectStore('locales'), r = f(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => mal(t.error); }); };
  return { leer: id => tx('readonly', s => s.get(id)).catch(() => null), guardar: reg => tx('readwrite', s => s.put(reg)).then(() => true).catch(() => false) };
}
async function aBlob(fuente, w, h, tipo = 'image/jpeg', calidad = 0.85) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(fuente, 0, 0, w, h);
  return new Promise(ok => c.toBlob(b => ok(b), tipo, calidad));
}

export function montarGaleria({ pane, card, getLang = () => 'es', status = () => {}, localInicial = '', leerPlano = async () => null }) {
  const almacen = almacenFotos(), urls = new Map();
  const st = { local: null, plano: null, reg: null, foto: null, editor: null, modo: 'pantalla', pantalla: '', puntos: [], sinPersonas: false };
  const t = (k, ...a) => { const v = TEXTOS[getLang() === 'en' ? 'en' : 'es'][k]; return typeof v === 'function' ? v(...a) : v; };
  const T = () => TEXTOS[getLang() === 'en' ? 'en' : 'es'];
  const url = blob => { if (!urls.has(blob)) urls.set(blob, URL.createObjectURL(blob)); return urls.get(blob); };
  const guardar = async () => { if (!st.reg) return false; const ok = await almacen.guardar(st.reg); if (!ok) status(t('sinAlmacen'), { error: true }); return ok; };

  // ── Izquierda ──
  const lead = el('p', { class: 'arq-lead' }), lLocal = el('span'), inLocal = el('input', { id: 'ft-local', maxlength: 80, autocomplete: 'off', spellcheck: false, value: localInicial || 'alsea-sbux-021' });
  const hParedes = el('strong'), lSubir = el('span'), inFotos = el('input', { id: 'ft-fotos', type: 'file', accept: 'image/*', multiple: true }), lista = el('div', { id: 'ft-lista', class: 'ft-lista' });
  const h360 = el('strong'), info360 = el('p', { class: 'hint', id: 'ft-info360' }), aGemelo = el('a', { id: 'ft-gemelo', class: 'arq-btn', target: '_blank', rel: 'noopener', hidden: true });
  const bPublicada = el('button', { type: 'button', id: 'ft-publicada', class: 'arq-btn', hidden: true }), l360 = el('span'), in360 = el('input', { id: 'ft-360', type: 'file', accept: 'image/*' });
  pane.replaceChildren(lead, el('label', { class: 'arq-field' }, lLocal, inLocal),
    el('div', { class: 'arq-cis-head' }, hParedes), el('label', { class: 'arq-drop' }, inFotos, lSubir), lista,
    el('div', { class: 'arq-cis-head' }, h360), info360, el('div', { class: 'arq-actions md-salidas' }, aGemelo, bPublicada), el('label', { class: 'arq-drop' }, in360, l360));

  // ── Derecha ──
  const titulo = el('h2', { id: 'ft-titulo' });
  const secFoto = el('section', { id: 'ft-foto', hidden: true }), hFoto = el('h3', { class: 'dt-titulo-plano' }), imgFoto = el('img', { id: 'ft-foto-img', class: 'ft-foto-img', alt: '' });
  secFoto.append(hFoto, imgFoto);
  const secEditor = el('section', { id: 'ft-editor', hidden: true }), hEditor = el('h3', { class: 'dt-titulo-plano' });
  const selModo = el('select', { id: 'ft-modo' }), selPantalla = el('select', { id: 'ft-pantalla' }), inNueva = el('input', { id: 'ft-nueva', maxlength: 40, placeholder: 'PANTALLA-01', hidden: true });
  const lModo = el('span'), lPantalla = el('span'), bDeshacer = el('button', { type: 'button', class: 'arq-mini', id: 'ft-deshacer' });
  const lienzo = el('canvas', { id: 'ft-lienzo', class: 'ft-lienzo', width: 1200, height: 600 }), ayuda = el('p', { class: 'hint', id: 'ft-ayuda' });
  const marcadas = el('ul', { id: 'ft-marcadas', class: 'ft-marcadas' }), hMarcadas = el('strong');
  const cPersonas = el('input', { type: 'checkbox', id: 'ft-personas' }), lPersonas = el('span'), revision = el('ul', { id: 'ft-revision', class: 'arq-dudas', hidden: true });
  const bBloque = el('button', { type: 'button', id: 'ft-bloque', class: 'arq-btn' }), bImagenes = el('button', { type: 'button', id: 'ft-imagenes', class: 'arq-btn' }), notaPub = el('p', { class: 'hint' }), hPublicar = el('strong');
  secEditor.append(hEditor, el('div', { class: 'dt-barra' }, el('label', {}, lModo, selModo), el('label', {}, lPantalla, selPantalla, inNueva), bDeshacer),
    el('div', { class: 'dt-foto' }, lienzo), ayuda, el('div', { class: 'arq-cis-head' }, hMarcadas), marcadas,
    el('div', { class: 'arq-cis-head' }, hPublicar), el('label', { class: 'arq-check' }, cPersonas, lPersonas), revision, el('div', { class: 'arq-actions md-salidas' }, bBloque, bImagenes), notaPub);
  card.replaceChildren(el('div', { class: 'card-head' }, titulo), secFoto, secEditor);

  // ── Local y plano ──
  let pedido = 0, espera = 0;
  async function cargar() {
    const id = inLocal.value.trim(); if (id === st.local) return;
    const n = ++pedido; st.local = id; st.plano = null; st.reg = null; st.foto = null; st.editor = null; st.puntos = []; pintar();
    const [plano, reg] = await Promise.all([leerPlano(id).catch(() => null), almacen.leer(id)]);
    if (n !== pedido) return;
    st.plano = plano && Array.isArray(plano.paredes) ? plano : null;
    st.reg = reg && reg.id === id ? reg : { id, fotos: [], panorama: null };
    if (st.reg.panorama) abrirEditor(st.reg.panorama);
    pintar();
  }
  inLocal.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(cargar, 600); });
  inLocal.addEventListener('change', () => { clearTimeout(espera); cargar(); });

  // ── Fotos de las paredes ──
  inFotos.addEventListener('change', async () => {
    if (!st.reg || !st.plano) return;
    const files = [...inFotos.files].filter(f => /^image\//.test(f.type)); inFotos.value = '';
    for (const f of files) {
      if (st.reg.fotos.length >= MAX_FOTOS_LOCAL) { status(t('tope'), { error: true }); break; }
      try {
        const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }), e = escalaFoto(bmp.width, bmp.height, LADO_FOTO);
        const blob = await aBlob(bmp, e.w, e.h); bmp.close && bmp.close();
        st.reg.fotos.push({ id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, nombre: f.name.slice(0, 80), pared: st.plano.paredes[0].id, w: e.w, h: e.h, fecha: new Date().toISOString(), blob });
      } catch { /* foto ilegible: se salta */ }
    }
    if (await guardar()) status(t('guardadas', st.reg.fotos.length));
    pintar();
  });
  function pintarLista() {
    if (!st.reg || !st.plano) { lista.replaceChildren(el('p', { class: 'hint' }, st.local ? t('sinPlano', st.local) : '')); return; }
    if (!st.reg.fotos.length) { lista.replaceChildren(el('p', { class: 'hint' }, t('ninguna'))); return; }
    const grupos = fotosPorPared(st.reg.fotos, st.plano), opciones = [...st.plano.paredes.map(w => [w.id, nombrePared(st.plano, w.id)]), [SIN_PARED, t('sinPared')]];
    lista.replaceChildren(...[...grupos].filter(([, fs]) => fs.length).map(([pared, fs]) => el('div', { class: 'ft-grupo' },
      el('div', { class: 'ft-grupo-cab' }, pared === SIN_PARED ? t('sinPared') : nombrePared(st.plano, pared), ` (${fs.length})`),
      el('div', { class: 'dt-recortes' }, ...fs.map(f => {
        const sel = el('select', { 'aria-label': t('pared') }, ...opciones.map(([v, txt]) => el('option', { value: v, selected: v === f.pared }, txt)));
        sel.addEventListener('change', async () => { f.pared = sel.value; await guardar(); pintar(); });
        const quitar = el('button', { type: 'button', class: 'arq-mini', 'aria-label': t('quitar') }, '✕');
        quitar.addEventListener('click', async () => { st.reg.fotos = st.reg.fotos.filter(x => x !== f); if (st.foto === f) st.foto = null; await guardar(); pintar(); });
        const img = el('img', { src: url(f.blob), alt: f.nombre, class: 'ft-mini' }); img.addEventListener('click', () => { st.foto = f; pintar(); });
        return el('figure', { class: 'dt-recorte' }, img, el('figcaption', {}, sel), quitar);
      })))));
  }

  // ── Foto 360 ──
  in360.addEventListener('change', async () => {
    const f = in360.files[0]; in360.value = ''; if (!f || !st.reg) return;
    try {
      const bmp = await createImageBitmap(f);
      if (!esEquirectangular(bmp.width, bmp.height)) { status(t('no360', bmp.width, bmp.height), { error: true }); bmp.close && bmp.close(); return; }
      status(t('preparando'));
      const tam = tamanos360(bmp.width, bmp.height);
      let src = await aBlob(bmp, tam.src.w, tam.src.h, 'image/webp', 0.85);
      if (!src || src.type !== 'image/webp') src = await aBlob(bmp, tam.src.w, tam.src.h, 'image/jpeg', 0.88);
      const srcMovil = await aBlob(bmp, tam.srcMovil.w, tam.srcMovil.h, 'image/jpeg', 0.86), previa = await aBlob(bmp, tam.previa.w, tam.previa.h, 'image/jpeg', 0.82);
      bmp.close && bmp.close();
      const base = [tam.src.w, tam.src.h];
      st.reg.panorama = { base, vista: { ...vistaDesdePixel(base[0] / 2, base[1] / 2, base), fov: 100, sphereX: 0, sphereY: 0 }, pantallas: [], nombre: f.name.slice(0, 80), fecha: new Date().toISOString(),
        ext: src.type === 'image/webp' ? 'webp' : 'jpg', blobs: { src, srcMovil, previa } };
      await guardar(); abrirEditor(st.reg.panorama); status(t('lista360'));
    } catch { status(t('no360', '?', '?'), { error: true }); }
    pintar();
  });
  // La 360 publicada (la del plano) se abre en el editor para marcar o revisar sus pantallas.
  bPublicada.addEventListener('click', () => {
    const p = st.plano && st.plano.panorama; if (!p || !st.reg) return;
    st.reg.panorama = { base: [...p.base], vista: { ...p.vista }, pantallas: (p.pantallas || []).map(s => ({ id: s.id, esquinas: s.esquinas.map(q => [...q]) })), publicada: true,
      urls: { src: urlDe(p.src), srcMovil: urlDe(p.srcMovil || p.src), previa: urlDe(p.previa || p.srcMovil || p.src) }, rutas: { src: p.src, srcMovil: p.srcMovil, previa: p.previa }, fecha: new Date().toISOString() };
    guardar(); abrirEditor(st.reg.panorama); pintar();
  });
  function abrirEditor(pan) {
    st.editor = { pan, img: null }; st.puntos = [];
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { if (st.editor && st.editor.pan === pan) { st.editor.img = img; dibujar(); } };
    img.src = pan.blobs ? url(pan.blobs.previa || pan.blobs.srcMovil) : pan.urls.previa;
  }
  const idsPlan = () => ((st.plano && st.plano.pantallas) || []).map(s => s.id);
  selModo.addEventListener('change', () => { st.modo = selModo.value; st.puntos = []; pintar(); });
  selPantalla.addEventListener('change', () => { st.pantalla = selPantalla.value; st.puntos = []; pintar(); });
  inNueva.addEventListener('input', () => { st.puntos = []; pintarEditor(); });
  bDeshacer.addEventListener('click', () => { st.puntos.pop(); pintarEditor(); });
  cPersonas.addEventListener('change', () => { st.sinPersonas = cPersonas.checked; pintarEditor(); });
  const idActual = () => (st.pantalla === '__nueva' ? inNueva.value.trim() : st.pantalla);
  lienzo.addEventListener('click', async ev => {
    const ed = st.editor; if (!ed || !ed.img) return;
    const r = lienzo.getBoundingClientRect(), base = ed.pan.base, x = (ev.clientX - r.left) / r.width * base[0], y = (ev.clientY - r.top) / r.height * base[1];
    if (st.modo === 'vista') { Object.assign(ed.pan.vista, vistaDesdePixel(x, y, base)); await guardar(); pintarEditor(); return; }
    const id = idActual(); if (!/^[A-Za-z0-9-]{1,40}$/.test(id)) return;
    st.puntos.push([Math.round(x), Math.round(y)]);
    if (st.puntos.length === 4) {
      // Esquinas ya ordenadas (arriba-izq, arriba-dcha, abajo-dcha, abajo-izq), también si cruzan el borde de la foto.
      const esquinas = bloquePanorama({ id: st.reg.id, base, pantallas: [{ id, esquinas: st.puntos }] }).pantallas[0].esquinas;
      ed.pan.pantallas = ed.pan.pantallas.filter(s => s.id !== id).concat([{ id, esquinas }]); st.puntos = [];
      await guardar(); status(t('marcada', id));
    }
    pintarEditor();
  });
  function bloque() {
    const ed = st.editor; if (!ed || !st.reg) return null;
    const p = ed.pan, rutas = p.rutas && p.rutas.src ? p.rutas : null;
    return bloquePanorama({ id: st.reg.id, base: p.base, vista: p.vista, pantallas: p.pantallas, ext: p.ext || 'webp', rutas, origen: p.publicada ? (st.plano.panorama && st.plano.panorama.origen) : `Foto 360 «${p.nombre || ''}» subida en el Arquitecto el ${String(p.fecha || '').slice(0, 10)}` });
  }
  function bajar(nombre, blob) {
    const u = URL.createObjectURL(blob), a = el('a', { href: u, download: nombre }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000);
    status(t('descargado', nombre));
  }
  bBloque.addEventListener('click', () => { const b = bloque(); if (b && st.sinPersonas && revisarPanorama(b).ok) bajar(`${st.reg.id}-panorama.json`, new Blob([JSON.stringify({ panorama: b }, null, 2) + '\n'], { type: 'application/json' })); });
  bImagenes.addEventListener('click', () => {
    const p = st.editor && st.editor.pan; if (!p || !p.blobs || !st.sinPersonas) return;
    const r = rutas360(st.reg.id, p.ext || 'webp');
    for (const k of ['src', 'srcMovil', 'previa']) bajar(r[k].split('/').pop(), p.blobs[k]);
  });

  // ── Pintar ──
  function dibujar() {
    const ed = st.editor, ctx = lienzo.getContext('2d');
    if (!ed || !ed.img) { lienzo.width = 1200; lienzo.height = 600; ctx.fillStyle = '#0b0f0e'; ctx.fillRect(0, 0, 1200, 600); return; }
    lienzo.width = 1200; lienzo.height = 600; ctx.drawImage(ed.img, 0, 0, 1200, 600);
    const k = 1200 / ed.pan.base[0], P = ([x, y]) => [x * k, y * k];
    ctx.lineWidth = 2; ctx.font = 'bold 12px system-ui';
    // Una pantalla que cruza el borde de la foto se dibuja desenvuelta, a los dos lados.
    for (const s of ed.pan.pantallas) for (const dx of [0, -ed.pan.base[0]]) {
      const e = desenvolver(s.esquinas, ed.pan.base[0]).map(([x, y]) => [x + dx, y]);
      if (dx && Math.max(...e.map(q => q[0])) < 0) continue;
      ctx.strokeStyle = '#7cffb2'; ctx.fillStyle = 'rgba(124,255,178,.18)'; ctx.beginPath(); e.forEach((q, i) => { const [x, y] = P(q); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill(); ctx.stroke();
      const [x, y] = P(e[0]); ctx.fillStyle = '#eafff3'; ctx.fillText(s.id, Math.max(2, x), Math.max(12, y - 4));
    }
    ctx.fillStyle = '#ffc44d'; for (const q of st.puntos) { const [x, y] = P(q); ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
    const [vx, vy] = P(pixelDesdeVista(ed.pan.vista.yaw, ed.pan.vista.pitch, ed.pan.base));
    ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(vx - 12, vy); ctx.lineTo(vx + 12, vy); ctx.moveTo(vx, vy - 12); ctx.lineTo(vx, vy + 12); ctx.stroke();
  }
  function pintarEditor() {
    const ed = st.editor, tx = T(); secEditor.hidden = !ed;
    if (!ed) return;
    hEditor.textContent = t('editor'); lModo.textContent = t('modo'); lPantalla.textContent = t('idPantalla'); bDeshacer.textContent = t('deshacer');
    selModo.replaceChildren(...[['pantalla', t('mPantalla')], ['vista', t('mVista')]].map(([v, x]) => el('option', { value: v, selected: v === st.modo }, x)));
    const ids = [...new Set([...idsPlan(), ...ed.pan.pantallas.map(s => s.id)])];
    if (!st.pantalla || (st.pantalla !== '__nueva' && !ids.includes(st.pantalla))) st.pantalla = ids[0] || '__nueva';
    selPantalla.replaceChildren(...ids.map(id => el('option', { value: id, selected: id === st.pantalla }, id)), el('option', { value: '__nueva', selected: st.pantalla === '__nueva' }, t('nueva')));
    selPantalla.hidden = st.modo !== 'pantalla'; inNueva.hidden = st.modo !== 'pantalla' || st.pantalla !== '__nueva'; lPantalla.hidden = st.modo !== 'pantalla';
    ayuda.textContent = st.modo === 'vista' ? `${t('ayudaVista')} ${tx.vistaTxt(ed.pan.vista)}` : t('ayudaPantalla', idActual() || '—', st.puntos.length);
    hMarcadas.textContent = t('marcadas');
    marcadas.replaceChildren(...(ed.pan.pantallas.length ? ed.pan.pantallas.map(s => {
      const q = el('button', { type: 'button', class: 'arq-mini' }, '✕'); q.addEventListener('click', async () => { ed.pan.pantallas = ed.pan.pantallas.filter(x => x !== s); await guardar(); pintarEditor(); });
      return el('li', {}, `${s.id} `, q);
    }) : [el('li', { class: 'hint' }, t('ningunaMarcada'))]));
    hPublicar.textContent = t('publicar'); lPersonas.textContent = t('sinPersonas'); cPersonas.checked = st.sinPersonas;
    bBloque.textContent = t('bajarBloque'); bImagenes.textContent = t('bajarFotos'); notaPub.textContent = t('notaPublicar');
    const b = bloque(), r = b ? revisarPanorama(b) : { ok: false, errores: ['src'] }, errs = [...r.errores, ...(st.sinPersonas ? [] : ['personas'])];
    const texto = c => { const m = String(c).match(/^pantalla-(.+)-(repetida|esquinas|fuera|cruzada)$/); return m ? `${m[1]}: ${tx.err[m[2]]}` : (tx.err[c] || c); };
    revision.replaceChildren(...(errs.length ? [el('li', { class: 'cab' }, t('revisa')), ...errs.map(c => el('li', {}, texto(c)))] : [])); revision.hidden = !errs.length;
    bBloque.disabled = !!errs.length; bImagenes.disabled = !!errs.length || !ed.pan.blobs; bImagenes.hidden = !ed.pan.blobs;
    dibujar();
  }
  function pintar() {
    lead.textContent = t('lead'); lLocal.textContent = t('local'); hParedes.textContent = t('paredes'); lSubir.textContent = t('subir'); h360.textContent = t('p360'); l360.textContent = t('subir360');
    inFotos.disabled = in360.disabled = !(st.reg && st.plano);
    const pub = st.plano && st.plano.panorama;
    info360.textContent = pub ? t('publicada') : '';
    aGemelo.hidden = !pub; if (pub) { aGemelo.href = urlGemelo3D(st.plano.id) + (urlGemelo3D(st.plano.id).includes('?') ? '&' : '?') + 'vista=360'; aGemelo.textContent = t('verGemelo'); }
    bPublicada.hidden = !pub; bPublicada.textContent = t('editarPublicada');
    titulo.textContent = st.plano ? `${t('titulo')} · ${st.plano.nombre || st.plano.id}` : t('titulo');
    secFoto.hidden = !st.foto; if (st.foto) { hFoto.textContent = `${t('fotoTitulo')} · ${st.foto.pared === SIN_PARED ? t('sinPared') : nombrePared(st.plano, st.foto.pared)}`; imgFoto.src = url(st.foto.blob); }
    pintarLista(); pintarEditor();
  }
  pintar(); cargar();
  return { setLang: pintar, estado: () => st };
}
