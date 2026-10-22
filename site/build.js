'use strict';
// Génère le site (GitHub Pages) : la page de présentation + la FAQ, construite à partir des pages de wiki/.
// Usage : node site/build.js [dossier de sortie]   (par défaut site/dist ; lance d'abord `node scripts/vendor.js`)
const fs = require('node:fs');
const path = require('node:path');
const { render, inline, esc } = require('./md');

const ROOT = path.join(__dirname, '..');
const BASE_URL = 'https://nildontsleep.github.io/val-dlss/';
const REPO = 'https://github.com/nildontsleep/val-dlss';
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n');

// {{en: ... || fr: ...}} -> les deux versions, une seule est affichée (voir site.css)
const i18n = (html) =>
  html.replace(/\{\{\s*en:([\s\S]*?)\|\|\s*fr:([\s\S]*?)\}\}/g, (_, en, fr) => `<span class="l-en">${en.trim()}</span><span class="l-fr">${fr.trim()}</span>`);
const both = (en, fr) => `<span class="l-en">${en}</span><span class="l-fr">${fr}</span>`;

function loadFaq() {
  const dir = path.join(ROOT, 'wiki');
  const names = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).filter((n) => !['Home', '_Sidebar'].includes(n));
  const pages = new Map();
  for (const name of names) {
    const text = read('wiki', `${name}.md`);
    const [head, rest = ''] = text.split(/^## English$/m);
    const [enBody, frBody = ''] = rest.split(/^## Français$/m);
    const titleEn = (head.match(/^# (.+)$/m) || [])[1];
    const frTitle = (frBody.match(/^\*\*(.+)\*\*$/m) || [])[1];
    if (!titleEn || !frTitle || !enBody.trim() || !frBody.trim()) throw new Error(`wiki/${name}.md: titre ou section manquant(e)`);
    pages.set(name, { name, titleEn, titleFr: frTitle, enBody: enBody.trim(), frBody: frBody.replace(/^\*\*.+\*\*\s*$/m, '').trim() });
  }
  // groupes et ordre : ceux de la barre latérale du wiki
  const groups = [];
  for (const line of read('wiki', '_Sidebar.md').split('\n')) {
    let m;
    if ((m = line.match(/^\*\*([^[]+)\*\*$/))) {
      const [en, fr] = m[1].split(' · ');
      groups.push({ en: en.trim(), fr: (fr || en).trim(), names: [] });
    } else if ((m = line.match(/^- \[[^\]]+\]\(([^)]+)\)/)) && groups.length) {
      if (!pages.has(m[1])) throw new Error(`_Sidebar.md: page inconnue ${m[1]}`);
      groups.at(-1).names.push(m[1]);
    }
  }
  const order = groups.flatMap((g) => g.names);
  if (order.length !== pages.size) throw new Error('la barre latérale du wiki ne liste pas toutes les pages');
  return { pages, groups, order };
}

const head = ({ title, desc, root, path: urlPath }) => `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src https://api.github.com; base-uri 'self'; form-action 'none'">
<meta name="theme-color" content="#06070a">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${BASE_URL}${urlPath}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${BASE_URL}${urlPath}">
<meta property="og:image" content="${BASE_URL}assets/home.png">
<link rel="icon" type="image/png" href="${root}assets/icon.png">
<link rel="stylesheet" href="${root}assets/site.css">
<script src="${root}assets/boot.js"></script>`;

const nav = (root, current) => `<div class="nav-wrap"><header class="nav">
  <a class="brand" href="${root}index.html"><span class="logo">V</span><span class="brand-name">Valorant <em>DLSS</em></span></a>
  <nav class="links" aria-label="Main">
    <a href="${root}index.html#features">${both('Features', 'Fonctionnalités')}</a>
    <a href="${root}index.html#how">${both('How it works', 'Comment ça marche')}</a>
    <a class="keep" href="${root}faq/index.html"${current === 'faq' ? ' aria-current="page"' : ''}>FAQ</a>
    <a class="keep" href="${REPO}" target="_blank" rel="noopener noreferrer">GitHub</a>
  </nav>
  <div class="lang" role="group" aria-label="Language"><button type="button" data-v="en">EN</button><button type="button" data-v="fr">FR</button></div>
  <a class="btn primary" data-dl href="${REPO}/releases/latest"><svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/></svg><span>${both('Download', 'Télécharger')}</span><b></b></a>
</header></div>`;

const footer = (root) => `<footer><div class="foot">
  <p>${both(
    'Independent fan project, not affiliated with, sponsored or endorsed by Riot Games, NVIDIA or Visual Enhancer. VALORANT, DLSS and RTX belong to their owners. Interface by Morpheen, TikTok quality method by paschafps, engine by Merserk.',
    'Projet de fan indépendant, non affilié, sponsorisé ni approuvé par Riot Games, NVIDIA ou Visual Enhancer. VALORANT, DLSS et RTX appartiennent à leurs propriétaires. Interface par Morpheen, méthode TikTok par paschafps, moteur par Merserk.',
  )}</p>
  <nav aria-label="Footer">
    <a href="${root}faq/index.html">FAQ</a>
    <a href="${REPO}/releases" target="_blank" rel="noopener noreferrer">Releases</a>
    <a href="${REPO}/issues/new/choose" target="_blank" rel="noopener noreferrer">Issues</a>
    <a href="${REPO}/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT</a>
    <a href="${REPO}/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener noreferrer">${both('Third-party notices', 'Mentions tierces')}</a>
  </nav>
</div></footer>`;

const TEASER = ['Engine-not-found', 'Windows-protected-your-PC-SmartScreen', 'TikTok-file-is-slowed-down', 'Max-size-kept-as-is', 'Update-button-missing-or-failed', 'Will-I-get-banned-Vanguard'];
const DEPS = ['inter.woff2', 'instrument-serif.woff2', 'instrument-serif-italic.woff2', 'jetbrains-mono.woff2', 'jetbrains-mono-500.woff2', 'gsap.min.js'];

function build(out = path.join(__dirname, 'dist')) {
  const { pages, groups, order } = loadFaq();
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(out, 'faq'), { recursive: true });

  // ressources
  for (const f of ['site.css', 'site.js', 'boot.js']) fs.copyFileSync(path.join(__dirname, 'assets', f), path.join(out, 'assets', f));
  const vendor = path.join(ROOT, 'src', 'renderer', 'vendor');
  for (const f of DEPS) {
    if (!fs.existsSync(path.join(vendor, f))) throw new Error(`${f} manquant : lance d'abord « node scripts/vendor.js »`);
    fs.copyFileSync(path.join(vendor, f), path.join(out, 'assets', f));
  }
  for (const f of ['home.png', 'running.png', 'advanced.png']) fs.copyFileSync(path.join(ROOT, 'docs', 'screenshots', f), path.join(out, 'assets', f));
  fs.copyFileSync(path.join(ROOT, 'src', 'assets', 'icon.png'), path.join(out, 'assets', 'icon.png'));
  fs.writeFileSync(path.join(out, '.nojekyll'), '');

  const teaser = TEASER.map((n) => {
    const p = pages.get(n);
    if (!p) throw new Error(`teaser inconnu : ${n}`);
    return `      <li><a href="{{root}}faq/${n}.html">${both(esc(p.titleEn), esc(p.titleFr))}</a></li>`;
  }).join('\n');

  // page d'accueil
  const home = read('site', 'index.src.html');
  const homeHtml = i18n(
    home
      .replace('{{head}}', head({ title: 'Valorant DLSS · Neural Rendering for your Valorant clips', desc: 'A free, local, open-source Windows app that applies Neural Rendering to your Valorant clips. Drop a clip, pick a style, run. English and French.', root: '', path: '' }))
      .replace('{{nav}}', nav('', 'home'))
      .replace('{{footer}}', footer(''))
      .replace('{{faqTeaser}}', teaser),
  ).replace(/\{\{root\}\}/g, '');
  fs.writeFileSync(path.join(out, 'index.html'), homeHtml);

  // FAQ : index
  const resolver = (url) => {
    if (/^https?:/.test(url)) return { href: url, external: true };
    if (url === 'Home') return { href: 'index.html', external: false };
    if (pages.has(url)) return { href: `${url}.html`, external: false };
    throw new Error(`lien inconnu dans le wiki : ${url}`);
  };
  const sections = groups
    .map((g) => `<section><h2>${both(esc(g.en), esc(g.fr))}</h2><ul>${g.names
      .map((n) => {
        const p = pages.get(n);
        const text = esc(`${p.titleEn} ${p.titleFr} ${p.enBody} ${p.frBody}`.toLowerCase().replace(/[*`[\]()]/g, ''));
        return `<li data-text="${text}"><a href="${n}.html">${both(esc(p.titleEn), esc(p.titleFr))}</a></li>`;
      })
      .join('')}</ul></section>`)
    .join('\n');
  const faqIndex = `<!doctype html>
