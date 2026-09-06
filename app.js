/* app.js — extraído de index.html para lazy-load (defer). Lógica idéntica. */
// Catálogo: arrancamos sincrónicamente con localStorage o el bundled default
// para no bloquear el render. En paralelo, refrescamos desde el worker
// omnipublicity-api (KV) y, si trae algo distinto, re-renderizamos sources +
// counters. Primer load = instantáneo; segundo paint = autoritativo.
let LOCATIONS = window.loadOmnipLocations();
let plannerCatalogReady = false;
let LOC_BY_ID = new Map(LOCATIONS.map(l => [l.id, l]));
let locationsGeoJSONCache = null;
let locationsGeoJSONCacheKey = '';
let selectedCircuitId = 'all';
let selectedMetroLine = 'all';
let selectedLocationIds = new Set();
let circuitAutoSelect = true;
let circuitMapFilterActive = false;
let pendingPixeriaDraft = null;
const TOUR_DWELL_MS = 2500; // Reading time starts after the destination has rendered.
const MAX_CIRCUIT_LIST_RENDER = 350;
let circuitDemo = { running:false, items:[], index:0, timer:null };
const DEFAULT_CIRCUIT_SCOPE = 'all';
const CIRCUIT_SCOPE_OPTIONS = [
  {value:'all', labelKey:'scope_all'},
  {value:'global', labelKey:'scope_global'},
  {value:'national', labelKey:'scope_national'},
  {value:'city', labelKey:'scope_city'},
  {value:'local', labelKey:'scope_local'},
];
const CIRCUIT_IDS_BY_SCOPE = {
  all: ['all', 'metro_bcn', 'kioskos', 'estancos', 'decathlon', 'bbva', 'caixabank', 'banorte_mx', 'elcorteingles', 'correos', 'multiopticas', 'palacio', 'liverpool_mx', 'desigual', 'mango', 'retail'],
  global: ['desigual', 'mango'],
  national: ['estancos', 'decathlon', 'bbva', 'caixabank', 'banorte_mx', 'elcorteingles', 'correos', 'multiopticas', 'palacio', 'liverpool_mx'],
  city: ['metro_bcn', 'kioskos'],
  local: ['all'],
};
const CIRCUIT_TARGET_OPTIONS = {
  placements: [
    {value:'exterior', labelKey:'target_exterior'},
    {value:'interior', labelKey:'target_interior'},
  ],
  genders: [
    {value:'hombre', labelKey:'target_male'},
    {value:'mujer', labelKey:'target_female'},
  ],
  ages: [
    {value:'nino', labelKey:'age_child'},
    {value:'joven', labelKey:'age_young'},
    {value:'adulto', labelKey:'age_adult'},
    {value:'senior', labelKey:'age_senior'},
    {value:'vejez', labelKey:'age_elder'},
  ],
  timeSlots: [
    {value:'manana', labelKey:'time_morning', hours:'08:00-12:00'},
    {value:'mediodia', labelKey:'time_midday', hours:'12:00-16:00'},
    {value:'tarde', labelKey:'time_afternoon', hours:'16:00-20:00'},
    {value:'noche', labelKey:'time_night', hours:'20:00-00:00'},
  ],
};
const CIRCUIT_TARGET_SEGMENT_FIELDS = {
  placements: 'typologies',
  genders: 'genders',
  ages: 'ages',
  timeSlots: 'timeSlots',
};

function sanitizeCircuitScope(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return CIRCUIT_SCOPE_OPTIONS.some(option => option.value === normalized) ? normalized : DEFAULT_CIRCUIT_SCOPE;
}

function loadCircuitScope() {
  try { return sanitizeCircuitScope(localStorage.getItem('omnip-circuit-scope')); }
  catch (_) { return DEFAULT_CIRCUIT_SCOPE; }
}

let selectedCircuitScope = loadCircuitScope();

function defaultCircuitTarget() {
  const defaults = Object.fromEntries(Object.entries(CIRCUIT_TARGET_OPTIONS).map(([group, options]) => [group, options.map(o => o.value)]));
  const segDefaults = window.OMNIP_SEGMENTATION_OPTIONS || {};
  defaults.timeSlots = Array.isArray(segDefaults.defaultTimeSlots) ? segDefaults.defaultTimeSlots.slice() : ['manana','mediodia','tarde'];
  return defaults;
}

function sanitizeCircuitTarget(raw) {
  const defaults = defaultCircuitTarget();
  const clean = {};
  Object.entries(CIRCUIT_TARGET_OPTIONS).forEach(([group, options]) => {
    const allowed = new Set(options.map(o => o.value));
    const values = Array.isArray(raw && raw[group]) ? raw[group].filter(v => allowed.has(v)) : defaults[group];
    clean[group] = values.length ? [...new Set(values)] : [];
  });
  return clean;
}

function loadCircuitTarget() {
  try { return sanitizeCircuitTarget(JSON.parse(localStorage.getItem('omnip-circuit-target') || 'null')); }
  catch (_) { return defaultCircuitTarget(); }
}

let circuitTarget = loadCircuitTarget();

// ─── CREAR CAMPAÑA (clearchannel.tv inicia → pixeria.com genera multi-versión) ───
// El anunciante dice el producto; generamos UNA versión por cada combinación de
// los criterios que el dueño del circuito haya activado (género×edad×franja×
// emplazamiento). Aquí calculamos la matriz y hacemos el handoff a PixerIA, que
// genera cada creativo etiquetado por su segmento.
const PIXERIA_AD_BASE = 'https://www.pixeria.com/publicidad.html';
const CAMPAIGN_DIM_LABELS = {
  genders:    { hombre:'Hombre', mujer:'Mujer' },
  ages:       { nino:'Niño', joven:'Joven', adulto:'Adulto', senior:'Senior', vejez:'Vejez' },
  temporales: { manana:'Mañana', tarde:'Tarde', noche:'Noche' },
  contextuales:{ exterior:'Exterior', interior:'Interior' },
};
// Versiones = género × edad (target del circuito) × franja × contexto (panel Target).
// Tipología y Data-Driven NO multiplican: van como CONTEXTO compartido (prompt + tags).
const CAMPAIGN_DIM_ORDER = ['genders','ages','temporales','contextuales'];
const CONTENT_CTX_LABELS = {
  tipologia: { supermercados:'Supermercados', estancos:'Estancos', bancos:'Bancos', gimnasios:'Gimnasios', mupi:'MUPI', correos:'Correos', transporte:'Transporte', retail:'Retail', moda:'Moda' },
  datadriven:{ clima:'Clima', trafico:'Tráfico', moviles:'Móviles', inventario:'Inventario de tienda' },
};
// Lee el panel Target nuevo (window.CONTENT_TARGET) de forma segura.
function contentTargetSafe() {
  const c = (typeof window !== 'undefined' && window.CONTENT_TARGET) || {};
  const arr = k => Array.isArray(c[k]) ? c[k] : [];
  return { temporales:arr('temporales'), contextuales:arr('contextuales'), tipologia:arr('tipologia'), datadriven:arr('datadriven'), hora:c.hora||'', pases:c.pases||'' };
}
// Target combinado para las versiones: género/edad del circuito + franja/contexto del panel Target.
function mergedCampaignTarget() {
  const ct = contentTargetSafe();
  return { genders: Array.isArray(circuitTarget.genders)?circuitTarget.genders:[], ages: Array.isArray(circuitTarget.ages)?circuitTarget.ages:[], temporales: ct.temporales, contextuales: ct.contextuales };
}
// Contexto compartido (no genera versiones): tipología, data-driven, hora, nº pases.
function campaignContext() {
  const ct = contentTargetSafe();
  return {
    tipologia: ct.tipologia, datadriven: ct.datadriven, hora: ct.hora, pases: ct.pases,
    tipologiaLabels: ct.tipologia.map(v => CONTENT_CTX_LABELS.tipologia[v] || v),
    datadrivenLabels: ct.datadriven.map(v => CONTENT_CTX_LABELS.datadriven[v] || v),
  };
}
function campaignContextSummary() {
  const c = campaignContext();
  const parts = [];
  if (c.tipologiaLabels.length) parts.push(c.tipologiaLabels.join(', '));
  if (c.datadrivenLabels.length) parts.push(c.datadrivenLabels.join(', '));
  if (c.hora) parts.push('hora ' + c.hora);
  if (c.pases) parts.push(c.pases + ' pases');
  return parts.join(' · ');
}
// Producto cartesiano de las dimensiones activas (con ≥1 valor).
function campaignCombos(target) {
  const dims = CAMPAIGN_DIM_ORDER
    .map(k => [k, Array.isArray(target && target[k]) ? target[k] : []])
    .filter(([, vals]) => vals.length);
  let combos = [{}];
  dims.forEach(([k, vals]) => {
    const next = [];
    combos.forEach(c => vals.forEach(v => next.push({ ...c, [k]: v })));
    combos = next;
  });
  return { combos, dims: dims.map(([k]) => k) };
}
function comboLabel(combo) {
  return CAMPAIGN_DIM_ORDER.filter(k => combo[k])
    .map(k => (CAMPAIGN_DIM_LABELS[k] && CAMPAIGN_DIM_LABELS[k][combo[k]]) || combo[k]).join(' · ');
}
function openCampaignModal() {
  const isEs = (typeof lang === 'undefined') || lang !== 'en';
  document.getElementById('campaign-modal')?.remove();
  const ov = document.createElement('div');
  ov.id = 'campaign-modal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:60;background:rgba(2,8,13,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML = `
    <div style="width:520px;max-width:100%;max-height:90vh;overflow:auto;background:#0a1620;border:1px solid rgba(120,243,255,.28);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.5);font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#dff8ff">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid rgba(120,243,255,.18)">
        <b style="font-size:16px">➕ ${isEs?'Crear campaña':'Create campaign'}</b>
        <span id="campaign-close" style="cursor:pointer;color:#75aab9;font-size:22px;line-height:1">×</span>
      </div>
      <div style="padding:18px;display:flex;flex-direction:column;gap:14px">
        <label style="font-size:13px;color:#9ad8ff">${isEs?'Producto a anunciar':'Product to advertise'}
          <input id="campaign-product" type="text" placeholder="${isEs?'p.ej. perfume, zapatillas, relojes':'e.g. perfume, sneakers, watches'}" style="width:100%;margin-top:6px;padding:10px;border-radius:8px;border:1px solid rgba(120,243,255,.3);background:#02080d;color:#dff8ff;font-size:15px">
        </label>
        <div style="font-size:12.5px;color:#75aab9">${isEs?'Se generará UNA versión por cada combinación de los criterios del circuito (los que el dueño haya activado en Target):':'One version per combination of the circuit criteria (those the owner enabled in Target):'}</div>
        <div id="campaign-matrix" style="background:#02080d;border:1px solid rgba(120,243,255,.18);border-radius:9px;padding:12px"></div>
        <button id="campaign-go" style="padding:12px;border:0;border-radius:9px;background:linear-gradient(90deg,#78f3ff,#ffd866);color:#02141c;font-weight:800;font-size:15px;cursor:pointer">${isEs?'Generar en PixerIA →':'Generate in PixerIA →'}</button>
        <div style="font-size:11px;color:#5e8595">${isEs?'PixerIA crea cada versión etiquetada por segmento y vuelve a clearchannel.tv para venderse a su público.':'PixerIA creates each segment-tagged version and returns to clearchannel.tv to be sold to its audience.'}</div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.querySelector('#campaign-close').addEventListener('click', close);
  const matrix = ov.querySelector('#campaign-matrix');
  function refresh() {
    const { combos, dims } = campaignCombos(mergedCampaignTarget());
    const dimNames = dims.map(k => ({genders:isEs?'género':'gender',ages:isEs?'edad':'age',temporales:isEs?'franja':'daypart',contextuales:isEs?'contexto':'context'}[k])).join(' × ');
    const sample = combos.slice(0, 8).map(c => `<div style="font-size:11.5px;color:#9effa0;padding:1px 0">• ${comboLabel(c)||'(sin segmentar)'}</div>`).join('');
    const ctx = campaignContextSummary();
    matrix.innerHTML = `<div style="font-size:26px;font-weight:800;color:#ffd866">${combos.length} ${isEs?'versiones':'versions'}</div>`
      + `<div style="font-size:12px;color:#75aab9;margin:2px 0 8px">${dims.length?dimNames:(isEs?'sin criterios activos en Target':'no active criteria in Target')}</div>`
      + sample + (combos.length > 8 ? `<div style="font-size:11px;color:#5e8595;margin-top:3px">…+${combos.length-8} ${isEs?'más':'more'}</div>` : '')
      + (ctx ? `<div style="margin-top:9px;padding-top:8px;border-top:1px solid rgba(120,243,255,.14);font-size:11.5px;color:#9ad8ff">${isEs?'Contexto en todas':'Context on all'}: <span style="color:#ffd866">${ctx}</span></div>` : '');
    return combos;
  }
  let combos = refresh();
  ov.querySelector('#campaign-go').addEventListener('click', () => {
    const product = (ov.querySelector('#campaign-product').value || '').trim();
    if (!product) { ov.querySelector('#campaign-product').focus(); return; }
    combos = campaignCombos(mergedCampaignTarget()).combos;
    const campaignName = `${product} · ${combos.length}v`;
    const url = PIXERIA_AD_BASE + '?' + new URLSearchParams({
      from: 'admira',
      campaign: campaignName,
      product,
      circuit: selectedCircuitScope || 'all',
      combos: String(combos.length),
      segmentation: JSON.stringify(mergedCampaignTarget()),
      content: JSON.stringify(contentTargetSafe()),
    }).toString();
    window.open(url, '_blank', 'noopener');
    close();
  });
}

// ─── i18n: español / inglés ───────────────────────────────────────
const I18N = {
  es: {
    logo_home_title:'Volver al inicio',
    search_ph:'Buscar Xpace · "Xtanco", "Loterías", "BCN" o cualquier dirección',
    login:'Login', contact:'Contacto',
    emission_room:'Sala de emisión',
    ed_type_video:'Vídeo', ed_type_animation:'Animación', ed_type_image:'Imagen', ed_type_twin:'Gemelo', ed_type_npc:'NPC', ed_type_audio:'Audio', ed_type_music:'Música', ed_type_voice:'Locución', ed_others:'Otros',
    ed_linking:'◍ ENLAZANDO RED…', ed_on_air:'● EN ANTENA', ed_close_esc:'Cerrar (Esc)',
    ed_kpi_plays:'PASES HOY', ed_kpi_screens:'PANTALLAS EN ANTENA', ed_kpi_pieces:'PIEZAS EMITIDAS', ed_kpi_rate:'PASES / MIN',
    ed_radar_title:'RADAR DE CIRCUITOS · RED FÍSICA', ed_awaiting:'◌ ESPERANDO SEÑAL', ed_mix_type:'MEZCLA POR TIPO', ed_ranking:'CIRCUITOS · RANKING', ed_feed:'▸ FEED DE EMISIÓN',
    ed_nolink:'⚠ SIN ENLACE', ed_linked:'◉ RED ENLAZADA · {n} XPACIOS', ed_no_emission:'— sin emisión —', ed_no_circuits:'— sin circuitos activos —', ed_ticker_waiting:'esperando primeras emisiones del canal…',
    stores:'Xpaces', screens:'pantallas',
    select_circuit:'Seleccionar circuito', select_target:'Seleccionar target',
    lang_toggle:'ENG', lang_toggle_aria:'Cambiar a inglés',
    circuit_scope_label:'Alcance del circuito',
    scope_all:'Todos', scope_global:'Global', scope_national:'Nacional', scope_city:'Ciudad', scope_local:'Local',
    circuit_panel_title:'Seleccionar circuito', target_panel_title:'Seleccionar target', target_panel_hint:'Estos criterios segmentan la creación de contenidos.',
    circuit_metro_bcn:'Metro Barcelona Ciudad', circuit_desigual:'Desigual Global', circuit_mango:'Mango Global',
    circuit_kioskos:'Kioskos de prensa', circuit_all:'Todos los puntos locales',
    circuit_estancos:'Xtanco Nacional', circuit_decathlon:'Decathlon España', circuit_palacio:'El Palacio de Hierro · México', circuit_liverpool_mx:'Liverpool · México', circuit_bbva:'BBVA · España', circuit_banorte_mx:'Banorte · México', circuit_caixabank:'La Caixa / CaixaBank · Barcelona', circuit_elcorteingles:'El Corte Inglés · España', circuit_correos:'Correos · España', circuit_multiopticas:'MultiÓpticas · España', circuit_retail:'Otros retail físicos',
    all_lines:'Todas las líneas', whole_line:'Toda línea', whole_circuit:'Todo circuito',
    points_label:'puntos', point_label:'punto', impr_day_compact:'impr/día', cpm_label:'CPM',
    circuit_points_title:'Puntos del circuito', view_map:'Ver en mapa', buy_selection:'Comprar selección',
    demo_circuit:'Demo circuito', demo_stop:'Parar demo',
    demo_ready:'Modo demo listo: recorre <b>{points}</b> puntos del circuito completo.',
    demo_empty:'No hay puntos en este circuito para demo.',
    demo_progress:'Demo {current}/{total} · {name}',
    demo_done:'Demo circuito completado · {points} puntos',
    select_circuit_note:'Selecciona <b>todo el circuito</b> o puntos sueltos para preparar la compra.',
    target_required_note:'Completa el <b>target</b> antes de preparar la compra.',
    selection_ready:'Selección lista: <b>{points}</b> puntos · <b>{impr}</b> impr/día · alcance <b>{scope}</b> · target <b>{target}</b>.',
    target_kicker:'Target de campaña', target_title:'A quién va dirigida la comunicación',
    target_intro:'Define si la campaña impacta fuera o dentro del Xpacio y acota género, edad y franja horaria.',
    target_placement:'Tipo de publicidad', target_exterior:'Exterior',
    target_exterior_desc:'Fuera del Xpacio · puerta del Xtanco, escaparate o acceso',
    target_interior:'Interior', target_interior_desc:'Dentro del Xpacio · pantalla del Metahuman o sala',
    target_gender:'Género', target_male:'Hombre', target_male_desc:'Audiencia masculina',
    target_female:'Mujer', target_female_desc:'Audiencia femenina',
    target_age:'Edad', age_child:'Niño <14', age_child_desc:'Familias, colegios y ocio infantil',
    age_young:'Joven 15-30', age_young_desc:'Moda, ocio, estudios y primeras compras',
    age_adult:'Adulto 30-50', age_adult_desc:'Consumo urbano, retail y servicios',
    age_senior:'Senior 50-65', age_senior_desc:'Hogar, salud, viajes y fidelización',
    age_elder:'Vejez >65', age_elder_desc:'Proximidad, asistencia y compra recurrente',
    target_time:'Franja horaria', time_morning:'Mañana', time_midday:'Mediodía', time_afternoon:'Tarde', time_night:'Noche',
    target_summary:'Target: <b>{target}</b>', target_incomplete:'Target incompleto: <b>elige al menos una opción por bloque</b>',
    target_reset:'Limpiar target', target_apply:'Aplicar target',
    summary_all_placements:'Exterior + interior', summary_all_genders:'Hombre + mujer',
    summary_all_ages:'todas las edades', summary_all_day:'todo el día', summary_undefined:'sin definir',
    status_selection:'Selección · {points} puntos', status_target_campaign:'Completa el target de campaña',
    status_purchase_ready:'Compra preparada · {points} puntos seleccionados',
    status_reserved:'Solicitud recibida · {orderId}',
    orders_title:'Mis solicitudes', orders_empty:'Todavía no hay solicitudes guardadas.',
    orders_note:'Últimas 20 solicitudes de este navegador. Si borras sus cookies o usas otro dispositivo, no podrás recuperarlas aquí.',
    orders_loading:'Consultando solicitudes…', orders_refresh:'Actualizar', order_received:'Solicitud recibida',
    order_pending:'Reserva pendiente de confirmación', order_confirmed:'Reserva confirmada', order_rejected:'Reserva rechazada',
    payment_not_started:'Pago no iniciado', payment_paid:'Pagado', payment_failed:'Pago fallido', payment_refunded:'Reembolsado',
    order_cancelled:'Solicitud cancelada', order_draft:'Borrador · todavía sin enviar', order_sending:'Guardando solicitud…',
    orders_error:'No podemos consultar las solicitudes. Vuelve a intentarlo.',
    order_save_error:'No se ha podido confirmar el guardado. Reintenta con los mismos datos: no se duplicará la solicitud.',
    checkout_kicker:'Solicitud de campaña', buy_title_base:'Preparar solicitud',
    buy_dates_passes:'Fechas y pases', buy_start:'Inicio', buy_end:'Fin',
    buy_pass_date:'Fecha del pase', buy_pass_time:'Hora del pase',
    buy_passes_day:'Pases/día', passes_250:'250 pases/día', passes_500:'500 pases/día',
    passes_1000:'1.000 pases/día', passes_2500:'2.500 pases/día',
    buy_objective:'Objetivo', obj_reach:'Cobertura', obj_traffic:'Tráfico a Xpace',
    obj_launch:'Lanzamiento', obj_promo:'Promoción', buy_advertiser:'Anunciante',
    buy_duration:'Duración contenido', duration_15:'15 segundos', duration_30:'30 segundos',
    duration_45:'45 segundos', duration_60:'60 segundos',
    buy_brand:'Marca', brand_ph:'Nombre de la marca', buy_campaign:'Campaña',
    campaign_ph:'Nombre interno de campaña', buy_credit_card:'Tarjeta de crédito',
    buy_card_number:'Número', buy_exp:'Caduca', buy_summary:'Resumen',
    buy_points:'Puntos', buy_dates:'Fechas', buy_moment:'Momento',
    buy_duration_summary:'Duración', buy_passes:'Pases',
    buy_est_impr:'Impresiones estimadas', buy_base_cpm:'CPM base',
    buy_date_demand:'Demanda fecha', buy_scope:'Ámbito', buy_target:'Target', buy_total:'Total estimado', buy_submit:'Enviar solicitud',
    buy_legal:'Guardaremos tu solicitud. La disponibilidad y el precio están pendientes de confirmación; no se realiza ningún cargo ni se inicia la emisión.',
    buy_points_line:'{points} puntos · {surfaces} surfaces', buy_days_line:'{days} días',
    buy_select_dates:'Selecciona fechas', buy_per_day:'{passes} / día',
    buy_moment_line:'{date} · {time}', buy_select_moment:'Selecciona fecha y hora',
    buy_seconds:'{seconds}s',
    err_select_point:'Selecciona al menos un punto.', err_dates:'Elige un rango de fechas válido.',
    err_pass_moment:'Elige fecha y hora del pase dentro del rango de campaña.',
    err_duration:'La duración del contenido debe ser de al menos 15 segundos.',
    err_brand:'Indica la marca anunciante.', err_email:'Indica un email de facturación válido.',
    err_campaign:'Pon un nombre de campaña.', err_card:'El número de tarjeta no es válido.',
    err_exp:'La fecha de caducidad no es válida.', err_cvc:'El CVC debe tener 3 o 4 dígitos.',
    order_ok:'Solicitud <b>{orderId}</b> guardada. Importe estimado: <b>{price}</b>. ',
    hero_eyebrow:'Clear Channel · Programática en el mundo real',
    hero_h1a:'Retail Media', hero_h1b:'in the real world',
    hero_p:'Cada hueco visible — pantalla LED, escaparate, vending, panel del mostrador, push de la PWA — es <span class="tag">inventario subastable</span> en tiempo real. Busca un Xpace y aterriza en su ficha de surfaces.',
    hero_arrow:'↑ buscar arriba o pinchar un punto del mapa',
    close:'Cerrar',
    toggle_2d3d:'Alternar 2D / 3D', my_location:'Mi ubicación', locate:'Localizar',
    toggle_iso:'Vista isométrica (como el Gemelo Digital)', iso_network:'Red de Xpacios · Gemelo Digital', iso_fullscreen:'Abrir a pantalla completa ↗', iso_loading:'Cargando el Gemelo Digital…',
    pegman_title:'Arrastra el muñeco a una calle para ver Street View', streetview:'Street View',
    layer_earth_title:'Vista satélite (globo)', layer_earth:'Tierra',
    layer_map_title:'Vista de mapa oscuro', layer_map:'Mapa',
    layer_terrain_title:'Vista de relieve / topográfica', layer_terrain:'Relieve',
    searching:'Buscando…',
    addr_selected:'📍 Dirección seleccionada', request_ad:'Solicitar publicidad aquí →',
    nearest_inventory:'Inventario más cercano',
    no_inventory:'Aún no hay inventario activo cerca. Solicítalo y serás el primero en subastar este punto.',
    sv_msg:'Entra a la vista de calle de Google Street View en este punto exacto.',
    sv_enter:'Entrar a Street View ↗',
    wish_title:'¡Has atrapado una estrella fugaz!', wish_sub:'Cierra los ojos y pide un deseo…',
    wish_ok:'Pedido ✨', make_wish:'Pide un deseo',
    surfaces_available:'Surfaces disponibles', live_bids:'Pujas en vivo', create_campaign:'➕ Crear campaña', ecosystem:'ecosistema',
    how_auction:'Cómo funciona la subasta', view_twin:'Ver Gemelo Digital ↗', twin_hd:'🎥 Gemelo Hiperrealista ↗',
    tour_start:'▶ Recorrer la red', tour_stop:'⏸ Parar recorrido',
    map_preparing:'Preparando mapa · ', map_loading:'Cargando detalle · ',
    map_incomplete:'Mapa incompleto. Recorrido pausado; vuelve a iniciarlo para reintentar.',
    meta_surfaces:'surfaces', meta_imprday:'impr/día', meta_cpm:'CPM rango',
    waiting_bid:'// motor RTB conectado · esperando demanda…',
    recent:'Recientes', addresses:'Direcciones', searching_addr:'buscando direcciones…', no_addr:'sin direcciones',
    stores_bidding_1:'Xpace en bidding', stores_bidding_n:'Xpaces en bidding',
    status_landing:'Aterrizando en ', status_locating:'Localizando…',
    status_geo_unavail:'Geolocalización no disponible', status_geo_fail:'No se pudo localizar',
    status_searching:'Buscando', status_no_results:'Sin resultados · prueba "Xtanco", "BCN" o una dirección completa',
    status_sv_landing:'Bajando a Street View · ', status_sv_opening:'Abriendo Street View en Google Maps…',
    surf_live:'● LIVE', surf_sched:'PROG', surf_idle:'IDLE',
    twin_launch:'🔨 Lanzar ganador → pantalla', live_tag:'live',
    mars_hint:'Todavía no vendemos publi en Marte 🔴',
    pl_mercury:'Mercurio', pl_venus:'Venus', pl_mars:'Marte', pl_jupiter:'Júpiter', pl_saturn:'Saturno', pl_uranus:'Urano', pl_neptune:'Neptuno',
    coming_to:'Próximamente en', planet_ok:'Avísame ✨',
    sub_mercury:'Demasiado cerca del Sol para una pantalla LED: se derretiría el primer frame.',
    sub_venus:'Escaparates entre nubes de ácido sulfúrico. Mejor esperamos a la terraformación.',
    sub_mars:'Reservando el primer escaparate del Planeta Rojo… Sé el primer anunciante interplanetario.',
    sub_jupiter:'No hay suelo donde montar el mostrador: es todo gas. Inventario flotante en estudio.',
    sub_saturn:'Vallas publicitarias en los anillos: el mejor prime time del Sistema Solar.',
    sub_uranus:'Inventario congelado… literalmente. CPM bajo cero.',
    sub_neptune:'El CPM más caro de la galaxia: la señal tarda 4 horas en llegar.',
  },
  en: {
    logo_home_title:'Back to start',
    search_ph:'Search Xpace · "Xtanco", "Loterías", "BCN" or any address',
    login:'Login', contact:'Contact',
    emission_room:'Broadcast room',
    ed_type_video:'Video', ed_type_animation:'Animation', ed_type_image:'Image', ed_type_twin:'Twin', ed_type_npc:'NPC', ed_type_audio:'Audio', ed_type_music:'Music', ed_type_voice:'Voice-over', ed_others:'Others',
    ed_linking:'◍ LINKING NETWORK…', ed_on_air:'● ON AIR', ed_close_esc:'Close (Esc)',
    ed_kpi_plays:'PLAYS TODAY', ed_kpi_screens:'SCREENS ON AIR', ed_kpi_pieces:'PIECES AIRED', ed_kpi_rate:'PLAYS / MIN',
    ed_radar_title:'CIRCUITS RADAR · PHYSICAL NETWORK', ed_awaiting:'◌ AWAITING SIGNAL', ed_mix_type:'MIX BY TYPE', ed_ranking:'CIRCUITS · RANKING', ed_feed:'▸ BROADCAST FEED',
    ed_nolink:'⚠ NO LINK', ed_linked:'◉ NETWORK LINKED · {n} XPACES', ed_no_emission:'— no broadcast —', ed_no_circuits:'— no active circuits —', ed_ticker_waiting:'awaiting the channel\'s first broadcasts…',
    stores:'Xpaces', screens:'screens',
    select_circuit:'Select circuit', select_target:'Select target',
    lang_toggle:'ESP', lang_toggle_aria:'Switch to Spanish',
    circuit_scope_label:'Circuit scope',
    scope_all:'All', scope_global:'Global', scope_national:'National', scope_city:'City', scope_local:'Local',
    circuit_panel_title:'Select circuit', target_panel_title:'Select target', target_panel_hint:'These criteria segment content creation.',
    circuit_metro_bcn:'Barcelona Metro City', circuit_desigual:'Global Desigual', circuit_mango:'Mango Global',
    circuit_kioskos:'Press kiosk', circuit_all:'All local registered points',
    circuit_estancos:'National Xtanco', circuit_decathlon:'Decathlon Spain', circuit_palacio:'El Palacio de Hierro · Mexico', circuit_liverpool_mx:'Liverpool · Mexico', circuit_bbva:'BBVA · Spain', circuit_banorte_mx:'Banorte · Mexico', circuit_caixabank:'La Caixa / CaixaBank · Barcelona', circuit_elcorteingles:'El Corte Inglés · Spain', circuit_correos:'Correos · Spain', circuit_multiopticas:'MultiÓpticas · Spain', circuit_retail:'Other physical retail',
    all_lines:'All lines', whole_line:'Whole line', whole_circuit:'Whole circuit',
    points_label:'points', point_label:'point', impr_day_compact:'impr/day', cpm_label:'CPM',
    circuit_points_title:'Circuit points', view_map:'View on map', buy_selection:'Buy selection',
    demo_circuit:'Circuit demo', demo_stop:'Stop demo',
    demo_ready:'Demo mode ready: touring <b>{points}</b> points across the full circuit.',
    demo_empty:'There are no points in this circuit to demo.',
    demo_progress:'Demo {current}/{total} · {name}',
    demo_done:'Circuit demo completed · {points} points',
    select_circuit_note:'Select <b>the whole circuit</b> or individual points to prepare the purchase.',
    target_required_note:'Complete the <b>target</b> before preparing the purchase.',
    selection_ready:'Selection ready: <b>{points}</b> points · <b>{impr}</b> impr/day · scope <b>{scope}</b> · target <b>{target}</b>.',
    target_kicker:'Campaign target', target_title:'Who the communication is for',
    target_intro:'Define whether the campaign impacts outside or inside the Xpace and narrow by gender, age, and time slot.',
    target_placement:'Ad placement', target_exterior:'Exterior',
    target_exterior_desc:'Outside the Xpace · Xtanco door, shop window, or entrance',
    target_interior:'Interior', target_interior_desc:'Inside the Xpace · Metahuman screen or room',
    target_gender:'Gender', target_male:'Male', target_male_desc:'Male audience',
    target_female:'Female', target_female_desc:'Female audience',
    target_age:'Age', age_child:'Child <14', age_child_desc:'Families, schools, and children’s leisure',
    age_young:'Young 15-30', age_young_desc:'Fashion, leisure, education, and first purchases',
    age_adult:'Adult 30-50', age_adult_desc:'Urban consumption, retail, and services',
    age_senior:'Senior 50-65', age_senior_desc:'Home, health, travel, and loyalty',
    age_elder:'Elder >65', age_elder_desc:'Proximity, assistance, and recurring purchases',
    target_time:'Time slot', time_morning:'Morning', time_midday:'Midday', time_afternoon:'Afternoon', time_night:'Night',
    target_summary:'Target: <b>{target}</b>', target_incomplete:'Incomplete target: <b>choose at least one option per block</b>',
    target_reset:'Clear target', target_apply:'Apply target',
    summary_all_placements:'Exterior + interior', summary_all_genders:'Male + female',
    summary_all_ages:'all ages', summary_all_day:'all day', summary_undefined:'undefined',
    status_selection:'Selection · {points} points', status_target_campaign:'Complete the campaign target',
    status_purchase_ready:'Purchase prepared · {points} selected points',
    status_reserved:'Request received · {orderId}',
    orders_title:'My requests', orders_empty:'No saved requests yet.',
    orders_note:'Latest 20 requests from this browser. Clearing its cookies or using another device prevents recovery here.',
    orders_loading:'Loading requests…', orders_refresh:'Refresh', order_received:'Request received',
    order_pending:'Reservation awaiting confirmation', order_confirmed:'Reservation confirmed', order_rejected:'Reservation rejected',
    payment_not_started:'Payment not started', payment_paid:'Paid', payment_failed:'Payment failed', payment_refunded:'Refunded',
    order_cancelled:'Request cancelled', order_draft:'Draft · not yet sent', order_sending:'Saving request…',
    orders_error:'Requests could not be loaded. Please try again.',
    order_save_error:'We could not confirm that the request was saved. Retry with the same details: it will not be duplicated.',
    checkout_kicker:'Campaign request', buy_title_base:'Prepare request',
    buy_dates_passes:'Dates and passes', buy_start:'Start', buy_end:'End',
    buy_pass_date:'Pass date', buy_pass_time:'Pass time',
    buy_passes_day:'Passes/day', passes_250:'250 passes/day', passes_500:'500 passes/day',
    passes_1000:'1,000 passes/day', passes_2500:'2,500 passes/day',
    buy_objective:'Objective', obj_reach:'Reach', obj_traffic:'Xpace traffic',
    obj_launch:'Launch', obj_promo:'Promotion', buy_advertiser:'Advertiser',
    buy_duration:'Content duration', duration_15:'15 seconds', duration_30:'30 seconds',
    duration_45:'45 seconds', duration_60:'60 seconds',
    buy_brand:'Brand', brand_ph:'Brand name', buy_campaign:'Campaign',
    campaign_ph:'Internal campaign name', buy_credit_card:'Credit card',
    buy_card_number:'Number', buy_exp:'Expires', buy_summary:'Summary',
    buy_points:'Points', buy_dates:'Dates', buy_moment:'Moment',
    buy_duration_summary:'Duration', buy_passes:'Passes',
    buy_est_impr:'Estimated impressions', buy_base_cpm:'Base CPM',
    buy_date_demand:'Date demand', buy_scope:'Scope', buy_target:'Target', buy_total:'Estimated total', buy_submit:'Send request',
    buy_legal:'We will save your request. Availability and price await confirmation; no payment is taken and no broadcast starts.',
    buy_points_line:'{points} points · {surfaces} surfaces', buy_days_line:'{days} days',
    buy_select_dates:'Select dates', buy_per_day:'{passes} / day',
    buy_moment_line:'{date} · {time}', buy_select_moment:'Select date and time',
    buy_seconds:'{seconds}s',
    err_select_point:'Select at least one point.', err_dates:'Choose a valid date range.',
    err_pass_moment:'Choose a pass date and time within the campaign range.',
    err_duration:'Content duration must be at least 15 seconds.',
    err_brand:'Enter the advertiser brand.', err_email:'Enter a valid billing email.',
    err_campaign:'Add a campaign name.', err_card:'The card number is not valid.',
    err_exp:'The expiration date is not valid.', err_cvc:'The CVC must have 3 or 4 digits.',
    order_ok:'Request <b>{orderId}</b> saved. Estimated amount: <b>{price}</b>. ',
    hero_eyebrow:'Clear Channel · Programmatic in the real world',
    hero_h1a:'Retail Media', hero_h1b:'in the real world',
    hero_p:'Every visible spot — LED screen, shop window, vending, counter panel, PWA push — is <span class="tag">auctionable inventory</span> in real time. Search an Xpace and land on its surfaces.',
    hero_arrow:'↑ search above or click a point on the map',
    close:'Close',
    toggle_2d3d:'Toggle 2D / 3D', my_location:'My location', locate:'Locate',
    toggle_iso:'Isometric view (like the Digital Twin)', iso_network:'Xpacio network · Digital Twin', iso_fullscreen:'Open fullscreen ↗', iso_loading:'Loading the Digital Twin…',
    pegman_title:'Drag the pegman onto a street to see Street View', streetview:'Street View',
    layer_earth_title:'Satellite view (globe)', layer_earth:'Earth',
    layer_map_title:'Dark map view', layer_map:'Map',
    layer_terrain_title:'Terrain / topographic view', layer_terrain:'Terrain',
    searching:'Searching…',
    addr_selected:'📍 Selected address', request_ad:'Request advertising here →',
    nearest_inventory:'Nearest inventory',
    no_inventory:'No active inventory nearby yet. Request it and be the first to auction this spot.',
    sv_msg:'Enter Google Street View at this exact point.',
    sv_enter:'Enter Street View ↗',
    wish_title:'You caught a shooting star!', wish_sub:'Close your eyes and make a wish…',
    wish_ok:'Wished ✨', make_wish:'Make a wish',
    surfaces_available:'Available surfaces', live_bids:'Live bids', create_campaign:'➕ Create campaign', ecosystem:'ecosystem',
    how_auction:'How the auction works', view_twin:'View Digital Twin ↗', twin_hd:'🎥 Hyperrealistic Twin ↗',
    tour_start:'▶ Tour the network', tour_stop:'⏸ Stop tour',
    map_preparing:'Preparing map · ', map_loading:'Loading detail · ',
    map_incomplete:'Map incomplete. Tour paused; start it again to retry.',
    meta_surfaces:'surfaces', meta_imprday:'impr/day', meta_cpm:'CPM range',
    waiting_bid:'// RTB engine connected · waiting for demand…',
    recent:'Recent', addresses:'Addresses', searching_addr:'searching addresses…', no_addr:'no addresses',
    stores_bidding_1:'Xpace bidding', stores_bidding_n:'Xpaces bidding',
    status_landing:'Landing on ', status_locating:'Locating…',
    status_geo_unavail:'Geolocation unavailable', status_geo_fail:'Couldn’t locate',
    status_searching:'Searching', status_no_results:'No results · try "Xtanco", "BCN" or a full address',
    status_sv_landing:'Descending to Street View · ', status_sv_opening:'Opening Street View in Google Maps…',
    surf_live:'● LIVE', surf_sched:'SCHED', surf_idle:'IDLE',
    twin_launch:'🔨 Launch winner → screen', live_tag:'live',
    mars_hint:'We don’t sell ads on Mars yet 🔴',
    pl_mercury:'Mercury', pl_venus:'Venus', pl_mars:'Mars', pl_jupiter:'Jupiter', pl_saturn:'Saturn', pl_uranus:'Uranus', pl_neptune:'Neptune',
    coming_to:'Coming soon to', planet_ok:'Notify me ✨',
    sub_mercury:'Too close to the Sun for an LED screen: the first frame would melt.',
    sub_venus:'Shop windows in sulfuric acid clouds. We’ll wait for terraforming.',
    sub_mars:'Reserving the first shop window on the Red Planet… Be the first interplanetary advertiser.',
    sub_jupiter:'No ground for the counter — it’s all gas. Floating inventory under study.',
    sub_saturn:'Billboards on the rings: the best prime time in the Solar System.',
    sub_uranus:'Inventory frozen… literally. Sub-zero CPM.',
    sub_neptune:'The priciest CPM in the galaxy: the signal takes 4 hours to arrive.',
  },
};
let LANG = (function(){
  const explicit = new URLSearchParams(location.search).get('lang');
  if (['en', 'es'].includes(explicit)) return explicit;
  try { const saved = localStorage.getItem('omnip-lang'); if (['en', 'es'].includes(saved)) return saved; } catch(_) {}
  return window.ADMIRA_SITE_BRAND?.id === 'admira' ? 'es' : 'en';
})();
I18N.en.walk_preview = 'Preview campaign ↗';
I18N.es.walk_preview = 'Previsualizar campaña ↗';
function t(key){ return (I18N[LANG] && I18N[LANG][key] != null) ? I18N[LANG][key] : (I18N.es[key] != null ? I18N.es[key] : key); }
function tf(key, vars = {}) {
  return t(key).replace(/\{(\w+)\}/g, (_, name) => vars[name] == null ? '' : String(vars[name]));
}
function applyI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  const h1 = document.getElementById('hero-h1');
  if (h1) h1.innerHTML = t('hero_h1a') + '<br><span class="grad">' + t('hero_h1b') + '</span>';
  const langToggle = document.getElementById('lang-toggle');
  if (langToggle) {
    const next = LANG === 'en' ? 'es' : 'en';
    langToggle.dataset.langTarget = next;
    langToggle.textContent = t('lang_toggle');
    langToggle.setAttribute('aria-label', t('lang_toggle_aria'));
  }
  document.documentElement.lang = LANG;
}
function setLang(lang){
  LANG = (lang === 'en') ? 'en' : 'es';
  try { localStorage.setItem('omnip-lang', LANG); } catch(_){}
  applyI18n();
  // Refresca UI dinámica ya pintada
  try { renderCircuitScope(); } catch(_){}
  try { renderCircuitSelector(); } catch(_){}
  try { renderSavedOrders(); } catch(_){}
  if (typeof translatePlanner === 'function') translatePlanner();
  try { renderCircuitTarget(); } catch(_){}
  try { updateBuyQuote(); } catch(_){}
  try { const title = document.getElementById('buy-title'); if (title && !document.getElementById('buy-modal')?.hidden) title.textContent = `${t('buy_title_base')} · ${currentCircuit().label}`; } catch(_){}
  try { if (typeof activeLocation !== 'undefined' && activeLocation) renderPanel(activeLocation); } catch(_){}
  try { if (typeof searchInput !== 'undefined' && searchInput && searchInput.value) renderSuggest(searchInput.value); } catch(_){}
}

