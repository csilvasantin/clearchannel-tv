import {STEPS,proposal,proposalText,sameSelection} from './comercial-core.mjs?v=20261018-comercial-2';
if(!/^(www\.)?admira\.biz$/.test(location.hostname)&&!['localhost','127.0.0.1'].includes(location.hostname)&&!/(?:^|\.)clearchannel-tv\.pages\.dev$/.test(location.hostname))throw Error('commercial_host_required');
const ctx=window.AdmiraCommercialContext;
const language=()=>ctx?.language()==='en'?'en':'es';
const T=(es,en)=>language()==='en'?en:es;
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date());
const labels={
 title:['Comercial','Commercial'],intro:['Soy Comercial. Cuéntame qué quiere conseguir el anunciante y prepararemos su campaña.','I’m Commercial. Tell me what the advertiser wants to achieve and we’ll prepare the campaign.'],
 advertiser:['Anunciante','Advertiser'],objective:['Objetivo de la campaña','Campaign objective'],audience:['¿A quién quieres llegar?','Who do you want to reach?'],
 start:['Desde','From'],end:['Hasta','Until'],budget:['Presupuesto · EUR','Budget · EUR'],passesDay:['Pases diarios','Daily plays'],durationSec:['Duración · segundos','Duration · seconds'],
 targeting:['Elegir audiencias','Choose audiences'],locations:['Elegir ubicaciones','Choose locations'],adopt:['Usar la selección del mapa','Use the map selection'],generate:['Preparar propuesta','Prepare proposal'],
 planner:['Revisar en el planificador','Review in planner'],download:['Descargar propuesta','Download proposal'],close:['Cerrar Comercial','Close Commercial'],
 selected:['Aún no has incorporado una selección del mapa.','You have not adopted a map selection yet.'],return:['Volver a Comercial','Back to Commercial']};
const errors={brief_required:['Completa anunciante, objetivo y audiencia.','Enter advertiser, objective and audience.'],settings_invalid:['Revisa fechas, presupuesto, pases y duración.','Check dates, budget, daily plays and duration.'],catalogue_loading:['El catálogo todavía está cargando. Inténtalo cuando esté listo.','The catalogue is still loading. Try again once it is ready.'],locations_required:['Selecciona ubicaciones en el mapa e incorpóralas a la propuesta.','Select locations on the map and adopt them for the proposal.']};
const panel=document.createElement('section');panel.id='comercial-panel';panel.hidden=true;panel.setAttribute('aria-label',T('Comercial, asistente de campañas','Commercial campaign assistant'));
panel.innerHTML=`<header data-shell-keep><img class="commercial-face" src="/assets/comercial.svg" alt=""><h2 data-commercial="title"></h2><button class="commercial-close" type="button" data-commercial-aria="close">×</button></header><p data-commercial="intro"></p><form id="commercial-brief"><label><span data-commercial="advertiser"></span><input name="advertiser" maxlength="160" required autocomplete="organization"></label><label><span data-commercial="objective"></span><textarea name="objective" maxlength="2000" required></textarea></label><label><span data-commercial="audience"></span><textarea name="audience" maxlength="2000" required></textarea></label><div class="commercial-grid"><label><span data-commercial="start"></span><input name="start" type="date" required></label><label><span data-commercial="end"></span><input name="end" type="date" required></label></div><label><span data-commercial="budget"></span><input name="budget" type="number" min="0.01" step="0.01" max="1000000000000" required></label><div class="commercial-grid"><label><span data-commercial="passesDay"></span><select name="passesDay"><option>250</option><option>500</option><option selected>1000</option><option>2500</option></select></label><label><span data-commercial="durationSec"></span><select name="durationSec"><option>15</option><option>30</option><option>45</option><option>60</option></select></label></div><div class="commercial-actions"><button type="button" id="commercial-target" data-commercial="targeting"></button><button type="button" id="commercial-locations" data-commercial="locations"></button><button type="button" id="commercial-adopt" data-commercial="adopt"></button></div><p id="commercial-selection" data-commercial="selected"></p><button class="primary" type="submit" data-commercial="generate"></button></form><p id="commercial-status" role="status"></p><pre id="commercial-proposal" hidden></pre><div id="commercial-result-actions" class="commercial-actions" hidden><button type="button" id="commercial-plan" data-commercial="planner"></button><button type="button" id="commercial-download" data-commercial="download"></button></div>`;
document.body.append(panel);
const back=document.createElement('button');back.id='commercial-return';back.hidden=true;back.type='button';back.dataset.commercial='return';document.body.append(back);
const $=id=>document.getElementById(id),form=$('commercial-brief');
form.elements.start.value=today();form.elements.end.value=new Date(Date.parse(today()+'T00:00:00Z')+6*86400000).toISOString().slice(0,10);
let selected=null,result=null;
function translate(){for(const el of document.querySelectorAll('[data-commercial]')){const a=labels[el.dataset.commercial];if(a)el.textContent=a[language()==='en'?1:0];}panel.querySelector('[data-commercial-aria]').setAttribute('aria-label',T(...labels.close));if(result)$('commercial-proposal').textContent=proposalText(result,language());if(selected)$('commercial-selection').textContent=selectionText(selected);}
function selectionText(s){return s.circuit+' · '+s.items.length+' '+T('ubicaciones incorporadas','adopted locations')+' · '+s.target;}

