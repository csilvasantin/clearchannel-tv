// Supervisor en vivo en el banco de Bugito (Morfeo, 18-oct-2026): Bugito rompe el MBP16 y aquí se ve, sin salir
// de admira.biz, lo que ve la Insta360 del MacMini: su última foto publicada, el estado de la pantalla, la
// incidencia abierta y, tras cada orden física, si el Supervisor lo vio o no. Sólo lee api.yokup.com/supervisor.
import {leerSupervisor, veredicto, textoEstado, textoEdad, textoVeredicto, SUPERVISOR_WEB, OBJETIVO}
  from './supervisor-core.mjs?v=20261018-supervisor-1';
import * as nucleo from './supervisor-core.mjs?v=20261018-supervisor-1';

// La cara del Supervisor en su tarjeta (Morfeo, 18-oct-2026): la cuarta piel de Admirito (digitalavatar.ai#43), con
// gorra de vigilante y ojo de cámara, junto a lo que ve la Insta360, para que Bugito y el Supervisor se vean en la misma
// pantalla. Contrato publicado: https://www.admiranext.com/mcp/SUPERVISOR.md. La cara no lee el tablero: sabe lo que le
// cuenta este banco, y sólo se le habla a su iframe y al origen exacto, nunca a '*'.
export const CARA_ORIGEN = 'https://digitalavatar.ai';
const INC = /^INC-[A-Z0-9]{3,16}$/;
export function caraSupervisorUrl(lang) {
  const u = new URL('/nube.html', CARA_ORIGEN);
  u.searchParams.set('personaje', 'supervisor');
  u.searchParams.set('embed', '1');
  u.searchParams.set('audio', 'off');
  u.searchParams.set('lang', lang === 'en' ? 'en' : 'es');
  return u.href;
}
// Qué se le cuenta: el veredicto de la orden de Bugito si lo hay o la lectura del tablero, con sus estados tal cual
// (la cara los traduce a los suyos: vigilando, enfocando, alerta, conforme, dudando…). ticket sólo con una INC- válida.
export function mensajeCara({lectura = null, veredicto: v = null, lang = 'es'} = {}) {
  const L = lang === 'en' ? 'en' : 'es';
  if (v && v.estado && v.estado !== 'desconocido') {
    const m = {type: 'da-supervisor', estado: v.estado, texto: textoVeredicto(v, L).slice(0, 240), lang: L};
    if (v.espera) m.espera = v.espera;
    if (v.incidencia && INC.test(String(v.incidencia.id))) m.ticket = v.incidencia.id;
    return m;
  }
  if (!lectura) return null;
  const m = {type: 'da-supervisor', estado: lectura.estado, lang: L};
  const abierta = lectura.abiertas && lectura.abiertas[0];
  if (abierta && INC.test(String(abierta.id))) m.ticket = abierta.id;
  return m;
}
export function esDeCara(ev, ventana) {
  return !!(ev && ventana && ev.source === ventana && ev.origin === CARA_ORIGEN && ev.data && typeof ev.data === 'object');
}
// Las dos órdenes de la cara son las del verbo común de la suite; cualquier otra cosa no ejecuta nada.
export function ordenCara(d) {
  if (!d || d.type !== 'da-supervisor-orden') return '';
  return d.orden === 'estado' ? '/supervisor estado' : d.orden === 'camara' ? '/supervisor' : '';
}
// Un veredicto fijado sigue en la cara mientras el tablero no cambie; si cambia, manda lo que ve ahora.
const firmaTablero = l => (l ? l.estado + '|' + ((l.abiertas && l.abiertas[0] && l.abiertas[0].id) || '') : '');

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
  ficha: ['Ver la ficha', 'Open the ticket'],
  cara: ['Cara del Supervisor: Admirito con gorra de vigilante y ojo de cámara', 'Supervisor face: Admirito with a security cap and a camera eye']
};

