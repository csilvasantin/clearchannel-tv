/* Exact screen mappings + fresh proof of play. Catalogue status never proves emission. */
(function(root){
  'use strict';
  const FRESH_MS=170000;
  function screens(loc){
    return [...new Set((loc.surfaces||[]).flatMap(s=>[s.screen,...(Array.isArray(s.pixerScreens)?s.pixerScreens:[])]).filter(s=>typeof s==='string'&&s))];
  }
  function signal(payload, now=Date.now()){
    const item=payload&&payload.item;
    if(!item||!Number.isFinite(item.ts)||item.ts>now) return 'unknown';
    return now-item.ts<FRESH_MS?'online':'offline';
  }
  function health(loc, signals){
    const ids=screens(loc), counts={online:0,offline:0,unknown:0};
    ids.forEach(id=>counts[['online','offline'].includes(signals[id])?signals[id]:'unknown']++);
    // Surfaces with no player mapping remain unverified even if another screen is live.
    counts.unknown+=(loc.surfaces||[]).filter(s=>!screens({surfaces:[s]}).length).length;
    const total=counts.online+counts.offline+counts.unknown;
    let state='unknown';
    if(total&&counts.online===total) state='online';
    else if(total&&counts.offline===total) state='offline';
    else if(counts.online||counts.offline) state='partial';
    return {state,total,...counts};
  }
  const WORDS={es:{title:'Control de emisión',online:'Emitiendo',offline:'Sin señal reciente',partial:'Revisar',unknown:'Sin datos',loading:'Comprobando señal…',note:'Prueba de reproducción · actualización cada 15 s',none:'Falta vincular reproductores',screens:'pantallas',close:'Cerrar control'},en:{title:'Playback control',online:'Playing',offline:'No recent signal',partial:'Check',unknown:'No data',loading:'Checking signal…',note:'Proof of play · updated every 15 s',none:'Players need linking',screens:'screens',close:'Close control'}};
  function create(doc,items,lang,fetcher=root.fetch.bind(root)){
    const L=WORDS[lang==='en'?'en':'es'];
    const host=doc.createElement('aside');host.className='gt-health';host.setAttribute('aria-label',L.title);
    const title=doc.createElement('strong');title.textContent=L.title;host.append(title);
    const rows=items.map(loc=>{
      const row=doc.createElement('div');row.className='gt-health-row';
      const name=doc.createElement('b');name.textContent=loc.tourLabel||loc.name;
      const status=doc.createElement('span');status.textContent=L.loading;
      const detail=doc.createElement('small');row.append(name,status,detail);host.append(row);
      return {loc,row,status,detail};
    });
    const note=doc.createElement('small');note.textContent=L.note;host.append(note);doc.body.append(host);
    let stopped=false,busy=false,controller=null;
    async function refresh(){
      if(stopped||busy)return;busy=true;
      const signals=Object.create(null);controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),6000);
      await Promise.all([...new Set(items.flatMap(screens))].map(async id=>{
        try{const r=await fetcher('https://api.admira.store/signage/now?screen='+encodeURIComponent(id),{cache:'no-store',signal:controller.signal});signals[id]=r.ok?signal(await r.json()):'unknown';}catch{signals[id]='unknown';}
      }));
      clearTimeout(timeout);busy=false;if(stopped)return;
      rows.forEach(({loc,row,status,detail})=>{
        const h=health(loc,signals);row.dataset.state=h.state;status.textContent=L[h.state];
        detail.textContent=screens(loc).length?`${h.online}/${h.total} ${L.screens} · ${h.unknown} ${L.unknown.toLowerCase()}`:L.none;
      });
      note.textContent=L.note+' · '+new Date().toLocaleTimeString(lang==='en'?'en-GB':'es-ES');
    }
    refresh();const timer=setInterval(refresh,15000);
    return {destroy(){stopped=true;clearInterval(timer);controller?.abort();host.remove();},element:host};
  }
  const api={screens,signal,health,create,FRESH_MS};root.TourHealth=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
