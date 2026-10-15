// Estudio del Arquitecto · admira.biz/arquitecto.html (DCL-66d9ae0d5e756d0067127f24).
// El Arquitecto (digitalavatar.ai/nube.html?personaje=arquitecto: Admirito con casco de obra) a la izquierda con sus
// tres órdenes; el plano en planta y alzado a la derecha. Lo puro vive en arquitecto-core.mjs (órdenes, intérprete de
// lo que se cuenta, reforma, CI y traspaso) y arquitecto-dibujo.mjs (SVG); aquí, la página.
//   · crear       → generarXpacio · «Usar este plano» lo guarda en este navegador (IndexedDB admira-planos, el mismo
//                   almacén de plano.html), así plano.html?locationId=<id> lo abre.
//   · reformar    → órdenes (lo contado + fotos/vídeo) aplicadas como Propuesta de obra (localStorage admira.plano.<id>,
//                   la misma clave que plano.html con ?modo=obra) y la orden de obra admira.orden-obra/1 en JSON.
//   · inventariar → /xpacio/estimar o la descripción → plano + CI ITIL editables → traspaso al Portal del comercio.
//   · crear · «Espacio por formato · Altadis 18» (DCL-d7966deb02734a6f34beb54e) → espacioDeFormato de espacios-formato.mjs:
//                   los 18 formatos de Altadis, cada uno en un Xtanco o un Starbucks, con su ficha, la galería «Los 18» y
//                   los enlaces al gemelo (admira.store) y a las adaptaciones (admira.studio). ?formato=cliente-NN&tipo=…
// /arquitecto del ⌘ Experto llega aquí por window.AdmiraArquitecto.
import { localeFor } from './walk-core.mjs?v=20261010-evidence-1';
import { exportOrder, workOrder, validate, round } from './plano-core.mjs?v=20261014-plano-1';
import { TIPOS, generarXpacio, medidasMedias, nuevaSemilla, resumenGenerado } from './plano-generador.mjs?v=20261014-foto-1';
import { registroSubida, almacenPlanos, comprobarSala, conTiempo, ESPERA_IDB, ID_RE } from './plano-subida.mjs?v=20261014-subir-1';
import {
  ORDENES, CATEGORIAS, MAX_ORDENES, parseOrden, parametros, tipoDe, leerDescripcion, medidasDe, interpretarReforma, reformaDesdeEstimacion, aplicarReforma,
  planDesdeEstimacion, planDesdeDescripcion, prefijoDe, construirCis, revisarCis, inventarioTraspaso, codificarTraspaso, urlPortal,
  caraUrl, baseLocal, ordenDeNube, CARA_ORIGEN, PREFIJO_RE, normalizarId
} from './arquitecto-core.mjs?v=20261015-altadis-1';
import { svgPlanta, svgAlzado, svgMiniatura } from './arquitecto-dibujo.mjs?v=20261015-altadis-1';
import {
  FORMATOS_ALTADIS, TIPOS_ESPACIO, ZONAS, MONTAJES, REQUISITOS, FISICO, tipoEspacio, formatoDe, zonaDe, celdas, espacioDeFormato, resumenEspacio, urlGemelo, urlStudio, urlArquitecto,
  parametrosEspacio, leerEspacio
} from './espacios-formato.mjs?v=20261015-altadis-1';
import { prepararFotos, estimar, urlEstimador, origenEstimador } from './arquitecto-fotos.mjs?v=20261014-arquitecto-1';

