#!/usr/bin/env node
// Revisa la consola de admira.biz en producción (Morfeo, 17-oct-2026 · roadmap «Volver a verde y no
// publicar en rojo», 3c). Abre cada página en un Chrome sin ventana, espera a que cargue y recoge los
// errores de consola: excepciones sin capturar, console.error y recursos que no cargan (404, CORS…).
// Si alguna página tiene errores, sale con 1. Lo lanza el flujo de publicación después de comprobar
// que producción sirve el commit nuevo; también vale a mano desde un Mac con Chrome.
//
// Sin dependencias: habla con Chrome por el protocolo DevTools con el WebSocket de Node (≥ 22).
//
// Uso:
//   node tools/consola-produccion.mjs                               → portada, backoffice, Bugito y plano
//   node tools/consola-produccion.mjs --base https://<preview>.pages.dev [--pagina /walk.html]…
//   node tools/consola-produccion.mjs --espera 5 --ignorar 'patrón'…   (un --ignorar por patrón, regex)
//   node tools/consola-produccion.mjs --estricto                      → cuenta también el ruido conocido (RUIDO)
//   node tools/consola-produccion.mjs --sin-webgl                     → como un navegador sin WebGL (sin GPU ni SwiftShader)
//   CHROME=/ruta/a/chrome node tools/consola-produccion.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PAGINAS = ['/', '/backoffice.html', '/bugito.html', '/plano.html'];
const CHROMES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];

// Ruido conocido que no es un fallo de admira.biz. Con --estricto también se cuenta.
export const RUIDO = [
  // El login de Google (GSI/FedCM) del backoffice se queja si el visitante no tiene sesión de Google,
  // que es justo el caso de un Chrome sin ventana. Un usuario con sesión no lo ve.
  { re: /Not signed in with the identity provider/, porque: 'visitante sin sesión de Google' },
  { re: /navigator\.credentials\.get request may be outstanding/, porque: 'reintento de FedCM sin sesión de Google' },
  // Sólo los de FedCM: otros [GSI_LOGGER] (origen no permitido, client_id mal) sí son fallos nuestros.
  { re: /\[GSI_LOGGER\]: FedCM get\(\) rejects/, porque: 'FedCM sin sesión de Google' },
];

export function leerArgs(argv) {
  const o = { base: 'https://admira.biz', paginas: [], espera: 4, ignorar: [], estricto: false, sinWebGL: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === '--base') { o.base = v.replace(/\/+$/, ''); i++; }
    else if (a === '--pagina') { o.paginas.push(v.startsWith('/') ? v : '/' + v); i++; }
    else if (a === '--espera') { o.espera = Number(v); i++; }
    else if (a === '--ignorar') { o.ignorar.push(new RegExp(v)); i++; }
    else if (a === '--estricto') o.estricto = true;
    else if (a === '--sin-webgl') o.sinWebGL = true;
    else throw new Error(`argumento desconocido: ${a}`);
  }
  if (!o.paginas.length) o.paginas = PAGINAS;
  if (!o.estricto) o.ignorar.push(...RUIDO.map((r) => r.re));
  return o;
}

// Un evento del protocolo → texto del error, o null si no es un error.
export function errorDeEvento(m) {
  const p = m.params || {};
  if (m.method === 'Runtime.exceptionThrown') {
    const d = p.exceptionDetails || {};
    return `excepción: ${d.exception?.description?.split('\n')[0] || d.text || 'sin texto'}${d.url ? ` (${d.url}:${d.lineNumber + 1})` : ''}`;
  }
  if (m.method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'assert')) {
    const texto = (p.args || []).map((x) => x.value ?? x.description ?? x.type).join(' ');
    return `console.${p.type}: ${texto}`;
  }
  if (m.method === 'Log.entryAdded' && p.entry?.level === 'error') {
    return `${p.entry.source}: ${p.entry.text}${p.entry.url ? ` (${p.entry.url})` : ''}`;
  }
  return null;
}

