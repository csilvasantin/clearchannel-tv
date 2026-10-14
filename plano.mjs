// Plano y obras de un Xpacio (FLT-102063). Planta y alzado en SVG con las pantallas
// del inventario ITIL; en «Propuesta de obra» se mueven, giran, añaden y retiran
// (los mosaicos, enteros o pantalla a pantalla) y se genera la orden de obra.
// La lógica vive en plano-core.mjs.
import { localeFor } from './walk-core.mjs?v=20261010-evidence-1';
import {
  SCHEMA, round, wallLength, pointOnWall, inwardNormal, screenGeometry, footprint, furnitureAgainstWall, criteria,
  validate, workOrder, exportOrder, restoreProposal, template, placeNew, clampToWall, moveGroup, groupOf, composition, groupCanvas, reshape
} from './plano-core.mjs?v=20261014-plano-1';
// ▤ Subir plano (DCL-58288891486617b36ed8777d): JSON del plano o calco (imagen o PDF), guardado en este navegador.
import {
  ACEPTA, MAX_LADO, comprobarFichero, leerPlanoJson, resumenPlano, salaRectangular, comprobarSala, escalaCalco, escalaPdf,
  anchoSala, nuevoCalco, calcoValido, geometriaCalco, registroSubida, almacenPlanos, nombreDeFichero, conTiempo, ESPERA_IDB
} from './plano-subida.mjs?v=20261014-subir-1';
// ▤ Creación de Xpacios (DCL-35708977d7b8520386dad95f): plano inventado según el tipo de Xpacio.
import { TIPOS, generarXpacio, medidasMedias, nuevaSemilla, resumenGenerado } from './plano-generador.mjs?v=20261014-foto-1';
// ▤ Creación de Xpacios · «Con foto o vídeo» (DCL-ddf3203078fe9471f3796130): estimación con Gemini Pro en api.admira.store.
import {
  MAX_FOTOS, MAX_BYTES_FOTO, ESCALONES, ESPERA_ESTIMADOR, ACEPTA_FOTO, urlEstimador, tiemposFotogramas, escalaFoto, bytesDataUrl,
  clasificarFicheros, claveError, origenEstimador, planoDesdeEstimacion, resumenEstimado
} from './plano-foto.mjs?v=20261014-foto-2';

