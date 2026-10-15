import {isPhysicalOrder} from './bugito-command-core.mjs?v=20261015-command-1';
const T=(es,en)=>document.documentElement.lang==='en'?en:es;
const messages={sign_in_required:['Entra con tu cuenta de owner para enviar la orden al MBP16.','Sign in as owner to send the command to MBP16.'],owner_required:['Tu sesión no permite controlar el equipo físico.','Your session cannot control this physical device.'],device_without_recent_signal:['El MBP16 no publica señal reciente: no se ha enviado ningún fallo.','MBP16 has no recent signal: no fault was sent.'],physical_target_not_configured:['No hay un equipo físico vinculado a ese destino. Usa el proyecto, establecimiento y pantalla registrados.','No physical device is bound to that destination. Use a registered project, establishment and screen.'],command_unknown:['No se puede confirmar el envío. Comprueba el Supervisor antes de repetir la orden.','Delivery is uncertain. Check Supervisor before repeating the command.']};
const message=code=>(messages[code]||['No se ha confirmado la operación: '+code,'Operation not confirmed: '+code])[document.documentElement.lang==='en'?1:0];
let running=false;
function say(text){let el=document.getElementById('bugito-command-status');if(!el){el=document.createElement('p');el.id='bugito-command-status';el.setAttribute('role','status');document.getElementById('bugito-xpacios')?.append(el);}if(el)el.textContent=text;return text;}
export async function runPhysicalOrder(order,{requestId=crypto.randomUUID()}={}){
 if(running)throw Error(T('Hay una orden física en curso.','A physical command is already running.'));
 const token=window.BugitoSuper?.token();if(!token)throw Error(message('sign_in_required'));
 running=true;
 try{
  say(T('Enviando orden al equipo físico…','Sending command to the physical device…'));
  const response=await fetch('/api/bugito/commands',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({order,request_id:requestId})});
  const d=await response.json();if(!response.ok||d.ok!==true)throw Error(message(d.error||'unavailable'));
  window.dispatchEvent(new CustomEvent('bugito:command-queued',{detail:d}));
  say(T(`Orden en cola · ${d.target.name}. Esperando ejecución y medida del reproductor…`,`Command queued · ${d.target.name}. Waiting for execution and player measurement…`));
  const end=Date.now()+90000;let last=null;
  while(Date.now()<end){
   await new Promise(resolve=>setTimeout(resolve,3000));
   try{const r=await fetch('/api/bugito/status?id='+encodeURIComponent(requestId),{cache:'no-store'});if(!r.ok)continue;last=await r.json();}catch{continue;}
   if(last.executed&&last.detected){
    const result={...d,...last};window.dispatchEvent(new CustomEvent('bugito:command-observed',{detail:result}));
    return say(T(`Ejecutada y medida en ${d.target.name} · ${d.command}. El Supervisor documenta la incidencia y sus fotos: ${d.supervisor}`,`Executed and measured on ${d.target.name} · ${d.command}. Supervisor documents the incident and photos: ${d.supervisor}`));
   }
   say(last.executed?T('Orden ejecutada; esperando una medida reciente que confirme el resultado.','Command executed; waiting for a recent measurement to confirm the result.'):T('Orden enviada; ejecución todavía sin confirmar.','Command sent; execution is not confirmed yet.'));
  }
  return say(T('Orden enviada, pero el resultado físico aún no está confirmado. Consulta el Supervisor antes de repetirla.','Command sent, but its physical result is not confirmed yet. Check Supervisor before repeating it.'));
 }catch(e){say(e.message);throw e;}finally{running=false;}
}
window.BugitoPhysical={runOrder:runPhysicalOrder};
// Only the server's validated POST navigation can create this node. Query
// strings merely prefill the old form; they never trigger physical execution.
const node=document.getElementById('bugito-command-intent');
if(node){
 let intent;try{intent=JSON.parse(node.textContent);}catch{}
 if(intent&&isPhysicalOrder(intent.order)){
  history.replaceState(null,'','/bugito?lang='+(new URLSearchParams(location.search).get('lang')==='en'?'en':'es'));
  const input=document.querySelector('#bugito-xpacios [name=order]');if(input)input.value=intent.order;
  let started=false;
  const run=()=>{
   if(started)return;if(!window.BugitoSuper?.token()){say(message('sign_in_required'));return;}
   const key='bugito-command:'+intent.request_id;
   try{if(sessionStorage.getItem(key)){say(T('Esta orden ya se ha atendido. No se vuelve a enviar al recargar.','This command has already been handled. Reloading does not send it again.'));return;}sessionStorage.setItem(key,'consumed');}catch{say(T('No se puede guardar el control de duplicados. Escribe la orden en la consola.','Duplicate protection could not be saved. Enter the command in the console.'));return;}
   started=true;runPhysicalOrder(intent.order,{requestId:intent.request_id}).catch(()=>{});
  };
  window.BugitoSuper?.onChange(run);run();
 }
}