function close(){panel.hidden=true;back.hidden=true;}
function open(step='brief'){
 if(!STEPS.includes(step))return {ok:false,error:'commercial_step_invalid'};
 ctx.hideLocations();panel.hidden=false;back.hidden=true;panel.scrollTop=0;translate();
 if(step==='audiencias')select(true);
 if(step==='ubicaciones')select(false);
 if(step==='propuesta')form.requestSubmit();
 return {ok:true,assistant:'comercial',step};
}
function select(target){panel.hidden=true;back.hidden=false;ctx.locations(target);}
function invalidate(){result=null;$('commercial-proposal').hidden=true;$('commercial-result-actions').hidden=true;$('commercial-status').textContent='';}
function error(e){const a=errors[e.message];$('commercial-status').textContent=a?T(...a):T('No se ha podido preparar la propuesta.','The proposal could not be prepared.');}
back.onclick=()=>open();panel.querySelector('.commercial-close').onclick=close;
$('commercial-target').onclick=()=>select(true);$('commercial-locations').onclick=()=>select(false);
$('commercial-adopt').onclick=()=>{try{const s=ctx.snapshot();if(!s.ready)throw Error('catalogue_loading');if(!s.items.length)throw Error('locations_required');selected=s;invalidate();$('commercial-selection').textContent=selectionText(s);}catch(e){error(e);}};
form.addEventListener('input',invalidate);
form.onsubmit=e=>{e.preventDefault();try{if(selected&&!sameSelection(ctx.snapshot(),selected))throw Error('locations_required');result=proposal(Object.fromEntries(new FormData(form)),selected,window.CampaignPlanner,today());$('commercial-proposal').textContent=proposalText(result,language());$('commercial-proposal').hidden=false;$('commercial-result-actions').hidden=false;$('commercial-status').textContent=T('Propuesta preparada para revisar.','Proposal ready for review.');}catch(e){invalidate();error(e);}};
$('commercial-plan').onclick=()=>{if(!result)return;try{const current=ctx.snapshot();if(!sameSelection(current,selected))throw Error('locations_required');ctx.planner(result.brief);close();}catch(e){error(e);}};
$('commercial-download').onclick=()=>{if(!result)return;const url=URL.createObjectURL(new Blob([proposalText(result,language())],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='propuesta-comercial.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.AdmiraComercial={lanzar:open,cerrar:close};
window.addEventListener('admira:assistant-default',close);
for(const event of ['admira:lang','admira:languagechange','admiranext:lang'])window.addEventListener(event,translate);
new MutationObserver(()=>{if(selected){const current=ctx.snapshot();if(sameSelection(current,selected)){selected.circuit=current.circuit;selected.target=current.target;}}translate();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
translate();
const query=new URLSearchParams(location.search);
if(query.get('asistente')==='comercial')open(STEPS.includes(query.get('paso'))?query.get('paso'):'brief');