const copy = {
  es: {
    back: '← Volver a la ficha', backYokup: '← Ver en Yokup (ITIL)', eyebrow: 'Plano del Xpacio · inventario ITIL', current: 'Distribución actual', works: 'Propuesta de obra',
    modes: 'Qué distribución ver', loading: 'Cargando el plano…', noPlan: 'Este Xpacio aún no tiene plano.', loadError: 'No se pudo cargar el plano.',
    plan: 'Planta', planHint: 'Pulsa una pared para ver su alzado', elevation: 'Alzado', planAria: 'Plano en planta', elevationAria: 'Alzado de la pared',
    dragHint: 'Arrastra una pantalla en el alzado o muévela con las flechas (Mayús: 10 cm). Los mosaicos se mueven enteros salvo que lo desactives.',
    inventory: 'Inventario ITIL · pantallas', selected: 'Pantalla seleccionada',
    order: 'Orden de obra', export: 'Descargar orden de obra (JSON)', add: 'Añadir', addVertical: '▯ Vertical 55″', addHorizontal: '▭ Horizontal 55″', addH: '▯▭▯ Mosaico H', addMosaic: '▯▭▯▯▭▯ Mosaico doble H',
    reset: 'Volver a la distribución actual', proposalName: 'Nombre de la propuesta', defaultTitle: 'Propuesta de obra',
    orderNote: 'Borrador en este navegador. Las altas y bajas de CI se aplican en Yokup, el maestro del ITIL, cuando la obra se apruebe y se ejecute.',
    saved: 'Borrador guardado en este navegador', notSaved: 'No se pudo guardar el borrador en este navegador',
    thItil: 'CI ITIL', thName: 'Pantalla', thType: 'Formato', thGroup: 'Mosaico · player', thWall: 'Pared', thCenter: 'Centro', thBase: 'Base', thSize: 'Tamaño', thState: 'Estado',
    screens: n => `${n} ${n === 1 ? 'pantalla' : 'pantallas'}`, pending: 'por cruzar', vertical: 'vertical', horizontal: 'horizontal',
    name: 'Nombre', wall: 'Pared', center: 'Centro desde la izquierda (m)', base: 'Base sobre el suelo (m)', orientation: 'Orientación', inches: 'Diagonal (″)',
    shopWindow: 'Pantalla de escaparate (mira a la calle)', groupLock: n => `Mover el mosaico entero (${n} pantallas)`, ungroup: 'Separar del mosaico',
    removeGroup: n => `Retirar el mosaico entero (${n})`, remove: 'Retirar esta pantalla', restore: 'Deshacer cambios de esta pantalla', propose: 'Proponer cambios',
    noIssues: 'Sin conflictos en el plano.', noActions: 'La propuesta es igual que la distribución actual: no hay obra.',
    summary: r => ['alta', 'baja', 'modificacion', 'sustitucion', 'contenidos'].filter(k => r[k]).map(k => `${r[k]} ${({ alta: ['alta', 'altas'], baja: ['baja', 'bajas'], modificacion: ['modificación', 'modificaciones'], sustitucion: ['sustitución', 'sustituciones'], contenidos: ['de contenidos', 'de contenidos'] })[k][r[k] > 1 ? 1 : 0]}`).join(' · '),
    types: { alta: 'Alta', baja: 'Baja', modificacion: 'Modificación', sustitucion: 'Sustitución', contenidos: 'Contenidos' }, inventoryLine: 'Inventario', contentLine: 'Contenidos',
    removed: 'retirada', unchanged: 'sin cambios', criterion: m => `criterio: base a ${m} m`, wallOf: (w, l, h) => `${w} · ${l} m de largo · ${h} m de alto`,
    source: 'Fuente', model: 'Modelo', state: 'Estado', size: 'Tamaño', player: 'Player', screenId: 'Pantalla en admira.studio', group: 'Mosaico',
    devices: 'Players y dispositivos · ITIL', thDevice: 'Dispositivo', thKind: 'Tipo', thRole: 'Función',
    // ▤ Subir plano
    noPlanUpload: 'Este Xpacio aún no tiene plano: súbelo o créalo desde ▤ Modo avanzado.', openUpload: '▤ Subir plano', openCreate: '▤ Crear Xpacio',
    crTitle: 'Creación de Xpacios', crHint: 'Para dar de alta Xpacios que no podremos visitar: al azar según el tipo, con su plano o con fotos o vídeo del local.',
    crTabs: 'Cómo crear el Xpacio', crTabRandom: 'Aleatorio', crTabPlan: 'Con plano', crTabPhoto: 'Con foto o vídeo',
    crRandomHint: 'Elige el tipo y las medidas, o «Creación total» para sortearlas según la media del tipo.',
    crPlanText: 'Si tienes el plano del Xpacio (JSON, imagen o PDF), súbelo con «Subir plano», aquí arriba: una imagen o un PDF sirven de calco para una sala nueva.', crGoUpload: 'Ir a Subir plano',
    crPhotoText: 'Sube hasta 8 fotos del local o un vídeo recorriéndolo. Gemini estima las medidas con tamaños conocidos (puertas, pantallas de 27″ o 55″, baldosa de 20 cm, mostradores) y sitúa puertas, muebles y pantallas; el generador completa el resto según el tipo.',
    phDrop: 'Suelta aquí fotos o un vídeo, o pulsa para elegirlos', phTypes: 'Hasta 8 fotos · o 1 vídeo (se sacan 6–8 fotogramas aquí)',
    phNotes: 'Pistas (opcional)', phNotesPh: 'P. ej.: la entrada es la puerta de cristal; el techo es de 3 m', phEstimate: 'Estimar el Xpacio',
    phPrivacy: 'Las fotos van a Gemini (Google) por el worker de Admira solo para estimar: no se guardan. El plano queda en este navegador, como estimado.',
    phReading: 'Preparando las fotos…', phFrames: (i, n) => `Sacando fotogramas del vídeo… ${i}/${n}`,
    phCount: (n, video) => video ? `${n} fotogramas de «${video}»` : `${n} de ${MAX_FOTOS} fotos`, phRemove: n => `Quitar la foto ${n}`, phClear: 'Quitar todas',
    phWorking: sec => `Gemini está estimando el Xpacio… ${sec} s (suele tardar entre 1 y 2 minutos)`,
    phDone: 'Estimación lista: revisa la vista previa y pulsa «Usar este plano».', phApplied: 'Plano estimado y guardado en este navegador.',
    phLimitIp: 'Has llegado al tope de estimaciones de hoy desde esta conexión. Vuelve a probar mañana.',
    phLimitDay: 'Hoy se ha llegado al tope de estimaciones (o de gasto) de admira.biz. Vuelve a probar mañana.',
    phTooBig: 'Las fotos pesan demasiado incluso reducidas: prueba con menos.', phOrigin: 'La estimación con fotos solo funciona en www.admira.biz y www.admira.store: abre este plano allí.',
    phOff: 'La estimación con fotos está desactivada ahora mismo.', phQuotaDown: 'El control de cupo del estimador no responde: por seguridad no se estima. Vuelve a probar en unos minutos.',
    phTimeout: 'Gemini no ha respondido a tiempo. Vuelve a probar, quizá con menos fotos.', phInvalid: 'Gemini ha devuelto una estimación incoherente. Prueba con otras fotos.',
    phBusy: 'Gemini no está disponible ahora mismo. Vuelve a probar en unos minutos.', phError: 'No se pudo estimar el Xpacio.',
    phNetwork: 'No se pudo conectar con el estimador (api.admira.store).',
    noImagen: f => `«${f}» no es una imagen ni un vídeo.`, imagenGrande: f => `«${f}» pesa más de 40 MB.`, videoGrande: f => `«${f}» pesa más de 1 GB.`,
    soloVideo: () => 'Con un vídeo se usan solo sus fotogramas: el resto de ficheros se ignora.', maxFotos: f => `«${f}»: ya hay ${MAX_FOTOS} fotos.`,
    phDecode: f => `No se pudo leer «${f}» en este navegador (prueba con JPG o PNG).`, phVideoError: f => `No se pudo leer el vídeo «${f}» en este navegador (prueba con MP4).`,
    phHead: (t, m2, c) => `${t} · ${m2} m² · confianza ${c} %`,
    phDims: r => `${fmt(r.ancho)} × ${fmt(r.largo)} m y ${fmt(r.alto)} m de alto · confianza: ancho ${pct(r.confianza.ancho)} %, largo ${pct(r.confianza.largo)} %, alto ${pct(r.confianza.alto)} %`,
    phSeen: r => `Visto en las fotos: ${r.huecosEstimados} ${r.huecosEstimados === 1 ? 'hueco' : 'huecos'}, ${r.mueblesEstimados} ${r.mueblesEstimados === 1 ? 'mueble' : 'muebles'} y ${r.pantallasEstimadas} ${r.pantallasEstimadas === 1 ? 'pantalla estimada' : 'pantallas estimadas'}`,
    phAdded: r => `Completado según el tipo: ${r.huecos - r.huecosEstimados} ${r.huecos - r.huecosEstimados === 1 ? 'hueco' : 'huecos'}, ${r.muebles - r.mueblesEstimados} ${r.muebles - r.mueblesEstimados === 1 ? 'mueble' : 'muebles'} y ${r.pantallas - r.pantallasEstimadas} ${r.pantallas - r.pantallasEstimadas === 1 ? 'pantalla' : 'pantallas'} en propuesta`,
    phRefs: 'Referencias de tamaño', phModelNotes: m => `Notas de ${m}`, phDiscarded: n => `${n} ${n === 1 ? 'elemento descartado' : 'elementos descartados'} por incoherente${n === 1 ? '' : 's'}`,
    phFrom: (m, n) => `${m} · ${n} ${n === 1 ? 'foto' : 'fotos'}`, phSimulated: 'Respuesta simulada (?simula=1): no se ha llamado a Gemini.',
    photoLine: m => `Plano estimado en este navegador · desde fotos, con ${m}`,
    crType: 'Tipo de Xpacio', crWidth: 'Ancho', crLength: 'Largo', crManual: 'Crear con estas medidas', crTotal: 'Creación total', crApply: 'Usar este plano',
    crNote: 'Plano generado en este navegador · inventado, no es un levantamiento.',
    crArea: (m2, t) => `≈ ${m2} m² · ancho = fachada, largo = fondo · media del tipo: ${t.m2[1]} m² (${t.m2[0]}–${t.m2[2]})`,
    crPreview: r => `${fmt(r.ancho)} × ${fmt(r.largo)} m y ${fmt(r.alto)} m de alto · ${r.puertas} ${r.puertas === 1 ? 'puerta' : 'puertas'}${r.escaparates ? ' y escaparate' : ''} · ${r.muebles} ${r.muebles === 1 ? 'mueble' : 'muebles'} · ${r.pantallas} ${r.pantallas === 1 ? 'pantalla' : 'pantallas'} en propuesta`,
    crSeed: n => `semilla ${n}`, crTotalNote: 'medidas sorteadas', crManualNote: 'medidas indicadas',
    crDone: 'Plano generado y guardado en este navegador.', generatedLine: 'Plano generado en este navegador · inventado',
    upTitle: 'Subir plano', upHint: 'El plano en JSON (admira.xpacio-plano/1), o una imagen o un PDF como calco bajo la planta.',
    upDrop: 'Suelta aquí el fichero o pulsa para elegirlo', upRoom: 'Sala del Xpacio nuevo', upName: 'Nombre', upWidth: 'Ancho', upDepth: 'Fondo', upHeight: 'Alto',
    upMetres: 'Medidas en metros. Cuatro paredes; las pantallas se añaden en Propuesta de obra.', upCancel: 'Descartar',
    upNote: 'Plano subido en este navegador; el maestro del ITIL es Yokup.', upReading: 'Leyendo el fichero…', upPdf: 'Abriendo el PDF (página 1)…',
    upPdfError: 'No se pudo leer el PDF.', upImageError: 'No se pudo leer la imagen.', upJsonError: 'No se pudo leer el fichero.',
    upApplyPlan: 'Aplicar plano', upApplyTrace: 'Poner como calco', upApplyRoom: 'Crear sala y poner calco',
    upSummary: r => `${r.paredes} paredes · ${r.pantallas} ${r.pantallas === 1 ? 'pantalla' : 'pantallas'} · sala de ${fmt(r.ancho)} × ${fmt(r.fondo)} m y ${fmt(r.alto)} m de alto`,
    upMore: n => `… y ${n} ${n === 1 ? 'aviso más' : 'avisos más'}`, upPlanWarnings: 'Avisos del plano (no impiden aplicarlo):',
    upDone: 'Plano aplicado y guardado en este navegador.', upTraceDone: 'Calco puesto bajo la planta.', upNotStored: 'No se pudo guardar en este navegador: se perderá al recargar.',
    upConfirmDraft: 'Hay una propuesta de obra en borrador para este Xpacio. Al cambiar de plano se descarta. ¿Seguir?', upOpening: id => `Abriendo el plano de «${id}»…`,
    uploadedLine: 'Plano subido en este navegador', traceLine: 'Calco en este navegador', backPublished: 'Volver al plano publicado', deleteUploaded: 'Borrar plano subido',
    traceTitle: 'Calco', traceWidth: 'Ancho real (m)', traceOpacity: 'Opacidad', traceRemove: 'Quitar calco', noStore: 'Este navegador no deja guardar planos: lo que subas dura hasta recargar.'
  },
  en: {
    back: '← Back to the profile', backYokup: '← View in Yokup (ITIL)', eyebrow: 'Xpace floor plan · ITIL inventory', current: 'Current layout', works: 'Works proposal',
    modes: 'Which layout to show', loading: 'Loading the floor plan…', noPlan: 'This Xpace has no floor plan yet.', loadError: 'The floor plan could not be loaded.',
    plan: 'Floor plan', planHint: 'Click a wall to see its elevation', elevation: 'Elevation', planAria: 'Floor plan', elevationAria: 'Wall elevation',
    dragHint: 'Drag a screen in the elevation or move it with the arrow keys (Shift: 10 cm). Mosaics move as a whole unless you turn it off.',
    inventory: 'ITIL inventory · screens', selected: 'Selected screen',
    order: 'Work order', export: 'Download work order (JSON)', add: 'Add', addVertical: '▯ Portrait 55″', addHorizontal: '▭ Landscape 55″', addH: '▯▭▯ H mosaic', addMosaic: '▯▭▯▯▭▯ Double-H mosaic',
    reset: 'Back to the current layout', proposalName: 'Proposal name', defaultTitle: 'Works proposal',
    orderNote: 'Draft stored in this browser. CI additions and removals are applied in Yokup, the ITIL master, once the works are approved and done. Work order lines are in Spanish.',
    saved: 'Draft saved in this browser', notSaved: 'The draft could not be saved in this browser',
    thItil: 'ITIL CI', thName: 'Screen', thType: 'Format', thGroup: 'Mosaic · player', thWall: 'Wall', thCenter: 'Centre', thBase: 'Base', thSize: 'Size', thState: 'Status',
    screens: n => `${n} ${n === 1 ? 'screen' : 'screens'}`, pending: 'to match', vertical: 'portrait', horizontal: 'landscape',
    name: 'Name', wall: 'Wall', center: 'Centre from the left (m)', base: 'Bottom above the floor (m)', orientation: 'Orientation', inches: 'Diagonal (″)',
    shopWindow: 'Shop-window screen (faces the street)', groupLock: n => `Move the whole mosaic (${n} screens)`, ungroup: 'Detach from the mosaic',
    removeGroup: n => `Remove the whole mosaic (${n})`, remove: 'Remove this screen', restore: 'Undo changes to this screen', propose: 'Propose changes',
    noIssues: 'No conflicts in the plan.', noActions: 'The proposal matches the current layout: no works needed.',
    summary: r => ['alta', 'baja', 'modificacion', 'sustitucion', 'contenidos'].filter(k => r[k]).map(k => `${r[k]} ${({ alta: ['addition', 'additions'], baja: ['removal', 'removals'], modificacion: ['change', 'changes'], sustitucion: ['replacement', 'replacements'], contenidos: ['content update', 'content updates'] })[k][r[k] > 1 ? 1 : 0]}`).join(' · '),
    types: { alta: 'New', baja: 'Removal', modificacion: 'Change', sustitucion: 'Replacement', contenidos: 'Content' }, inventoryLine: 'Inventory', contentLine: 'Content',
    removed: 'removed', unchanged: 'unchanged', criterion: m => `criterion: bottom at ${m} m`, wallOf: (w, l, h) => `${w} · ${l} m long · ${h} m high`,
    source: 'Source', model: 'Model', state: 'Status', size: 'Size', player: 'Player', screenId: 'Screen in admira.studio', group: 'Mosaic',
    devices: 'Players and devices · ITIL', thDevice: 'Device', thKind: 'Type', thRole: 'Role',
    // ▤ Upload floor plan
    noPlanUpload: 'This Xpace has no floor plan yet: upload or create it from ▤ Advanced mode.', openUpload: '▤ Upload floor plan', openCreate: '▤ Create Xpace',
    crTitle: 'Xpace creation', crHint: 'To register Xpaces we will not be able to visit: at random by type, with their floor plan or with photos or video of the premises.',
    crTabs: 'How to create the Xpace', crTabRandom: 'Random', crTabPlan: 'With a floor plan', crTabPhoto: 'With photo or video',
    crRandomHint: 'Choose the type and the sizes, or “Full creation” to draw them from the type average.',
    crPlanText: 'If you have the Xpace floor plan (JSON, image or PDF), upload it with “Upload floor plan”, just above: an image or a PDF works as a trace for a new room.', crGoUpload: 'Go to Upload floor plan',
    crPhotoText: 'Upload up to 8 photos of the premises or a video walking through them. Gemini estimates the sizes from known objects (doors, 27″ or 55″ screens, 20 cm floor tiles, counters) and places doors, furniture and screens; the generator completes the rest by type.',
    phDrop: 'Drop photos or a video here, or click to choose them', phTypes: 'Up to 8 photos · or 1 video (6–8 frames are taken here)',
    phNotes: 'Hints (optional)', phNotesPh: 'E.g.: the entrance is the glass door; the ceiling is 3 m high', phEstimate: 'Estimate the Xpace',
    phPrivacy: 'Photos go to Gemini (Google) through the Admira worker only to estimate: they are not stored. The floor plan stays in this browser, marked as estimated.',
    phReading: 'Preparing the photos…', phFrames: (i, n) => `Taking frames from the video… ${i}/${n}`,
    phCount: (n, video) => video ? `${n} frames from “${video}”` : `${n} of ${MAX_FOTOS} photos`, phRemove: n => `Remove photo ${n}`, phClear: 'Remove all',
    phWorking: sec => `Gemini is estimating the Xpace… ${sec} s (it usually takes 1 to 2 minutes)`,
    phDone: 'Estimate ready: check the preview and click “Use this floor plan”.', phApplied: 'Estimated floor plan saved in this browser.',
    phLimitIp: 'You have reached today’s estimate limit from this connection. Try again tomorrow.',
    phLimitDay: 'admira.biz has reached today’s estimate (or spending) limit. Try again tomorrow.',
    phTooBig: 'The photos are too heavy even after resizing: try fewer.', phOrigin: 'Estimating from photos only works on www.admira.biz and www.admira.store: open this floor plan there.',
    phOff: 'Estimating from photos is switched off right now.', phQuotaDown: 'The estimator quota control is not answering: to be safe, nothing is estimated. Try again in a few minutes.',
    phTimeout: 'Gemini did not answer in time. Try again, maybe with fewer photos.', phInvalid: 'Gemini returned an inconsistent estimate. Try other photos.',
    phBusy: 'Gemini is not available right now. Try again in a few minutes.', phError: 'The Xpace could not be estimated.',
    phNetwork: 'Could not reach the estimator (api.admira.store).',
    noImagen: f => `“${f}” is not an image or a video.`, imagenGrande: f => `“${f}” is larger than 40 MB.`, videoGrande: f => `“${f}” is larger than 1 GB.`,
    soloVideo: () => 'With a video only its frames are used: the other files are ignored.', maxFotos: f => `“${f}”: there are already ${MAX_FOTOS} photos.`,
    phDecode: f => `“${f}” could not be read in this browser (try JPG or PNG).`, phVideoError: f => `The video “${f}” could not be read in this browser (try MP4).`,
    phHead: (t, m2, c) => `${t} · ${m2} m² · confidence ${c} %`,
    phDims: r => `${fmt(r.ancho)} × ${fmt(r.largo)} m, ${fmt(r.alto)} m high · confidence: width ${pct(r.confianza.ancho)} %, length ${pct(r.confianza.largo)} %, height ${pct(r.confianza.alto)} %`,
    phSeen: r => `Seen in the photos: ${r.huecosEstimados} ${r.huecosEstimados === 1 ? 'opening' : 'openings'}, ${r.mueblesEstimados} furniture ${r.mueblesEstimados === 1 ? 'item' : 'items'} and ${r.pantallasEstimadas} estimated ${r.pantallasEstimadas === 1 ? 'screen' : 'screens'}`,
    phAdded: r => `Completed by type: ${r.huecos - r.huecosEstimados} ${r.huecos - r.huecosEstimados === 1 ? 'opening' : 'openings'}, ${r.muebles - r.mueblesEstimados} furniture ${r.muebles - r.mueblesEstimados === 1 ? 'item' : 'items'} and ${r.pantallas - r.pantallasEstimadas} proposed ${r.pantallas - r.pantallasEstimadas === 1 ? 'screen' : 'screens'}`,
    phRefs: 'Size references', phModelNotes: m => `${m} notes`, phDiscarded: n => `${n} inconsistent ${n === 1 ? 'element' : 'elements'} discarded`,
    phFrom: (m, n) => `${m} · ${n} ${n === 1 ? 'photo' : 'photos'}`, phSimulated: 'Simulated answer (?simula=1): Gemini was not called.',
    photoLine: m => `Floor plan estimated in this browser · from photos, with ${m}`,
    crType: 'Xpace type', crWidth: 'Width', crLength: 'Length', crManual: 'Create with these sizes', crTotal: 'Full creation', crApply: 'Use this floor plan',
    crNote: 'Floor plan generated in this browser · made up, not a survey.',
    crArea: (m2, t) => `≈ ${m2} m² · width = frontage, length = depth · type average: ${t.m2[1]} m² (${t.m2[0]}–${t.m2[2]})`,
    crPreview: r => `${fmt(r.ancho)} × ${fmt(r.largo)} m, ${fmt(r.alto)} m high · ${r.puertas} ${r.puertas === 1 ? 'door' : 'doors'}${r.escaparates ? ' and shop window' : ''} · ${r.muebles} furniture ${r.muebles === 1 ? 'item' : 'items'} · ${r.pantallas} proposed ${r.pantallas === 1 ? 'screen' : 'screens'}`,
    crSeed: n => `seed ${n}`, crTotalNote: 'random sizes', crManualNote: 'given sizes',
    crDone: 'Floor plan generated and saved in this browser.', generatedLine: 'Floor plan generated in this browser · made up',
    upTitle: 'Upload floor plan', upHint: 'The floor plan as JSON (admira.xpacio-plano/1), or an image or a PDF as a trace under the plan.',
    upDrop: 'Drop the file here or click to choose it', upRoom: 'Room of the new Xpace', upName: 'Name', upWidth: 'Width', upDepth: 'Depth', upHeight: 'Height',
    upMetres: 'Sizes in metres. Four walls; add the screens in Works proposal.', upCancel: 'Discard',
    upNote: 'Floor plan uploaded to this browser; Yokup is the ITIL master.', upReading: 'Reading the file…', upPdf: 'Opening the PDF (page 1)…',
    upPdfError: 'The PDF could not be read.', upImageError: 'The image could not be read.', upJsonError: 'The file could not be read.',
    upApplyPlan: 'Apply floor plan', upApplyTrace: 'Use as trace', upApplyRoom: 'Create room and add trace',
    upSummary: r => `${r.paredes} walls · ${r.pantallas} ${r.pantallas === 1 ? 'screen' : 'screens'} · room of ${fmt(r.ancho)} × ${fmt(r.fondo)} m, ${fmt(r.alto)} m high`,
    upMore: n => `… and ${n} more ${n === 1 ? 'warning' : 'warnings'}`, upPlanWarnings: 'Floor plan warnings (they do not block it):',
    upDone: 'Floor plan applied and saved in this browser.', upTraceDone: 'Trace placed under the plan.', upNotStored: 'It could not be saved in this browser: it will be lost on reload.',
    upConfirmDraft: 'There is a draft works proposal for this Xpace. Changing the floor plan discards it. Continue?', upOpening: id => `Opening the floor plan of “${id}”…`,
    uploadedLine: 'Floor plan uploaded to this browser', traceLine: 'Trace in this browser', backPublished: 'Back to the published plan', deleteUploaded: 'Delete uploaded plan',
    traceTitle: 'Trace', traceWidth: 'Real width (m)', traceOpacity: 'Opacity', traceRemove: 'Remove trace', noStore: 'This browser does not allow saving floor plans: uploads last until you reload.'
  }
};

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const U = 100; // unidades SVG por metro
const params = new URLSearchParams(location.search);
const LANGUAGE_KEY = (window.ADMIRA_SITE_BRAND?.id || 'clearchannel') + '-lang';
let savedLang = '';
try { savedLang = localStorage.getItem(LANGUAGE_KEY) || ''; } catch {}
let lang = localeFor(location.hostname, location.search, savedLang);
const tr = (key, ...args) => { const v = copy[lang][key]; return typeof v === 'function' ? v(...args) : v; };
const fmt = n => round(n).toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = v => Math.round((Number(v) || 0) * 100);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const xpacioId = /^[a-z0-9][a-z0-9-]{0,79}$/.test(params.get('locationId') || '') ? params.get('locationId') : 'alsea-sbux-021';
const STORE_KEY = 'admira.plano.' + xpacioId;
let plan = null;
const state = { mode: 'actual', wallId: null, selectedId: null, proposal: null, statusKey: 'loading', groupLock: true };
// Plano publicado (data/xpacios/<id>.json: 'ok' | 'none' | 'error') y lo subido en este navegador (IndexedDB).
const almacen = almacenPlanos();
let publicado = null, publicadoEstado = 'none', registro = null;
const calcoActual = () => (plan && registro && registro.calco) || null;
let calcoNode = { src: '', node: null };
// Escala de rótulos, trazos finos y márgenes (--k en plano.css): 1 en un local de 14 m como
// Starbucks; en una sala pequeña, proporcional, para que se lean igual en pantalla.
let K = 1;
const scaleOf = p => {
  const xs = p.paredes.flatMap(w => [w.a[0], w.b[0]]), ys = p.paredes.flatMap(w => [w.a[1], w.b[1]]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return Math.min(1, Math.max(0.2, round(span / 14, 3)));
};
// Conos de visión y rótulos de mosaico: más cortos en salas pequeñas, sin bajar de un tercio.
const coneScale = () => Math.max(K, 0.35);

function el(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, v);
  if (parent) parent.append(node);
  return node;
}
function text(parent, x, y, value, cls, extra = {}) { const t = el('text', { x, y, class: cls, ...extra }, parent); t.textContent = value; return t; }

