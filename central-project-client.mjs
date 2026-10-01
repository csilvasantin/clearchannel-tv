export const CENTRAL='https://www.admiranext.com';
const KEY='admiranext.xpace.read.v1';
export function validAccess(data,now=Date.now()){return !!data&&/^[0-9a-f]{64}$/.test(data.token||'')&&Number(data.expires_at)>now&&Number(data.expires_at)<=now+10*60*1000+5000;}
export class ProjectClient {
 constructor({storage,fetchImpl=(...args)=>globalThis.fetch(...args)}={}){this.storage=storage;this.fetchImpl=fetchImpl;this.access=null;this.expired=false;try{const value=JSON.parse(storage?.getItem(KEY)||'null');if(validAccess(value))this.access=value;else{this.expired=!!value;storage?.removeItem(KEY);}}catch{}}
 accept(data){if(!validAccess(data))throw Error('Invalid AdmiraNext access');this.access={token:data.token,expires_at:data.expires_at};try{this.storage?.setItem(KEY,JSON.stringify(this.access));}catch{}}
 clear(){this.access=null;try{this.storage?.removeItem(KEY);}catch{}}
 async demos(){const r=await this.fetchImpl(CENTRAL+'/api/xpace/demos',{credentials:'omit',cache:'no-store'});if(!r.ok)throw Error('AdmiraNext unavailable');return r.json();}
 async context(){if(!validAccess(this.access)){this.clear();throw Error('SESSION_EXPIRED');}const r=await this.fetchImpl(CENTRAL+'/api/xpace/context',{headers:{Authorization:'Bearer '+this.access.token},credentials:'omit',cache:'no-store'});if(r.status===401){this.clear();throw Error('SESSION_EXPIRED');}if(!r.ok)throw Error('CENTRAL_UNAVAILABLE');return r.json();}
 async disconnect(){const old=this.access;this.clear();if(old)await this.fetchImpl(CENTRAL+'/api/xpace/connect',{method:'DELETE',headers:{Authorization:'Bearer '+old.token},credentials:'omit'}).catch(()=>{});}
}
export function venueUrl(href,venue,project,quality){
 const source=new URL(venue.xpace_url),current=new URL(href);
 if(!['https://www.xpaceos.com','https://www.admira.store'].includes(source.origin)||source.pathname!=='/admira-xp/'||source.username||source.password||venue.project_id!==project.id)throw Error('Invalid venue');
 // The two language domains serve the same renderer; the central association
 // supplies the venue. Quality, language and browser layout remain local.
 source.host=current.host;source.protocol=current.protocol;
 source.searchParams.set('project',project.id);source.searchParams.set('circuit',project.circuit);source.searchParams.set('venue',venue.id);
 for(const k of ['lang','langlock'])if(current.searchParams.has(k))source.searchParams.set(k,current.searchParams.get(k));
 const selected=quality||current.searchParams.get('quality')||current.searchParams.get('visual')||'better';
 const q=selected==='matrix'&&source.searchParams.get('loc')!=='alsea-sbux-021'||selected==='best'&&source.searchParams.get('autostart')==='cafeteria'&&source.searchParams.get('loc')!=='alsea-sbux-021'?'better':selected;
 source.searchParams.delete('visual');source.searchParams.set('quality',['good','better','best','matrix'].includes(q)?q:'better');
 return source.href;
}

export function connectCentral(client,{onComplete,onError,onWaiting}){
 const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
 const state=random(),verifier=random(),popup=window.open('about:blank','admiranext-xpace','popup,width=520,height=680'),controller=new AbortController();
 let timer,stopped=false;
 const cancel=()=>{stopped=true;controller.abort();clearTimeout(timer);try{popup?.close();}catch{}};
 if(!popup){onError(Error('POPUP_BLOCKED'));return null;}
 const post=body=>fetch(CENTRAL+'/api/xpace/link',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',signal:controller.signal,body:JSON.stringify(body)});
 (async()=>{
  const challenge=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),v=>v.toString(16).padStart(2,'0')).join('');
  const begun=await post({action:'begin',state,challenge});if(!begun.ok)throw Error('CENTRAL_UNAVAILABLE');
  if(stopped)return;
  popup.location.href=CENTRAL+'/xpace/connect?'+new URLSearchParams({origin:location.origin,state});onWaiting();
  const started=Date.now();
  async function poll(){if(stopped)return;try{if(Date.now()-started>300000)throw Error('SESSION_EXPIRED');const r=await post({action:'claim',state,verifier});if(r.status===202){timer=setTimeout(poll,1500);return;}if(!r.ok)throw Error('SESSION_EXPIRED');const data=await r.json();if(stopped)return;client.accept(data);cancel();onComplete();}catch(e){if(!stopped){cancel();onError(e);}}}
  await poll();
 })().catch(e=>{if(!stopped){cancel();onError(e);}});
 return cancel;
}
