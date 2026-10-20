import {STEPS,proposal,proposalText,proposalHtml,proposalMailto,sameSelection,merchantBrief,merchantText,merchantHtml,merchantMailto,briefDesdeTexto} from './comercial-core.mjs?v=20261020-comercial-10';
// La cara y la voz (Carlos, 20-oct-2026: «que Comercial escuche el brief por el micro y responda con la voz de Admirito,
// como el Arquitecto»): la nube de digitalavatar.ai con la piel «comercial» (corbata y maletín). Lo que se le dice, por
// texto o por su micro, llega aquí (da-comercial-texto) y se interpreta como brief; aquí se le cuenta en qué está
// (da-comercial {estado, texto}). Si la nube no carga, un 🎙️ propio (Web Speech) y la voz del navegador.
export const NUBE_ORIGEN='https://digitalavatar.ai';
export const nubeUrl=lang=>`${NUBE_ORIGEN}/nube.html?personaje=comercial&embed=0&dock=1&tier=good&lang=${lang==='en'?'en':'es'}`;
import {hacerMovible} from './movible.mjs?v=20261020-comercial-4';
// Entradas visibles (Carlos, 20-oct-2026): botón en la cabecera de la portada y «Anunciarme aquí» en la ficha de cada
// Xpacio, que abre Comercial con ese local ya incorporado. Ambos vienen ocultos en el HTML: sólo aparecen si este módulo
// carga (en clearchannel.tv no hay Comercial).
if(!/^(www\.)?admira\.biz$/.test(location.hostname)&&!['localhost','127.0.0.1'].includes(location.hostname)&&!/(?:^|\.)clearchannel-tv\.pages\.dev$/.test(location.hostname))throw Error('commercial_host_required');
const ctx=window.AdmiraCommercialContext;
const language=()=>ctx?.language()==='en'?'en':'es';
const T=(es,en)=>language()==='en'?en:es;
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date());
const labels={
 campaigns:['Vender campañas','Sell campaigns'],merchants:['Captar comercios','Recruit merchants'],shopName:['Nombre del comercio','Business name'],city:['Ciudad','City'],address:['Dirección','Address'],contact:['Contacto (opcional)','Contact (optional)'],screens:['Número de pantallas','Number of screens'],notes:['Ubicación de pantallas y necesidades','Screen placement and requirements'],prepareShop:['Preparar ficha de captación','Prepare recruitment brief'],portal:['Continuar en el portal de comercios','Continue in merchant portal'],downloadShop:['Descargar texto','Download text'],pdfShop:['Ficha en PDF','Brief as PDF'],mailShop:['Enviar por correo','Send by email'],
 mailShopListo:['Se abre tu correo con el asunto, el resumen y el contacto comercial en copia: adjunta el PDF y envíalo.','Your mail app opens with the subject, the summary and the commercial contact in copy: attach the PDF and send it.'],
 title:['Comercial','Commercial'],eyebrow:['Admirito · comercial','Admirito · commercial'],dictar:['Dictar el brief','Dictate the brief'],escuchando:['Te escucho…','Listening…'],dictadoNo:['Este navegador no puede dictar: escribe el brief.','This browser cannot dictate: type the brief.'],
 propuestaVoz:[(n,o,i)=>`Propuesta lista: ${n} ubicaciones${o?', '+o+' oportunidades estimadas':''}${i?' e importe orientativo de '+i:''}. La tienes en PDF o por correo.`,(n,o,i)=>`Proposal ready: ${n} locations${o?', '+o+' estimated opportunities':''}${i?' and an indicative price of '+i:''}. Get it as PDF or by email.`],here:['💼 Anunciarme aquí','💼 Advertise here'],entrada:['Comercial · campañas y comercios','Commercial · campaigns and merchants'],intro:['Soy Comercial. Vendemos campañas a anunciantes e incorporamos comercios y pantallas a la red.','I’m Commercial. We sell advertiser campaigns and recruit merchants and screens for the network.'],
 advertiser:['Anunciante','Advertiser'],email:['Correo del anunciante (opcional, para enviar la propuesta)','Advertiser email (optional, to send the proposal)'],mail:['Enviar por correo','Send by email'],
 mailListo:['Se abre tu correo con el asunto, el resumen y el contacto comercial en copia: adjunta el PDF y envíalo.','Your mail app opens with the subject, the summary and the commercial contact in copy: attach the PDF and send it.'],objective:['Objetivo de la campaña','Campaign objective'],audience:['¿A quién quieres llegar?','Who do you want to reach?'],
 start:['Desde','From'],end:['Hasta','Until'],budget:['Presupuesto · EUR','Budget · EUR'],passesDay:['Pases diarios','Daily plays'],durationSec:['Duración · segundos','Duration · seconds'],
 targeting:['Elegir audiencias','Choose audiences'],locations:['Elegir ubicaciones','Choose locations'],adopt:['Usar la selección del mapa','Use the map selection'],generate:['Preparar propuesta','Prepare proposal'],
 planner:['Revisar en el planificador','Review in planner'],download:['Descargar texto','Download text'],pdf:['Propuesta en PDF','Proposal as PDF'],
 pdfListo:['Elige «Guardar como PDF» en el diálogo de impresión: la propuesta sale con la marca, lista para enviar.','Choose “Save as PDF” in the print dialog: the proposal comes out branded, ready to send.'],pdfNo:['No se pudo abrir el diálogo de impresión.','The print dialog could not be opened.'],close:['Cerrar Comercial','Close Commercial'],
 selected:['Aún no has incorporado una selección del mapa.','You have not adopted a map selection yet.'],return:['Volver a Comercial','Back to Commercial']};
