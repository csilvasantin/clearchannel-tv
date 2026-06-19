(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const n of s)if(n.type==="childList")for(const o of n.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function t(s){const n={};return s.integrity&&(n.integrity=s.integrity),s.referrerPolicy&&(n.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?n.credentials="include":s.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(s){if(s.ep)return;s.ep=!0;const n=t(s);fetch(s.href,n)}})();const b={nino:"Nino",joven:"Joven",adulto:"Adulto",senior:"Senior"},w={hombre:"Hombre",mujer:"Mujer"},M={passing:"Oportunidad",watching:"Mirada",engaged:"Atencion"},A={"8bit":"8 bits","16bit":"16 bits","digital-twin":"Digital twins"},k={"8bit":"stock/list?type=twin-npc + #8bit","16bit":"stock/list?type=twin-npc + #16bit","digital-twin":"stock/list?type=digital-twin"},S=[{brand:"Pixeria",url:"www.pixeria.com",tone:"Anonymizer feed",accent:"#48d6a8"},{brand:"XpaceOS",url:"www.xpaceos.com",tone:"Screen operating layer",accent:"#45a5ff"},{brand:"ClearChannel.tv",url:"www.clearchannel.tv",tone:"DOOH proof of play",accent:"#ffbf47"}],L={nino:[7,13],joven:[14,27],adulto:[28,59],senior:[60,82]},F="https://pixer-eleven.csilvasantin.workers.dev/stock/list",I="https://admira.tv/signage.html",O=12e3,l={minX:55,maxX:86,minY:13,maxY:94};function H(a){new N(a).mount()}class N{root;people=[];stats={impressions:2486,watchers:923,attentionSeconds:4210,dwellSeconds:8630};campaignIndex=0;personId=1;tickHandle=null;feedHandle=null;isPaused=!1;speed=1;audienceMode="digital-twin";feed={"8bit":[],"16bit":[],"digital-twin":[]};lastFeedSync="sin sincronizar";feedError="";constructor(e){this.root=e}mount(){this.people=Array.from({length:11},()=>this.createPerson(!0)),this.render(),this.start(),this.syncFeed(),this.feedHandle=window.setInterval(()=>{this.syncFeed()},O)}start(){this.stop(),this.tickHandle=window.setInterval(()=>this.tick(),1450)}stop(){this.tickHandle!==null&&(window.clearInterval(this.tickHandle),this.tickHandle=null)}async syncFeed(){try{const[e,t]=await Promise.all([this.fetchAssets("twin-npc",80),this.fetchAssets("digital-twin",80)]),i={"8bit":e.filter(s=>P(s,"8bit")),"16bit":e.filter(s=>P(s,"16bit")),"digital-twin":t};this.feed=i,this.lastFeedSync=new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),this.feedError="",this.seedPeopleFromFeed(),this.render()}catch(e){this.feedError=e instanceof Error?e.message:"feed no disponible",this.render()}}async fetchAssets(e,t){const i=await fetch(`${F}?type=${encodeURIComponent(e)}&limit=${t}&ts=${Date.now()}`,{cache:"no-store"});if(!i.ok)throw new Error(`Pixeria Stock HTTP ${i.status}`);const s=await i.json();return(Array.isArray(s.items)?s.items:Array.isArray(s.assets)?s.assets:[]).filter(o=>o?.id&&o?.url).sort((o,h)=>new Date(h.createdAt??0).getTime()-new Date(o.createdAt??0).getTime())}tick(){if(this.isPaused)return;const e=this.speed===3?3:this.speed===2?2:1;for(let t=0;t<e;t+=1)this.advancePeople(),this.collectStats();Math.random()>.78&&(this.campaignIndex=(this.campaignIndex+1)%S.length),this.render()}advancePeople(){this.people=this.people.map(t=>{const i=this.nextAttentionState(t.attentionState),s=i==="engaged"?1.8:i==="watching"?.9:.1,n=$(y(t.x+d(-8,8),8,92),y(t.y+d(-5,5),10,90));return{...t,attentionState:i,dwellSeconds:t.dwellSeconds+d(.8,2.4),attentionSeconds:t.attentionSeconds+s,distanceMeters:y(t.distanceMeters+d(-.28,.22),.7,5.4),x:n.x,y:n.y}}).filter(t=>t.dwellSeconds<d(8,28));const e=8+Math.floor(Math.random()*8);for(;this.people.length<e;)this.people.push(this.createPerson(!1,this.pickFeedAsset()))}collectStats(){const e=this.people.length+Math.floor(d(0,4)),t=this.people.filter(n=>n.attentionState!=="passing").length,i=this.people.reduce((n,o)=>n+o.attentionSeconds,0),s=this.people.reduce((n,o)=>n+o.dwellSeconds,0);this.stats={impressions:this.stats.impressions+e,watchers:this.stats.watchers+t,attentionSeconds:this.stats.attentionSeconds+i/18,dwellSeconds:this.stats.dwellSeconds+s/16}}nextAttentionState(e){const t=Math.random();return e==="engaged"?t>.24?"engaged":"watching":e==="watching"?t>.55?"engaged":t>.16?"watching":"passing":t>.74?"engaged":t>.38?"watching":"passing"}createPerson(e,t){const i=Math.random()>.52?"mujer":"hombre",s=T(),[n,o]=L[s],h=this.nextAttentionState("passing"),u=B();return{id:this.personId++,gender:i,ageBand:s,age:Math.floor(d(n,o)),attentionState:h,dwellSeconds:e?d(1,12):0,attentionSeconds:e?d(0,5):0,distanceMeters:d(.8,5.2),x:u.x,y:u.y,hue:d(168,238),seed:Math.random(),sourceAsset:t,mode:this.audienceMode}}seedPeopleFromFeed(){const e=this.feed[this.audienceMode];if(!e.length)return;const t=new Set(this.people.map(s=>s.sourceAsset?.id).filter(Boolean)),i=e.filter(s=>!t.has(s.id)).slice(0,4);if(i.length){this.people=[...i.map(s=>this.createPerson(!1,s)),...this.people.map(s=>s.sourceAsset?g(s):g({...s,sourceAsset:this.pickFeedAsset(),mode:this.audienceMode}))].slice(0,16);return}this.people=this.people.map(s=>s.sourceAsset?g(s):g({...s,sourceAsset:this.pickFeedAsset(),mode:this.audienceMode}))}pickFeedAsset(){const e=this.feed[this.audienceMode];if(e.length)return e[Math.floor(Math.random()*Math.min(e.length,18))]}setSpeed(e){this.speed=e,this.render()}setAudienceMode(e){this.audienceMode=e;const t=this.feed[e];this.people=Array.from({length:Math.max(10,Math.min(t.length||10,14))},()=>this.createPerson(!0,this.pickFeedAsset())),this.render(),this.syncFeed()}togglePause(){this.isPaused=!this.isPaused,this.render()}reset(){this.stats={impressions:0,watchers:0,attentionSeconds:0,dwellSeconds:0},this.campaignIndex=0,this.people=Array.from({length:10},()=>this.createPerson(!0,this.pickFeedAsset())),this.render()}render(){const e=S[this.campaignIndex],i=this.feed[this.audienceMode].length,s=this.people.filter(r=>r.attentionState!=="passing").length,n=this.people.filter(r=>r.attentionState==="engaged").length,o=this.stats.watchers>0?this.stats.attentionSeconds/this.stats.watchers:0,h=this.stats.impressions>0?this.stats.dwellSeconds/this.stats.impressions:0,u=x(this.people,"gender"),p=x(this.people,"ageBand"),c=[...this.people].sort((r,m)=>+!!m.sourceAsset-+!!r.sourceAsset||m.attentionSeconds-r.attentionSeconds)[0]??this.createPerson(!0);this.root.querySelector(".audience-shell")||(this.root.innerHTML=`
      <main class="audience-shell">
        <section class="stage" aria-label="Contador de audiencias Admira">
          <header class="topbar">
            <div class="brand-stack">
              <span>Admira audience counter</span>
              <strong data-brand-name></strong>
              <small data-brand-url></small>
            </div>
            <nav class="trilogy" aria-label="Trilogia Admira">
              ${S.map((r,m)=>`
                  <button class="trilogy-button" type="button" data-campaign="${m}">
                    <span>${r.brand}</span>
                  </button>
                `).join("")}
            </nav>
            <div class="look-control">
              <label for="audience-mode">Look audience</label>
              <select id="audience-mode" aria-label="Look and feel de audiencia">
                ${["8bit","16bit","digital-twin"].map(r=>`<option value="${r}" ${this.audienceMode===r?"selected":""}>${A[r]}</option>`).join("")}
              </select>
            </div>
            <div class="feed-status" data-feed-status></div>
          </header>

          <section class="live-grid">
            <div class="feed-zone">
              <div class="camera-header" data-camera-header></div>
              <div class="camera-frame" aria-label="Escena anonima generada">
                <div class="screen-beam" aria-hidden="true"></div>
                ${this.renderMupi()}
                <div class="people-layer" data-people-layer></div>
              </div>
              <div class="privacy-strip" data-privacy-strip></div>
            </div>

            <aside class="metrics-panel" aria-label="Metricas en tiempo real" data-metrics-panel></aside>
          </section>

          <section class="insight-grid" data-insight-grid></section>

          <footer class="control-bar">
            <button type="button" id="pause-button"></button>
            <div class="speed-control" role="group" aria-label="Velocidad">
              ${[1,2,3].map(r=>`<button type="button" data-speed="${r}">${r}x</button>`).join("")}
            </div>
            <button type="button" id="reset-button">Reiniciar sesion</button>
          </footer>
        </section>
      </main>
    `,this.bindControls()),this.root.querySelector(".audience-shell")?.style.setProperty("--campaign-accent",e.accent),this.setText("[data-brand-name]",e.brand),this.setText("[data-brand-url]",e.url),this.root.querySelectorAll("[data-campaign]").forEach(r=>{r.classList.toggle("active",Number(r.dataset.campaign)===this.campaignIndex)});const f=this.root.querySelector("#audience-mode");f&&document.activeElement!==f&&(f.value=this.audienceMode),this.setHtml("[data-feed-status]",`
        <span>Pixeria live</span>
        <strong>${i} assets</strong>
        <small>${this.feedError?`fallback ${v(this.feedError)}`:`sync ${this.lastFeedSync}`}</small>
      `),this.setHtml("[data-camera-header]",`
        <span>Pixeria / anonimizador live</span>
        <strong>${this.people.length} perfiles · ${i} assets ${A[this.audienceMode]}</strong>
      `),this.setHtml("[data-people-layer]",this.people.map(r=>this.renderPerson(r)).join("")),this.setHtml("[data-privacy-strip]",`
        <span>${k[this.audienceMode]}</span>
        <span>sync ${this.lastFeedSync}</span>
        <span>${this.feedError?`feed fallback: ${v(this.feedError)}`:"Stock vivo Pixeria"}</span>
      `),this.setHtml("[data-metrics-panel]",`
        <div class="metric primary">
          <span>Impresiones</span>
          <strong>${C(this.stats.impressions)}</strong>
        </div>
        <div class="metric">
          <span>Watchers ahora</span>
          <strong>${s}</strong>
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
          <meter min="0" max="${Math.max(this.people.length,1)}" value="${n}"></meter>
        </div>
      `),this.setHtml("[data-insight-grid]",`
        <div class="panel segment-panel">
          <div class="panel-title">
            <span>Genero</span>
            <strong>${w[c.gender]} dominante: ${b[c.ageBand]}</strong>
          </div>
          ${this.renderBars([{label:"Hombre",value:u.hombre??0},{label:"Mujer",value:u.mujer??0}])}
        </div>

        <div class="panel segment-panel">
          <div class="panel-title">
            <span>Edad</span>
            <strong>Bandas Quividi-like</strong>
          </div>
          ${this.renderBars([{label:"Nino",value:p.nino??0},{label:"Joven",value:p.joven??0},{label:"Adulto",value:p.adulto??0},{label:"Senior",value:p.senior??0}])}
        </div>

        <div class="panel profile-panel">
          <div class="panel-title">
            <span>Perfil activo</span>
            <strong>${w[c.gender]} · ${c.age} · ${M[c.attentionState]}</strong>
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
      `),this.setText("#pause-button",this.isPaused?"Reanudar":"Pausar"),this.root.querySelectorAll("[data-speed]").forEach(r=>{r.classList.toggle("active",Number(r.dataset.speed)===this.speed)})}bindControls(){this.root.querySelector("#pause-button")?.addEventListener("click",()=>this.togglePause()),this.root.querySelector("#reset-button")?.addEventListener("click",()=>this.reset()),this.root.querySelectorAll("[data-speed]").forEach(e=>{e.addEventListener("click",()=>this.setSpeed(Number(e.dataset.speed)))}),this.root.querySelector("#audience-mode")?.addEventListener("change",e=>{this.setAudienceMode(e.target.value)}),this.root.querySelectorAll("[data-campaign]").forEach(e=>{e.addEventListener("click",()=>{this.campaignIndex=Number(e.dataset.campaign),this.render()})})}setText(e,t){const i=this.root.querySelector(e);i&&i.textContent!==t&&(i.textContent=t)}setHtml(e,t){const i=this.root.querySelector(e);i&&(i.innerHTML=t)}renderPerson(e){const t=e.sourceAsset?72+(5.5-e.distanceMeters)*12:54+(5.5-e.distanceMeters)*8;return`
      <div
        class="person-dot ${e.attentionState} ${e.sourceAsset?"from-pixeria":"from-synthetic"} mode-${e.mode}"
        style="left:${e.x}%; top:${e.y}%; width:${t}px; --person-hue:${e.hue}; --person-seed:${e.seed};"
        aria-label="${w[e.gender]}, ${b[e.ageBand]}, ${M[e.attentionState]}, ${e.sourceAsset?"Pixeria Stock":"sintetico"}"
      >
        ${this.renderAvatar(e,"small")}
        <span>${b[e.ageBand]}</span>
      </div>
    `}renderMupi(){return`
      <div class="mupi-unit" aria-label="MUPI central emitiendo Admira TV">
        <div class="mupi-cabinet">
          <div class="mupi-screen">
            <iframe
              src="${I}"
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
    `}renderAvatar(e,t){if(e.sourceAsset)return`
        <span class="asset-avatar ${t} mode-${e.mode}">
          <img src="${v(e.sourceAsset.url)}" alt="${v(e.sourceAsset.title??A[e.mode])}" loading="eager">
        </span>
      `;const i=e.gender==="mujer"?"avatar-hair-long":"avatar-hair-short",s=`age-${e.ageBand}`;return`
      <span class="avatar ${t} ${i} ${s}" style="--person-hue:${e.hue}">
        <i class="face"></i>
      </span>
    `}renderBars(e){const t=Math.max(...e.map(i=>i.value),1);return`
      <div class="bar-list">
        ${e.map(i=>`
              <div class="bar-row">
                <span>${i.label}</span>
                <div class="bar-track"><i style="width:${i.value/t*100}%"></i></div>
                <strong>${i.value}</strong>
              </div>
            `).join("")}
      </div>
    `}}function T(){const a=Math.random();return a<.13?"nino":a<.39?"joven":a<.8?"adulto":"senior"}function x(a,e){return a.reduce((t,i)=>{const s=String(i[e]);return t[s]=(t[s]??0)+1,t},{})}function P(a,e){return(a.tags??[]).some(t=>t.toLowerCase()===e.toLowerCase())}function B(){const a=Math.random()>.72?d(87,93):d(7,52),e=d(9,91);return $(a,e)}function g(a){const e=$(a.x,a.y);return{...a,x:e.x,y:e.y}}function $(a,e){const t=a>=l.minX&&a<=l.maxX,i=e>=l.minY&&e<=l.maxY;if(!t||!i)return{x:a,y:e};const s=Math.abs(a-l.minX),n=Math.abs(l.maxX-a);return s<=n||Math.random()>.18?{x:d(8,l.minX-4),y:e}:{x:d(l.maxX+2,93),y:e}}function v(a){return a.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[e]??e)}function d(a,e){return a+Math.random()*(e-a)}function y(a,e,t){return Math.max(e,Math.min(t,a))}function C(a){return Math.round(a).toLocaleString("es-ES")}const E=document.querySelector("#app");if(!E)throw new Error("App root element was not found");H(E);