function saveCircuitScope() {
  selectedCircuitScope = sanitizeCircuitScope(selectedCircuitScope);
  try { localStorage.setItem('omnip-circuit-scope', selectedCircuitScope); } catch (_) {}
  return selectedCircuitScope;
}

function circuitScopeLabel(value = selectedCircuitScope) {
  const clean = sanitizeCircuitScope(value);
  const option = CIRCUIT_SCOPE_OPTIONS.find(item => item.value === clean);
  return t(option ? option.labelKey : 'scope_local');
}

function circuitScopePayload() {
  const value = saveCircuitScope();
  return {
    required: true,
    value,
    label: circuitScopeLabel(value),
    defaultValue: DEFAULT_CIRCUIT_SCOPE,
  };
}

function renderCircuitScope() {
  selectedCircuitScope = saveCircuitScope();
  const select = document.getElementById('circuit-scope-select');
  if (select) select.value = selectedCircuitScope;
}

function circuitScopeIsComplete() {
  return CIRCUIT_SCOPE_OPTIONS.some(option => option.value === sanitizeCircuitScope(selectedCircuitScope));
}

function circuitIdsForScope(scope = selectedCircuitScope) {
  return CIRCUIT_IDS_BY_SCOPE[sanitizeCircuitScope(scope)] || CIRCUIT_IDS_BY_SCOPE[DEFAULT_CIRCUIT_SCOPE];
}

function defaultCircuitIdForScope(scope = selectedCircuitScope) {
  return circuitIdsForScope(scope)[0] || 'all';
}

function ensureCircuitMatchesScope() {
  const allowed = circuitIdsForScope();
  if (!allowed.includes(selectedCircuitId)) {
    selectedCircuitId = defaultCircuitIdForScope();
    selectedMetroLine = 'all';
  }
  return allowed;
}

// ─── Workers (mismos que xpace-os) ────────────────────────────────
// Dominio propio: LaLiga bloquea workers.dev/r2.dev en horas de fútbol (FLT-1633).
const PIXER = 'https://api.admira.store';
// Motor RTB real (subasta de segundo precio) — pixer-worker en api.admira.store.
// GET /rtb/feed?limit=N y POST /rtb/decide. CORS habilitado para clearchannel.tv.
const RTB_BASE = 'https://api.admira.store';
// Circuito con demanda demo viva (campañas Sant Jordi / Vermut / Gelateria / Comerç).
const RTB_DEMO_CIRCUIT = 'sim-gracia';

// ── PANTALLAS VIVAS (cierra el loop crear→distribuir→VENDER) ──────────────
// Un gemelo online manda heartbeat a /signage/heartbeat con su screenId y su
// `loc` (Xpacio). Aquí descubrimos esas pantallas vivas y las enlazamos a la
// surface de su Xpacio → cualquier gemelo encendido pasa a ser VENDIBLE/targetable,
// sin tener que hardcodear su screenId en locations.js (campo pixerScreens).
window.LIVE_SCREENS = { byLoc: Object.create(null), online: 0, fetchedAt: 0 };
async function loadLiveScreens() {
  try {
    const r = await fetch(PIXER + '/signage/screens', { cache: 'no-store' });
    const d = await r.json();
    const byLoc = Object.create(null); let online = 0;
    (d.screens || []).forEach(s => {
      if (!s || !s.online || !s.loc) return;            // solo pantallas online con Xpacio conocido
      (byLoc[s.loc] = byLoc[s.loc] || []).push(s.screen);
      online++;
    });
    window.LIVE_SCREENS = { byLoc, online, fetchedAt: Date.now() };
  } catch (e) { /* red/CORS: el loop sigue con los pixerScreens hardcodeados */ }
}
function liveScreensForLoc(locId) {
  const m = window.LIVE_SCREENS && window.LIVE_SCREENS.byLoc;
  return (m && locId && m[locId]) ? m[locId] : [];
}
// Pantallas targetables de una surface = pixerScreens fijas ∪ pantallas vivas del Xpacio.
function screensForSurface(loc, surf) {
  const fixed = Array.isArray(surf && surf.pixerScreens) ? surf.pixerScreens : [];
  return [...new Set([...fixed, ...liveScreensForLoc(loc && loc.id)].filter(Boolean))];
}

// Gemelo digital genérico (público). Las tiendas con campo `twin` propio
// (p.ej. Xtanco Barcelona → su juego con modelo Barcelona) lo sobrescriben.
// Bump del ?v= al subir build nueva del gemelo (xtanco-version.js del 01).
const TWIN_BASE = 'https://www.carlossilva.info/01.-AdmiraXperience-Game/game.html?v=20260617-0006';
// Gemelo Hiperrealista (Unreal Engine 5 + Pixel Streaming). Base del player de
// Pixel Streaming (lo sirve el signalling server en la workstation del stand,
// expuesto p.ej. por Tailscale Funnel). VACÍO = botón oculto hasta que esté
// arriba. Cada punto puede además definir su propio `twinHD` en locations.js.
// El gemelo UE lee ?loc=<id> y se autoconfigura del mismo KV omnipublicity.
const TWIN_HD_BASE = '';
// Botón "Red de tiendas" → abre la vista mapa/red de todos los puntos en el gemelo.
try { const _navRed = document.getElementById('nav-red'); if (_navRed) _navRed.href = TWIN_BASE + '&view=red'; } catch (e) {}

// ─── Selector de circuitos / compra de inventario ─────────────────
function normText(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function setLocations(nextLocations) {
  LOCATIONS = Array.isArray(nextLocations) ? nextLocations : [];
  LOC_BY_ID = new Map(LOCATIONS.map(l => [l.id, l]));
  invalidateLocationsGeoJSON();
}

function invalidateLocationsGeoJSON() {
  locationsGeoJSONCache = null;
  locationsGeoJSONCacheKey = '';
}

function updateLocationsSource() {
  invalidateLocationsGeoJSON();
  const src = map && map.getSource && map.getSource('locs');
  if (src) src.setData(locationsGeoJSON());
}

function locationsSignature(list, updatedAt = '') {
  const items = Array.isArray(list) ? list : [];
  return [updatedAt || '', items.length, items[0] && items[0].id, items[items.length - 1] && items[items.length - 1].id].join('|');
}

function isKioskoLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind, loc.addr].join(' '));
  return hay.includes('kiosko') || hay.includes('quiosco') || hay.includes('prensa');
}

function isEstancoLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind].join(' '));
  return hay.includes('estanco') || hay.includes('xtanco');
}

function isMetroBarcelonaLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind, loc.addr].join(' '));
  return hay.includes('metro-barcelona') || (hay.includes('metro') && hay.includes('barcelona'));
}

function isDesigualLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind, loc.addr].join(' '));
  return hay.includes('desigual') || (loc.external && normText(loc.external.brand) === 'desigual');
}
function isMangoLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind].join(' '));
  return hay.includes('mango') || (loc.osm && normText(loc.osm.brand) === 'mango');
}
function isDecathlonLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind].join(' '));
  return hay.includes('decathlon') || (loc.osm && normText(loc.osm.brand) === 'decathlon');
}
function isPalacioLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind].join(' '));
  return hay.includes('palacio de hierro') || (loc.osm && normText(loc.osm.brand).includes('palacio de hierro'));
}
function isLiverpoolLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind].join(' '));
  const brand = loc.osm && normText(loc.osm.brand);
  const extBrand = loc.external && normText(loc.external.brand);
  const network = loc.external && normText(loc.external.network);
  return brand === 'liverpool' || extBrand === 'liverpool' || network === 'liverpool mexico' || hay.includes('liverpool');
}
function isBBVALocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind].join(' '));
  return (loc.osm && normText(loc.osm.brand) === 'bbva') || /\bbbva\b/.test(hay);
}
function isBanorteLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind].join(' '));
  const brand = loc.osm && normText(loc.osm.brand);
  const extBrand = loc.external && normText(loc.external.brand);
  const network = loc.external && normText(loc.external.network);
  return brand === 'banorte' || extBrand === 'banorte' || network === 'banorte mexico' || hay.includes('banorte') || hay.includes('bannorte');
}
function isCaixaBankLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind].join(' '));
  const brand = loc.osm && normText(loc.osm.brand);
  const extBrand = loc.external && normText(loc.external.brand);
  return brand === 'caixabank' || extBrand === 'caixabank' || hay.includes('caixabank') || hay.includes('la caixa');
}
function isElCorteInglesLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind].join(' '));
  const brand = loc.osm && normText(loc.osm.brand);
  const extBrand = loc.external && normText(loc.external.brand);
  return brand === 'el corte ingles' || extBrand === 'el corte ingles' || hay.includes('el corte ingles');
}
function isCorreosLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind].join(' '));
  const brand = loc.osm && normText(loc.osm.brand);
  const extBrand = loc.external && normText(loc.external.brand);
  const network = loc.external && normText(loc.external.network);
  return brand === 'correos' || extBrand === 'correos' || network === 'correos espana' || hay.includes('correos');
}
function isMultiopticasLocation(loc) {
  const hay = normText([loc.id, loc.name, loc.kind].join(' '));
  const brand = loc.osm && normText(loc.osm.brand);
  const extBrand = loc.external && normText(loc.external.brand);
  return brand === 'multiopticas' || extBrand === 'multiopticas' || hay.includes('multiopticas');
}

// Etiqueta de circuito de un Xpacio (para el tooltip del globo y filtros).
function circuitLabel(loc) {
  if (isDesigualLocation(loc)) return 'Desigual';
  if (isMetroBarcelonaLocation(loc)) {
    const lines = metroLinesForLocation(loc);
    return lines.length ? 'Metro Barcelona · ' + lines.join(' ') : 'Metro Barcelona';
  }
  if (isEstancoLocation(loc)) return 'Estancos';
  if (isKioskoLocation(loc)) return 'Kioscos';
  if (isMangoLocation(loc)) return 'Mango';
  if (isDecathlonLocation(loc)) return 'Decathlon';
  if (isPalacioLocation(loc)) return 'El Palacio de Hierro';
  if (isLiverpoolLocation(loc)) return 'Liverpool';
  if (isBBVALocation(loc)) return 'BBVA';
  if (isBanorteLocation(loc)) return 'Banorte';
  if (isCaixaBankLocation(loc)) return 'La Caixa / CaixaBank';
  if (isElCorteInglesLocation(loc)) return 'El Corte Inglés';
  if (isCorreosLocation(loc)) return 'Correos';
  if (isMultiopticasLocation(loc)) return 'MultiÓpticas';
  if (loc.external && loc.external.brand) return loc.external.brand;
  if (loc.osm && loc.osm.brand) return loc.osm.brand;
  return loc.network || loc.circuit || loc.brand || 'Retail';
}

function metroLinesForLocation(loc) {
  if (!isMetroBarcelonaLocation(loc)) return [];
  const text = String(loc.kind || loc.addr || '');
  const parts = text.split('·').map(s => s.trim()).filter(Boolean);
  return parts.filter(p => /^L\d/i.test(p)).map(p => p.replace(/\s+/g, ' '));
}

function metroLineSort(a, b) {
  const na = parseInt(String(a).match(/\d+/)?.[0] || '999', 10);
  const nb = parseInt(String(b).match(/\d+/)?.[0] || '999', 10);
  if (na !== nb) return na - nb;
  return String(a).localeCompare(String(b), 'ca');
}

function metroLineOptions(items) {
  const lines = new Set();
  items.forEach(loc => metroLinesForLocation(loc).forEach(line => lines.add(line)));
  return [...lines].sort(metroLineSort);
}

function circuitDefinitions() {
  const metroItems = LOCATIONS.filter(isMetroBarcelonaLocation);
  const desigualItems = LOCATIONS.filter(isDesigualLocation);
  const kioskoItems = LOCATIONS.filter(isKioskoLocation);
  const allItems = LOCATIONS.slice();
  const estancoItems = LOCATIONS.filter(isEstancoLocation);
  const mangoItems = LOCATIONS.filter(isMangoLocation);
  const decathlonItems = LOCATIONS.filter(isDecathlonLocation);
  const palacioItems = LOCATIONS.filter(isPalacioLocation);
  const liverpoolItems = LOCATIONS.filter(isLiverpoolLocation);
  const bbvaItems = LOCATIONS.filter(isBBVALocation);
  const banorteItems = LOCATIONS.filter(isBanorteLocation);
  const caixabankItems = LOCATIONS.filter(isCaixaBankLocation);
  const elcorteinglesItems = LOCATIONS.filter(isElCorteInglesLocation);
  const correosItems = LOCATIONS.filter(isCorreosLocation);
  const multiopticasItems = LOCATIONS.filter(isMultiopticasLocation);
  const retailItems = LOCATIONS.filter(l => !isKioskoLocation(l) && !isEstancoLocation(l) && !isMetroBarcelonaLocation(l) && !isDesigualLocation(l) && !isMangoLocation(l) && !isDecathlonLocation(l) && !isPalacioLocation(l) && !isLiverpoolLocation(l) && !isBBVALocation(l) && !isBanorteLocation(l) && !isCaixaBankLocation(l) && !isElCorteInglesLocation(l) && !isCorreosLocation(l) && !isMultiopticasLocation(l));
  return {
    metro_bcn: {
      label: t('circuit_metro_bcn'),
      items: metroItems,
      segmentation: circuitSegmentationForItems(metroItems),
    },
    desigual: {
      label: t('circuit_desigual'),
      items: desigualItems,
      segmentation: circuitSegmentationForItems(desigualItems),
    },
    mango: {
      label: t('circuit_mango'),
      items: mangoItems,
      segmentation: circuitSegmentationForItems(mangoItems),
    },
    decathlon: {
      label: t('circuit_decathlon'),
      items: decathlonItems,
      segmentation: circuitSegmentationForItems(decathlonItems),
    },
    palacio: {
      label: t('circuit_palacio'),
      items: palacioItems,
      segmentation: circuitSegmentationForItems(palacioItems),
    },
    liverpool_mx: {
      label: t('circuit_liverpool_mx'),
      items: liverpoolItems,
      segmentation: circuitSegmentationForItems(liverpoolItems),
    },
    bbva: {
      label: t('circuit_bbva'),
      items: bbvaItems,
      segmentation: circuitSegmentationForItems(bbvaItems),
    },
    banorte_mx: {
      label: t('circuit_banorte_mx'),
      items: banorteItems,
      segmentation: circuitSegmentationForItems(banorteItems),
    },
    caixabank: {
      label: t('circuit_caixabank'),
      items: caixabankItems,
      segmentation: circuitSegmentationForItems(caixabankItems),
    },
    elcorteingles: {
      label: t('circuit_elcorteingles'),
      items: elcorteinglesItems,
      segmentation: circuitSegmentationForItems(elcorteinglesItems),
    },
    correos: {
      label: t('circuit_correos'),
      items: correosItems,
      segmentation: circuitSegmentationForItems(correosItems),
    },
    multiopticas: {
      label: t('circuit_multiopticas'),
      items: multiopticasItems,
      segmentation: circuitSegmentationForItems(multiopticasItems),
    },
    kioskos: {
      label: t('circuit_kioskos'),
      items: kioskoItems,
      segmentation: circuitSegmentationForItems(kioskoItems),
    },
    all: {
      label: t('circuit_all'),
      items: allItems,
      segmentation: circuitSegmentationForItems(allItems),
    },
    estancos: {
      label: t('circuit_estancos'),
      items: estancoItems,
      segmentation: circuitSegmentationForItems(estancoItems),
    },
    retail: {
      label: t('circuit_retail'),
      items: retailItems,
      segmentation: circuitSegmentationForItems(retailItems),
    },
  };
}

function currentCircuit() {
  const defs = circuitDefinitions();
  ensureCircuitMatchesScope();
  return defs[selectedCircuitId] || defs[defaultCircuitIdForScope()] || defs.all;
}

function currentCircuitItems() {
  const circuit = currentCircuit();
  const items = selectedCircuitId !== 'metro_bcn' || selectedMetroLine === 'all'
    ? circuit.items
    : circuit.items.filter(loc => metroLinesForLocation(loc).includes(selectedMetroLine));
  return items.filter(loc => locationMatchesCircuitTarget(loc));
}

function currentCircuitLabel() {
  const circuit = currentCircuit();
  if (selectedCircuitId === 'metro_bcn' && selectedMetroLine !== 'all') return `${circuit.label} · ${selectedMetroLine}`;
  return circuit.label;
}

function selectedLocations() {
  return [...selectedLocationIds].map(id => LOC_BY_ID.get(id)).filter(Boolean);
}

function circuitDemoItems() {
  return currentCircuitItems().filter(loc => loc && Array.isArray(loc.coords) && Number.isFinite(loc.coords[0]) && Number.isFinite(loc.coords[1]));
}

function mapVisibleLocations() {
  if (!circuitMapFilterActive) return LOCATIONS;
  let items = currentCircuitItems();
  // Filtrar también por los CRITERIOS (target) si el usuario ha restringido algún eje
  // → el mapa refleja la segmentación (género/edad/franja/emplazamiento).
  if (circuitTargetIsActive()) items = items.filter(locationMatchesTargetSoft);
  return items;
}
// ¿Hay algún eje del target RESTRINGIDO (un subconjunto, ni vacío ni todos)?
function circuitTargetIsActive() {
  return Object.entries(CIRCUIT_TARGET_OPTIONS).some(([group, opts]) => {
    const sel = Array.isArray(circuitTarget[group]) ? circuitTarget[group] : [];
    return sel.length > 0 && sel.length < opts.length;
  });
}
// Match "blando": un eje sin restricción (vacío o todos) no constriñe.
function locationMatchesTargetSoft(loc) {
  const seg = locationSegmentation(loc);
  return Object.entries(CIRCUIT_TARGET_SEGMENT_FIELDS).every(([group, segField]) => {
    const sel = Array.isArray(circuitTarget[group]) ? circuitTarget[group] : [];
    const opts = CIRCUIT_TARGET_OPTIONS[group] || [];
    if (!sel.length || sel.length >= opts.length) return true;
    const available = Array.isArray(seg[segField]) ? seg[segField] : [];
    return hasTargetIntersection(sel, available);
  });
}

function mapScopeForLocation(loc) {
  if (isDesigualLocation(loc) || isMangoLocation(loc)) return 'global';
  if (isMetroBarcelonaLocation(loc) || isKioskoLocation(loc)) return 'local';
  return 'national';
}

function screensForXpace(loc) {
  const key = String((loc && loc.id) || (loc && loc.name) || '');
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  if (isElCorteInglesLocation(loc)) return 320 + (Math.abs(hash) % 121);
  if (isPalacioLocation(loc) || isLiverpoolLocation(loc)) return 200;
  return 1 + (Math.abs(hash) % 9);
}

function screenCountForLocations(locs) {
  return (locs || []).reduce((total, loc) => total + screensForXpace(loc), 0);
}

function updateBiddingLiveCounters(locs = mapVisibleLocations()) {
  const visible = Array.isArray(locs) ? locs : [];
  const tLocs = document.getElementById('t-locs');
  const tScreens = document.getElementById('t-screens');
  if (tLocs) tLocs.textContent = visible.length.toLocaleString('es');
  if (tScreens) tScreens.textContent = screenCountForLocations(visible).toLocaleString('es');
}

function hasTargetIntersection(selected, available) {
  if (!Array.isArray(selected) || !selected.length) return false;
  if (!Array.isArray(available) || !available.length) return false;
  const allowed = new Set(available);
  return selected.some(value => allowed.has(value));
}

function locationMatchesCircuitTarget(loc, target = circuitTarget) {
  const seg = locationSegmentation(loc);
  return Object.entries(CIRCUIT_TARGET_SEGMENT_FIELDS).every(([targetGroup, segField]) => {
    const selected = Array.isArray(target[targetGroup]) ? target[targetGroup] : [];
    const available = Array.isArray(seg[segField]) ? seg[segField] : [];
    return hasTargetIntersection(selected, available);
  });
}

function formatImpr(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K';
  return String(n);
}

function locationDailyImpr(loc) {
  return loc.surfaces.reduce((a, s) => a + (Number(s.impr) || 0), 0);
}

function locationCpmValues(loc) {
  return loc.surfaces.map(s => parseFloat(String(s.cpm).replace(/[^\d.]/g,''))).filter(Boolean);
}

function locationSurfaceCount(loc) {
  return loc.surfaces.filter(s => s.status !== 'idle').length || loc.surfaces.length || 1;
}

function locationSegmentation(loc) {
  return typeof window.normalizeOmnipSegmentation === 'function'
    ? window.normalizeOmnipSegmentation(loc).segmentation
    : (loc && loc.segmentation) || {};
}

function circuitSegmentationForItems(items) {
  const options = window.OMNIP_SEGMENTATION_OPTIONS || {
    schedule:{start:'08:00', end:'20:00'},
    typologies:['exterior','interior'],
    genders:['hombre','mujer'],
    ages:['nino','joven','adulto','senior','vejez'],
    defaultTimeSlots:['manana','mediodia','tarde'],
  };
  const out = {
    required: true,
    schedule: Object.assign({}, options.schedule),
    typologies: new Set(),
    genders: new Set(),
    ages: new Set(),
    timeSlots: new Set(),
    metadata: [],
  };
  const metaSeen = new Set();
  (Array.isArray(items) ? items : []).forEach(loc => {
    const seg = locationSegmentation(loc);
    (seg.typologies || []).forEach(v => out.typologies.add(v));
    (seg.genders || []).forEach(v => out.genders.add(v));
    (seg.ages || []).forEach(v => out.ages.add(v));
    (seg.timeSlots || []).forEach(v => out.timeSlots.add(v));
    (seg.metadata || []).forEach(m => {
      const key = [m.key || '', m.label || '', m.value || ''].join('|');
      if (metaSeen.has(key)) return;
      metaSeen.add(key);
      out.metadata.push(m);
    });
  });
  const scope = circuitScopePayload();
  return {
    required: true,
    scope,
    requiredConditions: {
      circuitScope: scope,
    },
    schedule: out.schedule,
    typologies: out.typologies.size ? [...out.typologies] : options.typologies.slice(),
    genders: out.genders.size ? [...out.genders] : options.genders.slice(),
    ages: out.ages.size ? [...out.ages] : options.ages.slice(),
    timeSlots: out.timeSlots.size ? [...out.timeSlots] : options.defaultTimeSlots.slice(),
    metadata: out.metadata,
  };
}

function circuitTargetPayload() {
  const target = sanitizeCircuitTarget(circuitTarget);
  const defaults = window.OMNIP_SEGMENTATION_OPTIONS || { schedule:{start:'08:00', end:'20:00'} };
  const scope = circuitScopePayload();
  target.scope = scope;
  target.requiredConditions = {
    circuitScope: scope,
  };
  target.schedule = Object.assign({}, defaults.schedule);
  return target;
}

function saveCircuitTarget() {
  circuitTarget = circuitTargetPayload();
  try { localStorage.setItem('omnip-circuit-target', JSON.stringify(circuitTarget)); } catch (_) {}
}

function targetIsComplete() {
  return circuitScopeIsComplete() && Object.keys(CIRCUIT_TARGET_OPTIONS).every(group => Array.isArray(circuitTarget[group]) && circuitTarget[group].length);
}

function targetLabels(group) {
  const lookup = new Map((CIRCUIT_TARGET_OPTIONS[group] || []).map(o => [o.value, group === 'timeSlots' ? `${t(o.labelKey)} ${o.hours}` : t(o.labelKey)]));
  const values = Array.isArray(circuitTarget[group]) ? circuitTarget[group] : [];
  return values.map(v => lookup.get(v) || v);
}