const errors={brief_required:['Completa anunciante, objetivo y audiencia.','Enter advertiser, objective and audience.'],settings_invalid:['Revisa fechas, presupuesto, pases y duración.','Check dates, budget, daily plays and duration.'],catalogue_loading:['El catálogo todavía está cargando. Inténtalo cuando esté listo.','The catalogue is still loading. Try again once it is ready.'],locations_required:['Selecciona ubicaciones en el mapa e incorpóralas a la propuesta.','Select locations on the map and adopt them for the proposal.']};
const panel=document.createElement('section');panel.id='comercial-panel';panel.hidden=true;panel.setAttribute('aria-label',T('Comercial, asistente de campañas','Commercial campaign assistant'));
panel.innerHTML=`<header data-shell-keep><img class="commercial-face" src="/assets/comercial.svg" alt=""><div class="commercial-titulo"><span class="commercial-eyebrow" data-commercial="eyebrow"></span><h2 data-commercial="title"></h2></div><button class="commercial-mic" type="button" id="commercial-mic" aria-label="Dictar" title="Dictar el brief">🎙️</button><button class="commercial-close" type="button" data-commercial-aria="close">×</button></header><div class="commercial-nube" id="commercial-nube" hidden></div><div class="commercial-cuerpo"><p data-commercial="intro"></p><div class="commercial-actions commercial-modos" role="group"><button type="button" id="commercial-campaigns" data-commercial="campaigns" aria-pressed="true"></button><button type="button" id="commercial-merchants" data-commercial="merchants" aria-pressed="false"></button></div><section id="commercial-campaign-section"><form id="commercial-brief"><label><span data-commercial="advertiser"></span><input name="advertiser" maxlength="160" required autocomplete="organization"></label><label><span data-commercial="email"></span><input name="email" type="email" maxlength="254" autocomplete="email" inputmode="email"></label><label><span data-commercial="objective"></span><textarea name="objective" maxlength="2000" required></textarea></label><label><span data-commercial="audience"></span><textarea name="audience" maxlength="2000" required></textarea></label><div class="commercial-grid"><label><span data-commercial="start"></span><input name="start" type="date" required></label><label><span data-commercial="end"></span><input name="end" type="date" required></label></div><label><span data-commercial="budget"></span><input name="budget" type="number" min="0.01" step="0.01" max="1000000000000" required></label><div class="commercial-grid"><label><span data-commercial="passesDay"></span><select name="passesDay"><option>250</option><option>500</option><option selected>1000</option><option>2500</option></select></label><label><span data-commercial="durationSec"></span><select name="durationSec"><option>15</option><option>30</option><option>45</option><option>60</option></select></label></div><div class="commercial-actions"><button type="button" id="commercial-target" data-commercial="targeting"></button><button type="button" id="commercial-locations" data-commercial="locations"></button><button type="button" id="commercial-adopt" data-commercial="adopt"></button></div><p id="commercial-selection" data-commercial="selected"></p><button class="primary" type="submit" data-commercial="generate"></button></form><p id="commercial-status" role="status"></p><pre id="commercial-proposal" hidden></pre><div id="commercial-result-actions" class="commercial-actions" hidden><button type="button" id="commercial-pdf" class="primary" data-commercial="pdf"></button><button type="button" id="commercial-mail" data-commercial="mail"></button><button type="button" id="commercial-plan" data-commercial="planner"></button><button type="button" id="commercial-download" data-commercial="download"></button></div></section><section id="commercial-merchant-section" hidden><form id="commercial-merchant-form"><label><span data-commercial="shopName"></span><input name="name" maxlength="120" required></label><label><span data-commercial="city"></span><input name="city" maxlength="120" required></label><label><span data-commercial="address"></span><input name="address" maxlength="300" required></label><label><span data-commercial="contact"></span><input name="contact" maxlength="254"></label><label><span data-commercial="screens"></span><input name="screens" type="number" min="1" max="10000" step="1" required></label><label><span data-commercial="notes"></span><textarea name="notes" maxlength="2000"></textarea></label><button type="submit" data-commercial="prepareShop"></button></form><p id="commercial-merchant-status" role="status"></p><pre id="commercial-merchant-output" hidden></pre><div id="commercial-merchant-actions" hidden><button type="button" id="commercial-merchant-pdf" class="primary" data-commercial="pdfShop"></button><button type="button" id="commercial-merchant-mail" data-commercial="mailShop"></button><button type="button" id="commercial-merchant-download" data-commercial="downloadShop"></button><p><a href="https://admira.app/retailer" data-commercial="portal"></a></p></div></section></div>`;
document.body.append(panel);
// Ventana movible (norma de Carlos, 15/16-oct-2026): se mueve por la cabecera, cambia de tamaño por la esquina y vuelve a su sitio con doble clic; recuerda dónde se dejó (sólo la posición, nunca el brief).
const ventana=matchMedia('(max-width:600px)').matches?null:hacerMovible(panel,panel.querySelector('header'),{clave:'admira.comercial.ventana'});
const back=document.createElement('button');back.id='commercial-return';back.hidden=true;back.type='button';back.dataset.commercial='return';document.body.append(back);
const $=id=>document.getElementById(id),form=$('commercial-brief');
form.elements.start.value=today();form.elements.end.value=new Date(Date.parse(today()+'T00:00:00Z')+6*86400000).toISOString().slice(0,10);
let selected=null,result=null,merchant=null;
function translate(){for(const el of document.querySelectorAll('[data-commercial]')){const a=labels[el.dataset.commercial];if(a)el.textContent=a[language()==='en'?1:0];}panel.querySelector('[data-commercial-aria]').setAttribute('aria-label',T(...labels.close));if(merchant)$('commercial-merchant-output').textContent=merchantText(merchant,language());if(result)$('commercial-proposal').textContent=proposalText(result,language());if(selected)$('commercial-selection').textContent=selectionText(selected);}
function selectionText(s){return s.circuit+' · '+s.items.length+' '+T('ubicaciones incorporadas','adopted locations')+' · '+s.target;}

