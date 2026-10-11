import {CENTRAL,ProjectClient,connectCentral} from './central-project-client.mjs?v=central-2';
let storage;try{storage=sessionStorage;}catch{}
const client=new ProjectClient({storage}),$=id=>document.getElementById(id),status=$('central-status');
// Keep localized display text so ENG/ESP repaints the current state without another request.
function setText(node,es,en){
  node.dataset.centralEs=es;node.dataset.centralEn=en;
  node.textContent=document.documentElement.lang==='en'?en:es;
}
function setStatus(es,en){setText(status,es,en);}
function paintLanguage(){
  const en=document.documentElement.lang==='en';
  document.querySelectorAll('#central-project-panel [data-central-es]').forEach(node=>{
    node.textContent=en?node.dataset.centralEn:node.dataset.centralEs;
  });
}
document.addEventListener('admira:lang',paintLanguage);
new MutationObserver(paintLanguage).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

async function load(){try{const d=await client.context();$('central-projects').replaceChildren();for(const p of d.projects){const card=document.createElement('article');card.className='demo-card';const h=document.createElement('h3');h.textContent=p.name;card.append(h);const venues=d.venues.filter(v=>v.project_id===p.id);if(!venues.length){const note=document.createElement('p');setText(note,'Sin local asociado','No associated venue');card.append(note);}for(const v of venues){const a=document.createElement('a'),url=new URL(v.xpace_url);if(!['https://www.xpaceos.com','https://www.admira.store'].includes(url.origin))continue;a.textContent=v.name+' ↗';a.href=url.href;a.target='_blank';a.rel='noopener';card.append(a);}$('central-projects').append(card);}setStatus(d.projects.length+' '+(d.projects.length===1?'proyecto autorizado':'proyectos autorizados')+' · AdmiraNext',d.projects.length+' '+(d.projects.length===1?'authorized project':'authorized projects')+' · AdmiraNext');}catch(e){console.warn('AdmiraNext project context:',e.name,e.message);$('central-projects').replaceChildren();if(e.message==='SESSION_EXPIRED')setStatus('Conecta con AdmiraNext','Connect with AdmiraNext');else setStatus('AdmiraNext no disponible','AdmiraNext unavailable');}}
$('central-refresh').onclick=load;$('central-disconnect').onclick=async()=>{await client.disconnect();await load();};
let cancelConnection=null;
$('central-connect').onclick=()=>{if(cancelConnection){cancelConnection();cancelConnection=null;setStatus('Conexión cancelada','Connection cancelled');return;}cancelConnection=connectCentral(client,{onWaiting(){setStatus('Completa el login en AdmiraNext','Complete the AdmiraNext login');},onComplete(){cancelConnection=null;load();},onError(){cancelConnection=null;setStatus('No se pudo conectar. Vuelve a intentarlo','Unable to connect. Try again');}});};
$('btn-logout')?.addEventListener('click',()=>{cancelConnection?.();client.disconnect();$('central-projects').replaceChildren();});
if(client.access)load();else setStatus('Conecta con AdmiraNext','Connect with AdmiraNext');
