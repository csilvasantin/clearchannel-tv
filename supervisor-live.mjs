// Supervisor en vivo en el banco de Bugito (Morfeo, 18-oct-2026): Bugito rompe el MBP16 y aquí se ve, sin salir
// de admira.biz, lo que ve la Insta360 del MacMini: su última foto publicada, el estado de la pantalla, la
// incidencia abierta y, tras cada orden física, si el Supervisor lo vio o no. Sólo lee api.yokup.com/supervisor.
import {leerSupervisor, veredicto, textoEstado, textoEdad, textoVeredicto, SUPERVISOR_WEB, OBJETIVO}
  from './supervisor-core.mjs?v=20261018-supervisor-1';

const TEXTOS = {
  titulo: ['Supervisor · lo que ve la cámara', 'Supervisor · what the camera sees'],
  abrir: ['Abrir el Supervisor', 'Open Supervisor'],
  objetivo: [`${OBJETIVO.nombre} · ${OBJETIVO.ci} · Insta360 del MacMini`, `${OBJETIVO.nombre} · ${OBJETIVO.ci} · Mac mini Insta360`],
  pie: ['Última foto publicada · sólo el recorte de la pantalla', 'Latest published photo · screen crop only'],
  nota: ['La cámara ve si la pantalla luce o está a oscuras; giro, popup, lienzo y recorte los mide el reproductor y el Supervisor los registra como incidencia. Recuperar la emisión no cierra la incidencia.',
    'The camera sees whether the screen is lit or dark; rotation, popup, canvas and crop are measured by the player and Supervisor records them as an incident. Restoring playback does not close the incident.'],
  ir: ['Ver qué ve el Supervisor', 'See what Supervisor sees'],
  leyendo: ['Leyendo…', 'Reading…'],
  ninguna: ['Sin incidencias abiertas en el MBP16.', 'No open incidents on the MBP16.'],
  abierta: ['Incidencia abierta', 'Open incident'],
  desde: ['desde', 'since'],
  ficha: ['Ver la ficha', 'Open the ticket']
};

export function montarSupervisor(doc = document, {fetcher = (...a) => fetch(...a), ahora = () => Date.now(), cada = 5000, win = window} = {}) {
  const $ = id => doc.getElementById(id);
  const tarjeta = $('bb-supervisor');
  if (!tarjeta) return null;
  const lang = () => (doc.documentElement.lang === 'en' ? 'en' : 'es');
  const T = k => TEXTOS[k][lang() === 'en' ? 1 : 0];
  let lectura = null, orden = null, final = null, timer = null, enCurso = null, parado = false;

  function enlace(href, texto) {
    const a = doc.createElement('a');
    a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = texto;
    return a;
  }
  function pintar() {
    const L = lang();
    for (const el of doc.querySelectorAll('[data-sv]')) if (TEXTOS[el.dataset.sv]) el.textContent = T(el.dataset.sv);
    const chip = $('bb-sv-estado');
    chip.dataset.estado = lectura ? lectura.estado : 'leyendo';
    chip.textContent = lectura ? textoEstado(lectura.estado, L) : T('leyendo');
    const img = $('bb-sv-img');
    if (lectura && lectura.foto) {
      if (img.getAttribute('src') !== lectura.foto) img.setAttribute('src', lectura.foto);
      img.alt = T('pie'); img.hidden = false; img.dataset.vieja = lectura.fresco ? '' : '1';
    } else img.hidden = true;
    const edad = lectura ? textoEdad(lectura.edadMs, L) : '';
    $('bb-sv-lectura').textContent = !lectura ? '' : lectura.fresco
      ? (L === 'en' ? 'Read ' : 'Lectura ') + edad + (lectura.ciclo != null ? (L === 'en' ? ' · cycle ' : ' · ciclo ') + lectura.ciclo : '')
      : (edad ? (L === 'en' ? 'Last board published ' : 'Último tablero publicado ') + edad : (L === 'en' ? 'The Supervisor board does not answer.' : 'El tablero del Supervisor no responde.'));
    const lista = $('bb-sv-incidencias');
    lista.replaceChildren();
    if (lectura) {
      for (const i of lectura.abiertas) {
        const li = doc.createElement('li');
        li.append(T('abierta') + ': ', enlace(i.url, i.id));
        if (Number.isFinite(i.cuando)) li.append(' · ' + T('desde') + ' ' + new Date(i.cuando).toLocaleString(L === 'en' ? 'en-GB' : 'es-ES', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}));
        lista.append(li);
      }
      if (!lectura.abiertas.length && lectura.fresco) { const li = doc.createElement('li'); li.textContent = T('ninguna'); lista.append(li); }
    }
    const v = final || (orden && veredicto({...orden, lectura, ahora: ahora()}));
    const salida = $('bb-sv-veredicto');
    salida.replaceChildren();
    if (v) {
      salida.dataset.estado = v.estado;
      salida.append(textoVeredicto(v, L));
      if (v.incidencia) salida.append(' ', enlace(v.incidencia.url, T('ficha')));
    } else delete salida.dataset.estado;
  }
  // Una sola lectura a la vez: quien llama durante otra espera a esa misma.
  function refrescar() {
    if (parado) return Promise.resolve();
    if (enCurso) return enCurso;
    const control = typeof AbortController === 'function' ? new AbortController() : null;
    const corte = setTimeout(() => control && control.abort(), 6000);
    enCurso = leerSupervisor(fetcher, {ahora, signal: control && control.signal}).then(l => {
      lectura = l;
      if (orden) {
        const v = veredicto({...orden, lectura, ahora: ahora()});
        if (!/^esperando/.test(v.estado)) { final = v; orden = null; }
      }
      pintar();
    }).finally(() => { clearTimeout(corte); enCurso = null; });
    return enCurso;
  }
  function programar() {
    clearInterval(timer); timer = null;
    if (!parado && !doc.hidden) { timer = setInterval(refrescar, cada); refrescar(); }
  }
  // Cada orden física al MBP16 (bugito-command-ui.mjs y los botones de pantalla de bugito.mjs) abre un veredicto.
  async function alEnviar(ev) {
    const d = ev && ev.detail || {};
    const desde = Number.isFinite(d.after) ? d.after : ahora();
    const antes = lectura || await leerSupervisor(fetcher, {ahora});
    orden = {fault: d.fault, antes, desde};
    final = null;
    pintar();
    tarjeta.scrollIntoView?.({block: 'nearest', behavior: 'smooth'});
  }
  win.addEventListener('bugito:command-queued', alEnviar);
  doc.addEventListener('visibilitychange', programar);
  doc.addEventListener('admira:lang', pintar);
  $('bb-sv-web').href = SUPERVISOR_WEB;
  pintar();
  programar();
  return {
    refrescar, alEnviar,
    estado: () => ({lectura, orden, final}),
    parar() { parado = true; clearInterval(timer); win.removeEventListener('bugito:command-queued', alEnviar); }
  };
}

if (typeof document !== 'undefined' && document.getElementById('bb-supervisor')) window.AdmiraSupervisor = montarSupervisor();