function targetGroupSummary(group) {
  const selected = targetLabels(group);
  const total = (CIRCUIT_TARGET_OPTIONS[group] || []).length;
  if (!selected.length) return t('summary_undefined');
  if (selected.length === total) {
    if (group === 'placements') return t('summary_all_placements');
    if (group === 'genders') return t('summary_all_genders');
    if (group === 'timeSlots') return t('summary_all_day');
    return t('summary_all_ages');
  }
  return selected.join(' + ');
}

function circuitTargetSummary() {
  return `${targetGroupSummary('placements')} · ${targetGroupSummary('genders')} · ${targetGroupSummary('ages')} · ${targetGroupSummary('timeSlots')}`;
}

function renderCircuitTarget() {
  renderCircuitScope();
  saveCircuitTarget();
  document.querySelectorAll('[data-target-group]').forEach(input => {
    const group = input.dataset.targetGroup;
    input.checked = Array.isArray(circuitTarget[group]) && circuitTarget[group].includes(input.value);
  });
  const summary = document.getElementById('target-summary-line');
  if (summary) {
    summary.innerHTML = targetIsComplete()
      ? tf('target_summary', {target: escHtml(circuitTargetSummary())})
      : t('target_incomplete');
  }
  const apply = document.getElementById('target-apply');
  if (apply) apply.disabled = !targetIsComplete();
  updateCircuitSummary();
}

function setCircuitTargetMode(open) {
  const main = document.getElementById('circuit-main-view');
  const target = document.getElementById('circuit-target-view');
  const btn = document.getElementById('circuit-target-btn');
  if (main) main.hidden = !!open;
  if (target) target.hidden = !open;
  if (btn) btn.classList.toggle('active', !!open);
  if (open) renderCircuitTarget();
  requestAnimationFrame(() => {
    const panelEl = document.getElementById('circuit-panel');
    if (!panelEl || panelEl.hidden) return;
    const rect = panelEl.getBoundingClientRect();
    setCircuitPanelPosition(rect.left, rect.top, false);
  });
}

function resetCircuitTarget() {
  stopMapNavigation();
  circuitTarget = defaultCircuitTarget();
  renderCircuitTarget();
  renderCircuitSelector();
}

function bindCircuitTargetControls() {
  document.querySelectorAll('[data-target-group]').forEach(input => {
    input.addEventListener('change', () => {
      stopMapNavigation();
      const group = input.dataset.targetGroup;
      circuitTarget[group] = [...document.querySelectorAll(`[data-target-group="${group}"]:checked`)].map(el => el.value);
      renderCircuitTarget();
      renderCircuitSelector();
    });
  });
  document.getElementById('target-reset')?.addEventListener('click', () => {
    resetCircuitTarget();
    circuitMapFilterActive = true;
    refreshSelectedMapSource();
    updateBiddingLiveCounters();
  });
  document.getElementById('target-apply')?.addEventListener('click', () => {
    stopMapNavigation();
    setCircuitTargetMode(false);
    circuitMapFilterActive = true;        // el target filtra el mapa al aplicarlo
    refreshSelectedMapSource();
    updateBiddingLiveCounters();
    if (typeof persistCheckoutPlan === 'function') persistCheckoutPlan();
  });
}

function refreshSelectedMapSource() {
  updateLocationsSource();
  // BIDDING LIVE refleja el subconjunto filtrado (alcance/circuito). Cada
  // Xpace aporta 1-9 pantallas, de forma estable por ID.
  updateBiddingLiveCounters();
}

function renderCircuitSelector() {
  const defs = circuitDefinitions();
  const select = document.getElementById('circuit-select');
  const subselect = document.getElementById('circuit-subselect');
  const list = document.getElementById('circuit-list');
  const title = document.getElementById('circuit-list-title');
  const selectAllBtn = document.getElementById('circuit-select-all');
  if (!select || !list || !title) return;
  renderCircuitScope();
  const allowedCircuitIds = ensureCircuitMatchesScope().filter(id => defs[id]);
  select.innerHTML = allowedCircuitIds.map(id => `<option value="${escHtml(id)}">${escHtml(defs[id].label)}</option>`).join('');
  const circuit = defs[selectedCircuitId] || defs[allowedCircuitIds[0]] || defs.all;
  select.value = selectedCircuitId;
  const lineOptions = selectedCircuitId === 'metro_bcn' ? metroLineOptions(circuit.items) : [];
  if (subselect) {
    subselect.hidden = selectedCircuitId !== 'metro_bcn';
    if (!subselect.hidden) {
      if (selectedMetroLine !== 'all' && !lineOptions.includes(selectedMetroLine)) selectedMetroLine = 'all';
      subselect.innerHTML = `<option value="all">${escHtml(t('all_lines'))}</option>` + lineOptions.map(line => `<option value="${escHtml(line)}">${escHtml(line)}</option>`).join('');
      subselect.value = selectedMetroLine;
    }
  }
  const items = currentCircuitItems();
  if (selectAllBtn) {
    selectAllBtn.textContent = selectedCircuitId === 'metro_bcn' && selectedMetroLine !== 'all' ? t('whole_line') : t('whole_circuit');
  }
  const idsInCircuit = new Set(items.map(l => l.id));
  selectedLocationIds = circuitAutoSelect
    ? new Set(items.map(l => l.id))
    : new Set([...selectedLocationIds].filter(id => idsInCircuit.has(id)));
  const renderedItems = items.slice(0, MAX_CIRCUIT_LIST_RENDER);
  list.innerHTML = renderedItems.map(loc => {
    const surfaces = Array.isArray(loc.surfaces) ? loc.surfaces : [];
    const live = surfaces.filter(s => s.status === 'live').length;
    const checked = selectedLocationIds.has(loc.id) ? ' checked' : '';
    const activeDemo = circuitDemo.running && circuitDemo.items[circuitDemo.index] && circuitDemo.items[circuitDemo.index].id === loc.id;
    return `<label class="circuit-point${activeDemo ? ' demo-active' : ''}" data-loc-id="${escHtml(loc.id)}">
      <input type="checkbox" value="${escHtml(loc.id)}"${checked}>
      <span>
        <span class="cp-name">${escHtml(loc.name)}</span>
        <span class="cp-addr">${escHtml(loc.addr)}</span>
      </span>
      <span class="cp-meta">${live}/${surfaces.length}</span>
    </label>`;
  }).join('') + (items.length > MAX_CIRCUIT_LIST_RENDER
    ? `<div class="circuit-point" aria-hidden="true"><span><span class="cp-name">+${items.length - MAX_CIRCUIT_LIST_RENDER} Xpaces</span><span class="cp-addr">Usa el mapa, la búsqueda o compra todo el circuito para operar la red completa.</span></span><span class="cp-meta">${MAX_CIRCUIT_LIST_RENDER}/${items.length}</span></div>`
    : '');
  title.textContent = `${currentCircuitLabel()} · ${items.length} ${items.length === 1 ? t('point_label') : t('points_label')}`;
  updateCircuitSummary();
  updateCircuitDemoUi();
  refreshSelectedMapSource();
}

function updateCircuitSummary() {
  const locs = selectedLocations();
  const impr = locs.reduce((a, loc) => a + locationDailyImpr(loc), 0);
  const cpms = locs.flatMap(locationCpmValues);
  const lo = cpms.length ? Math.min(...cpms) : null;
  const hi = cpms.length ? Math.max(...cpms) : null;
  document.getElementById('circuit-sel-count').textContent = locs.length;
  document.getElementById('circuit-sel-impr').textContent = formatImpr(impr);
  document.getElementById('circuit-sel-cpm').textContent = lo == null ? '—' : (lo === hi ? `€${lo}` : `€${lo}-${hi}`);
  const buy = document.getElementById('circuit-buy');
  const targetOk = targetIsComplete();
  if (buy) buy.disabled = !locs.length || !targetOk;
  const note = document.getElementById('circuit-note');
  if (note) {
    if (circuitDemo.running) note.innerHTML = tf('demo_ready', {points: circuitDemo.items.length});
    else if (!targetOk) note.innerHTML = t('target_required_note');
    else if (locs.length) note.innerHTML = tf('selection_ready', {
      points: locs.length,
      impr: formatImpr(impr),
      scope: escHtml(circuitScopeLabel()),
      target: escHtml(circuitTargetSummary()),
    });
    else note.innerHTML = t('select_circuit_note');
  }
}

function updateCircuitDemoUi() {
  const btn = document.getElementById('circuit-demo');
  const progress = document.getElementById('circuit-demo-progress');
  const count = circuitDemoItems().length;
  if (btn) {
    btn.disabled = !count;
    btn.classList.toggle('active', circuitDemo.running);
    btn.textContent = circuitDemo.running ? t('demo_stop') : t('demo_circuit');
  }
  if (progress) {
    const loc = circuitDemo.running ? circuitDemo.items[circuitDemo.index] : null;
    progress.textContent = loc ? tf('demo_progress', {
      current: circuitDemo.index + 1,
      total: circuitDemo.items.length,
      name: loc.name,
    }) : '';
  }
  const active = circuitDemo.running && circuitDemo.items[circuitDemo.index] ? circuitDemo.items[circuitDemo.index].id : null;
  document.querySelectorAll('.circuit-point').forEach(row => {
    const isActive = active && row.dataset.locId === active;
    row.classList.toggle('demo-active', !!isActive);
    if (isActive) row.scrollIntoView({block:'nearest'});
  });
}

function stopCircuitDemo(done = false) {
  if (circuitDemo.running) { tourCamera.cancel(); document.getElementById('status')?.classList.remove('show'); }
  if (circuitDemo.timer) clearTimeout(circuitDemo.timer);
  const total = circuitDemo.items.length;
  circuitDemo = { running:false, items:[], index:0, timer:null };
  updateCircuitDemoUi();
  updateCircuitSummary();
  updateMapTourStop();
  if (done && total) setStatus(tf('demo_done', {points: total}));
}

async function showCircuitDemoPoint() {
  const run = circuitDemo;
  if (!run.running) return;
  if (run.index >= run.items.length) { stopCircuitDemo(true); return; }
  const loc = run.items[run.index];
  if (!loc) { run.index++; showCircuitDemoPoint(); return; }
  circuitMapFilterActive = true;
  updateCircuitDemoUi();
  const arrived = await flyToLocation(loc, {automatic:true, bearing:(run.index * 29) % 360});
  if (circuitDemo !== run || !run.running) return;
  if (!arrived) { stopCircuitDemo(false); setStatus(t('map_incomplete')); return; }
  setStatus(tf('demo_progress', {current:run.index + 1, total:run.items.length, name:loc.name}));
  const next = run.items[run.index + 1];
  if (next) tourCamera.prepare(locationCamera(next, ((run.index + 1) * 29) % 360));
  run.timer = setTimeout(() => { run.index++; showCircuitDemoPoint(); }, TOUR_DWELL_MS);
}

function startCircuitDemo() {
  stopMapNavigation();
  const items = circuitDemoItems();
  if (!items.length) {
    setStatus(t('demo_empty'));
    return;
  }
  if (circuitDemo.timer) clearTimeout(circuitDemo.timer);
  const panelEl = document.getElementById('circuit-panel');
  const headerBtn = document.getElementById('header-circuit-btn');
  if (panelEl) {
    panelEl.hidden = false;
    panelEl.classList.remove('collapsed');
    restoreCircuitPanelPosition();
  }
  if (headerBtn) headerBtn.classList.add('active');
  const toggle = document.getElementById('circuit-toggle');
  if (toggle) toggle.textContent = '−';
  setCircuitTargetMode(false);
  circuitMapFilterActive = true;
  circuitDemo = { running:true, items, index:0, timer:null };
  updateMapTourStop();
  renderCircuitSelector();
  showCircuitDemoPoint();
}

function toggleCircuitDemo() {
  if (circuitDemo.running) stopCircuitDemo(false);
  else startCircuitDemo();
}

function selectWholeCircuit() {
  circuitAutoSelect = true;
  selectedLocationIds = new Set(currentCircuitItems().map(l => l.id));
  renderCircuitSelector();
  if (typeof persistCheckoutPlan === 'function') persistCheckoutPlan();
}

function clearCircuitSelection() {
  circuitAutoSelect = false;
  selectedLocationIds = new Set();
  renderCircuitSelector();
}

function zoomToSelectedCircuit() {
  stopMapNavigation();
  const locs = selectedLocations();
  if (!locs.length) return;
  splash.classList.add('hidden');
  panel.classList.remove('open');
  if (locs.length === 1) {
    flyToLocation(locs[0]);
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  locs.forEach(loc => bounds.extend(loc.coords));
  map.fitBounds(bounds, {padding:{top:120,bottom:90,left:380,right:420}, duration:1200, maxZoom:6});
  setStatus(tf('status_selection', {points: locs.length}));
}

function openCircuitPurchase() {
  const locs = selectedLocations();
  if (!locs.length) return;
  if (!targetIsComplete()) {
    setCircuitTargetMode(true);
    setStatus(t('status_target_campaign'));
    return;
  }
  const scope = circuitScopePayload();
  try {
    sessionStorage.setItem('omnip-buy-selection', JSON.stringify({
      circuit: selectedCircuitId,
      circuitScope: scope,
      requiredConditions: {
        circuitScope: scope,
      },
      ids: locs.map(l => l.id),
      names: locs.map(l => l.name),
      imprDay: locs.reduce((a, loc) => a + locationDailyImpr(loc), 0),
      segmentation: circuitSegmentationForItems(locs),
      target: circuitTargetPayload(),
      createdAt: new Date().toISOString(),
    }));
  } catch (_) {}
  openBuyCheckout();
  setStatus(tf('status_purchase_ready', {points: locs.length}));
}

function isoDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function validTimeValue(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ''));
}

function formatDateShort(dt) {
  if (!dt) return '—';
  return new Intl.DateTimeFormat(LANG === 'en' ? 'en-GB' : 'es-ES', {day:'2-digit', month:'2-digit', year:'numeric'}).format(dt);
}

function inclusiveDays(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end - start) / 86400000) + 1);
}

function dateDemandMultiplier(start, end) {
  const days = inclusiveDays(start, end);
  if (!days) return 1;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    let mult = 1;
    const dow = d.getDay();
    const month = d.getMonth() + 1;
    const date = d.getDate();
    if (dow === 5 || dow === 6) mult += 0.12;
    if (month === 7 || month === 8) mult += 0.10;
    if (month === 12 && date >= 10 && date <= 24) mult += 0.25;
    total += mult;
  }
  return total / days;
}

function selectedWeightedCpm(locs) {
  let value = 0, weight = 0;
  locs.forEach(loc => {
    const cpms = locationCpmValues(loc);
    const avg = cpms.length ? cpms.reduce((a, n) => a + n, 0) / cpms.length : 5;
    const impr = Math.max(1, locationDailyImpr(loc));
    value += avg * impr;
    weight += impr;
  });
  return weight ? value / weight : 5;
}

function calculateBuyQuote() {
  const locs = selectedLocations();
  const start = parseIsoDate(document.getElementById('buy-start')?.value);
  const end = parseIsoDate(document.getElementById('buy-end')?.value);
  const passDate = parseIsoDate(document.getElementById('buy-pass-date')?.value);
  const passTime = document.getElementById('buy-pass-time')?.value || '';
  const days = inclusiveDays(start, end);
  const passesDay = Number(document.getElementById('buy-passes')?.value || 0);
  const durationSec = Math.max(0, Number(document.getElementById('buy-duration')?.value || 15));
  const durationFactor = Math.max(1, durationSec / 15);
  const metrics = CampaignPlanner.quote(locs.map(loc => {
    const cpms = locationCpmValues(loc);
    return {id:loc.id, impr:locationDailyImpr(loc), surfaces:locationSurfaceCount(loc), cpm:cpms.length ? cpms.reduce((a,b)=>a+b,0)/cpms.length : 5};
  }), {start:document.getElementById('buy-start')?.value, end:document.getElementById('buy-end')?.value, passesDay, durationSec});
  const {dailyImpr,surfaces,cpm,demand,passFactor,estimatedImpr,price} = metrics;
  const passDateInRange = !!(start && end && passDate && passDate >= start && passDate <= end);
  return {locs, start, end, passDate, passTime, passDateInRange, days, passesDay, durationSec, durationFactor, dailyImpr, surfaces, cpm, demand, passFactor, estimatedImpr, price};
}

function formatMoney(n) {
  return new Intl.NumberFormat(LANG === 'en' ? 'en-US' : 'es-ES', {style:'currency', currency:'EUR', maximumFractionDigits:0}).format(Math.round(n || 0));
}

function formatInt(n) {
  return new Intl.NumberFormat(LANG === 'en' ? 'en-US' : 'es-ES').format(Math.round(n || 0));
}

function updateBuyQuote() {
  const q = calculateBuyQuote();
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('buy-points', tf('buy_points_line', {points: q.locs.length, surfaces: q.surfaces}));
  set('buy-days', q.days ? tf('buy_days_line', {days: q.days}) : t('buy_select_dates'));
  set('buy-moment', q.passDate && validTimeValue(q.passTime) ? tf('buy_moment_line', {date: formatDateShort(q.passDate), time: q.passTime}) : t('buy_select_moment'));
  set('buy-duration-out', tf('buy_seconds', {seconds: q.durationSec || 15}));
  set('buy-passes-out', tf('buy_per_day', {passes: formatInt(q.passesDay)}));
  set('buy-impr', q.estimatedImpr ? formatInt(q.estimatedImpr) : '—');
  set('buy-cpm', `€${q.cpm.toFixed(2)}`);
  set('buy-demand', `x${q.demand.toFixed(2)}`);
  set('buy-scope', circuitScopeLabel());
  set('buy-target', circuitTargetSummary());
  set('buy-total', q.price ? formatMoney(q.price) : '—');
  return q;
}

function seedBuyDates() {
  const startEl = document.getElementById('buy-start');
  const endEl = document.getElementById('buy-end');
  const passDateEl = document.getElementById('buy-pass-date');
  const passTimeEl = document.getElementById('buy-pass-time');
  const durationEl = document.getElementById('buy-duration');
  if (!startEl || !endEl) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const end = new Date(tomorrow);
  end.setDate(end.getDate() + 6);
  if (!startEl.value) startEl.value = isoDateLocal(tomorrow);
  if (!endEl.value) endEl.value = isoDateLocal(end);
  if (passDateEl && !passDateEl.value) passDateEl.value = startEl.value;
  if (passTimeEl && !passTimeEl.value) passTimeEl.value = '10:00';
  if (durationEl && !durationEl.value) durationEl.value = '15';
  startEl.min = isoDateLocal(new Date());
  endEl.min = startEl.value;
  if (passDateEl) {
    passDateEl.min = startEl.value;
    passDateEl.max = endEl.value;
    if (passDateEl.value && startEl.value && passDateEl.value < startEl.value) passDateEl.value = startEl.value;
    if (passDateEl.value && endEl.value && passDateEl.value > endEl.value) passDateEl.value = endEl.value;
  }
}

function parsePixeriaDraftFromUrl() {
  const params = new URLSearchParams(window.location.search || '');
  if (params.get('draft') !== 'pixeria') return null;
  const parseTarget = () => {
    try { return JSON.parse(params.get('target') || '{}'); }
    catch (_) { return {}; }
  };
  const draft = {
    id: params.get('campaignId') || `PX-${Date.now()}`,
    source: 'pixeria',
    brand: params.get('brand') || 'PixerIA',
    campaign: params.get('campaign') || 'Campaña PixerIA',
    assetUrl: params.get('assetUrl') || '',
    assetType: params.get('assetType') || 'video',
    prompt: params.get('prompt') || '',
    target: parseTarget(),
    locationId: params.get('locationId') || '',
    screenId: params.get('screenId') || '',
    pointName: params.get('pointName') || '',
    screenName: params.get('screenName') || '',
    createdAt: new Date().toISOString(),
  };
  return draft.assetUrl || draft.campaign ? draft : null;
}

function targetFromPixeriaDraft(draft) {
  const raw = draft && draft.target && typeof draft.target === 'object' ? draft.target : {};
  return sanitizeCircuitTarget({
    placements: raw.placements || raw.ubicacion || raw.location,
    genders: raw.genders || raw.genero || raw.gender,
    ages: raw.ages || raw.edades || raw.age,
    timeSlots: raw.timeSlots || raw.franjas || raw.slots || defaultCircuitTarget().timeSlots,
  });
}

function pixeriaDraftCreativePayload() {
  if (!pendingPixeriaDraft) return null;
  return {
    source: 'pixeria',
    campaignId: pendingPixeriaDraft.id,
    assetUrl: pendingPixeriaDraft.assetUrl,
    assetType: pendingPixeriaDraft.assetType,
    prompt: pendingPixeriaDraft.prompt,
    locationId: pendingPixeriaDraft.locationId,
    screenId: pendingPixeriaDraft.screenId,
    pointName: pendingPixeriaDraft.pointName,
    screenName: pendingPixeriaDraft.screenName,
    importedAt: pendingPixeriaDraft.createdAt,
  };
}

function pixeriaScreenSlug(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function selectedPixerScreens(locs, screenId) {
  const screens = [];
  (Array.isArray(locs) ? locs : []).forEach(loc => {
    (Array.isArray(loc && loc.surfaces) ? loc.surfaces : []).forEach(surface => {
      if (screenId) {
        const id = `${pixeriaScreenSlug(loc.id)}-${pixeriaScreenSlug(surface.name)}`;
        if (id !== screenId) return;
      }
      if (Array.isArray(surface.pixerScreens)) screens.push(...surface.pixerScreens);
    });
    if (loc && loc.id) screens.push(...liveScreensForLoc(loc.id));   // gemelos vivos del Xpacio
  });
  const exact = [...new Set(screens.filter(Boolean))];
  if (exact.length || !screenId) return exact;
  return selectedPixerScreens(locs, '');
}

async function pushPixeriaDraftToXpace(order, okEl) {
  const creative = order && order.creative;
  if (!creative || !creative.assetUrl || /^(blob:|data:)/.test(creative.assetUrl)) return null;
  const screens = selectedPixerScreens(order.ids.map(id => LOCATIONS.find(loc => loc.id === id)).filter(Boolean), creative.screenId);
  if (!screens.length) return null;
  const kind = creative.assetType === 'image' ? 'image' : 'video';
  const title = `${order.brand} · ${order.campaign} · ${order.orderId}`;
  if (okEl) okEl.innerHTML += '<br>Enviando creatividad comprada a XpaceOS...';
  const results = await Promise.all(screens.map(screen =>
    fetch(PIXER + '/signage/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, src: creative.assetUrl, title, target: screen }),
    })
  ));
  const failed = results.find(r => !r.ok);
  if (failed) throw new Error('signage push ' + failed.status);
  const emission = {
    pushedAt: new Date().toISOString(),
    screens,
    feed: `${PIXER}/signage/feed?limit=20`,
  };
  order.emission = emission;
  try { sessionStorage.setItem('omnip-last-order', JSON.stringify(order)); } catch (_) {}
  if (okEl) okEl.innerHTML += `<br>Emitida en XpaceOS: ${screens.map(escHtml).join(', ')}`;
  return emission;
}

function applyPixeriaDraftToTarget(draft) {
  if (!draft) return;
  circuitTarget = targetFromPixeriaDraft(draft);
  saveCircuitTarget();
  renderCircuitTarget();
}

function fillPixeriaDraftInCheckout(draft) {
  const box = document.getElementById('pixeria-draft');
  if (!box) return;
  if (!draft) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const title = document.getElementById('pixeria-draft-title');
  const meta = document.getElementById('pixeria-draft-meta');
  const asset = document.getElementById('pixeria-draft-asset');
  const brand = document.getElementById('buy-brand');
  const campaign = document.getElementById('buy-campaign');
  const duration = document.getElementById('buy-duration');
  const objective = document.getElementById('buy-objective');
  if (title) title.textContent = draft.campaign || 'Campaña PixerIA';
  if (meta) {
    const point = [draft.pointName, draft.screenName].filter(Boolean).join(' · ');
    meta.textContent = `${draft.assetType || 'asset'} · ${point ? point + ' · ' : ''}${circuitTargetSummary()}`;
  }
  if (asset) {
    asset.hidden = !draft.assetUrl;
    asset.href = draft.assetUrl || '#';
  }
  if (brand && !brand.value) brand.value = draft.brand || 'PixerIA';
  if (campaign && !campaign.value) campaign.value = draft.campaign || 'Campaña PixerIA';
  if (duration && draft.assetType === 'video') duration.value = '15';
  if (objective) objective.value = 'launch';
}

function applyPixeriaDraftToSelection(draft) {
  const loc = draft && draft.locationId ? LOCATIONS.find(item => item.id === draft.locationId) : null;
  selectedCircuitScope = 'local';
  selectedCircuitId = CIRCUIT_IDS_BY_SCOPE.local[0] || 'all';
  selectedMetroLine = 'all';
  if (loc) {
    circuitAutoSelect = false;
    selectedLocationIds = new Set([loc.id]);
  } else {
    circuitAutoSelect = true;
  }
}

function openBuyCheckout() {
  seedBuyDates();
  const modal = document.getElementById('buy-modal');
  const title = document.getElementById('buy-title');
  const ok = document.getElementById('buy-ok');
  const err = document.getElementById('buy-error');
  if (ok) ok.hidden = true;
  if (err) err.hidden = true;
  const circuit = currentCircuit();
  if (title) title.textContent = `${t('buy_title_base')} · ${circuit.label}`;
  fillPixeriaDraftInCheckout(pendingPixeriaDraft);
  if (modal) modal.hidden = false;
  updateBuyQuote();
  const state = document.getElementById('buy-state');
  if (state) state.textContent = t('order_draft');
  loadSavedOrders();
  if (typeof renderPlannerBudget === 'function') renderPlannerBudget();
}

function closeBuyCheckout() {
  const modal = document.getElementById('buy-modal');
  if (modal) modal.hidden = true;
}

function validateBuyForm() {
  const q = updateBuyQuote();
  const brand = document.getElementById('buy-brand')?.value.trim();
  const email = document.getElementById('buy-email')?.value.trim();
  const campaign = document.getElementById('buy-campaign')?.value.trim();
  const errors = [];
  if (typeof plannerBudget === 'number') {
    const budget = Number(document.getElementById('buy-plan-budget').value);
    if (!Number.isFinite(budget) || budget < 0.01 || budget > 1e12) errors.push(LANG === 'en' ? 'Enter a valid budget.' : 'Introduce un presupuesto válido.');
  }
  if (!q.locs.length) errors.push(t('err_select_point'));
  if (!q.days) errors.push(t('err_dates'));
  if (!q.passDateInRange || !validTimeValue(q.passTime)) errors.push(t('err_pass_moment'));
  if (q.durationSec < 15) errors.push(t('err_duration'));
  if (!brand) errors.push(t('err_brand'));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) errors.push(t('err_email'));
  if (!campaign) errors.push(t('err_campaign'));
  return {q, brand, email, campaign, errors};
}

let orderSubmitting = false;
let ordersClientPromise;
let savedOrders = [];
function ordersClient() {
  if (!ordersClientPromise) ordersClientPromise = import('./orders-client.mjs?v=20260905-2').then(({OrdersClient}) => new OrdersClient()).catch(error => { ordersClientPromise = null; throw error; });
  return ordersClientPromise;
}
function renderSavedOrders() {
  const list = document.getElementById('saved-orders-list');
  if (!list) return;
  if (!savedOrders.length) { list.textContent = t('orders_empty'); return; }
  list.innerHTML = savedOrders.map(order => {
    const reservation = {pending:'order_pending',confirmed:'order_confirmed',rejected:'order_rejected'}[order.reservationStatus];
    const payment = {not_started:'payment_not_started',paid:'payment_paid',failed:'payment_failed',refunded:'payment_refunded'}[order.paymentStatus];
    return `<article class="saved-order"><b>${escHtml(order.campaign)}</b><small>${escHtml(order.id)}</small>
      <p>${escHtml(t(order.status === 'cancelled' ? 'order_cancelled' : 'order_received'))}</p>
      <p>${escHtml(reservation ? t(reservation) : '—')} · ${escHtml(payment ? t(payment) : '—')}</p>
      <p>${escHtml(order.brand)} · ${escHtml(order.start)} → ${escHtml(order.end)} · ${order.ids.length} ${escHtml(t('buy_points'))}</p>
      <p>${escHtml(order.passDate)} ${escHtml(order.passTime)} · ${order.durationSec}s · ${order.passesDay} ${escHtml(t('buy_passes'))}</p>
      <p>${escHtml(t('buy_total'))}: ${escHtml(formatMoney(order.estimatedPrice))}</p>${typeof order.budget === 'number' ? `<p>${LANG === 'en' ? 'Planning budget' : 'Presupuesto orientativo'}: ${escHtml(formatMoney(order.budget))}</p>` : ''}</article>`;
  }).join('');
}
async function loadSavedOrders() {
  const list = document.getElementById('saved-orders-list');
  const refresh = document.getElementById('saved-orders-refresh');
  if (refresh) refresh.disabled = true;
  if (list) list.textContent = t('orders_loading');
  try { savedOrders = await (await ordersClient()).list(); renderSavedOrders(); }
  catch { if (list) list.textContent = t('orders_error'); }
  finally { if (refresh) refresh.disabled = false; }
}
async function submitBuyCheckout() {
  if (orderSubmitting) return;
  const err = document.getElementById('buy-error');
  const ok = document.getElementById('buy-ok');
  const button = document.getElementById('buy-submit');
  const state = document.getElementById('buy-state');
  const res = validateBuyForm();
  if (err) err.hidden = true;
  if (ok) ok.hidden = true;
  if (res.errors.length) {
    if (err) { err.textContent = res.errors.join(' · '); err.hidden = false; }
    return;
  }
  const order = {
    circuit: selectedCircuitId, circuitScope: circuitScopePayload(),
    ids: res.q.locs.map(l => l.id).sort(),
    start: document.getElementById('buy-start').value,
    end: document.getElementById('buy-end').value,
    passDate: document.getElementById('buy-pass-date').value,
    passTime: document.getElementById('buy-pass-time').value,
    passesDay: res.q.passesDay, durationSec: res.q.durationSec,
    target: circuitTargetPayload(), creative: pixeriaDraftCreativePayload(),
    ...(typeof plannerBudget === 'number' ? {budget:plannerBudget} : {}),
    price: res.q.price, brand: res.brand, email: res.email, campaign: res.campaign
  };
  orderSubmitting = true;
  document.querySelector('#buy-modal .buy-body')?.setAttribute('inert', '');
  if (button) { button.disabled = true; button.textContent = t('order_sending'); }
  if (state) state.textContent = t('order_sending');
  try {
    const saved = await (await ordersClient()).create(order);
    if (ok) {
      const reserve = {pending:'order_pending',confirmed:'order_confirmed',rejected:'order_rejected'}[saved.reservationStatus];
      const payment = {not_started:'payment_not_started',paid:'payment_paid',failed:'payment_failed',refunded:'payment_refunded'}[saved.paymentStatus];
      ok.innerHTML = tf('order_ok', {orderId:escHtml(saved.id), price:formatMoney(saved.estimatedPrice)}) + '<br>' + escHtml(reserve ? t(reserve) : '—') + ' · ' + escHtml(payment ? t(payment) : '—');
      ok.hidden = false;
    }
    if (state) state.textContent = t('order_received');
    setStatus(tf('status_reserved', {orderId:saved.id}));
    await loadSavedOrders();
  } catch {
    if (err) { err.textContent = t('order_save_error'); err.hidden = false; }
    if (state) state.textContent = t('order_save_error');
  } finally {
    orderSubmitting = false;
    document.querySelector('#buy-modal .buy-body')?.removeAttribute('inert');
    if (button) { button.disabled = false; button.textContent = t('buy_submit'); }
  }
}

function bindBuyCheckout() {
  const modal = document.getElementById('buy-modal');
  const close = document.getElementById('buy-close');
  if (!modal) return;
  ['buy-start','buy-end','buy-pass-date','buy-pass-time','buy-passes','buy-objective','buy-duration'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      const start = document.getElementById('buy-start');
      const end = document.getElementById('buy-end');
      const passDate = document.getElementById('buy-pass-date');
      if (start && end) {
        end.min = start.value || '';
        if (start.value && end.value && end.value < start.value) end.value = start.value;
      }
      if (start && end && passDate) {
        passDate.min = start.value || '';
        passDate.max = end.value || '';
        if (!passDate.value && start.value) passDate.value = start.value;
        if (passDate.value && start.value && passDate.value < start.value) passDate.value = start.value;
        if (passDate.value && end.value && passDate.value > end.value) passDate.value = end.value;
      }
      updateBuyQuote();
      if (typeof persistCheckoutPlan === 'function') persistCheckoutPlan();
    });
  });
  modal.addEventListener('input', () => {
    if (orderSubmitting) return;
    const state = document.getElementById('buy-state');
    if (state) state.textContent = t('order_draft');
    const ok = document.getElementById('buy-ok'); if (ok) ok.hidden = true;
  });
  document.getElementById('buy-submit')?.addEventListener('click', submitBuyCheckout);
  document.getElementById('header-orders-btn')?.addEventListener('click', () => {
    openBuyCheckout();
    document.querySelector('#buy-modal .buy-card')?.scrollTo({top:0});
  });
  document.getElementById('saved-orders-refresh')?.addEventListener('click', loadSavedOrders);
  if (close) close.addEventListener('click', closeBuyCheckout);
  modal.addEventListener('click', e => { if (e.target === modal) closeBuyCheckout(); });
}

