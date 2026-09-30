// Galaxy shell: independent left, right and bottom panels, closed on entry.
(() => {
  const header=document.querySelector('body > header');
  const panels={options:document.getElementById('header-navigation'),advanced:document.getElementById('advanced-tools'),expert:document.getElementById('expert-panel')};
  const toggles=Object.fromEntries([...document.querySelectorAll('[data-mode]')].map(b=>[b.dataset.mode,b]));
  if(!header||Object.values(panels).some(p=>!p))return;
  const es=()=>document.documentElement.lang!=='en';
  const text=(a,b)=>es()?a:b;
  const isOpen=mode=>mode==='advanced'?panels[mode].open:!panels[mode].hidden;
  const measure=()=>{
    document.documentElement.style.setProperty('--app-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
    document.documentElement.style.setProperty('--expert-panel-height',(isOpen('expert')?Math.ceil(panels.expert.getBoundingClientRect().height):0)+'px');
  };
  function sync(){
    for(const mode of Object.keys(panels)){const open=isOpen(mode);toggles[mode].setAttribute('aria-expanded',String(open));toggles[mode].setAttribute('aria-pressed',String(open));document.body.classList.toggle('mode-'+mode+'-open',open);}
    measure();
  }
  function setOpen(mode,open,{focus=false}={}){
    if(mode==='advanced')panels[mode].open=open;else panels[mode].hidden=!open;
    try{localStorage.setItem('admira_panel_'+mode,open?'1':'0');}catch(_){}
    sync();if(open&&focus){if(mode==='expert')document.getElementById('expert-command').focus();else (panels[mode].querySelector('a,button')||panels[mode]).focus();}
  }
  for(const [mode,button] of Object.entries(toggles))button.addEventListener('click',()=>setOpen(mode,!isOpen(mode),{focus:true}));
  document.querySelectorAll('[data-close-mode]').forEach(b=>b.addEventListener('click',()=>{const mode=b.dataset.closeMode;setOpen(mode,false);toggles[mode].focus();}));
  panels.advanced.addEventListener('toggle',sync);
  panels.advanced.addEventListener('click',event=>{
    const action=event.target.closest('.advanced-actions button:not(#advanced-emission)');
    if(!action)return;
    setOpen('advanced',false);
    queueMicrotask(()=>{
      const selector=action.id==='header-circuit-btn'?'circuit-panel':action.id==='header-target-btn'?'target-panel':null;
      const panel=selector&&document.getElementById(selector),top=header.getBoundingClientRect().bottom+8;
      if(panel&&!panel.hidden&&panel.getBoundingClientRect().top<top)panel.style.top=top+'px';
    });
  });
  // Close the focused shell panel first, so dialogs retain their Escape behavior.
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||event.defaultPrevented)return;
    const mode=Object.keys(panels).find(m=>isOpen(m)&&panels[m].contains(event.target));
    if(mode){setOpen(mode,false);toggles[mode].focus();}
  });
  const input=document.getElementById('expert-command'),result=document.getElementById('expert-command-result');
  const say=message=>{result.textContent=message;result.hidden=!message;};
  input.addEventListener('input',()=>say(''));
  document.getElementById('expert-command-form').addEventListener('submit',event=>{
    event.preventDefault();const command=input.value.trim().toLowerCase();
    if(command==='/cli'){
      if(!window.AdmiraDemo){say(text('La demo está cargando. Vuelve a ejecutar /cli.','The demo is loading. Run /cli again.'));return;}
      say('');window.AdmiraDemo.start();
    }else if(command==='/help')say(text('/cli — empezar la demo guiada (compra simulada). /help — ayuda.','/cli — start the guided demo (simulated purchase). /help — help.'));
    else say(text('Comando no reconocido. Usa /cli o /help.','Unknown command. Use /cli or /help.'));
  });
  // Resize the rails from their inner edge and the CLI from its top edge.
  const sizeHandles={};
  function bounds(mode){
    const max=mode==='expert'?Math.max(112,innerHeight-header.getBoundingClientRect().height-24):Math.max(220,Math.min(700,innerWidth-24));
    return {min:mode==='expert'?112:220,max};
  }
  function setSize(mode,value,persist=false){
    const {min,max}=bounds(mode),size=Math.round(Math.max(min,Math.min(max,value)));
    panels[mode].style[mode==='expert'?'height':'width']=size+'px';
    const handle=sizeHandles[mode];
    handle.setAttribute('aria-valuemin',String(min));handle.setAttribute('aria-valuemax',String(max));handle.setAttribute('aria-valuenow',String(size));
    if(persist)try{localStorage.setItem('admira_panel_size_'+mode,String(size));}catch(_){}
    measure();
  }
  for(const [mode,panel] of Object.entries(panels)){
    const handle=document.createElement('div');handle.className='mode-resize mode-resize-'+mode;handle.tabIndex=0;
    handle.setAttribute('role','separator');handle.setAttribute('aria-orientation',mode==='expert'?'horizontal':'vertical');
    handle.setAttribute('aria-controls',panel.id);panel.append(handle);sizeHandles[mode]=handle;
    const initial=mode==='expert'?120:300;
    let saved;try{saved=Number(localStorage.getItem('admira_panel_size_'+mode));}catch(_){}
    setSize(mode,saved>0?saved:initial);
    let drag=null;
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      drag={start:mode==='expert'?event.clientY:event.clientX,size:panel.getBoundingClientRect()[mode==='expert'?'height':'width']};
      handle.setPointerCapture(event.pointerId);event.preventDefault();event.stopPropagation();
    });
    handle.addEventListener('pointermove',event=>{
      if(!drag)return;
      const delta=(mode==='expert'?event.clientY:event.clientX)-drag.start;
      setSize(mode,drag.size+delta*(mode==='options'?1:-1));
    });
    const stop=()=>{if(!drag)return;drag=null;setSize(mode,parseFloat(panel.style[mode==='expert'?'height':'width']),true);};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(event,stop);
    handle.addEventListener('dblclick',()=>setSize(mode,initial,true));
    handle.addEventListener('keydown',event=>{
      const directions=mode==='expert'?{ArrowUp:1,ArrowDown:-1}:mode==='advanced'?{ArrowLeft:1,ArrowRight:-1}:{ArrowLeft:-1,ArrowRight:1};
      if(event.key==='Home'){event.preventDefault();setSize(mode,initial,true);}
      else if(directions[event.key]){event.preventDefault();setSize(mode,parseFloat(panel.style[mode==='expert'?'height':'width'])+directions[event.key]*20,true);}
    });
  }
  addEventListener('resize',()=>{for(const mode of Object.keys(panels))setSize(mode,parseFloat(panels[mode].style[mode==='expert'?'height':'width']));});
  new ResizeObserver(measure).observe(panels.expert);
  function translate(){
    for(const [mode,handle] of Object.entries(sizeHandles)){const label=text('Redimensionar '+({options:'Opciones',advanced:'Modo avanzado',expert:'Modo experto'}[mode]),'Resize '+mode);handle.setAttribute('aria-label',label);handle.title=label+text(' · arrastra o usa las flechas · doble clic para restaurar',' · drag or use arrow keys · double-click to reset');}
    document.querySelectorAll('[data-shell-es]').forEach(el=>{const label=es()?el.dataset.shellEs:el.dataset.shellEn;el.title=label;el.setAttribute('aria-label',label);});
    document.querySelectorAll('[data-shell-text-es]').forEach(el=>{el.textContent=es()?el.dataset.shellTextEs:el.dataset.shellTextEn;});
    document.querySelector('.mode-switches').setAttribute('aria-label',text('Modos','Modes'));
    document.querySelectorAll('[data-close-mode]').forEach(button=>button.setAttribute('aria-label',text('Cerrar','Close')));
    panels.options.setAttribute('aria-label',text('Opciones','Options'));panels.expert.setAttribute('aria-label',text('Modo experto','Expert mode'));
    say('');measure();
  }
  new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  for(const mode of Object.keys(panels)){try{setOpen(mode,localStorage.getItem('admira_panel_'+mode)==='1');}catch(_){}}
  new ResizeObserver(measure).observe(header);translate();sync();
})();
