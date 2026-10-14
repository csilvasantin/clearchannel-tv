#!/usr/bin/env node
// Agente detector del ▤ Creador de incidencias (DCL-34d5bbccb9cc227bb752a419). Vigila las pantallas
// de un plano: compara la orientación que el plano ESPERA con la que el player DECLARA que pinta
// (/signage/now · display.painted, medida del DOM) y, si no casan durante --gracia segundos, abre
// UNA incidencia en Yokup sobre el CI; cuando vuelven a casar otros --gracia segundos, la cierra.
// Es el mismo detector que corre en la pestaña del plano (incidencias-core.mjs), pero siempre
// encendido. Una incidencia por fallo: Yokup admite una activa por recurso y el estado se guarda.
//
// Carriles de Yokup (incidencias-adaptadores.mjs):
//   · pantallas de laboratorio (players virtual-lab-*, p. ej. virtual-lab-bugito) → POST
//     api.yokup.com/incident con recurso `demo:<xpacio>:<CI>:<tipo>` (público: abre, lee estado y
//     cierra sin credenciales);
//   · el resto (sólo con --todas) → MCP de flota yokup.com/mcp con una credencial que tenga
//     `incidents:write` (--credencial <fichero>).
//
// Uso:
//   node tools/agente-incidencias.mjs                     → laboratorio de Gran de Gràcia 51, cada 10 s
//   node tools/agente-incidencias.mjs --una --seco        → una pasada, sin escribir en Yokup
//   node tools/agente-incidencias.mjs --plano data/xpacios/<id>.json [--gracia 30] [--intervalo 10]
//        [--estado <fichero.json>] [--credencial <fichero de tools/mcp-credential.mjs>] [--todas] [--by "…"]
//
// --todas IMPLICA --seco: vigila también las pantallas que no son de laboratorio (CIs de clientes),
// pero NO abre ni cierra incidencias reales `itil:` en Yokup; sólo dice lo que haría. Seguirá así
// hasta validar el detector con hardware real.
// Nunca imprime la credencial: sólo si el carril MCP está disponible o no.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATALOGO, GRACIA_MS, pantallasDelPlano, lecturaSenal, anotar, recurso, vueltaDetector } from '../incidencias-core.mjs?v=20261014-bugito-1';
import { mando, yokupPublico, yokupMcp, carril } from '../incidencias-adaptadores.mjs?v=20261014-bugito-1';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLANO_POR_DEFECTO = path.join(RAIZ, 'data/xpacios/lab-gran-de-gracia-51.json');

// Una pasada por todas las pantallas vigiladas. Devuelve los estados nuevos y lo que ha hecho.
export async function pasada({ plan, estados = {}, fetcher = fetch, ahora = Date.now(), graciaMs = GRACIA_MS, credencial = null,
  seco = false, todas = false, by = 'Agente detector', planoUrl = '' }) {
  if (todas) seco = true;   // --todas implica --seco: nada de incidencias reales sobre CIs de clientes
  const red = mando(fetcher), publico = yokupPublico(fetcher), mcp = yokupMcp({ fetcher, credencial });
  const hechos = [], nuevos = { ...estados };
  for (const p of pantallasDelPlano(plan)) {
    if (!p.screen || !p.esperada || (!p.lab && !todas)) continue;
    let senal = null;
    try { senal = await red.senal(p.screen); } catch { senal = null; }
    const lectura = lecturaSenal(senal, { ahora });
    // Todos los tipos del catálogo: formato girado y, desde Bugito, cambio de resolución, popup y medio abrir.
    for (const t of CATALOGO) {
      const clave = `${p.screen}:${t.id}`, previo = nuevos[clave];
      const v = vueltaDetector(previo, { plan, pantalla: p, tipo: t.id, senal, ahora, graciaMs, by, planoUrl });
      let e = v.estado;
      if (previo && previo.fase !== e.fase) hechos.push({ clave, fase: e.fase, de: previo.fase, esperada: v.observacion.esperada, pintada: v.observacion.pintada || null });
      if (e.accion) {
        const accion = e.accion, res = recurso(plan, p, t.id), via = carril(res, { publico, mcp });
        const body = v.body;
        // Una pantalla que no es de laboratorio (CI de cliente) va SIEMPRE en seco, sea cual sea el tipo y
        // aunque haya credencial: ni formato girado ni popup ni medio abrir abren incidencias ITIL reales.
        const enSeco = seco || !p.lab;
        if (enSeco || !via || !body) {
          e = { ...e, error: enSeco ? 'seco' : 'sin_carril' };
          hechos.push({ clave, accion, recurso: res, omitida: enSeco ? 'seco' : 'sin_carril' });
        } else {
          let r;
          try { r = accion === 'abrir' ? await via.abrir(body) : await via.cerrar(body); } catch (err) { r = { ok: false, error: String(err && err.message || err) }; }
          e = anotar(e, accion, r);
          hechos.push({ clave, accion, recurso: res, ok: !!r.ok, id: r.id || null, error: r.ok ? null : r.error });
        }
      }
      nuevos[clave] = { ...e, accion: null, senal: lectura.estado === 'ok' ? 'ok' : (lectura.motivo || lectura.estado) };
    }
  }
  return { estados: nuevos, hechos };
}

