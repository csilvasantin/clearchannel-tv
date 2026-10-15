// Modo experto en 3 bloques (FLT-101307), como los módulos SCUMM de admira.live:
// IZQUIERDO = CLI, CENTRAL = VERBOS, DERECHO = RUTINAS. Cada bloque tiene cabecera
// con asa (arrastrar o ←/→ para reordenar) y × para cerrar; ⋯ restaura los cerrados;
// el borde derecho reparte el ancho con el vecino (15–85 %, flechas, Home, doble
// clic); el estado vive en localStorage. Bajo 600 px los bloques se apilan.
// La altura del panel la sigue gobernando el asa superior de responsive-shell.js.
(function (root) {
  'use strict';

  const IDS = ['cli', 'verbos', 'rutinas'];
  const LAYOUT_KEY = 'admira_expert_layout_v1';
  const HISTORY_KEY = 'admira_expert_history_v1';
  const DEFAULT_WEIGHTS = {cli: 44, verbos: 28, rutinas: 28};
  const LABELS = {cli: ['CLI', 'CLI'], verbos: ['Verbos', 'Verbs'], rutinas: ['Rutinas', 'Routines']};

  function normalizeLayout(raw) {
    const order = Array.isArray(raw && raw.order) ? [...new Set(raw.order.filter(id => IDS.includes(id)))] : [];
    return {
      order: [...order, ...IDS.filter(id => !order.includes(id))],
      hidden: IDS.filter(id => Array.isArray(raw && raw.hidden) && raw.hidden.includes(id)),
      weights: Object.fromEntries(IDS.map(id => {
        const w = raw && raw.weights && raw.weights[id];
        return [id, Number.isFinite(w) && w > 0 ? Math.min(100, Math.max(0.01, w)) : DEFAULT_WEIGHTS[id]];
      })),
    };
  }
  // Reparte el ancho de dos vecinos visibles conservando su suma.
  function resizePair(weights, left, right, fraction) {
    const share = Math.max(0.15, Math.min(0.85, fraction));
    const total = weights[left] + weights[right];
    return Object.assign({}, weights, {[left]: total * share, [right]: total * (1 - share)});
  }
  function moveModule(order, id, target) {
    const next = order.slice();
    if (!next.includes(id) || !next.includes(target)) return next;
    const from = next.indexOf(id), to = next.indexOf(target);
    next.splice(from, 1); next.splice(to, 0, id);
    return next;
  }
  function loadLayout(storage) {
    try { const raw = storage.getItem(LAYOUT_KEY); return normalizeLayout(raw ? JSON.parse(raw) : null); } catch (_) { return normalizeLayout(null); }
  }
  function saveLayout(storage, state) {
    try { storage.setItem(LAYOUT_KEY, JSON.stringify(normalizeLayout(state))); return true; } catch (_) { return false; }
  }

  const api = {IDS, LAYOUT_KEY, HISTORY_KEY, DEFAULT_WEIGHTS, normalizeLayout, resizePair, moveModule, loadLayout, saveLayout};
  root.AdmiraExpertLayout = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const panel = document.getElementById('expert-panel');
  const row = panel && panel.querySelector('.expert-blocks');
  const C = root.AdmiraExpertCommands;
  if (!row || !C || row.dataset.layoutReady) return;
  row.dataset.layoutReady = 'true';

  // Fuera de la portada (páginas con galaxy-shell.js) no hay mapa: los verbos de
  // mapa se traspasan a la portada, que los ejecuta al cargar (FLT-101311).
  const shell = root.AdmiraShell;
  const away = !!(shell && shell.away && typeof shell.handoff === 'function');
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'es');
  const T = (es, en) => (lang() === 'en' ? en : es);
  const store = (() => { try { return root.localStorage; } catch (_) { return null; } })() || {getItem: () => null, setItem() {}};
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const btn = (cls, text) => { const b = el('button', cls, text); b.type = 'button'; return b; };

  // ─── Bloques: cabecera, asa, cierre y redimensionado por pares ───
  let state = loadLayout(store);
  const save = () => saveLayout(store, state);
  const menu = panel.querySelector('.expert-layout-menu');
  const menuToggle = menu.querySelector('summary');
  const tools = menu.querySelector('.expert-layout-tools');
  document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.open = false; });
  menu.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); menu.open = false; menuToggle.focus(); } });
  const modules = {}, toggles = {};
  for (const id of IDS) {
    const module = row.querySelector(`[data-module="${id}"]`);
    const head = el('div', 'expert-module-head');
    const grip = btn('expert-module-grip');
    const close = btn('expert-module-close', '×');
    head.append(grip, close);
    module.prepend(head);
    const handle = el('div', 'expert-module-resizer'); handle.tabIndex = 0;
    handle.setAttribute('role', 'separator'); handle.setAttribute('aria-orientation', 'vertical');
    module.append(handle);
    const toggle = btn('');
    tools.append(toggle);
    modules[id] = {module, grip, close, handle};
    toggles[id] = toggle;
    close.addEventListener('click', () => { state.hidden.push(id); render(); save(); menuToggle.focus(); });
    toggle.addEventListener('click', () => { state.hidden = state.hidden.filter(x => x !== id); render(); save(); menu.open = false; grip.focus(); });
    const neighbour = () => { const visible = state.order.filter(x => !state.hidden.includes(x)); return visible[visible.indexOf(id) + 1]; };
    let resizing = null;
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !neighbour()) return;
      const next = neighbour(), a = module.getBoundingClientRect(), b = modules[next].module.getBoundingClientRect();
      resizing = {next, x: e.clientX, width: a.width, total: a.width + b.width, weights: Object.assign({}, state.weights)};
      handle.setPointerCapture(e.pointerId); e.preventDefault();
    });
    handle.addEventListener('pointermove', e => {
      if (!resizing) return;
      state.weights = resizePair(resizing.weights, id, resizing.next, (resizing.width + e.clientX - resizing.x) / resizing.total);
      render(false);
    });
    const stopResize = () => { if (resizing) { resizing = null; save(); } };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(type, stopResize);
    handle.addEventListener('keydown', e => {
      const next = neighbour(); if (!next || !['ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)) return;
      e.preventDefault();
      const fraction = state.weights[id] / (state.weights[id] + state.weights[next]);
      state.weights = resizePair(state.weights, id, next, e.key === 'Home' ? 0.5 : fraction + (e.key === 'ArrowRight' ? 0.05 : -0.05));
      render(false); save();
    });
    handle.addEventListener('dblclick', () => { const next = neighbour(); if (next) { state.weights = resizePair(state.weights, id, next, 0.5); render(false); save(); } });
    let moving = null;
    grip.addEventListener('pointerdown', e => { if (e.button === 0) { moving = {x: e.clientX, y: e.clientY}; grip.setPointerCapture(e.pointerId); } });
    grip.addEventListener('pointerup', e => {
      if (!moving) return;
      const moved = Math.abs(e.clientX - moving.x) + Math.abs(e.clientY - moving.y) > 6;
      moving = null;
      if (!moved) return;
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.expert-module')?.dataset.module;
      if (target && target !== id) { state.order = moveModule(state.order, id, target); render(); save(); grip.focus(); }
    });
    grip.addEventListener('pointercancel', () => { moving = null; });
    grip.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const visible = state.order.filter(x => !state.hidden.includes(x));
      const target = visible[visible.indexOf(id) + (e.key === 'ArrowLeft' ? -1 : 1)];
      if (target) { state.order = moveModule(state.order, id, target); render(); save(); grip.focus(); }
    });
  }
  const reset = btn('expert-layout-reset');
  reset.addEventListener('click', () => { state = normalizeLayout(null); render(); save(); menu.open = false; menuToggle.focus(); });
  tools.append(reset);

  function render(reorder = true) {
    const visible = state.order.filter(id => !state.hidden.includes(id));
    row.classList.toggle('expert-blocks-empty', !visible.length);
    for (const id of state.order) {
      const {module, handle} = modules[id];
      if (reorder) row.append(module);
      module.hidden = state.hidden.includes(id);
      toggles[id].hidden = !module.hidden;
      module.style.flexGrow = String(state.weights[id]);
      const next = visible[visible.indexOf(id) + 1];
      handle.hidden = module.hidden || !next;
      handle.setAttribute('aria-valuemin', '15'); handle.setAttribute('aria-valuemax', '85');
      handle.setAttribute('aria-valuenow', next ? String(Math.round(100 * state.weights[id] / (state.weights[id] + state.weights[next]))) : '50');
    }
  }

  // ─── CLI: salida, historial y autocompletado ───
  const form = document.getElementById('expert-command-form');
  const input = document.getElementById('expert-command');
  const log = document.getElementById('expert-command-result');
  const hint = panel.querySelector('.expert-hint');
  let history = [];
  try { history = JSON.parse(store.getItem(HISTORY_KEY) || '[]').filter(x => typeof x === 'string').slice(-30); } catch (_) {}
  let cursor = history.length, lastOk = '';
  function print(command, lines, ok) {
    const item = el('li', ok ? 'ok' : 'error');
    if (command) item.append(el('code', 'expert-log-cmd', '› ' + command));
    for (const line of lines) item.append(el('div', /^[A-ZÁÉÍÓÚ ]+$/.test(line) ? 'expert-log-title' : 'expert-log-line', line));
    log.append(item);
    while (log.children.length > 40) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  const ctx = {
    demo(cliente) {
      if (!root.AdmiraDemo) return {ok: false, reason: 'loading'};
      const r = cliente ? root.AdmiraDemo.start({cliente}) : root.AdmiraDemo.start();
      return r || {ok: true};
    },
    circuit(circuitId) {
      const panelEl = document.getElementById('circuit-panel'), select = document.getElementById('circuit-select');
      const scope = document.getElementById('circuit-scope-select');
      if (!panelEl || !select) return {ok: false, reason: 'not_ready'};
      if (panelEl.hidden) document.getElementById('header-circuit-btn')?.click();
      if (![...select.options].some(o => o.value === circuitId) && scope) { scope.value = 'all'; scope.dispatchEvent(new Event('change')); }
      if (![...select.options].some(o => o.value === circuitId)) return {ok: false, reason: 'not_ready'};
      select.value = circuitId; select.dispatchEvent(new Event('change'));
      document.getElementById('circuit-select-all')?.click();
      const count = document.querySelectorAll('#circuit-list input[type="checkbox"]:checked').length;
      let total = count;
      try { total = (circuitDefinitions()[circuitId] || {}).items.length; } catch (_) {}
      if (!total) return {ok: false, reason: 'empty'};
      document.getElementById('circuit-zoom')?.click();
      return {ok: true, count: total};
    },
    // /vision general (FLT-102501): circuito seleccionado y su semáforo desde arriba.
    vision(circuitId) {
      const r = ctx.circuit(circuitId);
      if (r.ok === false) return r;
      try { return startVisionGeneral(circuitId); } catch (_) { return {ok: false, reason: 'not_ready'}; }
    },
    // /demo dooh (FLT-102469): circuito seleccionado y su Tour DooH; global si lo tiene (Alsea México).
    dooh(circuitId) {
      const r = ctx.circuit(circuitId);
      if (r.ok === false) return r;
      try { startCircuitDemo(); } catch (_) { return {ok: false, reason: 'not_ready'}; }
      let global = false;
      try { global = !!globalTour; } catch (_) {}
      return {ok: true, count: r.count, global};
    },
    search(text) {
      const search = document.getElementById('search');
      if (!search) return {ok: false};
      search.value = text;
      search.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
      return {ok: true};
    },
    stop() {
      try { root.AdmiraDemo && root.AdmiraDemo.stop(); } catch (_) {}
      try { stopMapNavigation(); } catch (_) {}
      try { stopVisionGeneral(); } catch (_) {}
    },
    clear() { log.replaceChildren(); },
    routines: () => allRoutines(),
    // /redistribucion (FLT-102063): el Xpacio de la ficha abierta en la portada y la navegación al plano.
    location() {
      try { return typeof activeLocation !== 'undefined' && activeLocation ? {id: activeLocation.id, name: activeLocation.name} : null; } catch (_) { return null; }
    },
    open(url) { try { root.location.assign(url); return {ok: true}; } catch (_) { return {ok: false}; } },
    // Marca blanca (marca-blanca.js): se lee al ejecutar porque puede cargar después que este panel.
    get marca() { return root.AdmiraMarca || null; },
  };
  if (away) {
    ctx.handoff = command => shell.handoff(command);
    ctx.stop = () => {};
  }
  function record(text, result, echo = true) {
    if (!result.cleared) print(echo ? text : '', result.lines, result.ok);
    const keep = () => result.ok && result.parsed.verb.id !== 'limpiar' && result.parsed.verb.id !== 'help' && !result.parsed.verb.local;
    // Órdenes con respuesta diferida (/marca habla con admiranext.com): el resultado llega después.
    if (result.later && typeof result.later.then === 'function') {
      result.later.then(final => {
        print('', final.lines || [], !!final.ok);
        if (final.ok && keep()) { lastOk = result.command; renderRoutines(); }
      }, () => print('', [T('La orden no pudo terminar.', 'The command could not finish.')], false));
    } else if (keep()) lastOk = result.command;
    if (history[history.length - 1] !== text) { history.push(text); history = history.slice(-30); try { store.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (_) {} }
    cursor = history.length;
    renderRoutines();
    return result;
  }
  function suiteAction(engine,def){
    const attrs=(def.attributes||[]).map(id=>Object.assign({},C.ATTRIBUTES[id],{key:id,required:(def.requires||[]).includes(id),normalize:value=>{if(C.ATTRIBUTES[id].values){const client=C.resolveClient(value);if(!client)throw Error('Cliente no reconocido: '+value);return client.id;}if(C.ATTRIBUTES[id].brands){const brand=C.parseBrand(value);if(!brand)throw Error('Marca no válida');return brand;}return value;}}));
    const action={name:def.id,alias:def.aliases||[],desc:[def.es||def.id,def.en||def.es||def.id],attributes:attrs,run:(args,output,command)=>{
      const parsed={ok:true,verb:def,args,raw:command.raw,command:command.raw};
      let result;if(def.map&&away){ctx.handoff(command.raw);result={ok:true,lines:['Abriendo mapa…']};}else result=def.run(args,ctx,lang())||{ok:true,lines:[]};
      return record(command.raw,Object.assign({},result,{parsed,command:command.raw}),false);
    }};
    if(def.id==='demo'){
      const dooh=args=>{const result=C.demoDooh(args.join(' '),ctx,lang());return record(result.command,Object.assign({parsed:{ok:result.ok,verb:{id:'demo',local:true},args:{},raw:result.command}},result),false);};
      engine.registerAdapter({id:'biz-map-demo',demos:[{name:'mapa',run:(args,output)=>action.run({cliente:args.join(' ')},output,{raw:'/demo mapa '+args.join(' ')})},{name:'dooh',run:dooh}].concat(C.CLIENTS.map(client=>({name:client.id,run:(args,output)=>action.run({cliente:client.id},output,{raw:'/demo '+client.id})})))});
    }else engine.registerAdapter({id:'biz-action-'+def.id,verbs:[action]});
  }
  document.addEventListener('admira:verb-registered',event=>{if(root.AdmiraExperto)suiteAction(root.AdmiraExperto,event.detail);});
  // /vision general <cliente> como verbo propio de Biz en el motor común (sin atributos: recibe las palabras).
  function visionVerb(engine){
    const run=parts=>{const result=C.visionGeneral((Array.isArray(parts)?parts:[]).join(' '),ctx,lang());return record(result.command,Object.assign({parsed:{ok:result.ok,verb:{id:'vision',local:true},args:{},raw:result.command}},result),false);};
    engine.registerAdapter({id:'biz-vision',verbs:[{name:'vision',alias:['visión','visiongeneral','vision-general'],desc:['visión general del circuito con semáforo por Xpacio: /vision general alsea','circuit overview with a status light per Xpace: /vision general alsea'],run}]});
  }
  function connectSuiteCommands(engine){engine.registerAdapter({id:'biz'});C.VERBS.forEach(def=>suiteAction(engine,def));visionVerb(engine);}
  (root.AdmiraCommandAdapters=root.AdmiraCommandAdapters||[]).push(connectSuiteCommands);
  if(root.AdmiraExperto)connectSuiteCommands(root.AdmiraExperto);
  function run(command,{echo=true}={}){
    if(root.AdmiraExperto)return root.AdmiraExperto.exec(command,log,{echo});
    print('', ['Motor de comandos cargando. Inténtalo de nuevo.'],false);
  }
  function runPending(){let command;try{command=C.takePending(root.sessionStorage);}catch(_){}if(command){if(root.AdmiraExperto)run(command);else root.addEventListener('admira:commands-ready',()=>run(command),{once:true});}}
  if (!away) {
    if (document.readyState === 'complete') setTimeout(runPending, 0);
    else root.addEventListener('load', runPending, {once: true});
  }
  form.addEventListener('submit', e => { e.preventDefault(); const text = input.value; input.value = ''; run(text); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !e.shiftKey && input.value.trim()) {
      const {value, options} = C.complete(input.value);
      e.preventDefault();
      input.value = value;
      hint.textContent = options.length > 1 ? options.join(' · ') : hintText();
    } else if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault(); cursor = Math.max(0, cursor - 1); input.value = history[cursor] || '';
    } else if (e.key === 'ArrowDown' && history.length) {
      e.preventDefault(); cursor = Math.min(history.length, cursor + 1); input.value = history[cursor] || '';
    }
  });
  input.addEventListener('input', () => { hint.textContent = hintText(); });
  const hintText = () => T('Tab completa · ↑/↓ historial · /help ayuda', 'Tab completes · ↑/↓ history · /help for help');
  const fill = text => { input.value = text; input.focus(); input.setSelectionRange(text.length, text.length); };

  // ─── VERBOS: un botón por verbo con sus atributos ───
  const verbsList = document.getElementById('expert-verbs');
  function renderVerbs() {
    verbsList.replaceChildren();
    for (const verb of C.VERBS) {
      const li = el('li', 'expert-verb');
      const b = btn('expert-verb-btn', verb.command);
      b.title = verb.requires.length ? T('Escribe la orden en el CLI para completarla', 'Writes the command into the CLI to complete it') : T('Ejecutar', 'Run');
      b.addEventListener('click', () => (verb.requires.length ? fill(verb.command + ' ') : run(verb.command)));
      li.append(b, el('span', 'expert-verb-desc', T(verb.es, verb.en) + (away && verb.map ? T(' Se ejecuta en el mapa de la portada.', ' Runs on the home map.') : '')));
      for (const attrId of verb.attributes) {
        const attr = C.ATTRIBUTES[attrId];
        const line = el('div', 'expert-verb-attrs');
        line.append(el('span', 'expert-attr-name', `${T(attr.es, attr.en)}${verb.requires.includes(attrId) ? '' : T(' (opcional)', ' (optional)')}:`));
        if (attr.brands) {
          // Marcas del catálogo (semilla hasta que se lee el catálogo vivo) y «off».
          for (const b of [...C.brands(), {id: 'off', nombre: T('Volver a Admira', 'Back to Admira')}]) {
            const chip = btn('expert-chip', b.id);
            chip.title = b.nombre + (b.propuesta ? T(' · propuesta automática', ' · automatic proposal') : b.ejemplo ? T(' · ejemplo ficticio', ' · fictional sample') : '');
            chip.addEventListener('click', () => run(`${verb.command} ${b.id}`));
            line.append(chip);
          }
          line.append(el('span', 'expert-attr-more', T('o una web para analizarla', 'or a website to analyse it')));
        } else if (attr.values) {
          for (const c of attr.values.filter(c => c.featured)) {
            const chip = btn('expert-chip', c.id);
            chip.title = `${T(c.es, c.en)} · ${c.circuit}`;
            chip.addEventListener('click', () => fill(`${verb.command} ${c.id}`));
            line.append(chip);
          }
          line.append(el('span', 'expert-attr-more', T(`+${attr.values.length - attr.values.filter(c => c.featured).length} más con Tab`, `+${attr.values.length - attr.values.filter(c => c.featured).length} more with Tab`)));
        } else line.append(el('span', 'expert-attr-more', T('texto libre', 'free text')));
        li.append(line);
      }
      verbsList.append(li);
    }
  }

  // ─── RUTINAS: verbo + atributo listos para un clic, y las propias ───
  const routinesList = document.getElementById('expert-routines');
  const saveBtn = document.getElementById('expert-save-routine');
  let mine = C.loadRoutines(store);
  const allRoutines = () => [...C.defaultRoutines(lang()), ...mine];
  function renderRoutines() {
    routinesList.replaceChildren();
    const group = (title, list) => {
      if (!list.length) return;
      routinesList.append(el('li', 'expert-routine-group', title));
      for (const r of list) {
        const li = el('li', 'expert-routine' + (r.builtin ? '' : ' mine'));
        const b = btn('expert-routine-btn');
        b.append(el('span', 'expert-routine-label', r.label), el('code', '', r.command));
        b.addEventListener('click', () => run(r.command));
        li.append(b);
        if (!r.builtin) {
          const del = btn('expert-routine-del', '×');
          del.setAttribute('aria-label', T('Borrar rutina ', 'Delete routine ') + r.label);
          del.title = del.getAttribute('aria-label');
          del.addEventListener('click', () => { mine = C.removeRoutine(mine, r.id); C.saveRoutines(store, mine); renderRoutines(); saveBtn.focus(); });
          li.append(del);
        }
        routinesList.append(li);
      }
    };
    group(T('Mis rutinas', 'My routines'), mine);
    group(T('Rutinas del registro', 'Registry routines'), C.defaultRoutines(lang()));
    const can = !!lastOk && !mine.some(r => r.command === lastOk);
    saveBtn.disabled = !can;
    saveBtn.textContent = '＋ ' + T('Guardar última orden', 'Save last command') + (lastOk ? ` · ${lastOk}` : '');
  }
  saveBtn.addEventListener('click', () => {
    const added = C.addRoutine(mine, lastOk);
    if (!added.ok) return;
    mine = added.list; C.saveRoutines(store, mine); renderRoutines();
  });

  function translate() {
    for (const id of IDS) {
      const name = LABELS[id][lang() === 'en' ? 1 : 0];
      const {module, grip, close, handle} = modules[id];
      module.setAttribute('aria-label', name);
      grip.textContent = '⠿ ' + name.toUpperCase();
      grip.title = T('Mover ', 'Move ') + name + T(' · arrastra o usa ←/→', ' · drag or use ←/→');
      grip.setAttribute('aria-label', grip.title);
      close.title = T('Cerrar ', 'Close ') + name; close.setAttribute('aria-label', close.title);
      handle.setAttribute('aria-label', T('Redimensionar ', 'Resize ') + name);
      handle.title = T('Arrastra para ajustar el ancho · flechas · doble clic para igualar', 'Drag to adjust width · arrow keys · double-click to even out');
      toggles[id].textContent = '+ ' + name.toUpperCase();
      toggles[id].setAttribute('aria-label', T('Mostrar ', 'Show ') + name);
    }
    reset.textContent = '↺ ' + T('RESTAURAR', 'RESET');
    reset.setAttribute('aria-label', T('Restaurar los tres bloques', 'Restore the three blocks'));
    menuToggle.title = T('Restaurar o mostrar bloques', 'Restore or show blocks');
    menuToggle.setAttribute('aria-label', menuToggle.title);
    tools.setAttribute('aria-label', T('Bloques del modo experto', 'Expert mode blocks'));
    input.setAttribute('aria-label', T('Orden del modo experto', 'Expert mode command'));
    input.placeholder = T('/demo starbucks', '/demo starbucks');
    log.dataset.empty = T('Escribe /help para ver verbos, atributos y rutinas.', 'Type /help to see verbs, attributes and routines.');
    hint.textContent = hintText();
    renderVerbs(); renderRoutines();
  }
  new MutationObserver(translate).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
  // El catálogo de marcas llega de admiranext.com solo cuando se usa: se repintan los chips.
  document.addEventListener('admira:marcas', e => { if (C.setBrands && e.detail) C.setBrands(e.detail.marcas); renderVerbs(); });
  render(); translate();
  root.AdmiraExpert = Object.freeze({run, layout: () => normalizeLayout(state)});
  // ?ax_cmd=demo-dooh-alsea (FLT-102469): cuando el motor, el catálogo del circuito y el mapa están
  // listos, abre el modo experto y envía la orden por el mismo formulario que si se tecleara.
  const linked = !away && C.linkedCommand ? C.linkedCommand(root.location && root.location.search) : null;
  if (linked) {
    let tries = 0;
    const tick = () => {
      let ready = false;
      try {
        const client = C.resolveDoohClient(linked.split(' ').slice(2).join(' '));  // «/demo dooh X» y «/vision general X»
        ready = !!(root.AdmiraExperto && client && (circuitDefinitions()[client.circuit] || {items: []}).items.length && map.getSource('locs'));
      } catch (_) {}
      if (!ready) { if (++tries < 120) setTimeout(tick, 500); return; }
      try { root.AdmiraExperto.open(); } catch (_) {}
      setTimeout(() => { input.value = linked; if (form.requestSubmit) form.requestSubmit(); else run(input.value); }, 700);
    };
    setTimeout(tick, 800);
  }
})(typeof window === 'undefined' ? globalThis : window);

;(function(){if(typeof document!=='undefined'&&!document.querySelector('script[src*="/suite/experto.js"]')){var s=document.createElement("script");s.src="https://www.admiranext.com/suite/experto.js?v=20261014-personajes-3";document.head.appendChild(s);}})();
