// Carlos authorized this native-demo improvement for ClearChannel on 12-Oct-2026.
// All non-native assets continue to use the preserved root release.
export const CC_NATIVE_PREFIX='/__admira_cc_native';
export const CC_NATIVE_FILES=Object.freeze(['index.html','galaxy-shell.js','expert-panel.js','help/index.html','mcp/index.html','mcp/manifest.json','mcp/llms.txt','mcp/native-players.md','mcp/expert-ui.md','suite/experto.js','suite/experto.css','suite/demo-ios.mjs','suite/demo-android.mjs','suite/biz-native-context.js','version.json']);
const files=new Set(CC_NATIVE_FILES);
export function clearChannelNativePath(url,method='GET'){
 if(!['GET','HEAD'].includes(method)||! /^(www\.)?clearchannel\.tv$/i.test(url.hostname))return '';
 let file=url.pathname==='/'?'index.html':url.pathname.slice(1);
 if(/^(help|mcp)\/?$/.test(file))file=file.replace(/\/$/,'')+'/index.html';
 if(!files.has(file))return '';
 const path=file==='index.html'?'/':file.endsWith('/index.html')?'/'+file.slice(0,-10):'/'+file.replace(/\.html$/,'');
 return CC_NATIVE_PREFIX+path;
}