function buscarChrome() {
  const c = process.env.CHROME || CHROMES.find((x) => existsSync(x));
  if (!c) throw new Error('no encuentro Chrome: pon su ruta en CHROME');
  return c;
}

function arrancarChrome(sinWebGL) {
  const perfil = mkdtempSync(join(tmpdir(), 'consola-biz-'));
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1366,900',
    // WebGL por software (SwiftShader): el mapa de la portada lo necesita y en CI no hay GPU.
    // --sin-webgl lo quita y apaga la GPU, como un navegador sin WebGL.
    ...(sinWebGL ? ['--disable-gpu', '--disable-software-rasterizer'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])];
  // En los runners de GitHub (Ubuntu 24.04) el sandbox de Chrome choca con AppArmor.
  if (process.env.CI) args.push('--no-sandbox');
  const proc = spawn(buscarChrome(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const ws = new Promise((ok, mal) => {
    let buf = '';
    const t = setTimeout(() => mal(new Error('Chrome no abrió DevTools en 20 s')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); ok(m[1]); }
    });
    proc.on('exit', (c) => mal(new Error(`Chrome salió con ${c} antes de abrir DevTools`)));
  });
  const cerrar = () => { proc.kill(); try { rmSync(perfil, { recursive: true, force: true }); } catch {} };
  return { ws, cerrar };
}

function conectar(url) {
  const sock = new WebSocket(url);
  let id = 0;
  const pendientes = new Map(), oyentes = new Set();
  sock.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendientes.has(m.id)) { const { ok, mal } = pendientes.get(m.id); pendientes.delete(m.id); m.error ? mal(new Error(m.error.message)) : ok(m.result); }
    else oyentes.forEach((f) => f(m));
  };
  const listo = new Promise((ok, mal) => { sock.onopen = ok; sock.onerror = () => mal(new Error(`no conecto con ${url}`)); });
  const enviar = (method, params = {}, sessionId) => new Promise((ok, mal) => {
    const n = ++id; pendientes.set(n, { ok, mal });
    sock.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  return { listo, enviar, oir: (f) => oyentes.add(f), cerrar: () => sock.close() };
}

async function revisarPagina(cdp, url, esperaS) {
  const { targetId } = await cdp.enviar('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.enviar('Target.attachToTarget', { targetId, flatten: true });
  const errores = [];
  let cargada;
  const cargado = new Promise((ok) => { cargada = ok; });
  cdp.oir((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Page.loadEventFired') cargada();
    const e = errorDeEvento(m);
    if (e) errores.push(e);
  });
  for (const d of ['Page', 'Runtime', 'Log']) await cdp.enviar(`${d}.enable`, {}, sessionId);
  await cdp.enviar('Page.navigate', { url }, sessionId);
  await Promise.race([cargado, new Promise((ok) => setTimeout(ok, 30000))]);
  await new Promise((ok) => setTimeout(ok, esperaS * 1000));
  await cdp.enviar('Target.closeTarget', { targetId });
  return [...new Set(errores)];
}

async function main() {
  const o = leerArgs(process.argv.slice(2));
  const chrome = arrancarChrome(o.sinWebGL);
  let fallos = 0;
  try {
    const cdp = conectar(await chrome.ws);
    await cdp.listo;
    for (const p of o.paginas) {
      const url = `${o.base}${p}${p.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const errores = (await revisarPagina(cdp, url, o.espera)).filter((e) => !o.ignorar.some((r) => r.test(e)));
      if (errores.length) { fallos++; console.log(`✗ ${o.base}${p}: ${errores.length} error(es)`); errores.forEach((e) => console.log(`    · ${e}`)); }
      else console.log(`✓ ${o.base}${p}: consola limpia`);
    }
    cdp.cerrar();
  } finally { chrome.cerrar(); }
  process.exit(fallos ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(2); });
