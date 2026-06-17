// OmniPublicity — catálogo por defecto de tiendas (gemelos digitales).
// Orden de carga: worker omnipublicity-api (KV) → localStorage → bundled default.
//
// Schema: { id, name, kind, addr, coords:[lng,lat], surfaces:[
//   { name, desc, status:'live'|'sched'|'idle', impr:Number, cpm:String,
//     surface:'pantalla'|'escaparate'|'mostrador'|'vending'|'pwa',
//     pixerScreens?:[<string>]   // opcional. IDs de screens en pixer-eleven
//                                // que pintan en esta surface (ej: 'xtore-lg8qao').
//                                // Si está, los items que llegan a esos screens
//                                // se inyectan como bids LIVE en el feed.
//   } ],
//   twin?:<string>      // opcional. URL del gemelo de esta tienda; si no, cae a TWIN_BASE+&loc=<id>.
//   // ── Config del Digital Twin (la lee game.html vía ?loc= → window.STORE_CFG) ──
//   employees?:[{ name, role }]  // roster real. role: 'cajero'|'repositor'|'azafata'|
//                                // 'manager'|'dj' (o índice 0-4). El twin usa este roster.
//   music?:<string>     // hilo musical del punto (id de pista; fase 2).
//   cameras?:Boolean     // cámaras/LiveCam on-off del punto (fase 2).
//   segmentation?:{
//     required:Boolean,
//     schedule:{ start:'HH:mm', end:'HH:mm' },
//     typologies:['exterior'|'interior'],
//     genders:['hombre'|'mujer'],
//     ages:['nino'|'joven'|'adulto'|'senior'|'vejez'],
//     timeSlots:['manana'|'mediodia'|'tarde'|'noche'],
//     metadata?:[{ key, label, value, type }] // criterios dados de alta por el exclusivista.
//   }
// }
window.OMNIP_API = 'https://omnipublicity-api.csilvasantin.workers.dev';
window.OMNIP_STORE_KEY = 'omnip-locations';

window.OMNIP_SEGMENTATION_OPTIONS = {
  schedule: { start:'08:00', end:'20:00' },
  typologies: ['exterior','interior'],
  genders: ['hombre','mujer'],
  ages: ['nino','joven','adulto','senior','vejez'],
  timeSlots: ['manana','mediodia','tarde','noche'],
  defaultTimeSlots: ['manana','mediodia','tarde'],
};

function _omnipArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function _omnipCleanSelection(value, allowed, fallback) {
  const allow = new Set(allowed);
  const vals = _omnipArray(value).flatMap(v => {
    if (v === 'ambos' || v === 'both') return allowed;
    return [String(v || '').trim()];
  }).filter(v => allow.has(v));
  const uniq = [...new Set(vals)];
  return uniq.length ? uniq : fallback.slice();
}

function _omnipInferTypologies(loc) {
  const surfaces = Array.isArray(loc && loc.surfaces) ? loc.surfaces : [];
  let exterior = false, interior = false;
  surfaces.forEach(s => {
    const type = String(s && s.surface || '').toLowerCase();
    const text = `${s && s.name || ''} ${s && s.desc || ''}`.toLowerCase();
    if (type === 'escaparate' || text.includes('exterior') || text.includes('fachada') || text.includes('puerta')) exterior = true;
    if (['pantalla','mostrador','vending','pwa'].includes(type) || text.includes('interior') || text.includes('sala')) interior = true;
  });
  if (exterior && interior) return ['exterior','interior'];
  if (exterior) return ['exterior'];
  if (interior) return ['interior'];
  return window.OMNIP_SEGMENTATION_OPTIONS.typologies.slice();
}

function _omnipCleanMetadata(raw) {
  const source = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object' ? Object.entries(raw).map(([key, value]) => ({key, value})) : []);
  return source.map(item => {
    if (!item || typeof item !== 'object') return null;
    const key = String(item.key || item.id || item.label || '').trim();
    const label = String(item.label || item.name || key).trim();
    const value = item.value == null ? '' : String(item.value).trim();
    const type = String(item.type || 'text').trim() || 'text';
    if (!key && !label && !value) return null;
    return { key: key || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), label: label || key, value, type };
  }).filter(Boolean);
}

window.normalizeOmnipSegmentation = function(loc) {
  const base = loc && typeof loc === 'object' ? loc : {};
  const seg = base.segmentation && typeof base.segmentation === 'object' ? base.segmentation : {};
  const options = window.OMNIP_SEGMENTATION_OPTIONS;
  const schedule = seg.schedule && typeof seg.schedule === 'object' ? seg.schedule : {};
  const normalized = Object.assign({}, base, {
    segmentation: {
      required: true,
      schedule: {
        start: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(schedule.start || '')) ? schedule.start : options.schedule.start,
        end: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(schedule.end || '')) ? schedule.end : options.schedule.end,
      },
      typologies: _omnipCleanSelection(seg.typologies || seg.typology || seg.placements, options.typologies, _omnipInferTypologies(base)),
      genders: _omnipCleanSelection(seg.genders || seg.gender, options.genders, options.genders),
      ages: _omnipCleanSelection(seg.ages || seg.age, options.ages, options.ages),
      timeSlots: _omnipCleanSelection(seg.timeSlots || seg.timeSlot || seg.slots, options.timeSlots, options.defaultTimeSlots),
      metadata: _omnipCleanMetadata(seg.metadata || base.metadata),
    },
  });
  return normalized;
};

