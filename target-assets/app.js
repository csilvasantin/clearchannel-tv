const page = document.body.dataset.page;

const LANG_KEY = "omnip-lang";
let LANG = (() => {
  try {
    return localStorage.getItem(LANG_KEY) === "es" ? "es" : "en";
  } catch (_) {
    return "en";
  }
})();

let formatter;
let currency;
let currencyDetailed;

const copy = {
  en: {
    "aria.search": "Search Xpacio",
    "aria.mode": "Change data mode",
    "aria.export": "Export model",
    "aria.leftRail": "Xpacio settings",
    "aria.modelStatus": "Model status",
    "aria.kpis": "Main indicators",
    "aria.tabs": "Target sections",
    "aria.chart": "Hourly traffic chart",
    "aria.segmentBalance": "Segment balance",
    "aria.simulationControls": "Campaign parameters",
    "aria.simulationResult": "Simulation result",
    "aria.tutorialNav": "Tutorial navigation",
    publish: "Publish to Admira",
    tutorial: "Tutorial",
    openBackoffice: "Open backoffice",
    circuit: "Circuit",
    activeXpacio: "Active Xpacio",
    range: "Range",
    from: "From",
    to: "To",
    mode: "Mode",
    liveBidding: "Bidding live",
    simulated: "Simulated",
    observed: "Observed",
    comparison: "Comparison",
    modelEyebrow: "Target model · v1",
    modelTitle: "Sellable audience by hour, profile, and surface",
    modelStatus: "Simulated model",
    lastSync: "Admira sync 09:42",
    peopleDay: "People/day",
    peakHour: "Peak hour",
    impressions: "Impressions",
    usefulAudience: "Useful audience",
    recommendedCpm: "Recommended CPM",
    potentialRevenue: "Potential revenue",
    baseline: "baseline",
    baselineUp: "+12% vs baseline",
    baselineAdjusted: "adjusted baseline",
    totalTraffic: "total traffic",
    activeTarget: "active target",
    matchesFilters: "matches filters",
    byDemand: "by demand",
    weeklyCampaign: "weekly campaign",
    traffic: "Traffic",
    segments: "Segments",
    inventory: "Inventory",
    simulation: "Simulation",
    rules: "Rules",
    peopleByHour: "People per hour",
    trafficTitle: "Editable exterior and interior footfall curve",
    generateCurve: "Generate curve",
    saturdayTemplate: "Saturday template",
    dailyDistribution: "Daily distribution",
    people: "people",
    hour: "Hour",
    exteriorPeople: "Exterior people/h",
    interiorPeople: "Interior people/h",
    total: "Total",
    source: "Source",
    confidence: "Confidence",
    audienceType: "Audience typology",
    segmentMix: "Aggregated and probabilistic segment mix",
    balance: "balance",
    segment: "Segment",
    audiencePct: "% audience",
    visibleSurfaces: "Sellable surfaces",
    inventoryTitle: "Visible inventory for physical programmatic",
    calibrateVisibility: "Calibrate visibility",
    type: "Type",
    visibility: "Visibility",
    dayImpressions: "Imp/day",
    status: "Status",
    commercialSimulation: "Commercial simulation",
    simulationTitle: "Campaign value on the active target",
    reserveInventory: "Reserve inventory",
    targetCpm: "Target CPM",
    durationDays: "Duration days",
    maxFrequency: "Max frequency/h",
    reachableAudience: "Reachable audience",
    sellableImpressions: "Sellable impressions",
    campaignValue: "Campaign value",
    targetCoverage: "Target coverage",
    segmentedPlayback: "Segmented playback",
    rulesTitle: "Rules XpaceOS can execute",
    addRule: "Add rule",
    buyByCircuit: "Buy by circuit",
    campaignTarget: "Campaign target",
    circuitScope: "Circuit scope",
    scopeGlobal: "Global",
    scopeNational: "National",
    scopeCity: "City",
    scopeLocal: "Local",
    circuitDesigual: "Global Desigual Circuit",
    circuitXtanco: "National Xtanco Circuit",
    circuitMetro: "Barcelona Metro City Circuit",
    circuitLocalAll: "All local registered points",
    wholeCircuit: "Whole circuit",
    target: "Target",
    adPlacement: "Ad placement",
    exterior: "Exterior",
    exteriorDesc: "Window, door, and entrance",
    interior: "Interior",
    interiorDesc: "Metahuman, screen, and vending",
    gender: "Gender",
    maleDesc: "Male audience",
    femaleDesc: "Female audience",
    age: "Age",
    timeSlot: "Time slot",
    metadata: "Metadata",
    income: "Economic capacity",
    phoneType: "Phone type",
    all: "All",
    medium: "Medium",
    high: "High",
    premium: "Premium",
    likelyIos: "Likely iOS",
    likelyAndroid: "Likely Android",
    likelyPremium: "Likely high-end",
    sourceManual: "manual",
    sourceEstimated: "estimated",
    sourceObserved: "observed",
    sourceHistorical: "historical",
    sourceTemplate: "template",
    confidenceHigh: "high",
    confidenceMedium: "medium",
    confidenceLow: "low",
    zoneExterior: "exterior",
    zoneInterior: "interior",
    surfaceWindow: "LED window",
    surfaceDoor: "Xtanco door",
    surfaceMetahuman: "Metahuman screen",
    surfaceVending: "Vending display",
    surfaceTypeWindow: "Window",
    surfaceTypeEntrance: "Entrance",
    surfaceTypeScreen: "Screen",
    surfaceTypeDisplay: "Display",
    active: "active",
    scheduled: "scheduled",
    draft: "draft",
    ruleCoffee: "Morning coffee",
    ruleCoffeeText: "IF zone = exterior AND time = 08:00-12:00 AND target contains Adult 30-50 THEN play Morning coffee",
    ruleRetail: "Retail midday",
    ruleRetailText: "IF surface = LED window AND slot = Midday THEN rotate Retail lunch campaign with max frequency 6/h",
    ruleActiveTarget: "Active target",
    ruleActiveTargetText: "IF target coverage = {coverage}% AND placement selected THEN activate content with frequency {frequency}/h",
    toastGenerated: "Automatic curve generated with commercial baseline",
    toastSaturday: "Saturday template applied",
    toastCalibrated: "Visibility recalibrated on active surfaces",
    toastReserved: "Inventory reserved as proposal draft",
    toastRule: "Rule created as draft",
    toastPublished: "Model published as Admira-ready payload",
    toastExported: "Model JSON copied to clipboard",
    toastMode: "{mode} mode active",
    tutorialFlow: "Flow",
    tutorialMetrics: "Metrics",
    tutorialPrivacy: "Privacy",
    tutorialIntroEyebrow: "admira.app/tutorial",
    tutorialTitle: "Configure Target Model and turn footfall into sellable inventory",
    tutorialIntro:
      "This tutorial guides daily operations: define people per hour, adjust segments, calibrate surfaces, and publish playback rules for segmented campaigns.",
    tutorialCaption: "Target Model backoffice · operating view",
    operationalFlow: "Operating flow",
    sixSteps: "Six steps to publish a target",
    keyMetrics: "Key metrics",
    metricsTitle: "What to check before selling a campaign",
    peopleHour: "People/hour",
    peopleHourText: "The digital twin's base volume. Each hour can have a manual, estimated, or observed source.",
    usefulAudienceText: "Percentage of traffic matching placement, age, gender, time slot, and selected metadata.",
    impressionsText: "Reachable people multiplied by visibility, dwell time, and maximum frequency per surface.",
    revenue: "Revenue",
    revenueText: "Commercial value calculated from CPM, campaign days, and active-target coverage.",
    privacyDesign: "Privacy by design",
    privacyTitle: "Always work with aggregated data",
    privacyText:
      "Target Model should store counts, percentages, and estimates. It should not create personal profiles or use sensitive data to identify individuals. If cameras, sensors, or device signals are connected, the operating output must be aggregated and auditable.",
    step: "Step",
  },
  es: {
    "aria.search": "Buscar Xpacio",
    "aria.mode": "Cambiar modo de datos",
    "aria.export": "Exportar modelo",
    "aria.leftRail": "Configuracion del Xpacio",
    "aria.modelStatus": "Estado del modelo",
    "aria.kpis": "Indicadores principales",
    "aria.tabs": "Secciones Target",
    "aria.chart": "Grafico de trafico por hora",
    "aria.segmentBalance": "Balance de segmentos",
    "aria.simulationControls": "Parametros de campana",
    "aria.simulationResult": "Resultado de simulacion",
    "aria.tutorialNav": "Navegacion tutorial",
    publish: "Publicar en Admira",
    tutorial: "Tutorial",
    openBackoffice: "Abrir backoffice",
    circuit: "Circuito",
    activeXpacio: "Xpacio activo",
    range: "Rango",
    from: "Desde",
    to: "Hasta",
    mode: "Modo",
    liveBidding: "Bidding live",
    simulated: "Simulado",
    observed: "Observado",
    comparison: "Comparativo",
    modelEyebrow: "Target model · v1",
    modelTitle: "Audiencia vendible por hora, perfil y superficie",
    modelStatus: "Modelo simulado",
    lastSync: "Sync Admira 09:42",
    peopleDay: "Personas/dia",
    peakHour: "Hora pico",
    impressions: "Impresiones",
    usefulAudience: "Audiencia util",
    recommendedCpm: "CPM recomendado",
    potentialRevenue: "Revenue potencial",
    baseline: "baseline",
    baselineUp: "+12% vs baseline",
    baselineAdjusted: "baseline ajustado",
    totalTraffic: "trafico total",
    activeTarget: "target activo",
    matchesFilters: "coincide con filtros",
    byDemand: "segun demanda",
    weeklyCampaign: "campana semanal",
    traffic: "Trafico",
    segments: "Segmentos",
    inventory: "Inventario",
    simulation: "Simulacion",
    rules: "Reglas",
    peopleByHour: "Personas por hora",
    trafficTitle: "Curva editable de paso exterior e interior",
    generateCurve: "Generar curva",
    saturdayTemplate: "Plantilla sabado",
    dailyDistribution: "Distribucion diaria",
    people: "personas",
    hour: "Hora",
    exteriorPeople: "Exterior pers/h",
    interiorPeople: "Interior pers/h",
    total: "Total",
    source: "Fuente",
    confidence: "Confianza",
    audienceType: "Tipologia de audiencia",
    segmentMix: "Mix de segmentos agregado y probabilistico",
    balance: "balance",
    segment: "Segmento",
    audiencePct: "% audiencia",
    visibleSurfaces: "Surfaces vendibles",
    inventoryTitle: "Inventario visible para programatica fisica",
    calibrateVisibility: "Calibrar visibilidad",
    type: "Tipo",
    visibility: "Visibilidad",
    dayImpressions: "Imp/dia",
    status: "Estado",
    commercialSimulation: "Simulacion comercial",
    simulationTitle: "Valor de campana sobre el target activo",
    reserveInventory: "Reservar inventario",
    targetCpm: "CPM objetivo",
    durationDays: "Duracion dias",
    maxFrequency: "Frecuencia max/h",
    reachableAudience: "Audiencia alcanzable",
    sellableImpressions: "Impresiones servibles",
    campaignValue: "Valor campana",
    targetCoverage: "Cobertura target",
    segmentedPlayback: "Reproduccion segmentada",
    rulesTitle: "Reglas que XpaceOS puede ejecutar",
    addRule: "Anadir regla",
    buyByCircuit: "Buy by circuit",
    campaignTarget: "Campaign target",
    circuitScope: "Alcance del circuito",
    scopeGlobal: "Global",
    scopeNational: "Nacional",
    scopeCity: "Ciudad",
    scopeLocal: "Local",
    circuitDesigual: "Circuito Desigual Global",
    circuitXtanco: "Circuito Xtanco Nacional",
    circuitMetro: "Circuito Metro Barcelona Ciudad",
    circuitLocalAll: "Todos los puntos locales",
    wholeCircuit: "Whole circuit",
    target: "Target",
    adPlacement: "Ad placement",
    exterior: "Exterior",
    exteriorDesc: "Escaparate, puerta y entrada",
    interior: "Interior",
    interiorDesc: "Metahuman, pantalla y vending",
    gender: "Genero",
    maleDesc: "Audiencia masculina",
    femaleDesc: "Audiencia femenina",
    age: "Edad",
    timeSlot: "Time slot",
    metadata: "Metadata",
    income: "Capacidad economica",
    phoneType: "Tipo de telefono",
    all: "Todas",
    medium: "Media",
    high: "Alta",
    premium: "Premium",
    likelyIos: "iOS probable",
    likelyAndroid: "Android probable",
    likelyPremium: "Gama alta probable",
    sourceManual: "manual",
    sourceEstimated: "estimado",
    sourceObserved: "observado",
    sourceHistorical: "historico",
    sourceTemplate: "plantilla",
    confidenceHigh: "alta",
    confidenceMedium: "media",
    confidenceLow: "baja",
    zoneExterior: "exterior",
    zoneInterior: "interior",
    surfaceWindow: "Escaparate LED",
    surfaceDoor: "Puerta Xtanco",
    surfaceMetahuman: "Metahuman screen",
    surfaceVending: "Vending display",
    surfaceTypeWindow: "Window",
    surfaceTypeEntrance: "Entrance",
    surfaceTypeScreen: "Screen",
    surfaceTypeDisplay: "Display",
    active: "activo",
    scheduled: "programada",
    draft: "borrador",
    ruleCoffee: "Cafe manana",
    ruleCoffeeText: "SI zona = exterior Y hora = 08:00-12:00 Y target contiene Adult 30-50 ENTONCES reproducir Cafe manana",
    ruleRetail: "Retail mediodia",
    ruleRetailText: "SI surface = Escaparate LED Y franja = Midday ENTONCES alternar campana Retail lunch con frecuencia max 6/h",
    ruleActiveTarget: "Target activo",
    ruleActiveTargetText: "SI cobertura target = {coverage}% Y placement seleccionado ENTONCES activar contenido con frecuencia {frequency}/h",
    toastGenerated: "Curva automatica generada con baseline comercial",
    toastSaturday: "Plantilla sabado aplicada",
    toastCalibrated: "Visibilidad recalibrada en surfaces activas",
    toastReserved: "Inventario reservado como borrador de propuesta",
    toastRule: "Regla creada en borrador",
    toastPublished: "Modelo publicado como payload listo para Admira",
    toastExported: "JSON del modelo copiado al portapapeles",
    toastMode: "Modo {mode} activo",
    tutorialFlow: "Flujo",
    tutorialMetrics: "Metricas",
    tutorialPrivacy: "Privacidad",
    tutorialIntroEyebrow: "admira.app/tutorial",
    tutorialTitle: "Configura Target Model y convierte paso de personas en inventario vendible",
    tutorialIntro:
      "Este tutorial guia la operacion diaria: definir personas por hora, ajustar segmentos, calibrar surfaces y publicar reglas de reproduccion para campanas segmentadas.",
    tutorialCaption: "Backoffice Target Model · vista operativa",
    operationalFlow: "Flujo operativo",
    sixSteps: "Seis pasos para publicar un target",
    keyMetrics: "Metricas clave",
    metricsTitle: "Que mirar antes de vender una campana",
    peopleHour: "Personas/hora",
    peopleHourText: "Es el volumen base del gemelo digital. Cada hora puede tener fuente manual, estimada u observada.",
    usefulAudienceText: "Porcentaje del trafico que coincide con placement, edad, genero, franja y metadata seleccionada.",
    impressionsText: "Personas alcanzables multiplicadas por visibilidad, dwell time y frecuencia maxima por surface.",
    revenue: "Revenue",
    revenueText: "Valor comercial calculado con CPM, dias de campana y cobertura del target activo.",
    privacyDesign: "Privacidad por diseno",
    privacyTitle: "Trabaja siempre con datos agregados",
    privacyText:
      "Target Model debe guardar conteos, porcentajes y estimaciones. No debe crear fichas personales ni usar datos sensibles para identificar individuos. Si se conectan camaras, sensores o senales de dispositivo, la salida operativa debe ser agregada y auditable.",
    step: "Paso",
  },
};

