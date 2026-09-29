// Measure actual translated/wrapped header content, not a fixed breakpoint offset.
(() => {
  const header=document.querySelector('body > header');
  const toggle=document.getElementById('header-menu-toggle');
  const nav=document.getElementById('header-navigation');
  if(!header||!toggle||!nav)return;
  const mobile=matchMedia('(max-width:720px)');
  const measure=()=>document.documentElement.style.setProperty('--app-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
  const close=()=>{header.removeAttribute('data-nav-open');toggle.setAttribute('aria-expanded','false');measure();};
  toggle.addEventListener('click',()=>{const open=header.toggleAttribute('data-nav-open');toggle.setAttribute('aria-expanded',String(open));measure();});
  nav.addEventListener('click',event=>{if(mobile.matches&&event.target.closest('#header-planner-btn,#header-circuit-btn,#header-target-btn,#header-orders-btn,#advanced-emission,a'))close();});
  header.addEventListener('keydown',event=>{if(event.key==='Escape'&&header.hasAttribute('data-nav-open')){close();toggle.focus();}});
  mobile.addEventListener('change',close);
  new ResizeObserver(measure).observe(header);
  measure();
})();