const screens = () => state.mode === 'obra' ? state.proposal.propuesta : plan.pantallas;
const original = id => plan.pantallas.find(s => s.id === id);
const wallById = id => plan.paredes.find(w => w.id === id);
const wallName = id => { const w = wallById(id); return w ? (w.nombre || w.id) : id; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function setStatus(key) { state.statusKey = key; $('page-status').textContent = key ? tr(key) : ''; }

function translate() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-copy]').forEach(n => { n.textContent = tr(n.dataset.copy); });
  document.querySelectorAll('[data-copy-aria]').forEach(n => n.setAttribute('aria-label', tr(n.dataset.copyAria)));
  document.querySelectorAll('[data-copy-placeholder]').forEach(n => n.setAttribute('placeholder', tr(n.dataset.copyPlaceholder)));
  if (state.statusKey) setStatus(state.statusKey);
}

// ── Propuesta ────────────────────────────────────────────────────────────────
let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!plan || !state.proposal) return;
    let ok = true;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(exportOrder(plan, state.proposal.propuesta, { titulo: state.proposal.titulo }))); } catch { ok = false; }
    $('saved').textContent = tr(ok ? 'saved' : 'notSaved');
  }, 250);
}
const copyOf = list => JSON.parse(JSON.stringify(list));
function freshProposal() { return { titulo: tr('defaultTitle'), propuesta: copyOf(plan.pantallas) }; }
function loadProposal() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY)); } catch {}
  return restoreProposal(saved, plan) || freshProposal();
}
function setProposal(list) { state.proposal.propuesta = list; persist(); }
function updateScreen(id, patch, { clamp = true } = {}) {
  setProposal(state.proposal.propuesta.map(s => {
    if (s.id !== id) return s;
    const next = { ...s, ...patch };
    return clamp ? clampToWall(plan, next) : next;
  }));
}
// Ids que se mueven juntos con la pantalla `id`: su mosaico, si el candado está puesto.
function movingIds(id, list = screens()) {
  const s = list.find(x => x.id === id);
  if (!s) return [];
  return state.groupLock && s.grupo ? groupOf(list, s.grupo).map(x => x.id) : [id];
}
function moveFrom(snapshot, id, ds, dz, pared) {
  const ids = movingIds(id, snapshot);
  setProposal(moveGroup(plan, snapshot, ids, { ds, dz, pared }));
}

// ── Planta ───────────────────────────────────────────────────────────────────
function renderPlanta() {
  const svg = $('planta');
  svg.replaceChildren();
  const xs = plan.paredes.flatMap(w => [w.a[0], w.b[0]]), ys = plan.paredes.flatMap(w => [w.a[1], w.b[1]]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), m = 90 * K;
  svg.setAttribute('viewBox', `${minX * U - m} ${minY * U - m} ${(maxX - minX) * U + 2 * m} ${(maxY - minY) * U + 2 * m}`);
  el('polygon', { class: 'floor', points: plan.paredes.map(w => `${w.a[0] * U},${w.a[1] * U}`).join(' ') }, svg);
  // Calco subido: sobre el suelo y debajo de paredes, muebles y pantallas; no recibe el puntero.
  // El nodo se reutiliza entre renders (arrastrar repinta la planta): la imagen no se vuelve a decodificar.
  const calco = calcoActual();
  if (calco) {
    if (calcoNode.src !== calco.dataUrl) calcoNode = { src: calco.dataUrl, node: el('image', { class: 'calco-img', href: calco.dataUrl, preserveAspectRatio: 'none', 'pointer-events': 'none', 'aria-hidden': 'true' }) };
    const g = geometriaCalco(calco, plan);
    for (const [k, v] of Object.entries({ x: g.x * U, y: g.y * U, width: g.width * U, height: g.height * U, opacity: calco.opacidad })) calcoNode.node.setAttribute(k, v);
    svg.append(calcoNode.node);
  }

  for (const f of plan.mobiliario || []) {
    el('rect', { class: 'furniture', x: f.x * U, y: f.y * U, width: f.w * U, height: f.d * U, rx: 6 }, svg);
    furnitureLabel(svg, f);
  }
  for (const w of plan.paredes) {
    el('line', { class: 'wall' + (w.id === state.wallId ? ' active' : ''), x1: w.a[0] * U, y1: w.a[1] * U, x2: w.b[0] * U, y2: w.b[1] * U }, svg);
  }
  for (const h of plan.huecos || []) {
    const w = wallById(h.pared); if (!w) continue;
    const p0 = pointOnWall(w, h.desde), p1 = pointOnWall(w, h.desde + h.ancho);
    if (h.tipo === 'puerta') {
      el('line', { class: 'gap-door', x1: p0[0] * U, y1: p0[1] * U, x2: p1[0] * U, y2: p1[1] * U }, svg);
      const [nx, ny] = inwardNormal(w), r = h.ancho * U;
      const tip = [p0[0] * U + nx * r, p0[1] * U + ny * r];
      el('path', { class: 'door-arc', d: `M${tip[0]},${tip[1]} A${r},${r} 0 0 1 ${p1[0] * U},${p1[1] * U}` }, svg);
      el('line', { class: 'door-arc', x1: p0[0] * U, y1: p0[1] * U, x2: tip[0], y2: tip[1] }, svg);
    } else {
      el('line', { class: 'gap-glass', x1: p0[0] * U, y1: p0[1] * U, x2: p1[0] * U, y2: p1[1] * U }, svg);
    }
  }
  // Zona de clic de cada pared y su rótulo por fuera.
  for (const w of plan.paredes) {
    const hit = el('line', { class: 'wall-hit', x1: w.a[0] * U, y1: w.a[1] * U, x2: w.b[0] * U, y2: w.b[1] * U, tabindex: 0, role: 'button', 'aria-label': `${tr('elevation')} · ${w.nombre || w.id}` }, svg);
    hit.addEventListener('click', () => selectWall(w.id));
    hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectWall(w.id); } });
    const mid = pointOnWall(w, wallLength(w) / 2), [nx, ny] = inwardNormal(w);
    const lx = mid[0] * U - nx * 45 * K, ly = mid[1] * U - ny * 45 * K + 7 * K;
    const vertical = Math.abs(nx) > Math.abs(ny);
    text(svg, lx, ly, `${w.nombre || w.id} · ${fmt(wallLength(w))} m`, 'wall-label', { 'text-anchor': 'middle', transform: vertical ? `rotate(-90 ${lx} ${ly})` : null });
  }
  const errors = errorIds();
  if (state.mode === 'obra') {
    for (const s of plan.pantallas) {
      const now = screens().find(x => x.id === s.id);
      if (!now || now.pared !== s.pared || Math.abs(now.s - s.s) > 0.005) drawPlanScreen(svg, s, { ghost: true });
    }
  }
  for (const s of screens()) drawPlanScreen(svg, s, { error: errors.has(s.id) });
  // Rótulos más allá del cono de visión: uno por mosaico y uno por pantalla suelta.
  const labels = new Map();
  for (const s of screens()) {
    const key = s.grupo ? 'g:' + s.grupo + ':' + s.pared : 's:' + s.id;
    if (!labels.has(key)) labels.set(key, { wall: s.pared, name: s.grupo ? (s.grupoNombre || s.grupo) : shortName(s), group: !!s.grupo, fs: [] });
    labels.get(key).fs.push(footprint(s));
  }
  for (const { wall, name, group, fs } of labels.values()) {
    const w = wallById(wall); if (!w) continue;
    const mid = (Math.min(...fs.map(f => f.x0)) + Math.max(...fs.map(f => f.x1))) / 2;
    const c = pointOnWall(w, mid), [nx, ny] = inwardNormal(w), d = 1.65 * U * coneScale();
    const x = c[0] * U + nx * d, y = c[1] * U + ny * d;
    // En una pared vertical de la planta el rótulo va girado, como el de la pared: no invade la sala.
    if (Math.abs(nx) > Math.abs(ny)) text(svg, x + 9 * K, y, name, 'scr-label' + (group ? ' group' : ''), { 'text-anchor': 'middle', transform: `rotate(-90 ${x + 9 * K} ${y})` });
    else text(svg, x, y + 9 * K, name, 'scr-label' + (group ? ' group' : ''), { 'text-anchor': 'middle' });
  }
  drawDevices(svg);
}

// Dispositivos del inventario (players, webcam…): una marca pequeña con su nombre y, en el
// título, su CI ITIL y su rol. Con `s` se sitúa en su pared; un player sin `s`, a la altura de
// las pantallas que mueve (mismo `player`), sobre la mesa; si no, en el centro de su pared.
function devicePlace(d) {
  const w = wallById(d.pared); if (!w) return null;
  let s = Number.isFinite(d.s) ? d.s : null, inward = 0.18;
  if (s === null) {
    // Junto al final de sus pantallas (no encima del rótulo del mosaico) y a 30 cm de la pared.
    const driven = plan.pantallas.filter(x => x.pared === w.id && x.player && x.player === d.nombre);
    s = driven.length ? Math.max(...driven.map(x => footprint(x).x1)) + 0.15 : wallLength(w) / 2;
    inward = 0.3;
  }
  const c = pointOnWall(w, Math.min(Math.max(s, 0), wallLength(w))), [nx, ny] = inwardNormal(w);
  return [c[0] * U + nx * inward * U, c[1] * U + ny * inward * U];
}
function drawDevices(svg) {
  const size = Math.max(10, 40 * K);
  for (const d of plan.dispositivos || []) {
    const p = devicePlace(d); if (!p) continue;
    const iot = d.categoria !== 'player';
    const g = el('g', { class: 'device ' + (iot ? 'iot' : 'player'), 'data-device': d.id }, svg);
    const title = document.createElementNS(NS, 'title');
    title.textContent = [d.nombre, d.itil, d.rol].filter(Boolean).join(' · ');
    g.append(title);
    if (iot) el('circle', { class: 'device-mark', cx: p[0], cy: p[1], r: size / 2 }, g);
    else el('rect', { class: 'device-mark', x: p[0] - size / 2, y: p[1] - size / 2, width: size, height: size, rx: size / 5 }, g);
    text(g, p[0] + size / 2 + 6 * K, p[1] + 8 * K, d.fleet || (iot ? 'Webcam' : d.nombre || d.id), 'device-label');
  }
}

