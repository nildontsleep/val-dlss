(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const t = (k, p) => window.I18N.t(k, p);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D = (x) => (reduce ? 0 : x);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const basename = (p) => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';
  const pad2 = (n) => String(n).padStart(2, '0');
  // Timecode HH:MM:SS:FF à 24 images par seconde, comme dans un logiciel de montage.
  const tc = (ms) => {
    const total = Math.floor(ms / 1000);
    return `${pad2(Math.floor(total / 3600))}:${pad2(Math.floor(total / 60) % 60)}:${pad2(total % 60)}:${pad2(Math.floor(((ms % 1000) / 1000) * 24))}`;
  };
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const OPTION_KEYS = ['style', 'strength', 'compare', 'tiktok', 'tone', 'structure', 'skin', 'passes', 'autoMask', 'quality', 'maxSize'];
  const PRESET_KEYS = ['style', 'strength', 'tone', 'structure', 'skin', 'passes', 'autoMask', 'quality'];
  const DEFAULTS = { style: 2, strength: 1, tone: 1, structure: 1, skin: 1, passes: 1, autoMask: false, quality: 'best' };
  const ADV_KEYS = ['tone', 'structure', 'skin', 'passes', 'autoMask', 'quality'];

  const S = {
    settings: {},
    exts: new Set(),
    inputs: [],
    items: [],
    view: 'inputs',
    running: false,
    defaultOut: '',
    update: null,
    advOpen: false,
    pv: { open: false, idx: 0, time: 0, duration: 0, token: 0, timer: null, grid: false },
  };
  const cards = new Map();
  const early = [];

  const ICON =
    '<span class="job-ico"><svg viewBox="0 0 24 24"><circle class="base" cx="12" cy="12" r="9"/><circle class="arc" cx="12" cy="12" r="9"/>' +
    '<path class="tick" d="m8 12.5 3 3 5-6"/><path class="bang" d="M12 7.5v5.5M12 16.5h.01"/></svg></span>';
  const FOLDER_SVG = '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  const X_SVG = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  /* ---------- réglages ---------- */
  let saveTimer;
  let pending = {};
  function save(patch) {
    Object.assign(S.settings, patch);
    updateVF();
    Object.assign(pending, patch);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const p = pending;
      pending = {};
      window.api.saveSettings(p);
    }, 150);
  }

  function updateVF() {
    const s = S.settings;
    $('#vf-state').textContent = t(S.running ? 'vf.rec' : 'vf.standby');
    $('#vf-info').textContent = `STYLE ${s.style} · ${Number(s.strength).toFixed(2)}${s.tiktok !== false ? ' · TIKTOK' : ''}`;
    $('#vf-count').textContent = t('vf.clips', { n: S.inputs.length });
    $('#vf-local').textContent = t('vf.local');
  }

  function startRec() {
    S.recStart = performance.now();
    $('#rec').hidden = false;
    clearInterval(S.recTimer);
    S.recTimer = setInterval(() => {
      const v = tc(performance.now() - S.recStart);
      $('#rec-tc').textContent = v;
      $('#vf-tc').textContent = v;
    }, 80);
    gsap.from('#rec', { opacity: 0, scale: 0.9, duration: D(0.3) });
  }

  function stopRec() {
    clearInterval(S.recTimer);
    setTimeout(() => {
      if (S.running) return;
      $('#rec').hidden = true;
      $('#vf-tc').textContent = '00:00:00:00';
    }, 4000);
  }

  const currentValues = () => Object.fromEntries(PRESET_KEYS.map((k) => [k, S.settings[k]]));
  const sameValues = (a, b) => PRESET_KEYS.every((k) => (typeof a[k] === 'number' ? Math.abs(a[k] - b[k]) < 1e-6 : a[k] === b[k]));
  const allPresets = () => [{ id: 'default', name: t('adv.default'), values: DEFAULTS }, ...(S.settings.presets || [])];

  function paintRange(el) {
    el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
    el.closest('label').querySelector('output').textContent = Number(el.value).toFixed(2);
  }

  function setSeg(sel, value, animate) {
    const seg = $(sel);
    const btns = [...seg.querySelectorAll('button')];
    let target = btns[0];
    for (const b of btns) {
      const on = String(b.dataset.v) === String(value);
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
      if (on) target = b;
    }
    gsap.to(seg.querySelector('.seg-pill'), { x: target.offsetLeft - 3, width: target.offsetWidth, duration: animate ? D(0.35) : 0, ease: 'back.out(1.6)' });
  }

  function refreshSegs() {
    setSeg('#style', S.settings.style, false);
    setSeg('#passes', S.settings.passes, false);
    setSeg('#quality', S.settings.quality, false);
    setSeg('#lang', window.I18N.lang, false);
  }

  function syncStatus() {
    const ok = !!S.settings.enginePath;
    $('#status').classList.toggle('ok', ok);
    $('#status span').textContent = t(ok ? 'status.ready' : 'status.missing');
  }

  function syncPresetUI() {
    const sel = $('#preset-sel');
    const active = S.settings.activePreset;
    sel.innerHTML = '';
    for (const p of allPresets()) sel.add(new Option(p.name, p.id));
    if (!allPresets().some((p) => p.id === active)) sel.add(new Option(t('adv.custom'), ''));
    sel.value = allPresets().some((p) => p.id === active) ? active : '';
    $('#preset-del').hidden = !(S.settings.presets || []).some((p) => p.id === active);
  }

  function syncAdvIndicator() {
    $('#btn-adv').classList.toggle('mod', ADV_KEYS.some((k) => S.settings[k] !== DEFAULTS[k]));
  }

  function sync() {
    const s = S.settings;
    setSeg('#style', s.style, false);
    setSeg('#passes', s.passes, false);
    setSeg('#quality', s.quality, false);
    for (const id of ['strength', 'tone', 'structure', 'skin']) {
      $(`#${id}`).value = s[id];
      paintRange($(`#${id}`));
    }
    $('#compare').checked = !!s.compare;
    $('#tiktok').checked = s.tiktok !== false;
    $('#automask').checked = !!s.autoMask;
    $('#maxsize').value = s.maxSize > 0 ? s.maxSize : '';
    $('#out-name').textContent = basename(s.outputDir || S.defaultOut) || 'Valorant DLSS';
    syncStatus();
    syncPresetUI();
    syncAdvIndicator();
  }

  // Appelée après chaque changement de réglage de rendu.
  function onParamChange({ skipPreview = false } = {}) {
    const match = allPresets().find((p) => sameValues(p.values, currentValues()));
    save({ activePreset: match ? match.id : '' });
    syncPresetUI();
    syncAdvIndicator();
    paintTiles();
    if (S.pv.open && !skipPreview) schedulePreview(500);
  }

  function applyValues(values) {
    save(values);
    sync();
    refreshSegs();
    syncAdvIndicator();
    if (S.pv.open) schedulePreview(300);
  }

  /* ---------- mise à jour ---------- */
  function paintUpdate(progress = null) {
    const u = S.update;
    const b = $('#btn-update');
    b.hidden = !u;
    if (!u) return;
    $('#upd-label').textContent = progress === null ? t('update.btn', { v: u.version }) : t('update.downloading', { p: progress });
    b.dataset.tip = t(u.direct ? 'update.tip' : 'update.tipPage', { v: u.version });
    b.disabled = progress !== null;
  }
  async function checkUpdate() {
    try {
      const r = await window.api.checkUpdate();
      if (!r.ok || !r.update) return;
      S.update = r.update;
      paintUpdate();
      gsap.from('#btn-update', { opacity: 0, scale: 0.85, duration: D(0.5), ease: 'back.out(2)' });
    } catch {
      /* hors ligne : on continue sans */
    }
  }
  async function installUpdate() {
    paintUpdate(0);
    const off = window.api.onUpdateProgress((p) => paintUpdate(p));
    const r = await window.api.installUpdate();
    off();
    if (r.ok) return paintUpdate(null);
    paintUpdate(null);
    toast(r.error === 'busy' ? t('toast.updateBusy') : t('toast.updateFail', { detail: r.error || '?' }));
  }

  /* ---------- langue ---------- */
  function setLang(lang, persist) {
    window.I18N.lang = lang;
    window.I18N.apply();
    $('#drop-title').innerHTML = t($('#drop-title').dataset.i18nHtml);
    syncStatus();
    syncPresetUI();
    setRunButton();
    updateVF();
    paintUpdate();
    paintTiles();
    for (const it of S.items) paintCard(it);
    if (persist) save({ lang: window.I18N.lang });
    requestAnimationFrame(refreshSegs);
  }

  /* ---------- infobulles et toast ---------- */
  let tipTimer;
  let tipTarget = null;
  function showTip(el) {
    const tip = $('#tip');
    tip.textContent = el.dataset.tip;
    gsap.set(tip, { visibility: 'visible' });
    const r = el.getBoundingClientRect();
    const b = tip.getBoundingClientRect();
    const x = clamp(r.left + r.width / 2 - b.width / 2, 8, innerWidth - b.width - 8);
    let y = r.top - b.height - 10;
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
      .to(el, { opacity: 0, y: 6, duration: D(0.3), delay: 2.8 })
      .set(el, { visibility: 'hidden' });
  }

  const shake = (el) => gsap.fromTo(el, { x: -7 }, { x: 0, duration: D(0.45), ease: 'elastic.out(1, 0.3)' });

  /* ---------- fenêtres ---------- */
  function openModal(id) {
    const m = $(id);
    if (id === '#modal-info') {
      $('#p-engine').textContent = S.settings.enginePath || t('notfound');
      $('#p-ffmpeg').textContent = S.settings.ffmpegPath || t('notfound');
      $('#check-updates').checked = S.settings.checkUpdates !== false;
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
    if (!r.ok) return toast(t('toast.engineBad'));
    S.settings.enginePath = r.path;
    syncStatus();
    $('#p-engine').textContent = r.path;
    if (!$('#modal-engine').hidden) closeModal('#modal-engine');
    toast(t('toast.engineOk'));
  }

  async function pickFfmpeg() {
    const r = await window.api.pickFfmpeg();
    if (r.canceled) return;
    if (!r.ok) return toast(t('toast.ffmpegBad'));
    S.settings.ffmpegPath = r.path;
    $('#p-ffmpeg').textContent = r.path;
    if (!$('#modal-ffmpeg').hidden) closeModal('#modal-ffmpeg');
    toast(t('toast.ffmpegOk'));
  }

  /* ---------- réglages avancés et presets ---------- */
  function toggleAdv(force) {
    S.advOpen = force === undefined ? !S.advOpen : force;
    const el = $('#adv');
    $('#btn-adv').classList.toggle('on', S.advOpen);
    el.setAttribute('aria-hidden', String(!S.advOpen));
    el.inert = !S.advOpen;
    if (S.advOpen) requestAnimationFrame(refreshSegs);
    gsap.to(el, S.advOpen
      ? { height: 'auto', opacity: 1, duration: D(0.4), ease: 'power3.out' }
      : { height: 0, opacity: 0, duration: D(0.3), ease: 'power2.inOut' });
    save({ advancedOpen: S.advOpen });
  }

  function savePreset(name) {
    const clean = name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40);
    if (!clean) return false;
    const list = [...(S.settings.presets || [])];
    const existing = list.find((p) => p.name.toLowerCase() === clean.toLowerCase());
    let id;
    if (existing) {
      existing.values = currentValues();
      id = existing.id;
    } else {
      if (list.length >= 30) return false;
      id = `p${Date.now().toString(36)}`;
      list.push({ id, name: clean, values: currentValues() });
    }
    save({ presets: list, activePreset: id });
    syncPresetUI();
    toast(t('toast.saved'));
    return true;
  }

  function deletePreset() {
    const id = S.settings.activePreset;
    save({ presets: (S.settings.presets || []).filter((p) => p.id !== id), activePreset: '' });
    onParamChange();
    toast(t('toast.deleted'));
  }

  /* ---------- aperçu d'une frame ---------- */
  function setSplit(pct) {
    const p = clamp(pct, 0, 100);
    $('#cmp-after').style.clipPath = `inset(0 0 0 ${p}%)`;
    $('#cmp-handle').style.left = `${p}%`;
    $('#cmp-handle').setAttribute('aria-valuenow', String(Math.round(p)));
    S.pv.split = p;
  }

  function showLoader(on) {
    gsap.to('#cmp-load', { autoAlpha: on ? 1 : 0, duration: D(0.2), overwrite: true });
  }

  function showPreviewError(text) {
    const el = $('#cmp-err');
    el.hidden = !text;
    el.textContent = text || '';
  }

  function schedulePreview(delay = 400) {
    clearTimeout(S.pv.timer);
    S.pv.timer = setTimeout(refreshPreview, delay);
  }

  /* ---------- les 3 styles côte à côte ---------- */
  const tiles = () => [...document.querySelectorAll('#tiles .tile')];
  function paintTiles() {
    for (const tile of tiles()) {
      tile.querySelector('.cmp-tag').textContent = t('preview.style', { n: tile.dataset.style });
      tile.classList.toggle('sel', Number(tile.dataset.style) === S.settings.style);
    }
  }
  function setGrid(on) {
    S.pv.grid = on;
    $('#cmp').hidden = on;
    $('#tiles').hidden = !on;
    $('#pv-grid').classList.toggle('on', on);
    $('#pv-grid').setAttribute('aria-pressed', String(on));
    paintTiles();
    if (S.pv.open) refreshPreview();
  }
  function showGridError(text) {
    const el = $('#tiles-err');
    el.hidden = !text;
    el.textContent = text || '';
  }
  async function refreshGrid(clip, token) {
    showGridError('');
    for (const tile of tiles()) tile.classList.remove('failed');
    for (const tile of tiles()) tile.classList.add('loading');
    const options = {};
    for (const k of OPTION_KEYS) options[k] = S.settings[k];
    const r = await window.api.preview({ file: clip.path, time: S.pv.time, options, grid: true, id: token });
    if (token !== S.pv.token || !S.pv.open || !S.pv.grid || r.cancelled) return;
    for (const tile of tiles()) tile.classList.remove('loading');
    if (r.ok) return void ($('#cmp-before').src = r.before);
    if (r.error === 'ffmpeg') {
      closePreview();
      openModal('#modal-ffmpeg');
    } else if (r.error === 'engine') {
      closePreview();
      openModal('#modal-engine');
    } else if (r.error === 'preset') {
      showGridError(t('toast.preset', { detail: r.detail || '' }));
    } else if (r.error !== 'busy') {
      showGridError(t(`err.${r.error === 'render' ? 'render' : 'extract'}`, { detail: r.detail || '' }));
    }
  }
  function onTile(d) {
    if (d.id !== S.pv.token || !S.pv.open || !S.pv.grid) return;
    const tile = document.querySelector(`#tiles .tile[data-style="${d.style}"]`);
    if (!tile) return;
    tile.classList.remove('loading');
    tile.classList.toggle('failed', !d.after);
    if (d.after) tile.querySelector('img').src = d.after;
  }

  async function refreshPreview() {
    const clip = S.inputs[S.pv.idx];
    if (!clip) return;
    const token = ++S.pv.token;
    if (S.pv.grid) return refreshGrid(clip, token);
    showLoader(true);
    const options = {};
    for (const k of OPTION_KEYS) options[k] = S.settings[k];
    const r = await window.api.preview({ file: clip.path, time: S.pv.time, options });
    if (token !== S.pv.token || !S.pv.open) return;
    if (r.cancelled) return;
    showLoader(false);
    if (r.ok) {
      showPreviewError('');
      $('#cmp-before').src = r.before;
      $('#cmp-after').src = r.after;
      gsap.fromTo('#cmp-after', { opacity: 0.35 }, { opacity: 1, duration: D(0.35) });
    } else if (r.error === 'ffmpeg') {
      closePreview();
      openModal('#modal-ffmpeg');
    } else if (r.error === 'engine') {
      closePreview();
      openModal('#modal-engine');
    } else if (r.error === 'preset') {
      showPreviewError(t('toast.preset', { detail: r.detail || '' }));
    } else if (r.error !== 'busy') {
      showPreviewError(t(`err.${r.error === 'render' ? 'render' : 'extract'}`, { detail: r.detail || '' }));
    }
  }

  async function loadPreviewClip(idx) {
    S.pv.idx = (idx + S.inputs.length) % S.inputs.length;
    const clip = S.inputs[S.pv.idx];
    $('#pv-name').textContent = clip.name;
    $('#pv-prev').hidden = $('#pv-next').hidden = S.inputs.length < 2;
    showPreviewError('');
    const info = await window.api.clipInfo(clip.path);
    if (!S.pv.open) return;
    const duration = info.ok ? info.duration : 0;
    S.pv.duration = duration;
    S.pv.time = duration * 0.4;
    const slider = $('#pv-slider');
    slider.max = Math.max(duration, 0.1);
    slider.value = S.pv.time;
    slider.dispatchEvent(new Event('input'));
    $('#pv-d').textContent = fmtTime(duration);
    refreshPreview();
  }

  function openPreview() {
    if (S.running) return toast(t('toast.busy'));
    if (!S.inputs.length) {
      shake($('#drop'));
      return toast(t('preview.noclip'));
    }
    if (!S.settings.ffmpegPath) return openModal('#modal-ffmpeg');
    if (!S.settings.enginePath) return openModal('#modal-engine');
    S.pv.open = true;
    document.body.classList.add('previewing');
    $('#preview').hidden = false;
    $('#btn-preview').classList.add('on');
    $('#cmp-before').removeAttribute('src');
    $('#cmp-after').removeAttribute('src');
    setSplit(50);
    gsap.fromTo('#preview', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: D(0.45), ease: 'power3.out' });
    loadPreviewClip(0);
  }

  function closePreview() {
    if (!S.pv.open) return;
    S.pv.open = false;
    S.pv.token++;
    if (S.pv.grid) {
      S.pv.grid = false;
      $('#cmp').hidden = false;
      $('#tiles').hidden = true;
      $('#pv-grid').classList.remove('on');
      $('#pv-grid').setAttribute('aria-pressed', 'false');
    }
    clearTimeout(S.pv.timer);
    document.body.classList.remove('previewing');
    $('#preview').hidden = true;
    $('#btn-preview').classList.remove('on');
    showLoader(false);
  }

  function bindPreview() {
    const cmp = $('#cmp');
    let dragging = false;
    const move = (e) => {
      const r = cmp.getBoundingClientRect();
      setSplit(((e.clientX - r.left) / r.width) * 100);
    };
    cmp.addEventListener('pointerdown', (e) => {
      dragging = true;
      cmp.setPointerCapture(e.pointerId);
      move(e);
    });
    cmp.addEventListener('pointermove', (e) => dragging && move(e));
    cmp.addEventListener('pointerup', () => (dragging = false));
    $('#cmp-handle').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') setSplit((S.pv.split ?? 50) - 3);
      else if (e.key === 'ArrowRight') setSplit((S.pv.split ?? 50) + 3);
    });
    $('#pv-slider').addEventListener('input', (e) => {
      S.pv.time = Number(e.target.value);
      e.target.style.setProperty('--p', `${(S.pv.time / Math.max(Number(e.target.max), 0.1)) * 100}%`);
      $('#pv-t').textContent = fmtTime(S.pv.time);
    });
    $('#pv-slider').addEventListener('change', () => schedulePreview(150));
    $('#pv-back').addEventListener('click', closePreview);
    $('#pv-grid').addEventListener('click', () => setGrid(!S.pv.grid));
    window.api.onPreviewTile(onTile);
    for (const tile of tiles()) {
      tile.addEventListener('click', () => {
        const n = tile.dataset.style;
        setGrid(false);
        $(`#style [data-v="${n}"]`).click();
      });
    }
    $('#pv-prev').addEventListener('click', () => loadPreviewClip(S.pv.idx - 1));
    $('#pv-next').addEventListener('click', () => loadPreviewClip(S.pv.idx + 1));
  }

  /* ---------- file d'attente ---------- */
  function setCompact(on) {
    const d = $('#drop');
    const title = $('#drop-title');
    title.dataset.i18nHtml = on ? 'drop.more' : 'drop.title';
    title.innerHTML = t(title.dataset.i18nHtml);
    if (d.classList.contains('compact') === on) return;
    const h0 = d.offsetHeight;
    d.classList.toggle('compact', on);
    const h1 = d.offsetHeight;
    if (on) gsap.fromTo(d, { height: h0 }, { height: h1, duration: D(0.5), ease: 'power3.inOut', clearProps: 'height' });
    else gsap.fromTo(d, { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: D(0.45), ease: 'power3.out', clearProps: 'all' });
  }

  function makeCard(it) {
    const li = document.createElement('li');
    li.className = 'job spot';
    li.dataset.state = it.state;
    li.innerHTML =
      `${ICON}<div class="job-title"><span class="job-name"></span><span class="job-tag"></span></div>` +
      '<span class="job-state"></span>' +
      `<button class="icon sm open" data-i18n-tip="tip.open" data-i18n-aria="tip.open">${FOLDER_SVG}</button>` +
      `<button class="icon sm rm" data-i18n-tip="tip.remove" data-i18n-aria="tip.remove">${X_SVG}</button>` +
      '<p class="job-msg"></p><div class="track"><i></i></div>';
    li.querySelector('.job-name').textContent = it.name;
    li.querySelector('.job-tag').textContent = it.tag || '';
    li.querySelector('.open').addEventListener('click', () => window.api.openFolder(it.outDir));
    li.querySelector('.rm').addEventListener('click', () => removeItem(it.key));
    window.I18N.apply(li);
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
    if (S.pv.open) {
      if (!S.inputs.length) closePreview();
      else loadPreviewClip(clamp(S.pv.idx, 0, S.inputs.length - 1));
    }
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

  function cardMessage(it) {
    if (it.code) return t(`err.${it.code}`, it.params || {});
    return it.message || '';
  }

  function paintCard(it) {
    const li = cards.get(it.key);
    if (!li) return;
    const was = li.dataset.state;
    li.dataset.state = it.state;
    let label = t(`state.${it.state}`);
    if (it.state === 'running') {
      if (it.phase === 'finish') label = t('state.finish');
      else if (it.phase === 'fit') label = t('state.fit');
      else if (it.progress != null) label += ` · ${Math.round(it.progress)}%`;
    }
    li.querySelector('.job-state').textContent = label;
    const msg = li.querySelector('.job-msg');
    msg.textContent = cardMessage(it);
    msg.title = msg.textContent;

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
    it.code = ev.code || null;
    it.params = ev.params || null;
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
    if (skipped) toast(skipped === 1 ? t('toast.ignored1') : t('toast.ignoredN', { n: skipped }));
    if (added || S.view === 'jobs') buildInputs();
  }

  /* ---------- lancement ---------- */
  function setRunButton() {
    const b = $('#btn-run');
    b.textContent = t(S.running ? 'cancel' : 'run');
    b.classList.toggle('stop', S.running);
    document.body.classList.toggle('running', S.running);
    $('#btn-clear').hidden = S.running || !S.items.length;
    updateVF();
  }

  async function run() {
    gsap.fromTo('#btn-run', { scale: 0.94 }, { scale: 1, duration: D(0.45), ease: 'back.out(3)' });
    if (S.running) return window.api.cancel();
    if (!S.inputs.length) {
      shake($('#drop'));
      return toast(t('toast.addClip'));
    }
    const options = {};
    for (const k of OPTION_KEYS) options[k] = S.settings[k];
    const res = await window.api.start({ files: S.inputs.map((f) => f.path), options });
    if (!res.ok) {
      if (res.error === 'engine') openModal('#modal-engine');
      else if (res.error === 'ffmpeg') openModal('#modal-ffmpeg');
      else if (res.error === 'busy') toast(t('toast.busy'));
      else if (res.error === 'preset') toast(t('toast.preset', { detail: res.detail || '' }));
      else toast(t('toast.noValid'));
      return;
    }
    closePreview();
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
    startRec();
    renderQueue();
    for (const ev of early.splice(0)) {
      const it = S.items.find((i) => i.key === ev.id);
      if (it) applyEvent(it, ev);
    }
  }

  /* ---------- branchements ---------- */
  function bind() {
    bindTips();
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.spot');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
    bindPreview();

    for (const id of ['strength', 'tone', 'structure', 'skin']) {
      const el = $(`#${id}`);
      el.addEventListener('input', () => {
        paintRange(el);
        save({ [id]: Number(el.value) });
        onParamChange();
      });
    }
    $('#automask').addEventListener('change', (e) => {
      save({ autoMask: e.target.checked });
      onParamChange();
    });
    $('#maxsize').addEventListener('change', (e) => {
      const n = Math.max(0, Math.round(Number(e.target.value) || 0));
      e.target.value = n || '';
      save({ maxSize: n });
      if (n && !S.settings.ffmpegPath) openModal('#modal-ffmpeg');
    });
    $('#compare').addEventListener('change', (e) => save({ compare: e.target.checked }));
    $('#tiktok').addEventListener('change', (e) => {
      save({ tiktok: e.target.checked });
      if (e.target.checked && !S.settings.ffmpegPath) openModal('#modal-ffmpeg');
    });
    for (const [sel, key, cast] of [['#style', 'style', Number], ['#passes', 'passes', Number], ['#quality', 'quality', String]]) {
      $(sel).addEventListener('click', (e) => {
        const b = e.target.closest('button[data-v]');
        if (!b) return;
        save({ [key]: cast(b.dataset.v) });
        setSeg(sel, b.dataset.v, true);
        onParamChange({ skipPreview: sel === '#style' && S.pv.grid }); // les trois styles sont déjà affichés
      });
    }
    $('#lang').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (b) setLang(b.dataset.v, true);
    });

    $('#preset-sel').addEventListener('change', (e) => {
      const p = allPresets().find((x) => x.id === e.target.value);
      if (p) {
        save({ activePreset: p.id });
        applyValues(p.values);
        syncPresetUI();
      }
    });
    $('#preset-save').addEventListener('click', () => {
      const form = $('#preset-form');
      form.hidden = !form.hidden;
      if (!form.hidden) $('#preset-name').focus();
    });
    $('#preset-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (savePreset($('#preset-name').value)) {
        $('#preset-name').value = '';
        $('#preset-form').hidden = true;
      }
    });
    $('#preset-del').addEventListener('click', deletePreset);

    $('#btn-run').addEventListener('click', run);
    $('#btn-adv').addEventListener('click', () => toggleAdv());
    $('#btn-preview').addEventListener('click', () => (S.pv.open ? closePreview() : openPreview()));
    $('#btn-info').addEventListener('click', () => openModal('#modal-info'));
    $('#btn-update').addEventListener('click', installUpdate);
    $('#check-updates').addEventListener('change', (e) => save({ checkUpdates: e.target.checked }));
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
        else if (S.pv.open) closePreview();
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
      stopRec();
      if (cancelled) toast(t('toast.cancelled'));
      else if (S.items.length && S.items.every((i) => i.state === 'done')) toast(t('toast.done'));
      else if (S.items.some((i) => i.state === 'error')) toast(t('toast.someFailed'));
    });
  }

  // Découpe un titre en mots (en gardant les <em>) pour les faire apparaître un à un, comme sur morpheen.dev.
  function splitWords(el) {
    const walk = (node) => {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const part of n.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) {
              frag.append(part);
            } else {
              const w = document.createElement('span');
              w.className = 'w';
              w.style.display = 'inline-block';
              w.textContent = part;
              frag.append(w);
            }
          }
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      }
    };
    walk(el);
    return el.querySelectorAll('.w');
  }

  function intro() {
    gsap.set('#toast', { xPercent: -50 });
    gsap.set('#app', { autoAlpha: 1 });
    const title = $('#drop-title');
    const words = splitWords(title);
    const loader = $('#loader');
    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => (title.innerHTML = t(title.dataset.i18nHtml)),
    });
    if (reduce) {
      loader.style.display = 'none';
    } else {
      const c = { f: 0 };
      tl.to(c, {
        f: 24,
        duration: 0.7,
        ease: 'power1.inOut',
        onUpdate: () => {
          $('#ld-tc').textContent = tc((c.f / 24) * 1000);
          $('#ld-bar').style.transform = `scaleX(${c.f / 24})`;
        },
      })
        .addLabel('open', '+=0.05')
        .to('#loader .shutter.top', { yPercent: -101, duration: 0.9, ease: 'expo.inOut' }, 'open')
        .to('#loader .shutter.bot', { yPercent: 101, duration: 0.9, ease: 'expo.inOut' }, 'open')
        .to('.ld-inner', { opacity: 0, duration: 0.25 }, 'open')
        .add(() => (loader.style.display = 'none'));
    }
    const at = reduce ? 0 : 'open+=0.3';
    tl.from('.nav', { y: -40, opacity: 0, duration: D(0.8) }, at)
      .from('#drop', { y: 22, opacity: 0, scale: 0.985, duration: D(0.8) }, '<0.1')
      .from('.vf', { opacity: 0, duration: D(0.9) }, '<0.2')
      .from('.drop-core', { scale: 0.6, opacity: 0, duration: D(0.9), ease: 'back.out(1.6)' }, '<0.1')
      .from(words, { yPercent: 60, opacity: 0, stagger: D(0.07), duration: D(0.8) }, '-=0.5')
      .from('.drop-sub', { opacity: 0, y: 10, duration: D(0.6) }, '-=0.4')
      .from('.dockwrap', { y: 34, opacity: 0, duration: D(0.7) }, '-=0.7');
    if (!reduce) gsap.to('.drop-core', { y: -5, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2 });
  }

  async function init() {
    try {
      const b = await window.api.boot();
      S.settings = b.settings;
      S.defaultOut = b.defaultOutputDir;
      S.exts = new Set(b.exts);
      window.I18N.lang = S.settings.lang;
      window.I18N.apply();
      bind();
      sync();
      updateVF();
      $('#adv').inert = true;
      intro();
      setRunButton();
      requestAnimationFrame(refreshSegs);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshSegs);
      if (S.settings.advancedOpen) setTimeout(() => toggleAdv(true), D(500));
      if (!S.settings.enginePath) setTimeout(() => openModal('#modal-engine'), D(800));
      setTimeout(checkUpdate, D(1500));
    } catch (err) {
      console.error(err);
      $('#app').style.visibility = 'visible';
    }
  }

  init();
})();
