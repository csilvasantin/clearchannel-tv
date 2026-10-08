const normalize=value=>String(value).toLowerCase().trim().replace(/^#/,'');
export function taggedFormat(tags=[]){
 const values=new Set(Array.isArray(tags)?tags.map(normalize):[]);
 const has=list=>list.some(t=>values.has(t));
 const formats=[has(['horizontal','landscape','16:9','16x9'])&&'horizontal',has(['vertical','portrait','9:16','9x16'])&&'vertical',has(['square','cuadrado','1:1','1x1'])&&'square'].filter(Boolean);
 return formats.length===1?formats[0]:formats.length?'conflict':'unknown';
}
export function measuredFormat(width,height){return width>0&&height>0?(width===height?'square':width>height?'horizontal':'vertical'):'unknown';}
export function compatibleTrack(track,format){return taggedFormat(track.tags)===format;}