// Rótulo de un mueble en planta. Si no cabe a lo ancho (texto estimado a 0,55 em por carácter):
// en vertical si el mueble es más largo que ancho; si no, con letra más pequeña (hasta el 60 %).
// En los muebles de Starbucks cabe siempre: se pinta como antes.
function furnitureLabel(svg, f) {
  const name = f.nombre || f.id, size = 26 * K, cx = (f.x + f.w / 2) * U, cy = (f.y + f.d / 2) * U;
  const width = n => String(name).length * 0.55 * n;
  if (width(size) <= f.w * U) return text(svg, cx, cy + 7 * K, name, 'furniture-label', { 'text-anchor': 'middle' });
  if (f.d > f.w && width(size) <= f.d * U) return text(svg, cx + 7 * K, cy, name, 'furniture-label', { 'text-anchor': 'middle', transform: `rotate(-90 ${cx + 7 * K} ${cy})` });
  const fit = Math.max(size * 0.6, f.w * U / (String(name).length * 0.55));
  return text(svg, cx, cy + fit / 4, name, 'furniture-label', { 'text-anchor': 'middle', style: `font-size:${round(fit, 2)}px` });
}

function drawPlanScreen(svg, s, { ghost = false, error = false } = {}) {
  const w = wallById(s.pared); if (!w) return;
  const f = footprint(s), [nx, ny] = inwardNormal(w);
  const p0 = pointOnWall(w, f.x0), p1 = pointOnWall(w, f.x1), off = 10, depth = 12;
  const q = (p, d) => `${p[0] * U + nx * d},${p[1] * U + ny * d}`;
  const body = `${q(p0, off)} ${q(p1, off)} ${q(p1, off + depth)} ${q(p0, off + depth)}`;
  if (ghost) { el('polygon', { class: 'scr-ghost', points: body }, svg); return; }
  const g = el('g', { class: groupClass(s, error), 'data-id': s.id }, svg);
  const c = pointOnWall(w, s.s), reach = 1.4 * U * coneScale();
  const cx = c[0] * U + nx * (off + depth), cy = c[1] * U + ny * (off + depth);
  const len = wallLength(w), ux = (w.b[0] - w.a[0]) / len, uy = (w.b[1] - w.a[1]) / len, spread = reach * 0.6;
  el('polygon', { class: 'scr-cone', points: `${q(p0, off + depth)} ${q(p1, off + depth)} ${cx + nx * reach + ux * spread},${cy + ny * reach + uy * spread} ${cx + nx * reach - ux * spread},${cy + ny * reach - uy * spread}` }, g);
  el('polygon', { class: 'scr-body', points: body }, g);
  g.addEventListener('click', () => select(s.id, { wall: true }));
}

// ── Alzado ───────────────────────────────────────────────────────────────────
function renderAlzado() {
  const svg = $('alzado');
  svg.replaceChildren();
  const w = wallById(state.wallId); if (!w) return;
  const len = wallLength(w), alto = w.alto || plan.planta.alto, mL = 70 * K, mT = 50 * K, mB = 80 * K;
  svg.setAttribute('viewBox', `${-mL} ${-mT} ${len * U + mL * 2} ${alto * U + mT + mB}`);
  svg.setAttribute('aria-label', tr('wallOf', w.nombre || w.id, fmt(len), fmt(alto)));
  const Y = z => (alto - z) * U;
  el('rect', { class: 'elev-wall', x: 0, y: 0, width: len * U, height: alto * U }, svg);
  for (const h of (plan.huecos || []).filter(h => h.pared === w.id)) {
    el('rect', { class: h.tipo === 'puerta' ? 'elev-door' : 'elev-glass', x: h.desde * U, y: Y((h.base || 0) + h.alto), width: h.ancho * U, height: h.alto * U }, svg);
    text(svg, (h.desde + h.ancho / 2) * U, Y((h.base || 0) + h.alto) - 10 * K, h.nombre || h.tipo, 'dim', { 'text-anchor': 'middle' });
  }
  const crit = criteria(plan);
  el('line', { class: 'guide', x1: 0, y1: Y(crit.alturaMinima), x2: len * U, y2: Y(crit.alturaMinima) }, svg);
  // Si un mueble más alto que el criterio tapa el arranque de la pared, el rótulo va al otro extremo.
  const startBlocked = (plan.mobiliario || []).some(m => { const p = furnitureAgainstWall(m, w); return p.dist <= crit.profundidadMueble && p.dist >= -0.05 && p.s0 < 1.6 && p.s1 > 0 && m.alto > crit.alturaMinima; });
  text(svg, startBlocked ? len * U - 8 * K : 8 * K, Y(crit.alturaMinima) - 8 * K, tr('criterion', fmt(crit.alturaMinima)), 'guide-label', startBlocked ? { 'text-anchor': 'end' } : {});

  const errors = errorIds();
  if (state.mode === 'obra') {
    for (const s of plan.pantallas.filter(s => s.pared === w.id)) {
      const now = screens().find(x => x.id === s.id);
      if (now && same(now, s)) continue;
      const f = footprint(s);
      el('rect', { class: 'scr-ghost', x: f.x0 * U, y: Y(f.z1), width: f.w * U, height: f.h * U }, svg);
    }
  }
  const sel = screens().find(s => s.id === state.selectedId);
  const moving = new Set(state.mode === 'obra' && sel ? movingIds(sel.id) : []);
  for (const s of screens().filter(s => s.pared === w.id)) {
    const f = footprint(s);
    const g = el('g', { class: groupClass(s, errors.has(s.id)) + (moving.has(s.id) && s.id !== state.selectedId ? ' moving' : ''), 'data-id': s.id, tabindex: 0, role: 'button', 'aria-label': `${s.nombre || s.id} · ${fmt(f.w)}×${fmt(f.h)} m` }, svg);
    el('rect', { class: 'scr-body', x: f.x0 * U, y: Y(f.z1), width: f.w * U, height: f.h * U, rx: 2 }, g);
    text(g, s.s * U, Y(f.z0 + f.h / 2) + 7 * K, shortName(s), 'scr-label', { 'text-anchor': 'middle' });
    g.addEventListener('pointerdown', e => startDrag(e, s.id));
    g.addEventListener('keydown', e => nudge(e, s.id));
    g.addEventListener('focus', () => { if (state.selectedId !== s.id) select(s.id, { keepFocus: true }); });
  }
  // Rótulo de cada mosaico encima del conjunto.
  for (const gId of new Set(screens().filter(s => s.pared === w.id && s.grupo).map(s => s.grupo))) {
    const members = groupOf(screens(), gId).filter(s => s.pared === w.id), fs = members.map(footprint);
    const x0 = Math.min(...fs.map(f => f.x0)), x1 = Math.max(...fs.map(f => f.x1)), top = Math.max(...fs.map(f => f.z1));
    const name = (members.find(s => s.grupoNombre) || {}).grupoNombre || gId;
    text(svg, (x0 + x1) / 2 * U, Y(top) - 14 * K, `${name} · ${composition(screens(), gId)} · ${groupCanvas(screens(), gId).join('×')} px · ${fmt(x1 - x0)} m`, 'scr-label', { 'text-anchor': 'middle' });
  }
  // Muebles delante de la pared: tapan lo que quede por debajo de su altura.
  for (const m of plan.mobiliario || []) {
    const p = furnitureAgainstWall(m, w);
    if (p.dist > crit.profundidadMueble || p.dist < -0.05) continue;
    const s0 = Math.max(0, p.s0), s1 = Math.min(len, p.s1); if (s1 <= s0) continue;
    el('rect', { class: 'elev-furn', x: s0 * U, y: Y(m.alto), width: (s1 - s0) * U, height: m.alto * U }, svg);
    text(svg, (s0 + s1) / 2 * U, Y(m.alto / 2) + 7 * K, m.nombre || m.id, 'furniture-label', { 'text-anchor': 'middle' });
  }
  // Dispositivos con posición en esta pared (la webcam): marca pequeña con su CI en el título.
  for (const d of (plan.dispositivos || []).filter(d => d.pared === w.id && Number.isFinite(d.s) && Number.isFinite(d.z))) {
    const g = el('g', { class: 'device ' + (d.categoria === 'player' ? 'player' : 'iot'), 'data-device': d.id }, svg);
    const title = document.createElementNS(NS, 'title');
    title.textContent = [d.nombre, d.itil, d.rol].filter(Boolean).join(' · ');
    g.append(title);
    el('circle', { class: 'device-mark', cx: d.s * U, cy: Y(d.z), r: Math.max(6, 20 * K) }, g);
  }
  el('line', { class: 'elev-floor', x1: -30 * K, y1: Y(0), x2: len * U + 30 * K, y2: Y(0) }, svg);
  el('line', { class: 'dim-line', x1: 0, y1: Y(0) + 34 * K, x2: len * U, y2: Y(0) + 34 * K }, svg);
  text(svg, len * U / 2, Y(0) + 62 * K, `${fmt(len)} m`, 'dim', { 'text-anchor': 'middle' });
  text(svg, -16 * K, Y(alto / 2), `${fmt(alto)} m`, 'dim', { 'text-anchor': 'middle', transform: `rotate(-90 ${-16 * K} ${Y(alto / 2)})` });
  if (sel && sel.pared === w.id) {
    const f = footprint(sel);
    text(svg, sel.s * U, Y(0) + 26 * K, `↔ ${fmt(sel.s)} m · ↕ ${fmt(sel.z)} m`, 'dim', { 'text-anchor': 'middle' });
    el('line', { class: 'dim-line', x1: sel.s * U, y1: Y(0), x2: sel.s * U, y2: Y(f.z0) }, svg);
  }
}

function renderTabs() {
  $('wall-tabs').replaceChildren(...plan.paredes.map(w => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab');
    const n = screens().filter(s => s.pared === w.id).length;
    b.textContent = (w.nombre || w.id) + (n ? ` (${n})` : '');
    b.setAttribute('aria-selected', String(w.id === state.wallId));
    b.addEventListener('click', () => selectWall(w.id));
    return b;
  }));
}

// ── Inventario e inspector ───────────────────────────────────────────────────
function typeLabel(s) { return `${tr(s.orientacion)} · ${s.pulgadas}″`; }
function groupLabel(s) {
  const parts = [];
  if (s.grupo) parts.push(`${s.grupoNombre || s.grupo}${s.subgrupo ? ' · ' + s.subgrupo : ''}`);
  if (s.player) parts.push(s.player);
  return parts.join(' · ') || '—';
}
function shortName(s) { return s.corto || s.nombre || s.id; }
function groupClass(s, error) {
  return ['scr', !original(s.id) ? 'new' : '', s.id === state.selectedId ? 'selected' : '', error ? 'has-error' : ''].filter(Boolean).join(' ');
}
function changeTags() {
  if (state.mode !== 'obra') return new Map();
  const tags = new Map();
  for (const a of workOrder(plan, state.proposal.propuesta).acciones) {
    if (a.tipo === 'contenidos') continue;
    if (a.grupo) groupOf(a.tipo === 'baja' ? plan.pantallas : state.proposal.propuesta, a.grupo).forEach(s => tags.set(s.id, a.tipo));
    else tags.set(a.pantalla, a.tipo);
  }
  return tags;
}
function errorIds() {
  return new Set(validate(plan, screens()).filter(i => i.nivel === 'error').map(i => i.pantalla));
}

function renderInventory() {
  const tags = changeTags();
  const rows = screens().map(s => ({ s, tag: tags.get(s.id) }));
  if (state.mode === 'obra') for (const s of plan.pantallas) if (!screens().some(x => x.id === s.id)) rows.push({ s, tag: 'baja', removed: true });
  const head = `<thead><tr><th>${tr('thItil')}</th><th>${tr('thName')}</th><th>${tr('thType')}</th><th>${tr('thGroup')}</th><th>${tr('thWall')}</th><th>${tr('thCenter')}</th><th>${tr('thBase')}</th><th>${tr('thSize')}</th><th>${tr('thState')}</th></tr></thead>`;
  const body = rows.map(({ s, tag, removed }) => {
    const g = screenGeometry(s);
    const status = state.mode === 'obra' ? `<span class="tag ${tag || ''}">${tag ? (removed ? tr('removed') : tr('types')[tag]) : tr('unchanged')}</span>` : esc(s.estado || '');
    return `<tr data-id="${esc(s.id)}" aria-selected="${s.id === state.selectedId}"${removed ? ' data-removed="1"' : ''}>
      <td>${s.itil ? `<code>${esc(s.itil)}</code>` : `<span class="tag">${tr('pending')}</span>`}</td><td>${removed ? `<s>${esc(s.nombre || s.id)}</s>` : esc(s.nombre || s.id)}</td>
      <td>${esc(typeLabel(s))} · ${g.lienzo.join('×')}</td><td>${esc(groupLabel(s))}</td><td>${esc(wallName(s.pared))}</td><td>${fmt(s.s)} m</td><td>${fmt(s.z)} m</td>
      <td>${fmt(g.w)}×${fmt(g.h)} m</td><td>${status}</td></tr>`;
  }).join('');
  $('inventory').innerHTML = head + `<tbody>${body}</tbody>`;
  $('inv-count').textContent = tr('screens', screens().length);
  renderDevices();
  $('inventory').querySelectorAll('tbody tr').forEach(row => row.addEventListener('click', () => select(row.dataset.id, { wall: true })));
}