window.normalizeOmnipLocations = function(arr) {
  return (Array.isArray(arr) ? arr : []).map(window.normalizeOmnipSegmentation);
};

function desigualSurfaces(type) {
  const outlet = type === 'outlet';
  return [
    { name: outlet ? 'Escaparate outlet' : 'Escaparate flagship', desc: 'Surface exterior para creatividades de moda, rebajas y lanzamientos por zona', status:'live', impr: outlet ? 520 : 720, cpm: outlet ? '€6' : '€9', surface:'escaparate' },
    { name: 'Pantalla interior', desc: 'Digital signage en sala de venta · colecciones, looks y campañas contextuales', status:'live', impr: outlet ? 360 : 460, cpm: outlet ? '€5' : '€7', surface:'pantalla' },
    { name: 'Caja y probadores', desc: 'Impacto de cierre de compra, cross-sell y registro en club', status:'live', impr: outlet ? 140 : 180, cpm: outlet ? '€4' : '€5', surface:'mostrador' },
    { name: 'PWA Desigual Club', desc: 'Push de proximidad para socios, wishlist y promociones por tienda', status:'live', impr: outlet ? 180 : 260, cpm:'€3', surface:'pwa' },
  ];
}

window.OMNIP_LOCATIONS_DEFAULT = [
  // ── Circuito kioskos de prensa · Barcelona (100 puntos, fuente OpenStreetMap) ──
  {
    id:'bcn-kiosk-001', name:'Quiosc · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Andreu · Barcelona', coords:[2.208566, 41.456931],
    osm:{ id:1295287995, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1315, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-002', name:'Quiosc · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Andreu · Barcelona', coords:[2.204685, 41.454113],
    osm:{ id:1295287999, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1319, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-003', name:'Quiosc · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Andreu · Barcelona', coords:[2.206464, 41.455401],
    osm:{ id:1295288018, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:838, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-004', name:'Oliva Negra · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sarrià-Sant Gervasi · Barcelona', coords:[2.140973, 41.419423],
    osm:{ id:1337087573, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:893, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-005', name:'Quiosc Albert Collado · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Gràcia · Barcelona', coords:[2.163030, 41.405239],
    osm:{ id:1340330367, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1187, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-006', name:'Quiosc Revolució · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Gràcia · Barcelona', coords:[2.158286, 41.402464],
    osm:{ id:1377259231, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1051, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-007', name:'ONCE · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sants-Montjuïc · Barcelona', coords:[2.149624, 41.375841],
    osm:{ id:1719727427, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1247, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-008', name:'ONCE · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.170465, 41.375047],
    osm:{ id:1720689749, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1069, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-009', name:'El Periódico · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.145932, 41.389913],
    osm:{ id:1982848387, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1207, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-010', name:'Lizarran · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.176668, 41.376813],
    osm:{ id:2971983669, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:989, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-011', name:'Lizarran · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.174706, 41.379447],
    osm:{ id:2971984400, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1220, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-012', name:'El periodico · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.189196, 41.418784],
    osm:{ id:3023471034, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:854, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-013', name:'Quiosc de Clot · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.188411, 41.407888],
    osm:{ id:3049368238, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1058, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-014', name:'Estanco · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Avinguda de Sant Ildefons · Les Corts · Barcelona', coords:[2.083256, 41.363556],
    osm:{ id:3101140800, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1120, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-015', name:'El Periódico · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Les Corts · Barcelona', coords:[2.099244, 41.359443],
    osm:{ id:3189340717, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1037, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-016', name:'News & Coffee · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Gràcia · Barcelona', coords:[2.157333, 41.400264],
    osm:{ id:3350101407, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1227, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-017', name:'El Teu Estanc · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Andreu · Barcelona', coords:[2.203572, 41.424503],
    osm:{ id:3551790521, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:841, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-018', name:'GoodNews · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.180810, 41.399180],
    osm:{ id:3677285556, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:876, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-019', name:'kiosco · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Horta-Guinardó · Barcelona', coords:[2.174718, 41.416074],
    osm:{ id:3740059069, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:889, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-020', name:'Quiosc · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Plaça del setge de 1714 · Ciutat Vella · Barcelona', coords:[2.161032, 41.374154],
    osm:{ id:3989751803, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1123, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-021', name:'Quiosc Jordi · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sarrià-Sant Gervasi · Barcelona', coords:[2.140098, 41.412223],
    osm:{ id:4461836384, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1204, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-022', name:'Divers · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sants-Montjuïc · Barcelona', coords:[2.140593, 41.379565],
    osm:{ id:4551545577, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:897, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-023', name:'Zurich · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sarrià-Sant Gervasi · Barcelona', coords:[2.126879, 41.403131],
    osm:{ id:4677239988, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1308, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-024', name:'Quiosc · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Pujades 269 · Sant Martí · Barcelona', coords:[2.205227, 41.405265],
    osm:{ id:4754484240, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1060, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-025', name:'GoodNews · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.189001, 41.403381],
    osm:{ id:4878130692, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1012, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-026', name:'The Rocks · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Gràcia · Barcelona', coords:[2.153561, 41.398602],
    osm:{ id:5485537044, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:864, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-027', name:'Maite · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Gràcia · Barcelona', coords:[2.151949, 41.399940],
    osm:{ id:5485540752, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1072, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-028', name:'Good News · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.159736, 41.396025],
    osm:{ id:5505229612, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:932, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-029', name:'La Vanguardia · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.173744, 41.385200],
    osm:{ id:5505293929, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1249, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-030', name:'¡HOLA! · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.176370, 41.385311],
    osm:{ id:5505299158, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:978, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-031', name:'el Periódico · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.178045, 41.386601],
    osm:{ id:5505302033, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:853, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-032', name:'Kiosc · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.165392, 41.389231],
    osm:{ id:5552089185, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1005, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-033', name:'La vanguardia · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.188142, 41.416145],
    osm:{ id:5958829085, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:905, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-034', name:'La Vanguardia · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.172777, 41.388721],
    osm:{ id:6328115051, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:871, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-035', name:'News & Coffee · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.163162, 41.385822],
    osm:{ id:6341102086, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:906, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-036', name:'Quiosc Kennedy · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sarrià-Sant Gervasi · Barcelona', coords:[2.136863, 41.410023],
    osm:{ id:6356110688, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1008, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-037', name:'La Vanguardia · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.168938, 41.389152],
    osm:{ id:6959731085, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:905, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-038', name:'La Vanguardia · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sarrià-Sant Gervasi · Barcelona', coords:[2.144323, 41.392122],
    osm:{ id:7084932623, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:943, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-039', name:'¡Hola! · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.183467, 41.385347],
    osm:{ id:7091071324, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1144, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-040', name:'Quiosc Miquel · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Andreu · Barcelona', coords:[2.189879, 41.435310],
    osm:{ id:7098029585, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:905, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-041', name:'Quiosco · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Les Corts · Barcelona', coords:[2.125464, 41.391871],
    osm:{ id:7108869688, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1008, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-042', name:'GoodNews · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.163264, 41.378668],
    osm:{ id:7194929487, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1307, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-043', name:'La Vanguardia · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.162244, 41.377736],
    osm:{ id:7194932086, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:906, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-044', name:'News & Coffee · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.178030, 41.392786],
    osm:{ id:8173270417, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1237, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-045', name:'Raconet · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.155121, 41.376418],
    osm:{ id:8263633617, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:937, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-046', name:'Fleuriste · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Les Corts · Barcelona', coords:[2.117604, 41.392213],
    osm:{ id:9778880561, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:881, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-047', name:'News&cofee · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sarrià-Sant Gervasi · Barcelona', coords:[2.145521, 41.393324],
    osm:{ id:9806608517, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:837, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-048', name:'La Vanguardia · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.160981, 41.378503],
    osm:{ id:9981208118, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:938, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-049', name:'Quiosco · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.170220, 41.385492],
    osm:{ id:10202363728, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1048, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-050', name:'El Periódico · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sants-Montjuïc · Barcelona', coords:[2.133378, 41.375505],
    osm:{ id:10766532335, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1155, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-051', name:'El Kiosko Argento · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.154180, 41.382476],
    osm:{ id:11045933505, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:825, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-052', name:'elPeriódico · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.167121, 41.390079],
    osm:{ id:11296034089, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:909, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-053', name:'Quiosc Collblanc · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Les Corts · Barcelona', coords:[2.118656, 41.375824],
    osm:{ id:11414863520, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:840, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-054', name:'Cerruma · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Gràcia · Barcelona', coords:[2.149606, 41.406309],
    osm:{ id:12326979648, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:968, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-055', name:'Quiosco · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.193681, 41.413566],
    osm:{ id:12460699933, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1253, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-056', name:'Estanco núm.8 · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Avinguda de la República Argentina · Les Corts · Barcelona', coords:[2.086479, 41.364497],
    osm:{ id:13110380701, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1021, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-057', name:'El Periódico · premsa', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.205828, 41.402698],
    osm:{ id:13175009107, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:927, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-058', name:'Quiosc de premsa 058', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Andreu · Barcelona', coords:[2.221894, 41.440535],
    osm:{ id:627476105, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:925, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-059', name:'Quiosc de premsa 059', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Andreu · Barcelona', coords:[2.216798, 41.433622],
    osm:{ id:643022130, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:950, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-060', name:'Quiosc de premsa 060', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.170386, 41.385195],
    osm:{ id:691591931, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1251, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-061', name:'Quiosc de premsa 061', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Les Corts · Barcelona', coords:[2.144106, 41.386330],
    osm:{ id:1036551336, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1156, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-062', name:'Quiosc de premsa 062', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.164123, 41.376051],
    osm:{ id:1349448889, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1209, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-063', name:'Quiosc de premsa 063', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.151706, 41.390926],
    osm:{ id:1357512176, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:996, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-064', name:'Quiosc de premsa 064', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Gràcia · Barcelona', coords:[2.173636, 41.403950],
    osm:{ id:1359971665, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:985, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-065', name:'Quiosc de premsa 065', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Carrer de Cartagena 230 · Sant Martí · Barcelona', coords:[2.179960, 41.407043],
    osm:{ id:1359971799, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1119, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-066', name:'Quiosc de premsa 066', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Les Corts · Barcelona', coords:[2.126069, 41.390095],
    osm:{ id:1375281458, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1278, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-067', name:'Quiosc de premsa 067', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Les Corts · Barcelona', coords:[2.120560, 41.389870],
    osm:{ id:1375281459, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1279, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-068', name:'Quiosc de premsa 068', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Gràcia · Barcelona', coords:[2.155255, 41.409729],
    osm:{ id:1483279773, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1093, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-069', name:'Quiosc de premsa 069', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.189162, 41.379779],
    osm:{ id:1597906325, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1145, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-070', name:'Quiosc de premsa 070', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Andreu · Barcelona', coords:[2.212283, 41.450618],
    osm:{ id:1653460474, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1294, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-071', name:'Quiosc de premsa 071', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Andreu · Barcelona', coords:[2.210585, 41.452590],
    osm:{ id:1653635646, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:966, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-072', name:'Quiosc de premsa 072', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Les Corts · Barcelona', coords:[2.118556, 41.375702],
    osm:{ id:1669520648, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:968, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-073', name:'Quiosc de premsa 073', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sants-Montjuïc · Barcelona', coords:[2.146677, 41.377253],
    osm:{ id:1719727385, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1205, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-074', name:'Quiosc de premsa 074', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.205840, 41.423366],
    osm:{ id:1744470937, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1257, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-075', name:'Quiosc de premsa 075', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sants-Montjuïc · Barcelona', coords:[2.152080, 41.366090],
    osm:{ id:1750949537, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:857, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-076', name:'Quiosc de premsa 076', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sants-Montjuïc · Barcelona', coords:[2.142064, 41.381099],
    osm:{ id:1789072031, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:851, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-077', name:'Quiosc de premsa 077', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.187927, 41.385781],
    osm:{ id:1792094615, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:935, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-078', name:'Quiosc de premsa 078', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.156547, 41.392594],
    osm:{ id:1891535388, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1208, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-079', name:'Quiosc de premsa 079', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Eixample · Barcelona', coords:[2.151684, 41.383788],
    osm:{ id:2120121053, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:873, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-080', name:'Quiosc de premsa 080', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.194922, 41.405568],
    osm:{ id:2193095358, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1178, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-081', name:'Quiosc de premsa 081', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Les Corts · Barcelona', coords:[2.119672, 41.374381],
    osm:{ id:2195526819, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1139, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-082', name:'Quiosc de premsa 082', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Les Corts · Barcelona', coords:[2.119406, 41.374725],
    osm:{ id:2195526822, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1142, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-083', name:'Quiosc de premsa 083', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.191553, 41.386431],
    osm:{ id:2502069938, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1258, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-084', name:'Quiosc de premsa 084', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.183425, 41.399448],
    osm:{ id:2576974233, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1053, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-085', name:'Quiosc de premsa 085', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Les Corts · Barcelona', coords:[2.082709, 41.360252],
    osm:{ id:2693808394, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1214, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-086', name:'Quiosc de premsa 086', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Les Corts · Barcelona', coords:[2.083411, 41.374209],
    osm:{ id:2850584260, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1080, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-087', name:'Quiosc de premsa 087', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Ciutat Vella · Barcelona', coords:[2.173815, 41.380534],
    osm:{ id:2971983665, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:985, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-088', name:'Quiosc de premsa 088', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.197467, 41.415428],
    osm:{ id:3005490282, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1102, cpm:'€8', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-089', name:'Quiosc de premsa 089', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.196679, 41.414779],
    osm:{ id:3005490283, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1103, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-090', name:'Quiosc de premsa 090', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Andreu · Barcelona', coords:[2.184950, 41.422006],
    osm:{ id:3009202716, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1036, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-091', name:'Quiosc de premsa 091', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Horta-Guinardó · Barcelona', coords:[2.180910, 41.420548],
    osm:{ id:3010453265, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1085, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-092', name:'Quiosc de premsa 092', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.198701, 41.411635],
    osm:{ id:3032894933, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1253, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-093', name:'Quiosc de premsa 093', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.197200, 41.412832],
    osm:{ id:3032894935, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1255, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-094', name:'Quiosc de premsa 094', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.202620, 41.399786],
    osm:{ id:3048076134, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:954, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-095', name:'Quiosc de premsa 095', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.199062, 41.404574],
    osm:{ id:3048076838, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1158, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-096', name:'Quiosc de premsa 096', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.203768, 41.398914],
    osm:{ id:3048077144, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:964, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-097', name:'Quiosc de premsa 097', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Martí · Barcelona', coords:[2.200600, 41.401390],
    osm:{ id:3048078236, shop:'newsagent' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1056, cpm:'€7', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-098', name:'Quiosc de premsa 098', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Andreu · Barcelona', coords:[2.216890, 41.437688],
    osm:{ id:3159283750, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1070, cpm:'€6', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-099', name:'Quiosc de premsa 099', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sant Andreu · Barcelona', coords:[2.225574, 41.438806],
    osm:{ id:3192186799, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1119, cpm:'€10', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'bcn-kiosk-100', name:'Quiosc de premsa 100', kind:'Quiosco de prensa · DOOH exterior',
    addr:'Sants-Montjuïc · Barcelona', coords:[2.135954, 41.375593],
    osm:{ id:3240091263, shop:'kiosk' },
    surfaces:[
      { name:'Pantalla exterior vertical', desc:'DOOH exterior lateral · 1080×1920 · prensa + publicidad programática', status:'live', impr:1083, cpm:'€9', surface:'pantalla' },
    ],
    segmentation:{ required:false, schedule:{ start:'08:00', end:'22:00' }, typologies:['exterior'], genders:['hombre','mujer'], ages:['joven','adulto','senior'], timeSlots:['manana','mediodia','tarde','noche'] },
  },
  {
    id:'xtanco-bcn', name:'Xtanco Barcelona', kind:'Estanco · Retail físico · Gemelo digital',
    addr:'Portal de l\'Àngel 20 · Barcelona 08002', coords:[2.1730, 41.3863],
    employees:[
      { name:'Marta', role:'cajero',    since:'2024-09-02T09:00:00.000Z' },
      { name:'Jordi', role:'repositor', since:'2025-03-15T10:30:00.000Z' },
      { name:'Núria', role:'azafata',   since:'2025-11-20T11:00:00.000Z' },
      { name:'Pau',   role:'manager',   since:'2026-01-10T08:30:00.000Z' },
    ],
    music:'lounge', cameras:true,
    surfaces:[
      { name:'LED Frontal',       desc:'Pantalla principal sobre el mostrador · 1920×1080',  status:'live', impr:680, cpm:'€8', surface:'pantalla' },
      { name:'LED Vertical',      desc:'Display lateral del producto destacado · 1080×1920',  status:'live', impr:410, cpm:'€7', surface:'pantalla' },
      { name:'Escaparate Gràcia', desc:'Visible desde Passeig de Gràcia · alto tráfico',      status:'live', impr:520, cpm:'€9', surface:'escaparate' },
      { name:'Mostrador panel',   desc:'Panel táctil del mostrador · interacción cliente',    status:'live', impr:120, cpm:'€4', surface:'mostrador' },
      { name:'PWA Xtanco Club',   desc:'Notificaciones push a socios cercanos',               status:'live', impr:160, cpm:'€2', surface:'pwa' },
    ],
  },
  {
    id:'xtanco', name:'Xtanco', kind:'Estanco · Retail físico',
    addr:'Calle de Santa Rosa 4 · Madrid', coords:[-3.7283, 40.4036],
    surfaces:[
      { name:'LED Frontal',          desc:'Pantalla principal sobre el mostrador · 1920×1080 · 24h', status:'live',  impr:540, cpm:'€8',  surface:'pantalla', pixerScreens:['xtore-lg8qao','xtore-07313n'] },
      { name:'LED Vertical',         desc:'Display lateral del producto destacado · 1080×1920',      status:'live',  impr:380, cpm:'€6',  surface:'pantalla' },
      { name:'Escaparate exterior',  desc:'LED en la fachada visible desde la calle · noche',        status:'sched', impr:210, cpm:'€5',  surface:'escaparate' },
      { name:'Mostrador panel',      desc:'Panel táctil del mostrador · interacción cliente',        status:'live',  impr:90,  cpm:'€4',  surface:'mostrador' },
      { name:'Vending / cigarreras', desc:'Display digital del vending · loop comercial',            status:'idle',  impr:60,  cpm:'€3',  surface:'vending' },
      { name:'PWA Xtanco Club',      desc:'Notificaciones push y cards en la app del Club',          status:'live',  impr:140, cpm:'€2',  surface:'pwa' },
    ],
  },
  {
    id:'admira-loterias', name:'Admira Loterías', kind:'Loterías · Punto autorizado',
    addr:'Gran Vía 32 · Madrid', coords:[-3.7037, 40.4204],
    surfaces:[
      { name:'LED jackpot',     desc:'Bote del Euromillones en pantalla principal · 1920×1080',   status:'live',  impr:820, cpm:'€9', surface:'pantalla' },
      { name:'Escaparate digital', desc:'Animación del último ganador · visible 24h',              status:'live',  impr:340, cpm:'€6', surface:'escaparate' },
      { name:'Boletos kiosk',   desc:'Kiosko táctil de venta · vertical 1080×1920',                status:'sched', impr:120, cpm:'€4', surface:'mostrador' },
      { name:'PWA Admira Win',  desc:'Notificación push tras décimo comprado',                    status:'live',  impr:200, cpm:'€3', surface:'pwa' },
    ],
  },
  {
    id:'admira-vapeo', name:'Admira Vapeo', kind:'Vapeo · Retail especializado',
    addr:'Calle Fuencarral 88 · Madrid', coords:[-3.6997, 40.4279],
    surfaces:[
      { name:'LED catálogo',           desc:'Carrusel de sabores en pantalla principal',          status:'live',  impr:420, cpm:'€6', surface:'pantalla' },
      { name:'Escaparate animado',     desc:'Loop nocturno con humo + colores',                   status:'sched', impr:160, cpm:'€4', surface:'escaparate' },
      { name:'Vending de e-líquidos',  desc:'8 tubos · cada uno con su panel digital',            status:'live',  impr:75,  cpm:'€3', surface:'vending' },
    ],
  },
  {
    id:'admira-prensa', name:'Admira Prensa', kind:'Quiosco · Retail físico',
    addr:'Plaza de Cibeles · Madrid', coords:[-3.6927, 40.4196],
    surfaces:[
      { name:'LED titulares',     desc:'Resumen prensa diaria · cabeceras rotando · 1920×1080', status:'live',  impr:1200, cpm:'€7', surface:'pantalla' },
      { name:'Mostrador revista', desc:'Panel táctil con portadas + compra rápida',             status:'live',  impr:180,  cpm:'€4', surface:'mostrador' },
      { name:'Escaparate noche',  desc:'LED de la portada del día siguiente desde 22h',         status:'sched', impr:280,  cpm:'€5', surface:'escaparate' },
      { name:'PWA Admira Press',  desc:'Edición digital del día con anuncios contextuales',     status:'live',  impr:90,   cpm:'€3', surface:'pwa' },
    ],
  },
  {
    id:'admira-bcn', name:'Admira BCN', kind:'Estanco · Retail físico',
    addr:'Passeig de Gràcia 45 · Barcelona', coords:[2.1654, 41.3925],
    surfaces:[
      { name:'LED Frontal',       desc:'Pantalla principal · catalán/castellano/inglés',  status:'live',  impr:680, cpm:'€8', surface:'pantalla' },
      { name:'LED Vertical',      desc:'Display lateral · turistas + locales',            status:'live',  impr:410, cpm:'€7', surface:'pantalla' },
      { name:'Escaparate Gràcia', desc:'Visible desde Passeig de Gràcia · alto tráfico',  status:'live',  impr:520, cpm:'€9', surface:'escaparate' },
      { name:'Vending tabaco',    desc:'Panel digital del vending exterior',              status:'idle',  impr:50,  cpm:'€3', surface:'vending' },
      { name:'PWA Admira Club',   desc:'Push contextual a socios cercanos',               status:'live',  impr:160, cpm:'€2', surface:'pwa' },
    ],
  },
  {
    id:'super-santa-rosa', name:'Súper Santa Rosa', kind:'Supermercado · Retail físico',
    addr:'Carrer de Santa Rosa 4 · Barcelona 08012', coords:[2.1583, 41.4061],
    surfaces:[
      { name:'LED cabeceras góndola',         desc:'4 cabeceras digitales en pasillos · 1080×1920 vertical',           status:'live',  impr:920, cpm:'€7', surface:'pantalla' },
      { name:'LED checkout',                  desc:'Pantallas sobre las 6 cajas · cola + impulso de última hora',      status:'live',  impr:780, cpm:'€8', surface:'pantalla' },
      { name:'Estantería ePaper lácteos',     desc:'8 etiquetas digitales con precio dinámico + microspot 3s',         status:'sched', impr:240, cpm:'€4', surface:'mostrador' },
      { name:'Escaparate refrigerado',        desc:'LED transparente sobre puerta de frescos · audiencia atrapada',    status:'live',  impr:360, cpm:'€6', surface:'escaparate' },
      { name:'Carro con tablet',              desc:'30 carros con tablet 10" · contextual por pasillo',                status:'idle',  impr:120, cpm:'€3', surface:'mostrador' },
      { name:'Vending de bebidas',            desc:'Panel digital del vending exterior · cervezas y refrescos',         status:'sched', impr:80,  cpm:'€3', surface:'vending' },
      { name:'PWA Súper Club',                desc:'Push contextual a socios cercanos · ofertas por hora del día',      status:'live',  impr:260, cpm:'€2', surface:'pwa' },
    ],
  },
];

// Seed oficial del nuevo circuito Desigual. La cifra corporativa actual es
// +215 stores y presencia en 107 paises; este bloque solo siembra puntos
// reales del store locator hasta que el importador publique el catálogo
// completo al KV.
window.OMNIP_LOCATIONS_EXTRA = [
  {
    // Gemelo digital Desigual Ginza (Tokio) — al pulsar el punto abre el tour Matterport.
    id:'desigual-ginza-tokyo', name:'Desigual Ginza', kind:'Desigual · Tienda oficial',
    addr:'Chūō-dōri, 銀座七丁目 · Ginza · Chūō, Tokio · 104-0061 · Japón', coords:[139.7627166, 35.6692638],
    music:'fashion', cameras:true,
    external:{brand:'Desigual', storeId:'GINZA', type:'official', source:'manual'},
    twin:'https://my.matterport.com/show/?m=PW85KvR2coC',
    twinOnClick:true,
    surfaces:desigualSurfaces('official'),
  },
  {
    id:'desigual-r509', name:'Desigual Barcelona Plaza Catalunya', kind:'Desigual · Tienda oficial',
    addr:'Plaça Catalunya, 9 · Barcelona · 08002 · Barcelona · Spain', coords:[2.168902, 41.3877],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R509', type:'official', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('official'),
  },
  {
    id:'desigual-r016', name:'Desigual Born', kind:'Desigual · Tienda oficial',
    addr:'Calle Argenteria, 65 · Barcelona · 08003 · Barcelona · Spain', coords:[2.181271, 41.383613],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R016', type:'official', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('official'),
  },
  {
    id:'desigual-r380', name:'Desigual Barceloneta Beach', kind:'Desigual · Tienda oficial',
    addr:'Passeig Mare Nostrum, 15 · Barcelona · 08039 · Barcelona · Spain', coords:[2.189, 41.369],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R380', type:'official', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('official'),
  },
  {
    id:'desigual-r033', name:'Desigual CC Maremagnum II', kind:'Desigual · Tienda oficial',
    addr:'CC Maremagnum, Loc 104 · Barcelona · 08039 · Barcelona · Spain', coords:[2.182866, 41.375195],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R033', type:'official', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('official'),
  },
  {
    id:'desigual-r135', name:'Desigual CC Las Arenas', kind:'Desigual · Tienda oficial',
    addr:'CC Las Arenas, Plaza de España S/N, Loc P14 · Barcelona · 08014 · Barcelona · Spain', coords:[2.149315, 41.376057],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R135', type:'official', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('official'),
  },
  {
    id:'desigual-r747', name:'Desigual CC La Maquinista', kind:'Desigual · Tienda oficial',
    addr:'CC La Maquinista, Paseo de Potosi 2, Loc B-037 · Barcelona · 08030 · Barcelona · Spain', coords:[2.198741, 41.441097],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R747', type:'official', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('official'),
  },
  {
    id:'desigual-r133', name:'Desigual Aeropuerto El Prat T1', kind:'Desigual · Tienda oficial',
    addr:'Aeropuerto El Prat, Terminal 1, Loc 67-68 · El Aeroport del Prat · 08820 · Barcelona · Spain', coords:[2.074927, 41.289802],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R133', type:'official', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('official'),
  },
  {
    id:'desigual-r420', name:'Desigual CC Tarragona Parc Central', kind:'Desigual · Tienda oficial',
    addr:'CC Tarragona Parc Central, Avenida Vidal i Barraquer, 15-17 · Tarragona · 43005 · Tarragona · Spain', coords:[1.239, 41.117],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R420', type:'official', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('official'),
  },
  {
    id:'desigual-r064', name:'Desigual Preciados', kind:'Desigual · Outlet',
    addr:'Calle Preciados, 25 · Madrid · 28013 · Madrid · Spain', coords:[-3.70574, 40.419481],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R064', type:'outlet', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('outlet'),
  },
  {
    id:'desigual-r019', name:'Desigual Fuencarral', kind:'Desigual · Tienda oficial',
    addr:'Calle Fuencarral, 36-38 · Madrid · 28004 · Madrid · Spain', coords:[-3.700674, 40.422684],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R019', type:'official', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('official'),
  },
  {
    id:'desigual-r751', name:'Desigual Aeropuerto Madrid-Barajas T4', kind:'Desigual · Tienda oficial',
    addr:'Aeropuerto Adolfo Suarez Madrid-Barajas T4, Loc T4001DE41 · Madrid · 28042 · Madrid · Spain', coords:[-3.5909464194832768, 40.4911822780647],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R751', type:'official', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('official'),
  },
  {
    id:'desigual-r018', name:'Desigual Outlet Factory Getafe', kind:'Desigual · Outlet',
    addr:'CC Factory Getafe, Av. Río Guadalquivir 15, Loc 13 Bis · Getafe · 28906 · Madrid · Spain', coords:[-3.694165, 40.272652],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R018', type:'outlet', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('outlet'),
  },
  {
    id:'desigual-r132', name:'Desigual Outlet CC Factory SSRR', kind:'Desigual · Outlet',
    addr:'CC Factory San Sebastian de los Reyes, Salvador de Madariaga SN · San Sebastián de los Reyes · 28700 · Madrid · Spain', coords:[-3.608584, 40.567128],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R132', type:'outlet', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('outlet'),
  },
  {
    id:'desigual-r136', name:'Desigual Outlet Factory Las Rozas', kind:'Desigual · Outlet',
    addr:'CC Factory Las Rozas, Calle Pablo Neruda SN · Las Rozas de Madrid · 28232 · Madrid · Spain', coords:[-3.889741, 40.517467],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R136', type:'outlet', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('outlet'),
  },
  {
    id:'desigual-r732', name:'Desigual Madrid Oasiz', kind:'Desigual · Outlet',
    addr:'CC Madrid Oasiz, Avenida Premios Nobel, 3 · Torrejón de Ardoz · 28850 · Madrid · Spain', coords:[-3.44378471, 40.47230189],
    music:'fashion', cameras:true, external:{brand:'Desigual', storeId:'R732', type:'outlet', source:'desigual-store-locator'},
    surfaces:desigualSurfaces('outlet'),
  },
];

window.mergeOmnipLocations = function(base, extra) {
  const out = window.normalizeOmnipLocations(base);
  const seen = new Set(out.map(l => l && l.id).filter(Boolean));
  const addon = window.normalizeOmnipLocations(Array.isArray(extra) ? extra : window.OMNIP_LOCATIONS_EXTRA);
  (addon || []).forEach(loc => {
    if (!loc || !loc.id || seen.has(loc.id)) return;
    out.push(loc);
    seen.add(loc.id);
  });
  return out;
};

// Sync: localStorage → bundled default. Sin red. Para arranque inmediato.
window.loadOmnipLocations = function() {
  try {
    const raw = localStorage.getItem(window.OMNIP_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return window.mergeOmnipLocations(parsed);
    }
  } catch (e) {}
  return window.mergeOmnipLocations(window.OMNIP_LOCATIONS_DEFAULT);
};

// Async: worker KV → cachea en localStorage → fallback a sync. Devuelve
// también un flag `source` para que la UI pueda mostrar de dónde viene.
window.loadOmnipLocationsAsync = async function(timeoutMs = 4000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(window.OMNIP_API + '/locations', {signal: ctrl.signal, cache: 'no-store'});
    clearTimeout(t);
    if (!r.ok) throw new Error('http ' + r.status);
    const d = await r.json();
    if (d && Array.isArray(d.locations) && d.locations.length) {
      const merged = window.mergeOmnipLocations(d.locations);
      try { localStorage.setItem(window.OMNIP_STORE_KEY, JSON.stringify(merged)); } catch {}
      return { locations: merged, source: d.source || 'kv', updatedAt: d.updatedAt || null };
    }
  } catch (e) { /* offline / worker dormido / timeout */ }
  return { locations: window.loadOmnipLocations(), source: 'local', updatedAt: null };
};

// Guarda en localStorage (cache local del backoffice). NO publica.
window.saveOmnipLocations = function(arr) {
  try {
    localStorage.setItem(window.OMNIP_STORE_KEY, JSON.stringify(window.normalizeOmnipLocations(arr)));
    return true;
  } catch (e) { return false; }
};

// Publica al worker (PUT /locations con Bearer token). Lanza si falla.
window.publishOmnipLocations = async function(arr, token) {
  const normalized = window.normalizeOmnipLocations(arr);
  if (!Array.isArray(normalized) || !normalized.length) throw new Error('empty_array');
  if (!token) throw new Error('missing_token');
  const r = await fetch(window.OMNIP_API + '/locations', {
    method: 'PUT',
    headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ locations: normalized }),
  });
  let d = null; try { d = await r.json(); } catch {}
  if (!r.ok) throw new Error((d && d.error) || ('http ' + r.status));
  return d;
};