const segmentCopy = {
  child: {
    en: ["Child <14", "Families, schools, and children's leisure"],
    es: ["Child <14", "Familias, colegios y ocio infantil"],
  },
  young: {
    en: ["Young 15-30", "Fashion, leisure, education, and first purchases"],
    es: ["Young 15-30", "Moda, ocio, educacion y primeras compras"],
  },
  adult: {
    en: ["Adult 30-50", "Urban consumption, retail, and services"],
    es: ["Adult 30-50", "Consumo urbano, retail y servicios"],
  },
  senior: {
    en: ["Senior 50-65", "Home, health, travel, and loyalty"],
    es: ["Senior 50-65", "Hogar, salud, viajes y fidelidad"],
  },
  elder: {
    en: ["Elder >65", "Proximity, assistance, and recurring purchases"],
    es: ["Elder >65", "Proximidad, asistencia y compras recurrentes"],
  },
};

const stepContent = {
  en: {
    1: {
      title: "Select circuit and Xpacio",
      body: "Start with the commercial circuit and the physical point. Target Model loads traffic baseline, available surfaces, and the latest state synced with Admira.",
      checklist: ["Check exterior/interior.", "Review the date range.", "Choose simulated or observed mode."],
    },
    2: {
      title: "Model people per hour",
      body: "Edit the hourly traffic table. Exterior feeds windows and doors; interior feeds screens, metahuman, and vending.",
      checklist: ["Use the automatic curve as a starting point.", "Mark the data source.", "Lock the baseline when it is sellable."],
    },
    3: {
      title: "Adjust the typology",
      body: "Distribute the audience by age, gender, and metadata. The system recalculates useful audience and coverage in real time.",
      checklist: ["Keep the balance close to 100%.", "Separate estimated from observed.", "Always work with aggregated data."],
    },
    4: {
      title: "Calibrate visible inventory",
      body: "Each surface converts footfall into impressions. Visibility and dwell time determine advertising value.",
      checklist: ["Validate exterior/interior zone.", "Adjust visibility by surface.", "Disable inventory that is not operational."],
    },
    5: {
      title: "Simulate the campaign",
      body: "Define CPM, duration, and frequency. The proposal shows reach, sellable impressions, value, and coverage.",
      checklist: ["Check the active target.", "Adjust CPM by demand.", "Reserve only available inventory."],
    },
    6: {
      title: "Publish rules to XpaceOS",
      body: "Rules activate content by hour, zone, and segment. XpaceOS runs playback and returns observed data for auditing.",
      checklist: ["Publish in Admira.", "Activate rules in XpaceOS.", "Compare estimated vs observed."],
    },
  },
  es: {
    1: {
      title: "Selecciona circuito y Xpacio",
      body: "Empieza por el circuito comercial y el punto fisico. Target Model carga el baseline de trafico, superficies disponibles y ultimo estado sincronizado con Admira.",
      checklist: ["Comprueba exterior/interior.", "Revisa rango de fechas.", "Elige modo simulado u observado."],
    },
    2: {
      title: "Modela personas por hora",
      body: "Edita la tabla de trafico por hora. Exterior alimenta escaparates y puerta; interior alimenta pantallas, metahuman y vending.",
      checklist: ["Usa curva automatica como punto de partida.", "Marca la fuente del dato.", "Bloquea el baseline cuando sea vendible."],
    },
    3: {
      title: "Ajusta la tipologia",
      body: "Reparte la audiencia por edad, genero y metadata. El sistema recalcula audiencia util y cobertura en tiempo real.",
      checklist: ["Mantén el balance cerca del 100%.", "Distingue estimado de observado.", "Trabaja siempre con datos agregados."],
    },
    4: {
      title: "Calibra inventario visible",
      body: "Cada surface convierte paso de personas en impresiones. Visibilidad y dwell time determinan el valor publicitario.",
      checklist: ["Valida zona exterior/interior.", "Ajusta visibilidad por surface.", "Desactiva inventario no operativo."],
    },
    5: {
      title: "Simula la campaña",
      body: "Define CPM, duracion y frecuencia. La propuesta muestra alcance, impresiones servibles, valor y cobertura.",
      checklist: ["Comprueba el target activo.", "Ajusta CPM por demanda.", "Reserva solo el inventario disponible."],
    },
    6: {
      title: "Publica reglas en XpaceOS",
      body: "Las reglas activan contenidos por hora, zona y segmento. XpaceOS ejecuta la reproduccion y devuelve observados para auditar.",
      checklist: ["Publica en Admira.", "Activa reglas en XpaceOS.", "Compara estimado vs observado."],
    },
  },
};