const $ = id => document.getElementById(id);
const textos = {
  es: {
    back: '← Plano y obras', eyebrow: 'Estudio del Arquitecto · Xpacios', title: 'Crear, reformar o inventariar',
    intro: 'El Arquitecto es Admirito con casco de obra: inventa Xpacios nuevos, reforma los que hay desde una foto, un vídeo o lo que le cuentes, y hace su inventario ITIL para darlo de alta en Yokup.',
    arquitecto: 'El Arquitecto', hide: 'Ocultar al Arquitecto', show: 'Mostrar al Arquitecto', caraTitle: 'El Arquitecto, Admirito con casco de obra', tabs: 'Órdenes del Arquitecto',
    crear: 'Crear', reformar: 'Reformar', inventariar: 'Inventariar',
    ayudaLead: '¿Qué hacemos? Pídemelo aquí, con el micro de la nube o en ⌘ Experto:',
    ayudaCrear: 'un Xpacio nuevo, inventado según el tipo (o con tus medidas)', ayudaReformar: 'una reforma del plano abierto desde una foto, un vídeo o lo que me cuentes, como propuesta de obra',
    ayudaInventariar: 'el plano y el inventario ITIL desde una foto, un vídeo o una descripción; al final, alta en Yokup',
    ayudaFormatos: 'los 18 espacios Altadis: cada formato de pantalla en un Xtanco o en un Starbucks',
    modoCrear: 'Qué crear', modoTipo: 'Xpacio por tipo', modoFormato: 'Espacio por formato · Altadis 18',
    formatosLead: 'Los 18 formatos de pantalla que pide Altadis, cada uno en su espacio tipo: un Xtanco o una cafetería Starbucks, para crear, adaptar y enseñar el contenido a su medida.',
    formato: 'Formato', espacio: 'Espacio', verGemelo: 'Ver gemelo ↗', crearContenido: 'Crear y adaptar contenido ↗', abrirPlano: 'Abrir en Plano y obras →', enlaceDirecto: 'Enlace directo',
    los18: 'Los 18', los18Hint: 'una celda por pantalla física', orient: { vertical: 'vertical', horizontal: 'horizontal' },
    fisica: r => r.forma ? `cubo LED de ${r.caras} caras de ${r.celda[0]}×${r.celda[1]} px (${fmt(r.panel.w, 3)} × ${fmt(r.panel.h, 3)} m cada una, paso ${dec(r.pasoPixelMm)} mm) sobre peana de ${fmt(r.peana)} m`
      : r.tecnologia === 'led' ? `LED de ${fmt(r.panel.w)} × ${fmt(r.panel.h)} m (paso ${dec(r.pasoPixelMm)} mm)`
      : `${r.pantallas} × LCD ${dec(r.pulgadas)}″ ${tr('orient')[r.orientacion]} de ${fmt(r.panel.w)} × ${fmt(r.panel.h)} m · celda ${r.celda[0]}×${r.celda[1]} px${r.pantallas > 1 ? ` · conjunto ${fmt(r.conjunto.w)} × ${fmt(r.conjunto.h)} m` : ''}`,
    ficha: (r, x) => `<strong>${esc(String(r.n).padStart(2, '0'))} · ${esc(r.nombre)}</strong> · ${r.ancho}×${r.alto} px · ${r.fps} fps · ${esc(x.tipo)}<ul>`
      + `<li><b>Rejilla</b> ${r.grid.cols}×${r.grid.rows} · ${r.pantallas} ${r.pantallas === 1 ? 'pantalla física' : 'pantallas físicas'}: ${esc(tr('fisica', r))}</li>`
      + `<li><b>Uso</b> ${esc(r.uso.es)} · <b>Zona</b> ${esc(ZONAS[r.zona].es)} (${esc(ZONAS[r.zona].regla.es)})</li>`
      + `<li><b>Montaje</b> ${esc(MONTAJES[r.montaje].es)} · pared ${esc(x.pared)} · base a ${fmt(r.base)} m</li>`
      + `<li><b>Sala</b> ${fmt(r.sala.ancho)} × ${fmt(r.sala.fondo)} m · ${fmt(r.sala.alto)} m de alto · plano tipo inventado</li>`
      + `<li>${esc(REQUISITOS.es)}${x.sincro.length ? ` · se emite sincronizado con ${esc(x.sincro.join(' o '))}, con la misma duración` : ''}</li>`
      + r.avisos.map(a => `<li class="arq-aviso">⚠ ${esc(a.es)}</li>`).join('') + '</ul>',
    abiertaFormatos: (f, t) => `Arquitecto: ${f} en ${t} (Espacio por formato · Altadis 18).`,
    formatoDesconocido: f => `No conozco ese formato: los de Altadis van del 01 al 18. Te enseño el ${f}.`,
    espacioFallo: (f, t) => `No he podido montar el ${f} en el ${t}. Prueba con el otro espacio o con otro formato.`,
    tipo: 'Tipo de Xpacio', ancho: 'Ancho', largo: 'Largo', alto: 'Alto', nombre: 'Nombre del Xpacio', crManual: 'Crear con estas medidas', crTotal: 'Creación total', usar: 'Usar este plano',
    fotos: 'Fotos o vídeo (opcional): cómo debe quedar o lo que falta en el plano', describe: 'Cuéntame la reforma', dictar: 'Dictar', proponer: 'Proponer reforma',
    rfPh: 'Añade un videowall 2x2 en la pared derecha, quita la pantalla 3 y gira las del fondo a vertical',
    guardarObra: 'Guardar como propuesta de obra', descargarObra: 'Descargar orden de obra (JSON)', abrirObra: 'Abrir en el plano (modo obra) →',
    fotosInv: 'Fotos o vídeo del local (hasta 8 fotos; de un vídeo saco fotogramas)', describeInv: 'O descríbelo',
    inPh: 'Cafetería de 8 por 12 m con tres pantallas verticales de 43″ en la pared del fondo, un videowall 2x2 a la derecha y dos cámaras',
    prefijo: 'Prefijo ITIL', usarAbierto: 'Inventariar el plano abierto', inventariarBtn: 'Inventariar', cis: 'Inventario ITIL propuesto', addCi: '+ CI',
    altaYokup: 'Dar de alta en Yokup →', descargarInv: 'Descargar inventario (JSON)',
    yokupNote: 'El alta la confirma el titular en el Portal del comercio de Yokup (admira.app/retailer): allí elige el establecimiento y ve lo que se va a crear. El inventario viaja en la propia dirección (#), sin pasar por ningún servidor.',
    plano: 'Plano', sinPlano: 'Todavía no hay plano: créalo o inventaríalo con el Arquitecto.', alzado: 'Alzado', plantaAria: 'Plano en planta', alzadoAria: 'Alzado de la pared',
    leyActual: 'actual', leyNueva: 'nueva o propuesta', leyRetirada: 'retirada',
    estados: { reposo: 'en reposo', escuchando: 'escuchando', midiendo: 'midiendo', dibujando: 'dibujando', entregando: 'entregando', dudando: 'dudando' },
    meta: (p, o) => `${p.nombre} · ${fmt(p.planta.ancho)} × ${fmt(p.planta.fondo)} m · ${fmt(p.planta.alto)} m de alto · ${o}`,
    origen: { creado: 'creado por el Arquitecto (sin guardar)', guardado: 'guardado en este navegador', publicado: 'publicado', inventario: 'inventario estimado (sin guardar)' },
    pantallas: n => `${n} ${n === 1 ? 'pantalla' : 'pantallas'}`,
    preview: r => `<strong>${esc(TIPOS[r.tipo][lang])} · ${fmt(r.m2, 1)} m²</strong> · ${fmt(r.ancho)} × ${fmt(r.largo)} × ${fmt(r.alto)} m · ${r.puertas} ${r.puertas === 1 ? 'puerta' : 'puertas'} · ${r.muebles} muebles · ${r.pantallas} pantallas en propuesta · semilla ${r.semilla}`,
    medidasMal: 'Revisa las medidas: ancho y largo entre 1 y 500 m, alto entre 2 y 30 m.',
    guardado: id => `Plano guardado en este navegador como «${id}». Ya lo puedes reformar o inventariar.`, noGuardado: 'Este navegador no deja guardar el plano: dura hasta recargar.',
    sobrescribir: id => `Ya hay un plano guardado en este navegador para «${id}». ¿Lo sustituyo?`,
    base: (p, o) => `Reforma sobre <strong>${esc(p.nombre)}</strong> (${esc(o)}) · ${p.pantallas.length} pantallas`,
    sinBase: 'Para reformar necesito un plano: inventaríalo o créalo primero.', sinBaseVoz: 'Para reformar necesito un plano: ¿lo inventariamos o lo creamos?',
    nadaQueProponer: 'Cuéntame la reforma o sube una foto o un vídeo.', fotosN: n => `${n} ${n === 1 ? 'fichero elegido' : 'ficheros elegidos'}`,
    preparando: 'Preparando las fotos…', estimando: 'Estimando con las fotos (puede tardar un minuto)…', estimarFallo: e => `No se pudo estimar con las fotos (${e}). Sigo con lo que me has contado.`,
    estimarFalloSolo: e => `No se pudo estimar con las fotos (${e}).`,
    op: {
      anadir: o => o.mosaico ? (o.mosaico.tipo === 'rejilla' ? `Añadir un videowall ${o.mosaico.filas}×${o.mosaico.cols} de ${o.pulgadas}″` : `Añadir un mosaico ${o.mosaico.tipo === 'mosaico-doble-h' ? 'doble H' : 'H'} de ${o.pulgadas}″`) : `Añadir ${o.cantidad} ${o.cantidad === 1 ? 'pantalla' : 'pantallas'} ${o.orientacion === 'vertical' ? (o.cantidad === 1 ? 'vertical' : 'verticales') : (o.cantidad === 1 ? 'horizontal' : 'horizontales')} de ${o.pulgadas}″`,
      retirar: o => `Retirar ${o.ids.length === 1 ? 'la pantalla' : o.ids.length + ' pantallas'} ${quien(o.ids)}`,
      mover: o => `Mover ${quien(o.ids)} a la pared ${pared(o.pared)}`,
      girar: o => `Girar ${quien(o.ids)}${o.orientacion ? ' a ' + o.orientacion : ''}`,
      tamano: o => `Cambiar ${quien(o.ids)} a ${o.pulgadas}″`
    },
    enPared: p => ` en la pared ${pared(p)}`,
    motivo: { demasiadas: 'demasiadas pantallas nuevas en una reforma (máx. 40)', 'no-cabe': 'no cabe sin solaparse ni tapar puertas', 'no-esta': 'esa pantalla ya no está', 'sin-cambio': 'ya estaba así', choca: 'choca con otra pantalla o un hueco' },
    otraPared: p => `no cabía donde dijiste: va en la pared ${pared(p)}`,
    duda: f => `No lo entiendo: «${f}»`, dudas: 'Prueba con «añade…», «quita…», «mueve … a la pared …», «gira…» o «cambia … a 55 pulgadas».',
    resumenObra: r => `<strong>Orden de obra</strong> · ${['alta', 'baja', 'modificacion', 'sustitucion', 'contenidos'].filter(k => r[k]).map(k => `${r[k]} ${{ alta: 'alta', baja: 'baja', modificacion: 'modificación', sustitucion: 'sustitución', contenidos: 'contenidos' }[k]}${r[k] > 1 && k !== 'contenidos' ? (k === 'modificacion' || k === 'sustitucion' ? 'es' : 's') : ''}`).join(' · ') || 'sin cambios'}`,
    tipos: { alta: 'Alta', baja: 'Baja', modificacion: 'Modificación', sustitucion: 'Sustitución', contenidos: 'Contenidos' },
    obraGuardada: id => `Propuesta de obra guardada en este navegador: ábrela en plano.html (modo obra) con «${id}».`, obraNoGuardada: 'No se pudo guardar la propuesta en este navegador.',
    obraPisa: '¿Sustituyo el borrador de propuesta de obra que ya había en este navegador para este plano?',
    noInventario: 'Sube fotos o un vídeo, descríbeme el local o marca «Inventariar el plano abierto».',
    invListo: (np, nc) => `Plano estimado con ${np} ${np === 1 ? 'pantalla' : 'pantallas'} y ${nc} CI propuestos. Revisa los códigos antes del alta.`,
    noCaben: n => `${n} ${n === 1 ? 'pantalla descrita no cabe' : 'pantallas descritas no caben'} en su pared.`,
    th: ['Código ITIL', 'Nombre', 'Categoría', 'Depende de', ''], sinPadre: '—', quitar: 'Quitar',
    err: { formato: 'código con formato no válido (PREFIJO-PAN-01)', repetido: 'código repetido', vacio: 'falta el nombre', categoria: 'categoría no válida', padre: 'depende de un CI que no está en la lista', ciclo: 'depende de sí mismo', demasiados: 'demasiados CI (máx. 200)' },
    fila: i => `Fila ${i + 1}: `, cisN: n => `${n} CI`, prefijoMal: 'El prefijo ITIL son de 2 a 12 mayúsculas o cifras.',
    traspasoOk: 'Abriendo el Portal del comercio de Yokup con el inventario: el titular elige el establecimiento y confirma el alta. Si no se abrió, usa el enlace.', abrirPortal: 'Abrir el Portal del comercio con el inventario ↗',
    traspasoGrande: 'El inventario es demasiado grande para la dirección: descárgalo y súbelo en el Portal del comercio («Importar inventario del Arquitecto»).',
    demasiadasOrdenes: n => `Como mucho ${n} órdenes por reforma: el resto, en otra.`,
    noCisValidos: 'Corrige los errores del inventario antes del alta.',
    vozCrear: 'Creo el Xpacio con lo que me has contado.', vozOrden: o => `Vamos con «${o}».`, pideFotos: 'Sube fotos o un vídeo del local, o cuéntame cómo es.', pideReforma: 'Cuéntame qué cambiamos o súbeme una foto de cómo debe quedar.',
    ayudaOrdenes: 'Arquitecto: /arquitecto crear [tipo] · /arquitecto formatos · /arquitecto reformar · /arquitecto inventariar', ordenDesconocida: x => `El Arquitecto no conoce «${x}». Prueba: crear, formatos, reformar o inventariar.`,
    abierta: o => `Arquitecto: orden «${o}» abierta en el estudio.`, ocultoMsg: 'Arquitecto oculto (vuelve con /arquitecto).', vistoMsg: 'Arquitecto a la vista.',
    dictadoNo: 'Este navegador no tiene dictado: escribe o usa el micro de la nube.', escuchando: 'Escuchando… (puedes corregir el texto)'
  },
  en: {
    back: '← Floor plan and works', eyebrow: 'Architect studio · Xpaces', title: 'Create, renovate or survey',
    intro: 'The Architect is Admirito in a hard hat: he invents new Xpaces, renovates existing ones from a photo, a video or what you tell him, and builds their ITIL inventory to register it in Yokup.',
    arquitecto: 'The Architect', hide: 'Hide the Architect', show: 'Show the Architect', caraTitle: 'The Architect, Admirito in a hard hat', tabs: 'Architect commands',
    crear: 'Create', reformar: 'Renovate', inventariar: 'Survey',
    ayudaLead: 'What shall we do? Ask me here, with the cloud\'s microphone or in ⌘ Expert:',
    ayudaCrear: 'a new Xpace, invented from its type (or with your measurements)', ayudaReformar: 'a renovation of the open plan from a photo, a video or what you tell me, as a works proposal',
    ayudaInventariar: 'the floor plan and ITIL inventory from a photo, a video or a description; then, registration in Yokup',
    ayudaFormatos: 'the 18 Altadis spaces: each screen format in a Xtanco or in a Starbucks',
    modoCrear: 'What to create', modoTipo: 'Xpace by type', modoFormato: 'Space by format · Altadis 18',
    formatosLead: 'The 18 screen formats Altadis asks for, each in its own typical space: a Xtanco or a Starbucks café, to create, adapt and show content made to measure.',
    formato: 'Format', espacio: 'Space', verGemelo: 'View digital twin ↗', crearContenido: 'Create and adapt content ↗', abrirPlano: 'Open in Floor plan and works →', enlaceDirecto: 'Direct link',
    los18: 'The 18', los18Hint: 'one cell per physical screen', orient: { vertical: 'portrait', horizontal: 'landscape' },
    fisica: r => r.forma ? `${r.caras}-sided LED cube, ${r.celda[0]}×${r.celda[1]} px per side (${fmt(r.panel.w, 3)} × ${fmt(r.panel.h, 3)} m each, ${dec(r.pasoPixelMm)} mm pitch) on a ${fmt(r.peana)} m plinth`
      : r.tecnologia === 'led' ? `LED of ${fmt(r.panel.w)} × ${fmt(r.panel.h)} m (${dec(r.pasoPixelMm)} mm pitch)`
      : `${r.pantallas} × ${dec(r.pulgadas)}″ ${tr('orient')[r.orientacion]} LCD of ${fmt(r.panel.w)} × ${fmt(r.panel.h)} m · ${r.celda[0]}×${r.celda[1]} px cell${r.pantallas > 1 ? ` · ${fmt(r.conjunto.w)} × ${fmt(r.conjunto.h)} m overall` : ''}`,
    ficha: (r, x) => `<strong>${esc(String(r.n).padStart(2, '0'))} · ${esc(r.nombre)}</strong> · ${r.ancho}×${r.alto} px · ${r.fps} fps · ${esc(x.tipo)}<ul>`
      + `<li><b>Grid</b> ${r.grid.cols}×${r.grid.rows} · ${r.pantallas} physical screen${r.pantallas === 1 ? '' : 's'}: ${esc(tr('fisica', r))}</li>`
      + `<li><b>Use</b> ${esc(r.uso.en)} · <b>Zone</b> ${esc(ZONAS[r.zona].en)} (${esc(ZONAS[r.zona].regla.en)})</li>`
      + `<li><b>Mounting</b> ${esc(MONTAJES[r.montaje].en)} · ${esc(x.pared)} wall · bottom at ${fmt(r.base)} m</li>`
      + `<li><b>Room</b> ${fmt(r.sala.ancho)} × ${fmt(r.sala.fondo)} m · ${fmt(r.sala.alto)} m high · invented typical plan</li>`
      + `<li>${esc(REQUISITOS.en)}${x.sincro.length ? ` · plays in sync with ${esc(x.sincro.join(' or '))}, at the same duration` : ''}</li>`
      + r.avisos.map(a => `<li class="arq-aviso">⚠ ${esc(a.en)}</li>`).join('') + '</ul>',
    abiertaFormatos: (f, t) => `Architect: ${f} in ${t} (Space by format · Altadis 18).`,
    formatoDesconocido: f => `I don't know that format: Altadis formats go from 01 to 18. Showing ${f}.`,
    espacioFallo: (f, t) => `I could not lay out ${f} in the ${t}. Try the other space or another format.`,
    tipo: 'Xpace type', ancho: 'Width', largo: 'Depth', alto: 'Height', nombre: 'Xpace name', crManual: 'Create with these measurements', crTotal: 'Full creation', usar: 'Use this plan',
    fotos: 'Photos or video (optional): how it should look or what the plan lacks', describe: 'Describe the renovation', dictar: 'Dictate', proponer: 'Propose renovation',
    rfPh: 'Add a 2x2 video wall on the right wall, remove screen 3 and turn the back ones to portrait',
    guardarObra: 'Save as works proposal', descargarObra: 'Download works order (JSON)', abrirObra: 'Open in the floor plan (works mode) →',
    fotosInv: 'Photos or video of the space (up to 8 photos; I take frames from a video)', describeInv: 'Or describe it',
    inPh: '8 by 12 m coffee shop with three 43″ portrait screens on the back wall, a 2x2 video wall on the right and two cameras',
    prefijo: 'ITIL prefix', usarAbierto: 'Survey the open plan', inventariarBtn: 'Survey', cis: 'Proposed ITIL inventory', addCi: '+ CI',
    altaYokup: 'Register in Yokup →', descargarInv: 'Download inventory (JSON)',
    yokupNote: 'The owner confirms the registration in Yokup\'s retailer portal (admira.app/retailer): there they choose the establishment and see what will be created. The inventory travels in the address itself (#), through no server.',
    plano: 'Floor plan', sinPlano: 'No floor plan yet: create or survey it with the Architect.', alzado: 'Elevation', plantaAria: 'Floor plan', alzadoAria: 'Wall elevation',
    leyActual: 'current', leyNueva: 'new or proposed', leyRetirada: 'removed',
    estados: { reposo: 'idle', escuchando: 'listening', midiendo: 'measuring', dibujando: 'drawing', entregando: 'delivering', dudando: 'unsure' },
    meta: (p, o) => `${p.nombre} · ${fmt(p.planta.ancho)} × ${fmt(p.planta.fondo)} m · ${fmt(p.planta.alto)} m high · ${o}`,
    origen: { creado: 'created by the Architect (not saved)', guardado: 'saved in this browser', publicado: 'published', inventario: 'estimated inventory (not saved)' },
    pantallas: n => `${n} ${n === 1 ? 'screen' : 'screens'}`,
    preview: r => `<strong>${esc(TIPOS[r.tipo][lang])} · ${fmt(r.m2, 1)} m²</strong> · ${fmt(r.ancho)} × ${fmt(r.largo)} × ${fmt(r.alto)} m · ${r.puertas} door(s) · ${r.muebles} furniture · ${r.pantallas} proposed screens · seed ${r.semilla}`,
    medidasMal: 'Check the measurements: width and depth 1–500 m, height 2–30 m.',
    guardado: id => `Floor plan saved in this browser as “${id}”. You can now renovate or survey it.`, noGuardado: 'This browser cannot store the plan: it lasts until reload.',
    sobrescribir: id => `There is already a plan saved in this browser for “${id}”. Replace it?`,
    base: (p, o) => `Renovating <strong>${esc(p.nombre)}</strong> (${esc(o)}) · ${p.pantallas.length} screens`,
    sinBase: 'I need a floor plan to renovate: survey or create one first.', sinBaseVoz: 'I need a floor plan to renovate: shall we survey or create one?',
    nadaQueProponer: 'Tell me the renovation or upload a photo or a video.', fotosN: n => `${n} file${n === 1 ? '' : 's'} chosen`,
    preparando: 'Preparing the photos…', estimando: 'Estimating from the photos (may take a minute)…', estimarFallo: e => `Could not estimate from the photos (${e}). Going on with what you told me.`,
    estimarFalloSolo: e => `Could not estimate from the photos (${e}).`,
    op: {
      anadir: o => o.mosaico ? (o.mosaico.tipo === 'rejilla' ? `Add a ${o.mosaico.filas}×${o.mosaico.cols} video wall of ${o.pulgadas}″` : `Add a ${o.mosaico.tipo === 'mosaico-doble-h' ? 'double H' : 'H'} mosaic of ${o.pulgadas}″`) : `Add ${o.cantidad} ${o.orientacion === 'vertical' ? 'portrait' : 'landscape'} screen${o.cantidad === 1 ? '' : 's'} of ${o.pulgadas}″`,
      retirar: o => `Remove ${quien(o.ids)}`, mover: o => `Move ${quien(o.ids)} to the ${pared(o.pared)} wall`,
      girar: o => `Turn ${quien(o.ids)}${o.orientacion ? ' to ' + (o.orientacion === 'vertical' ? 'portrait' : 'landscape') : ''}`, tamano: o => `Change ${quien(o.ids)} to ${o.pulgadas}″`
    },
    enPared: p => ` on the ${pared(p)} wall`,
    motivo: { demasiadas: 'too many new screens in one renovation (max. 40)', 'no-cabe': 'does not fit without overlapping or covering doors', 'no-esta': 'that screen is gone', 'sin-cambio': 'already like that', choca: 'clashes with another screen or an opening' },
    otraPared: p => `did not fit where you said: goes on the ${pared(p)} wall`,
    duda: f => `I don't understand: “${f}”`, dudas: 'Try “add…”, “remove…”, “move … to the … wall”, “turn…” or “change … to 55 inches”.',
    resumenObra: r => `<strong>Works order</strong> · ${Object.entries(r).map(([k, v]) => `${v} ${k}`).join(' · ') || 'no changes'}`,
    tipos: { alta: 'Install', baja: 'Removal', modificacion: 'Change', sustitucion: 'Replacement', contenidos: 'Content' },
    obraGuardada: id => `Works proposal saved in this browser: open it in plano.html (works mode) with “${id}”.`, obraNoGuardada: 'Could not save the proposal in this browser.',
    obraPisa: 'Replace the works proposal draft already saved in this browser for this plan?',
    noInventario: 'Upload photos or a video, describe the space or tick “Survey the open plan”.',
    invListo: (np, nc) => `Estimated plan with ${np} screen${np === 1 ? '' : 's'} and ${nc} proposed CIs. Check the codes before registering.`,
    noCaben: n => `${n} described screen${n === 1 ? ' does' : 's do'} not fit on their wall.`,
    th: ['ITIL code', 'Name', 'Category', 'Depends on', ''], sinPadre: '—', quitar: 'Remove',
    err: { formato: 'invalid code format (PREFIX-PAN-01)', repetido: 'repeated code', vacio: 'name missing', categoria: 'invalid category', padre: 'depends on a CI not in the list', ciclo: 'depends on itself', demasiados: 'too many CIs (max. 200)' },
    fila: i => `Row ${i + 1}: `, cisN: n => `${n} CIs`, prefijoMal: 'The ITIL prefix is 2 to 12 capital letters or digits.',
    traspasoOk: 'Opening Yokup\'s retailer portal with the inventory: the owner picks the establishment and confirms. If it did not open, use the link.', abrirPortal: 'Open the retailer portal with the inventory ↗',
    traspasoGrande: 'The inventory is too large for the address: download it and upload it in the retailer portal (“Import the Architect\'s inventory”).',
    demasiadasOrdenes: n => `At most ${n} orders per renovation: the rest in another one.`,
    noCisValidos: 'Fix the inventory errors before registering.',
    vozCrear: 'Creating the Xpace from what you told me.', vozOrden: o => `Let's go with “${o}”.`, pideFotos: 'Upload photos or a video of the space, or tell me what it is like.', pideReforma: 'Tell me what to change or upload a photo of how it should look.',
    ayudaOrdenes: 'Architect: /arquitecto crear [type] · /arquitecto formatos · /arquitecto reformar · /arquitecto inventariar', ordenDesconocida: x => `The Architect does not know “${x}”. Try: crear, formatos, reformar or inventariar.`,
    abierta: o => `Architect: “${o}” open in the studio.`, ocultoMsg: 'Architect hidden (/arquitecto brings him back).', vistoMsg: 'Architect in sight.',
    dictadoNo: 'This browser has no dictation: type or use the cloud\'s microphone.', escuchando: 'Listening… (you can edit the text)'
  }
};
const LANGUAGE_KEY = (window.ADMIRA_SITE_BRAND?.id || 'clearchannel') + '-lang';
let lang = 'es';
try { lang = localeFor(location.hostname, location.search, localStorage.getItem(LANGUAGE_KEY) || ''); } catch { lang = localeFor(location.hostname, location.search, ''); }
const tr = (k, ...a) => { const v = textos[lang][k]; return typeof v === 'function' ? v(...a) : v; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n, d = 2) => round(n, d).toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { minimumFractionDigits: d === 1 ? 0 : 2, maximumFractionDigits: d });
const dec = n => String(n).replace('.', lang === 'es' ? ',' : '.');
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