function consumePixeriaDraftFromUrl() {
  const draft = parsePixeriaDraftFromUrl();
  if (!draft) return;
  pendingPixeriaDraft = draft;
  applyPixeriaDraftToTarget(draft);
  applyPixeriaDraftToSelection(draft);
  renderCircuitSelector();
  openBuyCheckout();
  try { sessionStorage.setItem('omnip-pixeria-draft', JSON.stringify(draft)); } catch (_) {}
  setStatus(`Borrador Pixeria listo para comprar · ${draft.campaign}`);
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function circuitPanelUsesMobileLayout() {
  return window.matchMedia && window.matchMedia('(max-width:720px)').matches;
}

function resetCircuitPanelInlinePosition() {
  const panelEl = document.getElementById('circuit-panel');
  if (!panelEl) return;
  panelEl.style.left = '';
  panelEl.style.top = '';
  panelEl.style.right = '';
  panelEl.style.bottom = '';
  panelEl.style.transform = '';
}

function setCircuitPanelPosition(x, y, persist = true) {
  const panelEl = document.getElementById('circuit-panel');
  if (!panelEl) return;
  if (circuitPanelUsesMobileLayout()) {
    resetCircuitPanelInlinePosition();
    return;
  }
  const rect = panelEl.getBoundingClientRect();
  const margin = 12;
  const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
  const nx = clamp(x, margin, maxX);
  const ny = clamp(y, margin, maxY);
  panelEl.style.left = nx + 'px';
  panelEl.style.top = ny + 'px';
  panelEl.style.right = 'auto';
  panelEl.style.bottom = 'auto';
  panelEl.style.transform = 'none';
  if (persist) {
    try { localStorage.setItem('omnip-circuit-panel-pos2', JSON.stringify({x:nx, y:ny})); } catch (_) {}
  }
}

function restoreCircuitPanelPosition() {
  if (circuitPanelUsesMobileLayout()) {
    resetCircuitPanelInlinePosition();
    return;
  }
  try {
    const pos = JSON.parse(localStorage.getItem('omnip-circuit-panel-pos2') || 'null');
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) setCircuitPanelPosition(pos.x, pos.y, false);
  } catch (_) {}
}

function bindCircuitPanelDrag() {
  const panelEl = document.getElementById('circuit-panel');
  const head = panelEl && panelEl.querySelector('.circuit-head');
  if (!panelEl || !head) return;
  let dragging = false, dx = 0, dy = 0;
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    if (circuitPanelUsesMobileLayout()) return;
    dragging = true;
    const rect = panelEl.getBoundingClientRect();
    dx = e.clientX - rect.left;
    dy = e.clientY - rect.top;
    try { head.setPointerCapture(e.pointerId); } catch (_) {}
  });
  head.addEventListener('pointermove', e => {
    if (!dragging) return;
    setCircuitPanelPosition(e.clientX - dx, e.clientY - dy);
  });
  function stopDrag() { dragging = false; }
  head.addEventListener('pointerup', stopDrag);
  head.addEventListener('pointercancel', stopDrag);
  window.addEventListener('resize', () => {
    if (circuitPanelUsesMobileLayout()) {
      resetCircuitPanelInlinePosition();
      return;
    }
    const rect = panelEl.getBoundingClientRect();
    setCircuitPanelPosition(rect.left, rect.top);
  });
}

function bindCircuitSelector() {
  const panelEl = document.getElementById('circuit-panel');
  const toggle = document.getElementById('circuit-toggle');
  const headerBtn = document.getElementById('header-circuit-btn');
  const scopeSelect = document.getElementById('circuit-scope-select');
  const select = document.getElementById('circuit-select');
  const subselect = document.getElementById('circuit-subselect');
  const list = document.getElementById('circuit-list');
  if (!panelEl || !toggle || !select || !list) return;
  if (headerBtn) {
    headerBtn.addEventListener('click', () => {
      panelEl.hidden = !panelEl.hidden;
      circuitMapFilterActive = !panelEl.hidden;
      if (!panelEl.hidden) {
        restoreCircuitPanelPosition();
        panelEl.classList.remove('collapsed');
        if (toggle) toggle.textContent = '−';
        setCircuitTargetMode(false);
        renderCircuitSelector();
      } else {
        stopMapNavigation();
        refreshSelectedMapSource();
      }
      headerBtn.classList.toggle('active', !panelEl.hidden);
    });
  }
  toggle.addEventListener('click', () => {
    panelEl.classList.toggle('collapsed');
    toggle.textContent = panelEl.classList.contains('collapsed') ? '+' : '−';
  });
  if (scopeSelect) {
    scopeSelect.addEventListener('change', () => {
      stopMapNavigation();
      selectedCircuitScope = sanitizeCircuitScope(scopeSelect.value);
      selectedCircuitId = defaultCircuitIdForScope();
      selectedMetroLine = 'all';
      circuitAutoSelect = false;
      selectedLocationIds = new Set();
      circuitMapFilterActive = true;
      setCircuitTargetMode(false);
      renderCircuitSelector();
      try { updateBuyQuote(); } catch (_) {}
    });
  }
  select.addEventListener('change', () => {
    stopMapNavigation();
    selectedCircuitId = select.value;
    selectedMetroLine = 'all';
    circuitAutoSelect = false;
    selectedLocationIds = new Set();
    circuitMapFilterActive = true;
    setCircuitTargetMode(false);
    renderCircuitSelector();
  });
  if (subselect) {
    subselect.addEventListener('change', () => {
      stopMapNavigation();
      selectedMetroLine = subselect.value || 'all';
      circuitAutoSelect = false;
      selectedLocationIds = new Set();
      circuitMapFilterActive = true;
      setCircuitTargetMode(false);
      renderCircuitSelector();
    });
  }
  document.getElementById('circuit-select-all').addEventListener('click', selectWholeCircuit);
  document.getElementById('circuit-target-btn')?.addEventListener('click', () => {
    const target = document.getElementById('circuit-target-view');
    setCircuitTargetMode(target ? target.hidden : true);
  });
  document.getElementById('circuit-campaign-btn')?.addEventListener('click', openCampaignModal);
  document.getElementById('circuit-zoom').addEventListener('click', zoomToSelectedCircuit);
  document.getElementById('circuit-demo')?.addEventListener('click', toggleCircuitDemo);
  document.getElementById('circuit-buy').addEventListener('click', openCircuitPurchase);
  list.addEventListener('change', e => {
    const box = e.target.closest('input[type="checkbox"]');
    if (!box) return;
    circuitAutoSelect = false;
    if (box.checked) selectedLocationIds.add(box.value);
    else selectedLocationIds.delete(box.value);
    updateCircuitSummary();
    if (typeof persistCheckoutPlan === 'function') persistCheckoutPlan();
    refreshSelectedMapSource();
  });
  bindCircuitTargetControls();
  bindCircuitPanelDrag();
  clearCircuitSelection();
}

// ─── Estilos disponibles ───────────────────────────────────────────
// Glyphs compartidos (CARTO sirve "Open Sans …") para las capas que no
// traen su propio fontstack (satélite). El estilo de relieve usa demotiles.
const CARTO_GLYPHS = 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf';

// Vista "Tierra" — imagería satélite (ESRI World Imagery) sobre el globo.
// Es la entrada tipo Google Earth: una bola del mundo realista que se gira
// y de la que se elige dónde comprar publicidad.
const STYLE_TIERRA = {
  version: 8,
  glyphs: CARTO_GLYPHS,
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256, maxzoom: 19,
      attribution: '© Esri · Maxar · Earthstar Geographics · OpenStreetMap',
    },
  },
  layers: [
    // Fondo transparente para que el starfield CSS asome alrededor del globo.
    {id:'bg', type:'background', paint:{'background-color':'rgba(0,0,0,0)'}},
    {id:'esri', type:'raster', source:'esri'},
  ],
};

