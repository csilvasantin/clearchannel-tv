(function () {
  var SALA = 'demo-sala-macmini';
  var API = 'https://api.admira.store';
  var PIEZAS = [
    {
      id: '1790609061411-86drpb',
      titulo: 'Tu pausa',
      marca: 'Alsea',
      circuito: 'alsea',
      videoId: '1790609061411-86drpb',
      audioId: '1790608402098-xubtdh'
    },
    {
      id: '1790608980217-vni6ai',
      titulo: 'Tu sitio de siempre',
      marca: 'JTI',
      circuito: 'jti',
      videoId: '1790608980217-vni6ai',
      audioId: '1790608329621-mhuvq3'
    }
  ];

  var state = {
    circuito: 'alsea',
    modo: 'sueltos',
    cuando: 'ahora',
    fuente: 'ejemplo',
    nota: '',
    puntos: { alsea: [], jti: [] },
    pieza: PIEZAS[0],
    piezas: PIEZAS.slice(),
    seleccion: new Set(),
    estados: new Map(),
    registro: [],
    map: null,
    markers: [],
    poll: 0,
    timers: []
  };

  function $(id) { return document.getElementById(id); }
  function asset(id) { return API + '/stock/asset/' + id; }
  function signage(tail) {
    if (location.hostname.endsWith('.pages.dev')) return '/api/demo-signage/' + tail;
    return API + '/signage/' + tail;
  }
  function madrid(d) {
    return new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'medium'
    }).format(d || new Date());
  }
  function qs(name) { return new URLSearchParams(location.search).get(name); }

  function normalizar(raw, circuito) {
    var lat = raw.lat;
    var lng = raw.lng;
    if (Array.isArray(raw.coords) && raw.coords.length >= 2) {
      lng = raw.coords[0];
      lat = raw.coords[1];
    }
    return {
      id: String(raw.id || ''),
      nombre: raw.nombre || raw.name || raw.id,
      marca: raw.marca || raw.kind || circuito,
      ciudad: raw.ciudad || raw.city || '',
      lat: Number(lat),
      lng: Number(lng),
      grupo: raw.grupo || 'grupo',
      ejemplo: raw.ejemplo === true,
      circuito: circuito
    };
  }

  async function leerJson(url) {
    var r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  function aplicarPuntos(data, fuente) {
    state.fuente = fuente;
    state.nota = data.nota || '';
    state.puntos.alsea = (data.alsea || []).map(function (p) { return normalizar(p, 'alsea'); });
    state.puntos.jti = (data.jti || []).map(function (p) { return normalizar(p, 'jti'); });
  }

  function elegirPieza() {
    var id = qs('pieza') || '';
    var lista = state.piezas;
    var found = lista.find(function (p) { return p.id === id || p.videoId === id || p.audioId === id; });
    if (found) {
      state.pieza = found;
      if (found.circuito === 'alsea' || found.circuito === 'jti') state.circuito = found.circuito;
      return;
    }
    if (id) {
      state.pieza = {
        id: id, titulo: 'Pieza ' + id, marca: 'URL', circuito: state.circuito,
        videoId: id, audioId: '', ejemplo: true
      };
    }
  }

  function puntosActivos() { return state.puntos[state.circuito] || []; }

  function pintarBanner() {
    var el = $('fuente-banner');
    if (state.fuente === 'niobe') {
      el.innerHTML = 'Puntos leídos de <code>data/demo-distribucion/puntos.json</code>.';
      return;
    }
    el.innerHTML = '<span class="banner">EJEMPLO</span> Lista provisional: el JSON de Niobe todavía no está en esta rama. ' +
      'Alsea usa los 10 Starbucks de México del catálogo. JTI usa 10 estancos Xtanco del catálogo.';
  }

  function pintarPieza() {
    var p = state.pieza;
    var ejemplo = p.ejemplo ? ' <span class="ej">EJEMPLO</span>' : '';
    $('pieza').innerHTML =
      '<p class="marca">' + escapeHtml(p.marca) + ejemplo + '</p>' +
      '<h2 class="pieza-titulo">' + escapeHtml(p.titulo) + '</h2>' +
      '<p class="nota">Vídeo principal <code>' + escapeHtml(p.videoId || p.id) + '</code>' +
      (p.audioId ? ' · hilo musical <code>' + escapeHtml(p.audioId) + '</code>' : '') +
      ' · <a href="https://www.pixeria.com/stock.html?highlight=' + encodeURIComponent(p.videoId || p.id) + '">ver en Stock</a></p>';
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function pintarLista() {
    var ul = $('lista');
    ul.innerHTML = '';
    puntosActivos().forEach(function (p) {
      var li = document.createElement('li');
      if (state.seleccion.has(p.id)) li.className = 'on';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = state.seleccion.has(p.id);
      box.addEventListener('change', function () {
        if (box.checked) state.seleccion.add(p.id);
        else state.seleccion.delete(p.id);
        state.modo = 'sueltos';
        marcarModos();
        pintarLista();
        pintarMapa();
        pintarEstados();
      });
      var body = document.createElement('div');
      var chip = p.ejemplo ? ' <span class="ej">EJEMPLO</span>' : '';
      body.innerHTML = '<b>' + escapeHtml(p.nombre) + '</b>' + chip +
        '<div class="ciudad">' + escapeHtml(p.ciudad) + ' · ' + escapeHtml(p.grupo) + ' · ' + escapeHtml(p.id) + '</div>';
      li.appendChild(box);
      li.appendChild(body);
      li.addEventListener('click', function (ev) {
        if (ev.target === box) return;
        box.checked = !box.checked;
        box.dispatchEvent(new Event('change'));
      });
      ul.appendChild(li);
    });
  }

  function pintarGrupos() {
    var host = $('grupos');
    host.innerHTML = '';
    if (state.modo !== 'grupo') return;
    var seen = {};
    puntosActivos().forEach(function (p) { seen[p.grupo] = true; });
    Object.keys(seen).forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = g;
      b.addEventListener('click', function () {
        state.seleccion = new Set(puntosActivos().filter(function (p) { return p.grupo === g; }).map(function (p) { return p.id; }));
        pintarLista();
        pintarMapa();
        pintarEstados();
      });
      host.appendChild(b);
    });
  }

  function marcarModos() {
    $('btn-alsea').classList.toggle('on', state.circuito === 'alsea');
    $('btn-jti').classList.toggle('on', state.circuito === 'jti');
    $('modo-sueltos').classList.toggle('on', state.modo === 'sueltos');
    $('modo-grupo').classList.toggle('on', state.modo === 'grupo');
    $('modo-todo').classList.toggle('on', state.modo === 'todo');
    $('cuando-ahora').classList.toggle('on', state.cuando === 'ahora');
    $('cuando-franja').classList.toggle('on', state.cuando === 'franja');
    pintarGrupos();
  }

  function cambiarCircuito(c) {
    state.circuito = c;
    var pieza = state.piezas.find(function (p) { return p.circuito === c && !p.ejemplo; })
      || state.piezas.find(function (p) { return p.circuito === c; });
    if (pieza) state.pieza = pieza;
    state.seleccion = new Set();
    state.modo = 'sueltos';
    marcarModos();
    pintarPieza();
    pintarLista();
    pintarMapa();
    pintarEstados();
  }

  function asegurarMapa() {
    if (state.map || typeof maplibregl === 'undefined') return;
    state.map = new maplibregl.Map({
      container: 'mapa',
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-3.7, 40.4],
      zoom: 4
    });
    state.map.addControl(new maplibregl.NavigationControl(), 'top-right');
    state.map.on('load', pintarMapa);
  }

  function pintarMapa() {
    if (!state.map || !state.map.isStyleLoaded()) return;
    state.markers.forEach(function (m) { m.remove(); });
    state.markers = [];
    var bounds = new maplibregl.LngLatBounds();
    var n = 0;
    puntosActivos().forEach(function (p) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'pin' + (state.seleccion.has(p.id) ? '' : ' off');
      el.title = p.nombre;
      el.addEventListener('click', function () {
        if (state.seleccion.has(p.id)) state.seleccion.delete(p.id);
        else state.seleccion.add(p.id);
        state.modo = 'sueltos';
        marcarModos();
        pintarLista();
        pintarMapa();
        pintarEstados();
      });
      var marker = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(state.map);
      state.markers.push(marker);
      bounds.extend([p.lng, p.lat]);
      n++;
    });
    if (n) state.map.fitBounds(bounds, { padding: 48, maxZoom: 6, duration: 400 });
  }

  function filaEstado(id, nombre, extra) {
    var st = state.estados.get(id) || { estado: 'en espera', detalle: 'aún no se ha publicado', simulado: false, real: false };
    var cls = 'estado-' + st.estado;
    var marca = '';
    if (st.simulado) marca = ' <span class="sim">SIMULADO</span>';
    if (st.real) marca = ' <span class="real">REAL</span>';
    if (extra) marca += extra;
    return '<tr><td>' + escapeHtml(nombre) + marca + '</td><td class="' + cls + '">' +
      escapeHtml(st.estado) + '</td><td>' + escapeHtml(st.detalle) + '</td></tr>';
  }

  function pintarEstados() {
    var html = filaEstado(SALA, 'Pantalla de sala · Mac Mini', '');
    puntosActivos().forEach(function (p) {
      var chip = p.ejemplo ? ' <span class="ej">EJEMPLO</span>' : '';
      html += filaEstado(p.id, p.nombre, chip);
    });
    $('estados').innerHTML = html;
  }

  function pintarRegistro() {
    $('registro').innerHTML = state.registro.map(function (r) {
      return '<li><b>' + escapeHtml(r.cuando) + '</b> · ' + escapeHtml(r.que) +
        ' · ' + escapeHtml(r.donde) + ' · ' + escapeHtml(r.resultado) + '</li>';
    }).join('') || '<li class="nota">Todavía no hay envíos.</li>';
  }

  function anotar(que, donde, resultado) {
    state.registro.unshift({ cuando: madrid(new Date()), que: que, donde: donde, resultado: resultado });
    pintarRegistro();
  }

  function limpiarTimers() {
    state.timers.forEach(clearTimeout);
    state.timers = [];
  }

  function ponerEstado(id, estado, detalle, flags) {
    state.estados.set(id, {
      estado: estado,
      detalle: detalle,
      simulado: !!(flags && flags.simulado),
      real: !!(flags && flags.real)
    });
  }

  function simularPunto(p) {
    ponerEstado(p.id, 'enviado', 'el circuito no tiene player en línea; el paso es de demostración', { simulado: true });
    state.timers.push(setTimeout(function () {
      ponerEstado(p.id, 'descargando', 'paso de demostración, sin descarga real en el local', { simulado: true });
      pintarEstados();
    }, 1200));
    state.timers.push(setTimeout(function () {
      ponerEstado(p.id, 'reproduciendo', 'paso de demostración, la pantalla del local no ha cambiado', { simulado: true });
      pintarEstados();
    }, 2800));
  }

  function franjaTexto() {
    if (state.cuando !== 'franja') return 'ahora';
    return ($('desde').value || '…') + ' → ' + ($('hasta').value || '…');
  }

  function franjaValida() {
    if (state.cuando !== 'franja') return { ok: true, incluyeAhora: true };
    var a = Date.parse($('desde').value);
    var b = Date.parse($('hasta').value);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return { ok: false };
    var now = Date.now();
    return { ok: true, incluyeAhora: now >= a && now <= b, futuro: now < a };
  }

  async function publicarSala(pieza) {
    var body = {
      kind: 'video',
      src: asset(pieza.videoId || pieza.id),
      mime: 'video/mp4',
      title: pieza.titulo,
      target: SALA,
      interrupt: false,
      source: 'demo-distribucion',
      meta: { source: 'demo-distribucion', page: 'Distribuir', asset_id: pieza.videoId || pieza.id, asset_label: pieza.titulo }
    };
    var r = await fetch(signage('push'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok || !d.ok) throw new Error(d.error || ('http ' + r.status));
    return d;
  }

  function vigilarSala(pushId) {
    if (state.poll) clearInterval(state.poll);
    var n = 0;
    state.poll = setInterval(async function () {
      n++;
      if (n > 20) clearInterval(state.poll);
      try {
        var now = await fetch(signage('now'), { cache: 'no-store' }).then(function (r) { return r.json(); });
        var item = now && now.item;
        if (!item || (pushId && item.id && item.id !== pushId)) return;
        if (item.status === 'descargando' || item.status === 'reproduciendo') {
          ponerEstado(SALA, item.status, item.title || pushId, { real: true });
          pintarEstados();
        }
      } catch (e) {}
    }, 2000);
  }

  async function publicar() {
    var aviso = $('aviso');
    aviso.textContent = '';
    var elegidos = puntosActivos().filter(function (p) { return state.seleccion.has(p.id); });
    var sala = $('sala-check').checked;
    if (!elegidos.length && !sala) {
      aviso.textContent = 'Elige al menos un punto o la pantalla de sala.';
      return;
    }
    var franja = franjaValida();
    if (!franja.ok) {
      aviso.textContent = 'La franja necesita un inicio y un final, y el final va después del inicio.';
      return;
    }
    $('publicar').disabled = true;
    limpiarTimers();
    var pieza = state.pieza;
    var donde = elegidos.map(function (p) { return p.nombre; }).join(', ') || 'sin puntos de circuito';
    if (sala) donde = (donde ? donde + ' + ' : '') + 'pantalla de sala';
    try {
      if (franja.futuro) {
        elegidos.forEach(function (p) {
          ponerEstado(p.id, 'programado', 'franja ' + franjaTexto(), { simulado: true });
        });
        if (sala) ponerEstado(SALA, 'programado', 'la pantalla espera a la franja; no se envía todavía', { real: true });
        anotar(pieza.titulo + ' · ' + (pieza.videoId || pieza.id), donde, 'programado · ' + franjaTexto());
        pintarEstados();
        return;
      }
      elegidos.forEach(simularPunto);
      if (sala) {
        ponerEstado(SALA, 'enviado', 'enviando el vídeo a la pantalla de sala', { real: true });
        pintarEstados();
        var push = await publicarSala(pieza);
        ponerEstado(SALA, 'enviado', 'el feed aceptó ' + push.id, { real: true });
        anotar(pieza.titulo + ' · vídeo ' + (pieza.videoId || pieza.id) + (pieza.audioId ? ' · hilo ' + pieza.audioId : ''), donde, 'enviado a ' + SALA + ' · ' + push.id + ' · ' + franjaTexto());
        vigilarSala(push.id);
      } else {
        anotar(pieza.titulo + ' · ' + (pieza.videoId || pieza.id), donde, 'solo puntos de circuito, marcados como simulados · ' + franjaTexto());
      }
      pintarEstados();
    } catch (e) {
      if (sala) ponerEstado(SALA, 'error', String(e.message || e), { real: true });
      anotar(pieza.titulo, donde, 'la pantalla de sala no aceptó el envío');
      aviso.textContent = 'La pantalla de sala no aceptó el envío.';
      pintarEstados();
    } finally {
      $('publicar').disabled = false;
    }
  }

  function cablear() {
    $('btn-alsea').onclick = function () { cambiarCircuito('alsea'); };
    $('btn-jti').onclick = function () { cambiarCircuito('jti'); };
    $('modo-sueltos').onclick = function () { state.modo = 'sueltos'; marcarModos(); };
    $('modo-grupo').onclick = function () {
      state.modo = 'grupo';
      state.seleccion = new Set();
      marcarModos();
      pintarLista();
      pintarMapa();
      pintarEstados();
    };
    $('modo-todo').onclick = function () {
      state.modo = 'todo';
      state.seleccion = new Set(puntosActivos().map(function (p) { return p.id; }));
      marcarModos();
      pintarLista();
      pintarMapa();
      pintarEstados();
    };
    $('cuando-ahora').onclick = function () { state.cuando = 'ahora'; marcarModos(); };
    $('cuando-franja').onclick = function () { state.cuando = 'franja'; marcarModos(); };
    $('publicar').onclick = publicar;
  }

  async function arranque() {
    try {
      var oficial = await leerJson('/data/demo-distribucion/puntos.json');
      aplicarPuntos(oficial, 'niobe');
    } catch (e) {
      var ejemplo = await leerJson('/data/demo-distribucion/puntos.ejemplo.json');
      aplicarPuntos(ejemplo, 'ejemplo');
    }
    var endpoint = qs('piezas');
    if (endpoint) {
      try {
        var remoto = await leerJson(endpoint);
        var items = remoto.items || remoto.piezas || remoto;
        if (Array.isArray(items) && items.length) {
          state.piezas = items.map(function (it) {
            return {
              id: it.id || it.videoId,
              titulo: it.titulo || it.title || it.id,
              marca: it.marca || it.brand || '',
              circuito: it.circuito || it.circuit || 'alsea',
              videoId: it.videoId || it.video || it.id,
              audioId: it.audioId || it.audio || ''
            };
          });
        }
      } catch (e2) {}
    }
    elegirPieza();
    cablear();
    pintarBanner();
    pintarPieza();
    marcarModos();
    pintarLista();
    pintarEstados();
    pintarRegistro();
    asegurarMapa();
    if (state.map && state.map.isStyleLoaded()) pintarMapa();
  }

  arranque();
})();
