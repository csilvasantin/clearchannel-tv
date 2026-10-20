// El detalle de un proyecto vive en la zona protegida de admiranext.com (Carlos, 20-10-2026): login de Google
// y directorio de AdmiraNeXT, como /roadmap o /flota. Aquí no se sirve en ningún dominio: la revisión preservada
// de clearchannel.tv aún lleva /cafebreria/, /docs/ y /data/projects/, así que el worker los manda allí.
export const PROYECTOS_PROTEGIDOS = 'https://www.admiranext.com/proyectos/';
// /documentacion (informe estratégico, FAQ de ventas, diapositivas…) también va con acceso (Carlos, 20-10-2026).
export const DOCUMENTACION_PROTEGIDA = 'https://www.admiranext.com/documentacion/';
const CLAVES = { cafebreria: 'cafebreria', laboratorio: 'laboratorio', 'laboratorio-admiranext': 'laboratorio' };

export function detalleProyectoURL(pathname) {
  let path = String(pathname || '');
  try { path = decodeURIComponent(path); } catch (_) {}
  path = path.toLowerCase();
  const doc = /^\/documentacion(?:\/([a-z0-9-]+\.[a-z0-9]+))?\/?$/.exec(path);
  if (doc) return DOCUMENTACION_PROTEGIDA + (doc[1] || '');
  if (/^\/documentacion(?:\/|$)/.test(path)) return DOCUMENTACION_PROTEGIDA;
  let m = /^\/(cafebreria|laboratorio)(?:\/.*|\.html)?$/.exec(path);
  if (m) return PROYECTOS_PROTEGIDOS + CLAVES[m[1]] + '/';
  m = /^\/(?:docs\/([a-z0-9-]+)\.md|data\/projects\/([a-z0-9-]+)\.json)$/.exec(path);
  const clave = m && CLAVES[m[1] || m[2]];
  if (clave) return PROYECTOS_PROTEGIDOS + clave + '/';
  if (/^\/(?:docs|data\/projects)(?:\/|$)/.test(path)) return PROYECTOS_PROTEGIDOS;
  return '';
}
