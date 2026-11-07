// Tema local «netflix» de admira.biz · encargo «2026-11-07 · admira.biz · PortAventuraNext intro» (Carlos).
//
// Viste la portada de admira.biz con el look de Netflix (negro y rojo) para la intro de
// https://portaventuranext.com/intro: el logo PORTAVENTURA NEXT entra a golpes con un «ta-dum»
// SINTETIZADO (Web Audio: no se usa ninguna grabación ni logotipo ajeno) y después llega la vuelta
// al mundo de admira.biz —la misma bola satélite girando— con una única opción: viajar a PortAventura.
//
// Nunca se carga solo: marca-blanca.js lo descarga al activar la marca local «netflix»
// (/brand netflix o /marca netflix en ⌘ Experto, o ?marca=netflix) y llama a MarcaNetflix.activar().
// MarcaNetflix.desactivar() (/brand off) lo deshace en el sitio: quita sus nodos, vuelve a enseñar las
// capas del mapa y devuelve el encuadre y el giro de serie. Ver docs/marca-netflix.md.
(function (root) {
  'use strict';

  const PA = Object.freeze([1.1556, 41.0866]);   // PortAventura World · Salou (Tarragona)
  const LAT0 = 16;                                 // latitud de la bola de serie (HOME_VIEW de app.js)
  const DESFASE = 62;                              // PortAventura entra en escena por la derecha al girar
  const VUELO_MS = 8200, VUELTA_MS = 6000;

  // ─── Funciones puras (tests/marca-netflix.test.cjs) ───
  /** Altura relativa de la letra i de n: más altas en los extremos, como un rótulo sobre pantalla curva. */
  function arcScale(i, n, k = 0.3) {
    if (!(n > 1)) return 1;
    const mid = (n - 1) / 2, d = (i - mid) / mid;
    return 1 + k * d * d;
  }
  /** Coseno de la distancia angular entre dos [lng, lat]. */
  function cosAngulo(a, b) {
    const r = Math.PI / 180;
    return Math.sin(a[1] * r) * Math.sin(b[1] * r) + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.cos((a[0] - b[0]) * r);
  }
  /** El pin se esconde cuando PortAventura queda detrás de la bola (solo con la bola entera a la vista). */
  const oculto = (centro, zoom, punto = PA) => zoom < 5 && cosAngulo(centro, punto) < 0.18;
  function distanciaKm(a, b) {
    const r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  /** Punto a `grados` de distancia angular de p siguiendo el rumbo dado (0 = norte, 90 = este). */
  function destino(p, rumbo, grados) {
    const r = Math.PI / 180, f1 = p[1] * r, l1 = p[0] * r, b = rumbo * r, d = grados * r;
    const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2));
    return [((l2 / r + 540) % 360) - 180, f2 / r];
  }
  const easeInOutCubic = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  /** Encuadre de la bola: en escritorio a la derecha (el cartel va a la izquierda); en móvil, arriba. */
  function relleno(w, h) {
    return w < 760 ? {top: 60, bottom: Math.round(h * 0.44), left: 0, right: 0}
                   : {top: 0, bottom: 0, left: Math.round(w * 0.36), right: 0};
  }
  const api = {PA, LAT0, DESFASE, arcScale, cosAngulo, oculto, distanciaKm, destino, easeInOutCubic, relleno};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined' || root.MarcaNetflix) return;

  // ─── Navegador ───
  const doc = document, html = doc.documentElement;
  const reduce = () => { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const lang = () => (html.lang === 'en' ? 'en' : 'es');
  const T = (es, en) => (lang() === 'en' ? en : es);
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 4v16a1 1 0 0 0 1.52.85l13-8a1 1 0 0 0 0-1.7l-13-8A1 1 0 0 0 6 4Z"/></svg>';
  const AGAIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z"/></svg>';

  let estado = 'off';                 // off · puerta · intro · bola · vuelo · llegada · vuelta
  let nodos = [], timers = [], escuchas = [];
  let mapa = null, pin = null, guardado = null, capas = {}, orbita = false, raf = 0, haloRaf = 0;
  let langObs = null, km0 = 0, kmQuedan = 0, vueloDesde = 0;
  let sonido = null, mudo = false;

  // El mapa, el giro y la vista inicial son globales de app.js (scripts clásicos): se leen al vuelo.
  function elMapa() {
    try { return typeof map !== 'undefined' && map && typeof map.flyTo === 'function' ? map : null; } catch (_) { return null; } // eslint-disable-line no-undef
  }
  function girar(v) { try { rotating = v; } catch (_) {} }                          // eslint-disable-line no-undef
  function vistaInicial() {
    try { if (HOME_VIEW && typeof HOME_VIEW.zoom === 'number') return HOME_VIEW; } catch (_) {} // eslint-disable-line no-undef
    return {center: [-28, LAT0], zoom: 2.15, pitch: 0, bearing: 0};
  }
  const EST = {puerta: 'gate', intro: 'intro', bola: 'globe', vuelo: 'flying', llegada: 'arrived', vuelta: 'returning'};
  function setEstado(s) { estado = s; if (s === 'off') html.removeAttribute('data-nfx-estado'); else html.setAttribute('data-nfx-estado', EST[s] || s); }
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const $ = id => doc.getElementById(id);

  function el(tag, attrs, inner) {
    const n = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    if (inner != null) n.innerHTML = inner;
    return n;
  }
  const txt = (es, en, cls) => `<span${cls ? ` class="${cls}"` : ''} data-es="${es}" data-en="${en}">${es}</span>`;
  function traducir() {
    for (const n of nodos) for (const t of [n, ...n.querySelectorAll('[data-es]')]) if (t.dataset && t.dataset.es != null) t.textContent = t.dataset[lang()];
    const m = $('nfx-mute');
    if (m) m.setAttribute('aria-label', mudo ? T('Activar sonido', 'Unmute') : T('Silenciar', 'Mute'));
    pintarKm();
  }
  function arco(texto) {
    return [...texto].map((ch, i, all) => `<span style="transform:scaleY(${arcScale(i, all.length).toFixed(3)})">${ch}</span>`).join('');
  }

  // ─── Sonido: «ta-dum» sintetizado ───
  function abrirAudio() {
    if (sonido) return sonido;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain(); master.gain.value = mudo ? 0 : 0.95;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    const verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
    verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.32; verb.connect(wet); wet.connect(master);
    sonido = {ctx, master, verb};
    return sonido;
  }
  function ruido(sec) {
    const {ctx} = sonido, len = Math.max(1, Math.floor(ctx.sampleRate * sec)), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  const salida = node => { node.connect(sonido.master); node.connect(sonido.verb); };
  // Golpe grave con caída de tono + chasquido de ataque.
  function golpe(t, f0, f1, dur, gain) {
    const {ctx} = sonido, o = ctx.createOscillator(), a = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.55);
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(gain, t + 0.006); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a); salida(a); o.start(t); o.stop(t + dur + 0.05);
    const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = ruido(0.09); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.7;
    g.gain.setValueAtTime(gain * 0.45, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    n.connect(bp); bp.connect(g); salida(g); n.start(t);
  }
  // Acorde que se abre detrás del segundo golpe.
  function acorde(t, nivel) {
    const {ctx} = sonido, lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(160, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 1.3); lp.frequency.exponentialRampToValueAtTime(380, t + 3.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(nivel, t + 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
    lp.connect(g); salida(g);
    [73.42, 110, 146.83, 185, 220, 293.66].forEach((f, i) => [-7, 7].forEach(det => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + i;
      o.connect(lp); o.start(t); o.stop(t + 3.9);
    }));
  }
  function taDum() {
    if (!abrirAudio()) return 0;
    try { sonido.ctx.resume(); } catch (_) {}
    const t = sonido.ctx.currentTime + 0.06;
    golpe(t, 125, 60, 0.42, 0.7);           // ta
    golpe(t + 0.46, 98, 36, 2.0, 1.0);      // DUM
    golpe(t + 0.46, 196, 82, 0.6, 0.32);
    acorde(t + 0.5, 0.15);
    return 60;
  }
  function viento(sec) {
    if (!sonido) return;
    const {ctx} = sonido, t = ctx.currentTime, n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = ruido(sec); bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(240, t); bp.frequency.exponentialRampToValueAtTime(2400, t + sec * 0.45); bp.frequency.exponentialRampToValueAtTime(180, t + sec);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + sec * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
    n.connect(bp); bp.connect(g); salida(g); n.start(t);
  }
  function aterrizaje() {
    if (!sonido) return;
    const t = sonido.ctx.currentTime + 0.02;
    golpe(t, 92, 38, 1.6, 0.8); acorde(t + 0.04, 0.09);
  }
  function silenciar(m) {
    mudo = m;
    const b = $('nfx-mute');
    if (b) { b.textContent = m ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(m)); }
    if (sonido) sonido.master.gain.setTargetAtTime(m ? 0 : 0.95, sonido.ctx.currentTime, 0.05);
    traducir();
  }
  function cerrarAudio() {
    if (!sonido) return;
    try { sonido.master.gain.setTargetAtTime(0, sonido.ctx.currentTime, 0.05); } catch (_) {}
    const ctx = sonido.ctx; sonido = null;
    setTimeout(() => { try { ctx.close(); } catch (_) {} }, 300);
  }

  // ─── Montaje ───
  function cielo() {
    const c = $('nfx-sky') && $('nfx-sky').querySelector('canvas');
    if (!c) return;
    const dpr = Math.min(2, root.devicePixelRatio || 1), w = root.innerWidth, h = root.innerHeight;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    for (let i = 0; i < Math.round(w * h / 2600); i++) {
      const a = 0.25 + Math.random() * 0.6;
      g.fillStyle = Math.random() < 0.12 ? `rgba(255,90,100,${a})` : `rgba(255,255,255,${a})`;
      g.beginPath(); g.arc(Math.random() * w, Math.random() * h, Math.random() < 0.08 ? 1.3 : 0.7, 0, Math.PI * 2); g.fill();
    }
  }
  function montar() {
    html.setAttribute('data-netflix', '');
    const fuente = el('link', {rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap', 'data-nfx': ''});
    doc.head.append(fuente);
    nodos.push(fuente);

    const sky = el('div', {id: 'nfx-sky', 'aria-hidden': 'true'}, '<canvas></canvas>');
    const halo = el('div', {id: 'nfx-halo', 'aria-hidden': 'true'});
    const shade = el('div', {id: 'nfx-shade', 'aria-hidden': 'true'});
    const mapEl = $('map');
    if (mapEl && mapEl.parentNode) {
      mapEl.parentNode.insertBefore(sky, mapEl);
      mapEl.parentNode.insertBefore(halo, mapEl);
      mapEl.append(shade);   // dentro del mapa: bajo sus controles (atribución de Esri visible)
    } else doc.body.prepend(sky, halo, shade);
    nodos.push(sky, halo, shade);

    // Cabecera: el logotipo de la marca en lugar del de serie y un botón de sonido junto al idioma.
    const logo = el('button', {id: 'nfx-logo', type: 'button', class: 'nfx-display', 'aria-label': 'PortAventura NeXT'},
      `<span class="nfx-arc">${arco('PORTAVENTURA')}</span><b>NEXT</b>`);
    logo.addEventListener('click', () => (estado === 'llegada' ? otraVuelta() : null));
    const slot = doc.querySelector('header .logo');
    if (slot) { slot.prepend(logo); nodos.push(logo); }
    const mute = el('button', {id: 'nfx-mute', type: 'button', class: 'mode-toggle', 'aria-pressed': 'false'}, '🔊');
    mute.addEventListener('click', () => silenciar(!mudo));
    const switches = doc.querySelector('header .mode-switches');
    if (switches) { switches.insertBefore(mute, $('header-lang-toggle')); nodos.push(mute); }

    const bill = el('section', {id: 'nfx-bill', class: 'nfx-panel', 'aria-live': 'polite'},
      `<p class="nfx-kicker"><i></i>${txt('UNA EXPERIENCIA ADMIRANEXT', 'AN ADMIRANEXT EXPERIENCE')}</p>
       <h1 class="nfx-display">${txt('La vuelta al mundo', 'Around the world')}</h1>
       <p class="nfx-meta">${txt('100 % para ti', '100% match', 'nfx-match')}<span>2026</span><span class="nfx-badge">4K</span>${txt('1 destino', '1 destination')}</p>
       <p class="nfx-desc">${txt('Damos la vuelta al planeta y solo hay un sitio al que merece la pena ir.', 'We go around the planet, and there is only one place worth going to.')}</p>
       <div class="nfx-btns"><button id="nfx-go" class="nfx-btn nfx-primary" type="button">${PLAY}${txt('Viajar a PortAventura', 'Travel to PortAventura')}</button></div>`);
    const hud = el('div', {id: 'nfx-hud', 'aria-live': 'polite'},
      `<small>${txt('RUMBO A', 'HEADING TO')}</small><strong class="nfx-display">PortAventura</strong>
       <span class="nfx-km" id="nfx-km">—</span><div class="nfx-track"><i id="nfx-track"></i></div>`);
    const arrive = el('section', {id: 'nfx-arrive', class: 'nfx-panel', 'aria-live': 'polite'},
      `<p class="nfx-kicker"><i></i>${txt('DESTINO', 'DESTINATION')}</p>
       <h1 class="nfx-display">PortAventura World</h1>
       <p class="nfx-meta">${txt('Has llegado', 'You have arrived', 'nfx-match')}<span>Salou · Tarragona</span><span class="nfx-badge">41,087° N · 1,156° E</span></p>
       <p class="nfx-desc">${txt('Tres parques y un resort a orillas del Mediterráneo. Aquí empieza PortAventura NeXT.', 'Three parks and a resort on the Mediterranean shore. This is where PortAventura NeXT begins.')}</p>
       <div class="nfx-btns">
         <a id="nfx-enter" class="nfx-btn nfx-primary" href="https://www.portaventuranext.com/">${PLAY}${txt('Entrar', 'Enter')}</a>
         <button id="nfx-again" class="nfx-btn nfx-ghost" type="button">${AGAIN}${txt('Otra vuelta', 'Go around again')}</button>
       </div>`);
    doc.body.append(bill, hud, arrive);
    nodos.push(bill, hud, arrive);
    $('nfx-go').addEventListener('click', viajar);
    $('nfx-again').addEventListener('click', otraVuelta);

    // El pin de PortAventura, único destino de la bola.
    const pinEl = el('div', {class: 'nfx-pin', role: 'button', tabindex: '0', 'aria-label': 'PortAventura'}, '<i></i><span class="nfx-display">PortAventura</span>');
    pinEl.addEventListener('click', e => { e.stopPropagation(); viajar(); });
    pinEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); viajar(); } });
    mapa = elMapa();
    if (mapa && root.maplibregl) pin = new root.maplibregl.Marker({element: pinEl, anchor: 'center'}).setLngLat(PA).addTo(mapa);

    const titulo = doc.title, meta = doc.querySelector('meta[name="theme-color"]');
    guardado = {titulo, tema: meta ? meta.getAttribute('content') : null, padding: mapa && mapa.getPadding ? Object.assign({}, mapa.getPadding()) : null};
    doc.title = 'PortAventura NeXT · ' + titulo;
    if (meta) meta.setAttribute('content', '#000000');

    cielo();
    escucha(root, 'resize', alRedimensionar);
    escucha(doc, 'keydown', teclas);
    langObs = new MutationObserver(traducir);
    langObs.observe(html, {attributes: true, attributeFilter: ['lang']});
    traducir();
  }
  function escucha(target, ev, fn) {
    if (target.on && target.off && target !== root && target !== doc) { target.on(ev, fn); escuchas.push(() => { try { target.off(ev, fn); } catch (_) {} }); }
    else { target.addEventListener(ev, fn); escuchas.push(() => target.removeEventListener(ev, fn)); }
  }

  // ─── El mapa de serie bajo el tema ───
  // Se esconden todas las capas que no son la imagen satélite (clusters, puntos, rutas, anillos…) y se
  // anota su visibilidad de serie para devolverla tal cual. Si app.js añade o recrea capas, se vuelven a esconder.
  function ocultarCapas() {
    if (!mapa || estado === 'off') return;
    let st = null;
    try { st = mapa.getStyle(); } catch (_) {}
    for (const l of (st && st.layers) || []) {
      if (l.type === 'raster' || l.type === 'background' || l.type === 'hillshade') continue;
      const vis = mapa.getLayoutProperty(l.id, 'visibility') || 'visible';
      if (!(l.id in capas)) capas[l.id] = vis;
      if (vis !== 'none') mapa.setLayoutProperty(l.id, 'visibility', 'none');
    }
  }
  function devolverCapas() {
    if (!mapa) { capas = {}; return; }
    for (const [id, vis] of Object.entries(capas)) { try { if (mapa.getLayer(id)) mapa.setLayoutProperty(id, 'visibility', vis); } catch (_) {} }
    capas = {};
  }
  function prepararMapa() {
    if (!mapa) return;
    ocultarCapas();
    escucha(mapa, 'styledata', ocultarCapas);
    escucha(mapa, 'move', alMover);
    for (const ev of ['dragstart', 'wheel', 'touchstart']) escucha(mapa, ev, e => { if (e && e.originalEvent) orbita = false; });
    girar(false);
    encuadrarBola();
    girar(!reduce());
    alMover();
  }
  function encuadrarBola() {
    const v = vistaInicial();
    mapa.jumpTo({center: [PA[0] - DESFASE, LAT0], zoom: v.zoom, pitch: 0, bearing: 0, padding: relleno(root.innerWidth, root.innerHeight)});
  }
  // Halo rojo: centro de la bola en pantalla y radio del disco visible. Con la cámara en perspectiva el borde
  // no está a 90° del centro: se proyectan puntos cada vez más lejos y el borde es la mayor distancia en pantalla.
  // Solo cambia con el zoom, el tamaño de la ventana o el encuadre: se recuerda mientras no cambien.
  let haloClave = '', haloRadio = 0;
  function radioBola(c, p0) {
    let max = 0;
    for (const rumbo of [0, 90, 180, 270]) {
      for (let d = 40; d <= 90; d += 1) {
        const p = mapa.project(destino([c.lng, c.lat], rumbo, d));
        if (p && Number.isFinite(p.x)) max = Math.max(max, Math.hypot(p.x - p0.x, p.y - p0.y));
      }
    }
    return max;
  }
  function situarHalo() {
    haloRaf = 0;
    if (!mapa || !$('nfx-halo')) return;
    const c = mapa.getCenter(), p0 = mapa.project(c), pad = mapa.getPadding();
    const clave = [mapa.getZoom().toFixed(3), root.innerWidth, root.innerHeight, pad.left, pad.bottom, mapa.getPitch().toFixed(1)].join('|');
    if (clave !== haloClave) { haloClave = clave; haloRadio = radioBola(c, p0); }
    const s = html.style;
    s.setProperty('--nfx-gx', p0.x + 'px'); s.setProperty('--nfx-gy', p0.y + 'px'); s.setProperty('--nfx-gd', Math.round(haloRadio * 2) + 'px');
  }
  function alMover() {
    if (!mapa || !pin) return;
    const c = mapa.getCenter(), esconder = oculto([c.lng, c.lat], mapa.getZoom());
    const e = pin.getElement();
    e.style.opacity = esconder ? '0' : '1';
    e.style.pointerEvents = esconder ? 'none' : 'auto';
    if (!haloRaf && mapa.getZoom() < 5) haloRaf = requestAnimationFrame(situarHalo);
  }
  function alRedimensionar() {
    cielo();
    if (mapa && estado !== 'vuelo' && estado !== 'vuelta') mapa.jumpTo({padding: relleno(root.innerWidth, root.innerHeight)});
    alMover();
  }
  function orbitar(ts0) {
    let last = ts0;
    const paso = ts => {
      if (!orbita || estado !== 'llegada' || !mapa) { raf = 0; return; }
      if (!mapa.isMoving()) mapa.setBearing(mapa.getBearing() + Math.min(64, ts - last) * 0.0035);
      last = ts;
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
  }

  // ─── Secuencia: puerta → golpe del logo → bola ───
  function puerta() {
    setEstado('puerta');
    const g = el('div', {id: 'nfx-gate'},
      `<button id="nfx-play" type="button"><span class="nfx-ring">${PLAY}</span>${txt('Pulsa para empezar', 'Tap to start', 'nfx-display')}<small>${txt('🔊 Con sonido', '🔊 Sound on')}</small></button>`);
    doc.body.append(g);
    nodos.push(g);
    $('nfx-play').addEventListener('click', empezar);
    traducir();
    try { $('nfx-play').focus({preventScroll: true}); } catch (_) {}
  }
  function empezar() {
    if (estado !== 'puerta' && estado !== 'off' && estado !== 'montado') return;
    const g = $('nfx-gate');
    if (g) { g.classList.add('out'); setTimeout(() => g.remove(), 300); }
    setEstado('intro');
    const intro = el('div', {id: 'nfx-intro', 'aria-hidden': 'true'},
      `<div id="nfx-flash"></div><div id="nfx-ribbons"></div>
       <div id="nfx-mark"><div class="nfx-arc nfx-display">${arco('PORTAVENTURA')}</div><div class="nfx-next nfx-display">NEXT</div></div>`);
    const REDS = ['#e50914', '#b20710', '#ff3341', '#831010', '#ff6a6a', '#5c0007', '#ff1f2c'];
    const cintas = intro.querySelector('#nfx-ribbons');
    for (let i = 0; i < 40; i++) {
      const x = (i + 0.5) / 40 * 100, w = 1 + Math.random() * 3.2, c = REDS[i % REDS.length];
      cintas.append(el('i', {style: `left:${x}%;width:${w}%;background:linear-gradient(180deg,transparent,${c} 30%,${c} 70%,transparent);` +
        `--dx:${((x - 50) * 0.9).toFixed(1)}vw;animation-delay:${(Math.random() * 0.28).toFixed(2)}s`}));
    }
    const skip = el('button', {id: 'nfx-skip', type: 'button'}, txt('Saltar intro', 'Skip intro'));
    skip.addEventListener('click', saltar);
    doc.body.append(intro, skip);
    nodos.push(intro, skip);
    traducir();
    const o = taDum(), r = reduce();
    at(o, () => intro.classList.add('hit1'));             // ta
    at(o + 460, () => intro.classList.add('hit2'));       // DUM
    at(900, () => skip.classList.add('on'));
    at(r ? 1700 : 2350, () => intro.classList.add('zoom'));
    at(r ? 2200 : 3150, aLaBola);
  }
  function aLaBola() {
    timers.splice(0).forEach(clearTimeout);
    const intro = $('nfx-intro'), skip = $('nfx-skip');
    if (skip) skip.remove();
    if (intro) { intro.classList.add('out'); setTimeout(() => intro.remove(), 1000); }
    setEstado('bola');
    // La entrada en vídeo de serie (intro.js) recoloca la bola al cargarse: mientras la intro aún tapa la
    // pantalla, se vuelve a encuadrar para que PortAventura entre en escena por la derecha.
    if (mapa) { girar(false); encuadrarBola(); }
    $('nfx-bill').classList.add('on');
    girar(!reduce());
    setTimeout(() => { if (estado === 'bola') try { $('nfx-go').focus({preventScroll: true}); } catch (_) {} }, 900);
  }
  function saltar() {
    if (estado !== 'intro') return;
    if (sonido) {
      sonido.master.gain.setTargetAtTime(0, sonido.ctx.currentTime, 0.08);
      setTimeout(() => { if (sonido && !mudo) sonido.master.gain.setTargetAtTime(0.95, sonido.ctx.currentTime, 0.05); }, 600);
    }
    aLaBola();
  }
  function teclas(e) {
    if (estado === 'puerta' && (e.key === 'Enter' || e.key === ' ') && !/^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) { e.preventDefault(); empezar(); }
    else if (estado === 'intro' && e.key === 'Escape') saltar();
  }

  // ─── El viaje: la única opción de la vuelta al mundo ───
  function pintarKm() {
    if (estado !== 'vuelo' || !$('nfx-km')) return;
    $('nfx-km').textContent = Math.round(kmQuedan).toLocaleString(lang() === 'es' ? 'es-ES' : 'en-GB') + ' km';
    $('nfx-track').style.width = (km0 ? 100 * (1 - kmQuedan / km0) : 100).toFixed(1) + '%';
  }
  function viajar() {
    if (estado !== 'bola') return;
    if (!mapa) { root.location.href = $('nfx-enter').href; return; }
    const dur = reduce() ? 2500 : VUELO_MS;
    setEstado('vuelo');
    girar(false);
    $('nfx-bill').classList.remove('on');
    const c = mapa.getCenter();
    km0 = kmQuedan = Math.max(1, distanciaKm([c.lng, c.lat], PA));
    $('nfx-hud').classList.add('on');
    pintarKm();
    viento(dur / 1000);
    const t0 = performance.now();
    (function cuenta(now) {
      if (estado !== 'vuelo') return;
      const k = Math.min(1, (now - t0) / dur);
      kmQuedan = km0 * (1 - easeInOutCubic(k)); pintarKm();
      if (k < 1) requestAnimationFrame(cuenta);
    })(t0);
    vueloDesde = t0;
    mapa.flyTo({center: PA, zoom: root.innerWidth < 760 ? 15.1 : 15.7, pitch: 58, bearing: -28,
      padding: relleno(root.innerWidth, root.innerHeight), duration: dur, curve: 1.5, essential: true});
    const fin = () => {
      if (estado !== 'vuelo') return;
      if (performance.now() - vueloDesde < 120) { mapa.once('moveend', fin); return; }   // un moveend viejo
      llegar();
    };
    mapa.once('moveend', fin);
  }
  function llegar() {
    kmQuedan = 0; pintarKm();
    setEstado('llegada');
    $('nfx-hud').classList.remove('on');
    $('nfx-arrive').classList.add('on');
    aterrizaje();
    orbita = !reduce();
    if (orbita) orbitar(performance.now());
    setTimeout(() => { if (estado === 'llegada') try { $('nfx-enter').focus({preventScroll: true}); } catch (_) {} }, 700);
  }
  function otraVuelta() {
    if (estado !== 'llegada' || !mapa) return;
    setEstado('vuelta');
    orbita = false;
    $('nfx-arrive').classList.remove('on');
    viento(reduce() ? 2 : VUELTA_MS / 1000);
    girar(false);
    mapa.flyTo({center: [PA[0] - DESFASE, LAT0], zoom: vistaInicial().zoom, pitch: 0, bearing: 0,
      padding: relleno(root.innerWidth, root.innerHeight), duration: reduce() ? 2000 : VUELTA_MS, curve: 1.4, essential: true});
    mapa.once('moveend', () => {
      if (estado !== 'vuelta') return;
      setEstado('bola');
      $('nfx-bill').classList.add('on');
      girar(!reduce());
    });
  }

  // ─── Activar / desactivar ───
  /**
   * Monta el tema. Con un gesto reciente del usuario (p. ej. el Enter de /brand netflix) la intro suena
   * al instante; si no (?marca=netflix al abrir), primero sale la puerta «Pulsa para empezar».
   * Sin el mapa de la portada (backoffice, ayuda…) no hace nada: el tema es solo de la intro.
   */
  // Con ?marca=netflix al abrir, este script puede llegar antes de que app.js cree el mapa: se le espera.
  function esperarMapa(ms = 20000) {
    return new Promise(resolve => {
      const t0 = Date.now();
      (function mira() { const m = elMapa(); if (m || Date.now() - t0 > ms) resolve(m); else setTimeout(mira, 250); })();
    });
  }
  function activar(opts = {}) {
    if (estado !== 'off') return Promise.resolve({ok: true, estado: EST[estado] || estado});
    if (!$('map')) return Promise.resolve({ok: true, inerte: true});
    setEstado('montado');
    return esperarMapa().then(m => {
      if (estado !== 'montado') return {ok: true, estado: EST[estado] || estado};   // se desactivó mientras tanto
      if (!m) { setEstado('off'); return {ok: true, inerte: true}; }
      montar();
      prepararMapa();
      const ua = root.navigator && root.navigator.userActivation;
      const gesto = opts.gesto != null ? !!opts.gesto : !!(ua && ua.hasBeenActive);
      if (opts.intro === false) aLaBola();
      else if (gesto) empezar();
      else puerta();
      return {ok: true, estado: EST[estado]};
    });
  }
  /** Lo deshace todo en el sitio y devuelve la portada de serie: capas, encuadre, giro, título y color. */
  function desactivar() {
    if (estado === 'off') return {ok: true, changed: false};
    const era = estado;
    setEstado('off');
    timers.splice(0).forEach(clearTimeout);
    orbita = false;
    if (raf) cancelAnimationFrame(raf);
    if (haloRaf) cancelAnimationFrame(haloRaf);
    raf = haloRaf = 0;
    escuchas.splice(0).forEach(f => f());
    if (langObs) { langObs.disconnect(); langObs = null; }
    if (pin) { pin.remove(); pin = null; }
    nodos.splice(0).forEach(n => n.remove());
    cerrarAudio();
    html.removeAttribute('data-netflix');
    for (const p of ['--nfx-gx', '--nfx-gy', '--nfx-gd']) html.style.removeProperty(p);
    if (guardado) {
      doc.title = guardado.titulo;
      const meta = doc.querySelector('meta[name="theme-color"]');
      if (meta && guardado.tema != null) meta.setAttribute('content', guardado.tema);
    }
    devolverCapas();
    if (mapa) {
      const v = vistaInicial(), pad = (guardado && guardado.padding) || {top: 0, bottom: 0, left: 0, right: 0};
      girar(false);
      try { mapa.stop(); } catch (_) {}
      const lejos = mapa.getZoom() > 4 || mapa.getPitch() > 1;
      if (lejos && !reduce()) {
        mapa.flyTo({center: v.center, zoom: v.zoom, pitch: 0, bearing: 0, padding: pad, duration: 2200, essential: true});
        mapa.once('moveend', () => girar(true));
      } else {
        mapa.jumpTo({center: lejos ? v.center : mapa.getCenter(), zoom: v.zoom, pitch: 0, bearing: 0, padding: pad});
        girar(true);
      }
    }
    mapa = null; guardado = null;
    return {ok: true, changed: true, estado: EST[era] || era};
  }

  root.MarcaNetflix = Object.freeze(Object.assign({}, api, {
    activar, desactivar, viajar, otraVuelta, saltar,
    estado: () => (estado === 'off' ? 'off' : EST[estado] || estado),
  }));
}(typeof window !== 'undefined' ? window : globalThis));
