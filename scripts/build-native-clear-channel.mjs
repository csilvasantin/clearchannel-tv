import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {CC_NATIVE_PREFIX,CC_NATIVE_FILES} from '../server/native-clear-channel.mjs';
// Read baseline files from the already-preserved archive, never from Biz's
// newer app/index. Only native loading and documentation are changed.
export function buildNativeClearChannel({root,out,config,revision,agent,machine}){
 if(!config.nativeClearChannel?.enabled)return;
 const target=join(out,CC_NATIVE_PREFIX.slice(1));
 const version=config.nativeClearChannel.version;
 const stamp=text=>text.replaceAll('__ADMIRANEXT_VERSION__',version);
 const put=(file,text)=>{mkdirSync(dirname(join(target,file)),{recursive:true});writeFileSync(join(target,file),stamp(text));};
 const freshLoaders=text=>text.replace(/(galaxy-shell|expert-panel)\.js(?:\?v=[A-Za-z0-9._%:+-]+)?/g,'$1.js?v=20261012-android-five-1');
 const localEngine=text=>freshLoaders(text.replace(/(?:https:\/\/www\.admiranext\.com)?\/suite\/experto\.(js|css)(?:\?v=[A-Za-z0-9._%:+-]+)?/g,'https://www.admiranext.com/suite/experto.$1?v=20261014-suite-validation-1'));
 const helpSource=readFileSync(join(root,'help/index.html'),'utf8');
 const section=helpSource.match(/<section id="native-players"[\s\S]*?<\/section>/)?.[0];
 if(!section)throw Error('Native Help section missing');
 for(const file of ['index.html','galaxy-shell.js','expert-panel.js']){
  let text=localEngine(readFileSync(join(out,file),'utf8'));
  if(file==='index.html')text=text.replace('</head>','<script defer src="/suite/biz-native-context.js?v=20261012-android-five-1"></script>\n</head>');
  text=text.replaceAll('20261007-native-demo-control-1','20261012-android-five-1');
  put(file,text);
 }
 for(const file of ['help/index.html','mcp/index.html']){
  const before=freshLoaders(readFileSync(join(out,file),'utf8')); 
  if(before.includes('id="native-players"'))throw Error('Baseline already has native section; review required');
  put(file,before.replace('</body>',section+"<section id=\"expert-minimum\"><h2>Experto mínimo y Bugito / Minimum Expert and Bugito</h2><p lang=\"es\">Experto abre como una línea de escritura de 52 px. Arrastra el tirador superior para ampliar o reducir; las flechas ajustan la altura, Inicio vuelve al mínimo y doble clic alterna mínimo/ampliado. Al cerrar y reabrir vuelve al mínimo. /bugito muestra u oculta la mascota flotante en la misma página; /bugito full o /bugito avanzado abre el banco de pruebas. /admirito restaura la nube. No cambia el nivel de avatar elegido ni ejecuta incidencias al mostrarlo.</p><p lang=\"en\">Expert opens as a writable 52 px line. Drag the top handle to resize, use arrow keys for height, Home for minimum or double-click to toggle minimum/expanded. Reopening starts at minimum. /bugito toggles the floating mascot on the same page; /bugito full or /bugito avanzado opens the test bench. /admirito restores the cloud. Showing it does not change the chosen avatar level or trigger incidents.</p><p>Motor / Engine: <a href=\"https://www.admiranext.com/suite/experto.js\">suite/experto.js</a>. Interfaz local, sin nuevas herramientas MCP / Local UI, no new MCP tools.</p></section>"+'\n</body>'));
 }
 put('mcp/expert-ui.md',readFileSync(join(root,'mcp/expert-ui.md'),'utf8'));
 const guide=readFileSync(join(root,'mcp/native-players.md'),'utf8');put('mcp/native-players.md',guide);
 const manifest=JSON.parse(readFileSync(join(out,'mcp/manifest.json'),'utf8'));
 const native=JSON.parse(readFileSync(join(root,'tools/biz-player-mcp/assets/manifest.json'),'utf8')).native_players;
 manifest.native_players={...native,doc:'https://www.clearchannel.tv/mcp/native-players.md',help:'https://www.clearchannel.tv/help/#native-players'};
 manifest.version=version;put('mcp/manifest.json',JSON.stringify(manifest,null,2)+'\n');
 put('mcp/llms.txt',readFileSync(join(out,'mcp/llms.txt'),'utf8')+'\n\n'+guide);
 for(const file of CC_NATIVE_FILES.filter(f=>f.startsWith('suite/'))){mkdirSync(dirname(join(target,file)),{recursive:true});copyFileSync(join(root,file),join(target,file));}
 const metadata={version,agent,deployer:agent,machine,signature:agent+' · '+machine,gitShort:revision.slice(0,7),gitFull:revision,dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),deployedAt:new Date().toISOString(),domains:['clearchannel.tv','www.clearchannel.tv'],preservedRevision:config.preservedRevision,novedades:['Experto mínimo de 52 px, tirador compartido y /bugito flotante; full o avanzado abre el laboratorio.','Experto: /demo android, /demo android Fold8 y /demo android watch con playlist del proyecto.','Help y MCP actualizados con guía ES/EN, tutorial y evidencias.','Fold8 perfil compatible; Wear OS visor silencioso. Requiere puente Mac y emuladores.']};
 put('version.json',JSON.stringify(metadata,null,2)+'\n');
 const headers=join(out,'_headers');writeFileSync(headers,readFileSync(headers,'utf8')+'\n'+CC_NATIVE_PREFIX+'/version.json\n  Cache-Control: no-store\n');
}