function refreshFormatters() {
  const locale = LANG === "es" ? "es-ES" : "en-US";
  formatter = new Intl.NumberFormat(locale);
  currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  currencyDetailed = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function t(key, vars = {}) {
  const value = copy[LANG]?.[key] ?? copy.en[key] ?? key;
  return Object.entries(vars).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, replacement), value);
}

function setLang(lang, persist = true) {
  LANG = lang === "es" ? "es" : "en";
  refreshFormatters();
  document.documentElement.lang = LANG;
  qsa(".target-lang-btn").forEach((button) => button.classList.toggle("is-active", button.dataset.lang === LANG));
  if (persist) {
    try {
      localStorage.setItem(LANG_KEY, LANG);
    } catch (_) {}
  }
  applyLanguage();
  if (page === "backoffice") renderAll();
  if (page === "tutorial") renderTutorialStep();
}

refreshFormatters();

const DEFAULT_CIRCUIT_SCOPE = "local";
const CIRCUIT_SCOPE_OPTIONS = [
  { value: "global", labelKey: "scopeGlobal" },
  { value: "national", labelKey: "scopeNational" },
  { value: "city", labelKey: "scopeCity" },
  { value: "local", labelKey: "scopeLocal" },
];
const TARGET_CIRCUITS_BY_SCOPE = {
  global: [{ value: "desigual", labelKey: "circuitDesigual" }],
  national: [{ value: "xtanco", labelKey: "circuitXtanco" }],
  city: [{ value: "metro_bcn", labelKey: "circuitMetro" }],
  local: [{ value: "local_all", labelKey: "circuitLocalAll" }],
};

