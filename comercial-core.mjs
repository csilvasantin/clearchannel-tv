// Commercial proposals use the existing CampaignPlanner; no duplicate price model.
export const STEPS = Object.freeze(['brief', 'audiencias', 'ubicaciones', 'propuesta']);
const clean = (v, max = 2000) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
export function normalizeBrief(raw = {}) {
  return {advertiser:clean(raw.advertiser,160),objective:clean(raw.objective),audience:clean(raw.audience),
    start:clean(raw.start,10),end:clean(raw.end,10),budget:Number(raw.budget),passesDay:Number(raw.passesDay),durationSec:Number(raw.durationSec)};
}
export function proposal(raw, snapshot, planner, today) {
  const brief=normalizeBrief(raw);
  if(!brief.advertiser || !brief.objective || !brief.audience)throw Error('brief_required');
  if(!planner.validSettings(brief,today))throw Error('settings_invalid');
  if(!snapshot?.ready)throw Error('catalogue_loading');
  const items=[...new Map((snapshot.items||[]).map(x=>[x.id,x])).values()];
  if(!items.length)throw Error('locations_required');
  // Missing input is unknown: do not silently inherit the planner's default CPM.
  const complete=items.every(x=>Number.isFinite(x.impr)&&x.impr>=0&&Number.isFinite(x.cpm)&&x.cpm>=0);
  const estimate=complete?planner.quote(items,brief):null;
  return {schema:'admira.comercial-propuesta/1',status:'draft',brief,circuit:clean(snapshot.circuit,200),target:clean(snapshot.target),
    locations:items.map(x=>({id:clean(x.id,160),name:clean(x.name,200),demo:x.demo===true})),estimate,
    hasDemonstration:items.some(x=>x.demo===true),createdOn:today,
    budgetExceeded:estimate?estimate.price>brief.budget:null,availability:'unconfirmed',audienceMetric:'estimated_opportunities_not_unique_people'};
}
export function proposalText(p,lang='es') {
  const en=lang==='en',t=(a,b)=>en?b:a,n=v=>new Intl.NumberFormat(en?'en-GB':'es-ES').format(v),money=v=>new Intl.NumberFormat(en?'en-GB':'es-ES',{style:'currency',currency:'EUR'}).format(v);
  return [t('Propuesta de campaña · borrador','Campaign proposal · draft'),p.brief.advertiser,p.brief.objective,
    t('Audiencia solicitada: ','Requested audience: ')+p.brief.audience,t('Segmentación del mapa: ','Map targeting: ')+(p.target||'—'),
    p.circuit,p.brief.start+' → '+p.brief.end,t('Ubicaciones seleccionadas: ','Selected locations: ')+p.locations.length,
    ...p.locations.map(x=>'• '+x.name+' ['+x.id+']'+(x.demo?t(' · demostración',' · demonstration'):'')),
    p.hasDemonstration?t('Incluye ubicaciones de demostración: revisar y sustituir antes de una propuesta comercial definitiva.','Includes demonstration locations: review and replace before a final commercial proposal.'):'',t('Presupuesto: ','Budget: ')+money(p.brief.budget),
    p.estimate?t('Oportunidades estimadas: ','Estimated opportunities: ')+n(p.estimate.estimatedImpr)+' · '+t('Importe orientativo: ','Indicative price: ')+money(p.estimate.price):t('Faltan datos del catálogo para calcular impresiones y precio.','Catalogue inputs for impressions and price are missing.'),
    p.budgetExceeded?t('La estimación supera el presupuesto.','The estimate exceeds the budget.'):'',
    t('Estimación, no personas únicas. Disponibilidad y precio sujetos a confirmación. No reserva ni publica una campaña.','Estimate, not unique people. Availability and price require confirmation. Does not book or publish a campaign.')].filter(Boolean).join('\n');
}
