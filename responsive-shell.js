// Galaxy shell: independent left, right and bottom panels, closed on entry.
(() => {
  const header=document.querySelector('body > header');
  const panels={options:document.getElementById('header-navigation'),advanced:document.getElementById('advanced-tools'),expert:document.getElementById('expert-panel')};
  const toggles=Object.fromEntries([...document.querySelectorAll('[data-mode]')].map(b=>[b.dataset.mode,b]));
  if(!header||Object.values(panels).some(p=>!p))return;
  const es=()=>document.documentElement.lang!=='en';
  const text=(a,b)=>es()?a:b;
  const isOpen=mode=>mode==='advanced'?panels[mode].open:!panels[mode].hidden;
  const measure=()=>document.documentElement.style.setProperty('--app-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
  function sync(){
    for(const mode of Object.keys(panels)){const open=isOpen(mode);toggles[mode].setAttribute('aria-expanded',String(open));toggles[mode].setAttribute('aria-pressed',String(open));document.body.classList.toggle('mode-'+mode+'-open',open);}
  }
  function setOpen(mode,open,{focus=false}={}){
    if(mode==='advanced')panels[mode].open=open;else panels[mode].hidden=!open;
    sync();if(open&&focus){if(mode==='expert')document.getElementById('expert-command').focus();else (panels[mode].querySelector('a,button')||panels[mode]).focus();}
  }
  for(const [mode,button] of Object.entries(toggles))button.addEventListener('click',()=>setOpen(mode,!isOpen(mode),{focus:true}));
  document.querySelectorAll('[data-close-mode]').forEach(b=>b.addEventListener('click',()=>{const mode=b.dataset.closeMode;setOpen(mode,false);toggles[mode].focus();}));
  panels.advanced.addEventListener('toggle',sync);
  panels.advanced.addEventListener('click',event=>{if(event.target.closest('.advanced-actions button:not(#advanced-emission)'))setOpen('advanced',false);});
  // Close the focused shell panel first, so dialogs retain their Escape behavior.
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||event.defaultPrevented)return;
    const mode=Object.keys(panels).find(m=>isOpen(m)&&panels[m].contains(event.target));
    if(mode){setOpen(mode,false);toggles[mode].focus();}
  });
  const input=document.getElementById('expert-command'),result=document.getElementById('expert-command-result');
  document.getElementById('expert-command-form').addEventListener('submit',event=>{
    event.preventDefault();const command=input.value.trim().toLowerCase();
    if(command==='/cli'){
      if(!window.AdmiraDemo){result.textContent=text('La demo está cargando. Vuelve a ejecutar /cli.','The demo is loading. Run /cli again.');return;}
      window.AdmiraDemo.start();result.textContent=text('Demo iniciada. La compra del recorrido es simulada.','Demo started. The tour purchase is simulated.');
    }else if(command==='/help')result.textContent=text('/cli — empezar la demo guiada. /help — ayuda.','/cli — start the guided demo. /help — help.');
    else result.textContent=text('Comando no reconocido. Usa /cli o /help.','Unknown command. Use /cli or /help.');
  });
  function translate(){
    document.querySelectorAll('[data-shell-es]').forEach(el=>{const label=es()?el.dataset.shellEs:el.dataset.shellEn;el.title=label;el.setAttribute('aria-label',label);});
    document.querySelectorAll('[data-shell-text-es]').forEach(el=>{el.textContent=es()?el.dataset.shellTextEs:el.dataset.shellTextEn;});
    panels.options.setAttribute('aria-label',text('Opciones','Options'));panels.expert.setAttribute('aria-label',text('Modo experto','Expert mode'));
    result.textContent='';measure();
  }
  new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  new ResizeObserver(measure).observe(header);translate();sync();
})();