// Players, webcam y demás CI del Xpacio que no son pantallas (bloque `dispositivos`).
function renderDevices() {
  const list = Array.isArray(plan.dispositivos) ? plan.dispositivos : [];
  $('devices').hidden = !list.length;
  if (!list.length) { $('devices').replaceChildren(); return; }
  const rows = list.map(d => `<tr><td>${d.itil ? `<code>${esc(d.itil)}</code>` : `<span class="tag">${tr('pending')}</span>`}</td><td>${esc(d.nombre || d.id)}</td>
    <td>${esc(d.categoria === 'player' ? tr('player') : d.categoria === 'iot' ? 'IoT' : d.categoria || '—')}</td><td>${esc(d.pared ? wallName(d.pared) : '—')}</td><td>${esc(d.rol || '')}</td></tr>`).join('');
  $('devices').innerHTML = `<h3>${esc(tr('devices'))}</h3><table><thead><tr><th>${tr('thItil')}</th><th>${tr('thDevice')}</th><th>${tr('thKind')}</th><th>${tr('thWall')}</th><th>${tr('thRole')}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function facts(s) {
  const g = screenGeometry(s);
  const line = (k, v) => v ? `<br><b>${tr(k)}:</b> ${esc(v)}` : '';
  return `<p class="facts"><b>${tr('thItil')}:</b> ${s.itil ? esc(s.itil) : tr('pending')}${line('screenId', s.screenId)}${line('group', s.grupo ? `${s.grupoNombre || s.grupo}${s.subgrupo ? ' · ' + s.subgrupo : ''}` : '')}${line('player', s.player)}${line('model', s.modelo)}
    <br><b>${tr('size')}:</b> ${fmt(g.w)}×${fmt(g.h)} m · ${g.lienzo.join('×')} px${line('state', s.estado)}${line('source', s.fuente)}</p>`;
}

function renderInspector() {
  const box = $('inspector'), body = $('inspector-body');
  const s = screens().find(x => x.id === state.selectedId);
  const removed = state.mode === 'obra' && !s ? original(state.selectedId) : null;
  box.hidden = !s && !removed;
  if (box.hidden) { body.replaceChildren(); return; }
  if (removed) {
    body.innerHTML = facts(removed) + `<p class="facts">${tr('removed')}</p><div class="buttons"><button type="button" id="insp-restore">${tr('restore')}</button></div>`;
    $('insp-restore').addEventListener('click', () => { setProposal(state.proposal.propuesta.concat(copyOf([removed]))); state.wallId = removed.pared; renderAll(); });
    return;
  }
  if (state.mode !== 'obra') {
    body.innerHTML = facts(s) + `<p class="facts">${esc(typeLabel(s))} · ${esc(wallName(s.pared))} · ↔ ${fmt(s.s)} m · ↕ ${fmt(s.z)} m</p><div class="buttons"><button type="button" id="insp-propose">${tr('propose')}</button></div>`;
    $('insp-propose').addEventListener('click', () => setMode('obra'));
    return;
  }
  const members = s.grupo ? groupOf(screens(), s.grupo) : [];
  const wallOptions = plan.paredes.map(w => `<option value="${esc(w.id)}"${w.id === s.pared ? ' selected' : ''}>${esc(w.nombre || w.id)}</option>`).join('');
  const inchOptions = [32, 43, 49, 55, 65, 75, 86, 98].map(n => `<option value="${n}"${n === s.pulgadas ? ' selected' : ''}>${n}″</option>`).join('');
  body.innerHTML = facts(s) + `
    ${members.length > 1 ? `<label class="check"><input id="f-lock" type="checkbox"${state.groupLock ? ' checked' : ''}>${esc(tr('groupLock', members.length))}</label>` : ''}
    <label>${tr('name')}<input id="f-name" maxlength="60" value="${esc(s.nombre || '')}"></label>
    <label>${tr('wall')}<select id="f-wall">${wallOptions}</select></label>
    <div class="row"><label>${tr('center')}<input id="f-s" type="number" step="0.01" value="${round(s.s)}"></label><label>${tr('base')}<input id="f-z" type="number" step="0.01" value="${round(s.z)}"></label></div>
    <div class="row"><label>${tr('orientation')}<select id="f-orient"><option value="vertical"${s.orientacion === 'vertical' ? ' selected' : ''}>${tr('vertical')}</option><option value="horizontal"${s.orientacion === 'horizontal' ? ' selected' : ''}>${tr('horizontal')}</option></select></label>
      <label>${tr('inches')}<select id="f-inches">${inchOptions}</select></label></div>
    <label class="check"><input id="f-window" type="checkbox"${s.escaparate ? ' checked' : ''}>${tr('shopWindow')}</label>
    <div class="buttons">
      ${original(s.id) && !same(original(s.id), s) ? `<button type="button" id="insp-restore">${tr('restore')}</button>` : ''}
      ${s.grupo ? `<button type="button" id="insp-ungroup">${tr('ungroup')}</button>` : ''}
      <button type="button" id="insp-remove" class="danger">${tr('remove')}</button>
      ${members.length > 1 ? `<button type="button" id="insp-remove-group" class="danger">${esc(tr('removeGroup', members.length))}</button>` : ''}
    </div>`;
  const on = (id, ev, fn) => { const n = $(id); if (n) n.addEventListener(ev, fn); };
  const snap = () => copyOf(state.proposal.propuesta);
  on('f-lock', 'change', e => { state.groupLock = e.target.checked; renderAll(); });
  on('f-name', 'change', e => { updateScreen(s.id, { nombre: e.target.value.trim() || s.nombre }, { clamp: false }); renderAll(); });
  on('f-wall', 'change', e => { moveFrom(snap(), s.id, 0, 0, e.target.value); state.wallId = e.target.value; renderAll(); });
  on('f-s', 'change', e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) moveFrom(snap(), s.id, v - s.s, 0); renderAll(); });
  on('f-z', 'change', e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) moveFrom(snap(), s.id, 0, v - s.z); renderAll(); });
  on('f-orient', 'change', e => { updateScreen(s.id, reshape(s, { orientacion: e.target.value })); renderAll(); });
  on('f-inches', 'change', e => { updateScreen(s.id, reshape(s, { pulgadas: Number(e.target.value) })); renderAll(); });
  on('f-window', 'change', e => { updateScreen(s.id, { escaparate: e.target.checked }, { clamp: false }); renderAll(); });
  on('insp-ungroup', 'click', () => { updateScreen(s.id, { grupo: undefined, grupoNombre: undefined, subgrupo: undefined }, { clamp: false }); renderAll(); });
  on('insp-remove', 'click', () => { setProposal(state.proposal.propuesta.filter(x => x.id !== s.id)); if (!original(s.id)) state.selectedId = null; renderAll(); });
  on('insp-remove-group', 'click', () => { const ids = new Set(members.map(x => x.id)); setProposal(state.proposal.propuesta.filter(x => !ids.has(x.id))); if (!original(s.id)) state.selectedId = null; renderAll(); });
  on('insp-restore', 'click', () => { const o = original(s.id); updateScreen(s.id, copyOf(o), { clamp: false }); state.wallId = o.pared; renderAll(); });
}

// ── Orden de obra ────────────────────────────────────────────────────────────
function renderOrder() {
  const box = $('order');
  box.hidden = state.mode !== 'obra';
  if (box.hidden) return;
  const issues = validate(plan, state.proposal.propuesta);
  $('validation').innerHTML = issues.length
    ? `<ul class="issues">${issues.map(i => `<li class="${i.nivel}">${esc(i.texto)}</li>`).join('')}</ul>`
    : `<p class="ok">✓ ${tr('noIssues')}</p>`;
  const { acciones, resumen } = workOrder(plan, state.proposal.propuesta);
  $('order-title').textContent = `${tr('order')}${acciones.length ? ' · ' + tr('summary', resumen) : ''}`;
  $('actions').innerHTML = acciones.length ? acciones.map(a => `<li><strong><span class="tag ${a.tipo}">${tr('types')[a.tipo]}</span> ${esc(a.nombre)}${a.itil ? ` · <code>${esc(a.itil)}</code>` : ''}</strong>
    <ul>${a.obra.map(o => `<li>${esc(o)}</li>`).join('')}<li class="itil">${tr('inventoryLine')}: ${esc(a.inventario)}</li>${a.contenidos ? `<li class="contenidos">${tr('contentLine')}: ${esc(a.contenidos)}</li>` : ''}</ul></li>`).join('')
    : `<li class="empty">${tr('noActions')}</li>`;
}

function exportJson() {
  const order = exportOrder(plan, state.proposal.propuesta, { titulo: state.proposal.titulo });
  const blob = new Blob([JSON.stringify(order, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const slug = (state.proposal.titulo || 'propuesta').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'propuesta';
  a.href = URL.createObjectURL(blob);
  a.download = `orden-obra-${plan.id}-${slug}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── Interacción ──────────────────────────────────────────────────────────────
function renderAll({ focusId } = {}) {
  renderPlanta(); renderTabs(); renderAlzado(); renderInventory(); renderInspector(); renderOrder();
  const obra = state.mode === 'obra';
  $('toolbar').hidden = !obra;
  $('drag-hint').hidden = !obra;
  $('mode-actual').setAttribute('aria-pressed', String(!obra));
  $('mode-obra').setAttribute('aria-pressed', String(obra));
  if (focusId) document.querySelector(`#alzado [data-id="${CSS.escape(focusId)}"]`)?.focus({ preventScroll: true });
}
function selectWall(id) { state.wallId = id; renderAll(); }
function select(id, { wall = false, keepFocus = false } = {}) {
  state.selectedId = id;
  const s = screens().find(x => x.id === id) || original(id);
  if (wall && s) state.wallId = s.pared;
  renderAll({ focusId: keepFocus ? id : null });
}
function setMode(mode) {
  state.mode = mode;
  if (mode === 'obra' && !state.proposal) state.proposal = loadProposal();
  if (mode === 'obra') $('proposal-title').value = state.proposal.titulo;
  if (state.selectedId && !screens().some(s => s.id === state.selectedId) && !original(state.selectedId)) state.selectedId = null;
  renderAll();
}

let drag = null;
function svgPoint(svg, e) {
  const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}
function startDrag(e, id) {
  if (e.button !== 0) return;
  if (state.selectedId !== id) select(id);
  if (state.mode !== 'obra') return;
  const svg = $('alzado'), p = svgPoint(svg, e);
  drag = { id, pointer: e.pointerId, x: p.x, y: p.y, snapshot: copyOf(state.proposal.propuesta) };
  svg.setPointerCapture(e.pointerId);
  e.preventDefault();
}
$('alzado').addEventListener('pointermove', e => {
  if (!drag || drag.pointer !== e.pointerId) return;
  const p = svgPoint($('alzado'), e), snap = e.altKey ? 0.01 : 0.05;
  const ds = Math.round((p.x - drag.x) / U / snap) * snap, dz = Math.round(-(p.y - drag.y) / U / snap) * snap;
  moveFrom(drag.snapshot, drag.id, ds, dz);
  renderAll();
});
const endDrag = e => { if (drag && drag.pointer === e.pointerId) drag = null; };
$('alzado').addEventListener('pointerup', endDrag);
$('alzado').addEventListener('pointercancel', endDrag);
function nudge(e, id) {
  if (state.mode !== 'obra') return;
  const step = e.shiftKey ? 0.1 : 0.01;
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
  if (!d) { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('insp-remove')?.click(); } return; }
  e.preventDefault();
  moveFrom(copyOf(state.proposal.propuesta), id, d[0], d[1]);
  renderAll({ focusId: id });
}

$('mode-actual').addEventListener('click', () => setMode('actual'));
$('mode-obra').addEventListener('click', () => setMode('obra'));
$('proposal-title').addEventListener('input', e => { state.proposal.titulo = e.target.value.trim() || tr('defaultTitle'); persist(); });
$('reset').addEventListener('click', () => {
  state.proposal = freshProposal(); $('proposal-title').value = state.proposal.titulo;
  try { localStorage.removeItem(STORE_KEY); } catch {}
  $('saved').textContent = ''; renderAll();
});
$('export').addEventListener('click', exportJson);
document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
  const list = state.proposal.propuesta;
  const placed = placeNew(plan, list, template(b.dataset.add, list.concat(plan.pantallas)), state.wallId);
  setProposal(list.concat(placed));
  state.selectedId = placed[0].id; state.wallId = placed[0].pared;
  renderAll();
}));
document.addEventListener('admira:lang', e => {
  const next = e.detail?.lang === 'es' ? 'es' : 'en'; if (next === lang) return;
  lang = next; translate(); setBackLink(); if (plan) { renderSource(); renderAll(); }
  renderTrace(); paintUpload(); paintUploadStatus(); paintCreate(); paintPhoto();
});

