(function(root){
 'use strict';
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function html(row,lang='es'){
  const inc=row?.incident;if(!Number.isFinite(row?.active)||row.active<1||!/^INC-[A-Z0-9]{4,16}$/.test(inc?.id||''))return '';
  const en=lang==='en',summary=inc.summary?.[en?'en':'es'];if(typeof summary!=='string'||!summary.trim())return '';
  const severe=Number(row.severe)>0;
  return '<section class="xp-incident '+(severe?'is-severe':'is-open')+'"><strong>'+(en?(severe?'Severe incident':'Open incident'):(severe?'Incidencia grave':'Incidencia abierta'))+'</strong><p>'+escape(summary.slice(0,180))+'</p>'
   +(row.active>1?'<small>'+escape(en?row.active+' open · most severe shown':row.active+' abiertas · se muestra la más grave')+'</small>':'')
   +'<a class="xp-incident-more" href="https://www.admira.app/ticket?id='+encodeURIComponent(inc.id)+'" target="_blank" rel="noopener noreferrer">'+(en?'View more':'Ver más')+' ↗</a></section>';
 }
 function choose(features=[]){return [...features].sort((a,b)=>(Number(b.properties?.incidentLevel)||0)-(Number(a.properties?.incidentLevel)||0))[0]}
 function hover(remove,{delay=400,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  let timer=null,element=null;
  const hold=()=>{if(timer!==null)clearTimer(timer);timer=null};
  const hide=()=>{hold();timer=setTimer(()=>{timer=null;if(!element?.matches(':hover,:focus-within'))remove()},delay)};
  const bind=node=>{element=node;if(!node||node.dataset.xpHoverBound)return;node.dataset.xpHoverBound='1';for(const e of ['mouseenter','focusin'])node.addEventListener(e,hold);for(const e of ['mouseleave','focusout'])node.addEventListener(e,hide)};
  return {hold,hide,bind,reset(){hold();element=null;remove()}};
 }
 const api={html,choose,hover};root.IncidentMapTooltip=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