function sanitizeCircuitScope(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return CIRCUIT_SCOPE_OPTIONS.some((option) => option.value === normalized) ? normalized : DEFAULT_CIRCUIT_SCOPE;
}

const state = {
  mode: "simulado",
  targetMode: "target",
  scope: DEFAULT_CIRCUIT_SCOPE,
  filters: {
    placement: ["exterior", "interior"],
    gender: ["male", "female"],
    age: ["child", "young", "adult", "senior", "elder"],
    time: ["morning", "midday", "afternoon", "night"],
  },
  traffic: [
    { hour: "08:00", exterior: 120, interior: 35, source: "manual", confidence: "medium" },
    { hour: "09:00", exterior: 180, interior: 50, source: "estimado", confidence: "high" },
    { hour: "10:00", exterior: 140, interior: 65, source: "observado", confidence: "high" },
    { hour: "11:00", exterior: 165, interior: 72, source: "observado", confidence: "high" },
    { hour: "12:00", exterior: 210, interior: 95, source: "estimado", confidence: "medium" },
    { hour: "13:00", exterior: 245, interior: 110, source: "estimado", confidence: "medium" },
    { hour: "16:00", exterior: 185, interior: 88, source: "manual", confidence: "medium" },
    { hour: "18:00", exterior: 280, interior: 120, source: "observado", confidence: "high" },
    { hour: "21:00", exterior: 150, interior: 60, source: "estimado", confidence: "low" },
  ],
  segments: [
    { id: "child", label: "Child <14", description: "Familias, colegios y ocio infantil", pct: 8, source: "estimado", confidence: "medium" },
    { id: "young", label: "Young 15-30", description: "Moda, ocio, educacion y primeras compras", pct: 22, source: "historico", confidence: "high" },
    { id: "adult", label: "Adult 30-50", description: "Consumo urbano, retail y servicios", pct: 46, source: "observado", confidence: "high" },
    { id: "senior", label: "Senior 50-65", description: "Hogar, salud, viajes y fidelidad", pct: 18, source: "estimado", confidence: "medium" },
    { id: "elder", label: "Elder >65", description: "Proximidad, asistencia y compras recurrentes", pct: 6, source: "manual", confidence: "low" },
  ],
  times: [
    { id: "morning", label: "Morning", range: "08:00-12:00", weight: 0.28 },
    { id: "midday", label: "Midday", range: "12:00-16:00", weight: 0.31 },
    { id: "afternoon", label: "Afternoon", range: "16:00-20:00", weight: 0.29 },
    { id: "night", label: "Night", range: "20:00-00:00", weight: 0.12 },
  ],
  surfaces: [
    { id: "window", name: "Escaparate LED", type: "Window", zone: "exterior", visibility: 0.62, dwell: 4.2, status: "activo", icon: "panel-top" },
    { id: "door", name: "Puerta Xtanco", type: "Entrance", zone: "exterior", visibility: 0.54, dwell: 3.6, status: "activo", icon: "door-open" },
    { id: "metahuman", name: "Metahuman screen", type: "Screen", zone: "interior", visibility: 0.48, dwell: 8.5, status: "activo", icon: "bot" },
    { id: "vending", name: "Vending display", type: "Display", zone: "interior", visibility: 0.35, dwell: 12, status: "activo", icon: "badge-dollar-sign" },
  ],
  rules: [
    {
      titleKey: "ruleCoffee",
      statusKey: "active",
      textKey: "ruleCoffeeText",
    },
    {
      titleKey: "ruleRetail",
      statusKey: "scheduled",
      textKey: "ruleRetailText",
    },
  ],
};

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function circuitScopeLabel(value = state.scope) {
  const clean = sanitizeCircuitScope(value);
  const option = CIRCUIT_SCOPE_OPTIONS.find((item) => item.value === clean);
  return t(option?.labelKey || "scopeLocal");
}

function circuitScopePayload() {
  state.scope = sanitizeCircuitScope(state.scope);
  return {
    required: true,
    value: state.scope,
    label: circuitScopeLabel(state.scope),
    defaultValue: DEFAULT_CIRCUIT_SCOPE,
  };
}

function targetCircuitsForScope() {
  return TARGET_CIRCUITS_BY_SCOPE[sanitizeCircuitScope(state.scope)] || TARGET_CIRCUITS_BY_SCOPE[DEFAULT_CIRCUIT_SCOPE];
}

function setText(selector, value, root = document) {
  const element = qs(selector, root);
  if (element) element.textContent = value;
}

function setAttr(selector, attr, value, root = document) {
  const element = qs(selector, root);
  if (element) element.setAttribute(attr, value);
}

function setTextAt(selector, index, value, root = document) {
  const element = qsa(selector, root)[index];
  if (element) element.textContent = value;
}

function setButtonText(selector, value, root = document) {
  const button = qs(selector, root);
  if (!button) return;
  const icon = button.querySelector("svg, i");
  button.textContent = "";
  if (icon) button.append(icon, " ");
  button.append(value);
}

function setSelectOptions(selector, labels) {
  const select = qs(selector);
  if (!select) return;
  [...select.options].forEach((option) => {
    if (labels[option.value]) option.textContent = labels[option.value];
  });
}

function sourceLabel(value) {
  return (
    {
      manual: t("sourceManual"),
      estimado: t("sourceEstimated"),
      observado: t("sourceObserved"),
      historico: t("sourceHistorical"),
      plantilla: t("sourceTemplate"),
    }[value] ?? value
  );
}

function modeLabel(value) {
  return (
    {
      simulado: t("simulated"),
      observado: t("observed"),
      comparativo: t("comparison"),
    }[value] ?? value
  );
}

function segmentLabel(segment) {
  return segmentCopy[segment.id]?.[LANG]?.[0] ?? segment.label;
}

function segmentDescription(segment) {
  return segmentCopy[segment.id]?.[LANG]?.[1] ?? segment.description;
}

