import assert from 'node:assert/strict';
import { ADMIRA_HOST, replaceBrand } from '../_worker.js';

assert.equal(ADMIRA_HOST.test('admira.app'), true);
assert.equal(ADMIRA_HOST.test('www.admira.app'), true);
assert.equal(ADMIRA_HOST.test('clearchannel.tv'), false);
assert.equal(ADMIRA_HOST.test('fakeadmira.app.example'), false);

assert.equal(replaceBrand('Clear Channel'), 'Admira App');
assert.equal(replaceBrand('CLEAR·CHANNEL'), 'ADMIRA·APP');
assert.equal(replaceBrand('https://www.clearchannel.tv/about.html'), 'https://www.admira.app/about.html');
assert.equal(replaceBrand('clearchannel.tv · RetailMedia'), 'admira.app · RetailMedia');

console.log('brand worker: ok');
