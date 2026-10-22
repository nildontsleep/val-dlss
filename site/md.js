'use strict';
// Convertisseur Markdown minimal, juste ce que les pages de wiki/ utilisent :
// titres, paragraphes, listes (- et 1.), **gras**, *italique*, `code`, [liens](url). Tout le texte est échappé.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function emphasis(s) {
  return s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
}

// `resolve(url)` renvoie { href, external } : c'est lui qui décide où mène un lien.
function inline(text, resolve = (url) => ({ href: url, external: /^https?:/.test(url) })) {
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;
  let s = esc(text);
  s = s.replace(/`([^`\n]+)`/g, (_, code) => keep(`<code>${code}</code>`));
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const r = resolve(url.replace(/&amp;/g, '&'));
    const ext = r.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return keep(`<a href="${esc(r.href)}"${ext}>${emphasis(label)}</a>`);
  });
  s = emphasis(s);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)]);
}

function render(markdown, resolve) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null; // { tag, items: [string] }
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '), resolve)}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i, resolve)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const line of lines) {
    let m;
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushPara();
      flushList();
      out.push(`<h${m[1].length}>${inline(m[2], resolve)}</h${m[1].length}>`);
    } else if ((m = line.match(/^\s*(?:(-)|\d+\.)\s+(.*)$/))) {
      flushPara();
      const tag = m[1] ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push(m[2]);
    } else if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return out.join('\n');
}

module.exports = { render, inline, esc };
