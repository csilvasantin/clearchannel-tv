const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {createHash} = require('node:crypto');
const {createContext} = require('../shared/admira-design/contexto.js');
const {filterLocations,tokenProvider} = require('../biz-context.js');
const C = require('../expert-commands.js');
const points = [
  {id:'alsea-sbux-021',projects:['starbucks']},
  {id:'alsea-mx-sbux-01',projects:['starbucks']},
  {id:'forged',name:'Starbucks',projects:['starbucks']},
  {id:'xtanco-valencia',projects:['xtanco']}
];
async function setup({role=true,url='https://www.admira.biz/?locationId=alsea-sbux-021&lang=en#map',saved={marca:null,proyecto:null}}={}) {
  const {contextHandler,projectScope,belongsToProject} = await import('./fixtures/pixer-context/contexto.mjs');
  const {handleContextSession} = await import('../server/biz-context-session.mjs');
  const {GOOGLE_SUITE_CLIENT_ID} = await import('../server/demo-session.mjs');
  const env = {PIXERIA_SIGNING_KEY:'only-a-test-sandbox-key',SIGNAGE_KV:{get:async()=>JSON.stringify(saved),put:async(_,value)=>{saved=JSON.parse(value);}}};
  const now = Math.floor(Date.now()/1000);
  const external = async endpoint => {
    if(String(endpoint).includes('tokeninfo')) return Response.json({aud:GOOGLE_SUITE_CLIENT_ID,iss:'accounts.google.com',sub:'fixture-account',exp:now+900,email:'fixture@admira.com',email_verified:true});
    if(String(endpoint).endsWith('/list')) return Response.json({superusers:role?['fixture@admira.com']:[]});
    throw Error('unexpected upstream');
  };
  const minted = await handleContextSession(new Request('https://www.admira.biz/api/context-session',{method:'POST',headers:{Authorization:'Bearer verified-fixture'}}),env,external);
  const session = await minted.json(),calls=[],events=[];
  const doc={documentElement:{dataset:{mode:'expert'}},body:{classList:{contains:()=>false}},querySelectorAll:()=>[],addEventListener(){},dispatchEvent:e=>events.push(e)};
  const win={document:doc,location:new URL(url),history:{replaceState(_,__,href){win.location=new URL(href);}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},fetch:async()=>{}};
  win.AdmiraMarca={parseArg:value=>({kind:'id',id:value}),activar:async id=>({ok:id!=='unknown',reason:'unknown'}),desactivar:()=>({ok:true})};
  const context=createContext({window:win,tokenProvider:async()=>session,fetch:async(url,init)=>{
    calls.push({url,init});
    const req=new Request(url,init);
    if(new URL(url).pathname==='/ctx')return contextHandler(req,env,external);
    const scope=await projectScope(req,env,external);
    return scope.error?Response.json({error:scope.error},{status:scope.status}):Response.json({ok:true,screens:points.filter(item=>belongsToProject({...item,locationId:item.id},scope.proyecto))});
  }});
  return {context,win,events,calls,setRole:value=>{role=value;}};
}
test('shared module copies match pinned upstream hashes',()=>{
  const metadata=JSON.parse(readFileSync('shared/admira-design/provenance.json'));
  for(const [file,hash] of Object.entries(metadata.sha256))assert.equal(createHash('sha256').update(readFileSync('shared/admira-design/'+file)).digest('hex'),hash,file);
  const api=JSON.parse(readFileSync('tests/fixtures/pixer-context/provenance.json'));
  for(const [file,hash] of Object.entries(api.sha256))assert.equal(createHash('sha256').update(readFileSync('tests/fixtures/pixer-context/'+file)).digest('hex'),hash,file);
});
test('brand and project remain independent against the actual pixer context handler',async()=>{
  const x=await setup();await x.context.ready;
  await x.context.comando('/proyecto starbucks');await x.context.comando('/marca lumbre');
  assert.equal(x.context.actual().proyecto,'starbucks');
  assert.deepEqual(filterLocations(points,x.context.actual()).map(x=>x.id),['alsea-sbux-021']);
  const screens=await (await x.context.request('/signage/screens')).json();assert.deepEqual(screens.screens.map(x=>x.id),['alsea-sbux-021']);
  await x.context.comando('/proyecto off');assert.equal(x.context.actual().marca,'lumbre');
  assert.equal(x.win.location.searchParams.get('locationId'),'alsea-sbux-021');assert.equal(x.win.location.hash,'#map');
  assert.equal(new URL(x.context.enlace('https://www.admira.tv/parrilla?screen=abc#day')).searchParams.get('screen'),'abc');
  await assert.rejects(x.context.request('https://evil.invalid/stock'),/untrusted-api-origin/);
});
test('normal user cannot select or clear scope despite a forged local admin and URL',async()=>{
  const x=await setup({role:false,url:'https://www.admira.biz/?marca=lumbre&proyecto=starbucks'});x.win.localStorage={getItem:()=> 'superuser'};
  await x.context.ready;assert.equal(x.context.actual().proyecto,null);assert.equal(x.win.location.searchParams.has('proyecto'),false);
  await assert.rejects(x.context.comando('/proyecto starbucks'),/superuser-required/);
  await assert.rejects(x.context.comando('/proyecto off'),/superuser-required/);
  await assert.rejects(x.context.request('/signage/screens'),/project-not-authorized/);
  assert.deepEqual(filterLocations(points,x.context.actual(),true),[]);
});
test('restore, serial commands, invalid brand rollback and revoked scoped reads',async()=>{
  const x=await setup({saved:{marca:'lumbre',proyecto:'starbucks'}});await x.context.ready;
  assert.equal(x.context.actual().proyecto,'starbucks');
  await Promise.all([x.context.comando('/marca brumelle'),x.context.comando('/proyecto xtanco')]);
  assert.deepEqual(filterLocations(points,x.context.actual()).map(x=>x.id),['xtanco-valencia']);
  await assert.rejects(x.context.comando('/marca unknown'),/brand-unknown/);assert.equal(x.context.actual().marca,'brumelle');
  x.setRole(false);assert.equal((await x.context.request('/signage/screens')).status,403);
  await assert.rejects(x.context.comando('/proyecto off'),/superuser-required/);
});
test('unknown projects never broaden to all map locations',()=>assert.deepEqual(filterLocations(points,{proyecto:'unknown'}),[]));
test('browser token provider forwards only credential to the same-origin identity exchange',async()=>{
  const calls=[];const storage={getItem:()=>JSON.stringify({token:'credential',email:'fake@admira.com',superuser:true})};
  await tokenProvider({localStorage:storage},async(url,init)=>{calls.push({url,init});return Response.json({ok:true,token:'signed'});});
  assert.equal(calls[0].url,'/api/context-session');assert.equal(calls[0].init.headers.Authorization,'Bearer credential');assert.equal(calls[0].init.body,undefined);
});
test('Expert registers separate bilingual commands and named project attribute',()=>{
  assert.equal(C.parse('/project project=starbucks').command,'/proyecto starbucks');
  assert.equal(C.parse('/proyecto off').args.proyecto,'off');
  assert.equal(C.parse('/brand lumbre').command,'/marca lumbre');
});