function renderSource() {
  const src = plan.fuente || {};
  const lines = [src.medidas, src.pantallas, src.itil].filter(Boolean).map(esc);
  const parts = [];
  // Lo subido en este navegador va delante, con su vuelta atrás.
  if (registro && registro.plan) {
    const gen = registro.plan.generador, tipo = gen && TIPOS[gen.tipo], est = gen && gen.estimacion;
    // Estimado desde fotos: nunca se presenta como medido; el modelo y la confianza, a la vista.
    const what = est ? `<strong>${esc(tr('photoLine', est.modeloNombre || 'Gemini'))}</strong> · ${esc(tipo ? tipo[lang] : gen.tipo || '')}${est.simulada ? ' · ' + esc(tr('phSimulated')) : ''}`
      : gen ? `<strong>${tr('generatedLine')}</strong> · ${esc(tipo ? tipo[lang] : gen.tipo || '')} · ${esc(tr('crSeed', gen.semilla))}` : `<strong>${tr('uploadedLine')}</strong> · ${esc(registro.fichero || '—')}`;
    parts.push(`<span class="source-upload">${what} · ${esc(when(registro.subidoEn))} <button type="button" id="source-revert">${tr(publicadoEstado === 'none' ? 'deleteUploaded' : 'backPublished')}</button></span>`);
  } else if (calcoActual()) {
    const c = calcoActual();
    parts.push(`<span class="source-upload"><strong>${tr('traceLine')}</strong> · ${esc(c.fichero || '—')} · ${esc(when(c.subidoEn || registro.subidoEn))}</span>`);
  }
  if (lines.length) parts.push(`<strong>${esc(src.titulo || tr('source'))}</strong> · ${lines.join(' · ')}`);
  $('source').hidden = !parts.length;
  $('source').innerHTML = parts.join('<br>');
  $('source-revert')?.addEventListener('click', revertUpload);
}
function when(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

// «← Volver a la ficha» lleva al mapa comercial. Un Xpacio que no está en ese catálogo y lleva
// `yokup.portal` (el laboratorio de Gran de Gràcia 51) enlaza su establecimiento en Yokup, el
// maestro del ITIL. Solo https y dominios de Yokup: el JSON puede venir subido.
const YOKUP_HOST = /^(?:www\.)?(?:admira\.app|yokup\.com)$/i;
function yokupPortal(p) {
  try {
    const url = new URL(p && p.yokup && p.yokup.portal);
    return url.protocol === 'https:' && YOKUP_HOST.test(url.hostname) ? url.href : '';
  } catch { return ''; }
}
function setBackLink() {
  const back = $('back'), portal = yokupPortal(plan);
  back.dataset.copy = portal ? 'backYokup' : 'back';
  back.textContent = tr(back.dataset.copy);
  back.href = portal || `/?locationId=${encodeURIComponent(xpacioId)}&lang=${lang}`;
}

// ── Mostrar un plano o la invitación a subirlo ───────────────────────────────
function showPlan(next, mode = 'actual') {
  clearTimeout(saveTimer);
  plan = next;
  K = scaleOf(plan);
  for (const id of ['planta', 'alzado']) $(id).style.setProperty('--k', K);
  setBackLink();
  Object.assign(state, { mode: 'actual', wallId: null, selectedId: null, proposal: null });
  drag = null;
  $('saved').textContent = '';
  document.title = `${plan.nombre} · ${tr('plan')} · ${window.ADMIRA_SITE_BRAND?.name || 'Clear Channel'}`;
  $('title').textContent = plan.nombre;
  $('address').textContent = plan.direccion || '';
  renderSource();
  state.wallId = (plan.pantallas[0] && plan.pantallas[0].pared) || plan.paredes[0].id;
  setStatus('');
  $('no-plan').hidden = true;
  $('workspace').hidden = false;
  $('mode-actual').parentElement.hidden = false;
  setMode(mode);
  renderTrace(); paintUpload(); paintCreate(); paintPhoto();
}
function showNoPlan() {
  clearTimeout(saveTimer);
  plan = null;
  setBackLink();
  Object.assign(state, { mode: 'actual', wallId: null, selectedId: null, proposal: null });
  setStatus('');
  $('title').textContent = xpacioId;
  $('address').textContent = '';
  $('workspace').hidden = true;
  $('source').hidden = true;
  $('no-plan').hidden = false;
  $('mode-actual').parentElement.hidden = true; // sin plano no hay distribución que ver
  renderTrace(); paintUpload(); paintCreate(); paintPhoto();
}

// ── ▤ Subir plano ────────────────────────────────────────────────────────────
// Lo elegido y aún sin aplicar: un plano JSON ya leído (`leido`) o un calco preparado (`calco`).
const upload = { fichero: '', leido: null, calco: null, issues: [], busy: false, statusKey: '', statusArgs: [], statusError: false };
let uploadSeq = 0;
function resetUpload() { Object.assign(upload, { fichero: '', leido: null, calco: null, issues: [], busy: false }); }
function uploadStatus(key, { error = false, args = [] } = {}) {
  Object.assign(upload, { statusKey: key, statusArgs: args, statusError: error });
  paintUploadStatus();
}
function paintUploadStatus() {
  const n = $('upload-status');
  n.textContent = upload.statusKey ? tr(upload.statusKey, ...upload.statusArgs) : '';
  n.classList.toggle('err', upload.statusError);
}
const message = m => (lang === 'en' && m.en ? m.en : m.texto);

function paintUpload() {
  const { leido, calco } = upload;
  const preview = $('upload-preview');
  if (leido && leido.ok) {
    preview.innerHTML = `<strong>${esc(leido.plan.nombre)}</strong><span class="upload-meta"><code>${esc(leido.id)}</code> · ${esc(tr('upSummary', resumenPlano(leido.plan)))}</span>`;
  } else if (calco) {
    const img = new Image();
    img.alt = ''; img.src = calco.dataUrl;
    const meta = document.createElement('span');
    meta.className = 'upload-meta'; meta.textContent = `${calco.fichero} · ${calco.pxAncho}×${calco.pxAlto} px`;
    preview.replaceChildren(img, meta);
  } else preview.replaceChildren();
  preview.hidden = !preview.childElementCount;
  // Errores (bloquean) y avisos del plano (no bloquean; los seis primeros).
  const list = [];
  if (leido) {
    for (const m of leido.errores) list.push(['error', message(m)]);
    if (leido.ok && leido.avisos.length) {
      list.push(['head', tr('upPlanWarnings')]);
      for (const m of leido.avisos.slice(0, 6)) list.push([m.nivel === 'error' ? 'error' : 'aviso', message(m)]);
      if (leido.avisos.length > 6) list.push(['more', tr('upMore', leido.avisos.length - 6)]);
    }
  }
  for (const m of upload.issues) list.push(['error', message(m)]);
  $('upload-issues').replaceChildren(...list.map(([cls, txt]) => Object.assign(document.createElement('li'), { className: cls, textContent: txt })));
  $('upload-issues').hidden = !list.length;
  // Sin plano, un calco pide las medidas de la sala nueva.
  $('upload-room').hidden = !(calco && !plan);
  const key = leido && leido.ok ? 'upApplyPlan' : calco ? (plan ? 'upApplyTrace' : 'upApplyRoom') : '';
  $('upload-apply').hidden = !key;
  $('upload-apply').textContent = key ? tr(key) : '';
  $('upload-apply').disabled = upload.busy;
  $('upload-cancel').hidden = !(leido || calco || upload.issues.length);
}

async function chooseFile(file) {
  if (!file) return;
  const seq = ++uploadSeq;
  resetUpload();
  upload.fichero = file.name || '';
  const check = comprobarFichero(file);
  if (!check.ok) { upload.issues = [check.error]; uploadStatus(''); paintUpload(); return; }
  upload.busy = true;
  uploadStatus(check.tipo === 'pdf' ? 'upPdf' : 'upReading');
  paintUpload();
  try {
    let leido = null, calco = null;
    if (check.tipo === 'json') leido = leerPlanoJson(await file.text(), xpacioId);
    else calco = check.tipo === 'pdf' ? await traceFromPdf(file) : await traceFromImage(file);
    if (seq !== uploadSeq) return; // llegó otro fichero mientras tanto
    if (calco && !calcoValido(nuevoCalco({ ...calco, ancho: 1 }))) throw new Error('calco no válido');
    Object.assign(upload, { leido, calco });
    uploadStatus('');
    if (calco && !plan) {
      // Medidas por defecto: 10 m de ancho y el fondo en la proporción del calco.
      $('upload-name').value = nombreDeFichero(file.name) || xpacioId;
      $('upload-ancho').value = 10;
      $('upload-fondo').value = round(Math.min(500, Math.max(1, 10 * calco.pxAlto / calco.pxAncho)), 1);
      $('upload-alto').value = 3;
    }
  } catch (error) {
    if (seq !== uploadSeq) return;
    console.warn('Subir plano:', error);
    resetUpload();
    uploadStatus(check.tipo === 'pdf' ? 'upPdfError' : check.tipo === 'imagen' ? 'upImageError' : 'upJsonError', { error: true });
  } finally {
    if (seq === uploadSeq) { upload.busy = false; paintUpload(); }
  }
}

// Borrador de propuesta de ese Xpacio: al cambiar de plano no se mezcla con el nuevo.
function confirmDiscardDraft(id = xpacioId) {
  const key = 'admira.plano.' + id;
  let has = false;
  try { has = !!localStorage.getItem(key); } catch {}
  if (!has) return true;
  if (!window.confirm(tr('upConfirmDraft'))) return false;
  if (id === xpacioId) clearTimeout(saveTimer); // que un guardado pendiente no lo vuelva a escribir
  try { localStorage.removeItem(key); } catch {}
  return true;
}
const fieldNumber = id => parseFloat(String($(id).value).replace(',', '.'));
const stamped = calco => ({ ...calco, subidoEn: new Date().toISOString() });

async function applyUpload() {
  const { leido, calco } = upload;
  if (upload.busy || (!(leido && leido.ok) && !calco)) return;
  if (leido && leido.ok) {
    const id = leido.id;
    if (!confirmDiscardDraft(id)) return;
    const before = id === xpacioId ? registro : await almacen.leer(id);
    const next = registroSubida({ id, plan: leido.plan, calco: before && before.calco, fichero: upload.fichero });
    const stored = await almacen.guardar(next);
    if (id !== xpacioId) {
      // Es el plano de otro Xpacio: se abre su página, que lo lee de este navegador.
      if (!stored) { uploadStatus('noStore', { error: true }); return; }
      uploadStatus('upOpening', { args: [id] });
      const url = new URL(location.href);
      url.searchParams.set('locationId', id); url.searchParams.delete('subir'); url.searchParams.delete('modo');
      location.assign(url.href);
      return;
    }
    registro = next; resetUpload(); showPlan(next.plan);
    uploadStatus(stored ? 'upDone' : 'upNotStored', { error: !stored });
    return;
  }
  if (plan) {
    // Calco bajo el plano que se ve (publicado o subido), del ancho de la sala.
    const next = registroSubida({ id: xpacioId, plan: registro && registro.plan, calco: stamped(nuevoCalco({ ...calco, ancho: anchoSala(plan) })), fichero: registro ? registro.fichero : '', subidoEn: registro && registro.plan ? registro.subidoEn : undefined });
    const stored = await almacen.guardar(next);
    registro = next; resetUpload();
    renderPlanta(); renderSource(); renderTrace(); paintUpload();
    uploadStatus(stored ? 'upTraceDone' : 'upNotStored', { error: !stored });
    return;
  }
  // Xpacio sin plano: sala rectangular de las medidas indicadas con el calco debajo.
  const dims = { ancho: fieldNumber('upload-ancho'), fondo: fieldNumber('upload-fondo'), alto: fieldNumber('upload-alto') };
  const errs = comprobarSala(dims);
  upload.issues = errs;
  if (errs.length) { paintUpload(); return; }
  if (!confirmDiscardDraft()) return;
  const nuevo = salaRectangular({ id: xpacioId, nombre: $('upload-name').value, ...dims, version: 'subido-' + Date.now().toString(36) });
  const next = registroSubida({ id: xpacioId, plan: nuevo, calco: stamped(nuevoCalco({ ...calco, ancho: dims.ancho })), fichero: upload.fichero });
  const stored = await almacen.guardar(next);
  registro = next; resetUpload(); showPlan(next.plan);
  uploadStatus(stored ? 'upDone' : 'upNotStored', { error: !stored });
}

// «Volver al plano publicado» (el calco se queda) o, si no hay publicado, «Borrar plano subido».
async function revertUpload() {
  if (!registro || !registro.plan || !confirmDiscardDraft()) return;
  if (registro.calco && publicadoEstado !== 'none') {
    registro = { ...registro, plan: null, fichero: '' };
    await almacen.guardar(registro);
  } else {
    await almacen.borrar(xpacioId);
    registro = null;
  }
  uploadStatus('');
  if (publicado) showPlan(publicado);
  else if (publicadoEstado === 'error') location.reload();
  else { showNoPlan(); openUpload(); }
}

// ── Calco: imagen o página 1 del PDF, reescalada a ≤ MAX_LADO px y en dataURL ─
const loadImage = src => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('imagen'));
  img.src = src;
});
const readDataUrl = file => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});
// Lienzo con fondo blanco: los planos en PNG suelen ser trazo negro sobre transparente.
function whiteCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
}
function canvasDataUrl(canvas) {
  const webp = canvas.toDataURL('image/webp', 0.86);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}