const params = new URLSearchParams(location.search);
const P = parametros(location.search);
const almacen = almacenPlanos();
const caraBase = baseLocal(params.get('cara'), location.origin);
const caraOrigen = caraBase ? new URL(caraBase).origin : CARA_ORIGEN;
// La misma URL que «Con foto o vídeo»: en producción api.admira.store; en localhost, ?estimador= y ?simula=1.
const estimarUrl = urlEstimador(location.search, location.hostname);

const st = {
  orden: '', plan: null, origen: '', registro: null, creado: null, tipo: P.tipo || 'cafeteria',
  propuesta: null, ops: [], activas: [], hechos: [], dudas: [], estimacionReforma: null,
  inv: null, cis: [], wallId: '', estado: 'reposo', fotosRf: [], fotosIn: [], vista: null,
  modoCrear: 'tipo', formato: FORMATOS_ALTADIS[0].id, espacio: 'xtanco'
};
const paredNombre = id => { const p = vistaPlan(); const w = p && p.paredes.find(x => x.id === id); return w ? (w.nombre || id) : id; };
function pared(id) { return paredNombre(id); }
function quien(ids) {
  const p = st.plan, lista = (st.propuesta || (p && p.pantallas) || []).concat((p && p.pantallas) || []);
  const nombres = [...new Set(ids.map(id => { const s = lista.find(x => x.id === id); return s ? (s.corto || s.nombre || id) : id; }))];
  return nombres.length > 3 ? nombres.slice(0, 3).join(', ') + '…' : nombres.join(', ');
}

