(function(root){
  'use strict';
  function fromLocations(items){
    const projects=new Set();
    for(const item of items||[]){
      try {
        const url=new URL(item.xpaceUrl);
        if(url.protocol!=='https:')continue;
        const project=url.searchParams.get('project');
        if(project&&/^[a-z0-9][a-z0-9_.-]{0,79}$/i.test(project)&&project!=='general')projects.add(project);
      }catch(_){}
    }
    return projects.size===1?{project:[...projects][0]}:{};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={fromLocations};
  if(!root.document)return;
  function context(){
    const params=new URL(root.location.href).searchParams;
    const explicit=params.get('project')||params.get('proyecto');
    if(explicit)return {project:explicit};
    let items=typeof root.selectedLocations==='function'?root.selectedLocations():[];
    if(!items.length&&typeof root.currentCircuitItems==='function')items=root.currentCircuitItems();
    return fromLocations(items);
  }
  root.AdmiraIOSDemoContext=root.AdmiraIOSDemoContext||context;
  root.AdmiraAndroidDemoContext=root.AdmiraAndroidDemoContext||root.AdmiraIOSDemoContext;
})(typeof window!=='undefined'?window:globalThis);
