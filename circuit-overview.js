/* One north-up overview for all catalogue filters and tours. No second render loop. */
window.CircuitOverview={create({map,getData,style}){
 const host=document.createElement('div');host.className='cenital-floating';host.style.cssText='position:fixed;bottom:85px;right:80px;z-index:13';document.body.append(host);host.addEventListener('click',event=>event.stopPropagation());
 const canvas=document.createElement('div');canvas.setAttribute('aria-label','Plano cenital del circuito');
 let mini=null,panel=null,frame=null,loaded=false;
 function refresh(){if(!mini||!loaded||!panel?.visible)return;mini.getSource('circuit-points')?.setData(getData());mini.jumpTo({center:map.getCenter(),zoom:Math.max(1,map.getZoom()-2),bearing:0,pitch:0});}
 function show(){if(!mini){mini=new maplibregl.Map({container:canvas,style,center:map.getCenter(),zoom:Math.max(1,map.getZoom()-2),bearing:0,pitch:0,interactive:false,attributionControl:true,renderWorldCopies:false,maxTileCacheSize:64});mini.once('load',()=>{mini.addSource('circuit-points',{type:'geojson',data:getData()});mini.addLayer({id:'circuit-points',type:'circle',source:'circuit-points',paint:{'circle-radius':4,'circle-color':['coalesce',['get','color'],'#327b48'],'circle-stroke-color':'#fff','circle-stroke-width':1}});loaded=true;refresh();});}else{mini.resize();refresh();}}
 panel=CenitalPanel.create({host,content:canvas,key:'catalogue',onShow:()=>requestAnimationFrame(show),onHide:()=>{if(frame)clearTimeout(frame);frame=null;}});
 map.on('move',()=>{if(!panel.visible||frame)return;frame=setTimeout(()=>{frame=null;refresh();},200);});
 map.on('moveend',refresh);map.on('remove',()=>{if(frame)clearTimeout(frame);mini?.remove();});
 return {refresh};
}};
