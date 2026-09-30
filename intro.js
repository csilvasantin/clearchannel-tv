// Entrada rápida y circuito de demo (encargo #4566 · presentación JTI/Altadis).
// 1) Al abrir se ve al instante un vídeo en bucle grabado de la propia bola; la
//    bola 3D carga detrás y lo sustituye con un fundido cuando pinta el mundo.
// 2) /demo o /cli desde el modo experto lanza un circuito de 4 pasos. Si la bola
//    aún no está lista, la demo sigue sobre el vídeo y vuela en cuanto llega.
// Cifras: la planificación es una estimación con las impresiones/día estimadas
// de la ficha; la compra es SIMULADA (no hay pasarela, no se guarda ni se
// programa nada); el contador separa lo vendido de verdad hoy (/grid/sales) del
// importe simulado de esta demo.
(function () {
  'use strict';
  const intro = document.getElementById('intro');
  const video = document.getElementById('intro-video');
  if (!intro) return;

  const es = () => (typeof LANG === 'undefined' ? document.documentElement.lang !== 'en' : LANG !== 'en');
  const L = (esText, enText) => (es() ? esText : enText);
  const money = n => (typeof formatMoney === 'function' ? formatMoney(n)
    : new Intl.NumberFormat(es() ? 'es-ES' : 'en-US', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0}).format(n));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  // ─── Vídeo → bola 3D ──────────────────────────────────────────────
  // El vídeo gira como la bola (5°/s desde -28°); al fundir se coloca la bola en
  // la longitud del fotograma que se ve para que el cambio no salte.
  const demo = {running: false, step: 0, flown: false, simulated: 0, audio: null, plan: null};
  const VIDEO_LNG0 = -28, VIDEO_DEG_S = 5, VIDEO_LOOP_S = 12;
  function videoLng() {
    const t = video && Number.isFinite(video.currentTime) ? video.currentTime : 0;
    return VIDEO_LNG0 + VIDEO_DEG_S * (t < 0.75 ? t + VIDEO_LOOP_S : t);
  }
  let globeShown = false;
  function showGlobe() {
    if (globeShown) return;
    globeShown = true;
    try {
      if (!demo.running && typeof map !== 'undefined' && map.getZoom() < 3) map.jumpTo({center: [videoLng(), 16]});
    } catch (_) {}
    intro.classList.add('globe-ready');
    setTimeout(() => { if (video) { video.pause(); video.removeAttribute('src'); video.querySelectorAll('source').forEach(s => s.remove()); video.load(); } }, 900);
    // Si la demo empezó sobre el vídeo, el paso 1 se repinta y ahora sí vuela.
    if (demo.running && demo.step === 0 && !demo.flown) render();
  }
  if (document.documentElement.dataset.globeReady) showGlobe();
  else document.addEventListener('cc:globe-ready', showGlobe, {once: true});
  if (video) video.play?.().catch(() => {});

  // ─── Circuito ─────────────────────────────────────────────────────
  const card = document.getElementById('demo-card');
  const DAYS = 7;
  const xpacio = () => (typeof LOCATIONS !== 'undefined' ? LOCATIONS : []).find(l => l.id === 'xtanco-valencia');

  // Planificación con los datos de la ficha: impr/día (estimadas) × días × CPM.
  function plan() {
    const loc = xpacio();
    const surfaces = (loc?.surfaces || []).filter(s => s.status === 'live' && s.surface !== 'pwa').slice(0, 3);
    const rows = surfaces.map(s => {
      const cpm = Number(String(s.cpm || '').replace(/[^\d.]/g, '')) || 0;
      const impr = (Number(s.impr) || 0) * DAYS;
      return {name: s.name, impr, cpm, cost: impr * cpm / 1000};
    });
    const total = Math.max(1, Math.round(rows.reduce((a, r) => a + r.cost, 0)));
    return {loc, rows, total, impr: rows.reduce((a, r) => a + r.impr, 0)};
  }

  function flyToXpacio() {
    const loc = xpacio();
    if (!loc || typeof flyToLocation !== 'function') return;
    demo.flown = true;
    try { rotating = false; } catch (_) {}
    flyToLocation(loc).catch?.(() => {});
  }

  const STEPS = [
    {
      title: () => L('Zoom a un Xpacio y planifica', 'Zoom into a Xpacio and plan'),
      body: () => {
        // La compra reutiliza esta cifra: las impr/día de la ficha se refrescan en
        // vivo a los pocos segundos y el paso 2 no debe cobrar otra (encargo #4604).
        const p = demo.plan = plan();
        const rows = p.rows.map(r => `<li><span>${esc(r.name)}</span><b>${money(r.cost)}</b><small>${r.impr.toLocaleString(es() ? 'es-ES' : 'en-US')} ${L('impr.', 'impr.')} · CPM ${money(r.cpm)}</small></li>`).join('');
        const waiting = globeShown ? '' : `<p class="demo-note">${L('La bola 3D termina de cargar; seguimos sobre el vídeo y volamos al Xpacio en cuanto esté.', 'The 3D globe is still loading; we carry on over the video and fly to the Xpacio as soon as it is ready.')}</p>`;
        return `<p class="demo-note">${L('Demo guiada iniciada. La compra del recorrido es simulada. Escribe /help en la línea de comandos para consultar la ayuda.', 'Guided demo started. The tour purchase is simulated. Type /help in the command line for help.')}</p>
          <p><b>Xtanco Valencia</b> · ${L('Carrer de Colón 22, València', 'Carrer de Colón 22, Valencia')}</p>
          <p>${L(`Campaña de ${DAYS} días en sus pantallas en directo:`, `A ${DAYS}-day campaign on its live screens:`)}</p>
          <ul class="demo-plan">${rows}</ul>
          <p class="demo-total">${L('Presupuesto', 'Budget')} <b>${money(p.total)}</b> <span class="demo-tag est">${L('estimado', 'estimate')}</span></p>
          <p class="demo-note">${L('Impresiones/día estimadas de la ficha del Xpacio × CPM publicado.', 'Estimated impressions/day from the Xpacio sheet × published CPM.')}</p>${waiting}`;
      },
      enter: () => { if (globeShown) flyToXpacio(); },
    },
    {
      title: () => L('Compra', 'Buy'),
      body: () => {
        const p = demo.plan || plan();
        return `<p>${L('Un clic y la campaña queda comprada.', 'One click and the campaign is bought.')}</p>
          <button type="button" class="demo-buy" id="demo-buy">${L('Comprar', 'Buy')} · ${money(p.total)}</button>
          <p class="demo-bought" id="demo-bought" hidden></p>
          <p class="demo-note"><span class="demo-tag sim">${L('SIMULADA', 'SIMULATED')}</span> ${L('Hoy no hay pasarela de pago activa: no se cobra, no se guarda ninguna solicitud y no se reserva parrilla.', 'No payment gateway is live today: nothing is charged, no request is stored and no airtime is booked.')}</p>`;
      },
      enter: () => {
        const btn = document.getElementById('demo-buy');
        btn?.addEventListener('click', () => {
          demo.simulated = (demo.plan || plan()).total;
          btn.disabled = true;
          const ref = 'SIM-' + Math.random().toString(36).slice(2, 8).toUpperCase();
          const ok = document.getElementById('demo-bought');
          if (ok) { ok.hidden = false; ok.innerHTML = `✓ ${L('Compra simulada', 'Simulated purchase')} <b>${ref}</b> · ${money(demo.simulated)}`; }
          nextBtn()?.focus();
        });
      },
    },
    {
      title: () => L('En pantalla y en el hilo musical', 'On screen and in the music feed'),
      body: () => `<div class="demo-screen"><img src="/assets/intro/capsula.jpg" alt="${L('Cápsula publicitaria Clear Channel × Xtanco', 'Clear Channel × Xtanco ad capsule')}"><span>${L('Pantalla A · Xtanco Valencia', 'Screen A · Xtanco Valencia')}</span></div>
        <p>🎵 ${L('Cápsula sonora en el hilo musical', 'Audio capsule in the music feed')}: <i>Vida mía (${L('versión', 'version')} Admira)</i>
          <button type="button" class="demo-audio" id="demo-audio">❚❚</button></p>
        <p class="demo-note">${L('Las cápsulas reales de la demo de Xtanco Valencia.', 'The real capsules from the Xtanco Valencia demo.')}
          <a href="https://admira.tv/canal.html?screen=xtanco-valencia-a" target="_blank" rel="noopener">${L('Ver pantalla A en vivo', 'Watch screen A live')} ↗</a> ·
          <a href="https://admira.tv/canal.html?screen=xtanco-valencia-musica" target="_blank" rel="noopener">${L('hilo musical en vivo', 'live music feed')} ↗</a></p>`,
      enter: () => {
        if (!demo.audio) { demo.audio = new Audio('https://api.admira.store/stock/asset/1788556467836-r1j7ic?v=1685901'); demo.audio.preload = 'auto'; demo.audio.volume = 0.8; }
        const btn = document.getElementById('demo-audio');
        const sync = () => { if (btn) btn.textContent = demo.audio.paused ? '▶' : '❚❚'; };
        demo.audio.play().catch(() => {}).finally(sync);
        demo.audio.onplay = demo.audio.onpause = sync;
        btn?.addEventListener('click', () => { demo.audio.paused ? demo.audio.play().catch(() => {}) : demo.audio.pause(); });
      },
      leave: () => { demo.audio?.pause(); },
    },
    {
      title: () => L('El euro que entra', 'The euro coming in'),
      body: () => `<div class="demo-counter"><b id="demo-euro">${money(0)}</b></div>
        <p>${L('Vendido hoy de verdad en la parrilla de Xtanco Valencia', 'Actually sold today on the Xtanco Valencia grid')}: <b id="demo-real">…</b> <span class="demo-tag real">${L('real · sin cobrar', 'real · not charged')}</span></p>
        <p>${L('Esta demo', 'This demo')}: <b>${money(demo.simulated)}</b> <span class="demo-tag sim">${L('SIMULADO', 'SIMULATED')}</span></p>
        <p class="demo-note">${L('El contador suma las dos cifras y las muestra separadas: la real viene de /grid/sales; la simulada no se guarda.', 'The counter adds both and shows them apart: the real one comes from /grid/sales; the simulated one is not stored.')}</p>`,
      enter: async () => {
        let real = null;
        try {
          const day = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Madrid'}).format(new Date());
          const d = await (await fetch(`https://api.admira.store/grid/sales?screens=xtanco-valencia-a,xtanco-valencia-musica&from=${day}&to=${day}`, {cache: 'no-store'})).json();
          if (d && d.ok) real = Number(d.revenue) || 0;
        } catch (_) {}
        if (demo.step !== 3 || !demo.running) return;
        const realEl = document.getElementById('demo-real');
        if (realEl) realEl.textContent = real == null ? L('parrilla no disponible', 'grid unavailable') : money(real);
        try { refreshRevenue(); } catch (_) {}
        const target = (real || 0) + demo.simulated, el = document.getElementById('demo-euro'), t0 = performance.now(), dur = 2200;
        const tick = now => {
          if (!el || demo.step !== 3) return;
          const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
          el.textContent = money(target * e);
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
    },
  ];

  const nextBtn = () => document.getElementById('demo-next');
  function render() {
    const s = STEPS[demo.step], last = demo.step === STEPS.length - 1;
    card.innerHTML = `<div class="demo-head"><span class="demo-dots">${STEPS.map((_, i) => `<i class="${i <= demo.step ? 'on' : ''}"></i>`).join('')}</span>
        <span>${L('Paso', 'Step')} ${demo.step + 1}/${STEPS.length}</span>
        <button type="button" class="demo-x" id="demo-exit" aria-label="${L('Salir de la demo', 'Exit demo')}">×</button></div>
      <h2>${esc(s.title())}</h2><div class="demo-body">${s.body()}</div>
      <div class="demo-foot">${demo.step ? `<button type="button" class="demo-back" id="demo-back">← ${L('Atrás', 'Back')}</button>` : '<span></span>'}
        <button type="button" class="demo-next" id="demo-next">${last ? L('Terminar', 'Finish') : L('Siguiente', 'Next') + ' →'}</button></div>`;
    document.getElementById('demo-exit').addEventListener('click', stop);
    document.getElementById('demo-back')?.addEventListener('click', () => go(demo.step - 1));
    nextBtn().addEventListener('click', () => (last ? stop() : go(demo.step + 1)));
    s.enter?.();
  }
  function go(i) {
    STEPS[demo.step].leave?.();
    demo.step = Math.max(0, Math.min(STEPS.length - 1, i));
    render();
  }
  function start() {
    if (demo.running) STEPS[demo.step].leave?.();
    Object.assign(demo, {running: true, step: 0, flown: false, simulated: 0, plan: null});
    card.hidden = false;
    render();
  }
  function stop() {
    STEPS[demo.step].leave?.();
    demo.running = false;
    card.hidden = true;
    card.innerHTML = '';
  }
  window.AdmiraDemo = Object.freeze({start, stop});
  document.addEventListener('keydown', e => { if (demo.running && e.key === 'Escape') stop(); });
  // El idioma puede cambiar con el botón ENG/ES de la cabecera.
  let shownLang = es();
  new MutationObserver(() => {
    if (es() === shownLang) return;
    shownLang = es();
    if (demo.running) render();
  }).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
})();
