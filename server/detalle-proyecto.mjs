// El detalle de un proyecto vive en la zona protegida de admiranext.com (Carlos, 20-10-2026): login de Google
// y directorio de AdmiraNeXT, como /roadmap o /flota. Aquí no se sirve en ningún dominio: la revisión preservada
// de clearchannel.tv aún lleva /cafebreria/, /docs/ y /data/projects/, así que el worker los manda allí.
export const PROYECTOS_PROTEGIDOS = 'https://www.admiranext.com/proyectos/';
const CLAVES = { cafebreria: 'cafebreria', laboratorio: 'laboratorio', 'laboratorio-admiranext': 'laboratorio' };

export function detalleProyectoURL(pathname) {
  let path = String(pathname || '');
  try { path = decodeURIComponent(path); } catch (_) {}
  path = path.toLowerCase();
  let m = /^\/(cafebreria|laboratorio)(?:\/.*|\.html)?$/.exec(path);
  if (m) return PROYECTOS_PROTEGIDOS + CLAVES[m[1]] + '/';
  m = /^\/(?:docs\/([a-z0-9-]+)\.md|data\/projects\/([a-z0-9-]+)\.json)$/.exec(path);
  const clave = m && CLAVES[m[1] || m[2]];
  if (clave) return PROYECTOS_PROTEGIDOS + clave + '/';
  if (/^\/(?:docs|data\/projects)(?:\/|$)/.test(path)) return PROYECTOS_PROTEGIDOS;
  return '';
}
