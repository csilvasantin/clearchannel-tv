// Grammar and physical bindings are shared by the browser and server.
import {normalize} from './bugito-xpacios-core.mjs';
export const PHYSICAL_TARGETS=Object.freeze([
 {project:'starbucks',location:'lab-gran-de-gracia-51',locationName:'Gran de Gràcia 51 · laboratorio AdmiraNeXT',
  aliases:['gran de gracia 51','gran de gràcia 51','lab-gran-de-gracia-51'],screen:'macbookpro16',name:'MBP16 · pantalla integrada',ci:'GDG51-PAN-07',demo:true}
]);
export const FAULTS=Object.freeze({rotate:'fault-rotate',popup:'fault-popup',black:'standby',canvas:'fault-canvas',half:'fault-half',clear:'fault-clear'});
export function isPhysicalOrder(value){return /^(?:\/bugito\s+)?(?:error|fallo|fault|restaurar|restore)\s+/i.test(String(value||'').trim());}
export function parsePhysicalOrder(value){
 const raw=normalize(value).replace(/^\/bugito\s+/,'');
 if(raw.length>1200)return null;
 const m=/^(error|fallo|fault|restaurar|restore)\s+(.+)$/.exec(raw);if(!m)return null;
 if(/restaurar|restore/.test(m[1]))return {target:m[2],fault:'clear'};
 const kinds=[['rotate',/(?:pantalla\s+girada|girad[oa]|giro|rotated screen|rotate[ds]?)$/],['popup',/(?:pop[ -]?up|ventana emergente|popup en medio)$/],['black',/(?:pantalla en negro|pantalla negra|black screen|negro)$/],['canvas',/(?:resolucion|lienzo|canvas|resolution)$/],['half',/(?:media pantalla|pantalla a medias|half screen|recorte)$/]];
 for(const [fault,re] of kinds){const f=re.exec(m[2]);if(f&&f.index>0)return {target:m[2].slice(0,f.index).trim(),fault};}
 return null;
}
export function resolvePhysicalOrder(value,targets=PHYSICAL_TARGETS){
 const parsed=parsePhysicalOrder(value);if(!parsed)return {error:'order_format'};
 const hits=targets.filter(t=>t.aliases.some(a=>[`${t.project} ${a}`,`${t.project} ${a} ${t.screen}`,`${t.project} ${a} mbp16`,`${t.project} ${a} pantalla ${t.ci}`].some(v=>normalize(v)===parsed.target)));
 return hits.length===1?{...parsed,target:hits[0]}:{error:hits.length?'target_ambiguous':'physical_target_not_configured'};
}
export function observedFault(fault,signal,after,now=Date.now()){
 const at=Number(signal?.lastSeen),d=signal?.device?.display;
 if(!d||!at||at<=after||at>now+10000||now-at>30000)return false;
 if(fault==='rotate')return Math.abs(Number(d.paintedRotation))%180===90;
 if(fault==='popup')return Number(d.overlay)>0;
 if(fault==='black')return signal.standby===true;
 if(fault==='canvas'){const w=Number(d.canvas?.w),h=Number(d.canvas?.h),vw=Number(d.width),vh=Number(d.height);return w>0&&h>0&&vw>0&&vh>0&&((w/h>1)!==(vw/vh>1));}
 if(fault==='half')return Number(d.visible)>0&&Number(d.visible)<=55;
 return fault==='clear'&&Number(d.paintedRotation)===0&&Number(d.overlay)===0&&Number(d.visible)===100&&signal.standby!==true;
}