export function montarSupervisor(doc = document, {fetcher = (...a) => fetch(...a), ahora = () => Date.now(), cada = 5000, win = window} = {}) {
  const $ = id => doc.getElementById(id);
  const tarjeta = $('bb-supervisor');
  if (!tarjeta) return null;
  const lang = () => (doc.documentElement.lang === 'en' ? 'en' : 'es');
  const T = k => TEXTOS[k][lang() === 'en' ? 1 : 0];
  let lectura = null, orden = null, final = null, timer = null, enCurso = null, parado = false;
  const cara = $('bb-sv-cara-frame');
  let caraLista = false, ultimoCara = '', finalFirma = '';

  // Sólo cuando la cara ya escucha, y sin repetir lo mismo cada 5 s: con forzar la frase se vuelve a decir; si la
  // cara se recarga (da-supervisor-listo otra vez) y no hay nada nuevo, se le pone al día en silencio.
  function avisarCara({forzar = false, listo = false} = {}) {
    const w = cara && cara.contentWindow;
    if (!w || !caraLista) return;
    const v = orden ? veredicto({...orden, lectura, ahora: ahora()}) : (final && firmaTablero(lectura) === finalFirma ? final : null);
    const m = mensajeCara({lectura, veredicto: v, lang: lang()});
    if (!m) return;
    const firma = JSON.stringify(m);
    if (firma === ultimoCara && !forzar && !listo) return;
    const envio = listo && firma === ultimoCara ? {...m, silencio: true} : m;
    ultimoCara = firma;
    try { w.postMessage(envio, CARA_ORIGEN); } catch { /* la cara no está */ }
  }
  // «¿Qué ves?» o «Abre la cámara» en la cara: lo atiende el verbo común de la suite, como si se escribiera en el ⌘.
  function ordenar(texto) {
    const correr = E => {
      try { E.open && E.open(); } catch { /* el panel ya está */ }
      return Promise.resolve(E.exec(texto)).then(r => {
        // Tras el parte, la cara (que se quedó enfocando) dice lo que ve ahora.
        if (texto === '/supervisor estado') return refrescar().then(() => { avisarCara({forzar: true}); return r; });
        return r;
      });
    };
    const E = win.AdmiraExperto;
    if (E && typeof E.exec === 'function') return correr(E);
    return new Promise(res => win.addEventListener('admira:commands-ready', () => {
      const listo = win.AdmiraExperto;
      res(listo && typeof listo.exec === 'function' ? correr(listo) : null);
    }, {once: true}));
  }
  function alMensaje(ev) {
    if (!cara || !esDeCara(ev, cara.contentWindow)) return;
    const d = ev.data;
    if (d.type === 'da-supervisor-listo') { caraLista = true; avisarCara({listo: true}); return; }
    const texto = ordenCara(d);
    if (texto) ordenar(texto);
  }

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
    if (cara) cara.title = T('cara');
    avisarCara();
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
        if (!/^esperando/.test(v.estado)) { final = v; orden = null; finalFirma = firmaTablero(lectura); }
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
  win.addEventListener('message', alMensaje);
  doc.addEventListener('visibilitychange', programar);
  doc.addEventListener('admira:lang', pintar);
  $('bb-sv-web').href = SUPERVISOR_WEB;
  if (cara) {
    cara.addEventListener('load', () => {
      // da-context fija este banco como anfitrión de confianza aunque la cara llegue sin referrer.
      caraLista = true;
      try { cara.contentWindow.postMessage({type: 'da-context', lang: lang()}, CARA_ORIGEN); } catch { /* sin cara */ }
      avisarCara({listo: true});
    });
    cara.src = caraSupervisorUrl(lang());
  }
  pintar();
  programar();
  return {
    refrescar, alEnviar, ordenar,
    estado: () => ({lectura, orden, final, caraLista}),
    parar() {
      parado = true; clearInterval(timer);
      win.removeEventListener('bugito:command-queued', alEnviar); win.removeEventListener('message', alMensaje);
    }
  };
}

if (typeof document !== 'undefined' && document.getElementById('bb-supervisor')) {
  // La suite (/supervisor estado) usa este mismo lector si ya está en la página, sin volver a cargarlo.
  window.AdmiraSupervisorCore ||= nucleo;
  window.AdmiraSupervisor = montarSupervisor();
}
