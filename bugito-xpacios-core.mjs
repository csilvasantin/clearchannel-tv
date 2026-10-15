// Shared, deterministic destination resolution. An ambiguous name never selects a device.
export const normalize = v => String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function parseIncidentOrder(value) {
 const raw=String(value||'').trim().replace(/^\/bugito\s+/i,'');
 if(raw.length>1200)return null;
 const m=/^(?:genera|generar|crea|crear|create|generate)\s+(?:una?\s+|an?\s+)?(?:incidencia|incident)(.*?)\s+(?:en\s+(?:el\s+)?proyecto|in\s+(?:the\s+)?project)\s+(.+?)\s+(?:en\s+(?:el\s+)?establecimiento|in\s+(?:the\s+)?(?:establishment|store))\s+(.+?)\s+(?:y\s+|and\s+)?(?:en\s+(?:la\s+)?pantalla|on\s+(?:the\s+)?screen)\s+(.+?)(?:\s+(?:gravedad|severity)\s+(normal|leve|grave|total|severe|critical))?\s*$/i.exec(raw);
 if(!m)return null;
 const clean=s=>s.trim().replace(/^["“']|["”']$/g,'').trim();
 const kind=normalize(m[1]),severity=normalize(m[5]||kind);
 return {project:clean(m[2]),location:clean(m[3]),screen:clean(m[4]),
  severity:/total|critical|urgente/.test(severity)?'urgente':/grave|severe|alta/.test(severity)?'alta':'normal',
  fault:/negro|black|total/.test(kind)?'black':/popup|pop.up/.test(kind)?'popup':/gir|rotat/.test(kind)?'rotate':/resol|canvas/.test(kind)?'canvas':'incident'};
}
export function uniqueMatch(items,value,keys) {
 const q=normalize(value);if(!q)return {error:'target_required'};
 const hits=items.filter(item=>keys(item).some(key=>normalize(key)===q));
 return hits.length===1?{item:hits[0]}:{error:hits.length?'target_ambiguous':'target_not_found'};
}
export function screensOf(location) {
 const rows=[];
 for(const s of location.iot||[])if(/pantalla|screen|display|tpv|pos|ipad/i.test(s.type||''))rows.push({id:s.code||s.idIoT,name:s.name||s.idIoT,category:/tpv|pos/i.test(s.type)?'tpv':'pantalla',equipment_number:String(s.n||''),number:/pantalla|screen|display/i.test(s.type)?String(s.n||''):'',player:s.player||'',aliases:[s.code,s.idIoT,s.instance].filter(Boolean)});
 for(const s of location.surfaces||[])if(/pantalla|escaparate|totem|tótem|mupi|screen|display/i.test(s.surface||'')){
  const id=s.itil||s.idIoT||s.id||'surface:'+s.name;
  if(!rows.some(x=>x.id===id))rows.push({id,name:s.name||id,player:s.screen||'',aliases:[s.itil,s.idIoT,s.screen].filter(Boolean)});
 }
 return rows.filter(s=>s.id&&s.name);
}
export const incidentLevel = row => row ? Number(row.severe)>0?2:Number(row.active)>0?1:0 : 0;
export const INCIDENT_COLORS=Object.freeze({0:'#39d98a',1:'#ffd23f',2:'#ff4d4d',unknown:'#80909c'});

// Existing inventory resolver understands <establishment>:<equipment>[:...].
export function equipmentKey(screen) {
 if(/^[A-Z0-9]{2,12}(?:-[A-Z0-9]{2,12}){1,3}$/.test(screen.id||''))return screen.id;
 if(screen.category==='tpv'&&/^\d+$/.test(screen.equipment_number||''))return 'tpv-'+screen.equipment_number;
 if(/^\d+$/.test(screen.number||''))return 'pantalla-'+screen.number;
 return normalize(screen.name).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
}
