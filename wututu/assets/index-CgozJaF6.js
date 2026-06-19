(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))i(t);new MutationObserver(t=>{for(const a of t)if(a.type==="childList")for(const o of a.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function s(t){const a={};return t.integrity&&(a.integrity=t.integrity),t.referrerPolicy&&(a.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?a.credentials="include":t.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function i(t){if(t.ep)return;t.ep=!0;const a=s(t);fetch(t.href,a)}})();const f={nino:"Nino",joven:"Joven",adulto:"Adulto",senior:"Senior"},w={hombre:"Hombre",mujer:"Mujer"},y={passing:"Oportunidad",watching:"Mirada",engaged:"Atencion"},b={"8bit":"8 bits","16bit":"16 bits","digital-twin":"Digital twins"},E={"8bit":"stock/list?type=twin-npc + #8bit","16bit":"stock/list?type=twin-npc + #16bit","digital-twin":"stock/list?type=digital-twin"},A=[{brand:"Pixeria",url:"www.pixeria.com",tone:"Anonymizer feed",accent:"#48d6a8"},{brand:"XpaceOS",url:"www.xpaceos.com",tone:"Screen operating layer",accent:"#45a5ff"},{brand:"ClearChannel.tv",url:"www.clearchannel.tv",tone:"DOOH proof of play",accent:"#ffbf47"}],k={nino:[7,13],joven:[14,27],adulto:[28,59],senior:[60,82]},F="https://pixer-eleven.csilvasantin.workers.dev/stock/list",L="https://admira.tv/signage.html",I=12e3,l={minX:55,maxX:86,minY:13,maxY:94};function O(n){new B(n).mount()}class B{root;people=[];stats={impressions:2486,watchers:923,attentionSeconds:4210,dwellSeconds:8630};campaignIndex=0;personId=1;tickHandle=null;feedHandle=null;isPaused=!1;speed=1;audienceMode="digital-twin";feed={"8bit":[],"16bit":[],"digital-twin":[]};lastFeedSync="sin sincronizar";feedError="";constructor(e){this.root=e}mount(){this.people=Array.from({length:11},()=>this.createPerson(!0)),this.render(),this.start(),this.syncFeed(),this.feedHandle=window.setInterval(()=>{this.syncFeed()},I)}start(){this.stop(),this.tickHandle=window.setInterval(()=>this.tick(),1450)}stop(){this.tickHandle!==null&&(window.clearInterval(this.tickHandle),this.tickHandle=null)}async syncFeed(){try{const[e,s]=await Promise.all([this.fetchAssets("twin-npc",80),this.fetchAssets("digital-twin",80)]),i={"8bit":e.filter(t=>x(t,"8bit")),"16bit":e.filter(t=>x(t,"16bit")),"digital-twin":s};this.feed=i,this.lastFeedSync=new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),this.feedError="",this.seedPeopleFromFeed(),this.render()}catch(e){this.feedError=e instanceof Error?e.message:"feed no disponible",this.render()}}async fetchAssets(e,s){const i=await fetch(`${F}?type=${encodeURIComponent(e)}&limit=${s}&ts=${Date.now()}`,{cache:"no-store"});if(!i.ok)throw new Error(`Pixeria Stock HTTP ${i.status}`);const t=await i.json();return(Array.isArray(t.items)?t.items:Array.isArray(t.assets)?t.assets:[]).filter(o=>o?.id&&o?.url).sort((o,h)=>new Date(h.createdAt??0).getTime()-new Date(o.createdAt??0).getTime())}tick(){if(this.isPaused)return;const e=this.speed===3?3:this.speed===2?2:1;for(let s=0;s<e;s+=1)this.advancePeople(),this.collectStats();Math.random()>.78&&(this.campaignIndex=(this.campaignIndex+1)%A.length),this.render()}advancePeople(){this.people=this.people.map(s=>{const i=this.nextAttentionState(s.attentionState),t=i==="engaged"?1.8:i==="watching"?.9:.1,a=S($(s.x+d(-8,8),8,92),$(s.y+d(-5,5),10,90));return{...s,attentionState:i,dwellSeconds:s.dwellSeconds+d(.8,2.4),attentionSeconds:s.attentionSeconds+t,distanceMeters:$(s.distanceMeters+d(-.28,.22),.7,5.4),x:a.x,y:a.y}}).filter(s=>s.dwellSeconds<d(8,28));const e=8+Math.floor(Math.random()*8);for(;this.people.length<e;)this.people.push(this.createPerson(!1,this.pickFeedAsset()))}collectStats(){const e=this.people.length+Math.floor(d(0,4)),s=this.people.filter(a=>a.attentionState!=="passing").length,i=this.people.reduce((a,o)=>a+o.attentionSeconds,0),t=this.people.reduce((a,o)=>a+o.dwellSeconds,0);this.stats={impressions:this.stats.impressions+e,watchers:this.stats.watchers+s,attentionSeconds:this.stats.attentionSeconds+i/18,dwellSeconds:this.stats.dwellSeconds+t/16}}nextAttentionState(e){const s=Math.random();return e==="engaged"?s>.24?"engaged":"watching":e==="watching"?s>.55?"engaged":s>.16?"watching":"passing":s>.74?"engaged":s>.38?"watching":"passing"}createPerson(e,s){const i=Math.random()>.52?"mujer":"hombre",t=N(),[a,o]=k[t],h=this.nextAttentionState("passing"),u=D();return{id:this.personId++,gender:i,ageBand:t,age:Math.floor(d(a,o)),attentionState:h,dwellSeconds:e?d(1,12):0,attentionSeconds:e?d(0,5):0,distanceMeters:d(.8,5.2),x:u.x,y:u.y,hue:d(168,238),seed:Math.random(),sourceAsset:s,mode:this.audienceMode}}seedPeopleFromFeed(){const e=this.feed[this.audienceMode];if(!e.length)return;const s=new Set(this.people.map(t=>t.sourceAsset?.id).filter(Boolean)),i=e.filter(t=>!s.has(t.id)).slice(0,4);if(i.length){this.people=[...i.map(t=>this.createPerson(!1,t)),...this.people.map(t=>t.sourceAsset?g(t):g({...t,sourceAsset:this.pickFeedAsset(),mode:this.audienceMode}))].slice(0,16);return}this.people=this.people.map(t=>t.sourceAsset?g(t):g({...t,sourceAsset:this.pickFeedAsset(),mode:this.audienceMode}))}pickFeedAsset(){const e=this.feed[this.audienceMode];if(e.length)return e[Math.floor(Math.random()*Math.min(e.length,18))]}setSpeed(e){this.speed=e,this.render()}setAudienceMode(e){this.audienceMode=e;const s=this.feed[e];this.people=Array.from({length:Math.max(10,Math.min(s.length||10,14))},()=>this.createPerson(!0,this.pickFeedAsset())),this.render(),this.syncFeed()}togglePause(){this.isPaused=!this.isPaused,this.render()}reset(){this.stats={impressions:0,watchers:0,attentionSeconds:0,dwellSeconds:0},this.campaignIndex=0,this.people=Array.from({length:10},()=>this.createPerson(!0,this.pickFeedAsset())),this.render()}render(){const e=A[this.campaignIndex],i=this.feed[this.audienceMode].length,t=this.people.filter(r=>r.attentionState!=="passing").length,a=this.people.filter(r=>r.attentionState==="engaged").length,o=this.stats.watchers>0?this.stats.attentionSeconds/this.stats.watchers:0,h=this.stats.impressions>0?this.stats.dwellSeconds/this.stats.impressions:0,u=M(this.people,"gender"),m=M(this.people,"ageBand"),c=[...this.people].sort((r,p)=>+!!p.sourceAsset-+!!r.sourceAsset||p.attentionSeconds-r.attentionSeconds)[0]??this.createPerson(!0);this.root.innerHTML=`
      <main class="audience-shell" style="--campaign-accent:${e.accent}">
        <section class="stage" aria-label="Contador de audiencias Admira">
          <header class="topbar">
            <div class="brand-stack">
              <span>Admira audience counter</span>
              <strong>${e.brand}</strong>
              <small>${e.url}</small>
            </div>
            <nav class="trilogy" aria-label="Trilogia Admira">
              ${A.map((r,p)=>`
                  <button class="trilogy-button ${p===this.campaignIndex?"active":""}" type="button" data-campaign="${p}">
                    <span>${r.brand}</span>
                  </button>
                `).join("")}
            </nav>
            <div class="look-control">
              <label for="audience-mode">Look audience</label>
              <select id="audience-mode" aria-label="Look and feel de audiencia">
                ${["8bit","16bit","digital-twin"].map(r=>`<option value="${r}" ${this.audienceMode===r?"selected":""}>${b[r]}</option>`).join("")}
              </select>
            </div>
            <div class="feed-status">
              <span>Pixeria live</span>
              <strong>${i} assets</strong>
              <small>${this.feedError?`fallback ${v(this.feedError)}`:`sync ${this.lastFeedSync}`}</small>
            </div>
          </header>

          <section class="live-grid">
            <div class="feed-zone">
              <div class="camera-header">
                <span>Pixeria / anonimizador live</span>
                <strong>${this.people.length} perfiles · ${i} assets ${b[this.audienceMode]}</strong>
              </div>
              <div class="camera-frame" aria-label="Escena anonima generada">
                <div class="screen-beam" aria-hidden="true"></div>
                ${this.renderMupi()}
                ${this.people.map(r=>this.renderPerson(r)).join("")}
              </div>
              <div class="privacy-strip">
                <span>${E[this.audienceMode]}</span>
                <span>sync ${this.lastFeedSync}</span>
                <span>${this.feedError?`feed fallback: ${v(this.feedError)}`:"Stock vivo Pixeria"}</span>
              </div>
            </div>

            <aside class="metrics-panel" aria-label="Metricas en tiempo real">
              <div class="metric primary">
                <span>Impresiones</span>
                <strong>${j(this.stats.impressions)}</strong>
              </div>
              <div class="metric">
                <span>Watchers ahora</span>
                <strong>${t}</strong>
              </div>
              <div class="metric">
                <span>Atencion media</span>
                <strong>${o.toFixed(1)}s</strong>
              </div>
              <div class="metric">
                <span>Dwell medio</span>
                <strong>${h.toFixed(1)}s</strong>
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
                <strong>${w[c.gender]} dominante: ${f[c.ageBand]}</strong>
              </div>
              ${this.renderBars([{label:"Hombre",value:u.hombre??0},{label:"Mujer",value:u.mujer??0}])}
            </div>

            <div class="panel segment-panel">
              <div class="panel-title">
                <span>Edad</span>
                <strong>Bandas Quividi-like</strong>
              </div>
              ${this.renderBars([{label:"Nino",value:m.nino??0},{label:"Joven",value:m.joven??0},{label:"Adulto",value:m.adulto??0},{label:"Senior",value:m.senior??0}])}
            </div>

            <div class="panel profile-panel">
              <div class="panel-title">
                <span>Perfil activo</span>
                <strong>${w[c.gender]} · ${c.age} · ${y[c.attentionState]}</strong>
              </div>
              <div class="profile-readout">
                ${this.renderAvatar(c,"large")}
                <dl>
                  <div><dt>Fuente</dt><dd>${c.sourceAsset?"Pixeria":"Sintetico"}</dd></div>
                  <div><dt>Distancia</dt><dd>${c.distanceMeters.toFixed(1)}m</dd></div>
                  <div><dt>Dwell</dt><dd>${c.dwellSeconds.toFixed(1)}s</dd></div>
                  <div><dt>Atencion</dt><dd>${c.attentionSeconds.toFixed(1)}s</dd></div>
                </dl>
              </div>
            </div>
          </section>

          <footer class="control-bar">
            <button type="button" id="pause-button">${this.isPaused?"Reanudar":"Pausar"}</button>
            <div class="speed-control" role="group" aria-label="Velocidad">
              ${[1,2,3].map(r=>`<button type="button" class="${this.speed===r?"active":""}" data-speed="${r}">${r}x</button>`).join("")}
            </div>
            <button type="button" id="reset-button">Reiniciar sesion</button>
          </footer>
        </section>
      </main>
    `,this.root.querySelector("#pause-button")?.addEventListener("click",()=>this.togglePause(),{once:!0}),this.root.querySelector("#reset-button")?.addEventListener("click",()=>this.reset(),{once:!0}),this.root.querySelectorAll("[data-speed]").forEach(r=>{r.addEventListener("click",()=>this.setSpeed(Number(r.dataset.speed)),{once:!0})}),this.root.querySelector("#audience-mode")?.addEventListener("change",r=>{this.setAudienceMode(r.target.value)}),this.root.querySelectorAll("[data-campaign]").forEach(r=>{r.addEventListener("click",()=>{this.campaignIndex=Number(r.dataset.campaign),this.render()},{once:!0})})}renderPerson(e){const s=e.sourceAsset?72+(5.5-e.distanceMeters)*12:54+(5.5-e.distanceMeters)*8;return`
      <div
        class="person-dot ${e.attentionState} ${e.sourceAsset?"from-pixeria":"from-synthetic"} mode-${e.mode}"
        style="left:${e.x}%; top:${e.y}%; width:${s}px; --person-hue:${e.hue}; --person-seed:${e.seed};"
        aria-label="${w[e.gender]}, ${f[e.ageBand]}, ${y[e.attentionState]}, ${e.sourceAsset?"Pixeria Stock":"sintetico"}"
      >
        ${this.renderAvatar(e,"small")}
        <span>${f[e.ageBand]}</span>
      </div>
    `}renderMupi(){return`
      <div class="mupi-unit" aria-label="MUPI central emitiendo Admira TV">
        <div class="mupi-cabinet">
          <div class="mupi-screen">
            <iframe
              src="${L}"
              title="Canal de carteleria digital Admira TV"
              loading="eager"
              referrerpolicy="no-referrer"
            ></iframe>
            <div class="mupi-fallback" aria-hidden="true">
              <div class="mupi-slide slide-one">
                <strong>ADMIRA.TV</strong>
                <span>digital signage loop</span>
              </div>
              <div class="mupi-slide slide-two">
                <strong>PIXERIA</strong>
                <span>audience intelligence</span>
              </div>
              <div class="mupi-slide slide-three">
                <strong>XPACE OS</strong>
                <span>proof of play</span>
              </div>
            </div>
          </div>
          <div class="mupi-brand">admira.tv</div>
        </div>
        <div class="mupi-base" aria-hidden="true"></div>
      </div>
    `}renderAvatar(e,s){if(e.sourceAsset)return`
        <span class="asset-avatar ${s} mode-${e.mode}">
          <img src="${v(e.sourceAsset.url)}" alt="${v(e.sourceAsset.title??b[e.mode])}" loading="eager">
        </span>
      `;const i=e.gender==="mujer"?"avatar-hair-long":"avatar-hair-short",t=`age-${e.ageBand}`;return`
      <span class="avatar ${s} ${i} ${t}" style="--person-hue:${e.hue}">
        <i class="face"></i>
      </span>
    `}renderBars(e){const s=Math.max(...e.map(i=>i.value),1);return`
      <div class="bar-list">
        ${e.map(i=>`
              <div class="bar-row">
                <span>${i.label}</span>
                <div class="bar-track"><i style="width:${i.value/s*100}%"></i></div>
                <strong>${i.value}</strong>
              </div>
            `).join("")}
      </div>
    `}}function N(){const n=Math.random();return n<.13?"nino":n<.39?"joven":n<.8?"adulto":"senior"}function M(n,e){return n.reduce((s,i)=>{const t=String(i[e]);return s[t]=(s[t]??0)+1,s},{})}function x(n,e){return(n.tags??[]).some(s=>s.toLowerCase()===e.toLowerCase())}function D(){const n=Math.random()>.72?d(87,93):d(7,52),e=d(9,91);return S(n,e)}function g(n){const e=S(n.x,n.y);return{...n,x:e.x,y:e.y}}function S(n,e){const s=n>=l.minX&&n<=l.maxX,i=e>=l.minY&&e<=l.maxY;if(!s||!i)return{x:n,y:e};const t=Math.abs(n-l.minX),a=Math.abs(l.maxX-n);return t<=a||Math.random()>.18?{x:d(8,l.minX-4),y:e}:{x:d(l.maxX+2,93),y:e}}function v(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[e]??e)}function d(n,e){return n+Math.random()*(e-n)}function $(n,e,s){return Math.max(e,Math.min(s,n))}function j(n){return Math.round(n).toLocaleString("es-ES")}const P=document.querySelector("#app");if(!P)throw new Error("App root element was not found");O(P);