function renderTutorialStep(id = qs("#tutorialSteps li.is-active")?.dataset.step ?? "1") {
  const content = stepContent[LANG]?.[id] ?? stepContent.en[id];
  const eyebrow = qs("#stepEyebrow");
  const title = qs("#stepTitle");
  const body = qs("#stepBody");
  const list = qs("#stepChecklist");
  if (!content || !eyebrow || !title || !body || !list) return;
  eyebrow.textContent = `${t("step")} ${String(id).padStart(2, "0")}`;
  title.textContent = content.title;
  body.textContent = content.body;
  list.innerHTML = content.checklist.map((item) => `<li>${item}</li>`).join("");
}

function applyBackofficeLanguage() {
  setAttr(".brand", "aria-label", "Admira home");
  setAttr("#xpacioSearch", "aria-label", t("aria.search"));
  setAttr("[data-action='toggle-mode']", "aria-label", t("aria.mode"));
  setAttr("[data-action='export']", "aria-label", t("aria.export"));
  setAttr(".left-rail", "aria-label", t("aria.leftRail"));
  setAttr(".status-cluster", "aria-label", t("aria.modelStatus"));
  setAttr(".kpi-grid", "aria-label", t("aria.kpis"));
  setAttr(".tabs", "aria-label", t("aria.tabs"));
  setAttr("#trafficChart", "aria-label", t("aria.chart"));
  setAttr(".confidence-meter", "aria-label", t("aria.segmentBalance"));
  setAttr(".simulation-controls", "aria-label", t("aria.simulationControls"));
  setAttr(".proposal-panel", "aria-label", t("aria.simulationResult"));

  setButtonText("[data-action='publish']", t("publish"));
  setButtonText(".ghost-action", t("tutorial"));
  ["circuit", "activeXpacio", "range", "mode", "liveBidding"].forEach((key, index) => {
    setTextAt(".left-rail .rail-section > .eyebrow", index, t(key));
  });
  const fromLabel = qsa(".date-grid label")[0];
  const toLabel = qsa(".date-grid label")[1];
  const fromInput = qs("#dateFrom");
  const toInput = qs("#dateTo");
  if (fromLabel) {
    fromLabel.textContent = t("from");
    if (fromInput) fromLabel.append(fromInput);
  }
  if (toLabel) {
    toLabel.textContent = t("to");
    if (toInput) toLabel.append(toInput);
  }
  setAttr(".segmented-control", "aria-label", t("mode"));
  setText(".segmented-control [data-mode='simulado']", t("simulated"));
  setText(".segmented-control [data-mode='observado']", t("observed"));
  setText(".segmented-control [data-mode='comparativo']", t("comparison"));

  setText(".mode-strip .eyebrow", t("modelEyebrow"));
  setText(".mode-strip h1", t("modelTitle"));
  setText("#modelStatus", t("modelStatus"));
  setText("#lastSync", t("lastSync"));
  [
    ["peopleDay", "baseline"],
    ["peakHour", "totalTraffic"],
    ["impressions", "activeTarget"],
    ["usefulAudience", "matchesFilters"],
    ["recommendedCpm", "byDemand"],
    ["potentialRevenue", "weeklyCampaign"],
  ].forEach(([labelKey, smallKey], index) => {
    setTextAt(".kpi-tile span", index, t(labelKey));
    setTextAt(".kpi-tile small", index, t(smallKey));
  });

  ["traffic", "segments", "inventory", "simulation", "rules"].forEach((key, index) => {
    setButtonText(`.tabs button:nth-child(${index + 1})`, t(key));
  });

  setPanelCopy("traffic", "peopleByHour", "trafficTitle");
  setButtonText("[data-action='generate-curve']", t("generateCurve"));
  setButtonText("[data-action='copy-saturday']", t("saturdayTemplate"));
  setText(".chart-header span", t("dailyDistribution"));
  ["hour", "exteriorPeople", "interiorPeople", "total", "source", "confidence"].forEach((key, index) => {
    setTextAt('[data-panel="traffic"] th', index, t(key));
  });

  setPanelCopy("segments", "audienceType", "segmentMix");
  setText(".confidence-meter small", t("balance"));
  ["segment", "audiencePct", "peopleDay", "source", "confidence"].forEach((key, index) => {
    setTextAt('[data-panel="segments"] th', index, t(key));
  });

  setPanelCopy("inventory", "visibleSurfaces", "inventoryTitle");
  setButtonText("[data-action='calibrate']", t("calibrateVisibility"));
  setPanelCopy("simulation", "commercialSimulation", "simulationTitle");
  setButtonText("[data-action='reserve']", t("reserveInventory"));
  ["targetCpm", "durationDays", "maxFrequency"].forEach((key, index) => {
    const label = qsa(".simulation-controls label")[index];
    const input = label?.querySelector("input");
    if (label) {
      label.textContent = t(key);
      if (input) label.append(input);
    }
  });
  ["reachableAudience", "sellableImpressions", "campaignValue", "targetCoverage"].forEach((key, index) => {
    setTextAt(".proposal-metric span", index, t(key));
  });
  setPanelCopy("rules", "segmentedPlayback", "rulesTitle");
  setButtonText("[data-action='add-rule']", t("addRule"));

  setText(".target-header .eyebrow", t("buyByCircuit"));
  setText(".target-header h2", t("campaignTarget"));
  const targetScopeLabel = qs(".target-panel > .target-scope-block");
  const targetScopeSelect = qs("#targetScope");
  if (targetScopeLabel) {
    targetScopeLabel.textContent = t("circuitScope");
    if (targetScopeSelect) targetScopeLabel.append(targetScopeSelect);
  }
  CIRCUIT_SCOPE_OPTIONS.forEach((option) => {
    const node = qs(`#targetScope option[value="${option.value}"]`);
    if (node) node.textContent = t(option.labelKey);
  });
  const targetCircuitLabel = qs(".target-panel > .target-circuit-block");
  const targetCircuitSelect = qs("#targetCircuit");
  if (targetCircuitLabel) {
    targetCircuitLabel.textContent = t("circuit");
    if (targetCircuitSelect) targetCircuitLabel.append(targetCircuitSelect);
  }
  setText("[data-target-mode='whole']", t("wholeCircuit"));
  setText("[data-target-mode='target']", t("target"));
  ["adPlacement", "gender", "age", "timeSlot", "metadata"].forEach((key, index) => {
    setTextAt(".target-section > .eyebrow", index, t(key));
  });
  setCheckTile('[name="placement"][value="exterior"]', t("exterior"), t("exteriorDesc"));
  setCheckTile('[name="placement"][value="interior"]', t("interior"), t("interiorDesc"));
  setCheckTile('[name="gender"][value="male"]', "Male", t("maleDesc"));
  setCheckTile('[name="gender"][value="female"]', "Female", t("femaleDesc"));
  const metadataLabels = qsa(".target-section .field-block");
  const incomeSelect = qs("#incomeSelect");
  const phoneSelect = qs("#phoneSelect");
  if (metadataLabels[0]) {
    metadataLabels[0].textContent = t("income");
    if (incomeSelect) metadataLabels[0].append(incomeSelect);
  }
  if (metadataLabels[1]) {
    metadataLabels[1].textContent = t("phoneType");
    if (phoneSelect) metadataLabels[1].append(phoneSelect);
  }
  setSelectOptions("#incomeSelect", { all: t("all"), medium: t("medium"), high: t("high"), premium: t("premium") });
  setSelectOptions("#phoneSelect", { all: t("all"), ios: t("likelyIos"), android: t("likelyAndroid"), premium: t("likelyPremium") });
}