// ── La nube ────────────────────────────────────────────────────────────────────
const frame = $('arq-cara-frame');
frame.src = caraUrl({ base: caraBase ? caraBase + '/nube.html' : undefined, lang });
let nubeLista = false;
function nube(estado, { orden = st.orden, texto, silencio = false } = {}) {
  st.estado = estado;
  $('arq-estado').textContent = tr('estados')[estado] || '';
  if (!nubeLista) return;
  try { frame.contentWindow.postMessage({ type: 'da-arquitecto', estado, orden, ...(texto ? { texto } : {}), silencio, lang }, caraOrigen); } catch { /* sin nube: el estudio sigue */ }
}
// Teatro corto: medir, dibujar y entregar (sin esperas si el usuario prefiere menos movimiento).
const pausa = ms => new Promise(r => setTimeout(r, REDUCED ? 0 : ms));
window.addEventListener('message', ev => {
  if (ev.source === frame.contentWindow && ev.origin === caraOrigen && ev.data && ev.data.type === 'da-arquitecto-listo') { nubeLista = true; nube(st.estado, { silencio: true }); return; }
  const o = ordenDeNube(ev, { ventana: frame.contentWindow, origen: caraOrigen });
  if (o) deVoz(o);
});
$('arq-toggle').addEventListener('click', () => mostrarArquitecto(document.querySelector('.arq-estudio').classList.contains('sin-arquitecto')));
function mostrarArquitecto(si) {
  document.querySelector('.arq-estudio').classList.toggle('sin-arquitecto', !si);
  $('arq-toggle').textContent = tr(si ? 'hide' : 'show');
  return tr(si ? 'vistoMsg' : 'ocultoMsg');
}

// Lo que se le dice a la nube (texto o micro): una orden y/o una descripción para la orden abierta.
function deVoz({ orden, texto }) {
  let parsed = parseOrden(texto) || { orden: '', tipo: '', resto: texto };
  // «formato…» / «format…» sin «/arquitecto» sólo es la orden desde Crear: en Reformar o Inventariar es lo que se cuenta.
  if (parsed.formatos && parsed.contextual && st.orden !== 'crear') parsed = { orden: '', tipo: '', resto: texto };
  if (parsed.formatos) { abrirFormatos(parsed.resto); return; }
  const o = orden || parsed.orden || st.orden;
  const resto = orden || parsed.orden ? (parsed.resto || '') : texto;
  if (o && o !== st.orden) abrirOrden(o, { silencio: true });
  if (!o) { nube('dudando', { texto: tr('ayudaOrdenes') }); return; }
  if (o === 'crear') {
    if (st.modoCrear === 'formato') modoCrear('tipo', { silencio: true });
    const d = leerDescripcion(texto), tipo = d.tipo || parsed.tipo;
    if (tipo) { st.tipo = tipo; pintarTipos(); fillDims(medidasMedias(tipo)); }
    if (d.ancho) $('cr-ancho').value = d.ancho; if (d.largo) $('cr-largo').value = d.largo; if (d.alto) $('cr-alto').value = d.alto;
    crear(!(d.ancho && d.largo));
    return;
  }
  // Sólo se trabaja solo con lo que se entiende («desde una foto» o «este local» no describen nada: se espera).
  const util = o === 'reformar' ? interpretarReforma(resto, (st.plan && st.plan.pantallas) || []).ops.length > 0
    : (() => { const d = leerDescripcion(resto); return !!(d.pantallas.length || d.ancho || d.m2 || d.camaras); })();
  const area = $(o === 'reformar' ? 'rf-texto' : 'in-texto');
  if (util) area.value = (area.value.trim() ? area.value.trim() + '. ' : '') + resto.trim();
  // Por voz o por la nube nunca se llama al estimador (cuesta y manda fotos fuera): sólo con el botón.
  if (o === 'reformar' && util) proponerReforma({ conFotos: false });
  else if (o === 'inventariar' && util && !st.fotosIn.length) inventariar({ conFotos: false });
  else nube(o === 'reformar' && !st.plan ? 'dudando' : 'escuchando', { texto: o === 'reformar' && !st.plan ? tr('sinBaseVoz') : tr(o === 'inventariar' ? 'pideFotos' : 'pideReforma') });
}

// ── Pestañas (órdenes) ───────────────────────────────────────────────────────
const tabs = [...document.querySelectorAll('.arq-tabs [role="tab"]')];
function abrirOrden(orden, { silencio = false, foco = false } = {}) {
  if (!ORDENES.includes(orden)) return false;
  st.orden = orden;
  for (const t of tabs) { const on = t.dataset.orden === orden; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; $(t.getAttribute('aria-controls')).hidden = !on; if (on && foco) t.focus(); }
  $('arq-ayuda').hidden = true;
  if (orden === 'reformar') pintarBaseReforma();
  $('in-cis').hidden = !(orden === 'inventariar' && st.inv);
  if (orden === 'inventariar') { $('in-abierto-l').hidden = !st.plan; if (!$('in-prefijo').value) $('in-prefijo').value = prefijoDe((st.plan && st.plan.id) || normalizarId($('in-nombre').value) || 'xpacio'); }
  pintarPlano();
  if (!silencio) {
    if (orden === 'reformar' && !st.plan) nube('dudando', { texto: tr('sinBaseVoz') });
    else nube('escuchando', { orden });
  }
  return true;
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => abrirOrden(t.dataset.orden));
  t.addEventListener('keydown', e => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return; e.preventDefault(); abrirOrden(tabs[(i + d + tabs.length) % tabs.length].dataset.orden, { foco: true }); });
});