async function traceFromImage(file) {
  const svg = /\.svg$/i.test(file.name || '') || file.type === 'image/svg+xml';
  // Un .svg sin tipo (application/octet-stream) no se decodifica como imagen: se le pone el suyo.
  const source = svg ? new Blob([file], { type: 'image/svg+xml' }) : file;
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth, h = img.naturalHeight;
    if (!(w > 0 && h > 0)) { if (!svg) throw new Error('imagen sin tamaño'); w = 1600; h = 1200; }
    // El SVG es vectorial: se rasteriza a MAX_LADO aunque su tamaño propio sea menor.
    const size = svg ? escalaCalco(w * escalaPdf(w, h, MAX_LADO), h * escalaPdf(w, h, MAX_LADO), MAX_LADO) : escalaCalco(w, h, MAX_LADO);
    try {
      const { canvas, ctx } = whiteCanvas(size.w, size.h);
      ctx.drawImage(img, 0, 0, size.w, size.h);
      return { dataUrl: canvasDataUrl(canvas), pxAncho: size.w, pxAlto: size.h, fichero: file.name };
    } catch (error) {
      // SVG sin width/height (Firefox no lo dibuja) o lienzo contaminado: va el SVG tal cual (es vectorial).
      if (svg) return { dataUrl: await readDataUrl(source), pxAncho: w, pxAlto: h, fichero: file.name };
      throw error;
    }
  } finally { URL.revokeObjectURL(url); }
}
// pdf.js solo se carga al subir un PDF, con versión fijada y su worker de la misma versión.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const PDFJS_SRI = 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==';
const PDFJS_WORKER_SRI = 'sha512-BbrZ76UNZq5BhH7LL7pn9A4TKQpQeNCHOo65/akfelcIBbcVvYWOFQKPXIrykE3qZxYjmDX573oa4Ywsc7rpTw==';
let pdfjsReady = null;
function loadPdfJs() {
  return pdfjsReady || (pdfjsReady = (async () => {
    const lib = window.pdfjsLib || await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js'; s.integrity = PDFJS_SRI; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
      s.onload = () => (window.pdfjsLib ? resolve(window.pdfjsLib) : reject(new Error('pdf.js')));
      s.onerror = () => { s.remove(); reject(new Error('pdf.js')); };
      document.head.append(s);
    });
    // El worker también con integridad: se descarga con SRI y se sirve desde un blob de este
    // origen, así pdf.js no hace importScripts ni <script> de una URL sin comprobar.
    const res = await fetch(PDFJS + 'pdf.worker.min.js', { integrity: PDFJS_WORKER_SRI, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error('pdf.worker ' + res.status);
    lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([await res.blob()], { type: 'text/javascript' }));
    return lib;
  })().catch(error => { pdfjsReady = null; throw error; }));
}
async function traceFromPdf(file) {
  const lib = await loadPdfJs();
  // isEvalSupported: false — sin eval en las fuentes del PDF (CVE-2024-4367 en pdf.js ≤ 4.1).
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: escalaPdf(base.width, base.height, MAX_LADO) });
    const w = Math.max(1, Math.floor(viewport.width)), h = Math.max(1, Math.floor(viewport.height));
    const { canvas, ctx } = whiteCanvas(w, h);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return { dataUrl: canvasDataUrl(canvas), pxAncho: w, pxAlto: h, fichero: file.name };
  } finally { doc.destroy(); }
}

// ── Controles del calco ──────────────────────────────────────────────────────
function renderTrace() {
  const c = calcoActual();
  $('trace').hidden = !c;
  if (!c) return;
  $('trace-file').textContent = `${c.fichero || '—'} · ${c.pxAncho}×${c.pxAlto} px`;
  if (document.activeElement !== $('trace-width')) $('trace-width').value = c.ancho;
  $('trace-opacity').value = c.opacidad;
  $('trace-opacity-out').textContent = Math.round(c.opacidad * 100) + ' %';
}
let traceTimer = 0;
function updateTrace(patch) {
  if (!calcoActual()) return;
  registro = { ...registro, calco: { ...registro.calco, ...patch } };
  clearTimeout(traceTimer);
  traceTimer = setTimeout(async () => { if (registro && !(await almacen.guardar(registro))) uploadStatus('upNotStored', { error: true }); }, 300);
}
$('trace-width').addEventListener('input', e => {
  const v = parseFloat(e.target.value);
  if (!(v >= 0.5 && v <= 2000)) return;
  updateTrace({ ancho: round(v) }); renderPlanta();
});
$('trace-opacity').addEventListener('input', e => {
  const v = parseFloat(e.target.value);
  if (!(v > 0 && v <= 1)) return;
  updateTrace({ opacidad: round(v) });
  $('planta').querySelector('.calco-img')?.setAttribute('opacity', v);
  $('trace-opacity-out').textContent = Math.round(v * 100) + ' %';
});
$('trace-remove').addEventListener('click', async () => {
  if (!registro) return;
  clearTimeout(traceTimer);
  if (registro.plan) { registro = { ...registro, calco: null }; await almacen.guardar(registro); }
  else { await almacen.borrar(xpacioId); registro = null; }
  if (plan) { renderPlanta(); renderSource(); }
  renderTrace();
});

// ── Panel ▤: el mismo botón de la barra, sin estado propio ───────────────────
function openUpload({ focus = true, section = 'upload' } = {}) {
  const panel = $('advanced-tools'), toggle = $('header-advanced-toggle');
  if (panel && toggle && !panel.open) toggle.click();
  if (focus) { $(section).focus({ preventScroll: true }); $(section).scrollIntoView({ block: 'nearest' }); }
}
// responsive-shell.js atiende el botón ▤; galaxy-shell avisa con admira:shell-ready (o ya lo hizo).
function whenShellReady(fn) {
  let done = false;
  const run = () => { if (!done) { done = true; fn(); } };
  document.addEventListener('admira:shell-ready', run, { once: true });
  if (window.AdmiraExpert) setTimeout(run, 0);
}
// Los botones de .advanced-actions cierran el panel al pulsarlos (responsive-shell.js): los de
// esta sección no son acciones de un clic, así que el clic no sale de ella.
$('upload').addEventListener('click', e => e.stopPropagation());
$('upload-file').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; chooseFile(f); });
const drop = $('upload-drop');
for (const type of ['dragenter', 'dragover']) drop.addEventListener(type, e => { e.preventDefault(); drop.classList.add('over'); });
for (const type of ['dragleave', 'dragend']) drop.addEventListener(type, () => drop.classList.remove('over'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); chooseFile(e.dataTransfer && e.dataTransfer.files[0]); });
// Un fichero soltado fuera de la zona no debe abrirse en la pestaña (y perder la página).
const dragsFiles = e => !!(e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'));
for (const type of ['dragover', 'drop']) addEventListener(type, e => { if (dragsFiles(e)) e.preventDefault(); });
$('upload-apply').addEventListener('click', applyUpload);
$('upload-cancel').addEventListener('click', () => { uploadSeq++; resetUpload(); uploadStatus(''); paintUpload(); });
$('open-upload').addEventListener('click', () => openUpload());
$('open-create').addEventListener('click', () => openUpload({ section: 'create' }));

// ── ▤ Creación de Xpacios ────────────────────────────────────────────────────
// Un plano inventado (plano-generador.mjs) se guarda como un plano subido: mismo IndexedDB,
// misma confirmación del borrador y su línea de fuente «Plano generado en este navegador».
const creation = { tipo: 'cafeteria', plan: null, issues: [], statusKey: '', statusError: false };
const createField = id => parseFloat(String($(id).value).replace(',', '.'));
function createDims() { return { ancho: createField('create-ancho'), largo: createField('create-largo'), alto: createField('create-alto') }; }
function fillCreateDims({ ancho, largo, alto }) { $('create-ancho').value = ancho; $('create-largo').value = largo; $('create-alto').value = alto; paintCreateArea(); }
function paintCreateArea() {
  const { ancho, largo } = createDims(), m2 = ancho > 0 && largo > 0 ? round(ancho * largo, 1).toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB') : '—';
  $('create-area').textContent = tr('crArea', m2, TIPOS[creation.tipo]);
}
function paintCreate() {
  const select = $('create-type');
  select.replaceChildren(...Object.entries(TIPOS).map(([id, t]) => Object.assign(document.createElement('option'), { value: id, textContent: t[lang], selected: id === creation.tipo })));
  paintCreateArea();
  const preview = $('create-preview'), r = creation.plan && resumenGenerado(creation.plan);
  if (r) {
    const gen = creation.plan.generador;
    preview.innerHTML = `<strong>${esc(TIPOS[r.tipo][lang])} · ${esc(r.m2.toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB'))} m²</strong><span class="upload-meta">${esc(tr('crPreview', r))} · ${esc(tr(gen.total ? 'crTotalNote' : 'crManualNote'))} · ${esc(tr('crSeed', r.semilla))}</span>`;
  } else preview.replaceChildren();
  preview.hidden = !r;
  $('create-issues').replaceChildren(...creation.issues.map(m => Object.assign(document.createElement('li'), { className: 'error', textContent: message(m) })));
  $('create-issues').hidden = !creation.issues.length;
  $('create-apply').hidden = !r;
  const st = $('create-status');
  st.textContent = creation.statusKey ? tr(creation.statusKey) : '';
  st.classList.toggle('err', creation.statusError);
}
// El nombre y la dirección del Xpacio real (publicado o subido) se conservan; si no hay, «Tipo · id».
function createBase() { return (registro && registro.plan && !registro.plan.generador) ? registro.plan : publicado; }
function createPlan(total) {
  const base = createBase(), dims = createDims();
  creation.statusKey = ''; creation.statusError = false;
  creation.issues = total ? [] : comprobarSala({ ancho: dims.ancho, fondo: dims.largo, alto: dims.alto });
  if (creation.issues.length) { creation.plan = null; paintCreate(); return; }
  creation.plan = generarXpacio({ tipo: creation.tipo, total, semilla: nuevaSemilla(), id: xpacioId, nombre: base && base.nombre, direccion: base && base.direccion, ...(total ? {} : dims) });
  if (total) fillCreateDims({ ancho: creation.plan.planta.ancho, largo: creation.plan.planta.fondo, alto: creation.plan.planta.alto });
  paintCreate();
}
async function applyCreate() {
  if (!creation.plan || !confirmDiscardDraft()) return;
  const next = registroSubida({ id: xpacioId, plan: creation.plan, calco: registro && registro.calco, fichero: '' });
  const stored = await almacen.guardar(next);
  registro = next; creation.plan = null;
  creation.statusKey = stored ? 'crDone' : 'upNotStored'; creation.statusError = !stored;
  showPlan(next.plan);
}
$('create').addEventListener('click', e => e.stopPropagation());
// Tres vías: aleatorio (aquí), con plano («Subir plano», arriba) y con foto o vídeo (estimación con Gemini).
const createTabs = [...document.querySelectorAll('#create [role="tab"]')];
function selectCreateTab(tab, { focus = false } = {}) {
  for (const t of createTabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    $(t.dataset.pane).hidden = !on;
  }
  if (focus) tab.focus();
}
createTabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectCreateTab(tab));
  tab.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return;
    e.preventDefault(); selectCreateTab(createTabs[(i + d + createTabs.length) % createTabs.length], { focus: true });
  });
});
$('create-go-upload').addEventListener('click', () => openUpload({ section: 'upload' }));
$('create-type').addEventListener('change', e => { creation.tipo = TIPOS[e.target.value] ? e.target.value : 'cafeteria'; creation.plan = null; creation.issues = []; fillCreateDims(medidasMedias(creation.tipo)); paintCreate(); });
for (const id of ['create-ancho', 'create-largo', 'create-alto']) $(id).addEventListener('input', paintCreateArea);
$('create-manual').addEventListener('click', () => createPlan(false));
$('create-total').addEventListener('click', () => createPlan(true));
$('create-apply').addEventListener('click', applyCreate);

// ── ▤ Creación de Xpacios · «Con foto o vídeo» ───────────────────────────────
// Hasta 8 fotos o los fotogramas de un vídeo, reescalados aquí a JPEG (≤ 1600 px, ≤ 800 KB), van a
// /xpacio/estimar (Gemini Pro en el worker pixer-eleven). Con la respuesta, plano-foto.mjs arma el
// plano con el generador y se guarda como los otros: mismo IndexedDB y misma confirmación del
// borrador. El vídeo no sale del navegador; las fotos no se guardan en el worker.
const photo = { tipo: 'cafeteria', fotos: [], video: '', plan: null, busy: false, preparing: false, seq: 0, t0: 0, timer: 0, status: null, avisos: [] };
const loadBitmap = file => (window.createImageBitmap ? createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null) : Promise.resolve(null))
  .then(bmp => bmp || (async () => { const url = URL.createObjectURL(file); try { return await loadImage(url); } finally { URL.revokeObjectURL(url); } })());
