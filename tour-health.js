/* Exact screen mappings + fresh proof of play. Catalogue status never proves emission. */
(function(root){
  'use strict';
  const FRESH_MS=170000;
  function screens(loc){
    if(loc.monitoringKind==='location-only')return [];
    return [...new Set((loc.surfaces||[]).flatMap(s=>[s.screen,...(Array.isArray(s.pixerScreens)?s.pixerScreens:[])]).filter(s=>typeof s==='string'&&s))];
  }
  function signal(payload, now=Date.now(), expectedScreen){
    if(!payload || payload.ok === false || (expectedScreen && payload.screen !== expectedScreen)) return 'unknown';
    const item=payload&&payload.item;
    if(!item) return payload.ok === true && payload.screen ? 'offline' : 'unknown';
    if(!Number.isFinite(item.ts)||item.ts>now) return 'unknown';
    if(now-item.ts>=FRESH_MS) return 'offline';
    if(payload.health && payload.health.ok === false) return 'fault';
    const d=payload.device?.display;
    if((Number.isFinite(d?.visible) && d.visible<90) || (Number.isFinite(d?.overlay) && d.overlay>=10)) return 'fault';
    return now-item.ts<FRESH_MS?'online':'offline';
  }
  function health(loc, signals){
    if(loc.monitoringKind==='location-only')return {state:'location',total:0,online:0,offline:0,fault:0,unknown:0};
    const ids=screens(loc), counts={online:0,offline:0,fault:0,unknown:0};
    ids.forEach(id=>counts[['online','offline','fault'].includes(signals[id])?signals[id]:'unknown']++);
    // Surfaces with no player mapping remain unverified even if another screen is live.
    counts.unknown+=(loc.surfaces||[]).filter(s=>!screens({surfaces:[s]}).length).length;
    const total=counts.online+counts.offline+counts.fault+counts.unknown;
    let state='unknown';
    if(total&&counts.online===total) state='online';
    else if(total&&counts.offline===total) state='offline';
    else if(counts.online||counts.offline||counts.fault) state='partial';
    return {state,total,...counts};
  }
  const WORDS={es:{location:'Solo ubicación · sin reproductor',locationNote:'Punto de Google Maps, sin emisión instalada',title:'Control de emisión',online:'Emitiendo',offline:'Sin señal reciente',partial:'Revisar',unknown:'Sin datos',loading:'Comprobando señal…',note:'Prueba de reproducción · actualización cada 15 s',fault:'Fallo comunicado',none:'Falta vincular reproductores',screens:'pantallas',close:'Cerrar control'},en:{location:'Location only · no player',locationNote:'Google Maps location, no playback installed',title:'Playback control',online:'Playing',offline:'No recent signal',partial:'Check',unknown:'No data',loading:'Checking signal…',note:'Proof of play · updated every 15 s',fault:'Reported fault',none:'Players need linking',screens:'screens',close:'Close control'}};
  function create(doc,items,lang,fetcher=root.fetch.bind(root)){
    const L=WORDS[lang==='en'?'en':'es'];
    const host=doc.createElement('aside');host.className='gt-health';host.setAttribute('aria-label',L.title);
    const title=doc.createElement('strong');title.textContent=L.title;host.append(title);
    const physical=doc.createElement('div');physical.className='gt-health-physical';host.append(physical);
    const rows=items.map(loc=>{
      const row=doc.createElement('div');row.className='gt-health-row';
      const name=doc.createElement('b');name.textContent=loc.tourLabel||loc.name;
      const status=doc.createElement('span');status.textContent=L.loading;
      const detail=doc.createElement('small');const players=doc.createElement('details');players.className='gt-health-players';row.append(name,status,detail,players);host.append(row);
      return {loc,row,status,detail,players};
    });
    const note=doc.createElement('small');note.textContent=L.note;host.append(note);doc.body.append(host);
    let stopped=false,busy=false,controller=null;
    async function refresh(){
      if(stopped||busy)return;busy=true;
      const signals=Object.create(null);controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),6000);
      await Promise.all([...new Set(items.flatMap(screens))].map(async id=>{
        try{const r=await fetcher('https://api.admira.store/signage/now?screen='+encodeURIComponent(id),{cache:'no-store',signal:controller.signal});signals[id]=r.ok?signal(await r.json(),Date.now(),id):'unknown';}catch{signals[id]='unknown';}
      }));
      let supervisor=null;
      if(items.some(l=>l.id==='lab-gran-de-gracia-51')) {
        try {const r=await fetcher('https://api.yokup.com/supervisor/soluciones?id=macmini-insta360',{cache:'no-store',signal:controller.signal});if(r.ok)supervisor=await r.json();}catch{}
      }
      clearTimeout(timeout);busy=false;if(stopped)return;
      physical.replaceChildren();
      const target=supervisor?.posiciones?.find(p=>p.id==='mbp16-pantalla');
      const captured=Date.parse(target?.cuando||'');
      if(supervisor?.ok && Number.isFinite(captured) && Date.now()-captured>=0 && Date.now()-captured<60000){
        const p=doc.createElement('small');p.textContent=(lang==='en'?'Camera · MBP16: ':'Cámara · MBP16: ')+(target.estado==='encendida'?(lang==='en'?'screen on':'encendida'):target.estado);physical.append(p);
        const incident=supervisor.abiertas?.find(i=>i.posicion==='mbp16-pantalla');
        if(incident && /^INC-[A-Z0-9]+$/.test(incident.id)){const a=doc.createElement('a');a.href='https://www.admira.app/ticket?id='+encodeURIComponent(incident.id);a.target='_blank';a.rel='noopener';a.textContent=(lang==='en'?'Supervisor incident · ':'Incidencia reportada · ')+incident.id;physical.append(a);}
      }

      rows.forEach(({loc,row,status,detail,players})=>{
        const h=health(loc,signals);row.dataset.state=h.state;status.textContent=L[h.state];
        players.replaceChildren();
        const ids=screens(loc);players.hidden=!ids.length;
        if(ids.length){const summary=doc.createElement('summary');summary.textContent=lang==='en'?'View players':'Ver reproductores';players.append(summary);}
        screens(loc).forEach(id=>{const p=doc.createElement('small');const state=signals[id]||'unknown';p.dataset.state=state;p.textContent=id+' · '+L[state];players.append(p);});
        
        detail.textContent=loc.monitoringKind==='location-only'?L.locationNote:screens(loc).length?`${h.online}/${h.total} ${L.screens}`+(h.offline?` · ${h.offline} ${L.offline.toLowerCase()}`:'')+(h.fault?` · ${h.fault} ${L.fault.toLowerCase()}`:'')+(h.unknown?` · ${h.unknown} ${L.unknown.toLowerCase()}`:''):L.none;
        if(loc.id==='alsea-sbux-021' && ids.includes('ipad-admin-mupi'))detail.textContent += lang==='en'?' · iPad location unverified':' · ubicación física del iPad sin verificar';
      });
      note.textContent=L.note+' · '+new Date().toLocaleTimeString(lang==='en'?'en-GB':'es-ES');
    }
    refresh();const timer=setInterval(refresh,15000);
    return {destroy(){stopped=true;clearInterval(timer);controller?.abort();host.remove();},element:host};
  }
  const api={screens,signal,health,create,FRESH_MS};root.TourHealth=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