// Basemap oscuro (CARTO dark-matter, vector) — coherente con el chrome
// de la marca: navy casi negro, sobre el que el cian/ámbar de los
// markers y clusters destaca como un centro de mando. Ideal al bajar a
// nivel de ciudad/calle.
const STYLE_MAPA = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const STYLE_RELIEVE = {
  version: 8,
  sources: {
    otm: {
      type: 'raster',
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256, maxzoom: 17,
      attribution: '© OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors',
    },
  },
  layers: [
    {id:'bg', type:'background', paint:{'background-color':'#0a1620'}},
    {id:'otm', type:'raster', source:'otm'},
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

// ─── Map ───────────────────────────────────────────────────────────
// Vista inicial ("posición 0") — compartida por el arranque y por el reset
// al pulsar el logo de Clear Channel.
const HOME_VIEW = {center: [-28, 16], zoom: 2.15, pitch: 0, bearing: 0};
const map = new maplibregl.Map({
  container: 'map', style: STYLE_TIERRA,
  center: HOME_VIEW.center, zoom: HOME_VIEW.zoom, pitch: HOME_VIEW.pitch,
  attributionControl: false,
  renderWorldCopies: false,
  // Keep lower-resolution parents while detailed imagery is arriving.
  cancelPendingTileRequestsWhileZooming: false,
  maxTileCacheSize: 384,
});
map.addControl(new maplibregl.AttributionControl({compact:true}), 'bottom-left');
const tourCamera = TourMap.createTourCamera(map);

let currentLayer = 'tierra';
let currentView = '3d';

function applySky() {
  try {
    map.setSky({
      // Halo atmosférico azul-cian en el borde del globo (estilo Google Earth),
      // intenso al estar lejos (vista mundo) y desvaneciéndose al bajar a calle.
      'sky-color':'#0a1c3a','sky-horizon-blend':0.5,
      'horizon-color':'#7be3ff','horizon-fog-blend':0.7,
      'fog-color':'#0a1620','fog-ground-blend':0.5,
      'atmosphere-blend':['interpolate',['linear'],['zoom'], 0,1, 5,1, 8,0],
    });
  } catch(e) {}
}

map.on('style.load', () => {
  // Reaplica la proyección activa al cambiar de capa (setStyle la resetea).
  try { map.setProjection({type: currentView === '3d' ? 'globe' : 'mercator'}); } catch(e) {}
  applySky();
  addLocationsLayer();
});
map.on('load', applySky);

// ─── Guiño techie: revelar la galaxia al alejar el zoom ───────────
const galaxyEl = document.getElementById('galaxy');
const planetsEl = document.getElementById('planets');
const marsHint = document.getElementById('mars-hint');
const hotspotsEl = document.getElementById('planet-hotspots');

// Un hotspot clicable por planeta, alineado con su posición (left/top en %).
document.querySelectorAll('#planets .planet').forEach(p => {
  const key = (p.className.match(/p-(\w+)/) || [])[1];
  if (!key) return;
  const big = key === 'jupiter';
  const hs = document.createElement('button');
  hs.type = 'button';
  hs.className = 'planet-hotspot';
  hs.dataset.planet = key;
  hs.style.left = p.style.left;
  hs.style.top = p.style.top;
  hs.style.width = hs.style.height = (big ? 64 : 46) + 'px';
  hs.setAttribute('aria-label', '');
  hs.addEventListener('click', () => openPlanet(key));
  hotspotsEl.appendChild(hs);
});

function updateGalaxy(){
  const z = map.getZoom();
  // El zoom-out está limitado (~1.49 por renderWorldCopies:false). Mapeamos la
  // opacidad al rango alcanzable: vista mundo (z≈2.15) oculta → muy alejado
  // (z≈1.55) al máximo. Así la galaxia y los planetas se revelan al alejar.
  const op = Math.max(0, Math.min(1, (2.15 - z) / 0.6));
  if (galaxyEl) galaxyEl.style.opacity = op.toFixed(2);
  if (planetsEl) planetsEl.style.opacity = op.toFixed(2);
  // Las estrellas titilantes sólo se ven con el globo entero (no sobre ciudades al hacer zoom).
  const twLayer = document.querySelector('.twinkle-layer'); if (twLayer) twLayer.style.opacity = op.toFixed(2);
  // El guiño de Marte aparece cuando casi se ve toda la galaxia.
  if (marsHint) marsHint.classList.toggle('show', op > 0.7);
  // Los planetas sólo son clicables cuando se ven bien.
  if (hotspotsEl) hotspotsEl.classList.toggle('live', op > 0.55);
}
map.on('zoom', updateGalaxy);
map.on('load', updateGalaxy);

// Deep-link a un PUNTO concreto: ?lng=..&lat=..&label=..  (lo usa el botón "Mapa"
// del CMS de flota de admira.tv para abrir el mapa en la ubicación real del equipo).
map.on('load', () => {
  try {
    const p = new URLSearchParams(location.search || '');
    const lng = parseFloat(p.get('lng')), lat = parseFloat(p.get('lat'));
    if (isFinite(lng) && isFinite(lat)) setTimeout(() => flyToAddress(lng, lat, p.get('label') || ''), 350);
  } catch (_) {}
});

// ─── Planetas clicables → "Próximamente en …" ────────────────────
const PLANET_ORB = {
  mercury:'radial-gradient(circle at 34% 30%,#d6cbc1,#6c635b)',
  venus:'radial-gradient(circle at 34% 30%,#f5e4ba,#b78a3f)',
  mars:'radial-gradient(circle at 34% 30%,#ef7d4d,#7c2208)',
  jupiter:'radial-gradient(circle at 34% 30%,#ecc59a,#965f31)',
  saturn:'radial-gradient(circle at 34% 30%,#f2e3b6,#b89a5e)',
  uranus:'radial-gradient(circle at 34% 30%,#cfeff3,#76b6c4)',
  neptune:'radial-gradient(circle at 34% 30%,#a3b8f0,#34509e)',
};
const planetModal = document.getElementById('planet-modal');
function openPlanet(key){
  document.getElementById('pm-orb').style.background = PLANET_ORB[key] || '#456';
  document.getElementById('pm-title').textContent = t('coming_to') + ' ' + t('pl_' + key);
  document.getElementById('pm-sub').textContent = t('sub_' + key);
  if (planetModal) planetModal.hidden = false;
}
function closePlanet(){ if (planetModal) planetModal.hidden = true; }
document.getElementById('pm-ok').addEventListener('click', closePlanet);
document.getElementById('pm-close').addEventListener('click', closePlanet);
if (planetModal) planetModal.addEventListener('click', e => { if (e.target === planetModal) closePlanet(); });

// ─── Cluster source con todas las tiendas ──────────────────────────
// ── ESTADO DE EMISIÓN del punto (anillo exterior) ──────────────────────
// Verde = la pantalla está publicando en /signage/now (conectada, emitiendo).
// Rojo = sin señal fresca (apagada/sin conexión). Lo sondea pollEmissionStatus.
const EMIT_STATUS = {};            // screenId -> 1 online | -1 offline
const EMIT_FRESH_MS = 170000;      // item más viejo que esto = sin conexión
const EMIT_NOW_API = 'https://api.admira.store/signage/now';
function emitScreenOf(l){
  if(!l) return '';
  if(l.screen) return l.screen;
  const surfaces = Array.isArray(l.surfaces) ? l.surfaces : [];
  const s = surfaces.find(x=>x && x.screen);
  return s ? s.screen : '';
}
function emitStatusOf(l){ const sc=emitScreenOf(l); return sc ? (EMIT_STATUS[sc]||0) : 0; }
function emissionScreens(){
  const set = new Set();
  (Array.isArray(LOCATIONS)?LOCATIONS:[]).forEach(l=>{ const sc=emitScreenOf(l); if(sc) set.add(sc); });
  return [...set];
}
let _emitPollTimer = null;
async function pollEmissionStatus(){
  const screens = emissionScreens();
  if(!screens.length) return;
  let changed = false;
  await Promise.all(screens.map(async sc=>{
    let st = -1;
    try{
      const r = await fetch(EMIT_NOW_API+'?screen='+encodeURIComponent(sc), {cache:'no-store'});
      const j = await r.json(); const it = j && j.item;
      st = (it && it.ts && (Date.now()-it.ts) < EMIT_FRESH_MS) ? 1 : -1;
    }catch(_){ st = EMIT_STATUS[sc] || -1; }
    if(EMIT_STATUS[sc] !== st){ EMIT_STATUS[sc] = st; changed = true; }
  }));
  if(changed){ try{ updateLocationsSource(); }catch(_){} }
}
function startEmissionStatusPolling(){
  if(_emitPollTimer) return;
  pollEmissionStatus();
  _emitPollTimer = setInterval(pollEmissionStatus, 12000);
}

function locationsGeoJSON() {
  const visible = mapVisibleLocations();
  const selectionKey = selectedLocationIds && selectedLocationIds.size ? [...selectedLocationIds].sort().join(',') : '';
  const cacheKey = [
    visible.length,
    visible[0] && visible[0].id,
    visible[visible.length - 1] && visible[visible.length - 1].id,
    circuitMapFilterActive ? selectedCircuitId + ':' + selectedMetroLine : 'all',
    circuitTargetIsActive() ? JSON.stringify(circuitTarget) : 'noTarget',
    selectionKey,
  ].join('|');
  if (locationsGeoJSONCache && locationsGeoJSONCacheKey === cacheKey) return locationsGeoJSONCache;
  locationsGeoJSONCacheKey = cacheKey;
  locationsGeoJSONCache = {
    type:'FeatureCollection',
    features: visible.map(l => {
      const surfaces = Array.isArray(l.surfaces) ? l.surfaces : [];
      const scope = mapScopeForLocation(l);
      return {
        type:'Feature',
        geometry:{type:'Point', coordinates: l.coords},
        properties:{
          id: l.id, name: l.name, kind: l.kind, addr: l.addr,
          circuit: circuitLabel(l),
          circuitIdx: circuitColorIdx(circuitLabel(l)),
          color: circuitColorHex(circuitLabel(l)),
          scope,
          selected: selectedLocationIds && selectedLocationIds.has(l.id) ? 1 : 0,
          live: surfaces.filter(s=>s.status==='live').length,
          total: surfaces.length,
          screen: emitScreenOf(l),
          emit: emitStatusOf(l),
        },
      };
    }),
  };
  return locationsGeoJSONCache;
}

// ── COLOR POR CIRCUITO (Carlos 2026-06-11) ──────────────────────────────
// Cada circuito (Desigual, Mango, Estancos, Metro BCN…) con su propio color en
// las burbujas del mapa, para distinguirlos al segmentar. Antes todo era rosa.
const CIRCUIT_PALETTE = ['#ff4fd8','#ffb030','#88ffaa','#78f3ff','#3a86ff','#c9a8ff','#ff6b6b','#06d6a0','#ffd23f','#9b5de5','#00f5d4','#f72585','#4cc9f0','#fee440','#39d98a'];
const CIRCUIT_COLOR_IDX = {
  'Desigual':0, 'Mango':1, 'Estancos':2, 'Kioscos':3, 'Decathlon':4, 'El Palacio de Hierro':5,
  'Liverpool':6, 'El Corte Inglés':7, 'Correos':8, 'MultiÓpticas':9, 'Metro Barcelona':10,
  'Banorte':11, 'BBVA':12, 'La Caixa / CaixaBank':13, 'Admira':14,
};
function circuitBaseName(label) { return String(label || '').split(' · ')[0]; }  // sin las líneas de metro
function circuitColorIdx(label) {
  const base = circuitBaseName(label);
  if (base in CIRCUIT_COLOR_IDX) return CIRCUIT_COLOR_IDX[base];
  let h = 0; for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;  // hash estable para marcas sueltas
  return h % CIRCUIT_PALETTE.length;
}
function circuitColorHex(label) { return CIRCUIT_PALETTE[circuitColorIdx(label)]; }

function mapScopeColorExpression() {
  // Punto individual: su propio color de circuito (precalculado en el feature).
  return ['coalesce', ['get', 'color'], '#78f3ff'];
}

function mapClusterColorExpression() {
  // Cluster: color del circuito representativo (índice mínimo presente en el grupo).
  const m = ['match', ['get', 'circIdx']];
  CIRCUIT_PALETTE.forEach((c, i) => { m.push(i, c); });
  m.push('#78f3ff');   // default
  return m;
}

/*
function locationsGeoJSON_old() {
  const visible = mapVisibleLocations();
  return {
    type:'FeatureCollection',
    features: visible.map(l => ({
      type:'Feature',
      geometry:{type:'Point', coordinates: l.coords},
      properties:{
        id: l.id, name: l.name, kind: l.kind, addr: l.addr,
        circuit: circuitLabel(l),
        selected: selectedLocationIds && selectedLocationIds.has(l.id) ? 1 : 0,
        live: l.surfaces.filter(s=>s.status==='live').length,
        total: l.surfaces.length,
      },
    })),
  };
}
*/

function addLocationsLayer() {
  if (map.getSource('locs')) return;
  map.addSource('locs', {
    type:'geojson', data: locationsGeoJSON(),
    cluster: true, clusterMaxZoom: 6, clusterRadius: 60,
    clusterProperties: {
      global_count: ['+', ['case', ['==', ['get', 'scope'], 'global'], 1, 0]],
      national_count: ['+', ['case', ['==', ['get', 'scope'], 'national'], 1, 0]],
      local_count: ['+', ['case', ['==', ['get', 'scope'], 'local'], 1, 0]],
      circIdx: ['min', ['get', 'circuitIdx']],   // circuito representativo del cluster (color)
    },
  });
  // Cluster circle
  map.addLayer({
    id:'clusters', type:'circle', source:'locs',
    filter:['has','point_count'],
    paint:{
      'circle-color': mapClusterColorExpression(),
      'circle-radius':['step',['get','point_count'], 18, 5, 24, 10, 30],
      'circle-stroke-width':2,
      'circle-stroke-color':'rgba(255,255,255,.55)',
      'circle-opacity':.85,
    },
  });
  // El glyph endpoint depende del estilo activo: satélite y mapa usan los
  // glyphs de CARTO ("Open Sans"); el relieve (demotiles) usa "Noto Sans".
  const clusterFont = currentLayer === 'relieve' ? ['Noto Sans Bold'] : ['Open Sans Bold'];
  map.addLayer({
    id:'cluster-count', type:'symbol', source:'locs',
    filter:['has','point_count'],
    layout:{
      'text-field':'{point_count_abbreviated}',
      'text-font':clusterFont,
      'text-size':14,
    },
    paint:{'text-color':'#001620'},
  });
  // Glow ambiental bajo cada tienda — brilla sobre el globo satélite.
  map.addLayer({
    id:'locs-glow', type:'circle', source:'locs',
    filter:['!',['has','point_count']],
    paint:{
      'circle-color': mapScopeColorExpression(),
      'circle-radius':['interpolate',['linear'],['zoom'], 2,11, 6,16, 12,26],
      'circle-blur':1,
      'circle-opacity':0.4,
    },
  });
  // Anillo pulsante (beacon) para tiendas con surfaces live — animado en JS.
  map.addLayer({
    id:'unclustered-pulse', type:'circle', source:'locs',
    filter:['all',['!',['has','point_count']],['>',['get','live'],0]],
    paint:{
      'circle-color':'rgba(136,255,170,0)',
      'circle-radius':12,
      // Punto de emisión: verde=conectado, rojo=sin conexión. Resto: color de circuito.
      'circle-stroke-color': ['case',
        ['==',['get','emit'],1], '#88ffaa',
        ['==',['get','emit'],-1], '#ff4d4d',
        mapScopeColorExpression()],
      'circle-stroke-width': ['case', ['!=',['get','emit'],0], 3, 2],
      'circle-stroke-opacity': ['case', ['!=',['get','emit'],0], 0.95, 0.6],
      'circle-blur':0.25,
    },
  });
  map.addLayer({
    id:'selected-ring', type:'circle', source:'locs',
    filter:['all',['!',['has','point_count']],['==',['get','selected'],1]],
    paint:{
      'circle-color':'rgba(120,243,255,0)',
      'circle-radius':['interpolate',['linear'],['zoom'], 2,12, 6,18, 12,30],
      'circle-stroke-color':'#78f3ff',
      'circle-stroke-width':3,
      'circle-stroke-opacity':0.9,
    },
  });
  // Punto nítido encima del glow.
  map.addLayer({
    id:'unclustered-point', type:'circle', source:'locs',
    filter:['!',['has','point_count']],
    paint:{
      'circle-color': mapScopeColorExpression(),
      'circle-radius':['interpolate',['linear'],['zoom'], 2,5, 6,7, 12,9],
      'circle-stroke-color':'#fff',
      'circle-stroke-width':2,
    },
  });
  try{ startEmissionStatusPolling(); }catch(_){}
  // Click en cluster → zoom in
  map.on('click', 'clusters', (e) => {
    const f = map.queryRenderedFeatures(e.point, {layers:['clusters']})[0];
    if (!f) return;
    const clusterId = f.properties.cluster_id;
    map.getSource('locs').getClusterExpansionZoom(clusterId, (err, z) => {
      if (err) return;
      map.easeTo({center: f.geometry.coordinates, zoom: z, duration: 800});
    });
  });
  // Click en punto → flyToLocation. Si el punto define twinOnClick, además abre
  // su gemelo (p.ej. tour Matterport) en una pestaña nueva.
  map.on('click', 'unclustered-point', (e) => {
    const id = e.features[0].properties.id;
    const loc = LOC_BY_ID.get(id);
    if (!loc) return;
    if (loc.twinOnClick && (loc.fly || loc.twin)) { window.open(loc.fly || loc.twin, '_blank', 'noopener'); }
    flyToLocation(loc);
  });
  // Cursor
  for (const lyr of ['clusters','unclustered-point']) {
    map.on('mouseenter', lyr, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', lyr, () => map.getCanvas().style.cursor = '');
  }
  // Tooltip al pasar el ratón: identifica el Xpacio (nombre + circuito) o la zona (cluster)
  const xpPopup = new maplibregl.Popup({closeButton:false, closeOnClick:false, offset:14, className:'xp-tooltip'});
  function showXpacioTip(e){
    const f = e.features && e.features[0]; if (!f) return;
    const p = f.properties || {};
    const live = +p.live || 0, total = +p.total || 0;
    const estado = live > 0 ? '<span class="xp-live">● LIVE</span>' : '<span class="xp-idle">○ idle</span>';
    const html = '<div class="xp-name">' + escHtml(p.name || 'Xpacio') + '</div>'
      + '<div class="xp-circuit">' + escHtml(p.circuit || 'Retail') + '</div>'
      + (p.addr ? '<div class="xp-addr">' + escHtml(p.addr) + '</div>' : '')
      + '<div class="xp-meta">' + estado + ' · ' + total + ' ' + (total === 1 ? 'superficie' : 'superficies') + '</div>';
    xpPopup.setLngLat(f.geometry.coordinates).setHTML(html).addTo(map);
  }
  map.on('mouseenter', 'unclustered-point', showXpacioTip);
  map.on('mousemove', 'unclustered-point', showXpacioTip);
  map.on('mouseleave', 'unclustered-point', () => xpPopup.remove());
  // Tooltip de cluster: cuántos Xpacios agrupa esa zona
  function showClusterTip(e){
    const f = e.features && e.features[0]; if (!f) return;
    const n = f.properties.point_count || 0;
    xpPopup.setLngLat(f.geometry.coordinates)
      .setHTML('<div class="xp-name">' + n + ' Xpacios</div><div class="xp-circuit">zona · acerca para ver</div>')
      .addTo(map);
  }
  map.on('mouseenter', 'clusters', showClusterTip);
  map.on('mousemove', 'clusters', showClusterTip);
  map.on('mouseleave', 'clusters', () => xpPopup.remove());
}

function setLayer(name) {
  if (name === currentLayer) return;
  stopMapNavigation();
  currentLayer = name;
  document.querySelectorAll('.layer-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === name));
  if (name === 'tierra') {
    map.setStyle(STYLE_TIERRA);
  } else if (name === 'mapa') {
    map.setStyle(STYLE_MAPA);
  } else if (name === 'relieve') {
    map.setStyle(STYLE_RELIEVE);
  }
}

function setView(mode) {
  if (mode === currentView) return;
  stopMapNavigation();
  currentView = mode;
  const btn = document.getElementById('btn-3d');
  if (mode === '3d') {
    map.setProjection({type:'globe'});
    btn.textContent = '3D'; btn.classList.add('active');
    if (map.getZoom() > 12) map.easeTo({pitch: 60, duration: 600});
  } else {
    map.setProjection({type:'mercator'});
    btn.textContent = '2D'; btn.classList.remove('active');
    map.easeTo({pitch: 0, bearing: 0, duration: 600});
  }
}

// ─── Vista isométrica: embebe el Gemelo Digital en su perspectiva real ──
// Sin punto activo → red de Xpacios (view=red). Con punto → ?loc=<id>,
// de forma que se ve EXACTAMENTE como en el gemelo si se aplica la campaña.
function isoUrlFor(loc) {
  let url = TWIN_BASE;
  if (loc && loc.id) url += '&loc=' + encodeURIComponent(loc.id);
  else url += '&view=red';
  return url + '&embed=1';
}
function openIsoView(customUrl, customName) {
  const ov = document.getElementById('iso-overlay');
  const fr = document.getElementById('iso-frame');
  const loading = document.getElementById('iso-loading');
  const where = document.getElementById('iso-where');
  const openLink = document.getElementById('iso-open');
  const btn = document.getElementById('btn-iso');
  if (!ov || !fr) return;
  const loc = (typeof activeLocation !== 'undefined') ? activeLocation : null;
  // customUrl = gemelo propio del punto (p.ej. Xpacio en pixeria.com) embebido SIN salir de clearchannel.tv
  const url = customUrl || isoUrlFor(loc);
  const nm = customName || (loc && loc.name);
  where.textContent = nm
    ? nm + ' · ' + t('iso_network').split('·').slice(-1)[0].trim()
    : t('iso_network');
  openLink.href = url;
  if (loading) loading.classList.remove('hide');
  fr.onload = () => { if (loading) loading.classList.add('hide'); };
  fr.src = url;
  ov.hidden = false; ov.setAttribute('aria-hidden', 'false');
  if (btn) btn.classList.add('active');
  document.addEventListener('keydown', isoEsc);
}
function closeIsoView() {
  const ov = document.getElementById('iso-overlay');
  const fr = document.getElementById('iso-frame');
  const btn = document.getElementById('btn-iso');
  if (!ov) return;
  ov.hidden = true; ov.setAttribute('aria-hidden', 'true');
  if (fr) fr.src = 'about:blank';            // libera el canvas del gemelo
  if (btn) btn.classList.remove('active');
  document.removeEventListener('keydown', isoEsc);
}
function isoEsc(e) { if (e.key === 'Escape') closeIsoView(); }
document.getElementById('btn-iso').addEventListener('click', () => {
  const ov = document.getElementById('iso-overlay');
  if (ov && ov.hidden) openIsoView(); else closeIsoView();
});
document.getElementById('iso-close').addEventListener('click', closeIsoView);

// ─── UI helpers ────────────────────────────────────────────────────
const splash  = document.getElementById('splash');
const panel   = document.getElementById('panel');
const panelClose = document.getElementById('panel-close');
const statusEl = document.getElementById('status');
const statusMsg = document.getElementById('status-msg');
const searchInput = document.getElementById('search');
const suggest = document.getElementById('suggest');

function setStatus(msg, persistent = false) {
  statusMsg.textContent = msg;
  statusEl.classList.add('show');
  clearTimeout(setStatus._t);
  if (!persistent) setStatus._t = setTimeout(() => statusEl.classList.remove('show'), 3000);
}
panelClose.addEventListener('click', () => {
  panel.classList.remove('open');
  stopBidFeed();
  activeLocation = null;
});

// ─── Controles derecha ─────────────────────────────────────────────
document.getElementById('btn-3d').addEventListener('click', () => setView(currentView === '3d' ? '2d' : '3d'));
document.getElementById('btn-zin').addEventListener('click', () => map.zoomIn({duration: 250}));
document.getElementById('btn-zout').addEventListener('click', () => map.zoomOut({duration: 250}));
document.getElementById('btn-compass').addEventListener('click', () => map.easeTo({bearing: 0, pitch: currentView === '3d' && map.getZoom() > 12 ? 60 : 0, duration: 600}));
document.getElementById('btn-loc').addEventListener('click', () => {
  if (!navigator.geolocation) { setStatus(t('status_geo_unavail')); return; }
  setStatus(t('status_locating'));
  navigator.geolocation.getCurrentPosition(
    pos => map.flyTo({center:[pos.coords.longitude, pos.coords.latitude], zoom:15, pitch: currentView==='3d'?55:0, duration:3000, essential:true}),
    err => setStatus(t('status_geo_fail') + ' (' + err.code + ')'),
    {enableHighAccuracy:true, timeout:10000}
  );
});
document.querySelectorAll('.layer-btn').forEach(btn => {
  btn.addEventListener('click', () => setLayer(btn.dataset.layer));
});

// ─── Pegman: arrastrar el muñeco a una calle → Street View ────────
// Como el mapa es MapLibre (sin Street View nativo), al soltar el muñeco
// sobre el mapa convertimos el pixel a lng/lat (unproject) y abrimos la
// vista de calle de Google Street View en esas coordenadas exactas.
(function initPegman(){
  const pegman = document.getElementById('pegman');
  if (!pegman) return;
  let dragging = false, ghost = null, hint = null;

  function moveGhost(x, y){ if (ghost){ ghost.style.left = x+'px'; ghost.style.top = y+'px'; } }

  pegman.addEventListener('pointerdown', e => {
    e.preventDefault();
    dragging = true;
    document.body.classList.add('pegman-dragging');
    ghost = pegman.querySelector('svg').cloneNode(true);
    ghost.removeAttribute('width'); ghost.removeAttribute('height');
    const wrap = document.createElement('div');
    wrap.className = 'pegman-ghost';
    wrap.appendChild(ghost);
    document.body.appendChild(wrap);
    ghost = wrap;
    moveGhost(e.clientX, e.clientY);
    hint = document.createElement('div');
    hint.className = 'pegman-hint';
    hint.textContent = '🧍 Suéltame sobre una calle';
    document.body.appendChild(hint);
    try { pegman.setPointerCapture(e.pointerId); } catch(_) {}
  });

  pegman.addEventListener('pointermove', e => {
    if (!dragging) return;
    moveGhost(e.clientX, e.clientY);
  });

  function endDrag(e){
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('pegman-dragging');
    if (ghost) { ghost.remove(); ghost = null; }
    if (hint) { hint.remove(); hint = null; }
    const mapEl = document.getElementById('map');
    const r = mapEl.getBoundingClientRect();
    const x = e.clientX, y = e.clientY;
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      const pt = map.unproject([x - r.left, y - r.top]);
      openStreetView(pt.lng, pt.lat);
    }
  }
  pegman.addEventListener('pointerup', endDrag);
  pegman.addEventListener('pointercancel', () => {
    dragging = false;
    document.body.classList.remove('pegman-dragging');
    if (ghost) { ghost.remove(); ghost = null; }
    if (hint) { hint.remove(); hint = null; }
  });
})();

function openStreetView(lng, lat){
  const la = lat.toFixed(6), lo = lng.toFixed(6);
  // Google Street View en el punto exacto (sin API key). map_action=pano abre
  // directamente la vista de calle al aterrizar el muñeco.
  const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${la},${lo}`;
  document.getElementById('sv-link').href = url;
  document.getElementById('sv-coords').textContent = `${la}, ${lo}`;
  const w = window.open(url, '_blank', 'noopener');
  if (w) setStatus(t('status_sv_landing') + la + ', ' + lo);
  else document.getElementById('streetview').hidden = false; // popup bloqueado → tarjeta con enlace
}
document.getElementById('sv-close').addEventListener('click', () => {
  document.getElementById('streetview').hidden = true;
});

// ─── ESPEJO EN VIVO de la pantalla en "available surfaces" ──────────
// Lee /signage/now?screen= (lo que publica el canal del dispositivo REAL,
// el MacBookAir) y pinta el asset que se emite AHORA. Espejo real, sin iframe,
// independiente del modo de reproduccion (local/sync/camara).
const SURF_NOW_API='https://api.admira.store/signage/now';
let _surfMirrorTimer=null;
function startSurfMirrors(){
  if(_surfMirrorTimer){ clearInterval(_surfMirrorTimer); _surfMirrorTimer=null; }
  const nodes=[...document.querySelectorAll('#surfaces .surf-mirror[data-screen]')];
  if(!nodes.length) return;
  const tick=async()=>{
    if(!nodes[0]||!document.body.contains(nodes[0])){ clearInterval(_surfMirrorTimer); _surfMirrorTimer=null; return; }
    for(let i=0;i<nodes.length;i++){
      const el=nodes[i]; const screen=el.getAttribute('data-screen'); if(!screen) continue;
      try{ const r=await fetch(SURF_NOW_API+'?screen='+encodeURIComponent(screen),{cache:'no-store'});
        const j=await r.json(); const it=j&&j.item; renderSurfMirror(el, it);
      }catch(_){}
    }
  };
  tick(); _surfMirrorTimer=setInterval(tick, 2500);
}
function renderSurfMirror(el, it){
  const thumb=el.closest('.thumb');
  const fresh = it && it.url && (!it.ts || (Date.now()-it.ts) < 200000);
  // Audiencia de cámara en la propia tarjeta del MUPI, bajo su línea de CPM.
  const card=el.closest('.surface'); const segEl=card && card.querySelector('.surf-seg');
  if(segEl) renderSegPill(segEl, fresh ? (it && it.aud) : null);
  if(!fresh){
    if(el.getAttribute('data-empty')!=='1'){ el.setAttribute('data-empty','1'); el.removeAttribute('data-id');
      el.innerHTML='<div class="surf-off">○ sin señal</div>'; if(thumb) thumb.classList.remove('live'); }
    return;
  }
  el.removeAttribute('data-empty'); if(thumb) thumb.classList.add('live');
  const type=it.type||'image';
  const sameAsset = el.getAttribute('data-id')===String(it.id);
  if(!sameAsset){
    el.setAttribute('data-id', String(it.id));
    el.setAttribute('data-started', String(it.startedAt || it.ts || Date.now()));
    const u=String(it.url).replace(/"/g,'&quot;');
    el.innerHTML = (type==='video'||type==='animation')
      ? '<video src="'+u+'" muted playsinline autoplay preload="auto"></video>'
      : '<img src="'+u+'" alt="" loading="lazy">';
  } else if(it.startedAt){ el.setAttribute('data-started', String(it.startedAt)); }
  // Sync de posición fotograma a fotograma: el preview va al segundo real que
  // emite el dispositivo (now-startedAt), corrigiendo solo si deriva > 0.7s.
  if(type==='video'||type==='animation'){
    const v=el.querySelector('video'); const started=parseInt(el.getAttribute('data-started'),10);
    if(v && started){
      if(v.readyState>=1 && isFinite(v.duration) && v.duration>0){
        const expected=(Date.now()-started)/1000;
        const target=Math.max(0, Math.min(expected, v.duration-0.05));
        if(Math.abs(v.currentTime-target)>0.7){ try{ v.currentTime=target; }catch(_){} }
      }
      if(v.paused){ v.play().catch(()=>{}); }
    }
  }
}

// Segmentación por cámara en el panel (bajo impr·día y CPM). `aud` viene en el
// item de /signage/now que publica el canal: { cam, faces, gender, age }.
function fmtSegAge(a){ return ({nino:'Niño',joven:'Joven',adulto:'Adulto',senior:'Senior',vejez:'Vejez'})[a] || a || ''; }
function renderSegPill(el, aud){
  if(!el) return;
  const base='surf-seg seg-live ';
  if(!aud || !aud.cam){
    el.hidden=false; el.className=base+'off';
    el.innerHTML='<span class="seg-pill"><span class="seg-ico">📷</span> Sin cámara</span>';
    return;
  }
  if(!aud.faces){
    el.hidden=false; el.className=base+'idle';
    el.innerHTML='<span class="seg-pill"><span class="seg-ico">📷</span> Cámara activa · nadie delante</span>';
    return;
  }
  const g = aud.gender==='f' ? '♀ Mujer' : aud.gender==='m' ? '♂ Hombre' : '';
  el.hidden=false; el.className=base+'on';
  el.innerHTML='<span class="seg-pill"><span class="seg-ico">👥</span><b>'+aud.faces+'</b>'+
    (aud.age?' · '+fmtSegAge(aud.age):'') + (g?' · '+g:'') + '</span>';
}

// ─── Thumbnails SVG por tipo de surface ───────────────────────────
function thumbFor(kind, status) {
  const live = status === 'live';
  const fill = live ? '#88ffaa' : (status === 'sched' ? '#ffd866' : '#75aab9');
  const dim = live ? 0.85 : 0.45;
  if (kind === 'pantalla') {
    return `<svg viewBox="0 0 64 48" preserveAspectRatio="xMidYMid slice" style="opacity:${dim}">
      <rect x="2" y="3" width="60" height="38" rx="2" fill="#0a1620" stroke="${fill}" stroke-width="1.2"/>
      <rect x="6" y="7" width="52" height="30" fill="${fill}" opacity=".15"/>
      <rect x="10" y="11" width="20" height="3" fill="${fill}" opacity=".7"/>
      <rect x="10" y="17" width="34" height="2" fill="${fill}" opacity=".4"/>
      <rect x="10" y="22" width="28" height="2" fill="${fill}" opacity=".4"/>
      <rect x="10" y="29" width="14" height="5" fill="${fill}" opacity=".55"/>
      <rect x="26" y="42" width="12" height="2" rx="1" fill="${fill}" opacity=".45"/>
    </svg>`;
  }
  if (kind === 'escaparate') {
    return `<svg viewBox="0 0 64 48" style="opacity:${dim}">
      <rect x="2" y="2" width="60" height="44" fill="none" stroke="${fill}" stroke-width="1.2"/>
      <line x1="32" y1="2" x2="32" y2="46" stroke="${fill}" stroke-width="0.6" opacity=".5"/>
      <line x1="2" y1="24" x2="62" y2="24" stroke="${fill}" stroke-width="0.6" opacity=".5"/>
      <rect x="6" y="6" width="22" height="14" fill="${fill}" opacity=".25"/>
      <rect x="36" y="28" width="22" height="14" fill="${fill}" opacity=".4"/>
      <circle cx="48" cy="35" r="4" fill="${fill}" opacity=".7"/>
    </svg>`;
  }
  if (kind === 'mostrador') {
    return `<svg viewBox="0 0 64 48" style="opacity:${dim}">
      <rect x="6" y="14" width="52" height="22" rx="2" fill="#0a1620" stroke="${fill}" stroke-width="1.2"/>
      <rect x="10" y="18" width="44" height="14" fill="${fill}" opacity=".18"/>
      <circle cx="32" cy="25" r="3" fill="${fill}" opacity=".7"/>
      <rect x="14" y="36" width="36" height="3" fill="${fill}" opacity=".5"/>
      <rect x="20" y="40" width="24" height="2" fill="${fill}" opacity=".3"/>
    </svg>`;
  }
  if (kind === 'vending') {
    return `<svg viewBox="0 0 64 48" style="opacity:${dim}">
      <rect x="10" y="3" width="44" height="42" rx="2" fill="none" stroke="${fill}" stroke-width="1.2"/>
      ${[0,1,2,3].map(r => [0,1,2].map(c => `<rect x="${14+c*12}" y="${7+r*9}" width="8" height="6" fill="${fill}" opacity=".${r%2===0?5:3}"/>`).join('')).join('')}
    </svg>`;
  }
  if (kind === 'pwa') {
    return `<svg viewBox="0 0 64 48" style="opacity:${dim}">
      <rect x="22" y="4" width="20" height="40" rx="3" fill="#0a1620" stroke="${fill}" stroke-width="1.2"/>
      <rect x="24" y="9" width="16" height="22" fill="${fill}" opacity=".15"/>
      <rect x="26" y="11" width="9" height="2" fill="${fill}" opacity=".7"/>
      <rect x="26" y="14" width="12" height="1.5" fill="${fill}" opacity=".4"/>
      <rect x="26" y="17" width="10" height="1.5" fill="${fill}" opacity=".4"/>
      <rect x="26" y="22" width="6" height="4" rx="1" fill="${fill}" opacity=".7"/>
      <circle cx="32" cy="38" r="1.6" fill="${fill}" opacity=".7"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 64 48"><rect x="4" y="4" width="56" height="40" fill="${fill}" opacity=".2"/></svg>`;
}

// ─── Renderiza panel para una location ────────────────────────────
let activeLocation = null;
window.getWalkPlacement = function(index) {
  if (!activeLocation || !activeLocation.surfaces[index]) return null;
  return { location: activeLocation, surface: activeLocation.surfaces[index], index, draft: pendingPixeriaDraft };
};
function renderPanel(loc) {
  activeLocation = loc;
  document.getElementById('p-name').textContent = loc.name;
  document.getElementById('p-addr').textContent = loc.addr;
  document.getElementById('p-kind').textContent = loc.kind;
  document.getElementById('p-surfaces').textContent = loc.surfaces.length;
  const totalImpr = loc.surfaces.reduce((a,s)=>a+s.impr, 0);
  document.getElementById('p-impr').textContent = '~' + (totalImpr/1000).toFixed(1) + 'K';
  const cpms = loc.surfaces.map(s => parseFloat(String(s.cpm).replace(/[^\d.]/g,''))).filter(Boolean);
  if (cpms.length) {
    const lo = Math.min(...cpms), hi = Math.max(...cpms);
    document.getElementById('p-cpm').textContent = lo === hi ? `€${lo}` : `€${lo}-€${hi}`;
  }
  const list = document.getElementById('surfaces');
  list.innerHTML = loc.surfaces.map((s, i) => {
    const hasTwin = screensForSurface(loc, s).length;   // pantalla fija o gemelo vivo del Xpacio
    return `
    <div class="surface" data-surface="${s.surface}">
      <div class="thumb ${s.status==='live'?'live':''} ${s.screen?'feed':''} ${s.orientation==='landscape'?'landscape':''}">${s.screen ? `<div class="surf-mirror" data-screen="${escHtml(s.screen)}"><div class="surf-off">○ conectando…</div></div>` : thumbFor(s.surface, s.status)}</div>
      <div class="info">
        <div class="top">
          <div class="name">${escHtml(s.name)}</div>
          <div class="status ${s.status}">${s.status === 'live' ? t('surf_live') : s.status === 'sched' ? t('surf_sched') : t('surf_idle')}</div>
        </div>
        <div class="desc">${escHtml(s.desc)}</div>
        <div class="stats"><span>${s.impr}</span> ${t('meta_imprday')} · <span>${escHtml(s.cpm)}</span> CPM · <span>${escHtml(s.surface)}</span></div>
        ${s.screen ? `<div class="surf-seg" hidden></div>` : ''}
        <button type="button" class="walk-preview" data-walk-preview="${i}">${t('walk_preview')}</button>
        ${hasTwin ? `<button class="twin-launch" data-surf-idx="${i}">${t('twin_launch')}</button>` : ''}
      </div>
    </div>`;
  }).join('');
  try{ startSurfMirrors(); }catch(_){}
  // El feed de pujas es REAL y global (poller RTB): al abrir un panel NO lo
  // vaciamos, solo re-pintamos las decisiones reales ya recibidas (o el estado
  // "esperando demanda" si aún no ha llegado ninguna).
  startBidFeed(loc);
  // Botón de gemelo/harness del panel. Data-driven por ubicación:
  //   · loc.fly     → destino del "vuelo" (con transición de despegue). p.ej.:
  //                   News & Coffee (Gràcia) → adcelerate/demo (harness CanalKiosk);
  //                   Xtanco Barcelona       → xpaceos.com/scan/visor (gemelo digital).
  //   · loc.flyLabel→ rótulo propio del botón (p.ej. 'AI HARNESS ↗'); sin él se
  //                   mantiene el rótulo por defecto traducible ('Ver Gemelo Digital').
  // Sin loc.fly → comportamiento ACTUAL intacto (loc.twin embebido / xpaceos.com).
  const pTwin = document.getElementById('p-twin');
  const panelEl = document.getElementById('panel');
  pTwin.classList.remove('launch');
  pTwin.setAttribute('target', '_blank'); // fallback: nueva pestaña (clic medio / abrir en pestaña)
  if (loc.fly) {
    pTwin.href = loc.fly;
    if (loc.flyLabel) {
      // Rótulo propio: lo sacamos del ciclo i18n para que no lo pise applyI18n al cambiar idioma.
      pTwin.removeAttribute('data-i18n');
      pTwin.textContent = loc.flyLabel;
    } else {
      pTwin.setAttribute('data-i18n', 'view_twin');
      pTwin.textContent = t('view_twin');
    }
    const reduceTwin = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    pTwin.onclick = function(e){
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // respeta nueva pestaña
      e.preventDefault();
      if (reduceTwin) { window.location.href = loc.fly; return; }
      // Despegue: el panel se atenúa/escala y volamos al destino.
      pTwin.classList.add('launch');
      if (panelEl) panelEl.classList.add('flying');
      let done = false;
      const go = () => { if (done) return; done = true; window.location.href = loc.fly; };
      (panelEl || pTwin).addEventListener('transitionend', go, { once: true });
      setTimeout(go, 520);
    };
  } else {
    // Comportamiento actual: rótulo por defecto; twin embebido (iso) si lo hay, si no xpaceos.com.
    pTwin.setAttribute('data-i18n', 'view_twin');
    pTwin.textContent = t('view_twin');
    pTwin.href = loc.twin || 'https://www.xpaceos.com';
    pTwin.onclick = function(e){
      if (loc.twin) { e.preventDefault(); openIsoView(loc.twin, loc.name); }
    };
  }
  // Gemelo Hiperrealista (UE5 · Pixel Streaming): aparece solo si el punto tiene
  // su propia URL (loc.twinHD) o si hay base global configurada (TWIN_HD_BASE).
  const pTwinHD = document.getElementById('p-twin-hd');
  if (pTwinHD) {
    const sep = u => (u.indexOf('?') === -1 ? '?' : '&');
    const hd = loc.twinHD || (TWIN_HD_BASE ? (TWIN_HD_BASE + sep(TWIN_HD_BASE) + 'loc=' + encodeURIComponent(loc.id)) : '');
    if (hd) { pTwinHD.href = hd; pTwinHD.style.display = ''; pTwinHD.setAttribute('target', '_blank'); }
    else { pTwinHD.style.display = 'none'; }
  }
}

function renderBidFeedEmpty() {
  const el = document.getElementById('bidfeed');
  el.innerHTML = '<div class="bidfeed-empty">' + escHtml(t('waiting_bid')) + '</div>';
}

// ─── Live bid feed — decisiones REALES del motor RTB (api.admira.store) ──
// Antes: generador Math.random decorativo. Ahora: polling de GET /rtb/feed con
// las subastas de segundo precio reales (advertiser, title, cpm de puja, price
// de clearing, screen/circuit). Si el motor no da demanda, el feed muestra las
// últimas conocidas + un estado honesto "esperando demanda" (nunca inventa pujas).
// ADVERTISERS se conserva solo para el fallback de launchWinnerToTwin cuando el
// decide real no devuelve demanda para esa surface.
const ADVERTISERS = ['Coca-Cola','El Corte Inglés','BBVA','Iberia','Estrella Galicia','Lotería Nac','Vapeo Pro','Nestlé','Sanitas','Telefónica','Repsol','Mahou','Mercadona','Google'];
let bidFeedItems = [];
let globalImprCount = 0;

function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function renderBidFeed() {
  const el = document.getElementById('bidfeed');
  if (!el) return;
  if (!bidFeedItems.length) { renderBidFeedEmpty(); return; }
  el.innerHTML = bidFeedItems.map((b,i) => {
    const where = b.circuit ? (b.circuit + (b.screen ? ' · ' + b.screen.replace(b.circuit + '-','') : '')) : b.surface;
    const tip = b.cpm != null
      ? `${b.advertiser}${b.title ? ' — ' + b.title : ''} · puja CPM €${b.cpm} → paga 2º precio €${b.price}${b.seg ? ' · seg ' + b.seg : ''}${b.circuit ? ' · ' + b.circuit : ''}`
      : (b.advertiser + (b.surface ? ' · ' + b.surface : ''));
    return `
    <div class="bid-row${i===0?' fresh':''}${b.real?' real':''}${b.win?' win':''}" title="${escHtml(tip)}">
      <span class="bf-price">€${escHtml(b.price)}</span>
      <span class="bf-adv">${b.win?'🔨 ':''}${b.real&&!b.win?'<span class="bf-live">LIVE</span>':''}${escHtml(b.advertiser)}</span>
      <span class="bf-surf">${escHtml(where)}</span>
      <span class="bf-ts">${escHtml(b.ts)}</span>
    </div>`;
  }).join('');
}
// renderPanel llama a estos; el feed real es global (poller propio) e independiente
// de la ubicación abierta, así que solo re-pintamos lo que ya haya llegado.
function startBidFeed(loc) { renderBidFeed(); }
function stopBidFeed() {}

// ─── Poller del feed RTB real ─────────────────────────────────────
// GET /rtb/feed?limit=20 → {ok,count,decisions:[{id,advertiser,title,cpm,price,
// currency,screen,circuit,seg,budgetLeft,ts},…]} (más recientes primero).
let rtbSeen = new Set();
let rtbBootstrapped = false;
function rtbKey(d) { return String(d.id) + ':' + String(d.ts); }
function decisionToRow(d) {
  const ts = new Date(Number(d.ts) || Date.now()).toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const price = (Number(d.price) || 0).toFixed(2);
  return { advertiser: d.advertiser || 'campaña', title: d.title || '', surface: d.screen || d.circuit || '',
           screen: d.screen || '', circuit: d.circuit || '', seg: d.seg || '', cpm: d.cpm, price, ts, real: true };
}
async function pollRtbFeed() {
  try {
    const r = await fetch(RTB_BASE + '/rtb/feed?limit=20', {cache:'no-store'});
    if (!r.ok) return;
    const d = await r.json();
    const decisions = Array.isArray(d && d.decisions) ? d.decisions : [];
    if (!rtbBootstrapped) {
      // Primera carga: sembramos el feed con las últimas reales para que se vea
      // actividad al abrir, marcándolas como vistas (no las volvemos a inyectar).
      const seed = decisions.slice(0, 10);
      seed.forEach(x => rtbSeen.add(rtbKey(x)));
      bidFeedItems = seed.map(decisionToRow);   // ya vienen más recientes primero
      rtbBootstrapped = true;
      renderBidFeed();
      return;
    }
    // Prepend solo las nuevas, en orden cronológico (viejas→nuevas) para que la
    // más reciente quede arriba.
    for (let i = decisions.length - 1; i >= 0; i--) {
      const dec = decisions[i];
      if (!dec || dec.id == null) continue;
      const k = rtbKey(dec);
      if (rtbSeen.has(k)) continue;
      rtbSeen.add(k);
      bidFeedItems.unshift(decisionToRow(dec));
      if (bidFeedItems.length > 14) bidFeedItems.pop();
      globalImprCount++;
    }
    if (rtbSeen.size > 600) { const arr = Array.from(rtbSeen); rtbSeen = new Set(arr.slice(-400)); }
    renderBidFeed();
    const ti = document.getElementById('t-impr'); if (ti) ti.textContent = globalImprCount.toLocaleString('es');
  } catch { /* motor dormido — conservamos las últimas conocidas, sin inventar */ }
}
pollRtbFeed();
setInterval(pollRtbFeed, 6000);

// ─── Generador de tráfico para la demo (subastas REALES) ──────────
// Solo tras gesto del usuario. Cada disparo es un POST /rtb/decide real contra
// el circuito demo (sim-gracia) con un segmento variado: descuenta presupuesto de
// verdad de las campañas demo. Muestra la decisión real (ganador + 2º precio) y
// refresca el feed inmediatamente.
const RTB_DEMO_SEGMENTS = [
  {audience:'female', age:'adulto'},
  {audience:'male',   age:'adulto', slot:'mediodia'},
  {audience:'female', age:'joven',  slot:'tarde'},
  {audience:'male',   age:'senior', slot:'noche'},
  {audience:'female', age:'senior'},
  {audience:'male',   age:'joven',  slot:'tarde'},
  {audience:'female', age:'adulto', slot:'manana'},
  {audience:'male',   age:'adulto'},
];
let rtbTrafficTimer = null;
let rtbTrafficIdx = 0;
function setTrafficStatus(msg, cls) {
  const el = document.getElementById('bf-traffic-status'); if (!el) return;
  el.textContent = msg; el.className = 'bf-traffic-status' + (cls ? ' ' + cls : '');
}
async function fireOneDecide() {
  const seg = RTB_DEMO_SEGMENTS[rtbTrafficIdx % RTB_DEMO_SEGMENTS.length];
  rtbTrafficIdx++;
  const screen = RTB_DEMO_CIRCUIT + '-kiosko';
  try {
    const r = await fetch(RTB_BASE + '/rtb/decide', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ screen, circuit: RTB_DEMO_CIRCUIT, segment: seg }),
    });
    const d = await r.json();
    const segLbl = seg.audience + '/' + seg.age + (seg.slot ? '/' + seg.slot : '');
    if (d && d.ok && d.decision) {
      setTrafficStatus('🔨 ' + d.decision.advertiser + ' gana ' + segLbl + ' · 2º precio €' + (Number(d.decision.price)||0).toFixed(2) + ' (CPM €' + d.decision.cpm + ')', 'ok');
    } else {
      setTrafficStatus('· sin demanda para ' + segLbl + ' (presupuesto agotado)', 'muted');
    }
    // El decide ya quedó registrado en /rtb/feed → refresco inmediato del feed real.
    pollRtbFeed();
  } catch {
    setTrafficStatus('⚠️ error de red al subastar', 'muted');
  }
}
function toggleTraffic(btn) {
  if (rtbTrafficTimer) {
    clearInterval(rtbTrafficTimer); rtbTrafficTimer = null;
    btn.textContent = '▶ Simular tráfico'; btn.classList.remove('on');
    setTrafficStatus('', '');
    return;
  }
  btn.textContent = '⏸ Parar tráfico'; btn.classList.add('on');
  setTrafficStatus('subastando impresiones reales cada 15 s…', '');
  fireOneDecide();
  rtbTrafficTimer = setInterval(fireOneDecide, 15000);
}
function wireBidFeedControls() {
  const tg = document.getElementById('bf-traffic-toggle'); if (tg) tg.onclick = () => toggleTraffic(tg);
  const one = document.getElementById('bf-decide-one'); if (one) one.onclick = fireOneDecide;
}
if (document.readyState !== 'loading') wireBidFeedControls();
else document.addEventListener('DOMContentLoaded', wireBidFeedControls);

// ─── Cierre del loop RTB → Gemelo Digital ─────────────────────────
// Cuando una surface respaldada por una pantalla real del gemelo
// (campo pixerScreens) "gana" una subasta, empujamos el creativo
// ganador (un asset real del Stock de PixerIA) a /signage/push del
// worker. El reproductor del gemelo (game.html) lee /signage/feed?limit=1
// cada 5s y lo muestra en la pantalla física. Loop cerrado.
let stockCreativesCache = null;
async function fetchStockCreatives() {
  if (stockCreativesCache) return stockCreativesCache;
  try {
    const r = await fetch(PIXER + '/stock/list?limit=80', {cache:'no-store'});
    if (!r.ok) return [];
    const d = await r.json();
    const items = Array.isArray(d && d.items) ? d.items : [];
    // Solo creativos visuales para una pantalla
    const visual = items.filter(it => it && it.url && ['image','video','animation'].includes(it.type));
    if (visual.length) stockCreativesCache = visual;
    return visual;
  } catch { return []; }
}

function pushKindForStock(type) { return type === 'image' ? 'image' : 'video'; }

async function launchWinnerToTwin(surfIdx, btn) {
  const loc = activeLocation;
  if (!loc) return;
  const surf = loc.surfaces[surfIdx];
  if (!surf) return;
  const targetScreens = screensForSurface(loc, surf);   // fijas ∪ vivas del Xpacio
  if (!targetScreens.length) return;

  const reset = (cls, label, ms) => {
    btn.classList.remove('ok','err'); if (cls) btn.classList.add(cls);
    btn.textContent = label;
    if (ms) setTimeout(() => { btn.disabled = false; btn.classList.remove('ok','err'); btn.textContent = t('twin_launch'); }, ms);
  };

  btn.disabled = true;
  btn.textContent = '… subastando';
  const creatives = await fetchStockCreatives();
  if (!creatives.length) { reset('err', 'Sin creativos en Stock', 2600); return; }

  const cre = creatives[Math.floor(Math.random() * creatives.length)];
  const advertiser = ADVERTISERS[Math.floor(Math.random() * ADVERTISERS.length)];
  const cpm = parseFloat(String(surf.cpm).replace(/[^\d.]/g,'')) || 1;
  const price = Math.max(0.0008, cpm * (0.6 + Math.random() * 0.45) / 1000).toFixed(4);
  const title = `🔨 ${advertiser} · €${price} · ${surf.name}`;

  try {
    // Targeting por pantalla: un push por cada screenId real de la surface, con
    // `target` → el creativo ganador cae SOLO en esas pantallas (el gemelo las
    // filtra vía /signage/feed?screen=), no en broadcast a todo el gemelo.
    const results = await Promise.all(targetScreens.map(screen =>
      fetch(PIXER + '/signage/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: pushKindForStock(cre.type), src: cre.url, mime: cre.mime || null, title, target: screen }),
      })
    ));
    const bad = results.find(r => !r.ok);
    if (bad) throw new Error('http ' + bad.status);
    const ts = new Date().toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    bidFeedItems.unshift({ advertiser, surface: surf.name, price, ts, real: true, win: true });
    if (bidFeedItems.length > 12) bidFeedItems.pop();
    renderBidFeed();
    reset('ok', '✓ En pantalla del gemelo', 3200);
  } catch (e) {
    reset('err', 'Error al empujar', 2600);
  }
}

// Delegación: clic en cualquier botón "lanzar ganador" del panel.
document.getElementById('surfaces').addEventListener('click', (e) => {
  const btn = e.target.closest('.twin-launch');
  if (!btn || btn.disabled) return;
  launchWinnerToTwin(parseInt(btn.dataset.surfIdx, 10), btn);
});

// Background ticker — sigue subiendo aunque no haya panel abierto
function backgroundTick() {
  // Ritmo agregado de toda la red (sumar live surfaces de TODAS las locs)
  const totalLive = LOCATIONS.reduce((a,l) => a + l.surfaces.filter(s=>s.status==='live').length, 0);
  // ~ 0.7 impresiones por surface live por segundo, con jitter
  const inc = Math.round(totalLive * (0.4 + Math.random()*0.7));
  globalImprCount += inc;
  document.getElementById('t-impr').textContent = globalImprCount.toLocaleString('es');
}
setInterval(backgroundTick, 1500);

// ─── Métricas reales del worker pixer-eleven ──────────────────────
async function loadRealMetrics() {
  updateBiddingLiveCounters();
  try {
    const f = await fetch(PIXER + '/signage/feed?limit=50', {cache:'no-cache'}).then(r => r.json());
    if (f && Array.isArray(f.items) && f.items.length) {
      // Bootstrap del contador con tamaño real del feed multiplicado por un factor de exposición
      globalImprCount = Math.max(globalImprCount, f.items.length * 23);
      document.getElementById('t-impr').textContent = globalImprCount.toLocaleString('es');
    }
  } catch {}
}
loadRealMetrics();
// Re-fetch cada 30s para mantener el ticker honesto
setInterval(loadRealMetrics, 30000);

// ─── RTB feed real: poll de pixer-eleven /signage/feed ────────────
// Cada display real (ack del screen) entra como puja LIVE en el panel
// si el screen está mapeado a una surface (campo pixerScreens).
let pixerSeenIds = new Set();
let pixerBootstrapped = false;

function findSurfaceByPixerScreen(screenId) {
  for (const loc of LOCATIONS) {
    for (const surf of loc.surfaces) {
      if (Array.isArray(surf.pixerScreens) && surf.pixerScreens.includes(screenId)) {
        return { loc, surf };
      }
    }
  }
  return null;
}

function spawnRealBid(loc, surf, item) {
  const cpm = parseFloat(String(surf.cpm).replace(/[^\d.]/g, '')) || 1;
  const winCents = Math.max(0.0008, (cpm * (0.6 + Math.random() * 0.45) / 1000));
  const advRaw = String(item.title || 'creativo').replace(/^Clear Channel\s*\/\/\s*/i, '').trim();
  const advertiser = advRaw.length > 28 ? advRaw.slice(0, 26) + '…' : (advRaw || 'creativo');
  const tsMs = Number(item.acked_at || item.ts) || Date.now();
  const ts = new Date(tsMs).toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  bidFeedItems.unshift({ advertiser, surface: surf.name, price: winCents.toFixed(4), ts, real: true });
  if (bidFeedItems.length > 12) bidFeedItems.pop();
  renderBidFeed();
}

function handlePixerItem(item) {
  if (!item || !item.id || !item.screen) return;
  const match = findSurfaceByPixerScreen(item.screen);
  if (!match) return;
  if (activeLocation && activeLocation.id === match.loc.id) {
    spawnRealBid(match.loc, match.surf, item);
  }
  // Cualquier item real cuenta para el ticker global, haya panel abierto o no.
  globalImprCount++;
  document.getElementById('t-impr').textContent = globalImprCount.toLocaleString('es');
}

