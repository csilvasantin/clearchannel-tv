// Commercial proposals use the existing CampaignPlanner; no duplicate price model.
export const STEPS = Object.freeze(['brief', 'audiencias', 'ubicaciones', 'propuesta', 'comercios']);
const clean = (v, max = 2000) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
export function normalizeBrief(raw = {}) {
  const email=clean(raw.email,254);
  return {advertiser:clean(raw.advertiser,160),email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:'',objective:clean(raw.objective),audience:clean(raw.audience),
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
    locations:items.map(x=>({id:clean(x.id,160),name:clean(x.name,200),demo:x.demo===true,
      ...(Array.isArray(x.coords)&&Number.isFinite(x.coords[0])&&Number.isFinite(x.coords[1])?{coords:[x.coords[0],x.coords[1]]}:{}),
      ...(/^https:\/\/[^\s"'<>]+$/.test(String(x.foto||''))?{foto:String(x.foto)}:{})})),estimate,
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

export function sameSelection(a,b){return !!(a?.ready&&b?.ready&&(a.circuitKey??a.circuit)===(b.circuitKey??b.circuit)&&(a.targetKey??a.target)===(b.targetKey??b.target)&&a.items.map(x=>x.id).sort().join('\n')===b.items.map(x=>x.id).sort().join('\n'));}

export function merchantBrief(raw={}) {
 const out={schema:'admira.comercial-comercio/1',status:'draft',name:clean(raw.name,120),city:clean(raw.city,120),address:clean(raw.address,300),contact:clean(raw.contact,254),screens:Number(raw.screens),notes:clean(raw.notes)};
 if(!out.name||!out.city||!out.address||!Number.isInteger(out.screens)||out.screens<1||out.screens>10000)throw Error('merchant_required');
 return out;
}
export function merchantText(p,lang='es') {
 const t=(a,b)=>lang==='en'?b:a;
 return [t('Captación de comercio · borrador','Merchant recruitment · draft'),p.name,p.city,p.address,t('Contacto: ','Contact: ')+p.contact,t('Pantallas: ','Screens: ')+p.screens,p.notes,t('Siguiente paso: entrar en el portal de comercios, añadir o elegir el establecimiento y registrar sus pantallas. Revisar permisos, ubicación y condiciones de incorporación.','Next: sign in to the merchant portal, add or choose the location and register its screens. Review permissions, location and onboarding terms.'),'https://admira.app/retailer',t('Ficha preparatoria: no crea una cuenta, no incorpora el comercio ni publica sus datos.','Preparation brief: does not create an account, onboard the merchant or publish its data.')].filter(Boolean).join('\n');
}

// ── Propuesta en PDF con marca (Carlos, 20-oct-2026) ─────────────────────────────────────────────────────────
// Un documento HTML de una o dos páginas A4, listo para «Guardar como PDF» desde el navegador (sin librerías ni API):
// cabecera con la marca de la página, el anunciante, el brief, las cifras clave, las ubicaciones y los avisos que ya
// lleva el texto (estimación, disponibilidad sin confirmar, demostraciones). Todo el texto del brief va escapado.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function proposalHtml(p, {lang='es', brand={}, contact='info@admira.com', colors={}} = {}) {
  const en=lang==='en',t=(a,b)=>en?b:a,n=v=>new Intl.NumberFormat(en?'en-GB':'es-ES').format(v),money=v=>new Intl.NumberFormat(en?'en-GB':'es-ES',{style:'currency',currency:'EUR'}).format(v);
  const fecha=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d||''));return m?(en?`${m[3]}/${m[2]}/${m[1]}`:`${m[3]}-${m[2]}-${m[1]}`):esc(d||'—');};
  const marca=esc(brand.wordmark||brand.name||'ADMIRA·BIZ'),dominio=esc(brand.domain||'www.admira.biz'),banda=esc(colors.band||'#100c20'),acento=esc(colors.accent||'#7dffd0'),tinta='#111318',azul='#2f6db5';
  const titulo=`${t('Propuesta de campaña','Campaign proposal')} · ${esc(p.brief.advertiser)} · ${fecha(p.createdOn)}`;
  const cifra=(k,v,nota='')=>`<div class="cifra"><span class="k">${k}</span><strong>${v}</strong>${nota?`<small>${nota}</small>`:''}</div>`;
  const conFoto=p.locations.some(x=>x.foto);
  const filas=p.locations.map((x,i)=>`<tr><td>${i+1}</td>${conFoto?`<td class="foto">${x.foto?`<img src="${esc(x.foto)}" alt="" width="72" height="54">`:''}</td>`:''}<td>${esc(x.name)}</td><td class="mono">${esc(x.id)}</td><td>${x.demo?t('demostración','demonstration'):''}</td></tr>`).join('');
  const avisos=[
    t('Las oportunidades son una estimación de impactos, no personas únicas.','Opportunities are an estimate of impacts, not unique people.'),
    t('Disponibilidad y precio sujetos a confirmación. Este documento no reserva ni publica una campaña.','Availability and price require confirmation. This document does not book or publish a campaign.'),
    p.hasDemonstration?t('Incluye ubicaciones de demostración: revisar y sustituir antes de una propuesta definitiva.','Includes demonstration locations: review and replace before a final proposal.'):'',
    p.budgetExceeded?t('La estimación supera el presupuesto indicado.','The estimate exceeds the stated budget.'):'',
    !p.estimate?t('Faltan datos del catálogo para calcular impresiones y precio: las cifras quedan pendientes.','Catalogue inputs for impressions and price are missing: figures remain pending.'):''
  ].filter(Boolean).map(a=>`<li>${a}</li>`).join('');
  return `<!doctype html><html lang="${en?'en':'es'}"><head><meta charset="utf-8"><title>${titulo}</title>
<style>
@page{size:A4;margin:16mm 14mm 18mm}
*{box-sizing:border-box}body{margin:0;font:11.5pt/1.45 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:${tinta};background:#fff}
.banda{display:flex;align-items:center;justify-content:space-between;gap:12px;background:${banda};color:#fff;padding:14px 18px;border-radius:10px}
.banda .marca{font:700 13pt/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;color:${acento}}
.banda .que{text-align:right}.banda .que b{display:block;font-size:13pt}.banda .que span{font-size:9pt;opacity:.8}
.borrador{display:inline-block;margin-top:4px;padding:2px 8px;border:1px solid rgba(255,255,255,.5);border-radius:999px;font:700 8pt/1.4 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}
h1{font-size:19pt;margin:20px 0 2px}.para{color:#555;margin:0 0 14px}
h2{font-size:10pt;letter-spacing:.12em;text-transform:uppercase;color:${azul};margin:18px 0 6px;border-bottom:1px solid #dfe3ea;padding-bottom:3px}
dl{display:grid;grid-template-columns:150px 1fr;gap:4px 12px;margin:0}dt{color:#555}dd{margin:0}
.cifras{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:8px 0 0}.cifra{border:1px solid #dfe3ea;border-left:4px solid ${azul};border-radius:8px;padding:10px 12px}
.cifra .k{display:block;font-size:8.5pt;letter-spacing:.08em;text-transform:uppercase;color:#555}.cifra strong{display:block;font-size:16pt;margin-top:2px}.cifra small{display:block;color:#777;font-size:8.5pt}
table{width:100%;border-collapse:collapse;font-size:10pt}th{text-align:left;font-size:8.5pt;letter-spacing:.08em;text-transform:uppercase;color:#555;border-bottom:1px solid #dfe3ea;padding:6px 6px}td{padding:6px;border-bottom:1px solid #eef0f4;vertical-align:top}.mono{font:9pt ui-monospace,Menlo,monospace;color:#555}
.avisos{margin:14px 0 0;padding:10px 14px 10px 28px;background:#f6f7fa;border-radius:8px;font-size:9.5pt;color:#333}.avisos li{margin:2px 0}
.mapa{position:relative;overflow:hidden;border-radius:10px;border:1px solid #dfe3ea;background:#0b1a25;break-inside:avoid}.mapa img{position:absolute;display:block}
.marca-mapa{position:absolute;transform:translate(-50%,-50%);min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:${azul};color:#fff;border:2px solid #fff;box-shadow:0 2px 6px #0008;font:700 11px/18px -apple-system,Helvetica,Arial,sans-serif;text-align:center;box-sizing:border-box}
.atribucion{margin:4px 0 0;font-size:8pt;color:#777}td.foto{width:80px;padding:4px 6px}td.foto img{display:block;width:72px;height:54px;object-fit:cover;border-radius:6px;background:#eef0f4}
footer{margin-top:22px;padding-top:8px;border-top:1px solid #dfe3ea;display:flex;justify-content:space-between;font-size:8.5pt;color:#666}
@media print{.banda,.marca-mapa{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="banda"><div><div class="marca">${marca}</div><span class="borrador">${t('borrador','draft')} · ${fecha(p.createdOn)}</span></div><div class="que"><b>${t('Propuesta de campaña','Campaign proposal')}</b><span>${t('publicidad en pantallas · ','screen advertising · ')}${dominio}</span></div></div>
<h1>${esc(p.brief.advertiser)}</h1><p class="para">${esc(p.brief.objective)}</p>
<h2>${t('Brief','Brief')}</h2>
<dl><dt>${t('Audiencia solicitada','Requested audience')}</dt><dd>${esc(p.brief.audience)}</dd>
<dt>${t('Segmentación del mapa','Map targeting')}</dt><dd>${esc(p.target||'—')}</dd>
<dt>${t('Circuito','Circuit')}</dt><dd>${esc(p.circuit||'—')}</dd>
<dt>${t('Fechas','Dates')}</dt><dd>${fecha(p.brief.start)} → ${fecha(p.brief.end)}</dd>
<dt>${t('Emisión','Delivery')}</dt><dd>${n(p.brief.passesDay)} ${t('pases al día','plays a day')} · ${n(p.brief.durationSec)} s</dd></dl>
<h2>${t('Cifras clave','Key figures')}</h2>
<div class="cifras">${cifra(t('Ubicaciones','Locations'),n(p.locations.length))}${cifra(t('Oportunidades estimadas','Estimated opportunities'),p.estimate?n(p.estimate.estimatedImpr):'—',t('impactos, no personas únicas','impacts, not unique people'))}${cifra(t('Importe orientativo','Indicative price'),p.estimate?money(p.estimate.price):'—',t('presupuesto: ','budget: ')+money(p.brief.budget))}</div>
${mapaHtml(p,lang)}
<h2>${t('Ubicaciones','Locations')}</h2>
<table><thead><tr><th>#</th>${conFoto?`<th>${t('Foto','Photo')}</th>`:''}<th>${t('Ubicación','Location')}</th><th>Id</th><th></th></tr></thead><tbody>${filas}</tbody></table>
<ul class="avisos">${avisos}</ul>
<footer><span>${t('Contacto comercial','Commercial contact')}: ${esc(contact)}</span><span>${t('Preparado por Comercial (Admirito) en ','Prepared by Commercial (Admirito) at ')}${dominio}</span></footer>
</body></html>`;
}

// ── Enviar por correo (Carlos, 20-oct-2026) ──────────────────────────────────────────────────────────────────
// Un enlace mailto: con el anunciante de destinatario (si dio su correo), el contacto comercial en copia, el asunto y
// el texto de la propuesta. El PDF se adjunta a mano (un mailto: no puede adjuntar). Los clientes de correo recortan los
// enlaces largos: el cuerpo se limita a unos 1.800 caracteres y, si hay muchas ubicaciones, se resumen.
export const CORREO_MAX = 1800;
export function proposalMailto(p, {lang='es', contact='info@admira.com', maxBody=CORREO_MAX} = {}) {
  const en=lang==='en',t=(a,b)=>en?b:a;
  const asunto=`${t('Propuesta de campaña','Campaign proposal')} · ${p.brief.advertiser} · ${p.createdOn}`;
  const saludo=t('Hola,\n\nTe envío la propuesta de campaña que hemos preparado. El detalle va en el PDF adjunto; este es el resumen:\n\n','Hello,\n\nPlease find the campaign proposal we prepared. The details are in the attached PDF; here is the summary:\n\n');
  const firma=`\n\n${t('Un saludo,\nComercial · ','Best regards,\nCommercial · ')}${contact}`;
  let resumen=proposalText(p,lang);
  if((saludo+resumen+firma).length>maxBody){
    const lineas=resumen.split('\n'),ubic=lineas.filter(l=>l.startsWith('• ')),resto=lineas.filter(l=>!l.startsWith('• '));
    const quedan=Math.max(0,ubic.length-5);
    resumen=[...resto.slice(0,resto.findIndex(l=>/^(Ubicaciones seleccionadas|Selected locations)/.test(l))+1),...ubic.slice(0,5),quedan?t(`… y ${quedan} ubicaciones más (en el PDF).`,`… and ${quedan} more locations (in the PDF).`):'',...resto.slice(resto.findIndex(l=>/^(Ubicaciones seleccionadas|Selected locations)/.test(l))+1)].filter(Boolean).join('\n');
    if((saludo+resumen+firma).length>maxBody) resumen=resumen.slice(0,maxBody-saludo.length-firma.length-1)+'…';
  }
  const para=p.brief.email||'';
  const q=new URLSearchParams();if(contact)q.set('cc',contact);q.set('subject',asunto);q.set('body',saludo+resumen+firma);
  return `mailto:${encodeURIComponent(para)}?${q.toString().replace(/\+/g,'%20')}`;
}

// ── Ficha de captación de comercios: PDF con marca y correo (Carlos, 20-oct-2026) ──────────────────────────
// Mismo molde que la propuesta: documento A4 con la marca de la página y un mailto con el resumen. Si el contacto del
// comercio es un correo, va de destinatario; el contacto comercial, en copia. El PDF se adjunta a mano.
const esCorreo = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
export function merchantHtml(m, {lang='es', brand={}, contact='info@admira.com', colors={}, today=''} = {}) {
  const en=lang==='en',t=(a,b)=>en?b:a,n=v=>new Intl.NumberFormat(en?'en-GB':'es-ES').format(v);
  const fecha=d=>{const x=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d||''));return x?(en?`${x[3]}/${x[2]}/${x[1]}`:`${x[3]}-${x[2]}-${x[1]}`):esc(d||'');};
  const marca=esc(brand.wordmark||brand.name||'ADMIRA·BIZ'),dominio=esc(brand.domain||'www.admira.biz'),banda=esc(colors.band||'#100c20'),acento=esc(colors.accent||'#7dffd0'),tinta='#111318',azul='#2f6db5';
  const titulo=`${t('Ficha de captación','Recruitment brief')} · ${esc(m.name)}${today?' · '+fecha(today):''}`;
  const pasos=[t('Entrar en el portal de comercios y añadir o elegir el establecimiento.','Sign in to the merchant portal and add or choose the location.'),
    t('Registrar sus pantallas (número, sitio y orientación).','Register its screens (number, placement and orientation).'),
    t('Revisar permisos, ubicación y condiciones de incorporación.','Review permissions, location and onboarding terms.')].map(x=>`<li>${x}</li>`).join('');
  return `<!doctype html><html lang="${en?'en':'es'}"><head><meta charset="utf-8"><title>${titulo}</title>
<style>
@page{size:A4;margin:16mm 14mm 18mm}
*{box-sizing:border-box}body{margin:0;font:11.5pt/1.45 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:${tinta};background:#fff}
.banda{display:flex;align-items:center;justify-content:space-between;gap:12px;background:${banda};color:#fff;padding:14px 18px;border-radius:10px}
.banda .marca{font:700 13pt/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;color:${acento}}
.banda .que{text-align:right}.banda .que b{display:block;font-size:13pt}.banda .que span{font-size:9pt;opacity:.8}
.borrador{display:inline-block;margin-top:4px;padding:2px 8px;border:1px solid rgba(255,255,255,.5);border-radius:999px;font:700 8pt/1.4 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}
h1{font-size:19pt;margin:20px 0 2px}.para{color:#555;margin:0 0 14px}
h2{font-size:10pt;letter-spacing:.12em;text-transform:uppercase;color:${azul};margin:18px 0 6px;border-bottom:1px solid #dfe3ea;padding-bottom:3px}
dl{display:grid;grid-template-columns:150px 1fr;gap:4px 12px;margin:0}dt{color:#555}dd{margin:0;white-space:pre-wrap}
.cifras{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:8px 0 0}.cifra{border:1px solid #dfe3ea;border-left:4px solid ${azul};border-radius:8px;padding:10px 12px}
.cifra .k{display:block;font-size:8.5pt;letter-spacing:.08em;text-transform:uppercase;color:#555}.cifra strong{display:block;font-size:16pt;margin-top:2px}
ol.pasos{margin:6px 0 0;padding-left:22px}ol.pasos li{margin:3px 0}
.avisos{margin:14px 0 0;padding:10px 14px 10px 28px;background:#f6f7fa;border-radius:8px;font-size:9.5pt;color:#333}
footer{margin-top:22px;padding-top:8px;border-top:1px solid #dfe3ea;display:flex;justify-content:space-between;font-size:8.5pt;color:#666}
@media print{.banda{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="banda"><div><div class="marca">${marca}</div><span class="borrador">${t('borrador','draft')}${today?' · '+fecha(today):''}</span></div><div class="que"><b>${t('Ficha de captación','Recruitment brief')}</b><span>${t('comercios y pantallas · ','merchants and screens · ')}${dominio}</span></div></div>
<h1>${esc(m.name)}</h1><p class="para">${esc(m.address)} · ${esc(m.city)}</p>
<h2>${t('Datos','Details')}</h2>
<dl><dt>${t('Ciudad','City')}</dt><dd>${esc(m.city)}</dd><dt>${t('Dirección','Address')}</dt><dd>${esc(m.address)}</dd><dt>${t('Contacto','Contact')}</dt><dd>${esc(m.contact||'—')}</dd>
<dt>${t('Pantallas y necesidades','Screens and requirements')}</dt><dd>${esc(m.notes||'—')}</dd></dl>
<h2>${t('Cifras clave','Key figures')}</h2>
<div class="cifras"><div class="cifra"><span class="k">${t('Pantallas','Screens')}</span><strong>${n(m.screens)}</strong></div><div class="cifra"><span class="k">${t('Estado','Status')}</span><strong>${t('Por incorporar','To onboard')}</strong></div><div class="cifra"><span class="k">${t('Portal','Portal')}</span><strong style="font-size:11pt">admira.app/retailer</strong></div></div>
<h2>${t('Siguientes pasos','Next steps')}</h2><ol class="pasos">${pasos}</ol>
<ul class="avisos"><li>${t('Ficha preparatoria: no crea una cuenta, no incorpora el comercio ni publica nada. El alta se completa en el portal de comercios.','Preparatory brief: it does not create an account, onboard the merchant or publish anything. Onboarding is completed in the merchant portal.')}</li></ul>
<footer><span>${t('Contacto comercial','Commercial contact')}: ${esc(contact)}</span><span>${t('Preparado por Comercial (Admirito) en ','Prepared by Commercial (Admirito) at ')}${dominio}</span></footer>
</body></html>`;
}
export function merchantMailto(m, {lang='es', contact='info@admira.com', maxBody=CORREO_MAX} = {}) {
  const en=lang==='en',t=(a,b)=>en?b:a;
  const asunto=`${t('Incorporación de pantallas','Screen onboarding')} · ${m.name} · ${m.city}`;
  const saludo=t('Hola,\n\nTe envío la ficha para incorporar vuestro comercio y sus pantallas a la red. El detalle va en el PDF adjunto; este es el resumen:\n\n','Hello,\n\nPlease find the brief to onboard your business and its screens to the network. The details are in the attached PDF; here is the summary:\n\n');
  const firma=`\n\n${t('Un saludo,\nComercial · ','Best regards,\nCommercial · ')}${contact}`;
  let resumen=merchantText(m,lang);
  if((saludo+resumen+firma).length>maxBody) resumen=resumen.slice(0,maxBody-saludo.length-firma.length-1)+'…';
  const para=esCorreo(m.contact)?String(m.contact).trim():'';
  const q=new URLSearchParams();if(contact)q.set('cc',contact);q.set('subject',asunto);q.set('body',saludo+resumen+firma);
  return `mailto:${encodeURIComponent(para)}?${q.toString().replace(/\+/g,'%20')}`;
}

// ── Mapa de las ubicaciones en el PDF (Carlos, 20-oct-2026) ──────────────────────────────────────────────────
// Sin librerías: un mosaico de teselas del mismo satélite de la portada (Esri World Imagery, Web Mercator) recortado al
// tamaño del hueco, con un marcador numerado por ubicación (el número es el de la tabla). El zoom es el mayor en el que
// caben todas con margen; una sola ubicación, de cerca. Los tiles los carga el propio documento al imprimir.
export const TESELAS = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const ATRIBUCION_MAPA = '© Esri · Maxar · Earthstar Geographics · OpenStreetMap';
const TAM = 256;
const coordValida = c => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 85.06;
const proyectar = ([lng, lat], z) => { const n = TAM * 2 ** z, r = lat * Math.PI / 180; return [(lng + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n]; };
export function mapaPropuesta(locations, { ancho = 744, alto = 420, maxZoom = 17, minZoom = 2, margen = 40 } = {}) {
  const puntos = (locations || []).map((l, i) => ({ n: i + 1, id: l.id, coords: l.coords })).filter(p => coordValida(p.coords));
  if (!puntos.length) return null;
  let z = maxZoom;
  if (puntos.length > 1) {
    for (; z > minZoom; z--) {
      const px = puntos.map(p => proyectar(p.coords, z)), xs = px.map(q => q[0]), ys = px.map(q => q[1]);
      if (Math.max(...xs) - Math.min(...xs) <= ancho - 2 * margen && Math.max(...ys) - Math.min(...ys) <= alto - 2 * margen) break;
    }
  } else z = Math.min(maxZoom, 16);
  const px = puntos.map(p => proyectar(p.coords, z)), xs = px.map(q => q[0]), ys = px.map(q => q[1]);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2, ox = Math.round(cx - ancho / 2), oy = Math.round(cy - alto / 2);
  const n = TAM * 2 ** z, teselas = [];
  for (let ty = Math.floor(oy / TAM); ty * TAM < oy + alto; ty++) for (let tx = Math.floor(ox / TAM); tx * TAM < ox + ancho; tx++) {
    if (ty < 0 || ty * TAM >= n) continue;
    const x = ((tx % (n / TAM)) + n / TAM) % (n / TAM);   // el mundo da la vuelta en longitud
    teselas.push({ url: TESELAS.replace('{z}', z).replace('{y}', ty).replace('{x}', x), left: tx * TAM - ox, top: ty * TAM - oy });
  }
  const marcadores = puntos.map((p, i) => ({ n: p.n, id: p.id, left: Math.round(px[i][0] - ox), top: Math.round(px[i][1] - oy) }));
  return { zoom: z, ancho, alto, teselas, marcadores, atribucion: ATRIBUCION_MAPA };
}
// Trozo de HTML del mapa (lo usa proposalHtml); vacío si no hay coordenadas.
export function mapaHtml(p, lang = 'es', opciones = {}) {
  const m = mapaPropuesta(p.locations, opciones); if (!m) return '';
  const en = lang === 'en', t = (a, b) => en ? b : a;
  const teselas = m.teselas.map(x => `<img src="${esc(x.url)}" alt="" style="left:${x.left}px;top:${x.top}px" width="256" height="256">`).join('');
  const marcas = m.marcadores.map(x => `<span class="marca-mapa" style="left:${x.left}px;top:${x.top}px" title="${esc(x.id)}">${x.n}</span>`).join('');
  return `<h2>${t('Mapa de las ubicaciones', 'Location map')}</h2><div class="mapa" style="width:${m.ancho}px;height:${m.alto}px">${teselas}${marcas}</div><p class="atribucion">${esc(m.atribucion)} · ${t('zoom', 'zoom')} ${m.zoom}</p>`;
}