function args(argv) {
  const a = { plano: PLANO_POR_DEFECTO, intervalo: 10, gracia: GRACIA_MS / 1000, una: false, seco: false, todas: false, credencial: '', estado: '', by: '' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--plano') a.plano = v();
    else if (k === '--intervalo') a.intervalo = Math.max(3, Number(v()) || 10);
    else if (k === '--gracia') a.gracia = Math.max(5, Number(v()) || 30);
    else if (k === '--una') a.una = true;
    else if (k === '--seco') a.seco = true;
    else if (k === '--todas') { a.todas = true; a.seco = true; }
    else if (k === '--credencial') a.credencial = v();
    else if (k === '--estado') a.estado = v();
    else if (k === '--by') a.by = v();
    else if (k === '-h' || k === '--help') a.ayuda = true;
  }
  return a;
}
const hora = () => new Date().toLocaleTimeString('es-ES', { hour12: false });
const leer = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

async function main() {
  const a = args(process.argv.slice(2));
  if (a.ayuda) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport ')[0].replace(/^#!.*\n/, '')); return; }
  const plan = leer(path.resolve(a.plano));
  if (!plan || !Array.isArray(plan.pantallas)) { console.error(`✖ plano ilegible: ${a.plano}`); process.exitCode = 2; return; }
  const ficheroEstado = a.estado || path.join(os.homedir(), '.config', 'admiranext', `incidencias-${plan.id}.json`);
  let estados = leer(ficheroEstado) || {};
  const credencial = a.credencial ? leer(path.resolve(a.credencial.replace(/^~(?=\/)/, os.homedir()))) : null;
  const mcp = yokupMcp({ credencial });
  const by = a.by || `Agente detector · ${os.hostname().replace(/\.local$/, '')}`;
  const planoUrl = `https://www.admira.biz/plano.html?locationId=${encodeURIComponent(plan.id)}`;
  const vigiladas = pantallasDelPlano(plan).filter(p => p.screen && p.esperada && (p.lab || a.todas));
  console.log(`▤ Creador de incidencias · agente detector · ${plan.nombre || plan.id}`);
  console.log(`  vigila: ${vigiladas.map(p => `${p.itil || p.id}=${p.screen} (${p.esperada}${p.lab ? ', laboratorio' : ''})`).join(' · ') || 'ninguna'}`);
  console.log(`  gracia ${a.gracia} s · cada ${a.intervalo} s · Yokup: público demo: sí · MCP: ${mcp.disponible ? 'disponible' : 'no disponible (sin credencial con incidents:write)'}${a.seco ? ` · SECO: no escribe en Yokup${a.todas ? ' (--todas lo impone)' : ''}` : ''}`);
  const guardar = () => { try { fs.mkdirSync(path.dirname(ficheroEstado), { recursive: true }); fs.writeFileSync(ficheroEstado, JSON.stringify(estados, null, 1)); } catch (e) { console.error(`✖ no se pudo guardar el estado: ${e.message}`); } };
  let parar = false;
  process.on('SIGINT', () => { parar = true; guardar(); console.log('\n■ detenido'); process.exit(0); });
  do {
    const r = await pasada({ plan, estados, graciaMs: a.gracia * 1000, credencial, seco: a.seco, todas: a.todas, by, planoUrl });
    estados = r.estados; guardar();
    for (const h of r.hechos) {
      if (h.fase) console.log(`${hora()} ${h.clave}: ${h.de} → ${h.fase} (espera ${h.esperada}, pinta ${h.pintada || '¿?'})`);
      else if (h.omitida) console.log(`${hora()} ${h.clave}: ${h.accion} OMITIDA (${h.omitida}) · ${h.recurso}`);
      else console.log(`${hora()} ${h.clave}: ${h.accion} ${h.ok ? '✓' : '✖'} ${h.id || ''} ${h.error || ''} · ${h.recurso}`);
    }
    if (a.una) {
      for (const [clave, e] of Object.entries(estados)) console.log(`  ${clave}: ${e.sinDato ? `sin dato del player (${e.senal})` : `${e.fase} · espera ${e.esperada}, pinta ${e.pintada}`}${e.incidencia ? ` · incidencia ${e.incidencia}` : ''}`);
      break;
    }
    await new Promise(ok => setTimeout(ok, a.intervalo * 1000));
  } while (!parar);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
