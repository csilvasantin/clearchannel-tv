// Los 18 espacios Altadis (DCL-d7966deb02734a6f34beb54e): escribe los 36 planos compartidos y su índice, todo sale
// de espacios-formato.mjs (sin red y sin azar: regenerar da los mismos ficheros).
//   data/xpacios/altadis-xtanco-01.json … -18.json   el formato en un Xtanco (tipo estanco del Arquitecto)
//   data/xpacios/altadis-cafe-01.json   … -18.json   el formato en una cafetería Starbucks (tipo cafeteria)
//   data/xpacios/altadis-18.json                     el índice (admira.espacios-formato/1) que leen el gemelo y Studio
// Se sirven en www.admira.biz/data/xpacios/<id>.json con CORS de lectura (_worker.js) porque están en BIZ_ASSET_FILES.
// Regenerar: node tools/genera-espacios-altadis.mjs · Comprobar sin escribir: node tools/genera-espacios-altadis.mjs --comprobar
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ficherosAltadis } from '../espacios-formato.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const comprobar = process.argv.includes('--comprobar');
let distintos = 0;
for (const { ruta, texto } of ficherosAltadis()) {
  const igual = existsSync(root + ruta) && readFileSync(root + ruta, 'utf8') === texto;
  if (igual) continue;
  distintos++;
  if (comprobar) console.error(`✗ ${ruta} no coincide con espacios-formato.mjs`);
  else { writeFileSync(root + ruta, texto); console.log(`· ${ruta}`); }
}
if (comprobar && distintos) process.exit(1);
console.log(comprobar ? '✓ los 37 ficheros de los espacios Altadis están al día' : `✓ ${distintos} ficheros escritos (de 37)`);
