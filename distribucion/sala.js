(function () {
  var SCREEN = 'demo-sala-macmini';
  var API = 'https://api.admira.store';
  function signage(tail) {
    if (location.hostname.endsWith('.pages.dev')) return '/api/demo-signage/' + tail;
    return API + '/signage/' + tail;
  }
  var video = document.getElementById('video');
  var titulo = document.getElementById('titulo');
  var fase = document.getElementById('fase');
  var espera = document.getElementById('espera');
  var esperaTxt = document.getElementById('espera-txt');
  var actual = '';
  var yaReproduce = false;

  function postAhora(item) {
    return fetch(signage('now'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen: SCREEN, producer: 'demo-sala-macmini', item: item })
    }).catch(function () { return null; });
  }

  function ack(id) {
    return fetch(signage('ack/' + encodeURIComponent(id)), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen: SCREEN })
    }).catch(function () { return null; });
  }

  function pintar(item) {
    if (!item || item.target !== SCREEN || !item.src) return;
    if (item.id === actual && !video.paused && video.src) return;
    actual = item.id;
    yaReproduce = false;
    espera.hidden = false;
    esperaTxt.textContent = 'Descargando la pieza';
    titulo.textContent = item.title || item.id;
    fase.textContent = 'descargando';
    postAhora({
      id: item.id, type: 'video', url: item.src + '#descargando',
      kind: item.kind || 'video', src: item.src,
      title: item.title || '', status: 'descargando', target: SCREEN
    });
    video.src = item.src;
    video.play().catch(function () {});
  }

  function marcarReproduciendo() {
    if (!actual || yaReproduce) return;
    yaReproduce = true;
    espera.hidden = true;
    fase.textContent = 'reproduciendo';
    var src = video.currentSrc || video.src;
    postAhora({
      id: actual, type: 'video', url: src + '#reproduciendo',
      kind: 'video', src: src,
      title: titulo.textContent, status: 'reproduciendo', target: SCREEN
    });
    ack(actual);
  }

  video.addEventListener('playing', marcarReproduciendo);
  video.addEventListener('timeupdate', function () {
    if (video.currentTime > 0.15) marcarReproduciendo();
  });
  video.addEventListener('error', function () {
    fase.textContent = 'error de vídeo';
    esperaTxt.textContent = 'El vídeo no arrancó';
  });

  async function pulso() {
    try {
      var r = await fetch(signage('feed'), { cache: 'no-store' });
      var d = await r.json();
      var items = (d && d.items) || [];
      var propio = items.find(function (it) { return it && it.target === SCREEN && it.src; });
      if (propio) pintar(propio);
    } catch (e) {
      fase.textContent = 'sin enlace';
    }
  }

  pulso();
  setInterval(pulso, 2000);
})();