<html lang="en" data-lang="en"><head>
${head({ title: 'FAQ · Valorant DLSS', desc: 'One page per common problem with Valorant DLSS: engine not found, SmartScreen, TikTok file in slow motion, size cap, updates.', root: '../', path: 'faq/' })}
</head><body>
<div class="vignette"></div><div class="grain"></div>
${nav('../', 'faq')}
<main class="wrap top-pad">
  <p class="label">FAQ</p>
  <h1 class="page-title">${both('One page per <em>problem</em>.', 'Une page par <em>souci</em>.')}</h1>
  <p class="lead">${both('Find yours, fix it in a minute. Still stuck? Open an issue.', 'Trouve le tien, règle-le en une minute. Toujours bloqué ? Ouvre une issue.')}</p>
  <input class="search" id="faq-search" type="search" autocomplete="off" aria-label="Search / Rechercher" placeholder="Search · Rechercher">
  <div class="faq-all">
${sections}
  </div>
  <p class="empty" id="faq-empty" hidden>${both('Nothing found. Try another word, or', 'Rien trouvé. Essaie un autre mot, ou')} <a href="${REPO}/issues/new/choose" target="_blank" rel="noopener noreferrer">${both('open an issue', 'ouvre une issue')}</a>.</p>
</main>
${footer('../')}
<script src="../assets/site.js"></script>
</body></html>
`;
  fs.writeFileSync(path.join(out, 'faq', 'index.html'), i18n(faqIndex));

  // FAQ : une page par problème
  const side = (current) =>
    groups.map((g) => `<h2>${both(esc(g.en), esc(g.fr))}</h2><ul>${g.names
      .map((n) => `<li><a href="${n}.html"${n === current ? ' aria-current="page"' : ''}>${both(esc(pages.get(n).titleEn), esc(pages.get(n).titleFr))}</a></li>`)
      .join('')}</ul>`).join('');
  order.forEach((name, i) => {
    const p = pages.get(name);
    const prev = pages.get(order[i - 1]);
    const next = pages.get(order[i + 1]);
    const html = `<!doctype html>