// ── Voz: la nube de Admirito (digitalavatar.ai) o, si no carga, la voz del navegador ──
const nubeCaja=document.getElementById('commercial-nube');let nubeFrame=null,nubeLista=false;
function montarNube(){if(nubeFrame||!nubeCaja)return;nubeFrame=document.createElement('iframe');nubeFrame.src=nubeUrl(language());nubeFrame.title='Comercial · Admirito';nubeFrame.setAttribute('allow','microphone');nubeCaja.append(nubeFrame);}   /* sin loading=lazy: dentro de un hueco oculto no cargaba nunca y la nube no avisaba de que estaba lista */
// La nube pone la cara, el gesto, el bocadillo, el lip-sync y, desde el 20-oct-2026, la voz de Admirito con audio
// (ElevenLabs, por brain.digitalavatar.ai/tts, dentro de la propia nube). Sólo si la nube no está, la voz del navegador.
function hablar(texto){try{if('speechSynthesis' in window&&texto){const u=new SpeechSynthesisUtterance(texto);u.lang=language()==='en'?'en-GB':'es-ES';u.rate=1.02;window.speechSynthesis.cancel();window.speechSynthesis.speak(u);}}catch{}}
function decir(estado,texto,silencio=false){
 if(nubeLista&&nubeFrame){try{nubeFrame.contentWindow.postMessage({type:'da-comercial',estado,texto:texto||'',silencio,lang:language()},NUBE_ORIGEN);return;}catch{}}
 if(!silencio&&texto)hablar(texto);
}
window.addEventListener('message',ev=>{
 if(!nubeFrame||ev.source!==nubeFrame.contentWindow||ev.origin!==NUBE_ORIGEN||!ev.data||typeof ev.data!=='object')return;
 if(ev.data.type==='da-comercial-listo'){nubeLista=true;nubeCaja.hidden=false;decir(panel.hidden?'reposo':'escuchando','',true);return;}
 if(ev.data.type==='da-comercial-texto'&&typeof ev.data.texto==='string')aplicarDictado(ev.data.texto);
});
// ── Dictado: del texto (micro de la nube, micro propio o teclado) al brief ──
function aplicarDictado(texto){
 const r=briefDesdeTexto(texto,{hoy:today(),lang:language()});
 if(r.intencion==='comercios'){open('comercios');decir('escuchando',T('Vamos a captar un comercio: nombre, ciudad, dirección y pantallas.','Let\'s recruit a merchant: name, city, address and screens.'));return r;}
 if(r.intencion==='ubicaciones'){open('ubicaciones');decir('escuchando',T('Elige las ubicaciones en el mapa y pulsa «Usar la selección».','Choose the locations on the map and press “Use the selection”.'));return r;}
 if(r.intencion==='audiencias'){open('audiencias');decir('escuchando',T('Elige las audiencias y vuelve.','Choose the audiences and come back.'));return r;}
 if(r.intencion==='propuesta'){open('brief');form.requestSubmit();return r;}
 open('brief');
 for(const k of Object.keys(r.campos)){const el=form.elements[k];if(el)el.value=String(r.campos[k]);}
 if(Object.keys(r.campos).length)invalidate();
 $('commercial-status').textContent=r.resumen;
 decir(Object.keys(r.campos).length?'apuntando':'dudando',r.resumen);
 return r;
}
const mic=document.getElementById('commercial-mic');let rec=null;
mic.onclick=()=>{
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){$('commercial-status').textContent=T(...labels.dictadoNo);return;}
 if(rec){rec.stop();return;}
 rec=new SR();rec.lang=language()==='en'?'en-GB':'es-ES';rec.interimResults=false;rec.continuous=false;
 rec.onresult=e=>{const t=Array.from(e.results).map(x=>x[0].transcript).join(' ').trim();if(t)aplicarDictado(t);};
 rec.onend=()=>{mic.classList.remove('live');rec=null;};rec.onerror=()=>{mic.classList.remove('live');rec=null;$('commercial-status').textContent=T(...labels.dictadoNo);};
 mic.classList.add('live');$('commercial-status').textContent=T(...labels.escuchando);decir('escuchando','',true);rec.start();
};
function close(){panel.hidden=true;back.hidden=true;vestirEntradas();decir('reposo','',true);}
function open(step='brief'){
 if(!STEPS.includes(step))return {ok:false,error:'commercial_step_invalid'};
 $('commercial-campaign-section').hidden=step==='comercios';$('commercial-merchant-section').hidden=step!=='comercios';$('commercial-campaigns').setAttribute('aria-pressed',String(step!=='comercios'));$('commercial-merchants').setAttribute('aria-pressed',String(step==='comercios'));ctx.hideLocations();panel.hidden=false;back.hidden=true;panel.querySelector('.commercial-cuerpo').scrollTop=0;translate();vestirEntradas();if(ventana)ventana.restaurar();
 montarNube();
 if(step==='audiencias')select(true);
 if(step==='ubicaciones')select(false);
 if(step==='propuesta')form.requestSubmit();
 return {ok:true,assistant:'comercial',step};
}
function select(target){panel.hidden=true;back.hidden=false;ctx.locations(target);}
function invalidate(){result=null;$('commercial-proposal').hidden=true;$('commercial-result-actions').hidden=true;$('commercial-status').textContent='';}
function error(e){const a=errors[e.message];const m=a?T(...a):T('No se ha podido preparar la propuesta.','The proposal could not be prepared.');$('commercial-status').textContent=m;decir('dudando',m);}
back.onclick=()=>open();panel.querySelector('.commercial-close').onclick=close;
$('commercial-target').onclick=()=>select(true);$('commercial-locations').onclick=()=>select(false);
function adoptar(){const s=ctx.snapshot();if(!s.ready)throw Error('catalogue_loading');if(!s.items.length)throw Error('locations_required');selected=s;invalidate();$('commercial-selection').textContent=selectionText(s);}
$('commercial-adopt').onclick=()=>{try{adoptar();const nf=v=>new Intl.NumberFormat(language()==='en'?'en-GB':'es-ES').format(v),mf=v=>new Intl.NumberFormat(language()==='en'?'en-GB':'es-ES',{style:'currency',currency:'EUR'}).format(v);decir('entregando',labels.propuestaVoz[language()==='en'?1:0](result.locations.length,result.estimate?nf(result.estimate.estimatedImpr):'',result.estimate?mf(result.estimate.price):''));}catch(e){error(e);}};
// «Anunciarme aquí»: la selección del mapa pasa a ser ese local y Comercial lo incorpora al abrirse.
// Si el catálogo aún carga, la selección se vuelve a fijar cuando esté listo (al cargar, el mapa reponía «todos los puntos»
// y la propuesta salía con miles de ubicaciones): se espera hasta 20 s y entonces se incorpora el local.
let pendiente=null,esperas=0;
function incorporarPendiente(){if(!pendiente)return;const s=ctx.snapshot();if(!s.ready){if(esperas++<40)setTimeout(incorporarPendiente,500);return;}const id=pendiente;pendiente=null;if(ctx.seleccionar(id)){try{adoptar();}catch(e){error(e);}}}
function abrirConLocal(id){open('brief');if(!id||typeof ctx.seleccionar!=='function')return;pendiente=id;esperas=0;incorporarPendiente();}
const entrada=document.getElementById('header-comercial-toggle'),aqui=document.getElementById('p-comercial');
if(entrada){entrada.hidden=false;entrada.onclick=()=>{if(panel.hidden)open('brief');else close();};}
if(aqui){aqui.hidden=false;aqui.onclick=e=>{e.preventDefault();abrirConLocal(aqui.dataset.comercialLocal||(typeof ctx.activo==='function'?ctx.activo():null));};}
function vestirEntradas(){if(entrada){entrada.title=T(...labels.entrada);entrada.setAttribute('aria-label',T(...labels.entrada));entrada.setAttribute('aria-pressed',String(!panel.hidden));}}
document.addEventListener('admira:lang',()=>{translate();vestirEntradas();});
form.addEventListener('input',invalidate);
form.onsubmit=e=>{e.preventDefault();try{if(selected&&!sameSelection(ctx.snapshot(),selected))throw Error('locations_required');decir('proponiendo','',true);result=proposal(Object.fromEntries(new FormData(form)),selected,window.CampaignPlanner,today());$('commercial-proposal').textContent=proposalText(result,language());$('commercial-proposal').hidden=false;$('commercial-result-actions').hidden=false;$('commercial-status').textContent=T('Propuesta preparada para revisar.','Proposal ready for review.');}catch(e){invalidate();error(e);}};
$('commercial-plan').onclick=()=>{if(!result)return;try{const current=ctx.snapshot();if(!sameSelection(current,selected))throw Error('locations_required');ctx.planner(result.brief);close();}catch(e){error(e);}};
// Propuesta en PDF con marca (20-10-2026): el documento se maqueta aquí (proposalHtml) y lo imprime el navegador desde
// un iframe oculto; en el diálogo, «Guardar como PDF». Sin librerías ni API: el brief no sale de la pestaña.
function propuestaHtml(){if(!result)return '';const css=getComputedStyle(document.documentElement);return proposalHtml(result,{lang:language(),brand:window.ADMIRA_SITE_BRAND||{},colors:{band:css.getPropertyValue('--card').trim()||'#100c20',accent:css.getPropertyValue('--brand').trim()||'#7dffd0'}});}
function imprimir(html){return new Promise((resolve,reject)=>{const f=document.createElement('iframe');f.setAttribute('aria-hidden','true');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
 const quitar=()=>setTimeout(()=>f.remove(),1500);
 // Las teselas del mapa y las fotos cargan dentro del documento: se espera a que estén (4 s como mucho) antes de imprimir.
 const imagenes=d=>Promise.race([Promise.all([...d.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=i.onerror=r;}))),new Promise(r=>setTimeout(r,4000))]);
 f.onload=async()=>{try{const w=f.contentWindow;await imagenes(w.document);w.addEventListener('afterprint',quitar,{once:true});w.focus();w.print();resolve();}catch(e){f.remove();reject(e);}};f.srcdoc=html;document.body.append(f);});}
