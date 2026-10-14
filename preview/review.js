(function(){
  const $=id=>document.getElementById(id);
  $('identity').textContent='Identidad sintética / Synthetic identity: '+previewRole;
  for(const role of ['superuser','reader'])$(role).onclick=()=>{sessionStorage.setItem('biz-preview-role',role);location.href='/preview/?lang='+document.documentElement.lang;};
  $('language').onclick=()=>{document.documentElement.lang=document.documentElement.lang==='es'?'en':'es';};
  const paint=()=>{$('context-state').textContent=JSON.stringify(AdmiraContexto.actual(),null,2);};
  AdmiraContexto.ready.then(paint);document.addEventListener('admira:contexto',paint);
  $('review-command').onsubmit=async event=>{
    event.preventDefault();
    const result=AdmiraExpertCommands.execute($('command').value,{marca:window.AdmiraMarca},document.documentElement.lang);
    const completed=result.later?await result.later:result;
    $('command-result').textContent=(completed.lines||[]).join('\n');paint();await screens();
  };
  async function screens(){
    try{const r=await AdmiraBizContext.request('/signage/screens');$('screens').textContent='GET /signage/screens · HTTP '+r.status+'\n'+JSON.stringify(await r.json(),null,2);}catch(error){$('screens').textContent=error.message;}
  }
  $('refresh').onclick=screens;AdmiraContexto.ready.then(screens);
})();
