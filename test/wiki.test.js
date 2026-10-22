'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'wiki');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
const names = files.map((f) => f.slice(0, -3));
// Windows checks files out with CRLF line endings: compare on LF only.
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
const faqPages = names.filter((n) => !['Home', '_Sidebar'].includes(n));

test('the wiki has a Home, a sidebar and FAQ pages', () => {
  assert.ok(names.includes('Home') && names.includes('_Sidebar'));
  assert.ok(faqPages.length >= 15);
});

test('every internal link points to an existing page', () => {
  for (const f of files) {
    for (const m of read(f).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:)/.test(target)) continue;
      assert.ok(names.includes(target), `${f}: broken link to "${target}"`);
    }
  }
});

test('Home and the sidebar list every FAQ page', () => {
  for (const f of ['Home.md', '_Sidebar.md']) {
    const text = read(f);
    for (const n of faqPages) assert.ok(text.includes(`](${n})`), `${f} does not list ${n}`);
  }
});

test('every FAQ page is bilingual and has a title', () => {
  for (const n of faqPages) {
    const text = read(`${n}.md`);
    assert.match(text, /^# .+/, `${n}: no title`);
    assert.ok(text.includes('\n## English\n') && text.includes('\n## Français\n'), `${n}: needs English and French sections`);
    assert.ok(text.indexOf('## English') < text.indexOf('## Français'), `${n}: English first`);
  }
});

test('page names are wiki-safe', () => {
  for (const n of names) assert.match(n, /^_?[A-Za-z0-9-]+$/, n);
});