async function pollPixerFeed() {
  try {
    const r = await fetch(PIXER + '/signage/feed?limit=20', {cache:'no-store'});
    if (!r.ok) return;
    const d = await r.json();
    const items = Array.isArray(d && d.items) ? d.items : [];
    if (!pixerBootstrapped) {
      // Primera carga: marcamos histórico como "ya visto" para no volcar
      // 20 pujas viejas de golpe al abrir Xtanco.
      items.forEach(it => it && it.id && pixerSeenIds.add(it.id));
      pixerBootstrapped = true;
      return;
    }
    // /signage/feed devuelve los items más recientes primero. Procesamos
    // en orden cronológico (más antiguo primero) para que la fila más reciente
    // quede arriba.
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (!item || !item.id || pixerSeenIds.has(item.id)) continue;
      pixerSeenIds.add(item.id);
      handlePixerItem(item);
    }
    // Trim del Set si crece demasiado.
    if (pixerSeenIds.size > 500) {
      const arr = Array.from(pixerSeenIds);
      pixerSeenIds = new Set(arr.slice(-300));
    }
  } catch { /* worker dormido — el simulador sigue dando vida al feed */ }
}
pollPixerFeed();
setInterval(pollPixerFeed, 5000);

// ─── Destinations: prepare, approach, render, then open the panel ──
function locationCamera(loc, bearing = -20) {
  return {center:loc.coords, zoom:16.8, pitch:currentView === '3d' ? 45 : 0, bearing};
}

function updateMapTourStop() {
  const button = document.getElementById('map-tour-stop');
  if (button) { button.hidden = !tourRun && !circuitDemo.running; button.textContent = t('tour_stop'); }
}

function stopMapNavigation() {
  tourStop(document.getElementById('p-tour'));
  stopCircuitDemo(false);
  tourCamera.cancel();
  document.getElementById('status')?.classList.remove('show');
}

async function flyToLocation(loc, {automatic = false, bearing = -20} = {}) {
  if (!automatic) stopMapNavigation();
  panel.classList.remove('open');
  splash.classList.add('hidden');
  rotating = false;
  if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
  const ac = document.getElementById('addr-card'); if (ac) ac.hidden = true;
  pushRecent(loc.id);
  const result = await tourCamera.navigate(locationCamera(loc, bearing), phase => {
    const key = phase === 'preparing' ? 'map_preparing' : phase === 'loading' ? 'map_loading' : 'status_landing';
    setStatus(t(key) + loc.name, true);
  });
  if (result === 'cancelled') return false;
  if (result !== 'ready') { setStatus(t('map_incomplete')); return false; }
  renderPanel(loc);
  panel.classList.add('open');
  setStatus(loc.name);
  return true;
}

// ─── Network tour: advance only after a loaded destination + dwell ──
let tourTimer = null, tourIdx = 0, tourRun = null;
function tourItems() {
  try { const v = mapVisibleLocations(); return Array.isArray(v) ? v.filter(l => Array.isArray(l.coords) && l.coords.length >= 2 && l.coords.every(Number.isFinite)) : []; }
  catch (_) { return []; }
}
function tourStop(btn) {
  const wasRunning = !!tourRun;
  tourRun = null;
  if (tourTimer) { clearTimeout(tourTimer); tourTimer = null; }
  if (wasRunning) { tourCamera.cancel(); document.getElementById('status')?.classList.remove('show'); }
  if (btn) { btn.textContent = t('tour_start'); btn.classList.remove('on'); btn.setAttribute('data-i18n', 'tour_start'); }
  updateMapTourStop();
}
async function tourStep(btn) {
  const run = tourRun;
  if (!run) return;
  const items = tourItems();
  if (!items.length) { setStatus(t('demo_empty')); tourStop(btn); return; }
  const index = tourIdx % items.length;
  const loc = items[index];
  const arrived = await flyToLocation(loc, {automatic:true});
  if (tourRun !== run) return;
  if (!arrived) { tourStop(btn); setStatus(t('map_incomplete')); return; }
  setStatus('✈ ' + (index + 1) + '/' + items.length + ' · ' + loc.name);
  tourIdx++;
  tourCamera.prepare(locationCamera(items[tourIdx % items.length]));
  tourTimer = setTimeout(() => tourStep(btn), TOUR_DWELL_MS);
}
function tourToggle(btn) {
  if (tourRun) { tourStop(btn); return; }
  stopMapNavigation();
  const items = tourItems();
  if (!items.length) { setStatus(t('demo_empty')); return; }
  btn.textContent = t('tour_stop'); btn.classList.add('on'); btn.setAttribute('data-i18n', 'tour_stop');
  tourIdx = 0;
  tourRun = {};
  updateMapTourStop();
  tourStep(btn);
}
document.getElementById('map-tour-stop')?.addEventListener('click', stopMapNavigation);
// Manual map input cancels pending camera/panel callbacks and speculative loads.
['btn-zin', 'btn-zout', 'btn-compass', 'btn-loc', 'btn-iso', 'panel-close'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', stopMapNavigation, {capture:true});
});
document.getElementById('pegman')?.addEventListener('pointerdown', stopMapNavigation, {capture:true});
['pointerdown', 'wheel', 'keydown'].forEach(type => {
  map.getCanvas().addEventListener(type, stopMapNavigation, {passive:true});
});
function wireTour() {
  const b = document.getElementById('p-tour');
  if (b) b.onclick = (e) => { e.preventDefault(); tourToggle(b); };
  // Enlace directo para demo: ?circuit=<id>&tour=1 → selecciona circuito y arranca
  // el recorrido solo. Ej: /?circuit=caixabank&tour=1 (las 49 oficinas, una a una).
  try {
    const q = new URLSearchParams(location.search || '');
    const c = q.get('circuit');
    if (c) {
      const sel = document.getElementById('circuit-select');
      if (sel && [...sel.options].some(o => o.value === c)) {
        sel.value = c; sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    if (q.get('tour') === '1' && b) setTimeout(() => { if (!tourRun) tourToggle(b); }, 1200);
  } catch (_) {}
}
if (document.readyState !== 'loading') setTimeout(wireTour, 600);
else document.addEventListener('DOMContentLoaded', () => setTimeout(wireTour, 600));

// ─── Búsqueda ──────────────────────────────────────────────────────
async function geocodeNominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, {headers:{'Accept':'application/json'}});
  if (!r.ok) throw new Error('geocoder ' + r.status);
  const d = await r.json();
  if (!d.length) throw new Error('sin resultados');
  return {lon: parseFloat(d[0].lon), lat: parseFloat(d[0].lat), name: d[0].display_name};
}

// Recientes
function getRecent() {
  try { return JSON.parse(localStorage.getItem('omnip-recent') || '[]'); }
  catch { return []; }
}
function pushRecent(id) {
  const r = getRecent().filter(x => x !== id);
  r.unshift(id);
  try { localStorage.setItem('omnip-recent', JSON.stringify(r.slice(0,5))); } catch {}
}

// Geocoder multi-resultado para el autocompletado de direcciones.
async function geocodeSuggest(q, limit = 5) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=es&limit=${limit}&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, {headers:{'Accept':'application/json'}});
  if (!r.ok) return [];
  const d = await r.json();
  return Array.isArray(d) ? d : [];
}

// ─── Vuelo a una dirección geocodificada (sin panel; deja un pin) ──
let addrMarker = null;
function flyToAddress(lon, lat, label) {
  stopMapNavigation();
  splash.classList.add('hidden');
  if (label) setStatus(t('status_landing') + label.split(',').slice(0,2).join(','));
  if (addrMarker) addrMarker.remove();
  const el = document.createElement('div');
  el.className = 'addr-pin';
  el.title = label || '';
  addrMarker = new maplibregl.Marker({element: el}).setLngLat([lon, lat]).addTo(map);
  map.flyTo({center:[lon, lat], zoom:16.5, pitch: currentView==='3d'?55:0, duration:4500, essential:true});
  panel.classList.remove('open');
  stopBidFeed();
  activeLocation = null;
  showAddrCard(lon, lat, label);
}

// ─── Tarjeta de aterrizaje: inventario cercano + CTA de contacto ──
function haversineKm(a, b) { // a, b = [lon, lat]
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b[1]-a[1])*toR, dLon = (b[0]-a[0])*toR;
  const la1 = a[1]*toR, la2 = b[1]*toR;
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function fmtDist(km) { return km < 1 ? Math.round(km*1000) + ' m' : km.toFixed(km<10?1:0) + ' km'; }
function showAddrCard(lon, lat, label) {
  const card = document.getElementById('addr-card');
  document.getElementById('ac-name').textContent = (label || '—').split(',').slice(0,3).join(',').trim();
  const near = LOCATIONS
    .map(l => ({ l, d: haversineKm([lon, lat], l.coords) }))
    .sort((a, b) => a.d - b.d)
    .filter(n => n.d <= 50)   // inventario dentro de 50 km
    .slice(0, 3);
  const nearEl = document.getElementById('ac-near');
  if (near.length) {
    nearEl.innerHTML = '<div class="near-head">' + escHtml(t('nearest_inventory')) + '</div>' + near.map(n => {
      const live = n.l.surfaces.filter(s => s.status === 'live').length;
      return `<div class="near-item" data-id="${escHtml(n.l.id)}">
        <span class="ni-name">${escHtml(n.l.name)}${live ? `<b>● ${live} ${escHtml(t('live_tag'))}</b>` : ''}</span>
        <span class="ni-dist">${fmtDist(n.d)} →</span>
      </div>`;
    }).join('');
  } else {
    nearEl.innerHTML = '<div class="near-empty">' + escHtml(t('no_inventory')) + '</div>';
  }
  card.hidden = false;
}
document.getElementById('ac-close').addEventListener('click', () => {
  document.getElementById('addr-card').hidden = true;
  if (addrMarker) { addrMarker.remove(); addrMarker = null; }
});
document.getElementById('ac-near').addEventListener('click', e => {
  const item = e.target.closest('.near-item');
  if (!item) return;
  const loc = LOCATIONS.find(l => l.id === item.dataset.id);
  if (loc) flyToLocation(loc);
});

// Sugerencias dropdown — tiendas (Xpacios) + direcciones (Nominatim)
function findMatches(q) {
  const norm = q.toLowerCase().trim();
  if (!norm) return [];
  return LOCATIONS.filter(l =>
    l.name.toLowerCase().includes(norm) ||
    l.addr.toLowerCase().includes(norm) ||
    l.kind.toLowerCase().includes(norm) ||
    l.id.toLowerCase().includes(norm)
  );
}
function storeItemsHTML(list) {
  return list.map(l => {
    const live = l.surfaces.filter(s=>s.status==='live').length;
    return `<div class="item" data-id="${escHtml(l.id)}">
      <div class="kind">${escHtml(l.kind)}</div>
      <div class="name">${escHtml(l.name)}${live?` <span class="badge-live">● ${live} LIVE</span>`:''}</div>
      <div class="addr">${escHtml(l.addr)}</div>
    </div>`;
  }).join('');
}
let suggIdx = -1;
let geoTimer = null, geoSeq = 0;
// addresses: null = cargando, [] = sin resultados, [...] = resultados
function buildSuggest(q, addresses) {
  const norm = q.trim();
  const matches = findMatches(norm);
  let html = '';
  if (!norm) {
    const recents = getRecent().map(id => LOCATIONS.find(l => l.id === id)).filter(Boolean);
    if (recents.length) html += '<div class="group">' + escHtml(t('recent')) + '</div>' + storeItemsHTML(recents);
  } else {
    if (matches.length) html += `<div class="group">${matches.length} ${escHtml(matches.length > 1 ? t('stores_bidding_n') : t('stores_bidding_1'))}</div>` + storeItemsHTML(matches);
    if (norm.length >= 3) {
      html += '<div class="group">' + escHtml(t('addresses')) + '</div>';
      if (addresses === null) html += '<div class="addr-loading">' + escHtml(t('searching_addr')) + '</div>';
      else if (addresses.length) html += addresses.map(a => {
        const dn = a.display_name || '';
        return `<div class="item addr-item" data-lon="${a.lon}" data-lat="${a.lat}" data-label="${escHtml(dn)}">
          <div class="kind">📍 ${escHtml(a.type || a.addresstype || 'lugar')}</div>
          <div class="name">${escHtml(dn.split(',')[0])}</div>
          <div class="addr">${escHtml(dn.split(',').slice(1,4).join(',').trim())}</div>
        </div>`;
      }).join('');
      else html += '<div class="addr-loading">' + escHtml(t('no_addr')) + '</div>';
    }
  }
  suggIdx = -1;
  if (!html) { suggest.hidden = true; suggest.innerHTML = ''; return; }
  suggest.innerHTML = html;
  suggest.hidden = false;
}
function scheduleGeocode(q) {
  clearTimeout(geoTimer);
  const seq = ++geoSeq;
  geoTimer = setTimeout(async () => {
    const results = await geocodeSuggest(q, 5).catch(() => []);
    if (seq !== geoSeq || searchInput.value.trim() !== q) return; // query cambió
    buildSuggest(q, results);
  }, 350);
}
function renderSuggest(q) {
  buildSuggest(q, null);
  const norm = (q || '').trim();
  if (norm.length >= 3) scheduleGeocode(norm);
  else clearTimeout(geoTimer);
}
// Activa un item del desplegable: tienda (data-id) o dirección (data-lat/lon).
function activateItem(item) {
  if (!item) return;
  suggest.hidden = true;
  if (item.dataset.id) {
    const loc = LOCATIONS.find(l => l.id === item.dataset.id);
    if (loc) { searchInput.value = loc.name; flyToLocation(loc); }
  } else if (item.dataset.lat) {
    searchInput.value = (item.dataset.label || '').split(',').slice(0,2).join(',');
    flyToAddress(parseFloat(item.dataset.lon), parseFloat(item.dataset.lat), item.dataset.label);
  }
}
searchInput.addEventListener('input', e => renderSuggest(e.target.value));
searchInput.addEventListener('focus', e => renderSuggest(e.target.value));
searchInput.addEventListener('blur', () => setTimeout(() => { suggest.hidden = true; }, 200));
suggest.addEventListener('mousedown', e => {
  // mousedown antes que el blur para no perder el item
  const item = e.target.closest('.item');
  if (!item) return;
  e.preventDefault();
  activateItem(item);
});
searchInput.addEventListener('keydown', async (e) => {
  const items = suggest.querySelectorAll('.item');
  if (e.key === 'ArrowDown' && items.length) {
    e.preventDefault();
    suggIdx = Math.min(items.length - 1, suggIdx + 1);
    items.forEach((it, i) => it.classList.toggle('active', i === suggIdx));
    items[suggIdx].scrollIntoView({block:'nearest'});
    return;
  }
  if (e.key === 'ArrowUp' && items.length) {
    e.preventDefault();
    suggIdx = Math.max(-1, suggIdx - 1);
    items.forEach((it, i) => it.classList.toggle('active', i === suggIdx));
    return;
  }
  if (e.key === 'Escape') { suggest.hidden = true; return; }
  if (e.key !== 'Enter') return;
  // Enter: item activo → directo; si no, primera tienda; si no, mejor dirección
  if (suggIdx >= 0 && items[suggIdx]) { activateItem(items[suggIdx]); return; }
  const q = searchInput.value.trim();
  if (!q) return;
  const matches = findMatches(q);
  if (matches.length) { suggest.hidden = true; searchInput.value = matches[0].name; flyToLocation(matches[0]); return; }
  suggest.hidden = true;
  setStatus(t('status_searching') + ' "' + q.slice(0,40) + '"…');
  try {
    const res = await geocodeNominatim(q);
    flyToAddress(res.lon, res.lat, res.name);
  } catch {
    setStatus(t('status_no_results'));
  }
});

// ─── Counters iniciales ───────────────────────────────────────────
updateBiddingLiveCounters(LOCATIONS);
bindCircuitSelector();
bindBuyCheckout();
consumePixeriaDraftFromUrl();

// Return from the campaign preview to the exact catalogue place, in either language.
let walkReturnRestored = false;
function restoreWalkReturn() {
  if (walkReturnRestored || new URLSearchParams(location.search).get('draft')) return;
  const id = new URLSearchParams(location.search).get('locationId');
  const loc = id && LOCATIONS.find(item => String(item.id) === id);
  if (!loc) return;
  walkReturnRestored = true;
  if (map.loaded()) flyToLocation(loc);
  else map.once('load', () => flyToLocation(loc));
}
restoreWalkReturn();

// ─── Refresh asincrónico desde el worker (KV) ─────────────────────
// El sync arrancó con localStorage/default. Si la KV trae algo nuevo,
// reescribimos LOCATIONS, refrescamos el source del mapa y los counters.
(async () => {
  try {
    const res = await window.loadOmnipLocationsAsync(4500);
    if (!res || !Array.isArray(res.locations) || !res.locations.length) return;
    if (locationsSignature(res.locations, res.updatedAt) === locationsSignature(LOCATIONS, res.updatedAt)) return;
    setLocations(res.locations);
    restoreWalkReturn();
    updateBiddingLiveCounters();
    const cpms = LOCATIONS.flatMap(l => (Array.isArray(l.surfaces) ? l.surfaces : []).map(s => parseFloat(String(s.cpm).replace(/[^\d.]/g,'')))).filter(Boolean);
    if (cpms.length) {
      const lo = Math.min(...cpms), hi = Math.max(...cpms);
      const el = document.getElementById('p-cpm'); if (el) el.textContent = lo === hi ? `€${lo}` : `€${lo}-€${hi}`;
    }
    renderCircuitSelector();
    if (typeof renderPlanner === 'function' && !document.getElementById('planner-modal').hidden) renderPlanner();
    updateLocationsSource();
  } catch {}
  finally {
    plannerCatalogReady = true;
    if (typeof renderPlanner === 'function' && !document.getElementById('planner-modal').hidden) renderPlanner();
    if (!document.getElementById('buy-modal').hidden) updateBuyQuote();
  }
})();

// ─── Equipos auto-registrados (admira.tv/alta) → merge ligero ──────
// El catálogo completo pesa varios MB y su carga async puede caducar (timeout),
// dejando fuera los equipos dados de alta solos. Se traen aparte con ?selfreg=1
// (payload mínimo) y se fusionan SOBRE lo ya cargado (aditivo, sin reemplazar),
// así aparecen siempre y rápido. Refresca cada 60s para captar nuevas altas.
// Dominio propio: LaLiga bloquea workers.dev/r2.dev en horas de fútbol (FLT-1633).
const SELFREG_URL = 'https://brain.digitalavatar.ai/locations?selfreg=1';
async function mergeSelfRegDevices(){
  try{
    const ctrl = new AbortController(); const to = setTimeout(()=>ctrl.abort(), 6000);
    const r = await fetch(SELFREG_URL, { cache:'no-store', signal:ctrl.signal });
    clearTimeout(to);
    const j = await r.json();
    const devs = (j && Array.isArray(j.locations)) ? j.locations : [];
    if(!devs.length) return;
    const byId = new Map((Array.isArray(LOCATIONS)?LOCATIONS:[]).map(l=>[l.id, l]));
    let changed = false;
    for(const d of devs){
      if(!d || !d.id) continue;
      const norm = window.normalizeOmnipLocations ? window.normalizeOmnipLocations([d])[0] : d;
      if(norm){ byId.set(d.id, norm); changed = true; }
    }
    if(changed){
      setLocations([...byId.values()]);
      updateLocationsSource();
      try{ updateBiddingLiveCounters(); }catch(_){}
    }
  }catch(_){}
}
mergeSelfRegDevices();
setInterval(mergeSelfRegDevices, 60000);

// Descubrir gemelos ONLINE (pantallas vivas) y refrescar cada 60s → el inventario
// vendible se mantiene al día sin hardcodear screenIds. Cierra el loop hacia "vender".
(async () => {
  await loadLiveScreens();
  try { if (typeof activeLocation !== 'undefined' && activeLocation) renderPanel(activeLocation); } catch {}
  setInterval(async () => {
    const before = JSON.stringify(window.LIVE_SCREENS.byLoc);
    await loadLiveScreens();
    if (JSON.stringify(window.LIVE_SCREENS.byLoc) !== before) {
      try { if (typeof activeLocation !== 'undefined' && activeLocation) renderPanel(activeLocation); } catch {}
    }
  }, 60000);
})();

// ─── Auto-rotación lenta del globo ────────────────────────────────
// El globo SIEMPRE arranca girando al abrir (cualquier navegador). Al interactuar
// se pausa y se reanuda sola tras unos segundos de inactividad, en vez de matarse.
let rotating = true;
let lastTs = 0;
let resumeTimer = null;
const ROTATE_RESUME_MS = 5000;
function tickRotate(ts) {
  if (rotating && lastTs && map && map.getZoom() < 6) {
    const dt = Math.min(ts - lastTs, 64); // clamp: evita tirones al volver de una pestaña en 2º plano
    const c = map.getCenter();
    map.easeTo({center:[c.lng + (dt * 0.005), c.lat], duration:0, essential: true});
  }
  lastTs = ts; // se actualiza siempre para no acumular dt mientras está pausado
  requestAnimationFrame(tickRotate);
}
requestAnimationFrame(tickRotate);
// Garantiza el arranque girando en cuanto el estilo del mapa esté listo
map.on('load', () => { if (!tourRun && !circuitDemo.running && !tourCamera.isNavigating()) rotating = true; lastTs = 0; });
// Arranque limpio: el contador "Bidding Live" se oculta hasta el primer gesto del usuario
const bootTicker = document.getElementById('ticker');
if (bootTicker) bootTicker.style.display = 'none';
let tickerRevealed = false;
function revealTicker() {
  if (tickerRevealed) return;
  tickerRevealed = true;
  if (bootTicker) bootTicker.style.display = '';
}
// Pausa al interactuar y programa la reanudación tras inactividad
function pauseAndScheduleResume() {
  revealTicker();
  rotating = false;
  if (resumeTimer) clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => { if (map.getZoom() < 6 && !tourRun && !circuitDemo.running && !tourCamera.isNavigating()) rotating = true; }, ROTATE_RESUME_MS);
}
['mousedown','wheel','touchstart','keydown'].forEach(ev => {
  document.addEventListener(ev, pauseAndScheduleResume, {passive:true});
});
// Al empezar a girar la bola del mundo, retiramos el hero para dejar la
// exploración limpia (estilo Google Earth) y paramos la autorrotación.
map.on('dragstart', () => { rotating = false; splash.classList.add('hidden'); });
map.on('zoomstart', () => { rotating = false; });

// ─── Beacon pulsante de las tiendas live ──────────────────────────
// Anillo que se expande y desvanece en bucle (1.6s) sobre cada tienda con
// surfaces en vivo. Todas pulsan en sincronía; el efecto "faro" del retail.
let pulseT0 = 0;
function animatePulse(ts) {
  requestAnimationFrame(animatePulse);
  if (!pulseT0) pulseT0 = ts;
  try {
    if (!map.isStyleLoaded() || !map.getLayer('unclustered-pulse')) return;
    const t = ((ts - pulseT0) % 1600) / 1600;       // 0 → 1
    map.setPaintProperty('unclustered-pulse', 'circle-radius', 11 + t * 24);
    map.setPaintProperty('unclustered-pulse', 'circle-stroke-opacity', 0.6 * (1 - t));
  } catch (e) {}
}
requestAnimationFrame(animatePulse);