// ── Plano (derecha) ──────────────────────────────────────────────────────────
// Qué se ve: crear → la vista previa; reformar → el plano con la propuesta; inventariar → el plano estimado.
function vistaPlan() {
  if (st.orden === 'crear' && st.creado) return st.creado;
  if (st.orden === 'inventariar' && st.inv) return st.inv;
  return st.plan || st.creado || st.inv;
}
function pintarPlano() {
  const p = vistaPlan();
  $('arq-sin-plano').hidden = !!p; $('arq-vistas').hidden = !p;
  if (!p) { $('arq-plano-meta').textContent = ''; return; }
  const reforma = st.orden === 'reformar' && p === st.plan && st.propuesta;
  const pantallas = reforma ? st.propuesta : p.pantallas;
  const base = new Set(p.pantallas.map(s => s.id));
  const nuevos = new Set(reforma ? pantallas.filter(s => !base.has(s.id) || JSON.stringify(s) !== JSON.stringify(p.pantallas.find(x => x.id === s.id))).map(s => s.id) : (p === st.creado || p === st.inv ? pantallas.map(s => s.id) : []));
  const retiradas = reforma ? p.pantallas.filter(s => !pantallas.some(x => x.id === s.id) || JSON.stringify(s) !== JSON.stringify(pantallas.find(x => x.id === s.id))) : [];
  if (!p.paredes.some(w => w.id === st.wallId)) st.wallId = (pantallas[0] && pantallas[0].pared) || p.paredes[0].id;
  const origen = p === st.creado ? 'creado' : p === st.inv ? 'inventario' : st.origen;
  $('arq-plano-meta').textContent = tr('meta', p, (tr('origen')[origen] || '') + ' · ' + tr('pantallas', pantallas.length));
  const planta = svgPlanta(p, pantallas, { wallId: st.wallId, nuevos, retiradas, lang });
  const svg = $('arq-planta'); svg.setAttribute('viewBox', planta.viewBox); svg.style.setProperty('--k', planta.k); svg.innerHTML = planta.cuerpo;
  svg.querySelectorAll('[data-wall]').forEach(n => { n.style.cursor = 'pointer'; n.addEventListener('click', () => { st.wallId = n.dataset.wall; pintarPlano(); }); });
  const alz = svgAlzado(p, pantallas, st.wallId, { nuevos, retiradas, lang });
  const sa = $('arq-alzado'); sa.setAttribute('viewBox', alz.viewBox); sa.style.setProperty('--k', alz.k); sa.innerHTML = alz.cuerpo;
  $('arq-paredes').replaceChildren(...p.paredes.map(w => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab');
    const n = pantallas.filter(s => s.pared === w.id).length;
    b.textContent = (w.nombre || w.id) + (n ? ` (${n})` : ''); b.setAttribute('aria-selected', String(w.id === st.wallId));
    b.addEventListener('click', () => { st.wallId = w.id; pintarPlano(); });
    return b;
  }));
}

function status(texto, { error = false, html = false } = {}) {
  const s = $('arq-status'); s.classList.toggle('err', error);
  if (html) s.innerHTML = texto; else s.textContent = texto || '';
}

// ── Crear ────────────────────────────────────────────────────────────────────
function pintarTipos() {
  for (const id of ['cr-tipo', 'in-tipo']) {
    $(id).replaceChildren(...Object.entries(TIPOS).map(([k, t]) => Object.assign(document.createElement('option'), { value: k, textContent: t[lang], selected: k === st.tipo })));
  }
}
function fillDims({ ancho, largo, alto }) { $('cr-ancho').value = ancho; $('cr-largo').value = largo; $('cr-alto').value = alto; }
const dim = id => { const v = parseFloat(String($(id).value).replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
function idNuevo(nombre, tipo, semilla) {
  if (P.locationId) return P.locationId;
  const n = normalizarId(nombre);
  return ID_RE.test(n) ? n : `xpacio-${tipo}-${String(semilla).slice(-6)}`;
}
async function crear(total) {
  const tipo = st.tipo, dims = { ancho: dim('cr-ancho'), largo: dim('cr-largo'), alto: dim('cr-alto') };
  if (!total && comprobarSala({ ancho: dims.ancho, fondo: dims.largo, alto: dims.alto }).length) { status(tr('medidasMal'), { error: true }); nube('dudando'); return; }
  const semilla = nuevaSemilla(), nombre = $('cr-nombre').value.trim();
  const id = idNuevo(nombre, tipo, semilla);
  nube('midiendo', { orden: 'crear' }); await pausa(700);
  let plan;
  try { plan = generarXpacio({ tipo, total, semilla, id, nombre: nombre || undefined, ...(total ? {} : dims) }); }
  catch { status(tr('medidasMal'), { error: true }); nube('dudando'); return; }
  st.creado = plan;
  if (total) fillDims({ ancho: plan.planta.ancho, largo: plan.planta.fondo, alto: plan.planta.alto });
  nube('dibujando', { orden: 'crear', silencio: true }); pintarPlano(); await pausa(600);
  const r = resumenGenerado(plan);
  $('cr-preview').innerHTML = tr('preview', r); $('cr-preview').hidden = false; $('cr-usar').hidden = false;
  status('');
  nube('entregando', { orden: 'crear' });
}
async function usarPlano(plan, origen) {
  if (!plan) return;
  const previo = await conTiempo(almacen.leer(plan.id), ESPERA_IDB, null);
  if (previo && previo.plan && JSON.stringify(previo.plan) !== JSON.stringify(plan) && !window.confirm(tr('sobrescribir', plan.id))) return;
  const reg = registroSubida({ id: plan.id, plan, calco: previo && previo.calco, fichero: '' });
  const ok = await almacen.guardar(reg);
  st.plan = plan; st.registro = reg; st.origen = ok ? 'guardado' : origen; st.propuesta = null; st.ops = []; st.hechos = [];
  if (origen === 'creado') st.creado = null; else st.inv = plan;
  try { sessionStorage.setItem('arquitecto:ultimo', plan.id); } catch {}
  $('rf-abrir').href = `plano.html?locationId=${encodeURIComponent(plan.id)}&modo=obra`;
  $('arq-back').href = `plano.html?locationId=${encodeURIComponent(plan.id)}`;
  status(ok ? tr('guardado', plan.id) : tr('noGuardado'), { error: !ok });
  if (origen === 'creado') { $('cr-usar').hidden = true; $('cr-preview').hidden = true; }
  pintarBaseReforma(); pintarPlano();
}
$('cr-tipo').addEventListener('change', e => { st.tipo = TIPOS[e.target.value] ? e.target.value : 'cafeteria'; $('in-tipo').value = st.tipo; fillDims(medidasMedias(st.tipo)); });
$('in-tipo').addEventListener('change', e => { st.tipo = TIPOS[e.target.value] ? e.target.value : 'cafeteria'; $('cr-tipo').value = st.tipo; });
$('cr-manual').addEventListener('click', () => crear(false));
$('cr-total').addEventListener('click', () => crear(true));
$('cr-usar').addEventListener('click', () => usarPlano(st.creado, 'creado'));

// ── Crear · Espacio por formato · Altadis 18 (DCL-d7966deb02734a6f34beb54e) ──
// Un formato de pantalla de Altadis en su espacio tipo (Xtanco o Starbucks): el plano sale de espacioDeFormato (el mismo
// que publica data/xpacios/altadis-<tipo>-NN.json), con sus pantallas resaltadas, la ficha y la galería «Los 18».
const radios = id => [...document.querySelectorAll(`#${id} [role="radio"]`)];
function marcar(id, attr, valor) { for (const b of radios(id)) { const on = b.dataset[attr] === valor; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; } }
function modoCrear(modo, { silencio = false } = {}) {
  st.modoCrear = modo === 'formato' ? 'formato' : 'tipo';
  marcar('cr-modo', 'modo', st.modoCrear);
  $('cr-por-tipo').hidden = st.modoCrear !== 'tipo'; $('cr-por-formato').hidden = st.modoCrear !== 'formato';
  $('cr-preview').hidden = true; $('cr-usar').hidden = true; st.creado = null;
  if (st.modoCrear === 'formato') { mostrarEspacio(st.formato, st.espacio, { silencio }); return; }
  pintarPlano();
  // Por tipo: la dirección deja de apuntar a un espacio Altadis (recargar no lo vuelve a abrir).
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has('formato')) return;
    u.searchParams.delete('formato'); if (Object.hasOwn(TIPOS_ESPACIO, u.searchParams.get('tipo') || '')) u.searchParams.delete('tipo');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  } catch { /* sin history */ }
}
function pintarFormatos() {
  $('cr-formato').replaceChildren(...FORMATOS_ALTADIS.map(f => Object.assign(document.createElement('option'), { value: f.id, textContent: `${String(f.n).padStart(2, '0')} · ${f.nombre} · ${f.ancho}×${f.alto}`, selected: f.id === st.formato })));
  $('cr-galeria').replaceChildren(...FORMATOS_ALTADIS.map(f => {
    const b = document.createElement('button'), zona = ZONAS[zonaDe(f)];
    b.type = 'button'; b.className = 'arq-g'; b.dataset.formato = f.id; b.setAttribute('aria-pressed', String(f.id === st.formato));
    b.title = `${f.nombre} · ${f.ancho}×${f.alto} · ${zona[lang]}`; b.setAttribute('aria-label', b.title);
    // El cubo es una pantalla con 4 caras: en la miniatura, sus caras.
    const caras = FISICO[f.id].caras, divisiones = caras ? Array.from({ length: caras }, (_, i) => ({ x: Math.round(i * f.ancho / caras), y: 0 })) : celdas(f);
    b.innerHTML = svgMiniatura({ ancho: f.ancho, alto: f.alto, celdas: divisiones }) + `<b>${String(f.n).padStart(2, '0')}</b>`;
    b.addEventListener('click', () => mostrarEspacio(f.id, st.espacio));
    return b;
  }));
}
function pintarFicha(plan) {
  const r = resumenEspacio(plan), sincro = r.sincro.map(id => `${formatoDe(id).nombre} (${id})`);
  $('cr-ficha').innerHTML = tr('ficha', r, { tipo: TIPOS_ESPACIO[tipoEspacio(r.tipo)][lang], pared: paredNombre(r.pared), sincro });
}
function mostrarEspacio(formato, tipoPedido, { silencio = false, url = true } = {}) {
  const tipo = tipoEspacio(tipoPedido);
  if (!formatoDe(formato)) return false;
  let plan;
  try { plan = espacioDeFormato(formato, tipo); } catch { status(tr('espacioFallo', formatoDe(formato).nombre, TIPOS_ESPACIO[tipo][lang]), { error: true }); nube('dudando'); return false; }
  st.formato = formato; st.espacio = tipo; st.creado = plan; st.wallId = plan.pantallas[0].pared;
  $('cr-formato').value = formato; marcar('cr-espacio', 'espacio', tipo);
  for (const b of $('cr-galeria').children) b.setAttribute('aria-pressed', String(b.dataset.formato === formato));
  pintarPlano(); pintarFicha(plan);
  $('cr-gemelo').href = urlGemelo(plan.id); $('cr-studio').href = urlStudio(formato);
  $('cr-plano').href = `plano.html?locationId=${encodeURIComponent(plan.id)}`; $('cr-directo').href = urlArquitecto(formato, tipo);
  $('cr-usar').hidden = false; status('');
  // La dirección sigue a lo elegido: copiarla es el enlace directo a este espacio.
  if (url) try {
    const u = new URL(location.href);
    for (const k of ['orden', 'arg', 'espacio']) u.searchParams.delete(k);
    u.searchParams.set('formato', formato); u.searchParams.set('tipo', tipo);
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  } catch { /* sin history: el enlace directo sigue ahí */ }
  if (!silencio) nube('entregando', { orden: 'crear' });
  return true;
}
for (const b of radios('cr-modo')) b.addEventListener('click', () => modoCrear(b.dataset.modo));
for (const b of radios('cr-espacio')) b.addEventListener('click', () => mostrarEspacio(st.formato, b.dataset.espacio));
for (const id of ['cr-modo', 'cr-espacio']) $(id).addEventListener('keydown', e => {
  const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!d) return;
  e.preventDefault();
  const bs = radios(id), i = bs.findIndex(b => b.getAttribute('aria-checked') === 'true'), next = bs[(i + d + bs.length) % bs.length];
  next.click(); next.focus();
});
$('cr-formato').addEventListener('change', e => mostrarEspacio(e.target.value, st.espacio));
// /arquitecto formatos [NN] [xtanco|starbucks] (por voz, la nube o el ⌘ Experto).
function abrirFormatos(texto = '') {
  const r = leerEspacio(texto);
  mostrarArquitecto(true);
  abrirOrden('crear', { silencio: true });
  st.formato = r.formato || st.formato; st.espacio = tipoEspacio(r.tipo || st.espacio);
  modoCrear('formato');
  // Un formato que no es de los 18 no se calla: se dice y se enseña el que había.
  if (r.desconocido) { const m = tr('formatoDesconocido', formatoDe(st.formato).nombre); status(m, { error: true }); return m; }
  return tr('abiertaFormatos', formatoDe(st.formato).nombre, TIPOS_ESPACIO[st.espacio][lang]);
}

