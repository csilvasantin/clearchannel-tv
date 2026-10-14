// Loopback-only review sandbox. No production bindings, secrets or deployment.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {handleContextSession} from '../server/biz-context-session.mjs';
import {GOOGLE_SUITE_CLIENT_ID} from '../server/demo-session.mjs';
import {contextHandler,projectScope,belongsToProject} from '../tests/fixtures/pixer-context/contexto.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const port=Number(process.env.BIZ_PREVIEW_PORT || 5977),origin='http://127.0.0.1:'+port;
const records=new Map(),fixtures=[
  {id:'alsea-sbux-021',locationId:'alsea-sbux-021',loc:'alsea-sbux-021',screen:'preview-sbux-pdg103',online:true,projects:['starbucks']},
  {id:'alsea-sbux-madrid',locationId:'alsea-sbux-madrid',loc:'alsea-sbux-madrid',screen:'preview-sbux-madrid',online:true,projects:['starbucks']},
  {id:'alsea-mx-sbux-01',locationId:'alsea-mx-sbux-01',loc:'alsea-mx-sbux-01',screen:'preview-mexico',online:false,projects:['starbucks']},
  {id:'xtanco-valencia',locationId:'xtanco-valencia',loc:'xtanco-valencia',screen:'preview-xtanco',online:true,projects:['xtanco']}
];
const env={PIXERIA_SIGNING_KEY:randomBytes(32).toString('hex'),SIGNAGE_KV:{get:async key=>records.get(key)||null,put:async(key,value)=>records.set(key,value)}};
const external=async url=>{
  const u=new URL(url);
  if(u.hostname==='oauth2.googleapis.com') {
    const credential=u.searchParams.get('id_token');
    if(!['fixture-reader','fixture-superuser'].includes(credential))return Response.json({error:'invalid-fixture'},{status:401});
    return Response.json({aud:GOOGLE_SUITE_CLIENT_ID,iss:'accounts.google.com',sub:credential,exp:Math.floor(Date.now()/1000)+900,email:credential+'@admira.com',email_verified:true});
  }
  if(u.hostname==='whitelist.admira.store' && u.pathname==='/list')return Response.json({superusers:['fixture-superuser@admira.com']});
  throw Error('sandbox-outbound-disabled');
};
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.md':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,origin);
    if(req.headers.host!=='127.0.0.1:'+port && req.headers.host!=='localhost:'+port){res.writeHead(403);res.end();return;}
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    let response;
    if(url.pathname==='/api/context-session')response=await handleContextSession(request,env,external);
    else if(url.pathname==='/ctx')response=await contextHandler(request,env,external);
    else if(url.pathname==='/signage/screens') {
      const scope=await projectScope(request,env,external);
      response=scope.error?Response.json({error:scope.error},{status:scope.status}):Response.json({ok:true,screens:fixtures.filter(item=>belongsToProject(item,scope.proyecto))});
    } else if(req.method!=='GET' && req.method!=='HEAD')response=Response.json({error:'sandbox-mutation-disabled'},{status:403});
    else if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/rtb/')||url.pathname.startsWith('/signage/'))response=Response.json({error:'sandbox-route-disabled'},{status:404});
    else {
      let path=decodeURIComponent(url.pathname);
      if(path==='/'||path.endsWith('/'))path+='index.html';
      else if(!extname(path))path+='.html';
      const file=resolve(root,'.'+path);
      if(!file.startsWith(root+sep))throw Error('invalid-path');
      if(path.includes('/.') || path.startsWith('/tests/') || path.startsWith('/server/'))throw Error('private-path');
      let data=await readFile(file);
      if(['.js','.mjs'].includes(extname(path)))data=Buffer.from(data.toString().replaceAll('https://api.admira.store',origin));
      if(path==='/brand.js')data=Buffer.from(data.toString().replace("var hostname = String(window.location.hostname || '').toLowerCase();","var hostname = 'www.admira.biz';"));
      response=new Response(data,{headers:{'Content-Type':types[extname(file)]||'application/octet-stream'}});
    }
    const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Admira-Preview','5977-local-synthetic');
    res.writeHead(response.status,Object.fromEntries(headers));res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  } catch {res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found / No encontrado');}
});
server.listen(port,'127.0.0.1',()=>console.log('Preview local · encargo #5977 · admira.biz sobre el código común · '+origin+'/preview/'));