// Dibuja la fuente (imagen, bitmap o vídeo) en JPEG y baja calidad o tamaño hasta que quepa.
function fotoJpeg(source, w, h) {
  for (const { lado, calidad } of ESCALONES) {
    const size = escalaFoto(w, h, lado);
    const canvas = document.createElement('canvas');
    canvas.width = size.w; canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size.w, size.h);
    ctx.drawImage(source, 0, 0, size.w, size.h);
    const dataUrl = canvas.toDataURL('image/jpeg', calidad);
    if (bytesDataUrl(dataUrl) <= MAX_BYTES_FOTO) return { dataUrl, w: size.w, h: size.h };
  }
  throw new Error('foto-grande');
}
async function fotoDeImagen(file) {
  const img = await loadBitmap(file);
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!(w > 0 && h > 0)) throw new Error('imagen');
  try { return { ...fotoJpeg(img, w, h), nombre: file.name || 'foto', origen: 'foto' }; } finally { if (img.close) img.close(); }
}
const esperar = (node, type, ms) => new Promise((resolve, reject) => {
  const done = ok => { clearTimeout(t); node.removeEventListener(type, onOk); node.removeEventListener('error', onErr); ok ? resolve() : reject(new Error(type)); };
  const onOk = () => done(true), onErr = () => done(false), t = setTimeout(() => done(false), ms);
  node.addEventListener(type, onOk); node.addEventListener('error', onErr);
});
async function fotogramasDeVideo(file, seq) {
  const url = URL.createObjectURL(file), video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = url;
  try {
    await esperar(video, 'loadeddata', 20000);
    let dur = video.duration;
    if (!Number.isFinite(dur)) { video.currentTime = 1e7; await esperar(video, 'seeked', 8000); dur = video.duration; } // webm sin duración en la cabecera
    const tiempos = tiemposFotogramas(dur), out = [];
    if (!tiempos.length || !(video.videoWidth > 0)) throw new Error('video');
    for (const [i, t] of tiempos.entries()) {
      if (seq !== photo.seq) return null;
      photoStatus('phFrames', [i + 1, tiempos.length]);
      video.currentTime = t; await esperar(video, 'seeked', 8000);
      out.push({ ...fotoJpeg(video, video.videoWidth, video.videoHeight), nombre: `${file.name || 'video'} · ${t.toFixed(1)} s`, origen: 'video' });
    }
    return out;
  } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}
async function chooseMedia(files) {
  const seq = ++photo.seq;
  const fromVideo = !!photo.video;
  const { video, fotos, errores } = clasificarFicheros(files, fromVideo ? 0 : photo.fotos.length);
  photo.avisos = errores.map(e => tr(e.error, e.fichero));
  if (!video && !fotos.length) { paintPhoto(); return; }
  photo.plan = null; photo.preparing = true; photoStatus(video ? 'phFrames' : 'phReading', video ? [0, '…'] : []); paintPhoto();
  try {
    if (video) {
      const frames = await fotogramasDeVideo(video, seq);
      if (!frames || seq !== photo.seq) return;
      photo.fotos = frames; photo.video = video.name || 'video';
    } else {
      const nuevas = [];
      for (const f of fotos) {
        try { nuevas.push(await fotoDeImagen(f)); } catch { photo.avisos.push(tr('phDecode', f.name || '')); }
        if (seq !== photo.seq) return;
      }
      photo.fotos = (fromVideo ? [] : photo.fotos).concat(nuevas).slice(0, MAX_FOTOS); photo.video = '';
    }
    photoStatus('');
  } catch {
    if (seq === photo.seq) { if (video) { photo.fotos = []; photo.video = ''; } photoStatus(video ? 'phVideoError' : 'phError', [video ? video.name : ''], true); }
  } finally {
    if (seq === photo.seq) { photo.preparing = false; paintPhoto(); }
  }
}
function photoStatus(key, args = [], error = false) { photo.status = key ? { key, args, error } : null; paintPhotoStatus(); }
function paintPhotoStatus() {
  const st = $('photo-status'), s = photo.status;
  st.textContent = s ? tr(s.key, ...s.args) : '';
  st.classList.toggle('err', !!(s && s.error));
}
function paintPhoto() {
  const select = $('photo-type');
  select.replaceChildren(...Object.entries(TIPOS).map(([id, t]) => Object.assign(document.createElement('option'), { value: id, textContent: t[lang], selected: id === photo.tipo })));
  const thumbs = $('photo-thumbs');
  thumbs.replaceChildren(...photo.fotos.map((f, i) => {
    const li = document.createElement('li');
    const img = Object.assign(document.createElement('img'), { src: f.dataUrl, alt: '', loading: 'lazy', decoding: 'async' });
    img.title = f.nombre;
    const n = Object.assign(document.createElement('span'), { className: 'photo-n', textContent: String(i + 1) });
    const x = Object.assign(document.createElement('button'), { type: 'button', className: 'photo-x', textContent: '×' });
    x.setAttribute('aria-label', tr('phRemove', i + 1)); x.disabled = photo.busy;
    x.addEventListener('click', () => { photo.seq++; photo.fotos.splice(i, 1); if (!photo.fotos.length) photo.video = ''; photo.plan = null; paintPhoto(); });
    li.append(img, n, x);
    return li;
  }));
  if (photo.fotos.length) {
    const li = document.createElement('li'); li.className = 'photo-count';
    const clear = Object.assign(document.createElement('button'), { type: 'button', className: 'upload-link', textContent: tr('phClear') });
    clear.disabled = photo.busy;
    clear.addEventListener('click', () => { photo.seq++; photo.fotos = []; photo.video = ''; photo.plan = null; photo.avisos = []; photoStatus(''); paintPhoto(); });
    li.append(Object.assign(document.createElement('span'), { textContent: tr('phCount', photo.fotos.length, photo.video) }), clear);
    thumbs.append(li);
  }
  thumbs.hidden = !photo.fotos.length;
  $('photo-estimate').disabled = !photo.fotos.length || photo.busy || photo.preparing;
  $('photo-file').disabled = photo.busy;
  $('photo-progress').hidden = !photo.busy;
  const preview = $('photo-preview'), r = photo.plan && resumenEstimado(photo.plan);
  if (r) {
    const loc = lang === 'es' ? 'es-ES' : 'en-GB';
    const lines = [tr('phDims', r), tr('phSeen', r)];
    if (r.huecos + r.muebles + r.pantallas > r.huecosEstimados + r.mueblesEstimados + r.pantallasEstimadas) lines.push(tr('phAdded', r));
    if (r.descartes) lines.push(tr('phDiscarded', r.descartes));
    lines.push(tr('phFrom', r.modelo, r.fotos) + (r.simulada ? ' · ' + tr('phSimulated') : ''));
    const refs = r.referencias.map(x => `<li>${esc(x.objeto)}${x.supuesto ? ` · <span>${esc(x.supuesto)}</span>` : ''}${x.foto ? ` <span class="photo-ref-n">#${x.foto}</span>` : ''}</li>`).join('');
    preview.innerHTML = `<strong>${esc(tr('phHead', TIPOS[r.tipo][lang], r.m2.toLocaleString(loc), pct(r.confianza.global)))}</strong>`
      + `<meter class="photo-conf" min="0" max="1" low="0.4" high="0.7" optimum="1" value="${Number(r.confianza.global) || 0}"></meter>`
      + lines.map(l => `<span class="upload-meta">${esc(l)}</span>`).join('')
      + (refs ? `<span class="upload-meta photo-refs-title">${esc(tr('phRefs'))}</span><ul class="photo-refs">${refs}</ul>` : '')
      + (r.notas ? `<span class="upload-meta"><b>${esc(tr('phModelNotes', r.modelo))}:</b> ${esc(r.notas)}</span>` : '');
  } else preview.replaceChildren();
  preview.hidden = !r;
  $('photo-apply').hidden = !r;
  const issues = photo.avisos;
  const st = $('photo-status');
  if (!photo.status && issues.length) { st.textContent = issues.join(' '); st.classList.add('err'); } else paintPhotoStatus();
}
function tickPhoto() { $('photo-progress-text').textContent = tr('phWorking', Math.round((Date.now() - photo.t0) / 1000)); }
async function estimarXpacio() {
  if (!photo.fotos.length || photo.busy || photo.preparing) return;
  // Desde otro dominio el navegador bloquearía la respuesta (CORS) y parecería un fallo de red.
  if (!origenEstimador(location.origin)) { photoStatus('phOrigin', [], true); return; }
  const seq = ++photo.seq, ctrl = new AbortController(), corte = setTimeout(() => ctrl.abort(), ESPERA_ESTIMADOR);
  photo.busy = true; photo.plan = null; photo.avisos = []; photo.t0 = Date.now(); photoStatus('');
  tickPhoto(); photo.timer = setInterval(tickPhoto, 1000); paintPhoto();
  try {
    let res, body = null;
    try {
      res = await fetch(urlEstimador(location.search, location.hostname), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: ctrl.signal,
        body: JSON.stringify({ tipo: photo.tipo, fotos: photo.fotos.map(f => f.dataUrl), notas: $('photo-notes').value.trim().slice(0, 300), lang })
      });
      try { body = await res.json(); } catch {}
    } catch (error) { if (seq === photo.seq) photoStatus(error && error.name === 'AbortError' ? 'phTimeout' : 'phNetwork', [], true); return; }
    if (seq !== photo.seq) return;
    if (!res.ok || !body || !body.ok) { photoStatus(claveError(res.status, body), [], true); return; }
    const base = createBase();
    photo.plan = planoDesdeEstimacion({ respuesta: body, tipo: photo.tipo, id: xpacioId, nombre: base && base.nombre, direccion: base && base.direccion, semilla: nuevaSemilla() });
    photoStatus('phDone');
  } catch { if (seq === photo.seq) photoStatus('phInvalid', [], true); }
  finally {
    clearTimeout(corte); clearInterval(photo.timer);
    photo.busy = false; paintPhoto();
  }
}
async function applyPhoto() {
  if (!photo.plan || !confirmDiscardDraft()) return;
  const next = registroSubida({ id: xpacioId, plan: photo.plan, calco: registro && registro.calco, fichero: '' });
  const stored = await almacen.guardar(next);
  registro = next; photo.plan = null;
  photoStatus(stored ? 'phApplied' : 'upNotStored', [], !stored);
  showPlan(next.plan);
}
$('photo-file').accept = ACEPTA_FOTO;
$('photo-file').addEventListener('change', e => { const files = [...(e.target.files || [])]; e.target.value = ''; chooseMedia(files); });
const photoDrop = $('photo-drop');
for (const type of ['dragenter', 'dragover']) photoDrop.addEventListener(type, e => { e.preventDefault(); photoDrop.classList.add('over'); });
for (const type of ['dragleave', 'dragend']) photoDrop.addEventListener(type, () => photoDrop.classList.remove('over'));
photoDrop.addEventListener('drop', e => { e.preventDefault(); photoDrop.classList.remove('over'); if (!photo.busy) chooseMedia(e.dataTransfer && e.dataTransfer.files); });
$('photo-type').addEventListener('change', e => { photo.tipo = TIPOS[e.target.value] ? e.target.value : 'cafeteria'; photo.plan = null; paintPhoto(); });
$('photo-estimate').addEventListener('click', estimarXpacio);
$('photo-apply').addEventListener('click', applyPhoto);

// ?subir=1 o ?crear=1 ya abrieron el panel: fuera de la URL, para que recargar no lo vuelva a abrir.
function dropUploadParam() {
  const url = new URL(location.href);
  if (!url.searchParams.has('subir') && !url.searchParams.has('crear')) return;
  url.searchParams.delete('subir'); url.searchParams.delete('crear');
  try { history.replaceState(history.state, '', url.pathname + url.search + url.hash); } catch {}
}

// ── Arranque: primero lo subido en este navegador; si no, el plano publicado ─
async function loadPublished() {
  let res;
  try { res = await fetch(`data/xpacios/${xpacioId}.json`, { cache: 'no-store' }); } catch { publicadoEstado = 'error'; return; }
  // Pages responde con la portada (200, HTML) a lo que no existe: también es «sin plano».
  if (res.status === 404 || (res.ok && !/json/i.test(res.headers.get('content-type') || ''))) { publicadoEstado = 'none'; return; }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok || !data || data.schema !== SCHEMA || !Array.isArray(data.paredes) || !Array.isArray(data.pantallas)) { publicadoEstado = 'error'; return; }
  publicado = data; publicadoEstado = 'ok';
}

async function init() {
  translate();
  $('upload-file').accept = ACEPTA;
  setBackLink();
  paintUpload();
  fillCreateDims(medidasMedias(creation.tipo));
  paintCreate();
  paintPhoto();
  // Lo subido manda, pero IndexedDB no puede dejar la página en «Cargando…»: tope de 1,5 s.
  const [stored] = await Promise.all([conTiempo(almacen.leer(xpacioId), ESPERA_IDB, null), loadPublished()]);
  registro = stored;
  const mode = params.get('modo') === 'obra' ? 'obra' : 'actual';
  if (registro && registro.plan) showPlan(registro.plan, mode);
  else if (publicado) showPlan(publicado, mode);
  else if (publicadoEstado === 'error') setStatus('loadError');
  else showNoPlan();
  const crear = params.get('crear') === '1';
  if (crear || params.get('subir') === '1' || (!plan && publicadoEstado === 'none')) whenShellReady(() => { openUpload({ section: crear ? 'create' : 'upload' }); dropUploadParam(); });
  $('upload-nostore').hidden = await almacen.disponible();
}
init();