function setPanelCopy(panel, eyebrowKey, titleKey) {
  setText(`[data-panel="${panel}"] .panel-heading .eyebrow`, t(eyebrowKey));
  setText(`[data-panel="${panel}"] .panel-heading h2`, t(titleKey));
}

function setCheckTile(inputSelector, label, description) {
  const input = qs(inputSelector);
  const tile = input?.closest(".check-tile");
  if (!tile) return;
  const span = qs("span", tile);
  const small = qs("small", tile);
  if (span) span.textContent = label;
  if (small) small.textContent = description;
}

function applyTutorialLanguage() {
  setAttr(".brand", "aria-label", "Admira home");
  setAttr(".tutorial-nav", "aria-label", t("aria.tutorialNav"));
  setText('.tutorial-nav a[href="#flujo"]', t("tutorialFlow"));
  setText('.tutorial-nav a[href="#metricas"]', t("tutorialMetrics"));
  setText('.tutorial-nav a[href="#privacidad"]', t("tutorialPrivacy"));
  setButtonText(".tutorial-nav .primary-action", t("openBackoffice"));
  setText(".tutorial-intro .eyebrow", t("tutorialIntroEyebrow"));
  setText(".tutorial-intro h1", t("tutorialTitle"));
  setText(".tutorial-intro .intro-copy > p:last-child", t("tutorialIntro"));
  setAttr(".product-figure img", "alt", t("modelTitle"));
  setText(".product-figure figcaption", t("tutorialCaption"));
  setText("#flujo .section-heading .eyebrow", t("operationalFlow"));
  setText("#flujo .section-heading h2", t("sixSteps"));
  Object.entries(stepContent[LANG] ?? stepContent.en).forEach(([id, content]) => {
    const button = qs(`#tutorialSteps [data-step="${id}"] button`);
    const number = button?.querySelector("span");
    if (button) {
      button.textContent = "";
      if (number) button.append(number, " ");
      button.append(content.title);
    }
  });
  setText("#metricas .section-heading .eyebrow", t("keyMetrics"));
  setText("#metricas .section-heading h2", t("metricsTitle"));
  const metricKeys = [
    ["peopleHour", "peopleHourText"],
    ["usefulAudience", "usefulAudienceText"],
    ["impressions", "impressionsText"],
    ["revenue", "revenueText"],
  ];
  metricKeys.forEach(([titleKey, bodyKey], index) => {
    const card = qsa(".metric-explainer article")[index];
    setText("h3", t(titleKey), card);
    setText("p", t(bodyKey), card);
  });
  setText("#privacidad .eyebrow", t("privacyDesign"));
  setText("#privacidad h2", t("privacyTitle"));
  setText("#privacidad > p", t("privacyText"));
}

function applyLanguage() {
  if (page === "backoffice") applyBackofficeLanguage();
  if (page === "tutorial") applyTutorialLanguage();
}

function selectedValues(name) {
  const selected = qsa(`input[name="${name}"]:checked`).map((input) => input.value);
  if (selected.length) return selected;
  return state.filters[name] ?? [];
}

function syncFilter(name) {
  state.filters[name] = qsa(`input[name="${name}"]:checked`).map((input) => input.value);
}

function peopleDay() {
  return state.traffic.reduce((sum, item) => sum + item.exterior + item.interior, 0);
}

function placementShare() {
  const selected = selectedValues("placement");
  if (!selected.length) return 0;
  if (selected.length === 2) return 1;
  const totals = state.traffic.reduce(
    (acc, item) => {
      acc.exterior += item.exterior;
      acc.interior += item.interior;
      return acc;
    },
    { exterior: 0, interior: 0 },
  );
  const total = totals.exterior + totals.interior || 1;
  return selected.includes("exterior") ? totals.exterior / total : totals.interior / total;
}

function ageShare() {
  const selected = selectedValues("age");
  if (!selected.length) return 0;
  if (selected.length === state.segments.length) return 1;
  return (
    state.segments
      .filter((segment) => selected.includes(segment.id))
      .reduce((sum, segment) => sum + segment.pct, 0) / 100
  );
}

function timeShare() {
  const selected = selectedValues("time");
  if (!selected.length) return 0;
  if (selected.length === state.times.length) return 1;
  return state.times.filter((slot) => selected.includes(slot.id)).reduce((sum, slot) => sum + slot.weight, 0);
}

function genderShare() {
  const selected = selectedValues("gender");
  if (!selected.length) return 0;
  return selected.length === 2 ? 1 : 0.52;
}

function metadataShare() {
  const income = qs("#incomeSelect")?.value ?? "all";
  const phone = qs("#phoneSelect")?.value ?? "all";
  const incomeFactor = { all: 1, medium: 0.58, high: 0.34, premium: 0.16 }[income] ?? 1;
  const phoneFactor = { all: 1, ios: 0.42, android: 0.58, premium: 0.26 }[phone] ?? 1;
  return incomeFactor * phoneFactor;
}

function coverage() {
  if (state.targetMode === "whole") return 1;
  return Math.min(1, placementShare() * ageShare() * timeShare() * genderShare() * metadataShare());
}

function averageVisibility() {
  const placements = selectedValues("placement");
  const eligible = state.surfaces.filter((surface) => !placements.length || placements.includes(surface.zone));
  const list = eligible.length ? eligible : state.surfaces;
  return list.reduce((sum, surface) => sum + surface.visibility, 0) / list.length;
}

function campaignMetrics() {
  const cpm = Number(qs("#cpmInput")?.value ?? 8.5);
  const days = Number(qs("#daysInput")?.value ?? 7);
  const frequency = Number(qs("#frequencyInput")?.value ?? 6);
  const reach = peopleDay() * coverage() * days;
  const impressions = Math.round(reach * averageVisibility() * Math.min(1.35, 0.75 + frequency / 14));
  const value = (impressions / 1000) * cpm;
  const recommendedCpm = Math.max(5.25, cpm * (0.8 + coverage() * 0.65));
  return { cpm, days, frequency, reach, impressions, value, recommendedCpm };
}

function confidenceClass(value) {
  return value === "high" ? "high" : value === "medium" ? "medium" : "low";
}

function confidenceLabel(value) {
  return { high: t("confidenceHigh"), medium: t("confidenceMedium"), low: t("confidenceLow") }[value] ?? value;
}

