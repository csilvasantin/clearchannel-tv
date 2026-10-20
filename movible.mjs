// Copia de xpaceos/xpacios/starbucks-centros/movible.mjs (19-oct-2026) para las ventanas de admira.biz (Comercial).
// Ventanas flotantes del visor (los dialog del mando del hilo musical y de la cesta), con el principio de siempre
// (Carlos, 16-oct-2026: «el mando interactivo no cumple el principio básico de que tiene que ser movible»): se mueven
// por su cabecera, cambian de tamaño por la esquina de abajo a la derecha (también con el dedo) y se cierran con ✕.
// Doble clic en la cabecera: vuelve a su sitio. Posición y tamaño se recuerdan en este navegador.
const leer = clave => { try { return JSON.parse(localStorage.getItem(clave) || 'null'); } catch { return null; } };
const guardar = (clave, v) => { try { v ? localStorage.setItem(clave, JSON.stringify(v)) : localStorage.removeItem(clave); } catch { /* sin almacenamiento */ } };

// `proporcion` (ancho/alto): ventanas con forma fija (el quiosco 9:16, el iPad 4:3) cambian solo de ancho y su alto
// lo pone la proporción. `arriba`: margen para el asa que va encima del marco.
export function hacerMovible(caja, asa, { clave = null, win = globalThis, proporcion = 0, arriba = 0 } = {}) {
  const doc = caja.ownerDocument;
  asa.classList.add('sc-asa'); asa.title = 'Arrastra para mover · doble clic: a su sitio';
  const esquina = doc.createElement('span'); esquina.className = 'vent-esquina'; esquina.title = 'Arrastra para cambiar el tamaño';
  caja.append(esquina);
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  function poner({ x, y, w, h }) {
    const vw = win.innerWidth, vh = win.innerHeight;
    const maxAncho = proporcion ? Math.min(vw - 8, (vh - arriba - 16) * proporcion) : vw - 8;
    const ancho = w ? limitar(w, proporcion ? 180 : 260, maxAncho) : caja.getBoundingClientRect().width, alto = !proporcion && h ? limitar(h, 160, vh - 8) : null;
    Object.assign(caja.style, { position: 'fixed', margin: '0', left: limitar(x, 0, vw - Math.min(ancho, 120)) + 'px', top: limitar(y, arriba, vh - 40) + 'px', width: ancho + 'px' });
    if (proporcion) Object.assign(caja.style, { height: 'auto', maxHeight: 'none' });
    else if (alto) Object.assign(caja.style, { height: alto + 'px', maxHeight: 'none' });
    caja.classList.add('sc-movida');
  }
  function soltarSitio() {
    for (const k of ['position', 'margin', 'left', 'top', 'width', 'height', 'maxHeight']) caja.style[k] = '';
    caja.classList.remove('sc-movida'); if (clave) guardar(clave, null);
  }
  const recordar = () => { if (!clave) return; const r = caja.getBoundingClientRect(); guardar(clave, { x: r.left, y: r.top, w: r.width, h: caja.style.height ? r.height : null }); };

  let arrastre = null;
  asa.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button,a,input,select')) return;
    const r = caja.getBoundingClientRect();
    arrastre = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    poner({ x: r.left, y: r.top, w: r.width, h: caja.style.height ? r.height : null });
    asa.setPointerCapture(e.pointerId); e.preventDefault();
  });
  asa.addEventListener('pointermove', e => { if (arrastre) poner({ x: e.clientX - arrastre.dx, y: e.clientY - arrastre.dy, w: parseFloat(caja.style.width) || null, h: parseFloat(caja.style.height) || null }); });
  const fin = () => { if (!arrastre) return; arrastre = null; recordar(); };
  asa.addEventListener('pointerup', fin); asa.addEventListener('pointercancel', fin);
  asa.addEventListener('dblclick', e => { if (!e.target.closest('button,a')) soltarSitio(); });

  let tam = null;
  esquina.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const r = caja.getBoundingClientRect();
    tam = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, left: r.left, top: r.top };
    poner({ x: r.left, y: r.top, w: r.width, h: r.height });
    esquina.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();
  });
  esquina.addEventListener('pointermove', e => { if (tam) poner({ x: tam.left, y: tam.top, w: tam.w + e.clientX - tam.x, h: tam.h + e.clientY - tam.y }); });
  const finTam = () => { if (!tam) return; tam = null; recordar(); };
  esquina.addEventListener('pointerup', finTam); esquina.addEventListener('pointercancel', finTam);

  // Al abrir: donde se dejó (si cabe en la pantalla de ahora).
  function restaurar() {
    const v = clave && leer(clave);
    if (v && Number.isFinite(v.x) && Number.isFinite(v.y) && v.x < win.innerWidth - 60 && v.y < win.innerHeight - 40) poner(v);
  }
  return { restaurar, soltarSitio, get movida() { return caja.classList.contains('sc-movida'); } };
}
