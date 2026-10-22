'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { render, inline } = require('../site/md');

test('headings, paragraphs and soft line breaks', () => {
  assert.equal(render('# Title\n\nline one\nline two'), '<h1>Title</h1>\n<p>line one line two</p>');
});

test('bold, italic, code and links, in that nesting', () => {
  const html = inline('**bold** and *it* and `a*b*c` and [**go**](https://x.test/a?b=1&c=2)');
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>it<\/em>/);
  assert.match(html, /<code>a\*b\*c<\/code>/); // rien n'est interprété dans le code
  assert.match(html, /<a href="https:\/\/x\.test\/a\?b=1&amp;c=2" target="_blank" rel="noopener noreferrer"><strong>go<\/strong><\/a>/);
});

test('everything is escaped, including inside links and code', () => {
  assert.equal(inline('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.match(inline('`<b>`'), /<code>&lt;b&gt;<\/code>/);
  assert.doesNotMatch(inline('[x](https://a.test/"onmouseover="x)'), /onmouseover="/);
  assert.match(inline('[<i>](https://a.test)'), /&lt;i&gt;/);
});

test('lists: bullets, numbers, a list right after a paragraph, continuation lines', () => {
  const html = render('**Fix**\n1. one\n2. two\n   more\n\n- a\n- b');
  assert.equal(html, '<p><strong>Fix</strong></p>\n<ol><li>one</li><li>two more</li></ol>\n<ul><li>a</li><li>b</li></ul>');
});

test('the resolver decides where a link goes', () => {
  const html = inline('[faq](Engine-not-found)', (u) => ({ href: `faq/${u}.html`, external: false }));
  assert.equal(html, '<a href="faq/Engine-not-found.html">faq</a>');
});

test('arrows, multiplication signs and emoji pass through untouched', () => {
  assert.equal(inline('×2, ×6 → 🇬🇧'), '×2, ×6 → 🇬🇧');
});