<html lang="en" data-lang="en"><head>
${head({ title: `${p.titleEn} · FAQ · Valorant DLSS`, desc: `${p.titleEn}: the fix, in English and French.`, root: '../', path: `faq/${name}.html` })}
</head><body>
<div class="vignette"></div><div class="grain"></div>
${nav('../', 'faq')}
<main class="wrap doc">
  <aside class="side" aria-label="FAQ">${side(name)}</aside>
  <article class="article">
    <p class="crumbs"><a href="index.html">FAQ</a></p>
    <h1>${both(esc(p.titleEn), esc(p.titleFr))}</h1>
    <div class="prose l-en" lang="en">${render(p.enBody, resolver)}</div>
    <div class="prose l-fr" lang="fr">${render(p.frBody, resolver)}</div>
    <div class="help"><p>${both(
      `Not solved? <a href="${REPO}/issues/new/choose" target="_blank" rel="noopener noreferrer">Open an issue</a> with the exact error text. No support in Discord DMs except for major bugs.`,
      `Pas résolu ? <a href="${REPO}/issues/new/choose" target="_blank" rel="noopener noreferrer">Ouvre une issue</a> avec le texte exact de l'erreur. Pas de support en MP Discord sauf bugs majeurs.`,
    )}</p></div>
    <nav class="pager" aria-label="Pages">${prev ? `<a class="prev" href="${prev.name}.html"><small>${both('Previous', 'Précédent')}</small>${both(esc(prev.titleEn), esc(prev.titleFr))}</a>` : ''}${next ? `<a class="next" href="${next.name}.html"><small>${both('Next', 'Suivant')}</small>${both(esc(next.titleEn), esc(next.titleFr))}</a>` : ''}</nav>
  </article>
</main>
${footer('../')}
<script src="../assets/site.js"></script>
</body></html>
`;
    fs.writeFileSync(path.join(out, 'faq', `${name}.html`), i18n(html));
  });

  // 404
  fs.writeFileSync(path.join(out, '404.html'), `<!doctype html>
<html lang="en" data-lang="en"><head>
${head({ title: 'Not found · Valorant DLSS', desc: 'Page not found.', root: '/val-dlss/', path: '404.html' })}
</head><body>
<div class="vignette"></div><div class="grain"></div>
<main class="wrap nf">
  <p class="label">404</p>
  <h1 class="page-title">${both('Nothing <em>here</em>.', 'Rien <em>ici</em>.')}</h1>
  <a class="btn primary" href="/val-dlss/">${both('Back to the site', 'Retour au site')}</a>
</main>
</body></html>
`);
  return { out, pages: order.length };
}

module.exports = { build, loadFaq };

if (require.main === module) {
  const r = build(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  console.log(`site généré : ${r.pages} pages de FAQ dans ${path.relative(ROOT, r.out)}`);
}