// ── Dictado (Web Speech API) con la transcripción visible y editable ─────────
function dictado(boton, area) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  boton.addEventListener('click', () => {
    if (!SR) { status(tr('dictadoNo'), { error: true }); return; }
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = lang === 'en' ? 'en-GB' : 'es-ES'; rec.interimResults = true; rec.continuous = false;
    const antes = area.value.trim();
    rec.onresult = e => { const t = Array.from(e.results).map(r => r[0].transcript).join(' ').trim(); area.value = (antes ? antes + ' ' : '') + t; };
    rec.onend = () => { boton.classList.remove('live'); rec = null; status(''); };
    rec.onerror = () => { boton.classList.remove('live'); rec = null; status(tr('dictadoNo'), { error: true }); };
    boton.classList.add('live'); status(tr('escuchando')); nube('escuchando', { silencio: true });
    rec.start();
  });
}
dictado($('rf-mic'), $('rf-texto'));
dictado($('in-mic'), $('in-texto'));
for (const [input, n, key] of [['rf-fotos', 'rf-fotos-n', 'fotosRf'], ['in-fotos', 'in-fotos-n', 'fotosIn']]) {
  $(input).addEventListener('change', e => { st[key] = Array.from(e.target.files || []); $(n).textContent = st[key].length ? tr('fotosN', st[key].length) : ''; });
}
// Las claves de error de «Con foto o vídeo» (claveError de plano-foto.mjs), en palabras.
const ERR_ESTIMADOR = {
  es: { phLimitIp: 'tope de estimaciones de hoy desde esta conexión', phLimitDay: 'tope diario de estimaciones', phTooBig: 'las fotos pesan demasiado', phOrigin: 'sólo funciona en www.admira.biz y www.admira.store',
    phTimeout: 'el modelo no respondió a tiempo', phInvalid: 'estimación no válida', phBusy: 'el modelo está saturado', phError: 'error del estimador', phOff: 'la estimación con fotos está desactivada ahora mismo',
    phQuotaDown: 'el control de cupo no responde; por seguridad no se estima', 'sin-fotos': 'ninguna foto utilizable', ilegible: 'fichero ilegible' },
  en: { phLimitIp: 'today\'s estimate limit from this connection', phLimitDay: 'daily estimate limit', phTooBig: 'photos too large', phOrigin: 'it only works on www.admira.biz and www.admira.store',
    phTimeout: 'the model did not answer in time', phInvalid: 'invalid estimate', phBusy: 'the model is busy', phError: 'estimator error', phOff: 'photo estimates are switched off right now',
    phQuotaDown: 'the quota check is not answering; to be safe nothing is estimated', 'sin-fotos': 'no usable photo', ilegible: 'unreadable file' }
};
const errorEstimador = k => (ERR_ESTIMADOR[lang] || ERR_ESTIMADOR.es)[k] || k;
async function fotosAEstimacion(files, tipo, notas) {
  // El estimador sólo atiende a admira.biz y admira.store (y localhost): en otro dominio, ni se intenta.
  if (!origenEstimador(location.origin)) return { ok: false, error: 'phOrigin' };
  status(tr('preparando'));
  const { fotos } = await prepararFotos(files);
  if (!fotos.length) return { ok: false, error: 'sin-fotos' };
  status(tr('estimando'));
  return estimar(estimarUrl, { fotos, tipo, notas, lang });
}

