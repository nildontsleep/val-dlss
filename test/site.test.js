'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'vendor.js')], { stdio: 'ignore' });
const { build, loadFaq } = require('../site/build');

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vdlss-site-'));
const result = build(out);
const htmlFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) htmlFiles.push(p);
  }
})(out);
const read = (f) => fs.readFileSync(f, 'utf8');

test('one HTML page per FAQ page, plus the home, the FAQ index and a 404', () => {
  const { order } = loadFaq();
  assert.equal(result.pages, order.length);
  for (const n of order) assert.ok(fs.existsSync(path.join(out, 'faq', `${n}.html`)), n);
  for (const f of ['index.html', '404.html', 'faq/index.html', '.nojekyll']) assert.ok(fs.existsSync(path.join(out, f)), f);
});

test('every local link, script, stylesheet and image resolves to a file', () => {
  for (const file of htmlFiles) {
    if (file.endsWith('404.html')) continue; // liens absolus vers /val-dlss/
    for (const m of read(file).matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = m[1];
      if (/^(https?:|mailto:|#)/.test(url)) continue;
      const target = path.resolve(path.dirname(file), url.split('#')[0].split('?')[0]);
      assert.ok(fs.existsSync(target), `${path.relative(out, file)}: broken ${url}`);
    }
  }
});

test('no template leftovers, no inline style or script (the CSP forbids them)', () => {
  for (const file of htmlFiles) {
    const html = read(file);
    const name = path.relative(out, file);
    assert.doesNotMatch(html, /\{\{|\}\}/, `${name}: template leftover`);
    assert.doesNotMatch(html, /\sstyle="/, `${name}: inline style`);
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/, `${name}: inline script`);
    assert.match(html, /Content-Security-Policy/, name);
  }
});

test('every page carries both languages', () => {
  for (const file of htmlFiles) {
    const html = read(file);
    assert.ok(html.includes('class="l-en"') && html.includes('class="l-fr"'), path.relative(out, file));
  }
});

test('FAQ pages highlight themselves in the sidebar and link previous / next', () => {
  const html = read(path.join(out, 'faq', 'Engine-not-found.html'));
  assert.match(html, /<a href="Engine-not-found\.html" aria-current="page">/);
  assert.match(html, /class="next"/);
  assert.doesNotMatch(html, /class="prev"/); // première page
});

test('the home page links to the FAQ and the download falls back to the releases page', () => {
  const html = read(path.join(out, 'index.html'));
  assert.match(html, /href="faq\/index\.html"/);
  assert.match(html, /data-dl href="https:\/\/github\.com\/nildontsleep\/val-dlss\/releases\/latest"/);
});

test('wiki content is escaped, not injected', () => {
  const html = read(path.join(out, 'faq', 'Where-are-my-exports.html'));
  const article = html.slice(html.indexOf('<article'), html.indexOf('</article>'));
  assert.ok(article.length > 500);
  assert.doesNotMatch(article, /<script|<iframe|\son\w+=/i);
  assert.match(article, /<code>`?Videos\\Valorant DLSS`?<\/code>|Valorant DLSS<\/code>/);
});