function renderTraffic() {
  const tbody = qs("#trafficRows");
  if (!tbody) return;
  tbody.innerHTML = state.traffic
    .map(
      (item, index) => `
        <tr>
          <td>${item.hour}</td>
          <td><input class="traffic-input" type="number" min="0" value="${item.exterior}" data-index="${index}" data-field="exterior" aria-label="Exterior ${item.hour}" /></td>
          <td><input class="traffic-input" type="number" min="0" value="${item.interior}" data-index="${index}" data-field="interior" aria-label="Interior ${item.hour}" /></td>
          <td><strong>${formatter.format(item.exterior + item.interior)}</strong></td>
          <td><span class="source-pill">${sourceLabel(item.source)}</span></td>
          <td><span class="confidence-pill ${confidenceClass(item.confidence)}">${confidenceLabel(item.confidence)}</span></td>
        </tr>
      `,
    )
    .join("");

  qsa(".traffic-input").forEach((input) => {
    input.addEventListener("change", (event) => {
      const target = event.currentTarget;
      const index = Number(target.dataset.index);
      const field = target.dataset.field;
      state.traffic[index][field] = Math.max(0, Number(target.value));
      renderAll();
    });
  });
}

function renderChart() {
  const chart = qs("#trafficChart");
  const totalLabel = qs("#chartTotal");
  if (!chart) return;
  const max = Math.max(...state.traffic.map((item) => item.exterior + item.interior), 1);
  chart.innerHTML = state.traffic
    .map((item) => {
      const total = item.exterior + item.interior;
      const extPct = Math.max(4, (item.exterior / max) * 100);
      const intPct = Math.max(4, (item.interior / max) * 100);
      return `
        <div class="bar-column" title="${item.hour} · ${formatter.format(total)} ${t("people")}">
          <div class="bar-stack">
            <div class="bar-int" style="height:${intPct}%"></div>
            <div class="bar-ext" style="height:${extPct}%"></div>
          </div>
          <span class="bar-label">${item.hour}</span>
        </div>
      `;
    })
    .join("");
  totalLabel.textContent = `${formatter.format(peopleDay())} ${t("people")}`;
}

function renderSegments() {
  const tbody = qs("#segmentRows");
  const ageTiles = qs("#ageTiles");
  if (!tbody || !ageTiles) return;
  const total = peopleDay();
  tbody.innerHTML = state.segments
    .map(
      (segment, index) => `
        <tr>
          <td>
            <strong>${segmentLabel(segment)}</strong><br />
            <small>${segmentDescription(segment)}</small>
          </td>
          <td>
            <div class="segment-control">
              <input class="segment-range" type="range" min="0" max="70" value="${segment.pct}" data-index="${index}" aria-label="${segmentLabel(segment)}" />
              <strong>${segment.pct}%</strong>
            </div>
          </td>
          <td>${formatter.format(Math.round(total * (segment.pct / 100)))}</td>
          <td><span class="source-pill">${sourceLabel(segment.source)}</span></td>
          <td><span class="confidence-pill ${confidenceClass(segment.confidence)}">${confidenceLabel(segment.confidence)}</span></td>
        </tr>
      `,
    )
    .join("");

  ageTiles.innerHTML = state.segments
    .map(
      (segment) => `
        <label class="check-tile">
          <input type="checkbox" name="age" value="${segment.id}" ${state.filters.age.includes(segment.id) ? "checked" : ""} />
          <span>${segmentLabel(segment)}</span>
          <small>${segmentDescription(segment)}</small>
        </label>
      `,
    )
    .join("");

  qsa(".segment-range").forEach((input) => {
    input.addEventListener("change", (event) => {
      const target = event.currentTarget;
      state.segments[Number(target.dataset.index)].pct = Number(target.value);
      renderAll();
    });
  });

  qsa('input[name="age"]').forEach((input) => {
    input.addEventListener("change", () => {
      syncFilter("age");
      renderAll();
    });
  });
}

function renderTimes() {
  const timeTiles = qs("#timeTiles");
  if (!timeTiles) return;
  timeTiles.innerHTML = state.times
    .map(
      (slot) => `
        <label class="check-tile">
          <input type="checkbox" name="time" value="${slot.id}" ${state.filters.time.includes(slot.id) ? "checked" : ""} />
          <span>${t(slot.id)}</span>
          <small>${slot.range}</small>
        </label>
      `,
    )
    .join("");
  qsa('input[name="time"]').forEach((input) => {
    input.addEventListener("change", () => {
      syncFilter("time");
      renderAll();
    });
  });
}