// ── Reformar ─────────────────────────────────────────────────────────────────
function pintarBaseReforma() {
  $('rf-base').innerHTML = st.plan ? tr('base', st.plan, tr('origen')[st.origen] || st.origen) : esc(tr('sinBase'));
  $('rf-proponer').disabled = !st.plan;
}
async function proponerReforma({ conFotos = true } = {}) {
  if (!st.plan) { status(tr('sinBase'), { error: true }); nube('dudando', { texto: tr('sinBaseVoz') }); return; }
  const texto = $('rf-texto').value.trim();
  const fotos = conFotos ? st.fotosRf : [];
  if (!texto && !fotos.length) { status(tr('nadaQueProponer'), { error: true }); nube('dudando'); return; }
  $('rf-proponer').disabled = true;
  status('');
  nube('midiendo', { orden: 'reformar' });
  const base = st.plan.pantallas;
  const deTexto = texto ? interpretarReforma(texto, base) : { ops: [], dudas: [] };
  let deFotos = { ops: [], dudas: [] };
  if (fotos.length) {
    const r = await fotosAEstimacion(fotos, st.plan.generador && st.plan.generador.tipo, texto);
    if (r.ok) deFotos = reformaDesdeEstimacion(st.plan, base, r.estimacion);
    else status(tr(deTexto.ops.length ? 'estimarFallo' : 'estimarFalloSolo', errorEstimador(r.error)), { error: true });
  }
  st.ops = deTexto.ops.concat(deFotos.ops).slice(0, MAX_ORDENES); st.activas = st.ops.map(() => true); st.dudas = deTexto.dudas;
  if (deTexto.demasiadas || deTexto.ops.length + deFotos.ops.length > MAX_ORDENES) status(tr('demasiadasOrdenes', MAX_ORDENES), { error: true });
  await pausa(500);
  aplicarActivas();
  $('rf-proponer').disabled = false;
  if (!st.ops.length) { nube('dudando'); return; }
  nube('dibujando', { orden: 'reformar' });
  await pausa(900);
  nube('entregando', { orden: 'reformar' });
}
function aplicarActivas() {
  // Una a una, para saber qué pasó con cada orden (una orden de «añadir» con cantidad da varios hechos).
  let lista = st.plan.pantallas;
  st.hechosPorOp = st.ops.map((o, i) => {
    if (!st.activas[i]) return [];
    const r = aplicarReforma(st.plan, lista, [o]);
    lista = r.propuesta;
    return r.hechos;
  });
  st.propuesta = lista; st.hechos = st.hechosPorOp.flat();
  // El alzado enseña la pared del primer cambio.
  const primero = st.hechos.find(h => h.ok && h.ids && h.ids.length);
  if (primero) { const s = lista.find(x => x.id === primero.ids[0]) || st.plan.pantallas.find(x => x.id === primero.ids[0]); if (s) st.wallId = s.pared; }
  pintarReforma(); pintarPlano();
}
function textoOp(o) { return tr('op')[o.op] ? tr('op')[o.op](o) + (o.op === 'anadir' && o.pared ? tr('enPared', o.pared) : '') : o.op; }
function pintarReforma() {
  const lista = $('rf-ops');
  lista.replaceChildren(...st.ops.map((o, i) => {
    const li = document.createElement('li'), cb = document.createElement('input'), body = document.createElement('div');
    cb.type = 'checkbox'; cb.checked = st.activas[i]; cb.setAttribute('aria-label', textoOp(o));
    cb.addEventListener('change', () => { st.activas[i] = cb.checked; aplicarActivas(); });
    const hs = (st.hechosPorOp && st.hechosPorOp[i]) || [], h = hs.find(x => !x.ok) || hs[hs.length - 1] || null;
    li.className = h ? (h.ok ? 'ok' : 'err') : '';
    body.append(Object.assign(document.createElement('span'), { textContent: textoOp(o) }));
    const small = document.createElement('small');
    small.textContent = [o.texto ? `«${o.texto}»` : '', h && !h.ok ? (tr('motivo')[h.motivo] || h.motivo) : '', h && h.otraPared ? tr('otraPared', h.pared) : ''].filter(Boolean).join(' · ');
    if (small.textContent) body.append(small);
    li.append(cb, body);
    return li;
  }));
  lista.hidden = !st.ops.length;
  const dudas = $('rf-dudas');
  dudas.replaceChildren(...st.dudas.map(f => Object.assign(document.createElement('li'), { textContent: tr('duda', f) })), ...(st.dudas.length ? [Object.assign(document.createElement('li'), { textContent: tr('dudas') })] : []));
  dudas.hidden = !st.dudas.length;
  const orden = st.propuesta ? workOrder(st.plan, st.propuesta) : null;
  $('rf-orden').hidden = !orden || !st.ops.length;
  if (orden) {
    $('rf-orden').innerHTML = tr('resumenObra', orden.resumen) + (orden.acciones.length ? '<ol>' + orden.acciones.map(a => `<li><strong>${esc(tr('tipos')[a.tipo] || a.tipo)}</strong> · ${esc(a.nombre || a.pantalla)}<ul>${(a.obra || []).map(x => `<li>${esc(x)}</li>`).join('')}${a.inventario ? `<li>${esc(a.inventario)}</li>` : ''}</ul></li>`).join('') + '</ol>' : '');
  }
  $('rf-acciones').hidden = !orden || !orden.acciones.length;
}
const STORE_KEY = id => 'admira.plano.' + id;
function ordenObra() { return exportOrder(st.plan, st.propuesta, { titulo: lang === 'es' ? 'Propuesta del Arquitecto' : 'Architect proposal' }); }
$('rf-proponer').addEventListener('click', proponerReforma);
$('rf-guardar').addEventListener('click', () => {
  if (!st.plan || !st.propuesta) return;
  let previo = null;
  try { previo = JSON.parse(localStorage.getItem(STORE_KEY(st.plan.id)) || 'null'); } catch {}
  if (previo && Array.isArray(previo.propuesta) && JSON.stringify(previo.propuesta) !== JSON.stringify(st.plan.pantallas) && JSON.stringify(previo.propuesta) !== JSON.stringify(st.propuesta) && !window.confirm(tr('obraPisa'))) return;
  let ok = true;
  try { localStorage.setItem(STORE_KEY(st.plan.id), JSON.stringify(ordenObra())); } catch { ok = false; }
  status(ok ? tr('obraGuardada', st.plan.id) : tr('obraNoGuardada'), { error: !ok });
});
$('rf-descargar').addEventListener('click', () => { if (st.plan && st.propuesta) descargar(`orden-obra-${st.plan.id}.json`, ordenObra()); });
function descargar(nombre, obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  a.download = nombre; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ── Inventariar ──────────────────────────────────────────────────────────────
async function inventariar({ conFotos = true } = {}) {
  const texto = $('in-texto').value.trim(), tipo = st.tipo, nombre = $('in-nombre').value.trim();
  const usarAbierto = $('in-abierto').checked && st.plan, fotosIn = conFotos ? st.fotosIn : [];
  if (!fotosIn.length && !texto && !usarAbierto) { status(tr('noInventario'), { error: true }); nube('dudando'); return; }
  $('in-inventariar').disabled = true; $('in-yokup-link').hidden = true;
  status('');
  nube('midiendo', { orden: 'inventariar' });
  const semilla = nuevaSemilla(), id = st.plan && usarAbierto ? st.plan.id : idNuevo(nombre, tipo, semilla);
  const d = leerDescripcion(texto);
  let plan = null, aviso = '';
  try {
    if (usarAbierto) plan = JSON.parse(JSON.stringify(st.plan));
    else if (fotosIn.length) {
      const r = await fotosAEstimacion(fotosIn, tipo, texto);
      if (r.ok) plan = planDesdeEstimacion({ respuesta: r, tipo, id, nombre: nombre || undefined, semilla });
      else if (texto) { aviso = tr('estimarFallo', errorEstimador(r.error)); }
      else { status(tr('estimarFalloSolo', errorEstimador(r.error)), { error: true }); nube('dudando'); return; }
    }
    if (!plan) { const r = planDesdeDescripcion({ descripcion: texto, tipo: d.tipo ? '' : tipo, id, nombre: nombre || undefined, semilla }); plan = r.plan; if (r.noCaben.length) aviso = [aviso, tr('noCaben', r.noCaben.length)].filter(Boolean).join(' '); }
  } catch { status(tr('medidasMal'), { error: true }); nube('dudando'); return; }
  finally { $('in-inventariar').disabled = false; }
  nube('dibujando', { orden: 'inventariar' });
  // El prefijo sigue al Xpacio inventariado salvo que el usuario lo haya escrito a mano.
  const prefijo = st.prefijoManual && PREFIJO_RE.test($('in-prefijo').value) ? $('in-prefijo').value : prefijoDe(plan.id);
  $('in-prefijo').value = prefijo;
  st.inv = plan;
  st.cis = construirCis(plan, { prefijo, camaras: d.camaras, altavoces: d.altavoces, players: d.players });
  pintarCis(); pintarPlano();
  await pausa(800);
  status([tr('invListo', plan.pantallas.length, st.cis.length), aviso].filter(Boolean).join(' '));
  nube('entregando', { orden: 'inventariar' });
}
function pintarCis() {
  const tabla = $('in-tabla'), rev = revisarCis(st.cis), malos = new Map();
  for (const e of rev.errores) if (e.fila >= 0) malos.set(e.fila + ':' + e.campo, e.codigo);
  const thead = document.createElement('thead'), tr0 = document.createElement('tr');
  tr0.append(...tr('th').map(t => Object.assign(document.createElement('th'), { textContent: t }))); thead.append(tr0);
  const tbody = document.createElement('tbody');
  st.cis.forEach((c, i) => {
    const fila = document.createElement('tr');
    const celda = (campo, nodo) => { const td = document.createElement('td'); if (malos.has(i + ':' + campo)) td.className = 'bad'; td.append(nodo); fila.append(td); };
    const code = Object.assign(document.createElement('input'), { className: 'code', value: c.itil_code, spellcheck: false, maxLength: 51 });
    code.setAttribute('aria-label', tr('th')[0] + ' ' + (i + 1));
    code.addEventListener('change', () => { const viejo = c.itil_code, nuevo = code.value.trim().toUpperCase(); c.itil_code = nuevo; st.cis.forEach(x => { if (x.parent_itil_code === viejo) x.parent_itil_code = nuevo; }); pintarCis(); });
    celda('itil_code', code);
    const nombre = Object.assign(document.createElement('input'), { value: c.name, maxLength: 160 });
    nombre.setAttribute('aria-label', tr('th')[1] + ' ' + (i + 1));
    nombre.addEventListener('change', () => { c.name = nombre.value; pintarCis(); });
    celda('name', nombre);
    const cat = document.createElement('select');
    cat.append(...CATEGORIAS.map(k => Object.assign(document.createElement('option'), { value: k, textContent: k, selected: k === c.category })));
    cat.setAttribute('aria-label', tr('th')[2] + ' ' + (i + 1));
    cat.addEventListener('change', () => { c.category = cat.value; pintarCis(); });
    celda('category', cat);
    const padre = document.createElement('select');
    padre.append(Object.assign(document.createElement('option'), { value: '', textContent: tr('sinPadre') }), ...st.cis.filter(x => x !== c).map(x => Object.assign(document.createElement('option'), { value: x.itil_code, textContent: x.itil_code, selected: x.itil_code === c.parent_itil_code })));
    padre.setAttribute('aria-label', tr('th')[3] + ' ' + (i + 1));
    padre.addEventListener('change', () => { c.parent_itil_code = padre.value; pintarCis(); });
    celda('parent_itil_code', padre);
    const del = Object.assign(document.createElement('button'), { type: 'button', className: 'del', textContent: '✕', title: tr('quitar') });
    del.setAttribute('aria-label', tr('quitar') + ' ' + c.itil_code);
    del.addEventListener('click', () => { st.cis.splice(i, 1); st.cis.forEach(x => { if (x.parent_itil_code === c.itil_code) x.parent_itil_code = ''; }); pintarCis(); });
    const td = document.createElement('td'); td.append(del); fila.append(td);
    tbody.append(fila);
  });
  tabla.replaceChildren(thead, tbody);
  $('in-cis').hidden = !st.inv || st.orden !== 'inventariar';
  $('in-cis-n').textContent = tr('cisN', st.cis.length);
  const errs = $('in-errores');
  errs.replaceChildren(...rev.errores.slice(0, 8).map(e => Object.assign(document.createElement('li'), { className: 'error', textContent: (e.fila >= 0 ? tr('fila', e.fila) : '') + (tr('err')[e.codigo] || e.codigo) })));
  errs.hidden = !rev.errores.length;
  $('in-yokup').disabled = !rev.ok || !st.cis.length;
  return rev;
}
$('in-inventariar').addEventListener('click', inventariar);
$('in-prefijo').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); st.prefijoManual = true; });
$('in-prefijo').addEventListener('change', () => {
  const nuevo = $('in-prefijo').value; if (!PREFIJO_RE.test(nuevo)) { status(tr('prefijoMal'), { error: true }); return; }
  const re = /^[A-Z0-9]{2,12}(?=-)/;
  const mapa = new Map(st.cis.map(c => [c.itil_code, c.itil_code.replace(re, nuevo)]));
  st.cis.forEach(c => { c.itil_code = mapa.get(c.itil_code); if (c.parent_itil_code) c.parent_itil_code = mapa.get(c.parent_itil_code) || c.parent_itil_code; });
  pintarCis();
});
$('in-add').addEventListener('click', () => {
  const prefijo = PREFIJO_RE.test($('in-prefijo').value) ? $('in-prefijo').value : 'XPACIO';
  let k = 1; while (st.cis.some(c => c.itil_code === `${prefijo}-OTR-${String(k).padStart(2, '0')}`)) k++;
  st.cis.push({ itil_code: `${prefijo}-OTR-${String(k).padStart(2, '0')}`, name: lang === 'es' ? 'Equipo nuevo' : 'New device', category: 'otro', role: '', group_name: '', position: '', orientation: '', parent_itil_code: '' });
  pintarCis();
});
function inventarioActual() { return inventarioTraspaso({ plan: st.inv, cis: st.cis, tipo: st.tipo, prefijo: $('in-prefijo').value }); }
$('in-descargar').addEventListener('click', () => { if (st.inv) descargar(`inventario-arquitecto-${st.inv.id}.json`, inventarioActual()); });
$('in-usar').addEventListener('click', () => usarPlano(st.inv, 'inventario'));
$('in-yokup').addEventListener('click', async () => {
  if (!st.inv) return;
  const rev = pintarCis();
  if (!rev.ok) { status(tr('noCisValidos'), { error: true }); nube('dudando'); return; }
  const cod = await codificarTraspaso(inventarioActual());
  if (!cod.ok) { status(tr('traspasoGrande'), { error: true }); nube('dudando'); return; }
  const url = urlPortal(cod.fragmento);
  // Con 'noopener' window.open devuelve siempre null: no se sabe si se abrió, así que el enlace queda a mano.
  window.open(url, '_blank', 'noopener');
  status(tr('traspasoOk'));
  const a = $('in-yokup-link'); a.href = url; a.hidden = false;
  nube('entregando', { orden: 'inventariar' });
});

