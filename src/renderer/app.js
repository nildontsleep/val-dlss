(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D = (x) => (reduce ? 0 : x);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const basename = (p) => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';
  const OPTION_KEYS = ['style', 'strength', 'compare', 'tiktok'];

  const S = { settings: {}, exts: new Set(), inputs: [], items: [], view: 'inputs', running: false };
  const cards = new Map();
  const early = [];

  const STATE_LABEL = { pending: 'En attente', running: 'En cours', done: 'Terminé', error: 'Échec', cancelled: 'Annulé' };
  const ICON =
    '<span class="job-ico"><svg viewBox="0 0 24 24"><circle class="base" cx="12" cy="12" r="9"/><circle class="arc" cx="12" cy="12" r="9"/>' +
    '<path class="tick" d="m8 12.5 3 3 5-6"/><path class="bang" d="M12 7.5v5.5M12 16.5h.01"/></svg></span>';
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
    el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
    el.closest('label').querySelector('output').textContent = Number(el.value).toFixed(2);
  }

  function setSeg(sel, value, animate) {
    const seg = $(sel);
    let target = seg.querySelector('button');
    for (const b of seg.querySelectorAll('button')) {
      const on = Number(b.dataset.v) === Number(value);
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
      if (on) target = b;
    }
    gsap.to(seg.querySelector('.seg-pill'), { x: target.offsetLeft - 3, duration: animate ? D(0.35) : 0, ease: 'back.out(1.6)' });
  }

  function syncStatus() {
    const ok = !!S.settings.enginePath;
    $('#status').classList.toggle('ok', ok);
    $('#status span').textContent = ok ? 'Moteur prêt' : 'Moteur manquant';
  }

  function sync() {
    const s = S.settings;
    setSeg('#style', s.style, false);
    $('#strength').value = s.strength;
    paintRange($('#strength'));
    $('#compare').checked = !!s.compare;
    $('#tiktok').checked = s.tiktok !== false;
    $('#out-name').textContent = basename(s.outputDir || S.defaultOut) || 'Sortie';
    syncStatus();
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
    let y = r.top - t.height - 10;
    if (y < 8) y = r.bottom + 10;
    gsap.fromTo(tip, { x, y: y + 5, opacity: 0 }, { x, y, opacity: 1, duration: D(0.2), ease: 'power2.out', overwrite: true });
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
      .fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: D(0.3), ease: 'power3.out' })
      .to(el, { opacity: 0, y: 6, duration: D(0.3), delay: 2.4 })
      .set(el, { visibility: 'hidden' });
  }

  const shake = (el) => gsap.fromTo(el, { x: -7 }, { x: 0, duration: D(0.45), ease: 'elastic.out(1, 0.3)' });

  /* ---------- fenêtres ---------- */
  function openModal(id) {
    const m = $(id);
    if (id === '#modal-info') {
      $('#p-engine').textContent = S.settings.enginePath || 'Introuvable';
      $('#p-ffmpeg').textContent = S.settings.ffmpegPath || 'Introuvable';
    }
    m.hidden = false;
    gsap.fromTo(m, { opacity: 0 }, { opacity: 1, duration: D(0.2) });
    gsap.fromTo(m.querySelector('.card'), { y: 16, scale: 0.97 }, { y: 0, scale: 1, duration: D(0.4), ease: 'power3.out' });
  }
  function closeModal(id) {
    const m = $(id);
    gsap.to(m, { opacity: 0, duration: D(0.15), onComplete: () => (m.hidden = true) });
  }
  const openModals = () => ['#modal-engine', '#modal-ffmpeg', '#modal-info'].filter((s) => !$(s).hidden);

  async function pickEngine() {
    const r = await window.api.pickEngine();
    if (r.canceled) return;
    if (!r.ok) return toast('VE_CLI.exe introuvable dans ce dossier');
    S.settings.enginePath = r.path;
    syncStatus();
    $('#p-engine').textContent = r.path;
    if (!$('#modal-engine').hidden) closeModal('#modal-engine');
    toast('Moteur trouvé');
  }

  async function pickFfmpeg() {
    const r = await window.api.pickFfmpeg();
    if (r.canceled) return;
    if (!r.ok) return toast('Ce ffmpeg.exe ne démarre pas');
    S.settings.ffmpegPath = r.path;
    $('#p-ffmpeg').textContent = r.path;
    if (!$('#modal-ffmpeg').hidden) closeModal('#modal-ffmpeg');
    toast('ffmpeg prêt');
  }

  /* ---------- file d'attente ---------- */
  function setCompact(on) {
    const d = $('#drop');
    if (d.classList.contains('compact') === on) return;
    const h0 = d.offsetHeight;
    d.classList.toggle('compact', on);
    const h1 = d.offsetHeight;
    if (on) gsap.fromTo(d, { height: h0 }, { height: h1, duration: D(0.5), ease: 'power3.inOut', clearProps: 'height' });
    else gsap.fromTo(d, { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: D(0.45), ease: 'power3.out', clearProps: 'all' });
    $('#drop .drop-title').textContent = on ? 'Ajouter d’autres clips' : 'Dépose un clip';
  }

  function makeCard(it) {
    const li = document.createElement('li');
    li.className = 'job';
    li.dataset.state = it.state;
    li.innerHTML =
      `${ICON}<div class="job-title"><span class="job-name"></span><span class="job-tag"></span></div>` +
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
    if (has) gsap.from(q.children, { y: 14, opacity: 0, stagger: D(0.06), duration: D(0.4), ease: 'power3.out', clearProps: 'all' });
  }

  function buildInputs() {
    S.view = 'inputs';
    S.items = S.inputs.map((f) => ({ key: f.path, name: f.name, tag: '', state: 'pending', progress: 0 }));
    renderQueue();
  }

  function removeItem(key) {
    if (S.view === 'inputs') {
      S.inputs = S.inputs.filter((f) => f.path !== key);
      return buildInputs();
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
    const was = li.dataset.state;
    li.dataset.state = it.state;
    let label = STATE_LABEL[it.state];
    if (it.state === 'running') {
      if (it.phase === 'finish') label = 'Finition TikTok';
      else if (it.progress != null) label += ` · ${Math.round(it.progress)}%`;
    }
    li.querySelector('.job-state').textContent = label;
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
      gsap.set(bar, { x: 0 });
      gsap.to(bar, { width: `${it.state === 'done' ? 100 : it.progress || 0}%`, duration: D(0.35), ease: 'power2.out' });
    }
    if (it.state === 'done' && was !== 'done') {
      gsap.fromTo(li.querySelector('.tick'), { strokeDashoffset: 24 }, { strokeDashoffset: 0, duration: D(0.5), ease: 'power2.out' });
      gsap.fromTo(li, { scale: 1.012 }, { scale: 1, duration: D(0.55), ease: 'back.out(3)' });
    }
  }

  function applyEvent(it, ev) {
    it.state = ev.state;
    it.phase = ev.phase || null;
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
    if (skipped) toast(skipped === 1 ? '1 fichier ignoré (ce n’est pas un clip)' : `${skipped} fichiers ignorés`);
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
    gsap.fromTo('#btn-run', { scale: 0.94 }, { scale: 1, duration: D(0.45), ease: 'back.out(3)' });
    if (S.running) return window.api.cancel();
    if (!S.inputs.length) {
      shake($('#drop'));
      return toast('Ajoute au moins un clip');
    }
    const options = {};
    for (const k of OPTION_KEYS) options[k] = S.settings[k];
    const res = await window.api.start({ files: S.inputs.map((f) => f.path), options });
    if (!res.ok) {
      if (res.error === 'engine') openModal('#modal-engine');
      else if (res.error === 'ffmpeg') openModal('#modal-ffmpeg');
      else if (res.error === 'busy') toast('Un rendu est déjà en cours');
      else toast('Aucun clip valide');
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
  }

  /* ---------- branchements ---------- */
  function bind() {
    bindTips();

    $('#strength').addEventListener('input', (e) => {
      paintRange(e.target);
      save({ strength: Number(e.target.value) });
    });
    $('#compare').addEventListener('change', (e) => save({ compare: e.target.checked }));
    $('#tiktok').addEventListener('change', (e) => {
      save({ tiktok: e.target.checked });
      if (e.target.checked && !S.settings.ffmpegPath) openModal('#modal-ffmpeg');
    });
    $('#style').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      save({ style: Number(b.dataset.v) });
      setSeg('#style', b.dataset.v, true);
    });

    $('#btn-run').addEventListener('click', run);
    $('#btn-info').addEventListener('click', () => openModal('#modal-info'));
    $('#status').addEventListener('click', () => openModal(S.settings.enginePath ? '#modal-info' : '#modal-engine'));
    $('#m-close').addEventListener('click', () => closeModal('#modal-info'));
    $('#m-notiktok').addEventListener('click', () => {
      $('#tiktok').checked = false;
      save({ tiktok: false });
      closeModal('#modal-ffmpeg');
    });
    for (const b of document.querySelectorAll('[data-pick]')) b.addEventListener('click', () => (b.dataset.pick === 'engine' ? pickEngine() : pickFfmpeg()));
    for (const b of document.querySelectorAll('[data-link]')) b.addEventListener('click', () => window.api.openLink(b.dataset.link));
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
      gsap.to(drop, { scale: on ? 1.012 : 1, duration: D(0.25), ease: 'power2.out' });
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
    gsap.set('#toast', { xPercent: -50 });
    gsap.set('#app', { autoAlpha: 1 });
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.top', { y: -16, opacity: 0, duration: D(0.6) })
      .from('#drop', { y: 22, opacity: 0, scale: 0.98, duration: D(0.7) }, '-=0.35')
      .from('.dock', { y: 34, opacity: 0, duration: D(0.6) }, '-=0.45');
    if (reduce) return;
    document.querySelectorAll('.ring').forEach((r, i) => {
      gsap.fromTo(r, { scale: 0.6, opacity: 0.35 }, { scale: 2.6, opacity: 0, duration: 4, repeat: -1, ease: 'power1.out', delay: i * 1.3 });
    });
    gsap.to('.drop-core', { y: -5, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }

  async function init() {
    try {
      const b = await window.api.boot();
      S.settings = b.settings;
      S.defaultOut = b.defaultOutputDir;
      S.exts = new Set(b.exts);
      bind();
      sync();
      intro();
      if (!S.settings.enginePath) setTimeout(() => openModal('#modal-engine'), D(800));
    } catch (err) {
      console.error(err);
      $('#app').style.visibility = 'visible';
    }
  }

  init();
})();
