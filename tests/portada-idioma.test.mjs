// Portada de admira.biz sin modo Experto (Carlos, 15-oct-2026): en el sitio de ⌘, la pastilla de idioma
// con la misma caja que ☰ y ▤; ENG pasa a inglés y ESP vuelve. Las demás páginas conservan ⌘.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const portada = leer('index.html'), app = leer('app.js'), galaxia = leer('galaxy-shell.js');

test('on the home page the ⌘ slot holds the language pill, same .mode-toggle box and compact zoom', () => {
  const grupo = portada.slice(portada.indexOf('class="mode-switches"'), portada.indexOf('</div>', portada.indexOf('class="mode-switches"')));
  assert.match(grupo, /id="header-expert-toggle"[^>]*>⌘<\/button>\s*<button type="button" id="header-lang-toggle" class="mode-toggle header-lang" data-lang-target="en" data-admira-compact-control aria-label="Cambiar a inglés"[^>]*>ENG<\/button>/);
  assert.doesNotMatch(grupo.match(/id="header-lang-toggle"[^>]*>/)[0], /data-mode=|data-shell-(es|en)=/, 'not a panel toggle and labels owned by app.js');
  assert.match(portada, /#header-expert-toggle\{display:none!important\}/, 'Expert hidden on the home page');
  assert.match(portada, /\.mode-toggle\.header-lang\{font:700 12px\/1 /);
});

test('the pill and the Options menu switch share the same language code', () => {
  assert.match(app, /document\.querySelectorAll\('#lang-toggle, #header-lang-toggle'\)\.forEach\(langToggle => \{/);
  assert.match(app, /document\.querySelectorAll\('#lang-toggle, #header-lang-toggle'\)\.forEach\(boton => boton\.addEventListener\('click', e => \{\n  setLang\(/);
});

test('interior pages keep Expert (galaxy-shell.js still renders ⌘)', () => {
  assert.match(galaxia, /id="header-expert-toggle"[^>]*>⌘<\/button>/);
  assert.doesNotMatch(galaxia, /header-lang-toggle/);
});