$('commercial-pdf').onclick=async()=>{if(!result)return;try{await imprimir(propuestaHtml());$('commercial-status').textContent=T(...labels.pdfListo);}catch{$('commercial-status').textContent=T(...labels.pdfNo);}};
// Enviar por correo (20-10-2026): mailto con el anunciante, el contacto en copia, el asunto y el resumen; el PDF se adjunta a mano.
function correoPropuesta(){return result?proposalMailto(result,{lang:language()}):'';}
$('commercial-mail').onclick=()=>{if(!result)return;const a=document.createElement('a');a.href=correoPropuesta();a.rel='noopener';document.body.append(a);a.click();a.remove();$('commercial-status').textContent=T(...labels.mailListo);};
$('commercial-download').onclick=()=>{if(!result)return;const url=URL.createObjectURL(new Blob([proposalText(result,language())],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='propuesta-comercial.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.AdmiraComercial={lanzar:open,cerrar:close,propuestaHtml,correoPropuesta,fichaHtml,correoFicha,dictado:aplicarDictado};
window.addEventListener('admira:assistant-default',close);
for(const event of ['admira:lang','admira:languagechange','admiranext:lang'])window.addEventListener(event,translate);
new MutationObserver(()=>{if(selected){const current=ctx.snapshot();if(sameSelection(current,selected)){selected.circuit=current.circuit;selected.target=current.target;}}translate();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
translate();vestirEntradas();
const query=new URLSearchParams(location.search);
if(query.get('asistente')==='comercial')open(STEPS.includes(query.get('paso'))?query.get('paso'):'brief');

$('commercial-campaigns').onclick=()=>open('brief');
$('commercial-merchants').onclick=()=>open('comercios');
const merchantForm=$('commercial-merchant-form');
merchantForm.oninput=()=>{merchant=null;$('commercial-merchant-output').hidden=true;$('commercial-merchant-actions').hidden=true;$('commercial-merchant-status').textContent='';};
merchantForm.onsubmit=e=>{e.preventDefault();try{merchant=merchantBrief(Object.fromEntries(new FormData(merchantForm)));$('commercial-merchant-output').textContent=merchantText(merchant,language());$('commercial-merchant-output').hidden=false;$('commercial-merchant-actions').hidden=false;$('commercial-merchant-status').textContent=T('Ficha lista para revisar. Continúa el alta en el portal de comercios.','Brief ready for review. Continue onboarding in the merchant portal.');}catch{$('commercial-merchant-status').textContent=T('Completa comercio, ciudad, dirección y un número entero de pantallas.','Enter business, city, address and a whole number of screens.');}};
// Ficha de captación en PDF y por correo (20-10-2026): mismo molde que la propuesta.
function fichaHtml(){if(!merchant)return '';const css=getComputedStyle(document.documentElement);return merchantHtml(merchant,{lang:language(),brand:window.ADMIRA_SITE_BRAND||{},today:today(),colors:{band:css.getPropertyValue('--card').trim()||'#100c20',accent:css.getPropertyValue('--brand').trim()||'#7dffd0'}});}
function correoFicha(){return merchant?merchantMailto(merchant,{lang:language()}):'';}
$('commercial-merchant-pdf').onclick=async()=>{if(!merchant)return;try{await imprimir(fichaHtml());$('commercial-merchant-status').textContent=T(...labels.pdfListo);}catch{$('commercial-merchant-status').textContent=T(...labels.pdfNo);}};
$('commercial-merchant-mail').onclick=()=>{if(!merchant)return;const a=document.createElement('a');a.href=correoFicha();a.rel='noopener';document.body.append(a);a.click();a.remove();$('commercial-merchant-status').textContent=T(...labels.mailShopListo);};
$('commercial-merchant-download').onclick=()=>{if(!merchant)return;const url=URL.createObjectURL(new Blob([merchantText(merchant,language())],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='comercio.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
