import {parseIncidentOrder,incidentLevel,INCIDENT_COLORS} from './bugito-xpacios-core.mjs?v=20261015-xpacios-1';
const en=()=>document.documentElement.lang==='en';
const T=(es,eng)=>en()?eng:es;
const endpoint='/api/bugito/';
const messages={sign_in_required:['Entra con tu cuenta de owner en Bugito.','Sign in as owner in Bugito.'],owner_required:['Tu cuenta no puede generar incidencias.','Your account cannot create incidents.'],order_format:['Indica proyecto, establecimiento y pantalla en la orden.','Include project, establishment and screen in the order.'],target_scope_changed:['El destino ha cambiado. Vuelve a seleccionarlo.','The destination changed. Select it again.']};
const errorText=code=>messages[code]?.[en()?1:0]||(/ambiguous/.test(code)?T('Hay varios destinos con ese nombre: usa su identificador.','Several destinations share that name: use its ID.'):/not_found/.test(code)?T('No se encuentra ese destino dentro del proyecto seleccionado.','That destination was not found in the selected project.'):T('No se ha confirmado la operación. Puedes consultar la ficha antes de volver a intentarlo.','The operation was not confirmed. Check the ticket before trying again.'));
let busy=false;
export async function createIncident(body) {
 if(busy)throw Error(T('Hay una orden en curso.','An order is already running.'));
 const token=window.BugitoSuper?.token();if(!token)throw Error(errorText('sign_in_required'));
 busy=true;
 try {
  const r=await fetch(endpoint+'incidents',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok||d.ok!==true)throw Error(errorText(d.error||''));
  window.dispatchEvent(new CustomEvent('bugito:incident-created',{detail:d}));
  return d;
 }finally{busy=false;}
}
export async function runOrder(order) {
 if(!parseIncidentOrder(order))throw Error(errorText('order_format'));
 const d=await createIncident({order});
 return T(`Incidencia ${d.id} abierta y pendiente de gestión · ${d.location.name} · ${d.screen.name}. ${d.url}`,`Incident ${d.id} open, awaiting handling · ${d.location.name} · ${d.screen.name}. ${d.url}`);
}
window.BugitoXpacios={runOrder,createIncident,parseIncidentOrder};
// Register with the existing Expert engine; keep the mascot and old lab commands working.
function register(E){if(!E?.verb)return;E.verb({name:'bugito',args:'genera una incidencia en el proyecto … en el establecimiento … y en la pantalla …',desc:['Incidencia persistente por proyecto, establecimiento y pantalla; normal, grave o total.','Persistent incident by project, establishment and screen; normal, severe or total.'],run:async(a,log)=>{
 const text=a.join(' ');let message;
 try {
  if(parseIncidentOrder(text))message=await runOrder(text);
  else if(window.AdmiraBugito)message=text?await window.AdmiraBugito.lanzar(text):window.AdmiraBugito.toggle();
  else if(window.AdmiraAvatar?.handle)return window.AdmiraAvatar.handle('/bugito'+(text?' '+text:''));
  else {location.assign('/bugito?lang='+(en()?'en':'es'));return;}
 }catch(e){message=e.message;if(!window.BugitoSuper?.token()&&parseIncidentOrder(text)){const a=document.createElement('a');a.href='/bugito?orden='+encodeURIComponent(text);a.textContent=T('Abrir Bugito para entrar y revisar la orden','Open Bugito to sign in and review the order');log?.append(a);}}
 if(log){const line=document.createElement('div');line.textContent=message||'';log.append(line);}return message;
 }});}
