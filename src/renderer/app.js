(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D = (x) => (reduce ? 0 : x);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const basename = (p) => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';
  const OPTION_KEYS = ['style', 'strength', 'compare', 'tone', 'structure', 'autoMask', 'quality', 'codec', 'container', 'parallel'];

  const S = {
    settings: {},
    exts: new Set(),
    fine: null,
    defaultOut: '',
    inputs: [],
    items: [],
    view: 'inputs',
    running: false,
    fineOpen: false,
  };
  const cards = new Map();
  const early = [];

  const STATE_LABEL = { pending: 'En attente', running: 'En cours', done: 'Terminé', error: 'Échec', cancelled: 'Annulé' };
  const FOLDER_SVG = '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  const X_SVG = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  /* ---------- réglages ---------- */
  let saveTimer;
  function save(patch) {
    Object.assign(S.settings, patch);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const out = {};
      for (const k of OPTION_KEYS) out[k] = S.settings[k];
      window.api.saveSettings(out);
    }, 150);
  }

  function paintRange(el) {
    const p = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty('--p', `${p}%`);
    const out = el.closest('label').querySelector('output');
    if (out) out.textContent = Number(el.value).toFixed(2);
  }

  function setRange(id, v) {
    const el = $(id);
    el.value = v;
    paintRange(el);
  }

  function setSeg(sel, value, animate) {
    const seg = $(sel);
    const btns = [...seg.querySelectorAll('button')];
    let target = btns[0];
    for (const b of btns) {
      const on = Number(b.dataset.v) === Number(value);
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
      if (on) target = b;
    }
    const x = target.offsetLeft - 3;
    gsap.to(seg.querySelector('.seg-pill'), { x, duration: animate ? D(0.3) : 0, ease: 'power3.out' });
  }

  function setDisabled(sel, off) {
    const el = $(sel);
    el.classList.toggle('disabled', off);
    el.querySelector('input').disabled = off;
    if (!el.dataset.tip0) el.dataset.tip0 = el.dataset.tip;
    el.dataset.tip = off ? 'Disponible après l’import d’un preset (Réglages).' : el.dataset.tip0;
  }

  function syncFine() {
    const f = S.fine;
    setDisabled('#f-tone', !(f && f.tone > 0));
    setDisabled('#f-structure', !(f && f.structure > 0));
    setDisabled('#f-mask', !(f && f.autoMask > 0));
    const hint = $('#fine-hint');
    const none = f && f.tone + f.structure + f.autoMask === 0;
    hint.hidden = !!f && !none;
    hint.textContent = none
      ? 'Aucun réglage reconnu dans ce preset.'
      : 'Importe d’abord un preset dans les réglages pour débloquer ces curseurs.';
  }

  function syncPreset() {
    $('#preset-state').textContent = S.fine ? 'Importé' : 'Aucun';
    $('#btn-preset-clear').hidden = !S.fine;
    $('#btn-preset').textContent = S.fine ? 'Remplacer' : 'Importer';
  }

  function syncEngine() {
    $('#engine-path').textContent = S.settings.enginePath || 'Introuvable';
  }

  function sync() {
    const s = S.settings;
    setSeg('#style', s.style, false);
    setSeg('#parallel', s.parallel, false);
    setRange('#strength', s.strength);
    setRange('#tone', s.tone);
    setRange('#structure', s.structure);
    $('#automask').checked = s.autoMask !== false;
    $('#compare').checked = !!s.compare;
    for (const id of ['quality', 'codec', 'container']) $(`#${id}`).value = s[id];
    $('#out-name').textContent = basename(s.outputDir || S.defaultOut) || 'Sortie';
    syncEngine();
    syncFine();
    syncPreset();
  }

  /* ---------- infobulles et toast ---------- */
  let tipTimer;
  let tipTarget = null;
  function showTip(el) {
    const tip = $('#tip');
    tip.textContent = el.dataset.tip;
    gsap.set(tip, { visibility: 'visible' });
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const x = clamp(r.left + r.width / 2 - t.width / 2, 8, innerWidth - t.width - 8);
    let y = r.top - t.height - 8;
    if (y < 8) y = r.bottom + 8;
    gsap.fromTo(tip, { x, y: y + 4, opacity: 0 }, { x, y, opacity: 1, duration: D(0.18), overwrite: true });
  }
  function hideTip() {
    clearTimeout(tipTimer);
    tipTarget = null;
    const tip = $('#tip');
    gsap.to(tip, { opacity: 0, duration: D(0.12), overwrite: true, onComplete: () => gsap.set(tip, { visibility: 'hidden' }) });
  }
  function bindTips() {
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-tip]');
      if (el === tipTarget) return;
      hideTip();
      if (!el) return;
      tipTarget = el;
      tipTimer = setTimeout(() => showTip(el), 350);
    });
    document.addEventListener('pointerdown', hideTip);
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest('[data-tip]');
      if (el && e.target.matches(':focus-visible')) {
        hideTip();
        tipTarget = el;
        showTip(el);
      }
    });
    document.addEventListener('focusout', hideTip);
  }

  let toastTl;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    if (toastTl) toastTl.kill();
    toastTl = gsap
      .timeline()
      .set(el, { visibility: 'visible' })
      .fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: D(0.25) })
      .to(el, { opacity: 0, y: 6, duration: D(0.3), delay: 2.4 })
      .set(el, { visibility: 'hidden' });
  }

  const shake = (el) => gsap.fromTo(el, { x: -7 }, { x: 0, duration: D(0.45), ease: 'elastic.out(1, 0.3)' });

  /* ---------- panneaux ---------- */
  function toggleFine(force) {
    S.fineOpen = force === undefined ? !S.fineOpen : force;
    const f = $('#fine');
    $('#btn-fine').classList.toggle('open', S.fineOpen);
    f.setAttribute('aria-hidden', String(!S.fineOpen));
    f.inert = !S.fineOpen;
    gsap.to(f, S.fineOpen
      ? { height: 'auto', opacity: 1, duration: D(0.35), ease: 'power2.out' }
      : { height: 0, opacity: 0, duration: D(0.3), ease: 'power2.inOut' });
  }

  function openDrawer() {
    const d = $('#drawer');
    const sc = $('#scrim');
    sc.hidden = false;
    d.inert = false;
    d.setAttribute('aria-hidden', 'false');
    gsap.to(sc, { opacity: 1, duration: D(0.25) });
    gsap.to(d, { xPercent: 0, duration: D(0.4), ease: 'power3.out' });
    $('#drawer-close').focus();
    $('#gpu').textContent = '';
    if (S.settings.enginePath) window.api.devices().then((t) => ($('#gpu').textContent = t || ''));
  }
  function closeDrawer() {
    const d = $('#drawer');
    const sc = $('#scrim');
    gsap.to(sc, { opacity: 0, duration: D(0.2) });
    gsap.to(d, {
      xPercent: 100,
      duration: D(0.3),
      ease: 'power2.in',
      onComplete: () => {
        d.inert = true;
        d.setAttribute('aria-hidden', 'true');
        sc.hidden = true;
      },
    });
    $('#btn-settings').focus();
  }
  const drawerOpen = () => !$('#drawer').inert;

  function openModal(sel) {
    const m = $(sel);
    m.hidden = false;
    gsap.fromTo(m, { opacity: 0 }, { opacity: 1, duration: D(0.2) });
    gsap.fromTo(m.querySelector('.card'), { y: 14, scale: 0.97 }, { y: 0, scale: 1, duration: D(0.35), ease: 'power3.out' });
  }
  function closeModal(sel) {
    const m = $(sel);
    gsap.to(m, { opacity: 0, duration: D(0.15), onComplete: () => (m.hidden = true) });
  }
  const openModals = () => ['#modal-engine', '#modal-info'].filter((s) => !$(s).hidden);

  /* ---------- file d'attente ---------- */
  function setCompact(on) {
    const d = $('#drop');
    if (d.classList.contains('compact') === on) return;
    const h0 = d.offsetHeight;
    d.classList.toggle('compact', on);
    const h1 = d.offsetHeight;
    if (on) gsap.fromTo(d, { height: h0 }, { height: h1, duration: D(0.45), ease: 'power3.inOut', clearProps: 'height' });
    else gsap.fromTo(d, { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: D(0.4), clearProps: 'all' });
  }

  function makeCard(it) {
    const li = document.createElement('li');
    li.className = 'job';
    li.dataset.state = it.state;
    li.innerHTML =
      '<div class="job-title"><span class="job-name"></span><span class="job-tag"></span></div>' +
      '<span class="job-state"></span>' +
      `<button class="icon sm open" data-tip="Ouvrir le dossier" aria-label="Ouvrir le dossier">${FOLDER_SVG}</button>` +
      `<button class="icon sm rm" data-tip="Retirer" aria-label="Retirer">${X_SVG}</button>` +
      '<p class="job-msg"></p><div class="track"><i></i></div>';
    li.querySelector('.job-name').textContent = it.name;
    li.querySelector('.job-tag').textContent = it.tag || '';
    li.querySelector('.open').addEventListener('click', () => window.api.openFolder(it.outDir));
    li.querySelector('.rm').addEventListener('click', () => removeItem(it.key));
    return li;
  }

  function renderQueue() {
    const q = $('#queue');
    q.innerHTML = '';
    cards.clear();
    for (const it of S.items) {
      const li = makeCard(it);
      q.appendChild(li);
      cards.set(it.key, li);
      paintCard(it);
    }
    const has = S.items.length > 0;
    setCompact(has);
    $('#btn-clear').hidden = !has || S.running;
    if (has) gsap.from(q.children, { y: 12, opacity: 0, stagger: D(0.05), duration: D(0.35), ease: 'power2.out', clearProps: 'all' });
  }

  function buildInputs() {
    S.view = 'inputs';
    S.items = S.inputs.map((f) => ({ key: f.path, name: f.name, tag: '', state: 'pending', progress: 0 }));
    renderQueue();
  }

  function removeItem(key) {
    if (S.view === 'inputs') {
      S.inputs = S.inputs.filter((f) => f.path !== key);
      buildInputs();
      return;
    }
    S.items = S.items.filter((i) => i.key !== key);
    const li = cards.get(key);
    cards.delete(key);
    if (li) gsap.to(li, { opacity: 0, height: 0, padding: 0, margin: 0, duration: D(0.25), onComplete: () => li.remove() });
    if (!S.items.length) buildInputs();
  }

  function paintCard(it) {
    const li = cards.get(it.key);
    if (!li) return;
    li.dataset.state = it.state;
    const pct = it.state === 'running' && it.progress != null ? ` · ${Math.round(it.progress)}%` : '';
    li.querySelector('.job-state').textContent = STATE_LABEL[it.state] + pct;
    const msg = li.querySelector('.job-msg');
    msg.textContent = it.message || '';
    msg.title = it.message || '';
    const bar = li.querySelector('.track i');
    gsap.killTweensOf(bar);
    if (it.state === 'running' && it.progress == null) {
      if (reduce) {
        gsap.set(bar, { width: '30%', x: 0 });
      } else {
        gsap.set(bar, { width: '30%', x: '-100%' });
        gsap.to(bar, { x: '340%', duration: 1.1, repeat: -1, ease: 'power1.inOut' });
      }
    } else {
      const w = it.state === 'done' ? 100 : it.progress || 0;
      gsap.set(bar, { x: 0 });
      gsap.to(bar, { width: `${w}%`, duration: D(0.35), ease: 'power2.out' });
    }
  }

  function applyEvent(it, ev) {
    it.state = ev.state;
    if (ev.state === 'running') it.progress = ev.progress ?? null;
    if (ev.state === 'done') it.progress = 100;
    it.message = ev.message || '';
    paintCard(it);
  }

  /* ---------- fichiers ---------- */
  function addFiles(paths) {
    if (S.running) return shake($('#drop'));
    let skipped = 0;
    let added = 0;
    for (const p of paths) {
      const ext = ((String(p).match(/\.[^.\\/]+$/) || [''])[0]).toLowerCase();
      if (!S.exts.has(ext)) {
        skipped++;
        continue;
      }
      if (S.inputs.some((f) => f.path === p)) continue;
      S.inputs.push({ path: p, name: basename(p) });
      added++;
    }
    if (skipped) toast(skipped === 1 ? '1 fichier ignoré (format non pris en charge)' : `${skipped} fichiers ignorés`);
    if (added || S.view === 'jobs') buildInputs();
  }

  /* ---------- lancement ---------- */
  function setRunButton() {
    const b = $('#btn-run');
    b.textContent = S.running ? 'Annuler' : 'Lancer';
    b.classList.toggle('stop', S.running);
    document.body.classList.toggle('running', S.running);
    $('#btn-clear').hidden = S.running || !S.items.length;
  }

  async function run() {
    gsap.fromTo('#btn-run', { scale: 0.95 }, { scale: 1, duration: D(0.4), ease: 'back.out(3)' });
    if (S.running) {
      window.api.cancel();
      return;
    }
    if (!S.inputs.length) {
      shake($('#drop'));
      toast('Ajoute au moins un fichier');
      return;
    }
    const options = {};
    for (const k of OPTION_KEYS) options[k] = S.settings[k];
    const res = await window.api.start({ files: S.inputs.map((f) => f.path), options });
    if (!res.ok) {
      if (res.error === 'engine') openModal('#modal-engine');
      else if (res.error === 'busy') toast('Un rendu est déjà en cours');
      else toast('Aucun fichier valide');
      return;
    }
    S.view = 'jobs';
    S.items = res.jobs.map((j) => ({
      key: j.id,
      name: j.name,
      tag: res.compare ? `style ${j.style}` : '',
      state: 'pending',
      progress: 0,
      outDir: j.outDir,
    }));
    S.running = true;
    setRunButton();
    renderQueue();
    for (const ev of early.splice(0)) {
      const it = S.items.find((i) => i.key === ev.id);
      if (it) applyEvent(it, ev);
    }
    if (res.fine && Object.values(res.fine).some((n) => n === 0)) toast('Certains réglages fins n’ont rien modifié');
  }

  /* ---------- moteur et preset ---------- */
  async function pickEngine() {
    const r = await window.api.pickEngine();
    if (r.canceled) return;
    if (!r.ok) {
      toast('VE_CLI.exe introuvable dans ce dossier');
      return;
    }
    S.settings.enginePath = r.path;
    syncEngine();
    if (!$('#modal-engine').hidden) closeModal('#modal-engine');
    toast('Moteur trouvé');
    if (drawerOpen()) window.api.devices().then((t) => ($('#gpu').textContent = t || ''));
  }

  async function importPreset() {
    const r = await window.api.importPreset();
    if (r.canceled) return;
    if (!r.ok) {
      toast('Preset illisible');
      return;
    }
    S.fine = r.fine;
    syncFine();
    syncPreset();
    toast(r.fine.tone + r.fine.structure + r.fine.autoMask ? 'Preset importé' : 'Aucun réglage reconnu dans ce preset');
  }

  /* ---------- branchements ---------- */
  function bind() {
    bindTips();

    for (const [id, key] of [['#strength', 'strength'], ['#tone', 'tone'], ['#structure', 'structure']]) {
      const el = $(id);
      el.addEventListener('input', () => {
        paintRange(el);
        save({ [key]: Number(el.value) });
      });
    }
    $('#automask').addEventListener('change', (e) => save({ autoMask: e.target.checked }));
    $('#compare').addEventListener('change', (e) => save({ compare: e.target.checked }));
    for (const id of ['quality', 'codec', 'container']) $(`#${id}`).addEventListener('change', (e) => save({ [id]: e.target.value }));
    for (const [sel, key] of [['#style', 'style'], ['#parallel', 'parallel']]) {
      $(sel).addEventListener('click', (e) => {
        const b = e.target.closest('button[data-v]');
        if (!b) return;
        save({ [key]: Number(b.dataset.v) });
        setSeg(sel, b.dataset.v, true);
      });
    }

    $('#btn-fine').addEventListener('click', () => toggleFine());
    $('#btn-run').addEventListener('click', run);
    $('#btn-settings').addEventListener('click', openDrawer);
    $('#drawer-close').addEventListener('click', closeDrawer);
    $('#scrim').addEventListener('click', closeDrawer);
    $('#btn-info').addEventListener('click', () => openModal('#modal-info'));
    $('#m-close').addEventListener('click', () => closeModal('#modal-info'));
    $('#m-pick').addEventListener('click', pickEngine);
    $('#m-download').addEventListener('click', () => window.api.openReleases());
    $('#btn-engine').addEventListener('click', pickEngine);
    $('#btn-preset').addEventListener('click', importPreset);
    $('#btn-preset-clear').addEventListener('click', async () => {
      await window.api.clearPreset();
      S.fine = null;
      syncFine();
      syncPreset();
    });
    $('#btn-out').addEventListener('click', async () => {
      const r = await window.api.pickOutput();
      if (!r.ok) return;
      S.settings.outputDir = r.path;
      $('#out-name').textContent = basename(r.path);
    });
    $('#btn-clear').addEventListener('click', () => {
      S.inputs = [];
      buildInputs();
    });

    const drop = $('#drop');
    const pickFiles = async () => addFiles(await window.api.pickFiles());
    drop.addEventListener('click', pickFiles);
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pickFiles();
      }
    });

    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const setDrag = (on) => {
      drop.classList.toggle('drag', on);
      gsap.to(drop, { scale: on ? 1.012 : 1, duration: D(0.2) });
    };
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (hasFiles(e) && ++depth === 1) setDrag(true);
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (hasFiles(e) && --depth <= 0) {
        depth = 0;
        setDrag(false);
      }
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      setDrag(false);
      const paths = [...(e.dataTransfer?.files || [])].map((f) => window.api.pathForFile(f)).filter(Boolean);
      if (paths.length) addFiles(paths);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const m = openModals();
        if (m.length) closeModal(m[0]);
        else if (drawerOpen()) closeDrawer();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        pickFiles();
      }
    });

    window.api.onJob((ev) => {
      const it = S.items.find((i) => i.key === ev.id);
      if (it) applyEvent(it, ev);
      else early.push(ev);
    });
    window.api.onFinished(({ cancelled }) => {
      S.running = false;
      setRunButton();
      if (cancelled) toast('Annulé');
      else if (S.items.length && S.items.every((i) => i.state === 'done')) toast('Terminé');
      else if (S.items.some((i) => i.state === 'error')) toast('Certains exports ont échoué');
    });
  }

  function intro() {
    gsap.set('#drawer', { xPercent: 100, x: 0 });
    gsap.set('#toast', { xPercent: -50 });
    gsap.set('#scrim', { opacity: 0 });
    $('#fine').inert = true;
    gsap.set('#app', { autoAlpha: 1 });
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.top', { y: -14, opacity: 0, duration: D(0.5) })
      .from('#drop', { y: 18, opacity: 0, scale: 0.98, duration: D(0.6) }, '-=0.3')
      .from('.dock', { y: 30, opacity: 0, duration: D(0.55) }, '-=0.4');
    if (!reduce) gsap.to('.drop-ring', { scale: 1.12, opacity: 0.06, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }

  async function init() {
    try {
      const b = await window.api.boot();
      S.settings = b.settings;
      S.exts = new Set([...b.exts.video, ...b.exts.image]);
      S.fine = b.fine;
      S.defaultOut = b.defaultOutputDir;
      bind();
      sync();
      intro();
      if (!S.settings.enginePath) setTimeout(() => openModal('#modal-engine'), D(700));
    } catch (err) {
      console.error(err);
      document.getElementById('app').style.visibility = 'visible';
    }
  }

  init();
})();