// ── Idioma, ⌘ Experto y arranque ─────────────────────────────────────────────
function traducir() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-t]').forEach(n => { n.textContent = tr(n.dataset.t); });
  document.querySelectorAll('[data-t-aria]').forEach(n => n.setAttribute('aria-label', tr(n.dataset.tAria)));
  document.querySelectorAll('[data-t-ph]').forEach(n => n.setAttribute('placeholder', tr(n.dataset.tPh)));
  document.querySelectorAll('[data-t-title]').forEach(n => n.setAttribute('title', tr(n.dataset.tTitle)));
  $('arq-toggle').textContent = tr(document.querySelector('.arq-estudio').classList.contains('sin-arquitecto') ? 'show' : 'hide');
  $('arq-estado').textContent = tr('estados')[st.estado] || '';
  pintarTipos(); pintarBaseReforma(); pintarFormatos();
  if (st.creado && st.creado.formato) pintarFicha(st.creado);
  if (st.ops.length) pintarReforma();
  if (st.inv) pintarCis();
  pintarPlano();
}
document.addEventListener('admira:lang', e => {
  const next = e.detail?.lang === 'es' ? 'es' : 'en'; if (next === lang) return;
  lang = next; traducir();
  try { frame.contentWindow.postMessage({ type: 'da-lang', lang }, caraOrigen); } catch {}
});
// /arquitecto [crear [tipo]|reformar|inventariar] del ⌘ Experto (vía admiranext.com/assets/avatar.js).
window.AdmiraArquitecto = {
  orden(orden, a = {}) {
    if (!orden) { abrirAyuda(); nube('reposo', { texto: undefined }); return tr('ayudaOrdenes'); }
    const p = typeof orden === 'string' && ORDENES.includes(orden) ? { orden, tipo: a.tipo || '' } : parseOrden(orden);
    if (!p || !p.orden) return tr('ordenDesconocida', String(orden).slice(0, 30));
    if (p.formatos) return abrirFormatos(p.resto);
    if (p.tipo && TIPOS[p.tipo]) { st.tipo = p.tipo; pintarTipos(); fillDims(medidasMedias(p.tipo)); if (st.modoCrear === 'formato') modoCrear('tipo', { silencio: true }); }
    mostrarArquitecto(true);
    abrirOrden(p.orden);
    if (p.orden === 'crear' && p.tipo) crear(true);
    return tr('abierta', tr(p.orden));
  },
  ayuda() { abrirAyuda(); return tr('ayudaOrdenes'); },
  // El contrato de los personajes del cargador común: sin argumento toggle(), con argumento lanzar(arg).
  // /arquitecto sin nada saca al Arquitecto y explica las tres órdenes (no lo esconde: para eso, su botón).
  toggle() { mostrarArquitecto(true); abrirAyuda(); nube('reposo'); return tr('ayudaOrdenes'); },
  lanzar(arg) { return window.AdmiraArquitecto.orden(String(arg || '').replace(/-/g, ' ')); },
  estado() { return { orden: st.orden, estado: st.estado, plan: st.plan && st.plan.id, inventario: st.inv && st.inv.id, cis: st.cis.length, ops: st.ops.length }; }
};
function abrirAyuda() { $('arq-ayuda').hidden = false; $('in-cis').hidden = true; for (const t of tabs) { t.setAttribute('aria-selected', 'false'); $(t.getAttribute('aria-controls')).hidden = true; } st.orden = ''; pintarPlano(); }

async function cargarPlano(id) {
  if (!id) return;
  const reg = await conTiempo(almacen.leer(id), ESPERA_IDB, null);
  if (reg && reg.plan) { st.plan = reg.plan; st.registro = reg; st.origen = 'guardado'; return; }
  try {
    const r = await fetch(`data/xpacios/${encodeURIComponent(id)}.json`, { cache: 'no-store' });
    if (r.ok && /json/i.test(r.headers.get('content-type') || '')) { const p = await r.json(); if (p && Array.isArray(p.paredes) && Array.isArray(p.pantallas)) { st.plan = p; st.origen = 'publicado'; } }
  } catch { /* sin plano publicado */ }
}
async function init() {
  traducir();
  fillDims(medidasMedias(st.tipo));
  let ultimo = '';
  try { ultimo = sessionStorage.getItem('arquitecto:ultimo') || ''; } catch {}
  await cargarPlano(P.locationId || (ID_RE.test(ultimo) ? ultimo : ''));
  if (st.plan) {
    $('rf-abrir').href = `plano.html?locationId=${encodeURIComponent(st.plan.id)}&modo=obra`;
    $('arq-back').href = `plano.html?locationId=${encodeURIComponent(st.plan.id)}`;
    $('in-nombre').value = st.plan.nombre || '';
  }
  pintarBaseReforma();
  // ?formato=cliente-NN&tipo=xtanco|cafe (o ?espacio=altadis-cafe-NN, o /arquitecto formatos por ?arg=): el espacio Altadis.
  const PE = parametrosEspacio(location.search);
  if (PE) {
    st.formato = PE.formato; st.espacio = tipoEspacio(PE.tipo); abrirOrden('crear', { silencio: true }); modoCrear('formato', { silencio: true });
    if (PE.desconocido) status(tr('formatoDesconocido', formatoDe(st.formato).nombre), { error: true });
  }
  else if (P.orden) abrirOrden(P.orden, { silencio: true }); else pintarPlano();
  if (!PE && P.orden === 'crear' && P.tipo) crear(true);
  // Validación sin errores de geometría (como en plano.html): sólo como aviso en consola.
  if (st.plan && validate(st.plan).some(i => i.nivel === 'error')) console.warn('[arquitecto] el plano abierto tiene conflictos de geometría');
}
init();
export { st as estado, tipoDe, medidasDe };