(window.AdmiraCommandAdapters||=[]).push(register);if(window.AdmiraExperto)register(window.AdmiraExperto);
async function load(q={}){const r=await fetch(endpoint+'targets?'+new URLSearchParams(q),{cache:'no-store'});const d=await r.json();if(!r.ok||!d.ok)throw Error(errorText(d.error||''));return d;}
const form=document.querySelector('#bugito-xpacios');
function translate(){
 for(const e of document.querySelectorAll('[data-bx-es]'))e.textContent=T(e.dataset.bxEs,e.dataset.bxEn);
 const orderInput=document.querySelector('#bugito-xpacios [name=order]');if(orderInput)orderInput.placeholder=T('genera una incidencia en el proyecto Starbucks en el establecimiento alsea-sbux-021 y en la pantalla 1','create an incident in project Starbucks in store alsea-sbux-021 and on screen 1');
 for(const select of document.querySelectorAll('#bugito-xpacios label select'))select.setAttribute('aria-label',select.closest('label').querySelector('span').textContent);
 const legend=document.querySelector('#incident-legend');if(legend)legend.title=T('Estado de las incidencias registradas; la ausencia de señal se consulta en el Supervisor.','Registered incident status; check missing device signals in Supervisor.');
}
if(form){
 const loginHost=form.querySelector('#bx-signin');let loginTries=0;
 const loginTimer=setInterval(()=>{loginTries++;if(window.BugitoSuper?.signedIn()){loginHost.textContent=T('Sesión de owner activa','Owner signed in');clearInterval(loginTimer);}else if(window.BugitoSuper?.init(loginHost,en()?'en':'es')||loginTries>=40)clearInterval(loginTimer);},500);
 window.BugitoSuper?.onChange(()=>{if(window.BugitoSuper.signedIn())loginHost.textContent=T('Sesión de owner activa','Owner signed in');else window.BugitoSuper.renderButton(loginHost,en()?'en':'es');});
 const project=form.querySelector('[name=project]'),site=form.querySelector('[name=location]'),screen=form.querySelector('[name=screen]'),status=form.querySelector('[role=status]'),order=form.querySelector('[name=order]'),submit=form.querySelector('button[type=submit]');let revision=0;
 const options=(select,rows)=>{select.replaceChildren(new Option(T('Selecciona…','Select…'),''),...rows.map(r=>new Option(r.name||r.label,r.id)));select.disabled=!rows.length;};
 async function populate(){try{options(project,(await load()).projects);}catch(e){status.textContent=e.message;}}
 project.addEventListener('change',async()=>{const version=++revision;options(site,[]);options(screen,[]);if(!project.value)return;try{const d=await load({project:project.value});if(version===revision)options(site,d.locations);}catch(e){if(version===revision)status.textContent=e.message;}});
 site.addEventListener('change',async()=>{const version=++revision;options(screen,[]);if(!site.value)return;try{const d=await load({project:project.value,location:site.value});if(version===revision)options(screen,d.screens);}catch(e){if(version===revision)status.textContent=e.message;}});
 form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;status.textContent=T('Registrando incidencia…','Registering incident…');try{
  const body=order.value.trim()?{order:order.value.trim()}:{project:project.value,location:site.value,screen:screen.value,severity:form.querySelector('[name=severity]').value,fault:form.querySelector('[name=fault]').value};
  const d=await createIncident(body);status.replaceChildren(document.createTextNode(T('Incidencia abierta y pendiente de gestión: ','Incident open, awaiting handling: ')));const a=document.createElement('a');a.href=d.url;a.textContent=d.id;a.target='_blank';a.rel='noopener';status.append(a,document.createTextNode(' · '+d.location.name+' · '+d.screen.name));
 }catch(err){status.textContent=err.message;}finally{submit.disabled=false;}});
 order.value=new URLSearchParams(location.search).get('orden')||'';
 populate();
}
// Canonical snapshot, shared by every marker and cluster. Preserve the last snapshot on errors.
const mapPage=document.querySelector('#map');
if(mapPage){
 const state={ready:false,stale:false,states:new Map(),version:0,level(id){return this.ready?incidentLevel(this.states.get(String(id))):-1;},poll:null};window.BugitoIncidentMap=state;
 const legend=document.createElement('aside');legend.id='incident-legend';legend.setAttribute('aria-live','polite');
 legend.innerHTML='<b data-bx-es="Incidencias" data-bx-en="Incidents">Incidencias</b><span><i style="background:#39d98a"></i><span data-bx-es="Sin incidencias" data-bx-en="No incidents">Sin incidencias</span></span><span><i style="background:#ffd23f"></i><span data-bx-es="Incidencia abierta" data-bx-en="Open incident">Incidencia abierta</span></span><span><i style="background:#ff4d4d"></i><span data-bx-es="Grave o total" data-bx-en="Severe or total">Grave o total</span></span><small></small>';
 document.body.append(legend);
 let running=false;
 state.poll=async()=>{if(running||document.hidden)return;running=true;try{
  const r=await fetch('https://api.yokup.com/incident/map?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(12000)});const d=await r.json();
  if(!r.ok||d.ok!==true||!Array.isArray(d.locations)||!Number.isFinite(d.generated_at)||Date.now()-d.generated_at>60000)throw Error('unavailable');
  const next=new Map();for(const row of d.locations){if(typeof row.id!=='string'||!Number.isFinite(row.active)||!Number.isFinite(row.severe))throw Error('invalid');next.set(row.id,row);}
  state.states=next;state.ready=true;state.stale=false;state.version++;legend.querySelector('small').textContent='';
 }catch{state.stale=true;legend.querySelector('small').textContent=T('Estado sin actualizar','Status not refreshed');}
 finally{running=false;window.dispatchEvent(new Event('bugito:map-status'));}};
 state.poll();setInterval(state.poll,15000);window.addEventListener('bugito:incident-created',()=>state.poll());window.addEventListener('focus',()=>state.poll());
}
translate();window.addEventListener('admira:lang',translate);
