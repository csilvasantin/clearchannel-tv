import {taggedFormat} from './screen-format.mjs';
import {handleDemoSession} from './demo-session.mjs';
const MCP='https://mcp.admira.store';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const reply=(body,status=200)=>Response.json(body,{status,headers});
const slug=value=>/^[a-z0-9][a-z0-9-]{1,79}$/.test(String(value||''));
export async function handleGlobalDemo(request,env,fetcher=fetch){
 if(request.method==='OPTIONS')return new Response(null,{headers});
 if(!env.ORDERS_DB)return reply({error:'registry_unavailable'},503);
 await env.ORDERS_DB.prepare('CREATE TABLE IF NOT EXISTS global_demo_playlists(project_id TEXT PRIMARY KEY, playlist_id TEXT, owner_token TEXT, title TEXT NOT NULL, created_at INTEGER NOT NULL)').run();
 const url=new URL(request.url),id=url.searchParams.get('project')||'sneakers-store';
 if(!slug(id))return reply({error:'invalid_project'},400);
 const channel=url.searchParams.get('channel')||'horizontal';
 if(!['horizontal','vertical'].includes(channel))return reply({error:'invalid_channel'},400);
 const registryId=channel==='horizontal'?id:id+'--vertical';
 const row=await env.ORDERS_DB.prepare('SELECT * FROM global_demo_playlists WHERE project_id=?').bind(registryId).first();
 async function resolveTrack(query){const r=await fetcher(MCP+'/pixeria/search?query='+encodeURIComponent(query)+'&limit=1');if(!r.ok)throw Error('stock_unavailable');const result=await r.json();if(result.total!==1)throw Error('unknown_stock');return result.items[0];}
 async function formattedPlaylist(p){const tracks=await Promise.all(p.tracks.map(async track=>{try{const asset=await resolveTrack(track.id);if(asset.url!==track.url)throw Error('asset_url_mismatch');return {...track,num:asset.num,tags:asset.tags,format:taggedFormat(asset.tags)};}catch{return {...track,tags:[],format:'unknown'};}}));return {...p,channel,tracks};}
 if(request.method==='GET'){
  if(!row?.playlist_id)return reply({project_id:id,playlist:null,pending:!!row});
  const r=await fetcher(MCP+'/playlists/'+encodeURIComponent(row.playlist_id));
  if(!r.ok)return reply({error:'playlist_unavailable'},502);
  return reply({project_id:id,channel,playlist:await formattedPlaylist(await r.json())});
 }
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
 const auth=await handleDemoSession(new Request('https://www.admira.biz/api/demo-session',{method:'POST',headers:{Authorization:request.headers.get('Authorization')||''}}),fetcher);
 if(!auth.ok)return reply({error:'sign_in_required'},401);
 if(!(await auth.json()).canManageCatalog)return reply({error:'catalog_permission_required'},403);
 let body;try{body=await request.json();}catch{return reply({error:'invalid_json'},400);}
 if(row?.playlist_id&&body.action!=='update')return reply({project_id:id,channel,playlist_id:row.playlist_id,already_present:true});
 if(row&&!row.playlist_id)return reply({error:'creation_pending_retry_later'},409);
 const title=String(body.title||'').trim(),ids=body.stock_ids||body.tracks?.map(t=>t.id);
 if(!title||title.length>100||!Array.isArray(ids)||!ids.length||ids.length>20||ids.some(x=>!Number.isInteger(x)&&!(typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x))))return reply({error:'title_and_stock_numbers_required'},400);
 const tracks=[];
 for(const num of ids){let asset;try{asset=await resolveTrack(num);}catch(e){return reply({error:e.message,num},400);}if(body.tracks&&!body.stock_ids&&body.tracks.some(t=>t.id===asset.id&&t.url!==asset.url))return reply({error:'asset_url_mismatch'},400);const format=taggedFormat(asset.tags);if(format!==channel)return reply({error:'incompatible_screen_format',num,required:channel,actual:format},400);tracks.push({id:asset.id,title:asset.title,url:asset.url});}
 if(row?.playlist_id){
  const r=await fetcher(MCP+'/playlists/'+encodeURIComponent(row.playlist_id),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+row.owner_token},body:JSON.stringify({title,tracks,loop:body.loop,expected_revision:body.expected_revision})});
  return reply(await r.json(),r.status);
 }
 // Unique project key makes repeat clicks and concurrent requests non-duplicating.
 const lock=await env.ORDERS_DB.prepare('INSERT OR IGNORE INTO global_demo_playlists VALUES(?,NULL,NULL,?,?)').bind(registryId,title,Date.now()).run();
 if(!lock.meta?.changes)return reply({error:'creation_pending_retry_later'},409);
 try{
  const r=await fetcher(MCP+'/playlists',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,tracks,loop:true})});
  if(!r.ok){await env.ORDERS_DB.prepare('DELETE FROM global_demo_playlists WHERE project_id=? AND playlist_id IS NULL').bind(registryId).run();return reply({error:'playlist_creation_failed'},502);}
  const p=await r.json();
  await env.ORDERS_DB.prepare('UPDATE global_demo_playlists SET playlist_id=?,owner_token=? WHERE project_id=?').bind(p.playlist_id,p.owner_token,registryId).run();
  // Ownership remains in the server; public JSON never contains the edit credential.
  delete p.owner_token;return reply({project_id:id,playlist:p},201);
 }catch{return reply({error:'creation_outcome_unknown_contact_admin'},503);}
}
