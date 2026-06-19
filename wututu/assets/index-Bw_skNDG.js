(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const r of a.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&n(r)}).observe(document,{childList:!0,subtree:!0});function t(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function n(s){if(s.ep)return;s.ep=!0;const a=t(s);fetch(s.href,a)}})();const u={nino:"Nino",joven:"Joven",adulto:"Adulto",senior:"Senior"},g={hombre:"Hombre",mujer:"Mujer"},$={passing:"Oportunidad",watching:"Mirada",engaged:"Atencion"},m={"8bit":"8 bits","16bit":"16 bits","digital-twin":"Digital twins"},M={"8bit":"NPC 8-bit del anonimizador","16bit":"NPC 16-bit del anonimizador","digital-twin":"Persona anonima realista"},P={"8bit":"stock/list?type=twin-npc + #8bit","16bit":"stock/list?type=twin-npc + #16bit","digital-twin":"stock/list?type=digital-twin"},v=[{brand:"Pixeria",url:"www.pixeria.com",tone:"Anonymizer feed",accent:"#48d6a8"},{brand:"XpaceOS",url:"www.xpaceos.com",tone:"Screen operating layer",accent:"#45a5ff"},{brand:"ClearChannel.tv",url:"www.clearchannel.tv",tone:"DOOH proof of play",accent:"#ffbf47"}],x={nino:[7,13],joven:[14,27],adulto:[28,59],senior:[60,82]},E="https://pixer-eleven.csilvasantin.workers.dev/stock/list",F=12e3;function L(o){new k(o).mount()}class k{root;people=[];stats={impressions:2486,watchers:923,attentionSeconds:4210,dwellSeconds:8630};campaignIndex=0;personId=1;tickHandle=null;feedHandle=null;isPaused=!1;speed=1;audienceMode="digital-twin";feed={"8bit":[],"16bit":[],"digital-twin":[]};lastFeedSync="sin sincronizar";feedError="";constructor(e){this.root=e}mount(){this.people=Array.from({length:11},()=>this.createPerson(!0)),this.render(),this.start(),this.syncFeed(),this.feedHandle=window.setInterval(()=>{this.syncFeed()},F)}start(){this.stop(),this.tickHandle=window.setInterval(()=>this.tick(),1450)}stop(){this.tickHandle!==null&&(window.clearInterval(this.tickHandle),this.tickHandle=null)}async syncFeed(){try{const[e,t]=await Promise.all([this.fetchAssets("twin-npc",80),this.fetchAssets("digital-twin",80)]),n={"8bit":e.filter(s=>A(s,"8bit")),"16bit":e.filter(s=>A(s,"16bit")),"digital-twin":t};this.feed=n,this.lastFeedSync=new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),this.feedError="",this.seedPeopleFromFeed(),this.render()}catch(e){this.feedError=e instanceof Error?e.message:"feed no disponible",this.render()}}async fetchAssets(e,t){const n=await fetch(`${E}?type=${encodeURIComponent(e)}&limit=${t}&ts=${Date.now()}`,{cache:"no-store"});if(!n.ok)throw new Error(`Pixeria Stock HTTP ${n.status}`);const s=await n.json();return(Array.isArray(s.items)?s.items:Array.isArray(s.assets)?s.assets:[]).filter(r=>r?.id&&r?.url).sort((r,l)=>new Date(l.createdAt??0).getTime()-new Date(r.createdAt??0).getTime())}tick(){if(this.isPaused)return;const e=this.speed===3?3:this.speed===2?2:1;for(let t=0;t<e;t+=1)this.advancePeople(),this.collectStats();Math.random()>.78&&(this.campaignIndex=(this.campaignIndex+1)%v.length),this.render()}advancePeople(){this.people=this.people.map(t=>{const n=this.nextAttentionState(t.attentionState),s=n==="engaged"?1.8:n==="watching"?.9:.1;return{...t,attentionState:n,dwellSeconds:t.dwellSeconds+d(.8,2.4),attentionSeconds:t.attentionSeconds+s,distanceMeters:w(t.distanceMeters+d(-.28,.22),.7,5.4),x:w(t.x+d(-8,8),8,92),y:w(t.y+d(-5,5),10,90)}}).filter(t=>t.dwellSeconds<d(8,28));const e=8+Math.floor(Math.random()*8);for(;this.people.length<e;)this.people.push(this.createPerson(!1,this.pickFeedAsset()))}collectStats(){const e=this.people.length+Math.floor(d(0,4)),t=this.people.filter(a=>a.attentionState!=="passing").length,n=this.people.reduce((a,r)=>a+r.attentionSeconds,0),s=this.people.reduce((a,r)=>a+r.dwellSeconds,0);this.stats={impressions:this.stats.impressions+e,watchers:this.stats.watchers+t,attentionSeconds:this.stats.attentionSeconds+n/18,dwellSeconds:this.stats.dwellSeconds+s/16}}nextAttentionState(e){const t=Math.random();return e==="engaged"?t>.24?"engaged":"watching":e==="watching"?t>.55?"engaged":t>.16?"watching":"passing":t>.74?"engaged":t>.38?"watching":"passing"}createPerson(e,t){const n=Math.random()>.52?"mujer":"hombre",s=I(),[a,r]=x[s],l=this.nextAttentionState("passing");return{id:this.personId++,gender:n,ageBand:s,age:Math.floor(d(a,r)),attentionState:l,dwellSeconds:e?d(1,12):0,attentionSeconds:e?d(0,5):0,distanceMeters:d(.8,5.2),x:d(7,93),y:d(9,91),hue:d(168,238),seed:Math.random(),sourceAsset:t,mode:this.audienceMode}}seedPeopleFromFeed(){const e=this.feed[this.audienceMode];if(!e.length)return;const t=new Set(this.people.map(s=>s.sourceAsset?.id).filter(Boolean)),n=e.filter(s=>!t.has(s.id)).slice(0,4);if(n.length){this.people=[...n.map(s=>this.createPerson(!1,s)),...this.people].slice(0,16);return}this.people=this.people.map(s=>s.sourceAsset||Math.random()>.42?s:{...s,sourceAsset:this.pickFeedAsset(),mode:this.audienceMode})}pickFeedAsset(){const e=this.feed[this.audienceMode];if(e.length)return e[Math.floor(Math.random()*Math.min(e.length,18))]}setSpeed(e){this.speed=e,this.render()}setAudienceMode(e){this.audienceMode=e;const t=this.feed[e];this.people=Array.from({length:Math.max(10,Math.min(t.length||10,14))},()=>this.createPerson(!0,this.pickFeedAsset())),this.render(),this.syncFeed()}togglePause(){this.isPaused=!this.isPaused,this.render()}reset(){this.stats={impressions:0,watchers:0,attentionSeconds:0,dwellSeconds:0},this.campaignIndex=0,this.people=Array.from({length:10},()=>this.createPerson(!0,this.pickFeedAsset())),this.render()}render(){const e=v[this.campaignIndex],n=this.feed[this.audienceMode].length,s=this.people.filter(i=>i.attentionState!=="passing").length,a=this.people.filter(i=>i.attentionState==="engaged").length,r=this.stats.watchers>0?this.stats.attentionSeconds/this.stats.watchers:0,l=this.stats.impressions>0?this.stats.dwellSeconds/this.stats.impressions:0,b=S(this.people,"gender"),h=S(this.people,"ageBand"),c=[...this.people].sort((i,p)=>p.attentionSeconds-i.attentionSeconds)[0]??this.createPerson(!0);this.root.innerHTML=`
      <main class="audience-shell" style="--campaign-accent:${e.accent}">
        <section class="stage" aria-label="Contador de audiencias Admira">
          <header class="topbar">
            <div class="brand-stack">
              <span>Admira audience counter</span>
              <strong>${e.brand}</strong>
              <small>${e.url}</small>
            </div>
            <nav class="trilogy" aria-label="Trilogia Admira">
              ${v.map((i,p)=>`
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
                <span>Pixeria / anonimizador live</span>
                <strong>${this.people.length} perfiles · ${n} assets ${m[this.audienceMode]}</strong>
              </div>
              <div class="mode-selector" role="group" aria-label="Formato de audiencia">
                ${["8bit","16bit","digital-twin"].map(i=>`
                      <button class="${this.audienceMode===i?"active":""}" type="button" data-mode="${i}">
                        <span>${m[i]}</span>
                        <small>${M[i]}</small>
                      </button>
                    `).join("")}
              </div>
              <div class="camera-frame" aria-label="Escena anonima generada">
                <div class="screen-beam" aria-hidden="true"></div>
                ${this.people.map(i=>this.renderPerson(i)).join("")}
              </div>
              <div class="privacy-strip">
                <span>${P[this.audienceMode]}</span>
                <span>sync ${this.lastFeedSync}</span>
                <span>${this.feedError?`feed fallback: ${f(this.feedError)}`:"Stock vivo Pixeria"}</span>
              </div>
            </div>

            <aside class="metrics-panel" aria-label="Metricas en tiempo real">
              <div class="metric primary">
                <span>Impresiones</span>
                <strong>${B(this.stats.impressions)}</strong>
              </div>
              <div class="metric">
                <span>Watchers ahora</span>
                <strong>${s}</strong>
              </div>
              <div class="metric">
                <span>Atencion media</span>
                <strong>${r.toFixed(1)}s</strong>
              </div>
              <div class="metric">
                <span>Dwell medio</span>
                <strong>${l.toFixed(1)}s</strong>
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
                <strong>${g[c.gender]} dominante: ${u[c.ageBand]}</strong>
              </div>
              ${this.renderBars([{label:"Hombre",value:b.hombre??0},{label:"Mujer",value:b.mujer??0}])}
            </div>

            <div class="panel segment-panel">
              <div class="panel-title">
                <span>Edad</span>
                <strong>Bandas Quividi-like</strong>
              </div>
              ${this.renderBars([{label:"Nino",value:h.nino??0},{label:"Joven",value:h.joven??0},{label:"Adulto",value:h.adulto??0},{label:"Senior",value:h.senior??0}])}
            </div>

            <div class="panel profile-panel">
              <div class="panel-title">
                <span>Perfil activo</span>
                <strong>${g[c.gender]} · ${c.age} · ${$[c.attentionState]}</strong>
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
              ${[1,2,3].map(i=>`<button type="button" class="${this.speed===i?"active":""}" data-speed="${i}">${i}x</button>`).join("")}
            </div>
            <button type="button" id="reset-button">Reiniciar sesion</button>
          </footer>
        </section>
      </main>
    `,this.root.querySelector("#pause-button")?.addEventListener("click",()=>this.togglePause(),{once:!0}),this.root.querySelector("#reset-button")?.addEventListener("click",()=>this.reset(),{once:!0}),this.root.querySelectorAll("[data-speed]").forEach(i=>{i.addEventListener("click",()=>this.setSpeed(Number(i.dataset.speed)),{once:!0})}),this.root.querySelectorAll("[data-mode]").forEach(i=>{i.addEventListener("click",()=>this.setAudienceMode(i.dataset.mode),{once:!0})}),this.root.querySelectorAll("[data-campaign]").forEach(i=>{i.addEventListener("click",()=>{this.campaignIndex=Number(i.dataset.campaign),this.render()},{once:!0})})}renderPerson(e){const t=e.sourceAsset?72+(5.5-e.distanceMeters)*12:54+(5.5-e.distanceMeters)*8;return`
      <div
        class="person-dot ${e.attentionState} ${e.sourceAsset?"from-pixeria":"from-synthetic"} mode-${e.mode}"
        style="left:${e.x}%; top:${e.y}%; width:${t}px; --person-hue:${e.hue}; --person-seed:${e.seed};"
        aria-label="${g[e.gender]}, ${u[e.ageBand]}, ${$[e.attentionState]}, ${e.sourceAsset?"Pixeria Stock":"sintetico"}"
      >
        ${this.renderAvatar(e,"small")}
        <span>${u[e.ageBand]}</span>
      </div>
    `}renderAvatar(e,t){if(e.sourceAsset)return`
        <span class="asset-avatar ${t} mode-${e.mode}">
          <img src="${f(e.sourceAsset.url)}" alt="${f(e.sourceAsset.title??m[e.mode])}" loading="eager">
        </span>
      `;const n=e.gender==="mujer"?"avatar-hair-long":"avatar-hair-short",s=`age-${e.ageBand}`;return`
      <span class="avatar ${t} ${n} ${s}" style="--person-hue:${e.hue}">
        <i class="face"></i>
      </span>
    `}renderBars(e){const t=Math.max(...e.map(n=>n.value),1);return`
      <div class="bar-list">
        ${e.map(n=>`
              <div class="bar-row">
                <span>${n.label}</span>
                <div class="bar-track"><i style="width:${n.value/t*100}%"></i></div>
                <strong>${n.value}</strong>
              </div>
            `).join("")}
      </div>
    `}}function I(){const o=Math.random();return o<.13?"nino":o<.39?"joven":o<.8?"adulto":"senior"}function S(o,e){return o.reduce((t,n)=>{const s=String(n[e]);return t[s]=(t[s]??0)+1,t},{})}function A(o,e){return(o.tags??[]).some(t=>t.toLowerCase()===e.toLowerCase())}function f(o){return o.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[e]??e)}function d(o,e){return o+Math.random()*(e-o)}function w(o,e,t){return Math.max(e,Math.min(t,o))}function B(o){return Math.round(o).toLocaleString("es-ES")}const y=document.querySelector("#app");if(!y)throw new Error("App root element was not found");L(y);
