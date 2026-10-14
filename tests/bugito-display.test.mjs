import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverPantalla } from '../bugito-core.mjs';
test('el apagado físico de Bugito se dirige sólo al MBP16', () => {
  for (const s of ['apagar','apaga MBP16','apagar pantalla del MBP16','apagar la pantalla del MBP16'])
    assert.deepEqual(resolverPantalla(s),{target:'mbp16',action:'off'},s);
  for (const s of ['encender MBP16','enciende la pantalla del MBP16'])
    assert.deepEqual(resolverPantalla(s),{target:'mbp16',action:'on'},s);
  for (const s of ['apagar MacMini','apagar MBP14','apagar todo','reboot MBP16','girar'])
    assert.equal(resolverPantalla(s),null,s);
});
