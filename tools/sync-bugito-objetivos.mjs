// Catálogo de objetivos de Bugito: proyecto → circuito → dispositivo (tipo de superficie).
// Se arma SIN red, del propio repo: el mapa proyecto→circuito (espejo de xpaceos
// project-catalog / omnipublicity-api IDIOT_PROJECTS) y los tipos de superficie de los
// seeds de data/circuitos/. Regenerar: node tools/sync-bugito-objetivos.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Espejo del mapa proyecto→circuito (xpaceos project-catalog.json). {id,label,circuit}.
const PROYECTOS = [
  ['cafebreria', 'Cafebrería', 'cafebreria'], ['starbucks', 'Starbucks', 'alsea_starbucks'],
  ['starbucks-mexico', 'Starbucks México', 'alsea_mexico'], ['alcampo', 'Alcampo', 'alcampo'],
  ['canalkiosk', 'CanalKiosk', 'kioskos'], ['jti', 'JTI Xtanco', 'jti_xtanco'],
  ['estancos', 'Estancos', 'estancos'], ['decathlon', 'Decathlon', 'decathlon'],
  ['mango', 'Mango', 'mango'], ['desigual', 'Desigual', 'desigual'],
  ['elcorteingles', 'El Corte Inglés', 'elcorteingles'], ['caixabank', 'CaixaBank', 'caixabank'],
  ['bbva', 'BBVA', 'bbva'], ['correos', 'Correos', 'correos'],
  ['multiopticas', 'Multiópticas', 'multiopticas'], ['palacio', 'Palacio de Hierro', 'palacio'],
  ['liverpool', 'Liverpool', 'liverpool_mx'], ['banorte', 'Banorte', 'banorte_mx'],
  ['metro', 'Metro BCN', 'metro_bcn'], ['admiraxperience', 'Admira Xperience', 'admiraxperience'],
].map(([id, label, circuit]) => ({ id, label, circuit }));

// Tipos de dispositivo por defecto cuando un circuito no tiene seed en el repo.
const POR_DEFECTO = ['Menu board digital', 'Pantalla de caja', 'Pantalla de recogida', 'Escaparate', 'Tótem'];

const seeds = readdirSync(root + 'data/circuitos').filter(f => f.endsWith('.seed.json'));
const superficiesDe = {};
for (const f of seeds) {
  const locs = JSON.parse(readFileSync(root + 'data/circuitos/' + f, 'utf8'));
  for (const l of Array.isArray(locs) ? locs : []) {
    const c = l && l.circuit; if (!c) continue;
    (superficiesDe[c] ||= new Set());
    for (const s of Array.isArray(l.surfaces) ? l.surfaces : []) if (s && s.name) superficiesDe[c].add(String(s.name));
  }
}
const catalogo = {
  _como: 'Objetivos de Bugito: proyecto→circuito→dispositivo (tipo de superficie). Generado con node tools/sync-bugito-objetivos.mjs. Bugito actúa sobre un player virtual de laboratorio de ese circuito; no toca dispositivos de cliente.',
  proyectos: PROYECTOS.map(p => ({
    ...p,
    dispositivos: [...(superficiesDe[p.circuit] || new Set(POR_DEFECTO))].slice(0, 12),
  })),
};
writeFileSync(root + 'bugito-objetivos.json', JSON.stringify(catalogo, null, 1) + '\n');
console.log('✓ bugito-objetivos.json ·', catalogo.proyectos.length, 'proyectos ·',
  catalogo.proyectos.reduce((n, p) => n + p.dispositivos.length, 0), 'dispositivos');
