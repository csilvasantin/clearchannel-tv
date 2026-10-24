/* previos-zoom.js — Previos de lo que emiten las pantallas (FLT-102666 · encargo #7145, 24-oct-2026).
 * Carlos: «cuando hagamos zoom poder ver previos de lo que emiten las pantallas en el lugar de anunciarme aquí y pon
 * encima anunciarme aquí». Eligió «En los dos sitios»:
 *  · MAPA: a zoom de calle, los Xpacios más cercanos al centro (6 en escritorio, 3 en el móvil, sin solaparse) salen
 *    como tarjeta flotante con su pantalla y, ENCIMA, «💼 Anunciarme aquí». Al alejar, vuelven los puntos de siempre.
 *  · FICHA: bajo «Anunciarme aquí», el previo en grande de lo que emiten sus pantallas.
 * Cada Xpacio cae en el primer nivel que tenga, y la etiqueta dice cuál es (sin maquillar):
 *  1 «En directo»: su pantalla publica en /signage/now una pieza de menos de 170 s (lo que ya sondea app.js).
 *  2 «Previo DooH»: la foto de fachada (previo del catálogo) con el póster del circuito encajado en la pantalla.
 *  3 «Programación del circuito»: el póster de la primera pieza del Stock con el hashtag de su circuito
 *    (GET /api/previo/circuito, que lo cachea en el borde: el Stock tarda ~22 s).
 *  4 Nada: tarjeta compacta, sólo «Anunciarme aquí» y un «Sin previo todavía» discreto.
 * «Previo nunca negro»: si una imagen falla, ese Xpacio baja al nivel siguiente; la pantalla del Previo DooH lleva un
 * fondo de marca mientras llega el póster. Sin iframes ni vídeo en autoplay en el mapa: el vídeo sólo suena (mudo) en la
 * tarjeta que se mira (ratón o foco). Con el zoom alejado no se hace ninguna petición.
 * Mismo patrón que previo.js: window.AdmiraPreviosZoom en el navegador y require() en node:test. */
