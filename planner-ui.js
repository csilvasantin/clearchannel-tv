// Loaded after app.js; reuses the live catalogue, target and checkout.
let plannerBudget = null;
let plannerSaved = null;
let plannerTarget = null;
let plannerCurrent = null;
let plannerRows = new Map();
let plannerAdoptCurrentTarget = false;
let plannerChosen = '';
const pe = id => document.getElementById(id);
const pl = (es,en) => LANG === 'en' ? en : es;
function plannerSettings() {
  return {start:pe('plan-start').value,end:pe('plan-end').value,passesDay:Number(pe('plan-passes').value),durationSec:Number(pe('plan-duration').value),budget:Number(pe('plan-budget').value)};
}
function plannerMetrics(items, settings) {
  return CampaignPlanner.quote(items.map(loc=>{
    const cpms=locationCpmValues(loc);
    return {id:loc.id,impr:locationDailyImpr(loc),surfaces:locationSurfaceCount(loc),cpm:cpms.length?cpms.reduce((a,b)=>a+b,0)/cpms.length:5};
  }), settings);
}
function renderPlanner() {
  const settings=plannerSettings(), valid=CampaignPlanner.validSettings(settings,isoDateLocal(new Date()));
  const defs=circuitDefinitions(), scope=pe('plan-scope').value;
  const eligible=loc=>locationMatchesCircuitTarget(loc,plannerTarget);
  const rows=[];
  for(const [key,plan] of [['saved',plannerSaved],['current',plannerCurrent]]) {
    if(!plan || plan.scope!==scope)continue;
    const circuit=defs[plan.circuitId];if(!circuit)continue;
    const allowed=circuit.items.filter(eligible).filter(loc=>plan.metroLine==='all'||metroLinesForLocation(loc).includes(plan.metroLine));
    const result=CampaignPlanner.reconcile(plan,allowed.map(loc=>loc.id));
    rows.push({key,circuitId:plan.circuitId,metroLine:plan.metroLine,items:result.ids.map(id=>LOC_BY_ID.get(id)).filter(Boolean),missing:result.missing.length,label:pl(key==='saved'?'Plan guardado':'Selección actual',key==='saved'?'Saved plan':'Current selection')+' · '+circuit.label});
  }
  for(const key of circuitIdsForScope(scope)) {
    if(defs[key])rows.push({key:'circuit:'+key,circuitId:key,metroLine:'all',label:defs[key].label,items:defs[key].items.filter(eligible),missing:0});
  }
  plannerRows=new Map(rows.map(row=>[row.key,row]));
  if(!plannerRows.has(plannerChosen))plannerChosen='';
  pe('plan-table-body').innerHTML=rows.map(row=>{
    const q=plannerMetrics(row.items,settings);row.quote=q;
    const fit=valid&&row.items.length&&q.price<=settings.budget;
    return `<tr class="${plannerChosen===row.key?'chosen':''}"><td><label><input type="radio" name="plan-circuit" value="${escHtml(row.key)}" ${plannerChosen===row.key?'checked':''} ${!row.items.length?'disabled':''}> ${escHtml(row.label)}</label>${row.missing?`<small class="plan-warning">${row.missing} ${pl('puntos ya no disponibles con este target','points no longer available with this target')}</small>`:''}</td><td>${formatInt(row.items.length)}</td><td>${valid?formatInt(q.estimatedImpr):'—'}</td><td>${valid?formatMoney(q.price):'—'}</td><td class="${fit?'plan-fit':'plan-warning'}">${!valid||!row.items.length?'—':fit?pl('Dentro','Within'):pl('Supera en ','Over by ')+formatMoney(q.price-settings.budget)}</td></tr>`;
  }).join('');
  const chosen=plannerRows.get(plannerChosen);
  pe('plan-summary').textContent=!valid?pl('Revisa fechas, pases, duración y presupuesto. Inicio desde hoy; máximo 367 días.','Check dates, passes, duration and budget. Start today or later; maximum 367 days.'):
    chosen?`${chosen.label} · ${chosen.items.length} ${pl('puntos','points')} · ${formatMoney(chosen.quote.price)} ${pl('estimados','estimated')}`:pl('Elige un circuito para preparar la solicitud.','Choose a circuit to prepare the request.');
  pe('plan-save').disabled=pe('plan-use').disabled=!plannerCatalogReady||!valid||!chosen?.items.length;
  if(!plannerCatalogReady)pe('plan-summary').textContent=pl('Cargando catálogo. Espera antes de guardar o preparar la solicitud.','Loading catalogue. Wait before saving or preparing the request.');
  pe('plan-target').textContent=pl('Target: ','Target: ')+Object.entries(plannerTarget||{}).map(([key,values])=>values.map(value=>{const option=CIRCUIT_TARGET_OPTIONS[key]?.find(o=>o.value===value);return option?t(option.labelKey):value;}).join(', ')).join(' · ');
}
function openPlanner() {
  seedBuyDates();
  try {plannerSaved=CampaignPlanner.read(localStorage);}catch{plannerSaved=null;}
  plannerTarget=sanitizeCircuitTarget(plannerAdoptCurrentTarget?circuitTarget:plannerSaved?.target||circuitTarget);plannerAdoptCurrentTarget=false;
  plannerCurrent=selectedLocationIds.size?{scope:selectedCircuitScope,circuitId:selectedCircuitId,metroLine:selectedMetroLine,ids:[...selectedLocationIds]}:null;
  const settings=plannerSaved||{start:pe('buy-start').value,end:pe('buy-end').value,passesDay:Number(pe('buy-passes').value),durationSec:Number(pe('buy-duration').value),budget:500};
  for(const key of ['start','end','budget'])pe('plan-'+key).value=settings[key];
  pe('plan-passes').value=settings.passesDay;pe('plan-duration').value=settings.durationSec;
  pe('plan-scope').value=plannerSaved?.scope||selectedCircuitScope;
  plannerChosen=plannerSaved?'saved':plannerCurrent?'current':'';
  pe('plan-status').textContent=plannerSaved?pl('Plan recuperado de este navegador. Revisa las estimaciones actualizadas.','Plan restored from this browser. Review the updated estimates.'):'';
  pe('planner-modal').hidden=false;renderPlanner();pe('plan-close').focus();
}
function plannerSnapshot(row) {
  return {version:1,...plannerSettings(),scope:pe('plan-scope').value,circuitId:row.circuitId,metroLine:row.metroLine,ids:row.items.map(loc=>loc.id),target:plannerTarget};
}
function savePlanner() {
  const row=plannerRows.get(plannerChosen);if(!row?.items.length)return null;
  try {const saved=CampaignPlanner.save(localStorage,plannerSnapshot(row));pe('plan-status').textContent=pl('Plan guardado en este navegador.','Plan saved in this browser.');return saved;}
  catch {pe('plan-status').textContent=pl('No se ha podido guardar el plan. Comprueba el almacenamiento del navegador.','The plan could not be saved. Check browser storage.');return null;}
}
function usePlanner() {
  renderPlanner();
  if(pe('plan-use').disabled)return;
  const plan=savePlanner();if(!plan)return;
  selectedCircuitScope=plan.scope;selectedCircuitId=plan.circuitId;selectedMetroLine=plan.metroLine;
  circuitTarget=sanitizeCircuitTarget(plan.target);saveCircuitTarget();
  circuitAutoSelect=false;selectedLocationIds=new Set(plan.ids);plannerBudget=plan.budget;
  pe('buy-start').value=plan.start;pe('buy-end').value=plan.end;pe('buy-pass-date').value=plan.start;
  pe('buy-passes').value=plan.passesDay;pe('buy-duration').value=plan.durationSec;
  pe('planner-modal').hidden=true;renderCircuitSelector();openBuyCheckout();renderPlannerBudget();
}
function renderPlannerBudget() {
  const section=pe('buy-plan');if(!section)return;
  section.hidden=plannerBudget===null;if(section.hidden)return;
  pe('buy-plan-budget').value=plannerBudget;
  const q=calculateBuyQuote();
  pe('buy-plan-status').textContent=q.price>plannerBudget?pl('La estimación supera tu presupuesto en ','The estimate exceeds your budget by ')+formatMoney(q.price-plannerBudget):pl('Estimación dentro del presupuesto.','Estimate within budget.');
}
function persistCheckoutPlan() {
  if(plannerBudget===null)return;
  try {CampaignPlanner.save(localStorage,{version:1,scope:selectedCircuitScope,circuitId:selectedCircuitId,metroLine:selectedMetroLine,ids:[...selectedLocationIds],target:circuitTarget,
    start:pe('buy-start').value,end:pe('buy-end').value,passesDay:Number(pe('buy-passes').value),durationSec:Number(pe('buy-duration').value),budget:plannerBudget});}catch{renderPlannerBudget();pe('buy-plan-status').textContent=pl('Los últimos cambios no se han guardado. Revisa la selección, fechas y almacenamiento.','The latest changes were not saved. Check selection, dates and storage.');return;}
  renderPlannerBudget();
}
function bindPlanner() {
  pe('header-planner-btn').addEventListener('click',openPlanner);
  pe('circuit-planner-btn').addEventListener('click',openPlanner);
  pe('plan-close').addEventListener('click',()=>{pe('planner-modal').hidden=true;pe('header-planner-btn').focus();});
  pe('planner-modal').addEventListener('click',e=>{if(e.target===pe('planner-modal'))pe('planner-modal').hidden=true;});
  pe('planner-modal').addEventListener('keydown',e=>{if(e.key==='Escape'){pe('planner-modal').hidden=true;pe('header-planner-btn').focus();}});
  pe('plan-inputs').addEventListener('input',()=>{pe('plan-status').textContent='';renderPlanner();});
  pe('plan-table-body').addEventListener('change',e=>{if(e.target.name==='plan-circuit'){plannerChosen=e.target.value;renderPlanner();}});
  pe('plan-save').addEventListener('click',savePlanner);pe('plan-use').addEventListener('click',usePlanner);
  pe('plan-new').addEventListener('click',()=>{plannerSaved=null;plannerChosen='';plannerTarget=sanitizeCircuitTarget(circuitTarget);pe('plan-status').textContent=pl('Comparando el catálogo actual. Tu plan anterior se conserva hasta guardar otro.','Comparing the current catalogue. Your previous plan is kept until you save another.');renderPlanner();});
  pe('plan-target-edit').addEventListener('click',()=>{plannerAdoptCurrentTarget=true;circuitTarget=sanitizeCircuitTarget(plannerTarget);saveCircuitTarget();renderCircuitSelector();pe('circuit-panel').classList.remove('collapsed');pe('planner-modal').hidden=true;pe('circuit-panel').hidden=false;setCircuitTargetMode(true);});
  pe('buy-plan-budget').addEventListener('input',()=>{const n=Number(pe('buy-plan-budget').value);if(n>=0.01&&n<=1e12&&Number.isFinite(n)){plannerBudget=n;persistCheckoutPlan();}else pe('buy-plan-status').textContent=pl('Introduce un presupuesto válido.','Enter a valid budget.');});
  pe('buy-edit-selection').addEventListener('click',()=>{closeBuyCheckout();pe('circuit-panel').hidden=false;pe('circuit-panel').classList.remove('collapsed');renderCircuitSelector();});
}
function translatePlanner() {
  document.querySelectorAll('[data-pl-es]').forEach(el=>{el.textContent=el.getAttribute(LANG==='en'?'data-pl-en':'data-pl-es');});
  pe('plan-close').setAttribute('aria-label',pl('Cerrar planificador','Close planner'));
  if(!pe('planner-modal').hidden)renderPlanner();
}
bindPlanner();translatePlanner();