// ─── Logo Clear Channel → volver al inicio ("posición 0") ─────────
function resetToHome() {
  stopMapNavigation();
  // Cierra todo lo abierto
  panel.classList.remove('open');
  stopBidFeed();
  activeLocation = null;
  const ac = document.getElementById('addr-card'); if (ac) ac.hidden = true;
  const sv = document.getElementById('streetview'); if (sv) sv.hidden = true;
  document.body.classList.remove('admira-contact-open');
  if (addrMarker) { addrMarker.remove(); addrMarker = null; }
  // Limpia la búsqueda
  searchInput.value = '';
  suggest.hidden = true; suggest.innerHTML = '';
  // Vuelve a la capa Tierra y a la vista 3D/globo
  if (currentLayer !== 'tierra') setLayer('tierra');
  if (currentView !== '3d') setView('3d');
  // Reaparece el hero y vuela a la posición inicial
  splash.classList.remove('hidden');
  rotating = false; // no rotar durante el vuelo de vuelta
  map.flyTo({...HOME_VIEW, duration: 2200, essential: true});
  map.once('moveend', () => {
    if (!tourRun && !circuitDemo.running && !tourCamera.isNavigating() && map.getZoom() < 6) rotating = true;
  }); // Resume only if a new destination has not superseded the home flight.
}
// ─── Vida en el cielo: estrellas que titilan + fugaces ocasionales ─
(function starfieldLife(){
  const space = document.getElementById('space');
  if (!space) return;

  // Estrellas titilantes esparcidas por el cielo (algunas cian/ámbar).
  const layer = document.createElement('div');
  layer.className = 'twinkle-layer';
  let html = '';
  for (let i = 0; i < 16; i++) {
    const x = (Math.random()*100).toFixed(1);
    const y = (Math.random()*100).toFixed(1);
    const size = (1.1 + Math.random()*1.7).toFixed(1);
    const dur = (2.4 + Math.random()*3.4).toFixed(1);
    const delay = (Math.random()*4).toFixed(1);
    const tone = Math.random();
    const color = tone < 0.16 ? 'rgba(120,243,255,.9)' : (tone < 0.28 ? 'rgba(255,216,102,.85)' : '#fff');
    html += `<span class="twinkle" style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;background:${color};--dur:${dur}s;--delay:${delay}s"></span>`;
  }
  layer.innerHTML = html;
  space.appendChild(layer);

  // Estrella fugaz: nace en la franja superior y cruza en diagonal.
  const skyFx = document.getElementById('sky-fx');

  // Mini-juego: antes de dispararse, el lucero parpadea 4 veces. Si lo pulsas
  // a tiempo, pides un deseo; si no, sale como estrella fugaz.
  function spawnShootingStar(){
    if (!skyFx) return;
    const W = window.innerWidth, H = window.innerHeight;
    const startX = Math.random() * W * 0.7;
    const startY = Math.random() * H * 0.45;
    const len = W * 0.35 + 220;
    const angle = 22 + Math.random()*22;        // hacia abajo-derecha

    // Fase 1: lucero parpadeante y clicable (capa por encima del mapa).
    const seed = document.createElement('button');
    seed.className = 'wish-seed';
    seed.type = 'button';
    seed.setAttribute('aria-label', t('make_wish'));
    seed.style.left = startX + 'px';
    seed.style.top = startY + 'px';
    skyFx.appendChild(seed);
    const blinkMs = 440 * 4;
    let claimed = false;
    const blink = seed.animate(
      [ {opacity:0, transform:'scale(.4)'}, {opacity:1, transform:'scale(1.2)'}, {opacity:0, transform:'scale(.4)'} ],
      { duration: 440, iterations: 4, easing: 'ease-in-out' }
    );
    // El lanzamiento lo gobierna un temporizador (robusto frente a pausas de la
    // animación), no el onfinish. Si lo pulsas a tiempo, se cancela.
    const launchTimer = setTimeout(() => {
      if (claimed) return;
      seed.remove();
      launchStreak(startX, startY, len, angle);
    }, blinkMs);
    seed.addEventListener('click', (e) => {
      e.stopPropagation();
      if (claimed) return;
      claimed = true;
      clearTimeout(launchTimer);
      try { blink.cancel(); } catch(_) {}
      seed.remove();
      openWish();
    });
  }

  // Fase 2: la estrella fugaz cruza el cielo (por detrás del globo).
  function launchStreak(startX, startY, len, angle){
    const star = document.createElement('div');
    star.className = 'shooting-star';
    star.style.left = startX + 'px';
    star.style.top = startY + 'px';
    space.appendChild(star);
    const dur = 850 + Math.random()*550;
    const anim = star.animate([
      { transform: `rotate(${angle}deg) translateX(0)`, opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { opacity: 1, offset: 0.82 },
      { transform: `rotate(${angle}deg) translateX(${len}px)`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.4,0,.7,1)' });
    anim.onfinish = () => star.remove();
    setTimeout(() => star.remove(), dur + 600); // limpieza de seguridad
  }

  // Popup del deseo.
  const WISH_VIDEO = 'mvQTfq1qD2w'; // YouTube Short del deseo
  const wishModal = document.getElementById('wish-modal');
  const wishCard  = document.getElementById('wish-card');
  const wishIntro = document.getElementById('wish-intro');
  const wishVideo = document.getElementById('wish-video');
  const wishOk    = document.getElementById('wish-ok');
  const wishClose = document.getElementById('wish-close');

  function resetWish(){
    if (wishVideo) { wishVideo.innerHTML = ''; wishVideo.hidden = true; }
    if (wishIntro) wishIntro.hidden = false;
    if (wishCard)  wishCard.classList.remove('with-video');
  }
  function openWish(){
    resetWish();
    if (wishModal) wishModal.hidden = false;
  }
  function closeWish(){
    if (wishModal) wishModal.hidden = true;
    resetWish(); // quita el iframe → para el vídeo
  }
  // Conceder el deseo: el popup pasa al tamaño del hero y reproduce el vídeo.
  function grantWish(){
    if (wishIntro) wishIntro.hidden = true;
    if (wishCard)  wishCard.classList.add('with-video');
    if (wishVideo) {
      wishVideo.innerHTML = `<iframe src="https://www.youtube.com/embed/${WISH_VIDEO}?autoplay=1&playsinline=1&rel=0" title="Tu deseo" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      wishVideo.hidden = false;
    }
  }
  if (wishOk)    wishOk.addEventListener('click', grantWish);
  if (wishClose) wishClose.addEventListener('click', closeWish);
  if (wishModal) wishModal.addEventListener('click', (e) => { if (e.target === wishModal) closeWish(); });

  function loop(){
    // La estrella fugaz (lucero parpadeante para pedir deseo) sólo aparece con el
    // globo entero a la vista; nunca sobre las ciudades al hacer zoom.
    setTimeout(() => { if (!document.hidden && map.getZoom() < 2.1) spawnShootingStar(); loop(); }, 5000 + Math.random()*11000); // cada 5–16 s
  }
  loop();
})();

// Cruz de cierre del hero. Cerrar la tarjeta NO debe parar el giro suave del
// globo: evitamos que el clic cuente como "interacción" (stopPropagation, para
// no disparar el listener que para la rotación) y reanudamos por si acaso.
const splashClose = document.getElementById('splash-close');
if (splashClose) {
  splashClose.addEventListener('mousedown', e => e.stopPropagation());
  splashClose.addEventListener('touchstart', e => e.stopPropagation(), {passive:true});
  splashClose.addEventListener('click', () => { splash.classList.add('hidden'); rotating = true; });
}

const logoHome = document.getElementById('logo-home');
if (logoHome) {
  logoHome.addEventListener('click', resetToHome);
  logoHome.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resetToHome(); }
  });
}

// ─── Selector de idioma EN/ES ─────────────────────────────────────
document.getElementById('lang-toggle')?.addEventListener('click', e => {
  setLang(e.currentTarget.dataset.langTarget || (LANG === 'en' ? 'es' : 'en'));
});
setLang(LANG); // aplica el idioma guardado (o ES por defecto) al cargar

// ── Selector de TARGET (criterios de contenido) — pastilla gemela del circuito ──
// 4 categorías: Temporales · Contextuales · Tipología · Data-Driven. Lo elegido
// se guarda en window.CONTENT_TARGET y segmenta la CREACIÓN DE CONTENIDOS.
(function(){
  const GROUPS = [
    { key:'temporales', label:'Temporales', items:[['manana','Mañana'],['tarde','Tarde'],['noche','Noche']], extras:true },
    { key:'contextuales', label:'Contextuales', items:[['exterior','Exterior'],['interior','Interior']] },
    { key:'tipologia', label:'Tipología', items:[['supermercados','Supermercados'],['estancos','Estancos'],['bancos','Bancos'],['gimnasios','Gimnasios'],['mupi','MUPI'],['correos','Correos'],['transporte','Transporte'],['retail','Retail'],['moda','Moda']] },
    { key:'datadriven', label:'Data-Driven', items:[['clima','Clima'],['trafico','Tráfico'],['moviles','Móviles'],['inventario','Inventario de tienda']] },
  ];
  const CT = window.CONTENT_TARGET = { temporales:[], hora:'', pases:'', contextuales:[], tipologia:[], datadriven:[] };
  try{ const s=JSON.parse(localStorage.getItem('omnip-content-target')||'null'); if(s) Object.assign(CT, s); }catch(_){}
  function persist(){ try{ localStorage.setItem('omnip-content-target', JSON.stringify(CT)); }catch(_){} }
  let panel;
  function buildBody(){
    return GROUPS.map(g=>{
      const pills = g.items.map(([v,l])=>`<button type="button" class="tg-pill" data-g="${g.key}" data-v="${v}">${l}</button>`).join('');
      const extras = g.extras ? `<div class="tg-extras"><label>Hora<input type="time" class="tg-hora" value="${CT.hora||''}"></label><label>Nº pases<input type="number" min="0" class="tg-pases" placeholder="0" value="${CT.pases||''}" style="width:58px"></label></div>` : '';
      return `<div class="tg-group"><div class="tg-glabel">${g.label}</div><div class="tg-pills">${pills}</div>${extras}</div>`;
    }).join('');
  }
  function syncPills(){ panel.querySelectorAll('.tg-pill').forEach(b=>{ b.classList.toggle('on', (CT[b.dataset.g]||[]).includes(b.dataset.v)); }); }
  function init(){
    if(panel) return;
    panel = document.createElement('section');
    panel.id='target-panel'; panel.className='circuit-panel collapsed'; panel.setAttribute('aria-label','Selector de target');
    panel.innerHTML = '<div class="circuit-head"><h3 data-i18n="target_panel_title">'+t('target_panel_title')+'</h3><button class="circuit-toggle" id="target-panel-toggle" type="button" title="Desplegar / replegar">+</button></div>'
      + '<div class="circuit-body" style="gap:12px">' + buildBody()
      + '<div style="font-size:10.5px;color:var(--mut);line-height:1.3" data-i18n="target_panel_hint">'+t('target_panel_hint')+'</div></div>';
    document.body.appendChild(panel);
    panel.hidden=true;   // arranca oculto: se abre desde la pastilla "Seleccionar target" del header
    panel.style.left='505px'; panel.style.top='8px'; panel.style.right='auto';   // arriba, pegado al de circuito
    try{ const p=JSON.parse(localStorage.getItem('omnip-target-panel-pos2')||'null'); if(p&&Number.isFinite(p.x)){ panel.style.left=p.x+'px'; panel.style.top=p.y+'px'; } }catch(_){}
    const head=panel.querySelector('.circuit-head');
    const x=document.createElement('button'); x.className='win-x'; x.type='button'; x.innerHTML='&times;'; x.title='Cerrar'; x.style.cssText='font-size:17px;margin-left:2px';
    x.addEventListener('click',e=>{ e.stopPropagation(); panel.hidden=true; document.getElementById('header-target-btn')?.classList.remove('active'); });
    head.appendChild(x);
    const tg=panel.querySelector('#target-panel-toggle');
    tg.addEventListener('click',()=>{ panel.classList.toggle('collapsed'); tg.textContent = panel.classList.contains('collapsed')?'+':'−'; });
    panel.addEventListener('click',e=>{ const b=e.target.closest('.tg-pill'); if(!b)return; const arr=CT[b.dataset.g]; const i=arr.indexOf(b.dataset.v); if(i>=0)arr.splice(i,1); else arr.push(b.dataset.v); syncPills(); persist(); });
    panel.querySelector('.tg-hora')?.addEventListener('change',e=>{ CT.hora=e.target.value; persist(); });
    panel.querySelector('.tg-pases')?.addEventListener('change',e=>{ CT.pases=e.target.value; persist(); });
    // arrastre por la cabecera (clic limpio = plegar)
    let drag=false,sx=0,sy=0,ox=0,oy=0,moved=false;
    head.addEventListener('pointerdown',e=>{ if(e.target.closest('button'))return; drag=true;moved=false;sx=e.clientX;sy=e.clientY; const r=panel.getBoundingClientRect(); panel.style.left=r.left+'px';panel.style.top=r.top+'px';panel.style.right='auto'; ox=e.clientX-r.left;oy=e.clientY-r.top; try{head.setPointerCapture(e.pointerId);}catch(_){} });
    head.addEventListener('pointermove',e=>{ if(!drag)return; if(Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)>4)moved=true; if(moved){ const nx=Math.max(0,Math.min(e.clientX-ox,innerWidth-panel.offsetWidth)),ny=Math.max(0,Math.min(e.clientY-oy,innerHeight-panel.offsetHeight)); panel.style.left=nx+'px';panel.style.top=ny+'px'; } });
    head.addEventListener('pointerup',e=>{ if(!drag)return; drag=false; try{head.releasePointerCapture(e.pointerId);}catch(_){} if(moved){ try{localStorage.setItem('omnip-target-panel-pos2',JSON.stringify({x:panel.offsetLeft,y:panel.offsetTop}));}catch(_){} } });
    syncPills();
    const hb=document.getElementById('header-target-btn');
    if(hb){ hb.addEventListener('click',()=>{ panel.hidden=!panel.hidden; if(!panel.hidden){ panel.classList.remove('collapsed'); tg.textContent='−'; } hb.classList.toggle('active',!panel.hidden); }); hb.classList.toggle('active',!panel.hidden); }
  }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
// ── Leyenda de circuitos (color → circuito) en el mapa ──────────────────
(function(){
  let el;
  function uniqueCircuits(){
    try{
      const locs = (typeof mapVisibleLocations==='function') ? mapVisibleLocations() : [];
      const seen = new Map();
      locs.forEach(l=>{ const base=circuitBaseName(circuitLabel(l)); if(base && !seen.has(base)) seen.set(base, circuitColorHex(base)); });
      return [...seen.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
    }catch(_){ return []; }
  }
  function render(){
    if(!el) return;
    const items = uniqueCircuits();
    if(!items.length){ el.style.display='none'; return; }
    el.style.display='';
    el.querySelector('.cl-body').innerHTML = items.map(([name,color])=>
      `<div class="cl-row"><span class="cl-dot" style="background:${color}"></span>${name}</div>`).join('');
  }
  function init(){
    return;   // Pastilla "Circuitos" eliminada (Carlos 2026-06-11): solo quedan los paneles Seleccionar Circuito/Target.
    if(el) return;
    el = document.createElement('div'); el.id='circuit-legend';
    el.innerHTML = '<div class="cl-head"><b>Circuitos</b><span class="cl-x" title="Cerrar">&times;</span></div><div class="cl-body"></div>';
    document.body.appendChild(el);
    el.classList.add('collapsed');   // replegada inicialmente
    try{ const p=JSON.parse(localStorage.getItem('omnip-legend-pos')||'null');
      if(p&&Number.isFinite(p.left)&&Number.isFinite(p.top)){ el.style.left=p.left+'px'; el.style.top=p.top+'px'; el.style.right='auto'; } }catch(_){}
    const head=el.querySelector('.cl-head');
    head.style.cursor='move'; head.style.touchAction='none'; head.style.userSelect='none';
    el.querySelector('.cl-x').addEventListener('click', e=>{ e.stopPropagation(); el.style.display='none'; });
    // arrastrar por la cabecera; clic limpio (sin mover) = desplegar/replegar
    let drag=false, sx=0, sy=0, ox=0, oy=0, moved=false;
    head.addEventListener('pointerdown', e=>{ if(e.target.classList.contains('cl-x'))return; drag=true; moved=false; sx=e.clientX; sy=e.clientY;
      const r=el.getBoundingClientRect(); el.style.left=r.left+'px'; el.style.top=r.top+'px'; el.style.right='auto'; ox=e.clientX-r.left; oy=e.clientY-r.top; try{head.setPointerCapture(e.pointerId);}catch(_){} });
    head.addEventListener('pointermove', e=>{ if(!drag)return; if(Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)>4) moved=true;
      if(moved){ const nx=Math.max(0,Math.min(e.clientX-ox,innerWidth-el.offsetWidth)), ny=Math.max(0,Math.min(e.clientY-oy,innerHeight-el.offsetHeight)); el.style.left=nx+'px'; el.style.top=ny+'px'; } });
    head.addEventListener('pointerup', e=>{ if(!drag)return; drag=false; try{head.releasePointerCapture(e.pointerId);}catch(_){}
      if(moved){ try{localStorage.setItem('omnip-legend-pos',JSON.stringify({left:el.offsetLeft,top:el.offsetTop}));}catch(_){} } else { el.classList.toggle('collapsed'); } });
    render();
  }
  function whenMapReady(){
    if(typeof map==='undefined' || !map){ setTimeout(whenMapReady, 400); return; }
    init();
    map.on('moveend', render);
    map.on('sourcedata', e=>{ if(e.sourceId==='locs') render(); });
  }
  if(document.readyState!=='loading') whenMapReady(); else document.addEventListener('DOMContentLoaded', whenMapReady);
})();
// ── Ventanas flotantes: cerrar + plegar + arrastrar (Carlos 2026-06-11) ──
(function(){
  function makeDraggable(el, handle, key){
    if(!el || !handle) return;
    handle.classList.add('win-drag');
    try{ const p=JSON.parse(localStorage.getItem(key)||'null');
      if(p&&Number.isFinite(p.left)&&Number.isFinite(p.top)){
        el.style.left=Math.max(0,Math.min(p.left,innerWidth-60))+'px';
        el.style.top=Math.max(0,Math.min(p.top,innerHeight-40))+'px';
        el.style.right='auto'; el.style.bottom='auto';
      } }catch(_){}
    let drag=false,ox=0,oy=0;
    handle.addEventListener('pointerdown',e=>{
      if(e.target.closest('button, select, input, a')) return;   // no arrastrar al pulsar controles
      drag=true; const r=el.getBoundingClientRect();
      el.style.left=r.left+'px'; el.style.top=r.top+'px'; el.style.right='auto'; el.style.bottom='auto';
      ox=e.clientX-r.left; oy=e.clientY-r.top;
      try{ handle.setPointerCapture(e.pointerId); }catch(_){}
    });
    handle.addEventListener('pointermove',e=>{
      if(!drag) return;
      const nx=Math.max(0,Math.min(e.clientX-ox,innerWidth-el.offsetWidth));
      const ny=Math.max(0,Math.min(e.clientY-oy,innerHeight-el.offsetHeight));
      el.style.left=nx+'px'; el.style.top=ny+'px';
    });
    const end=e=>{ if(!drag)return; drag=false; try{handle.releasePointerCapture(e.pointerId);}catch(_){}
      try{ localStorage.setItem(key, JSON.stringify({left:el.offsetLeft, top:el.offsetTop})); }catch(_){} };
    handle.addEventListener('pointerup',end); handle.addEventListener('pointercancel',end);
  }
  function makeCollapsibleSection(header, body, key){
    if(!header || !body) return;
    header.classList.add('sec-toggle'); header.setAttribute('role','button'); header.setAttribute('tabindex','0');
    let collapsed=false; try{ collapsed = localStorage.getItem(key)==='1'; }catch(_){}
    const apply=()=>{ body.style.display=collapsed?'none':''; header.classList.toggle('sec-collapsed',collapsed); };
    apply();
    header.addEventListener('click',()=>{ collapsed=!collapsed; apply(); try{localStorage.setItem(key,collapsed?'1':'0');}catch(_){} });
  }
  function addCloseBtn(host, target){
    if(!host || host.querySelector('.win-x')) return;
    const b=document.createElement('button'); b.className='win-x'; b.type='button'; b.innerHTML='&times;'; b.title='Cerrar';
    b.addEventListener('click',ev=>{ ev.stopPropagation(); (target||host).style.display='none'; (target||host).hidden=true; });
    host.appendChild(b);
  }
  function init(){
    // 1) Circuit panel: el arrastre y el plegado ya los gestiona su sistema nativo
    //    (bindCircuitPanelDrag / circuit-toggle). Solo añadimos un × que lo OCULTA
    //    de forma nativa (hidden), reabrible con el botón "Seleccionar circuito".
    const cp=document.getElementById('circuit-panel');
    if(cp){ const head=cp.querySelector('.circuit-head');
      if(head && !head.querySelector('.win-x')){
        const b=document.createElement('button'); b.className='win-x'; b.type='button'; b.innerHTML='&times;'; b.title='Cerrar';
        b.style.cssText='font-size:17px;margin-left:2px';
        b.addEventListener('click', e=>{ e.stopPropagation(); cp.hidden=true; const hb=document.getElementById('header-circuit-btn'); if(hb) hb.classList.remove('active'); });
        head.appendChild(b);
      }
    }
    // 2) Ticker BIDDING LIVE: arrastrable + plegable + cerrar
    const tk=document.getElementById('ticker');
    if(tk){ const head=tk.querySelector('.lt-head');
      makeDraggable(tk, head, 'omnip-pos-ticker');
      if(head && !head.querySelector('.lt-collapse')){
        const c=document.createElement('button'); c.className='lt-collapse'; c.type='button'; c.title='Plegar'; c.innerHTML='−';
        c.addEventListener('click',ev=>{ ev.stopPropagation(); const col=tk.classList.toggle('win-collapsed'); c.innerHTML=col?'+':'−'; });
        head.appendChild(c);
      }
      addCloseBtn(head, tk);
    }
    // 3) Panel de detalle: secciones plegables (Surfaces disponibles + Pujas en vivo) + arrastrable (ya tiene cerrar)
    const pn=document.getElementById('panel');
    if(pn){
      makeDraggable(pn, pn.querySelector('.ph'), 'omnip-pos-panel');
      const h3s=pn.querySelectorAll('.body > h3');
      const surfH=[...h3s].find(h=>h.getAttribute('data-i18n')==='surfaces_available');
      makeCollapsibleSection(surfH, document.getElementById('surfaces'), 'omnip-sec-surfaces');
      makeCollapsibleSection(pn.querySelector('.bf-head'), document.getElementById('bidfeed'), 'omnip-sec-bidfeed');
    }
  }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();

// ── PUBLI EXTERIOR EN VIVO DEL GEMELO ───────────────────────────────────────
// Lee del KV (pixer-eleven /day/range) los impactos REALES de publi exterior por
// segmento que reporta el gemelo al cerrar/registrar el día, y los muestra con su
// CPM (RTB). Misma tabla CPM que el gemelo (la pauta vive en clearchannel.tv).
(function(){
  // Dominio propio: LaLiga bloquea workers.dev/r2.dev en horas de fútbol (FLT-1633).
  const PIXER='https://api.admira.store';
  const SEG_CPM={ joven_m:9, joven_f:9, adulto_m:8, adulto_f:8.5, senior_m:5, senior_f:5, nino_m:3.5, nino_f:3.5 };
  const AGEL={nino:'Niño',joven:'Joven',adulto:'Adulto',senior:'Senior'};
  function todayStr(){ const d=new Date(); return ''+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0'); }
  function pickLoc(){ try{ if(typeof selectedLocationIds!=='undefined' && selectedLocationIds.size) return [...selectedLocationIds][0]; }catch(e){} try{ if(typeof LOCATIONS!=='undefined' && LOCATIONS[0]) return LOCATIONS[0].id; }catch(e){} return 'xtanco-generic'; }
  // INFORME POR CIRCUITO: agrega el consumo de HOY de todos los Xpacios, agrupado por
  // circuito (marca / tipo). Lee /day/range hoy por loc (paralelo, cap 30).
  async function circuitReport(){
    const all=(typeof window.loadOmnipLocations==='function')?window.loadOmnipLocations():[];
    const locs=all.slice(0,60), t=todayStr();
    const ck=l=>{ try{ return (l.external&&l.external.brand)||((l.kind||'').split(/[·|]/)[0].trim())||'Otros'; }catch(_){ return 'Otros'; } };
    document.getElementById('circuit-report')?.remove();
    const ov=document.createElement('div'); ov.id='circuit-report';
    ov.style.cssText='position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(2,8,12,.92);padding:18px';
    ov.onclick=e=>{ if(e.target===ov) ov.remove(); };
    ov.innerHTML='<div style="background:#04101a;border:2px solid #2f8d8d;border-radius:14px;padding:18px;max-width:520px;width:94vw;color:#dff8ff;max-height:88vh;overflow:auto"><div style="display:flex;justify-content:space-between"><b>📊 Informe por circuito · consumo hoy</b><span id="cr2-x" style="cursor:pointer;color:#75aab9;font-size:22px;line-height:1">×</span></div><div id="cr2-body" style="margin-top:10px;opacity:.7">Cargando '+locs.length+' Xpacios…</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#cr2-x').onclick=()=>ov.remove();
    const results=await Promise.all(locs.map(l=>fetch(PIXER+'/day/range?loc='+encodeURIComponent(l.id)+'&from='+t+'&to='+t,{cache:'no-store'}).then(r=>r.json()).then(d=>({l,day:(d&&d.days&&d.days[t])||null})).catch(()=>({l,day:null}))));
    const grp={}; let gImp=0,gRev=0,nX=0;
    for(const {l,day} of results){ if(!day||!day.extAds||!Object.keys(day.extAds).length) continue; const k=ck(l); const imp=Object.keys(day.extAds).reduce((s,x)=>s+day.extAds[x],0); const rev=day.extAdsRevTotal!=null?day.extAdsRevTotal:0; grp[k]=grp[k]||{imp:0,rev:0,n:0}; grp[k].imp+=imp; grp[k].rev+=rev; grp[k].n++; gImp+=imp; gRev+=rev; nX++; }
    const keys=Object.keys(grp).sort((a,b)=>grp[b].rev-grp[a].rev);
    const body=document.getElementById('cr2-body'); if(!body) return;
    if(!keys.length){ body.innerHTML='<div style="opacity:.6">Ningún Xpacio con consumo hoy todavía.</div>'; return; }
    const mxRev=Math.max(...keys.map(k=>grp[k].rev),0.01);
    body.innerHTML=keys.map(k=>{ const g=grp[k],w=Math.round(g.rev/mxRev*100); return '<div style="margin:7px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span><b>'+k+'</b> <span style="opacity:.5;font-size:10px">'+g.n+' Xpacio'+(g.n>1?'s':'')+'</span></span><span>'+g.imp+' impr · <span style="color:#9effa0">'+g.rev.toFixed(2)+'€</span></span></div><div style="height:7px;background:#0a141d;border-radius:4px;overflow:hidden;margin-top:3px"><div style="height:100%;width:'+w+'%;background:linear-gradient(90deg,#2f8d8d,#7dffd0)"></div></div></div>'; }).join('')
      +'<div style="display:flex;justify-content:space-between;border-top:1px dashed rgba(120,210,255,.25);margin-top:8px;padding-top:6px;color:#9effa0"><b>Total red · '+nX+' Xpacios con consumo hoy</b><b>'+gImp+' impr · '+gRev.toFixed(2)+'€</b></div>'
      +'<div style="font-size:10px;opacity:.5;margin-top:6px">Revisados los '+locs.length+' Xpacios principales de la red.</div>';
  }
  // ═══════ SALA DE EMISIÓN · admira.tv · cockpit en tiempo real ("nave espacial") ═══════
  // Lee /emit/range por circuito (proof-of-play real) y lo pinta como un puente de
  // mando: radar de circuitos, KPIs animados, mezcla por tipo, ranking y feed en vivo.
  const EMIT_TYPE_EMOJI={video:'🎬',animation:'✨',image:'🖼️','digital-twin':'🏬','twin-npc':'🤖',audio:'🔊',music:'🎵',locucion:'🎙️'};
  const EMIT_TYPE_KEY={video:'ed_type_video',animation:'ed_type_animation',image:'ed_type_image','digital-twin':'ed_type_twin','twin-npc':'ed_type_npc',audio:'ed_type_audio',music:'ed_type_music',locucion:'ed_type_voice'};
  function edTypeLbl(k){ return EMIT_TYPE_EMOJI[k] ? (EMIT_TYPE_EMOJI[k]+' '+t(EMIT_TYPE_KEY[k])) : k; }
  const EMIT_TYPE_COL={video:'#7dffd0',animation:'#b388ff',image:'#8ed2ff','digital-twin':'#ffd866','twin-npc':'#ff9a6b',audio:'#6bd1ff',music:'#ff6bd1',locucion:'#9effa0'};
  function emitBrand(l){ try{ return (l.external&&l.external.brand)||((l.kind||'').split(/[·|]/)[0].trim())||t('ed_others'); }catch(_){ return t('ed_others'); } }
  function edHash(s){ let h=0; s=String(s); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h; }
  function edEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function edLocale(){ return (typeof LANG!=='undefined' && LANG==='en') ? 'en-GB' : 'es-ES'; }
  function edInt(n){ return (n||0).toLocaleString(edLocale()); }
  function edDaysAgoStr(n){ const d=new Date(Date.now()-n*86400000); return ''+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0'); }
  // Agrega los proof-of-play que caen dentro de la ventana (inWin: clave 'YYYYMMDD' -> bool).
  function edAgg(results,inWin){
    const circuits={}, totType={}, pieceSet=new Set(); const recent=[]; let totPlays=0,totScreens=0,totSecs=0;
    for(const {l,screens} of results){ const brand=emitBrand(l);
      for(const sn of Object.keys(screens)){ const byDate=screens[sn]||{}; let hit=false;
        for(const dk of Object.keys(byDate)){ if(!inWin(dk)) continue; const rec=byDate[dk]; if(!rec||!rec.totalPlays) continue;
          hit=true; totPlays+=rec.totalPlays; totSecs+=rec.totalSecs||0;
          const c=circuits[brand]||(circuits[brand]={brand,plays:0,screens:0,secs:0,byType:{},last:0});
          c.plays+=rec.totalPlays; c.secs+=rec.totalSecs||0;
          for(const ty in (rec.byType||{})){ c.byType[ty]=(c.byType[ty]||0)+rec.byType[ty]; totType[ty]=(totType[ty]||0)+rec.byType[ty]; }
          for(const id in (rec.assets||{})){ const a=rec.assets[id]; pieceSet.add(id); if((a.last||0)>c.last) c.last=a.last;
            recent.push({screen:sn,brand,title:a.title||id,type:a.type||'image',last:a.last||0}); }
        }
        if(hit){ totScreens++; const c=circuits[brand]; if(c) c.screens++; }
      }
    }
    recent.sort((a,b)=>b.last-a.last);
    return { totPlays, totScreens, totSecs, pieces:pieceSet.size, totType,
      circuits:Object.values(circuits).sort((a,b)=>b.plays-a.plays), recent:recent.slice(0,40) };
  }
  // Locs de DEMO en vivo (DOOH admira.tv) cuyo proof-of-play cae FUERA del top-60 del
  // mapa (p.ej. el kiosk canal.html?circuit=kiosko → loc 'kiosko'). Se consultan
  // explícitamente para que la Sala refleje la emisión real del directo. Aditivo.
  const ED_DEMO_LOCS=[{id:'kiosko',kind:'Kioskos de prensa'}];
  async function fetchEmissionData(){
    const all=(typeof window.loadOmnipLocations==='function')?window.loadOmnipLocations():[];
    const _seen=new Set(), locs=[];
    for(const l of ED_DEMO_LOCS.concat(all.slice(0,60))){ if(l&&l.id&&!_seen.has(l.id)){ _seen.add(l.id); locs.push(l); } }
    const t=todayStr(), from=edDaysAgoStr(30), d7=edDaysAgoStr(6);
    // Un solo tiro de 30 días por Xpacio. Si HOY no ha emitido nadie, caemos a 7d y luego
    // a 30d: la sala muestra siempre la actividad real de la red, nunca aparece en cero.
    const results=await Promise.all(locs.map(l=>fetch(PIXER+'/emit/range?loc='+encodeURIComponent(l.id)+'&from='+from+'&to='+t,{cache:'no-store'}).then(r=>r.json()).then(d=>({l,screens:(d&&d.screens)||{}})).catch(()=>({l,screens:{}}))));
    let win='today', agg=edAgg(results,dk=>dk===t);
    if(!agg.totPlays){ win='7d';  agg=edAgg(results,dk=>dk>=d7   && dk<=t); }
    if(!agg.totPlays){ win='30d'; agg=edAgg(results,dk=>dk>=from && dk<=t); }
    return Object.assign({ t, win, locsChecked:locs.length }, agg);
  }
  function injectEdeckStyle(){ if(document.getElementById('edeck-style')) return;
    const s=document.createElement('style'); s.id='edeck-style'; s.textContent=`
    #emission-deck{position:fixed;inset:0;z-index:100001;background:radial-gradient(130% 130% at 50% -10%,#06151f 0%,#02090e 58%,#01060a 100%);color:#dff8ff;font-family:'Courier New',ui-monospace,SFMono-Regular,monospace;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;animation:ed-in .4s ease}
    @keyframes ed-in{from{opacity:0;transform:scale(1.015)}to{opacity:1;transform:none}}
    #emission-deck .grid-bg{position:absolute;inset:0;background-image:linear-gradient(rgba(45,141,141,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(45,141,141,.08) 1px,transparent 1px);background-size:44px 44px;-webkit-mask:radial-gradient(circle at 50% 42%,#000 28%,transparent 78%);mask:radial-gradient(circle at 50% 42%,#000 28%,transparent 78%);pointer-events:none}
    #emission-deck .scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(125,255,208,.035) 0 1px,transparent 1px 4px);mix-blend-mode:screen;pointer-events:none;opacity:.55}
    #emission-deck .ed-corner{position:absolute;width:30px;height:30px;border:2px solid #2f8d8d;opacity:.55;pointer-events:none}
    #emission-deck .ed-corner.tl{top:12px;left:12px;border-right:0;border-bottom:0}
    #emission-deck .ed-corner.tr{top:12px;right:12px;border-left:0;border-bottom:0}
    #emission-deck .ed-corner.bl{bottom:12px;left:12px;border-right:0;border-top:0}
    #emission-deck .ed-corner.br{bottom:12px;right:12px;border-left:0;border-top:0}
    #emission-deck .ed-top{display:flex;align-items:center;gap:14px;padding:16px 26px 10px;position:relative;flex-shrink:0;flex-wrap:wrap}
    #emission-deck .ed-brand{font-size:15px;letter-spacing:.14em;color:#bfeaff}
    #emission-deck .ed-brand b{color:#7dffd0}
    #emission-deck .ed-logo{color:#7dffd0;text-shadow:0 0 12px #7dffd0}
    #emission-deck .ed-sub{color:#8ed2ff;opacity:.85;text-transform:uppercase}
    #emission-deck .ed-status{margin-left:auto;display:flex;align-items:center;gap:16px;font-size:11px;letter-spacing:.1em}
    #emission-deck .ed-net{color:#6d8a96}
    #emission-deck .ed-net.ok{color:#7dffd0}
    #emission-deck .ed-net.err{color:#ff7a7a}
    #emission-deck .ed-window{color:#ffd866;font-size:10px;letter-spacing:.12em;border:1px solid rgba(255,216,102,.4);border-radius:6px;padding:2px 8px;white-space:nowrap}
    #emission-deck .ed-window:empty{display:none}
    #emission-deck .ed-live{color:#9effa0;animation:ed-blink 1.4s steps(2) infinite}
    @keyframes ed-blink{50%{opacity:.25}}
    #emission-deck .ed-clock{color:#bfeaff;font-size:13px;letter-spacing:.16em;text-shadow:0 0 10px rgba(125,255,208,.4)}
    #emission-deck .ed-close{margin-left:6px;cursor:pointer;background:rgba(255,90,90,.1);border:1px solid rgba(255,120,120,.4);color:#ff9a9a;border-radius:7px;width:30px;height:30px;font:inherit;font-size:15px}
    #emission-deck .ed-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:6px 26px;flex-shrink:0}
    #emission-deck .ed-kpi{position:relative;background:linear-gradient(180deg,rgba(8,24,34,.7),rgba(4,16,26,.5));border:1px solid rgba(45,141,141,.45);border-radius:12px;padding:14px 16px;overflow:hidden}
    #emission-deck .ed-kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(#7dffd0,transparent)}
    #emission-deck .ed-kpi-v{font-size:38px;font-weight:800;line-height:1;letter-spacing:.02em}
    #emission-deck .ed-kpi-l{margin-top:7px;font-size:10px;letter-spacing:.13em;color:#7fa6b4}
    #emission-deck .ed-main{flex:1 0 auto;display:grid;grid-template-columns:1.3fr .9fr;gap:14px;padding:12px 26px;min-height:380px}
    #emission-deck .ed-panel{position:relative;background:rgba(4,16,26,.45);border:1px solid rgba(45,141,141,.35);border-radius:14px;padding:14px;display:flex;flex-direction:column;min-height:0}
    #emission-deck .ed-ph{font-size:10px;letter-spacing:.16em;color:#8ed2ff;opacity:.8;margin-bottom:8px}
    #emission-deck .ed-radar-wrap{align-items:center;justify-content:center}
    #emission-deck .ed-radar-wrap .ed-ph{align-self:flex-start}
    #emission-deck .ed-radar{position:relative;width:min(46vh,420px);aspect-ratio:1;margin:auto}
    #emission-deck .ed-radar svg{width:100%;height:100%;overflow:visible}
    #emission-deck .ed-sweep{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,rgba(125,255,208,.34),transparent 28%);animation:ed-spin 4s linear infinite;pointer-events:none;mix-blend-mode:screen}
    @keyframes ed-spin{to{transform:rotate(360deg)}}
    #emission-deck .ed-empty{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:12px;letter-spacing:.16em;color:#5d7a86;animation:ed-blink 2s steps(2) infinite}
    #emission-deck .ed-side{overflow:auto}
    #emission-deck .ed-meter{margin:6px 0}
    #emission-deck .ed-meter-top{display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px}
    #emission-deck .ed-bar{height:9px;background:#081420;border:1px solid rgba(45,141,141,.25);border-radius:5px;overflow:hidden}
    #emission-deck .ed-bar i{display:block;height:100%;border-radius:5px;transition:width .7s cubic-bezier(.2,.8,.2,1)}
    #emission-deck .ed-circuits{display:flex;flex-direction:column;gap:5px}
    #emission-deck .ed-crow{display:grid;grid-template-columns:18px 1fr auto auto;gap:7px;align-items:center;font-size:12px;position:relative;padding:4px 6px;border:1px solid rgba(45,141,141,.18);border-radius:8px;background:rgba(8,20,30,.4)}
    #emission-deck .ed-rank{color:#7dffd0;font-weight:800}
    #emission-deck .ed-cname{color:#dbeeff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #emission-deck .ed-cscr{font-size:10px;color:#7fa6b4}
    #emission-deck .ed-cplays{color:#7dffd0;font-weight:800}
    #emission-deck .ed-cbar{grid-column:1/-1;height:4px;background:#081420;border-radius:3px;overflow:hidden}
    #emission-deck .ed-cbar i{display:block;height:100%;background:linear-gradient(90deg,#2f8d8d,#7dffd0);transition:width .7s ease}
    #emission-deck .ed-dim{color:#5d7a86;font-size:11px}
    #emission-deck .ed-ticker{display:flex;align-items:center;gap:12px;border-top:1px solid rgba(45,141,141,.35);background:rgba(2,10,16,.6);padding:9px 26px;overflow:hidden;white-space:nowrap;flex-shrink:0}
    #emission-deck .ed-ticker-lbl{flex:0 0 auto;font-size:10px;letter-spacing:.14em;color:#7dffd0;background:#05121a;position:relative;z-index:2;padding-right:10px}
    #emission-deck .ed-ticker-track{flex:1;overflow:hidden;white-space:nowrap;will-change:transform;-webkit-mask:linear-gradient(90deg,transparent,#000 3%,#000 95%,transparent);mask:linear-gradient(90deg,transparent,#000 3%,#000 95%,transparent)}
    #emission-deck .ed-tk{font-size:12px;color:#cfeaff;padding:0 4px}
    #emission-deck .ed-tk-scr{color:#8ed2ff}
    #emission-deck .ed-tk-sep{color:#2f8d8d;padding:0 10px}
    @keyframes ed-marq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    #ed-launch{position:fixed;z-index:9000;cursor:pointer;display:flex;align-items:center;gap:8px;background:linear-gradient(180deg,rgba(10,30,40,.92),rgba(4,18,28,.92));border:1px solid rgba(125,255,208,.5);color:#7dffd0;border-radius:999px;padding:9px 16px;font:inherit;font-size:11px;letter-spacing:.12em;text-transform:uppercase;box-shadow:0 0 22px rgba(125,255,208,.22),inset 0 0 14px rgba(125,255,208,.06);backdrop-filter:blur(4px)}
    #ed-launch .dot{width:8px;height:8px;border-radius:50%;background:#9effa0;box-shadow:0 0 10px #9effa0;animation:ed-blink 1.4s steps(2) infinite}
    #ed-launch:hover{border-color:#7dffd0;box-shadow:0 0 30px rgba(125,255,208,.4)}
    @media(max-width:760px){#emission-deck .ed-kpis{grid-template-columns:repeat(2,1fr)}#emission-deck .ed-main{grid-template-columns:1fr}#emission-deck .ed-kpi-v{font-size:30px}}
    `; document.head.appendChild(s);
  }
  function edKpi(id,label,color){ return '<div class="ed-kpi"><div class="ed-kpi-v" id="'+id+'" data-v="0" style="color:'+color+';text-shadow:0 0 18px '+color+'66">0</div><div class="ed-kpi-l" id="'+id+'-l">'+label+'</div></div>'; }
  function edTween(el,to){ if(!el) return; const from=+(el.getAttribute('data-v')||0); el.setAttribute('data-v',to); if(from===to){ el.textContent=edInt(to); return; }
    const t0=performance.now(),dur=650; (function step(now){ const k=Math.min(1,(now-t0)/dur); const v=Math.round(from+(to-from)*(0.5-0.5*Math.cos(k*Math.PI))); el.textContent=edInt(v); if(k<1) requestAnimationFrame(step); })(t0);
    setTimeout(function(){ if(+el.getAttribute('data-v')===to) el.textContent=edInt(to); },dur+90); }
  function edClock(){ const el=document.getElementById('ed-clock'); if(!el) return; try{ el.textContent=new Date().toLocaleTimeString(edLocale(),{hour12:false,timeZone:'Europe/Madrid'}); }catch(_){ } }
  let _edTimer=null,_edClk=null,_edPrev=null;
  function emissionDeck(){
    if(document.getElementById('emission-deck')) return;
    injectEdeckStyle(); _edPrev=null;
    const ov=document.createElement('div'); ov.id='emission-deck';
    ov.innerHTML='<div class="grid-bg"></div><div class="scan"></div>'
      +'<div class="ed-corner tl"></div><div class="ed-corner tr"></div><div class="ed-corner bl"></div><div class="ed-corner br"></div>'
      +'<header class="ed-top"><div class="ed-brand"><span class="ed-logo">▲</span> ADMIRA<b>.TV</b> · <span class="ed-sub" data-i18n="emission_room">'+t('emission_room')+'</span></div>'
      +'<div class="ed-status"><span id="ed-net" class="ed-net">'+t('ed_linking')+'</span><span id="ed-window" class="ed-window"></span><span class="ed-live">'+t('ed_on_air')+'</span><span id="ed-clock" class="ed-clock"></span></div>'
      +'<button id="ed-close" class="ed-close" title="'+t('ed_close_esc')+'">✕</button></header>'
      +'<div class="ed-kpis">'+edKpi('ed-k-plays',t('ed_kpi_plays'),'#7dffd0')+edKpi('ed-k-screens',t('ed_kpi_screens'),'#8ed2ff')+edKpi('ed-k-pieces',t('ed_kpi_pieces'),'#ffd866')+edKpi('ed-k-rate',t('ed_kpi_rate'),'#9effa0')+'</div>'
      +'<div class="ed-main">'
        +'<section class="ed-panel ed-radar-wrap"><div class="ed-ph">'+t('ed_radar_title')+'</div><div class="ed-radar"><svg id="ed-radar-svg" viewBox="0 0 320 320"></svg><div class="ed-sweep"></div><div id="ed-radar-empty" class="ed-empty">'+t('ed_awaiting')+'</div></div></section>'
        +'<section class="ed-panel ed-side"><div class="ed-ph">'+t('ed_mix_type')+'</div><div id="ed-types"></div><div class="ed-ph" style="margin-top:14px">'+t('ed_ranking')+'</div><div id="ed-circuits" class="ed-circuits"></div></section>'
      +'</div>'
      +'<footer class="ed-ticker"><div class="ed-ticker-lbl">'+t('ed_feed')+'</div><div class="ed-ticker-track" id="ed-ticker"></div></footer>';
    document.body.appendChild(ov);
    const close=()=>{ clearInterval(_edTimer); clearInterval(_edClk); _edTimer=_edClk=null; document.removeEventListener('keydown',onKey); ov.remove(); };
    function onKey(e){ if(e.key==='Escape') close(); }
    document.getElementById('ed-close').onclick=close; document.addEventListener('keydown',onKey);
    edClock(); edeckRefresh(); _edClk=setInterval(edClock,1000); _edTimer=setInterval(edeckRefresh,12000);
  }
  async function edeckRefresh(){
    let d; try{ d=await fetchEmissionData(); }catch(_){ const n=document.getElementById('ed-net'); if(n){ n.textContent=t('ed_nolink'); n.className='ed-net err'; } return; }
    if(!document.getElementById('emission-deck')) return;
    const net=document.getElementById('ed-net'); if(net){ net.textContent=tf('ed_linked',{n:d.locsChecked}); net.className='ed-net ok'; }
    // ── Ventana temporal (hoy → 7d → 30d): etiquetas honestas para no verse nunca muerta ──
    const es=(typeof LANG==='undefined'||LANG!=='en'), live=(d.win==='today');
    const wb=document.getElementById('ed-window');
    if(wb) wb.textContent = live ? '' : (d.win==='7d' ? (es?'ÚLTIMOS 7 DÍAS':'LAST 7 DAYS') : (es?'ÚLTIMOS 30 DÍAS':'LAST 30 DAYS'));
    const plL=document.getElementById('ed-k-plays-l');
    if(plL) plL.textContent = live ? t('ed_kpi_plays') : (es?'PASES · ':'PLAYS · ')+(d.win==='7d'?'7D':'30D');
    edTween(document.getElementById('ed-k-plays'),d.totPlays);
    edTween(document.getElementById('ed-k-screens'),d.totScreens);
    edTween(document.getElementById('ed-k-pieces'),d.pieces);
    const rEl=document.getElementById('ed-k-rate'), rL=document.getElementById('ed-k-rate-l');
    if(live){
      const now=performance.now(); let rate=0;
      if(_edPrev){ const dt=(now-_edPrev.t)/60000; if(dt>0) rate=Math.max(0,(d.totPlays-_edPrev.plays)/dt); }
      _edPrev={plays:d.totPlays,t:now};
      if(rL) rL.textContent=t('ed_kpi_rate');
      if(rEl){ rEl.textContent=rate?rate.toFixed(1):'0'; rEl.setAttribute('data-v',Math.round(rate)); }
    } else {
      _edPrev=null; const dias=(d.win==='7d'?7:30), perDay=d.totPlays/dias;
      if(rL) rL.textContent=(es?'PASES / DÍA':'PLAYS / DAY');
      if(rEl){ rEl.textContent=(perDay<10?perDay.toFixed(1):String(Math.round(perDay))); rEl.setAttribute('data-v',Math.round(perDay)); }
    }
    edeckRadar(d.circuits);
    const emp=document.getElementById('ed-radar-empty'); if(emp) emp.style.display=d.circuits.length?'none':'block';
    edeckTypes(d.totType);
    edeckCircuits(d.circuits);
    edeckTicker(d.recent);
  }
  function edeckRadar(circuits){
    const svg=document.getElementById('ed-radar-svg'); if(!svg) return; const cx=160,cy=160; let g='';
    [142,104,66,30].forEach(r=>{ g+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="rgba(45,141,141,.35)" stroke-width="1"/>'; });
    g+='<line x1="'+cx+'" y1="14" x2="'+cx+'" y2="306" stroke="rgba(45,141,141,.20)"/><line x1="14" y1="'+cy+'" x2="306" y2="'+cy+'" stroke="rgba(45,141,141,.20)"/><circle cx="'+cx+'" cy="'+cy+'" r="3" fill="#7dffd0"/>';
    const maxP=Math.max(1,...circuits.map(c=>c.plays)), N=Math.min(14,circuits.length);
    circuits.slice(0,14).forEach((c,i)=>{
      const ang=(edHash(c.brand)%360)*Math.PI/180, rr=Math.min(142,40+i*(100/Math.max(1,N)));
      const x=cx+Math.cos(ang)*rr, y=cy+Math.sin(ang)*rr, sz=4+Math.round(11*c.plays/maxP);
      const topTy=Object.keys(c.byType).sort((a,b)=>c.byType[b]-c.byType[a])[0], col=EMIT_TYPE_COL[topTy]||'#7dffd0';
      g+='<g><circle cx="'+x+'" cy="'+y+'" r="'+(sz+5)+'" fill="'+col+'" opacity="0.12"><animate attributeName="r" values="'+(sz+3)+';'+(sz+13)+';'+(sz+3)+'" dur="2.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.18;0;0.18" dur="2.6s" repeatCount="indefinite"/></circle>'
        +'<circle cx="'+x+'" cy="'+y+'" r="'+sz+'" fill="'+col+'"/>'
        +'<text x="'+x+'" y="'+(y-sz-5)+'" fill="#cfeaff" font-size="8" text-anchor="middle">'+edEsc(c.brand).slice(0,13)+'</text>'
        +'<text x="'+x+'" y="'+(y+sz+11)+'" fill="'+col+'" font-size="8.5" font-weight="700" text-anchor="middle">'+c.plays+'</text></g>';
    });
    svg.innerHTML=g;
  }
  function edeckTypes(totType){
    const host=document.getElementById('ed-types'); if(!host) return;
    const keys=Object.keys(totType).sort((a,b)=>totType[b]-totType[a]);
    if(!keys.length){ host.innerHTML='<div class="ed-dim">'+t('ed_no_emission')+'</div>'; return; }
    const mx=Math.max(1,...keys.map(k=>totType[k]));
    host.innerHTML=keys.map(k=>{ const v=totType[k],w=Math.round(v/mx*100),col=EMIT_TYPE_COL[k]||'#7dffd0';
      return '<div class="ed-meter"><div class="ed-meter-top"><span>'+edTypeLbl(k)+'</span><b style="color:'+col+'">'+v+'</b></div><div class="ed-bar"><i style="width:'+w+'%;background:linear-gradient(90deg,'+col+'33,'+col+');box-shadow:0 0 12px '+col+'88"></i></div></div>'; }).join('');
  }
  function edeckCircuits(list){
    const host=document.getElementById('ed-circuits'); if(!host) return;
    if(!list.length){ host.innerHTML='<div class="ed-dim">'+t('ed_no_circuits')+'</div>'; return; }
    const mx=Math.max(1,...list.map(c=>c.plays));
    host.innerHTML=list.slice(0,8).map((c,i)=>{ const w=Math.round(c.plays/mx*100);
      return '<div class="ed-crow"><span class="ed-rank">'+(i+1)+'</span><span class="ed-cname">'+edEsc(c.brand)+'</span><span class="ed-cscr">'+c.screens+'📺</span><span class="ed-cplays">'+c.plays+'</span><div class="ed-cbar"><i style="width:'+w+'%"></i></div></div>'; }).join('');
  }
  function edeckTicker(recent){
    const host=document.getElementById('ed-ticker'); if(!host) return;
    if(!recent.length){ host.innerHTML='<span class="ed-dim">'+t('ed_ticker_waiting')+'</span>'; host.style.animation='none'; return; }
    const items=recent.map(r=>'<span class="ed-tk"><b style="color:'+(EMIT_TYPE_COL[r.type]||'#7dffd0')+'">'+(EMIT_TYPE_EMOJI[r.type]||'▸')+'</b> <span class="ed-tk-scr">'+edEsc(r.screen)+'</span> ▸ '+edEsc(r.title).slice(0,42)+'</span>').join('<span class="ed-tk-sep">·</span>');
    host.innerHTML=items+'<span class="ed-tk-sep">·</span>'+items; host.style.animation='ed-marq 40s linear infinite';
  }
  // Lanzador fijo siempre visible (el botón 📡 del panel RTB también abre la Sala).
  function mountEmissionLauncher(){
    if(document.getElementById('ed-launch')) return;
    injectEdeckStyle();
    const b=document.createElement('button'); b.id='ed-launch'; b.style.right='14px'; b.style.bottom='118px';
    b.innerHTML='<span class="dot"></span>🚀 <span data-i18n="emission_room">'+t('emission_room')+'</span>';
    b.onclick=emissionDeck; document.body.appendChild(b);
  }
  async function render(){
    const box=document.getElementById('extad-live'); if(!box) return;
    const loc=pickLoc(); const t=todayStr();
    try{
      const r=await fetch(PIXER+'/day/range?loc='+encodeURIComponent(loc)+'&from='+t+'&to='+t,{cache:'no-store'});
      const d=await r.json(); const day=(d&&d.days&&d.days[t])||null;
      const ea=(day&&day.extAds)||null;
      if(!ea||!Object.keys(ea).length){ box.style.display='none'; return; }
      const rev=(day&&day.extAdsRev)||null;
      const rows=Object.keys(ea).map(k=>{ const cpm=SEG_CPM[k]!=null?SEG_CPM[k]:8; const rv=(rev&&rev[k]!=null)?rev[k]:(ea[k]/1000*cpm); return {lbl:segLbl(k),n:ea[k],cpm,rv}; }).sort((a,b)=>b.rv-a.rv);
      const tot=(day&&day.extAdsRevTotal!=null)?day.extAdsRevTotal:rows.reduce((s,x)=>s+x.rv,0);
      document.getElementById('extad-live-loc').textContent=loc;
      document.getElementById('extad-live-rows').innerHTML=rows.map(x=>'<div style="display:flex;justify-content:space-between"><span>'+x.lbl+' <span style="opacity:.5;font-size:10px">@'+x.cpm.toFixed(1)+'€</span></span><span><b>'+x.n+'</b> <span style="color:#9effa0">'+x.rv.toFixed(2)+'€</span></span></div>').join('');
      const fmt=v=>v.toFixed(2).replace('.',',')+' €';
      document.getElementById('extad-live-total').textContent=fmt(tot);
      const t2=document.getElementById('extad-live-total2'); if(t2) t2.textContent=fmt(tot);
      // Δ desde el último refresco → "lo que he consumido se va actualizando"
      if(render._loc!==loc){ render._loc=loc; render._series=[]; render._last=null; }   // reset al cambiar de Xpacio
      const prev=render._last; render._last=tot;
      const dEl=document.getElementById('extad-live-delta');
      if(dEl){ const dv=prev==null?0:(tot-prev); dEl.textContent=dv>0.001?('▲ +'+fmt(dv)):''; dEl.style.color='#9effa0'; }
      // pulso LIVE
      const pu=document.getElementById('extad-live-pulse'); if(pu){ pu.style.opacity='1'; setTimeout(()=>{ try{pu.style.opacity='.35';}catch(_){} },350); }
      // Sparkline del consumo acumulado en ESTA sesión (muestreo por refresco)
      render._series=render._series||[]; render._series.push(tot); if(render._series.length>60) render._series.shift();
      const sp=document.getElementById('extad-live-spark');
      if(sp && render._series.length>1){ const s=render._series, mx=Math.max(...s)||1, W=300,H=30, st=W/(s.length-1);
        const pts=s.map((v,i)=>(i*st).toFixed(1)+','+(H-(v/mx)*H+2).toFixed(1)).join(' ');
        sp.innerHTML='<polyline points="'+pts+'" fill="none" stroke="#9effa0" stroke-width="1.5"/><polyline points="0,'+(H+2)+' '+pts+' '+W+','+(H+2)+'" fill="rgba(158,255,160,.10)" stroke="none"/>';
        sp.style.display='block';
      }
      // Audiencia por hora (evolución del día) — barras reales de day.hours
      const ch=document.getElementById('extad-live-chart');
      if(ch){ const hrs=(day&&Array.isArray(day.hours))?day.hours:[];
        if(hrs.length>1){ const mxA=Math.max(1,...hrs.map(h=>h.in||0)), curH=hrs[hrs.length-1].h, W=300,H=34,bw=W/hrs.length;
          const bars=hrs.map((h,i)=>{ const bh=Math.round((h.in||0)/mxA*H), x=Math.round(i*bw); const cur=h.h===curH;
            return '<rect x="'+(x+1)+'" y="'+(H-bh)+'" width="'+Math.max(2,Math.round(bw-2))+'" height="'+bh+'" rx="1" fill="'+(cur?'#ffd866':'#3a86a8')+'"/>'; }).join('');
          const labs=hrs.map((h,i)=> i%Math.ceil(hrs.length/5)===0?'<text x="'+Math.round(i*bw+bw/2)+'" y="'+(H+9)+'" fill="#6d8a96" font-size="7" text-anchor="middle">'+h.h+'h</text>':'').join('');
          ch.innerHTML='<div style="font-size:9px;opacity:.55;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Audiencia por hora · ahora '+curH+'h</div><svg viewBox="0 0 '+W+' '+(H+12)+'" preserveAspectRatio="none" style="width:100%;height:38px">'+bars+labs+'</svg>';
        } else ch.innerHTML='';
      }
      box.style.display='block';
    }catch(e){ /* silencioso */ }
  }
  // ── Editor de CPM por segmento (POST /segcpm) ──
  const SEGS=[['nino_m','♂ Niño'],['nino_f','♀ Niña'],['joven_m','♂ Joven'],['joven_f','♀ Joven'],['adulto_m','♂ Adulto'],['adulto_f','♀ Adulta'],['senior_m','♂ Senior'],['senior_f','♀ Senior']];
  function buildEditor(cur){
    const grid=document.getElementById('segcpm-grid'); if(!grid) return;
    grid.innerHTML=SEGS.map(([k,lbl])=>{ const v=(cur&&cur[k]!=null)?cur[k]:SEG_CPM[k]; return '<label style="display:flex;justify-content:space-between;align-items:center;gap:6px"><span>'+lbl+'</span><span><input data-seg="'+k+'" type="number" min="0" max="200" step="0.5" value="'+v+'" style="width:58px;background:#0a1118;border:1px solid #2f6a8a;color:#dbeaff;border-radius:5px;padding:3px 5px;font:inherit;text-align:right">€</span></label>'; }).join('');
  }
  async function loadEditor(){
    const loc=pickLoc();
    try{ const r=await fetch(PIXER+'/segcpm?loc='+encodeURIComponent(loc),{cache:'no-store'}); const d=await r.json(); buildEditor((d&&d.cpm&&Object.keys(d.cpm).length)?d.cpm:null); }
    catch(e){ buildEditor(null); }
  }
  async function saveEditor(){
    const loc=pickLoc(); const st=document.getElementById('segcpm-status');
    const cpm={}; document.querySelectorAll('#segcpm-grid input[data-seg]').forEach(i=>{ const v=parseFloat(i.value); if(isFinite(v)) cpm[i.getAttribute('data-seg')]=v; });
    if(st) st.textContent='Guardando…';
    try{ const r=await fetch(PIXER+'/segcpm?loc='+encodeURIComponent(loc),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cpm})}); const d=await r.json();
      if(d&&d.ok){ if(st) st.textContent='✅ Precios guardados ('+loc+') — el gemelo los aplica en ~1 min'; render(); }
      else if(st) st.textContent='⚠️ '+((d&&d.error)||'error'); }
    catch(e){ if(st) st.textContent='⚠️ error de red'; }
  }
  function wireEditor(){
    const ed=document.getElementById('segcpm-editor'); if(!ed) return;
    ed.addEventListener('toggle',()=>{ if(ed.open) loadEditor(); });
    const btn=document.getElementById('segcpm-save'); if(btn) btn.onclick=saveEditor;
  }
  // ── Compra de campaña (POST /campaign) + monitor de presupuesto ──
  function segLbl(k){ const m=SEGS.find(s=>s[0]===k); return m?m[1]:k; }
  function fillCampSeg(){ const s=document.getElementById('camp-seg'); if(!s||s.children.length) return; s.innerHTML=SEGS.map(([k,l])=>'<option value="'+k+'">'+l+'</option>').join(''); s.value='joven_f'; }
  const SEG_AUD={ nino_m:'children (boys)', nino_f:'children (girls)', joven_m:'young men', joven_f:'young women', adulto_m:'adult men', adulto_f:'adult women', senior_m:'older men', senior_f:'older women' };
  const SEG_SEGOBJ={ // segmentation para el Stock (matching del gemelo)
    nino_m:{genders:['hombre'],ageBuckets:['nino']}, nino_f:{genders:['mujer'],ageBuckets:['nino']},
    joven_m:{genders:['hombre'],ageBuckets:['joven']}, joven_f:{genders:['mujer'],ageBuckets:['joven']},
    adulto_m:{genders:['hombre'],ageBuckets:['adulto']}, adulto_f:{genders:['mujer'],ageBuckets:['adulto']},
    senior_m:{genders:['hombre'],ageBuckets:['senior']}, senior_f:{genders:['mujer'],ageBuckets:['senior']} };
  // Genera la creatividad de la campaña con PixerIA (Grok) y la publica al Stock.
  async function genCreative(seg, product, st){
    const aud=SEG_AUD[seg]||'general audience';
    const prod=(product||'a relevant product for this audience').trim();
    const prompt='Advertising poster of '+prod+', targeted at '+aud+', premium photorealistic ad, vertical poster, clean studio background, no text, eye-catching';
    if(st) st.textContent='🎨 PixerIA generando la creatividad…';
    const g=await fetch(PIXER+'/xai/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,model:'grok-imagine-image-pro',b64:true})}).then(r=>r.json());
    const arr=(g&&g.data)||[]; if(!arr.length||!arr[0].b64_json) throw new Error((g&&g.error)||'gen-fail');
    if(st) st.textContent='📤 Publicando creatividad…';
    const pub=await fetch(PIXER+'/stock/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      type:'image', motor:'grok-imagine-image-pro', mime:arr[0].mime||'image/jpeg', base64:arr[0].b64_json,
      title:'Campaña '+segLbl(seg)+(prod?(' · '+prod):''), prompt:prompt, tags:['campana','publi',seg.split('_')[1]],
      segmentation:SEG_SEGOBJ[seg]||null, quality:'better' })}).then(r=>r.json());
    if(!pub||!pub.ok||!pub.url) throw new Error((pub&&pub.error)||'pub-fail');
    return pub.url;
  }
  async function launchCampaign(){
    const loc=pickLoc(); const seg=(document.getElementById('camp-seg')||{}).value||'adulto_m';
    const product=(document.getElementById('camp-product')||{}).value||'';
    const budget=parseFloat((document.getElementById('camp-budget')||{}).value)||0;
    const cpm=SEG_CPM[seg]!=null?SEG_CPM[seg]:8; const st=document.getElementById('camp-status');
    const btn=document.getElementById('camp-launch'); const prev=document.getElementById('camp-preview'); const pimg=document.getElementById('camp-preview-img');
    if(budget<=0){ if(st) st.textContent='⚠️ pon un presupuesto'; return; }
    if(btn) btn.disabled=true;
    try{
      const creativeUrl=await genCreative(seg, product, st);
      if(pimg&&prev){ pimg.src=creativeUrl; prev.style.display='block'; }   // ves lo que ha creado
      const r=await fetch(PIXER+'/campaign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({loc,seg,budget,cpm,name:'Campaña '+segLbl(seg),product,creativeUrl})});
      const d=await r.json();
      if(d&&d.ok){ if(st) st.textContent='✅ Campaña activa con su creatividad · '+budget+'€ @ '+cpm.toFixed(1)+'€ CPM'; renderCampaigns(); }
      else if(st) st.textContent='⚠️ '+((d&&d.error)||'error al crear campaña');
    }catch(e){ if(st) st.textContent='⚠️ '+((e&&e.message)||'error generando creatividad'); }
    finally{ if(btn) btn.disabled=false; }
  }
  // INFORME de una campaña: cómo ha funcionado DENTRO del gemelo (impactos por día
  // del segmento desde su inicio, gasto, CPM efectivo, ingreso CPM). Datos reales del
  // DVR (/day/range, days[d].extAds/extAdsRev por segmento).
  function campaignReport(c, days, minStart){
    if(!c) return; document.getElementById('camp-report')?.remove();
    const t=todayStr(), start=c.startDate||minStart;
    const dlist=Object.keys(days||{}).filter(d=>d>=start).sort();
    const series=dlist.map(d=>({ d, imp:(days[d].extAds&&days[d].extAds[c.seg])||0, rev:(days[d].extAdsRev&&days[d].extAdsRev[c.seg])||0 }));
    const totImp=series.reduce((s,x)=>s+x.imp,0), totRev=series.reduce((s,x)=>s+x.rev,0);
    const spent=Math.min(c.budget, totImp/1000*(c.cpm||0)), pct=c.budget?Math.min(100,spent/c.budget*100):0;
    const effCpm=totImp?(spent/(totImp/1000)):0, ndays=series.length||1, done=spent>=c.budget&&c.budget>0;
    const maxImp=Math.max(1,...series.map(x=>x.imp)), W=460,H=70,bw=W/Math.max(1,series.length);
    const bars=series.map((x,i)=>{ const h=Math.round(x.imp/maxImp*H),bx=Math.round(i*bw); return '<rect x="'+(bx+1)+'" y="'+(H-h)+'" width="'+Math.max(2,Math.round(bw-2))+'" height="'+h+'" rx="1" fill="#78f3ff"></rect>'; }).join('');
    const step=Math.max(1,Math.ceil(series.length/6));
    const labels=series.map((x,i)=> i%step===0?'<text x="'+Math.round(i*bw+bw/2)+'" y="'+(H+10)+'" fill="#6d8a96" font-size="8" text-anchor="middle">'+x.d.slice(5)+'</text>':'').join('');
    const kpi=(l,v)=>'<div style="flex:1;min-width:84px;background:#02141c;border:1px solid #1f4357;border-radius:8px;padding:8px 10px"><div style="font-size:9px;opacity:.6;text-transform:uppercase">'+l+'</div><div style="font-size:17px;font-weight:800;color:#7dffd0">'+v+'</div></div>';
    const cre=c.creativeUrl&&/^https?:/.test(c.creativeUrl)?'<img src="'+c.creativeUrl+'" style="width:54px;height:54px;object-fit:cover;border:1px solid #2f6a8a;border-radius:8px">':'';
    // PLV del Xpacio en el periodo (qué superficie entregó): suma summary.plv de los días.
    const PLVL={escaparate:'🪟 Escaparate',tft:'📺 TFT',led:'💡 LED'}; const plvAgg={};
    for(const d of dlist){ const p=days[d]&&days[d].plv; if(p) for(const k in p){ plvAgg[k]=plvAgg[k]||{imp:0,rev:0}; plvAgg[k].imp+=(p[k].imp||0); plvAgg[k].rev+=(p[k].rev||0); } }
    const plvKeys=Object.keys(plvAgg).filter(k=>plvAgg[k].imp>0);
    let plvHtml='';
    if(plvKeys.length){ const plvTot=plvKeys.reduce((s,k)=>s+plvAgg[k].imp,0);
      plvHtml='<div style="font-size:10px;opacity:.6;text-transform:uppercase;margin:10px 0 3px">PLV del Xpacio · qué superficie entregó</div>'+
        plvKeys.sort((a,b)=>plvAgg[b].imp-plvAgg[a].imp).map(k=>{ const pct=Math.round(plvAgg[k].imp/plvTot*100);
          return '<div style="display:flex;align-items:center;gap:8px;margin:3px 0;font-size:11px"><span style="width:96px;color:#bcd6ee">'+(PLVL[k]||k)+'</span><span style="flex:1;height:7px;background:#0a141d;border-radius:4px;overflow:hidden"><span style="display:block;height:100%;width:'+pct+'%;background:#3a86a8"></span></span><span style="width:88px;text-align:right;color:#9fd0ff">'+plvAgg[k].imp+' impr · '+pct+'%</span></div>'; }).join('')+
        '<div style="font-size:10px;opacity:.55;margin-top:3px">Nota: la campaña (segmento exterior) se sirve sobre todo por el escaparate; TFT/LED son PLV interior del Xpacio.</div>';
    }
    const ov=document.createElement('div'); ov.id='camp-report';
    ov.style.cssText='position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(2,8,12,.92);padding:18px';
    ov.onclick=(e)=>{ if(e.target===ov) ov.remove(); };
    ov.innerHTML='<div style="background:#04101a;border:2px solid #2f8d8d;border-radius:14px;padding:18px;max-width:560px;width:94vw;max-height:90vh;overflow:auto;color:#dff8ff">'
      +'<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">'+cre+'<div style="flex:1"><div style="font-weight:800;font-size:16px">📊 Informe · '+segLbl(c.seg)+'</div><div style="font-size:11px;opacity:.6">'+((c.product||'')+'')+' · '+start+' → '+t+' · '+ndays+' días</div></div><span id="cr-close" style="cursor:pointer;font-size:24px;color:#75aab9;line-height:1">×</span></div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">'+kpi('Impactos',totImp)+kpi('Gasto',spent.toFixed(2)+'€')+kpi('CPM efect.',effCpm.toFixed(2)+'€')+kpi('Presup.',pct.toFixed(0)+'%')+kpi('Estado',done?'Agotada':'Activa')+'</div>'
      +'<div style="font-size:10px;opacity:.6;text-transform:uppercase;margin:6px 0 3px">Impactos por día (en el gemelo)</div>'
      +'<svg viewBox="0 0 '+W+' '+(H+14)+'" preserveAspectRatio="none" style="width:100%;height:84px;background:#071019;border-radius:8px">'+bars+labels+'</svg>'
      +'<div style="font-size:11px;opacity:.75;margin-top:8px">Ingreso CPM acumulado: <b style="color:#ffd866">'+totRev.toFixed(2)+'€</b> · media '+Math.round(totImp/ndays)+' impactos/día · objetivo '+(c.budget||0)+'€ @ '+(c.cpm||0).toFixed(1)+'€ CPM</div>'
      +plvHtml
      +'<div style="text-align:right;margin-top:10px"><button id="cr-del" style="cursor:pointer;background:#2a1015;border:1px solid #7a3a3a;color:#ff9a9a;border-radius:7px;padding:6px 12px;font-size:11px">🗑 Eliminar campaña</button></div>'
      +'</div>';
    document.body.appendChild(ov);
    ov.querySelector('#cr-close').onclick=()=>ov.remove();
    ov.querySelector('#cr-del').onclick=async()=>{
      if(!confirm('¿Eliminar la campaña "'+segLbl(c.seg)+(c.product?' · '+c.product:'')+'"? No se puede deshacer.')) return;
      try{ await fetch(PIXER+'/campaign/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({loc:c.loc,id:c.id})}); }catch(e){}
      ov.remove(); renderCampaigns();
    };
  }
  async function renderCampaigns(){
    const box=document.getElementById('camp-list'); if(!box) return; const loc=pickLoc(); const t=todayStr();
    try{
      const cr=await fetch(PIXER+'/campaign/list?loc='+encodeURIComponent(loc),{cache:'no-store'}).then(r=>r.json());
      const camps=(cr&&cr.campaigns)||[];
      if(!camps.length){ box.innerHTML='<div style="opacity:.5;font-size:11px;margin-top:6px">Sin campañas. Lanza una arriba.</div>'; return; }
      // Presupuesto MULTI-DÍA: impactos del segmento desde el inicio de cada campaña
      // hasta hoy. Pedimos el rango más amplio una vez y sumamos por día.
      let minStart=t; camps.forEach(c=>{ if(c.startDate&&c.startDate<minStart) minStart=c.startDate; });
      const dr=await fetch(PIXER+'/day/range?loc='+encodeURIComponent(loc)+'&from='+minStart+'&to='+t,{cache:'no-store'}).then(r=>r.json());
      const days=(dr&&dr.days)||{};
      const impFor=(seg,start)=>{ let s=0; for(const d in days){ if(d>=(start||minStart)){ const ea=days[d].extAds||{}; s+=ea[seg]||0; } } return s; };
      box.innerHTML='<div style="font-size:10px;color:#8ed2ff;margin:8px 0 4px;letter-spacing:.06em">CAMPAÑAS ACTIVAS · clic para informe 📊</div>'+camps.map((c,i)=>{
        const imp=impFor(c.seg, c.startDate); const spent=Math.min(c.budget, imp/1000*c.cpm); const pct=Math.min(100, c.budget?spent/c.budget*100:0); const done=spent>=c.budget&&c.budget>0;
        const cre=c.creativeUrl&&/^https?:/.test(c.creativeUrl)?'<img src="'+c.creativeUrl+'" alt="" style="width:42px;height:42px;object-fit:cover;border:1px solid #2f6a8a;border-radius:6px;flex:0 0 42px">':'';
        const prod=c.product?'<div style="font-size:10px;opacity:.6">'+(''+c.product).replace(/</g,'&lt;').slice(0,40)+'</div>':'';
        return '<div data-ci="'+i+'" title="Ver informe de rendimiento" style="border:1px solid '+(done?'#7a3a3a':'#1f4357')+';border-radius:8px;padding:7px 9px;margin-bottom:6px;display:flex;gap:9px;cursor:pointer">'+
          cre+'<div style="flex:1;min-width:0">'+
          '<div style="display:flex;justify-content:space-between"><b>'+segLbl(c.seg)+'</b><span style="opacity:.6;font-size:10px">'+(c.cpm||0).toFixed(1)+'€ CPM</span></div>'+prod+
          '<div style="height:6px;background:#0a141d;border-radius:4px;overflow:hidden;margin:5px 0"><div style="height:100%;width:'+pct.toFixed(0)+'%;background:'+(done?'#cc5555':'#2ee06a')+'"></div></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:11px"><span>'+spent.toFixed(2)+'€ / '+c.budget+'€</span><span>'+(done?'<b style="color:#ff8866">AGOTADA</b>':(imp+' impactos')) +'</span></div></div></div>';
      }).join('');
      box.querySelectorAll('[data-ci]').forEach(el=>{ el.onclick=()=>campaignReport(camps[+el.dataset.ci], days, minStart); });
    }catch(e){}
  }
  function wireCampaign(){ fillCampSeg(); const b=document.getElementById('camp-launch'); if(b) b.onclick=launchCampaign; const ed=document.getElementById('camp-buy'); if(ed) ed.addEventListener('toggle',()=>{ if(ed.open) renderCampaigns(); }); renderCampaigns(); setInterval(renderCampaigns,20000); }
  function start(){ render(); setInterval(render, 12000); wireEditor(); wireCampaign(); const cb=document.getElementById('extad-circuit-btn'); if(cb) cb.onclick=circuitReport; const eb=document.getElementById('extad-emit-btn'); if(eb) eb.onclick=emissionDeck; mountEmissionLauncher(); }
  if(document.readyState!=='loading') start(); else document.addEventListener('DOMContentLoaded', start);
})();
