// Copia literal de FORMAT_REFERENCE_MAP de admira-studio (csilvasantin/admira-studio, adaptaciones/gemelo-catalog.mjs,
// líneas 5-11 y 71-78 en el commit 0e93f881034fc80cf9b844131455476066f086f2, igual en origin/main 184f079; sha256 del
// fichero 7f483660fe2550c4c4cdaa3b9ab3251c1aa717e45d2b6c6ed364301557a635ca). La usa tests/espacios-formato.test.mjs para
// comprobar que las zonas de los espacios Altadis son las del gemelo de Studio. No se edita a mano: se vuelve a copiar.
const freeze = value => {
  if(value && typeof value === 'object') {
    for(const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const FORMAT_REFERENCE_MAP = freeze(Object.fromEntries([
  ...['01','02','04','07','20'].map(n=>[`cliente-${n}`,'mostrador']),
  ...['03','05','06','14','15','16','17','22','24'].map(n=>[`cliente-${n}`,'mural']),
  ...[1,2,3,4,5].map(n=>[`cliente-esp-${n}`,'mural']),
  ...['10','11','12','13','21','23'].map(n=>[`cliente-${n}`,'columna']),
  ...['09','18','19'].map(n=>[`cliente-${n}`,'superstretch']),
  ['cliente-08','cubo'],
]));