function renderSurfaces() {
  const container = qs("#surfaceCards");
  if (!container) return;
  const trafficTotals = state.traffic.reduce(
    (acc, item) => {
      acc.exterior += item.exterior;
      acc.interior += item.interior;
      return acc;
    },
    { exterior: 0, interior: 0 },
  );
  container.innerHTML = state.surfaces
    .map((surface) => {
      const base = trafficTotals[surface.zone] || 0;
      const impressions = Math.round(base * surface.visibility);
      return `
        <article class="surface-card">
          <div class="surface-top">
            <div>
              <p class="eyebrow">${t(`zone${surface.zone[0].toUpperCase()}${surface.zone.slice(1)}`)}</p>
              <h3>${t(`surface${surface.id[0].toUpperCase()}${surface.id.slice(1)}`)}</h3>
            </div>
            <span class="surface-icon"><i data-lucide="${surface.icon}"></i></span>
          </div>
          <div class="surface-meta">
            <div><span>${t("type")}</span><strong>${t(`surfaceType${surface.type}`)}</strong></div>
            <div><span>${t("visibility")}</span><strong>${Math.round(surface.visibility * 100)}%</strong></div>
            <div><span>Dwell</span><strong>${surface.dwell}s</strong></div>
          </div>
          <div class="surface-meta">
            <div><span>${t("dayImpressions")}</span><strong>${formatter.format(impressions)}</strong></div>
            <div><span>${t("status")}</span><strong>${t(surface.status === "activo" ? "active" : surface.status)}</strong></div>
            <div><span>Player</span><strong>XOS-${surface.id.slice(0, 3).toUpperCase()}</strong></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRules() {
  const list = qs("#rulesList");
  if (!list) return;
  list.innerHTML = state.rules
    .map(
      (rule) => `
        <article class="rule-card">
          <div>
            <h3>${rule.titleKey ? t(rule.titleKey) : rule.title}</h3>
            <code>${rule.textKey ? t(rule.textKey, { coverage: Math.round(coverage() * 100), frequency: qs("#frequencyInput")?.value ?? 6 }) : rule.text}</code>
          </div>
          <span class="rule-status">${t(rule.statusKey ?? rule.status)}</span>
        </article>
      `,
    )
    .join("");
}

function renderTargetScope() {
  state.scope = sanitizeCircuitScope(state.scope);
  const select = qs("#targetScope");
  if (select) select.value = state.scope;
}

function renderTargetCircuit() {
  const select = qs("#targetCircuit");
  if (!select) return;
  const circuits = targetCircuitsForScope();
  select.innerHTML = circuits.map((item) => `<option value="${item.value}">${t(item.labelKey)}</option>`).join("");
  select.value = circuits[0]?.value || "";
}

function renderKpis() {
  const metrics = campaignMetrics();
  const total = peopleDay();
  const peak = state.traffic.reduce((best, item) => {
    const current = item.exterior + item.interior;
    return current > best.total ? { hour: item.hour, total: current } : best;
  }, { hour: "00:00", total: 0 });
  const segmentTotal = state.segments.reduce((sum, segment) => sum + segment.pct, 0);

  qs("#kpiPeopleDay").textContent = formatter.format(total);
  qs("#kpiPeopleDelta").textContent = total >= 2100 ? t("baselineUp") : t("baselineAdjusted");
  qs("#kpiPeakHour").textContent = `${peak.hour}`;
  qs("#kpiImpressions").textContent = formatter.format(metrics.impressions);
  qs("#kpiUsefulAudience").textContent = `${Math.round(coverage() * 100)}%`;
  qs("#kpiCpm").textContent = currencyDetailed.format(metrics.recommendedCpm);
  qs("#kpiRevenue").textContent = currency.format(metrics.value);
  qs("#targetCoverageBadge").textContent = `${Math.round(coverage() * 100)}%`;
  qs("#liveImpressions").textContent = formatter.format(Math.round(metrics.impressions / 420));
  qs("#segmentBalance").textContent = `${segmentTotal}%`;
  qs("#segmentBalance").style.color = Math.abs(segmentTotal - 100) <= 5 ? "var(--green)" : "var(--gold)";
  qs("#simReach").textContent = formatter.format(Math.round(metrics.reach));
  qs("#simImpressions").textContent = formatter.format(metrics.impressions);
  qs("#simValue").textContent = currencyDetailed.format(metrics.value);
  qs("#simCoverage").textContent = `${Math.round(coverage() * 100)}%`;
}

function wireGlobalControls() {
  qsa(".tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      qsa(".tabs button").forEach((tab) => tab.classList.remove("is-active"));
      qsa(".tab-panel").forEach((panel) => panel.classList.remove("is-visible"));
      button.classList.add("is-active");
      qs(`[data-panel="${button.dataset.tab}"]`).classList.add("is-visible");
    });
  });

  qsa(".segmented-control button").forEach((button) => {
    button.addEventListener("click", () => {
      qsa(".segmented-control button").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      state.mode = button.dataset.mode;
      qs("#modelStatus").textContent = LANG === "es" ? `Modelo ${modeLabel(state.mode)}` : `${modeLabel(state.mode)} model`;
      showToast(t("toastMode", { mode: modeLabel(state.mode) }));
    });
  });

  qsa(".target-toggle button").forEach((button) => {
    button.addEventListener("click", () => {
      qsa(".target-toggle button").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      state.targetMode = button.dataset.targetMode;
      renderAll();
    });
  });

  qs("#targetScope")?.addEventListener("change", (event) => {
    state.scope = sanitizeCircuitScope(event.currentTarget.value);
    renderAll();
  });

  qsa('input[name="placement"], input[name="gender"]').forEach((control) => {
    control.addEventListener("change", () => {
      syncFilter(control.name);
      renderAll();
    });
  });

  qsa("#incomeSelect, #phoneSelect, #cpmInput, #daysInput, #frequencyInput").forEach((control) => {
    control.addEventListener("input", renderAll);
    control.addEventListener("change", renderAll);
  });

  qsa("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action));
  });
}

function targetModelPayload() {
  const scope = circuitScopePayload();
  const circuitSelect = qs("#targetCircuit");
  return {
    xpacio: qs("#xpacioSearch")?.value,
    circuit: circuitSelect?.value,
    circuitLabel: circuitSelect?.options[circuitSelect.selectedIndex]?.textContent || "",
    targetScope: scope,
    requiredConditions: {
      circuitScope: scope,
    },
    targetMode: state.targetMode,
    filters: state.filters,
    peopleDay: peopleDay(),
    coverage: coverage(),
    metrics: campaignMetrics(),
    segments: state.segments,
    traffic: state.traffic,
  };
}

function handleAction(action) {
  if (action === "generate-curve") {
    state.traffic = state.traffic.map((item, index) => ({
      ...item,
      exterior: Math.round(item.exterior * [0.92, 1.08, 0.98, 1.05, 1.14, 1.2, 1.02, 1.18, 0.95][index]),
      interior: Math.round(item.interior * [0.9, 1.02, 1.05, 1.12, 1.18, 1.22, 1.08, 1.16, 0.98][index]),
      source: "estimado",
      confidence: index > 6 ? "medium" : "high",
    }));
    renderAll();
    showToast(t("toastGenerated"));
  }

  if (action === "copy-saturday") {
    state.traffic = state.traffic.map((item) => ({
      ...item,
      exterior: Math.round(item.exterior * 1.18),
      interior: Math.round(item.interior * 1.28),
      source: "plantilla",
      confidence: "medium",
    }));
    renderAll();
    showToast(t("toastSaturday"));
  }

  if (action === "calibrate") {
    state.surfaces = state.surfaces.map((surface) => ({
      ...surface,
      visibility: Math.min(0.82, Number((surface.visibility + 0.03).toFixed(2))),
    }));
    renderAll();
    showToast(t("toastCalibrated"));
  }

  if (action === "reserve") {
    try {
      sessionStorage.setItem("admira-target-proposal-draft", JSON.stringify(targetModelPayload()));
    } catch (_) {}
    showToast(t("toastReserved"));
  }

  if (action === "add-rule") {
    state.rules.unshift({
      titleKey: "ruleActiveTarget",
      statusKey: "draft",
      textKey: "ruleActiveTargetText",
    });
    renderAll();
    showToast(t("toastRule"));
  }

  if (action === "publish") {
    showToast(t("toastPublished"));
  }

  if (action === "export") {
    const payload = targetModelPayload();
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    showToast(t("toastExported"));
  }

  if (action === "toggle-mode") {
    const order = ["simulado", "observado", "comparativo"];
    const next = order[(order.indexOf(state.mode) + 1) % order.length];
    const button = qs(`.segmented-control button[data-mode="${next}"]`);
    button?.click();
  }
}

function showToast(message) {
  const toast = qs("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function renderAll() {
  renderTargetScope();
  renderTargetCircuit();
  renderTraffic();
  renderChart();
  renderSegments();
  renderTimes();
  renderSurfaces();
  renderRules();
  renderKpis();
  if (window.lucide) window.lucide.createIcons();
}

function wireLanguageControls() {
  qsa(".target-lang-btn").forEach((button) => {
    button.addEventListener("click", () => setLang(button.dataset.lang));
  });
}

function initBackoffice() {
  wireLanguageControls();
  setLang(LANG, false);
  wireGlobalControls();
  if (window.lucide) window.lucide.createIcons();
}

function initTutorial() {
  const steps = qsa("#tutorialSteps li");
  wireLanguageControls();
  setLang(LANG, false);

  steps.forEach((step) => {
    step.querySelector("button").addEventListener("click", () => {
      const id = step.dataset.step;
      steps.forEach((item) => item.classList.remove("is-active"));
      step.classList.add("is-active");
      renderTutorialStep(id);
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

window.addEventListener("DOMContentLoaded", () => {
  if (page === "backoffice") initBackoffice();
  if (page === "tutorial") initTutorial();
});

window.addEventListener("load", () => {
  if (window.lucide) window.lucide.createIcons();
});
