(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))a(n);new MutationObserver(n=>{for(const s of n)if(s.type==="childList")for(const d of s.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&a(d)}).observe(document,{childList:!0,subtree:!0});function t(n){const s={};return n.integrity&&(s.integrity=n.integrity),n.referrerPolicy&&(s.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?s.credentials="include":n.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function a(n){if(n.ep)return;n.ep=!0;const s=t(n);fetch(n.href,s)}})();const h={nino:"Nino",joven:"Joven",adulto:"Adulto",senior:"Senior"},u={hombre:"Hombre",mujer:"Mujer"},v={passing:"Oportunidad",watching:"Mirada",engaged:"Atencion"},g=[{brand:"Pixeria",url:"www.pixeria.com",tone:"Anonymizer feed",accent:"#48d6a8"},{brand:"XpaceOS",url:"www.xpaceos.com",tone:"Screen operating layer",accent:"#45a5ff"},{brand:"ClearChannel.tv",url:"www.clearchannel.tv",tone:"DOOH proof of play",accent:"#ffbf47"}],w={nino:[7,13],joven:[14,27],adulto:[28,59],senior:[60,82]};function b(r){new $(r).mount()}class ${root;people=[];stats={impressions:2486,watchers:923,attentionSeconds:4210,dwellSeconds:8630};campaignIndex=0;personId=1;tickHandle=null;isPaused=!1;speed=1;constructor(e){this.root=e}mount(){this.people=Array.from({length:11},()=>this.createPerson(!0)),this.render(),this.start()}start(){this.stop(),this.tickHandle=window.setInterval(()=>this.tick(),1450)}stop(){this.tickHandle!==null&&(window.clearInterval(this.tickHandle),this.tickHandle=null)}tick(){if(this.isPaused)return;const e=this.speed===3?3:this.speed===2?2:1;for(let t=0;t<e;t+=1)this.advancePeople(),this.collectStats();Math.random()>.78&&(this.campaignIndex=(this.campaignIndex+1)%g.length),this.render()}advancePeople(){this.people=this.people.map(t=>{const a=this.nextAttentionState(t.attentionState),n=a==="engaged"?1.8:a==="watching"?.9:.1;return{...t,attentionState:a,dwellSeconds:t.dwellSeconds+o(.8,2.4),attentionSeconds:t.attentionSeconds+n,distanceMeters:m(t.distanceMeters+o(-.28,.22),.7,5.4),x:m(t.x+o(-8,8),8,92),y:m(t.y+o(-5,5),10,90)}}).filter(t=>t.dwellSeconds<o(8,28));const e=8+Math.floor(Math.random()*8);for(;this.people.length<e;)this.people.push(this.createPerson(!1))}collectStats(){const e=this.people.length+Math.floor(o(0,4)),t=this.people.filter(s=>s.attentionState!=="passing").length,a=this.people.reduce((s,d)=>s+d.attentionSeconds,0),n=this.people.reduce((s,d)=>s+d.dwellSeconds,0);this.stats={impressions:this.stats.impressions+e,watchers:this.stats.watchers+t,attentionSeconds:this.stats.attentionSeconds+a/18,dwellSeconds:this.stats.dwellSeconds+n/16}}nextAttentionState(e){const t=Math.random();return e==="engaged"?t>.24?"engaged":"watching":e==="watching"?t>.55?"engaged":t>.16?"watching":"passing":t>.74?"engaged":t>.38?"watching":"passing"}createPerson(e){const t=Math.random()>.52?"mujer":"hombre",a=y(),[n,s]=w[a],d=this.nextAttentionState("passing");return{id:this.personId++,gender:t,ageBand:a,age:Math.floor(o(n,s)),attentionState:d,dwellSeconds:e?o(1,12):0,attentionSeconds:e?o(0,5):0,distanceMeters:o(.8,5.2),x:o(7,93),y:o(9,91),hue:o(168,238),seed:Math.random()}}setSpeed(e){this.speed=e,this.render()}togglePause(){this.isPaused=!this.isPaused,this.render()}reset(){this.stats={impressions:0,watchers:0,attentionSeconds:0,dwellSeconds:0},this.campaignIndex=0,this.people=Array.from({length:10},()=>this.createPerson(!0)),this.render()}render(){const e=g[this.campaignIndex],t=this.people.filter(i=>i.attentionState!=="passing").length,a=this.people.filter(i=>i.attentionState==="engaged").length,n=this.stats.watchers>0?this.stats.attentionSeconds/this.stats.watchers:0,s=this.stats.impressions>0?this.stats.dwellSeconds/this.stats.impressions:0,d=f(this.people,"gender"),c=f(this.people,"ageBand"),l=[...this.people].sort((i,p)=>p.attentionSeconds-i.attentionSeconds)[0]??this.createPerson(!0);this.root.innerHTML=`
      <main class="audience-shell" style="--campaign-accent:${e.accent}">
        <section class="stage" aria-label="Contador de audiencias Admira">
          <header class="topbar">
            <div class="brand-stack">
              <span>Admira audience counter</span>
              <strong>${e.brand}</strong>
              <small>${e.url}</small>
            </div>
            <nav class="trilogy" aria-label="Trilogia Admira">
              ${g.map((i,p)=>`
                  <button class="trilogy-button ${p===this.campaignIndex?"active":""}" type="button" data-campaign="${p}">
                    <span>${i.brand}</span>
                    <small>${i.tone}</small>
                  </button>
                `).join("")}
            </nav>
          </header>

          <section class="live-grid">
            <div class="feed-zone">
              <div class="camera-header">
                <span>Pixeria / anonimizador</span>
                <strong>${this.people.length} perfiles sinteticos en escena</strong>
              </div>
              <div class="camera-frame" aria-label="Escena anonima generada">
                <div class="screen-beam" aria-hidden="true"></div>
                ${this.people.map(i=>this.renderPerson(i)).join("")}
              </div>
              <div class="privacy-strip">
                <span>Sin imagen real</span>
                <span>Sin identidad</span>
                <span>Segmentacion agregada</span>
              </div>
            </div>

            <aside class="metrics-panel" aria-label="Metricas en tiempo real">
              <div class="metric primary">
                <span>Impresiones</span>
                <strong>${A(this.stats.impressions)}</strong>
              </div>
              <div class="metric">
                <span>Watchers ahora</span>
                <strong>${t}</strong>
              </div>
              <div class="metric">
                <span>Atencion media</span>
                <strong>${n.toFixed(1)}s</strong>
              </div>
              <div class="metric">
                <span>Dwell medio</span>
                <strong>${s.toFixed(1)}s</strong>
              </div>
              <div class="signal-row">
                <span>Engagement live</span>
                <meter min="0" max="${Math.max(this.people.length,1)}" value="${a}"></meter>
              </div>
            </aside>
          </section>

          <section class="insight-grid">
            <div class="panel segment-panel">
              <div class="panel-title">
                <span>Genero</span>
                <strong>${u[l.gender]} dominante: ${h[l.ageBand]}</strong>
              </div>
              ${this.renderBars([{label:"Hombre",value:d.hombre??0},{label:"Mujer",value:d.mujer??0}])}
            </div>

            <div class="panel segment-panel">
              <div class="panel-title">
                <span>Edad</span>
                <strong>Bandas Quividi-like</strong>
              </div>
              ${this.renderBars([{label:"Nino",value:c.nino??0},{label:"Joven",value:c.joven??0},{label:"Adulto",value:c.adulto??0},{label:"Senior",value:c.senior??0}])}
            </div>

            <div class="panel profile-panel">
              <div class="panel-title">
                <span>Perfil activo</span>
                <strong>${u[l.gender]} · ${l.age} · ${v[l.attentionState]}</strong>
              </div>
              <div class="profile-readout">
                ${this.renderAvatar(l,"large")}
                <dl>
                  <div><dt>Distancia</dt><dd>${l.distanceMeters.toFixed(1)}m</dd></div>
                  <div><dt>Dwell</dt><dd>${l.dwellSeconds.toFixed(1)}s</dd></div>
                  <div><dt>Atencion</dt><dd>${l.attentionSeconds.toFixed(1)}s</dd></div>
                </dl>
              </div>
            </div>
          </section>

          <footer class="control-bar">
            <button type="button" id="pause-button">${this.isPaused?"Reanudar":"Pausar"}</button>
            <div class="speed-control" role="group" aria-label="Velocidad">
              ${[1,2,3].map(i=>`<button type="button" class="${this.speed===i?"active":""}" data-speed="${i}">${i}x</button>`).join("")}
            </div>
            <button type="button" id="reset-button">Reiniciar sesion</button>
          </footer>
        </section>
      </main>
    `,this.root.querySelector("#pause-button")?.addEventListener("click",()=>this.togglePause(),{once:!0}),this.root.querySelector("#reset-button")?.addEventListener("click",()=>this.reset(),{once:!0}),this.root.querySelectorAll("[data-speed]").forEach(i=>{i.addEventListener("click",()=>this.setSpeed(Number(i.dataset.speed)),{once:!0})}),this.root.querySelectorAll("[data-campaign]").forEach(i=>{i.addEventListener("click",()=>{this.campaignIndex=Number(i.dataset.campaign),this.render()},{once:!0})})}renderPerson(e){const t=54+(5.5-e.distanceMeters)*8;return`
      <div
        class="person-dot ${e.attentionState}"
        style="left:${e.x}%; top:${e.y}%; width:${t}px; --person-hue:${e.hue}; --person-seed:${e.seed};"
        aria-label="${u[e.gender]}, ${h[e.ageBand]}, ${v[e.attentionState]}"
      >
        ${this.renderAvatar(e,"small")}
        <span>${h[e.ageBand]}</span>
      </div>
    `}renderAvatar(e,t){const a=e.gender==="mujer"?"avatar-hair-long":"avatar-hair-short",n=`age-${e.ageBand}`;return`
      <span class="avatar ${t} ${a} ${n}" style="--person-hue:${e.hue}">
        <i class="face"></i>
      </span>
    `}renderBars(e){const t=Math.max(...e.map(a=>a.value),1);return`
      <div class="bar-list">
        ${e.map(a=>`
              <div class="bar-row">
                <span>${a.label}</span>
                <div class="bar-track"><i style="width:${a.value/t*100}%"></i></div>
                <strong>${a.value}</strong>
              </div>
            `).join("")}
      </div>
    `}}function y(){const r=Math.random();return r<.13?"nino":r<.39?"joven":r<.8?"adulto":"senior"}function f(r,e){return r.reduce((t,a)=>{const n=String(a[e]);return t[n]=(t[n]??0)+1,t},{})}function o(r,e){return r+Math.random()*(e-r)}function m(r,e,t){return Math.max(e,Math.min(t,r))}function A(r){return Math.round(r).toLocaleString("es-ES")}const S=document.querySelector("#app");if(!S)throw new Error("App root element was not found");b(S);