(function (root) {
  'use strict';
  const P = root.AdmiraPrevio || (typeof require === 'function' ? require('./previo.js') : null);
  // Elegir entre Xpacios del mismo punto (FLT-102672): quién comparte sitio con la tarjeta (mismo-punto.js).
  const MP = () => root.AdmiraMismoPunto || (typeof require === 'function' ? require('./mismo-punto.js') : null);
  const PIE_ALTO = 24;                           // la fila «nombre · +N» de una tarjeta de punto compartido

  // Zoom de calle (MapLibre, teselas de 512 px): a 14 caben unos 5 km de ancho en 1440 px y ya se leen las calles; a
  // 15, unos 2,5 km. Con 14 se ven a la vez varios Alcampo de Zaragoza o los 9 Altadis de l'Eixample, y la tarjeta sigue
  // apuntando a su punto. Por debajo de 14 (barrio, ciudad, país) vuelven los puntos sin tarjetas.
  const ZOOM_MIN = 14;
  const MAX_ESCRITORIO = 6, MAX_MOVIL = 3, MOVIL_PX = 720;
  const EN_DIRECTO_MS = 170000;                  // = EMIT_FRESH_MS de app.js
  const SEPARACION = 10;                         // px libres entre tarjetas
  const TARJETA = { w: 172, h: 146, base: 14 };  // caja que ocupa una tarjeta (sobre su punto), escritorio
  const TARJETA_MOVIL = { w: 136, h: 120, base: 14 };
  const MEDIA = { w: 164, h: 100 }, MEDIA_MOVIL = { w: 128, h: 78 };
  const REFRESCO_MS = 180, OCUPADO_MS = 700, CIRCUITO_TTL_MS = 15 * 60 * 1000;
  // Fuente sin puntos todavía (FLT-102666, fallo de producción del 24-oct): se reintenta cuando la fuente avisa de que ha
  // cargado y, por si el aviso ya pasó, hasta ESPERA_MAX veces cada ESPERA_MS. Ver esperarFuente() en crear().
  const ESPERA_MS = 700, ESPERA_MAX = 6;
  const ENDPOINT = '/api/previo/circuito';
  const STOCK_POSTER = 'https://api.admira.store/stock/poster/';
  const NIVELES = ['directo', 'dooh', 'circuito', 'ninguno'];
  const TEXTOS = {
    es: { pz_cta: '💼 Anunciarme aquí', pz_cta_aria: 'Anunciarme aquí: {name}', pz_open_aria: 'Abrir la ficha de {name} · {nivel}',
      pz_directo: 'En directo', pz_dooh: 'Previo DooH', pz_circuito: 'Programación del circuito', pz_ninguno: 'Sin previo todavía',
      pz_cargando: 'Cargando la programación…', pz_ver: '▶ Ver emitiendo', pz_pieza: '▶ Ver la pieza', pz_parar: '⏸ Parar',
      mp_mas: '+{n}', mp_mas_aria: 'Hay {n} Xpacios más en este punto: elegir' },
    en: { pz_cta: '💼 Advertise here', pz_cta_aria: 'Advertise here: {name}', pz_open_aria: 'Open {name} · {nivel}',
      pz_directo: 'Live', pz_dooh: 'DooH preview', pz_circuito: 'Circuit programme', pz_ninguno: 'No preview yet',
      pz_cargando: 'Loading the programme…', pz_ver: '▶ Watch it playing', pz_pieza: '▶ Play the spot', pz_parar: '⏸ Stop',
      mp_mas: '+{n}', mp_mas_aria: '{n} more venues at this spot: choose' },
  };

  const https = u => (typeof u === 'string' && /^https:\/\/[^\s"'<>`]+$/.test(u)) ? u : '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] != null ? String(vars[k]) : '');
  function textoPor(t, lang) {
    const base = TEXTOS[lang === 'en' ? 'en' : 'es'];
    return (k, vars) => { let v = typeof t === 'function' ? t(k) : null; if (v == null || v === k) v = base[k] != null ? base[k] : k; return fmt(v, vars); };
  }

  // ── Hashtag del Stock de un Xpacio ───────────────────────────────────────────────────────────────────
  // El canal del previo emite `tag=<circuito>` (previo.js playerUrl); aquí, el hashtag con el que el Stock guarda las
  // piezas de cada circuito. Con contenido hoy: alcampo, altadis (también los Xtancos de Barcelona), jti y starbucks.
  // El resto se pregunta igual (el borde lo cachea) por si mañana se sube contenido con ese hashtag.
  const TAG_CIRCUITO = { altadis_espana: 'altadis', altadis_bcn: 'altadis', jti_xtanco: 'jti', alsea_starbucks: 'starbucks', alsea_mexico: 'starbucks' };
  const TAG_PREFIJO = { alcampo: 'alcampo', altadis: 'altadis', jti: 'jti', alsea: 'starbucks', correos: 'correos', mango: 'mango', bbva: 'bbva',
    decathlon: 'decathlon', desigual: 'desigual', caixabank: 'caixabank', banorte: 'banorte', elcorteingles: 'elcorteingles', multiopticas: 'multiopticas',
    liverpool: 'liverpool', palacio: 'palacio', kiosko: 'kiosko', metro: 'metro', cafebreria: 'cafebreria', admiraxperience: 'admiraxperience' };
  const TAG_MARCA = { alcampo: 'alcampo', starbucks: 'starbucks', altadis: 'altadis', xtanco: 'jti' };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  function etiquetaStock(loc) {
    if (!loc) return '';
    const circuito = String(loc.circuit || '').toLowerCase();
    if (TAG_CIRCUITO[circuito]) return TAG_CIRCUITO[circuito];
    const prefijo = String(loc.id || '').toLowerCase().split('-')[0];
    if (TAG_PREFIJO[prefijo]) return TAG_PREFIJO[prefijo];
    if (TAG_PREFIJO[circuito]) return TAG_PREFIJO[circuito];
    const marca = norm(loc.external && loc.external.brand);
    return TAG_MARCA[marca] || '';
  }
  // Orientación de sus pantallas (la primera que la diga): para elegir la pieza vertical u horizontal del circuito.
  function orientacionDe(loc) {
    const lista = [loc].concat(Array.isArray(loc && loc.surfaces) ? loc.surfaces : []);
    for (const s of lista) {
      const o = String((s && (s.orientation || s.orient || s.orientacion)) || '').toLowerCase();
      if (o === 'landscape' || o === 'horizontal') return 'horizontal';
      if (o === 'portrait' || o === 'vertical') return 'vertical';
    }
    return '';
  }

  // ── Nivel 1: la pieza que su pantalla publica en /signage/now ────────────────────────────────────────
  // estado = la respuesta de signage/now ({item, standby}). item = {id, url, type, title, ts, startedAt}: no trae póster;
  // una imagen se enseña tal cual y un vídeo del Stock por su póster (api.admira.store/stock/poster/<id>).
  function itemEnDirecto(estado, ahora, frescoMs = EN_DIRECTO_MS) {
    const it = estado && estado.item;
    if (!it || estado.standby) return null;
    const ts = Number(it.ts);
    if (!(ts > 0) || ahora - ts >= frescoMs || ts - ahora > 60000) return null;
    const tipo = String(it.type || 'image').toLowerCase(), url = https(it.url), title = String(it.title || it.name || '').slice(0, 80);
    if (tipo === 'audio') return null;                              // cápsula sonora: no hay nada que enseñar
    if (tipo === 'image') return url ? { poster: url, video: null, title } : null;
    const id = String(it.id || '').replace(/^default:/, '');
    const poster = https(it.poster || it.thumbnail || it.thumb) || (/^[A-Za-z0-9_-]{4,80}$/.test(id) ? STOCK_POSTER + id : '');
    if (!poster && !url) return null;
    return { poster: poster || null, video: url || null, title };
  }

  // Pieza del circuito para una orientación (la vertical u horizontal si la hay; si no, la primera).
  function piezaCircuito(c, orientacion) {
    if (!c || typeof c !== 'object' || !https(c.poster)) return null;
    const o = orientacion === 'horizontal' || orientacion === 'vertical' ? c[orientacion] : null;
    const p = o && https(o.poster) ? o : c;
    return { poster: https(p.poster), video: https(p.video) || null, title: String(p.title || '') };
  }

  // ── El nivel de previo de un Xpacio (función pura) ───────────────────────────────────────────────────
  // fuentes = {directo, dooh, circuito, orientacion}: directo de itemEnDirecto, dooh = el previo de fachada (con imagen,
  // w, h, quad, orientacion), circuito = la respuesta de /api/previo/circuito, 'pendiente' mientras llega, o null.
  // fallidas = Set de URLs que ya dieron error en este navegador: se saltan y se baja al nivel siguiente.
  function nivelPrevio(fuentes, fallidas) {
    const f = fuentes || {};
    const vale = u => !!u && !(fallidas && fallidas.has(u));
    const pendiente = f.circuito === 'pendiente';
    const d = f.directo;
    if (d && vale(d.poster)) return { nivel: 'directo', poster: d.poster, video: vale(d.video) ? d.video : null, title: d.title || '' };
    if (d && vale(d.video)) return { nivel: 'directo', poster: null, video: d.video, title: d.title || '' };   // sin póster (o falló): el vídeo
    // La pieza de la orientación de la pantalla; si su póster falló, la primera del circuito.
    const elegir = o => { for (const x of [piezaCircuito(f.circuito, o), piezaCircuito(f.circuito, '')]) if (x && vale(x.poster)) return x; return null; };
    const dooh = f.dooh;
    if (dooh && vale(https(dooh.imagen)) && P && P.validQuad(dooh.quad)) {
      const pieza = elegir(dooh.orientacion === 'horizontal' ? 'horizontal' : 'vertical');
      return { nivel: 'dooh', fachada: dooh, poster: pieza ? pieza.poster : null, video: pieza && pieza.video && vale(pieza.video) ? pieza.video : null, title: pieza ? pieza.title : '', pendiente };
    }
    const pieza = elegir(f.orientacion || 'horizontal');
    if (pieza) return { nivel: 'circuito', poster: pieza.poster, video: pieza.video && vale(pieza.video) ? pieza.video : null, title: pieza.title };
    return { nivel: 'ninguno', pendiente };
  }

  // ── Qué Xpacios llevan tarjeta (función pura) ────────────────────────────────────────────────────────
  // puntos = [{id, x, y, prioridad?}] en píxeles de pantalla. La tarjeta va encima de su punto; cabe entera dentro de
  // la vista (con márgenes), no pisa lo que tapa el mapa (ficha, Comercial) ni a otra tarjeta. Gana la más cercana al
  // centro; con `prioridad` (0 antes que 1 y que 2), primero los que tienen previo y, entre ellos, los más cercanos: en el
  // centro de Zaragoza a zoom 14, los 3 más cercanos del móvil eran Correos y BBVA sin previo, con 30 Alcampo alrededor.
  function cruza(a, b, sep = 0) { return a.l < b.r + sep && b.l < a.r + sep && a.t < b.b + sep && b.t < a.b + sep; }
  // p.extraAlto: la fila «nombre · +N» de un punto compartido hace la tarjeta más alta.
  function cajaTarjeta(p, tarjeta) { return { l: p.x - tarjeta.w / 2, r: p.x + tarjeta.w / 2, t: p.y - tarjeta.base - tarjeta.h - (+p.extraAlto || 0), b: p.y + 6 }; }
  function elegirTarjetas(puntos, opciones = {}) {
    const ancho = +opciones.ancho || 0, alto = +opciones.alto || 0;
    const max = Math.max(0, opciones.max == null ? MAX_ESCRITORIO : +opciones.max);
    const tarjeta = opciones.tarjeta || TARJETA, sep = opciones.separacion == null ? SEPARACION : +opciones.separacion;
    const m = Object.assign({ top: 8, right: 8, bottom: 8, left: 8 }, opciones.margenes || {});
    const tapas = Array.isArray(opciones.tapas) ? opciones.tapas.filter(Boolean) : [];
    const cx = opciones.centro ? opciones.centro[0] : ancho / 2, cy = opciones.centro ? opciones.centro[1] : alto / 2;
    const excluir = opciones.excluir ? new Set([].concat(opciones.excluir)) : null;
    // evitar = [{id, x, y, r}]: puntos que una tarjeta ajena no debe tapar (los compartidos, FLT-102672: hay que poder
    // hacer clic en ellos para elegir). La tarjeta de ese mismo punto sí puede estar encima de él.
    const evitar = Array.isArray(opciones.evitar) ? opciones.evitar.filter(e => e && Number.isFinite(e.x) && Number.isFinite(e.y)) : [];
    const vistos = new Set(), candidatos = [];
    for (const p of puntos || []) {
      if (!p || p.id == null || vistos.has(p.id) || (excluir && excluir.has(p.id)) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      vistos.add(p.id);
      const r = cajaTarjeta(p, tarjeta);
      if (r.l < m.left || r.r > ancho - m.right || r.t < m.top || r.b > alto - m.bottom) continue;
      if (tapas.some(t => cruza(r, t))) continue;
      const propios = new Set([String(p.id)].concat((p.compartidos || []).map(String)));
      if (evitar.some(e => !propios.has(String(e.id)) && cruza(r, { l: e.x - (e.r || 10), r: e.x + (e.r || 10), t: e.y - (e.r || 10), b: e.y + (e.r || 10) }))) continue;
      candidatos.push({ p, r, d: Math.hypot(p.x - cx, p.y - cy), pr: Number.isFinite(+p.prioridad) ? +p.prioridad : 0 });
    }
    candidatos.sort((a, b) => a.pr - b.pr || a.d - b.d || String(a.p.id).localeCompare(String(b.p.id)));
    const elegidas = [];
    for (const c of candidatos) {
      if (elegidas.length >= max) break;
      if (elegidas.some(e => cruza(c.r, e.r, sep))) continue;
      elegidas.push(c);
    }
    return elegidas.map(e => e.p);
  }

  // ── Encuadre del Previo DooH: la foto ampliada alrededor de la pantalla ──────────────────────────────
  // En la foto entera la pantalla mide unos pocos píxeles; se amplía hasta que ocupe `altoPantalla` del alto de la caja,
  // sin pasar de `maxEscala` (nitidez) y sin dejar huecos (la foto siempre cubre la caja). Devuelve el tamaño y la
  // posición de la foto dentro de la caja; la pantalla se deforma con screenTransform de previo.js sobre ese tamaño.
  function encuadreDooh(previo, W, H, { altoPantalla = 0.56, maxEscala = 1.1 } = {}) {
    const w = Number(previo && previo.w) || 1600, h = Number(previo && previo.h) || 900;
    const q = previo && P && P.validQuad(previo.quad) ? previo.quad : [[.4, .3], [.6, .3], [.6, .7], [.4, .7]];
    const xs = q.map(p => p[0] * w), ys = q.map(p => p[1] * h);
    const cubre = Math.max(W / w, H / h);
    let s = (altoPantalla * H) / Math.max(1, Math.max(...ys) - Math.min(...ys));
    s = Math.max(cubre, Math.min(s, Math.max(cubre, maxEscala)));
    const rw = w * s, rh = h * s;
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2 * s, cy = (Math.min(...ys) + Math.max(...ys)) / 2 * s;
    const x = Math.min(0, Math.max(W - rw, W / 2 - cx)), y = Math.min(0, Math.max(H - rh, H / 2 - cy));
    return { x: +x.toFixed(2), y: +y.toFixed(2), w: +rw.toFixed(2), h: +rh.toFixed(2), escala: +s.toFixed(4) };
  }

  // ── HTML del previo (función pura): lo mismo para la tarjeta del mapa y para la ficha ────────────────
  // Devuelve el contenido de la caja de imagen (sin la etiqueta). Las imágenes llevan data-pz-src para que quien las
  // monte escuche su error y baje de nivel. Nunca una caja vacía: «ninguno» y «dooh sin póster» llevan fondo de marca.
  function mediaHtml(n, caja) {
    const W = caja && caja.w || MEDIA.w, H = caja && caja.h || MEDIA.h;
    if (!n || n.nivel === 'ninguno') return '';
    if (n.nivel === 'dooh') {
      const f = n.fachada, e = encuadreDooh(f, W, H, caja && caja.encuadre);
      const [pw, ph] = P.playerSize(f.orientacion);
      const tr = P.screenTransform(f, { w: e.w, h: e.h });
      return '<span class="pz-foto" style="left:' + e.x + 'px;top:' + e.y + 'px;width:' + e.w + 'px;height:' + e.h + 'px">'
        + '<img class="pz-fachada" src="' + esc(f.imagen) + '" data-pz-src="' + esc(f.imagen) + '" alt="" decoding="async" draggable="false">'
        + '<span class="pz-pantalla' + (n.poster ? '' : ' pz-vacia') + '" style="width:' + pw + 'px;height:' + ph + 'px;transform:' + tr + '">'
        + (n.poster ? '<img src="' + esc(n.poster) + '" data-pz-src="' + esc(n.poster) + '" alt="" decoding="async" draggable="false">' : '')
        + '</span></span>';
    }
    // El póster entero (contain) sobre él mismo desenfocado: una pieza vertical no deja bandas vacías en la caja apaisada.
    if (n.poster) return '<img class="pz-fondo" src="' + esc(n.poster) + '" alt="" aria-hidden="true" decoding="async" draggable="false">'
      + '<img class="pz-poster" src="' + esc(n.poster) + '" data-pz-src="' + esc(n.poster) + '" alt="" decoding="async" draggable="false">';
    // En directo y sin póster: el vídeo de la pieza, mudo, sin reproducir (primer fotograma con preload=metadata).
    return '<video class="pz-poster" src="' + esc(n.video) + '" data-pz-src="' + esc(n.video) + '" muted playsinline preload="metadata"></video>';
  }
  function etiquetaHtml(n, tx) {
    const nivel = n && n.nivel || 'ninguno';
    const texto = nivel === 'ninguno' && n && n.pendiente ? tx('pz_cargando') : tx('pz_' + nivel);
    return '<span class="pz-etq pz-etq-' + nivel + '"><i aria-hidden="true"></i>' + esc(texto) + '</span>';
  }
  // Tarjeta del mapa: «Anunciarme aquí» ENCIMA del previo (si hay Comercial) y, debajo, el previo, que abre la ficha.
  // compartidos = cuántos Xpacios más hay en el mismo punto (FLT-102672): entonces, bajo el previo, el nombre del Xpacio de
  // la tarjeta (para saber de cuál es) y «+N», que abre el selector del punto.
  function tarjetaHtml(loc, n, { t, lang, cta = true, movil = false, compartidos = 0 } = {}) {
    const tx = textoPor(t, lang), name = (loc && (loc.name || loc.id)) || 'Xpacio', nivel = n && n.nivel || 'ninguno';
    const boton = cta ? '<button type="button" class="pz-cta" data-pz="cta" aria-label="' + esc(tx('pz_cta_aria', { name })) + '">' + esc(tx('pz_cta')) + '</button>' : '';
    const abrir = esc(tx('pz_open_aria', { name, nivel: tx(nivel === 'ninguno' && n && n.pendiente ? 'pz_cargando' : 'pz_' + nivel) }));
    const pie = compartidos > 0 ? '<span class="pz-pie"><span class="pz-nombre" title="' + esc(name) + '">' + esc(name) + '</span>'
      + '<button type="button" class="pz-mas" data-pz="mas" aria-label="' + esc(tx('mp_mas_aria', { n: compartidos })) + '">' + esc(tx('mp_mas', { n: compartidos })) + '</button></span>' : '';
    if (nivel === 'ninguno') {
      return boton + '<button type="button" class="pz-previo pz-compacta" data-pz="abrir" aria-label="' + abrir + '">' + etiquetaHtml(n, tx) + '</button>' + pie + '<span class="pz-pico" aria-hidden="true"></span>';
    }
    const caja = movil ? MEDIA_MOVIL : MEDIA;
    return boton + '<button type="button" class="pz-previo" data-pz="abrir" aria-label="' + abrir + '"' + (n.title ? ' title="' + esc(n.title) + '"' : '') + '>'
      + '<span class="pz-media pz-media-' + nivel + '" style="width:' + caja.w + 'px;height:' + caja.h + 'px">' + mediaHtml(n, caja) + '</span>'
      + etiquetaHtml(n, tx) + '</button>' + pie + '<span class="pz-pico" aria-hidden="true"></span>';
  }
  // Bloque de la ficha (va justo debajo de #p-comercial): el previo grande, su etiqueta y, si hay qué ver, un botón.
  // En Previo DooH, «▶ Ver emitiendo» abre el previo de siempre (openPrevio, con el canal deformado sobre la fachada).
  function fichaHtml(n, { t, lang, ancho = 352 } = {}) {
    const tx = textoPor(t, lang), nivel = n && n.nivel || 'ninguno';
    if (nivel === 'ninguno') return '<span class="p-emite-nada">' + etiquetaHtml(n, tx) + '</span>';
    const W = Math.max(200, Math.round(ancho)), H = Math.round(W * 9 / 16);
    const accion = nivel === 'dooh' ? 'ver' : n.video ? 'pieza' : '';
    return '<span class="p-emite-media pz-media pz-media-' + nivel + '" style="height:' + H + 'px">' + mediaHtml(n, { w: W, h: H, encuadre: { altoPantalla: 0.5, maxEscala: 1.2 } }) + '</span>'
      + '<span class="p-emite-pie">' + etiquetaHtml(n, tx) + (n.title ? '<span class="p-emite-titulo">' + esc(n.title) + '</span>' : '') + '</span>'
      + (accion ? '<button type="button" class="p-emite-accion" data-pz="' + accion + '">' + esc(tx(accion === 'ver' ? 'pz_ver' : 'pz_pieza')) + '</button>' : '');
  }
  // Firma de lo que se pinta: si no cambia, no se vuelve a montar (no parpadea ni vuelve a pedir imágenes).
  function firma(n, extra) {
    if (!n) return 'nada|' + (extra || '');
    return [n.nivel, n.poster || '', n.video || '', n.fachada ? n.fachada.imagen + JSON.stringify(n.fachada.quad) + n.fachada.orientacion : '', n.pendiente ? 1 : 0, extra || ''].join('|');
  }

  // ── El controlador: tarjetas sobre el mapa y bloque de la ficha ──────────────────────────────────────
  // deps: map, maplibregl, document, fetch, loc(id), fuentes(loc) → {directo, dooh, orientacion, tag}, t, lang(),
  // ocupado() (tour, previo abierto, vuelo), activa() (id con la ficha abierta), tapas() → [{l,t,r,b}], margenes(),
  // puedeAnunciar() (¿hay Comercial?), anunciar(loc), abrir(loc), verEmitiendo(loc), capa ('unclustered-point'),
  // fuente ('locs'), elegirEnPunto(loc, ids, boton) (selector de Xpacios del mismo punto, FLT-102672).
  function crear(deps) {
    const d = Object.assign({ capa: 'unclustered-point', fuente: 'locs', fetch: root.fetch && root.fetch.bind(root), document: root.document }, deps || {});
    const map = d.map, doc = d.document;
    const tarjetas = new Map();          // id → {marker, el, firma, loc, nivel}
    const circuitos = new Map();         // tag → {estado:'pendiente'|'listo', datos, at, promesa}
    const fallidas = new Set();
    let timer = 0, reintento = 0, fichaEstado = null, videoActivo = null, peticiones = 0;
    let espera = null, esperas = 0;      // aviso armado de «la fuente ya tiene sus puntos» y reintentos seguidos
    const refrescoMs = d.refrescoMs || REFRESCO_MS, esperaMs = d.esperaMs || ESPERA_MS;   // los tests los acortan
    const movil = () => (root.innerWidth || 1440) <= MOVIL_PX;
    // Comercial carga después (módulo): se pregunta cada vez, no al crear.
    const puedeAnunciar = () => typeof d.anunciar === 'function' && (typeof d.puedeAnunciar !== 'function' || !!d.puedeAnunciar());
    const lang = () => (typeof d.lang === 'function' ? d.lang() : d.lang) || 'es';

    function circuito(tag) {
      if (!tag || !/^[a-z0-9_-]{1,40}$/.test(tag) || typeof d.fetch !== 'function') return null;
      const c = circuitos.get(tag);
      if (c && (c.estado === 'pendiente' || Date.now() - c.at < CIRCUITO_TTL_MS)) return c;
      const nuevo = { estado: 'pendiente', datos: c && c.datos || null, at: Date.now() };
      peticiones++;
      nuevo.promesa = d.fetch(ENDPOINT + '?tag=' + encodeURIComponent(tag), { headers: { accept: 'application/json' } })
        .then(r => r.ok ? r.json() : null).catch(() => null)
        .then(j => { nuevo.estado = 'listo'; nuevo.datos = j && j.ok && https(j.poster) ? j : null; nuevo.at = Date.now(); actualizar(); programar(); return nuevo.datos; });
      circuitos.set(tag, nuevo);
      return nuevo;
    }
    // Fuentes completas de un Xpacio; `pedir` = puede lanzar la petición del circuito (sólo con tarjeta o ficha a la vista).
    function fuentesDe(loc, pedir) {
      const f = Object.assign({}, d.fuentes(loc) || {});
      const directo = f.directo && (f.directo.poster || f.directo.video);
      const tag = f.tag != null ? f.tag : etiquetaStock(loc);
      // El circuito sólo hace falta si no hay directo (para el Previo DooH y la programación).
      if (!directo && tag) {
        const c = pedir ? circuito(tag) : circuitos.get(tag);
        f.circuito = !c ? null : c.estado === 'pendiente' && !c.datos ? 'pendiente' : c.datos;
      } else f.circuito = null;
      return f;
    }
    function nivelDe(loc, pedir) { return nivelPrevio(fuentesDe(loc, pedir), fallidas); }
    // Sin pedir nada: el nivel si ya se sabe; null si depende de un circuito que aún no se ha consultado (selector).
    function nivelSiSeSabe(loc) {
      const f = fuentesDe(loc, false), n = nivelPrevio(f, fallidas);
      if (n.nivel !== 'ninguno') return n;
      const tag = f.tag != null ? f.tag : etiquetaStock(loc), c = tag ? circuitos.get(tag) : null;
      return !tag || (c && c.estado === 'listo') ? n : null;
    }
    // Barata (sin leer localStorage), para ordenar miles de puntos: 0 = tiene previo; 1 = aún no se sabe; 2 = no tiene.
    function prioridadDe(loc, tag) {
      if ((loc.previo && https(loc.previo.imagen) && !fallidas.has(loc.previo.imagen)) || (typeof d.enDirecto === 'function' && d.enDirecto(loc))) return 0;
      const c = tag ? circuitos.get(tag) : null;
      if (c && c.datos && !fallidas.has(c.datos.poster)) return 0;
      return !tag || (c && c.estado === 'listo') ? 2 : 1;
    }

    // Escucha los errores de imagen/vídeo del bloque: la URL se apunta como fallida y se repinta (baja de nivel).
    function vigilar(el, repintar) {
      el.querySelectorAll('[data-pz-src]').forEach(m => {
        m.addEventListener('error', () => { const u = m.getAttribute('data-pz-src'); if (u && !fallidas.has(u)) { fallidas.add(u); repintar(); } }, { once: true });
      });
    }
    function pararVideo() { if (videoActivo) { try { videoActivo.pause(); videoActivo.remove(); } catch (_) {} videoActivo = null; } }
    // Vídeo mudo al mirar una tarjeta (ratón o foco): el único que se reproduce en el mapa.
    function ponerVideo(caja, n) {
      pararVideo();
      if (!n || !n.video || !caja) return;
      const destino = n.nivel === 'dooh' ? caja.querySelector('.pz-pantalla') : caja;
      if (!destino) return;
      const v = doc.createElement('video');
      v.className = 'pz-video'; v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.preload = 'auto';
      if (n.poster) v.poster = n.poster;
      v.src = n.video;
      v.addEventListener('error', () => { if (videoActivo === v) pararVideo(); }, { once: true });
      destino.append(v); videoActivo = v;
      const p = v.play && v.play(); if (p && p.catch) p.catch(() => {});
    }

    function montarTarjeta(id, loc, n, sitio, compartidos) {
      let t = tarjetas.get(id);
      if (t && compartidos === undefined) compartidos = t.compartidos;   // repintado sin recalcular: los de antes
      compartidos = Array.isArray(compartidos) ? compartidos : [];
      const cta = puedeAnunciar();
      const f = firma(n, lang() + '|' + (movil() ? 'm' : 'd') + '|' + (cta ? 1 : 0) + '|' + (loc.name || '') + '|' + compartidos.join(','));
      if (!t) {
        const el = doc.createElement('div');
        el.className = 'pz-tarjeta';
        el.dataset.pzId = id;
        // El mapa no debe recibir el clic ni empezar a arrastrar desde la tarjeta.
        ['mousedown', 'touchstart', 'pointerdown', 'dblclick', 'wheel'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
        el.addEventListener('click', e => {
          const b = e.target.closest('[data-pz]'); if (!b) return;
          e.preventDefault(); e.stopPropagation();
          const actual = tarjetas.get(id); const l = actual && actual.loc; if (!l) return;
          if (b.dataset.pz === 'cta' && puedeAnunciar()) { pararVideo(); d.anunciar(l); }
          else if (b.dataset.pz === 'abrir') { pararVideo(); d.abrir(l); }
          else if (b.dataset.pz === 'mas' && typeof d.elegirEnPunto === 'function') { pararVideo(); d.elegirEnPunto(l, [id].concat(actual.compartidos || []), b); }
        });
        const mirar = () => { const actual = tarjetas.get(id); if (actual) ponerVideo(el.querySelector('.pz-media'), actual.nivel); };
        el.addEventListener('mouseenter', mirar);
        el.addEventListener('focusin', mirar);
        el.addEventListener('mouseleave', pararVideo);
        el.addEventListener('focusout', e => { if (!el.contains(e.relatedTarget)) pararVideo(); });
        const marker = new d.maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -TARJETA.base + 4] }).setLngLat(loc.coords).addTo(map);
        t = { marker, el, firma: '', loc, nivel: n };
        tarjetas.set(id, t);
      }
      t.loc = loc; t.nivel = n; t.compartidos = compartidos;
      t.el.classList.toggle('pz-sin-cta', !cta);
      t.el.classList.toggle('pz-compartida', compartidos.length > 0);
      t.el.classList.toggle('pz-movil', movil());
      if (t.firma !== f) {
        if (videoActivo && t.el.contains(videoActivo)) pararVideo();
        t.firma = f;
        NIVELES.forEach(x => t.el.classList.toggle('pz-n-' + x, n.nivel === x));
        t.el.innerHTML = tarjetaHtml(loc, n, { t: d.t, lang: lang(), cta, movil: movil(), compartidos: typeof d.elegirEnPunto === 'function' ? compartidos.length : 0 });
        vigilar(t.el, () => refrescarTarjeta(id));
      }
      if (sitio) t.marker.setLngLat(loc.coords);
      return t;
    }
    function refrescarTarjeta(id) {
      const t = tarjetas.get(id); if (!t) return;
      const n = nivelDe(t.loc, true);
      if (n.nivel === 'ninguno' && !puedeAnunciar()) { quitar(id); return; }
      montarTarjeta(id, t.loc, n, false);
    }
    function quitar(id) {
      const t = tarjetas.get(id); if (!t) return;
      if (videoActivo && t.el.contains(videoActivo)) pararVideo();
      try { t.marker.remove(); } catch (_) {}
      tarjetas.delete(id);
    }
    function ocultar() {
      if (!tarjetas.size) return;
      pararVideo();
      [...tarjetas.keys()].forEach(quitar);
    }
    function zoomActual() { try { return map.getZoom(); } catch (_) { return 0; } }
    // ── Fuente aún sin puntos ──
    // Al llegar de golpe al zoom de calle (jumpTo, flyTo del buscador, clic en un cluster, enlace profundo), el moveend
    // puede llegar antes de que la fuente `locs` tenga sus teselas de ese zoom, o mientras recarga datos (llega el
    // catálogo, cambia la emisión): queryRenderedFeatures devuelve 0 y nadie volvía a calcular hasta el siguiente
    // movimiento. Ahora se espera al aviso de la fuente (sourcedata con isSourceLoaded) y, por si ya pasó, se reintenta
    // cada 700 ms hasta 6 veces. No vale `idle`: el latido de los puntos en vivo (animatePulse) repinta en cada fotograma
    // y el mapa nunca llega a idle. Sin bucles: un solo aviso armado; se desarma al alejar o al cumplirse, y los
    // reintentos seguidos se cuentan (vuelven a cero con cada programar() de fuera: moverse, abrir un panel…).
    function fuenteCargada() { try { return typeof map.isSourceLoaded !== 'function' || !!map.isSourceLoaded(d.fuente); } catch (_) { return false; } }
    function desarmarEspera() {
      if (!espera) return;
      clearTimeout(espera.timer);
      try { if (typeof map.off === 'function') map.off('sourcedata', espera.alCargar); } catch (_) {}
      espera = null;
    }
    function esperarFuente() {
      if (espera || esperas >= ESPERA_MAX) return;
      esperas++;
      const yaEsta = () => { desarmarEspera(); clearTimeout(timer); timer = setTimeout(calcular, refrescoMs); };
      espera = { alCargar: e => { if (e && e.sourceId === d.fuente && (e.isSourceLoaded || fuenteCargada())) yaEsta(); } };
      try { if (typeof map.on === 'function') map.on('sourcedata', espera.alCargar); } catch (_) {}
      espera.timer = setTimeout(yaEsta, esperaMs);
    }
    function calcular() {
      timer = 0;
      const lejos = zoomActual() < ZOOM_MIN;
      if (lejos || !d.maplibregl || typeof d.maplibregl.Marker !== 'function' || !map.getLayer) { desarmarEspera(); ocultar(); return; }
      // Sin la capa (cambio de estilo: satélite, mapa, relieve), el mismo aviso: la fuente vuelve con el estilo nuevo.
      if (!map.getLayer(d.capa)) { ocultar(); esperarFuente(); return; }
      if (d.ocupado && d.ocupado()) { ocultar(); clearTimeout(reintento); reintento = setTimeout(programar, OCUPADO_MS); return; }
      const lienzo = map.getCanvas && map.getCanvas();
      const rect = lienzo && lienzo.getBoundingClientRect ? lienzo.getBoundingClientRect() : { left: 0, top: 0, width: root.innerWidth || 0, height: root.innerHeight || 0 };
      let feats = [];
      try { feats = map.queryRenderedFeatures({ layers: [d.capa] }) || []; } catch (_) { feats = []; }
      const cargada = fuenteCargada();
      if (!feats.length || !cargada) {
        esperarFuente();
        // Recargando y sin puntos que mirar: se dejan las tarjetas que haya hasta que la fuente termine.
        if (!feats.length && !cargada) return;
      } else { esperas = 0; desarmarEspera(); }
      const puntos = [], tags = new Set();
      for (const f of feats) {
        const id = f && f.properties && f.properties.id; if (id == null) continue;
        const loc = d.loc(id); if (!loc || !Array.isArray(loc.coords)) continue;
        const px = map.project(loc.coords);
        if (px.x < 0 || px.y < 0 || px.x > rect.width || px.y > rect.height) continue;
        const tag = etiquetaStock(loc); if (tag) tags.add(tag);
        puntos.push({ id, x: px.x, y: px.y, prioridad: prioridadDe(loc, tag) });
      }
      // Los hashtags de lo que se ve (un puñado: hay ~20 en todo el catálogo) se piden una vez por sesión; al llegar,
      // se vuelve a elegir con lo que se sepa.
      tags.forEach(tag => circuito(tag));
      // Puntos compartidos (FLT-102672): la tarjeta dice de quién es y ofrece «+N» para elegir entre los del mismo sitio.
      const mp = typeof d.elegirEnPunto === 'function' ? MP() : null;
      const evitar = [];
      if (mp) { const v = mp.vecinos(puntos); for (const p of puntos) { const c = v.get(String(p.id)); if (c) { p.compartidos = c; p.extraAlto = PIE_ALTO; evitar.push({ id: p.id, x: p.x, y: p.y, r: 11 }); } } }
      const tapas = (d.tapas ? d.tapas() : []).map(t => ({ l: t.l - rect.left, r: t.r - rect.left, t: t.t - rect.top, b: t.b - rect.top }));
      const activa = d.activa ? d.activa() : null;
      const esMovil = movil();
      const elegidos = elegirTarjetas(puntos, { ancho: rect.width, alto: rect.height, max: esMovil ? MAX_MOVIL : MAX_ESCRITORIO,
        tarjeta: esMovil ? TARJETA_MOVIL : TARJETA, margenes: d.margenes ? d.margenes() : null, tapas, excluir: activa, evitar });
      const quedan = new Set();
      for (const p of elegidos) {
        const loc = d.loc(p.id); const n = nivelDe(loc, true);
        if (n.nivel === 'ninguno' && !puedeAnunciar()) continue;   // sin Comercial, una tarjeta vacía no aporta
        quedan.add(p.id);
        montarTarjeta(p.id, loc, n, true, p.compartidos || []);
      }
      [...tarjetas.keys()].forEach(id => { if (!quedan.has(id)) quitar(id); });
    }
    // Tras moveend/zoomend: antirrebote. Con el zoom alejado y sin tarjetas no se hace nada (ni temporizador).
    function programar() {
      esperas = 0;
      if (zoomActual() < ZOOM_MIN) { clearTimeout(timer); timer = 0; clearTimeout(reintento); desarmarEspera(); ocultar(); return; }
      clearTimeout(timer); timer = setTimeout(calcular, refrescoMs);
    }
    // Durante el zoom: si se baja del umbral, fuera tarjetas al momento (sin esperar al moveend).
    function vigilarZoom() { if (tarjetas.size && zoomActual() < ZOOM_MIN) ocultar(); }

    // Ficha: el bloque #p-emite (contenedor) para el local abierto.
    function ficha(loc, contenedor) {
      if (!contenedor) return;
      if (!loc) { contenedor.hidden = true; contenedor.innerHTML = ''; fichaEstado = null; return; }
      fichaEstado = { loc, contenedor, firma: '' };
      pintarFicha();
    }
    function pintarFicha() {
      const st = fichaEstado; if (!st) return;
      const n = nivelDe(st.loc, true);
      const ancho = Math.round((st.contenedor.parentElement && st.contenedor.parentElement.clientWidth) || 352);
      const f = firma(n, lang() + '|' + ancho + '|' + st.loc.id);
      if (st.firma === f) return;
      st.firma = f; st.nivel = n;
      const c = st.contenedor;
      if (c.contains(videoActivo)) pararVideo();
      NIVELES.forEach(x => c.classList.toggle('p-emite-' + x, n.nivel === x));
      c.dataset.nivel = n.nivel;
      c.innerHTML = fichaHtml(n, { t: d.t, lang: lang(), ancho });
      c.hidden = false;
      vigilar(c, () => { if (fichaEstado === st) { st.firma = ''; pintarFicha(); } });
      const accion = c.querySelector('.p-emite-accion');
      if (accion) accion.addEventListener('click', e => {
        e.preventDefault();
        if (accion.dataset.pz === 'ver') { if (typeof d.verEmitiendo === 'function') d.verEmitiendo(st.loc); return; }
        const tx = textoPor(d.t, lang());
        if (videoActivo && c.contains(videoActivo)) { pararVideo(); accion.textContent = tx('pz_pieza'); return; }
        ponerVideo(c.querySelector('.p-emite-media'), st.nivel); accion.textContent = tx('pz_parar');
      });
    }
    // Llegó el póster de un circuito o cambió la emisión: se repintan sólo las tarjetas y la ficha cuya firma cambia.
    function actualizar() {
      [...tarjetas.keys()].forEach(refrescarTarjeta);
      if (fichaEstado) pintarFicha();
    }
    let rTimer = 0;
    if (root.addEventListener) root.addEventListener('resize', () => { clearTimeout(rTimer); rTimer = setTimeout(() => { programar(); if (fichaEstado) pintarFicha(); }, 200); });
    function idioma() { [...tarjetas.values()].forEach(t => { t.firma = ''; }); if (fichaEstado) fichaEstado.firma = ''; actualizar(); }
    function estado() {
      return { tarjetas: [...tarjetas.entries()].map(([id, t]) => ({ id, nivel: t.nivel && t.nivel.nivel })), peticiones, circuitos: [...circuitos.entries()].map(([tag, c]) => ({ tag, estado: c.estado, poster: !!(c.datos && c.datos.poster) })), fallidas: fallidas.size, ficha: fichaEstado && fichaEstado.nivel ? fichaEstado.nivel.nivel : null, esperandoFuente: !!espera, esperas };
    }
    return { programar, calcular, ocultar, vigilarZoom, actualizar, idioma, ficha, circuito, nivelDe, nivelSiSeSabe, estado };
  }

  const api = { ZOOM_MIN, ESPERA_MS, ESPERA_MAX, MAX_ESCRITORIO, MAX_MOVIL, MOVIL_PX, EN_DIRECTO_MS, SEPARACION, TARJETA, TARJETA_MOVIL, MEDIA, MEDIA_MOVIL, ENDPOINT, STOCK_POSTER, NIVELES, TEXTOS,
    PIE_ALTO, etiquetaStock, orientacionDe, itemEnDirecto, piezaCircuito, nivelPrevio, elegirTarjetas, cajaTarjeta, encuadreDooh, mediaHtml, etiquetaHtml, tarjetaHtml, fichaHtml, firma, crear };
  root.AdmiraPreviosZoom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
