const test = require('node:test');
const assert = require('node:assert/strict');
const { associationUrl, panelNavigation } = require('../xpace-link.js');

test('only an explicit concrete XpaceOS URL enables the default twin control', () => {
  const location = { xpaceUrl: 'https://www.xpaceos.com/xpacios/cafebreria/' };
  assert.equal(associationUrl(location), 'https://www.xpaceos.com/xpacios/cafebreria/');
  assert.deepEqual(panelNavigation(location), { kind: 'xpacio', href: 'https://www.xpaceos.com/xpacios/cafebreria/' });
});

test('legacy twins and an explicit empty association do not expose an Xpacio', () => {
  const staleAlsea = { twin: 'https://www.xpaceos.com/admira-xp/?autostart=cafeteria&loc=alsea-sbux-021' };
  assert.equal(associationUrl(staleAlsea), '');
  assert.equal(panelNavigation(staleAlsea), null);
  assert.equal(panelNavigation({ xpaceUrl: '', twin: staleAlsea.twin, fly: staleAlsea.twin }), null);
});

test('switching profile selection does not retain a previous Xpacio association', () => {
  const cafe = { xpaceUrl: 'https://www.xpaceos.com/xpacios/cafebreria/' };
  const unassociated = { twin: 'https://www.xpaceos.com/admira-xp/?autostart=cafeteria&loc=alsea-sbux-021' };
  assert.equal(panelNavigation(cafe).kind, 'xpacio');
  assert.equal(panelNavigation(unassociated), null);
  assert.equal(panelNavigation(cafe).href, 'https://www.xpaceos.com/xpacios/cafebreria/');
});

test('the contract rejects generic and non-XpaceOS URLs while keeping labelled tours', () => {
  assert.equal(panelNavigation({ xpaceUrl: 'https://www.xpaceos.com/' }), null);
  assert.equal(panelNavigation({ xpaceUrl: 'https://example.com/xpacios/store/' }), null);
  assert.deepEqual(panelNavigation({ fly: 'https://admira.tv/admiraxperience/?site=store', flyLabel: 'Recorrer AdmiraXperience ↗' }), {
    kind: 'special', href: 'https://admira.tv/admiraxperience/?site=store', label: 'Recorrer AdmiraXperience ↗',
  });
});
