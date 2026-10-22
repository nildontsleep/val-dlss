(function () {
  'use strict';
  var d = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // langue
  $$('.lang button').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-v');
      d.setAttribute('data-lang', v);
      d.setAttribute('lang', v);
      try { localStorage.setItem('vdlss-lang', v); } catch (e) { /* stockage indisponible */ }
    });
  });

  // apparition au défilement
  var items = $$('.reveal');
  if (!('IntersectionObserver' in window) || reduce) {
    items.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  // intro du hero
  var hero = $$('.reveal-hero');
  if (window.gsap && !reduce) {
    gsap.fromTo(hero, { opacity: 0, y: 22 }, {
      opacity: 1, y: 0, duration: 0.9, stagger: 0.09, ease: 'power3.out', delay: 0.1,
      onComplete: function () { hero.forEach(function (el) { el.classList.add('in'); el.style.opacity = ''; el.style.transform = ''; }); }
    });
  } else {
    hero.forEach(function (el) { el.classList.add('in'); });
  }
  // filet de sécurité : si l'animation n'a pas tourné (onglet en arrière-plan, GSAP bloqué), le hero apparaît quand même
  setTimeout(function () { hero.forEach(function (el) { el.classList.add('in'); el.style.opacity = ''; el.style.transform = ''; }); }, 2500);

  // timecode du viseur (24 images par seconde)
  var tc = document.getElementById('tc');
  if (tc && !reduce) {
    var t0 = performance.now();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    (function tick(now) {
      var f = Math.floor((now - t0) / (1000 / 24));
      tc.textContent = pad(Math.floor(f / 86400)) + ':' + pad(Math.floor(f / 1440) % 60) + ':' + pad(Math.floor(f / 24) % 60) + ':' + pad(f % 24);
      requestAnimationFrame(tick);
    })(t0);
  }

  // bouton de téléchargement : pointe directement sur l'installeur de la dernière release (sinon, la page des releases)
  var dl = $$('[data-dl]');
  if (dl.length && window.fetch) {
    fetch('https://api.github.com/repos/nildontsleep/val-dlss/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (rel) {
        var asset = (rel.assets || []).filter(function (a) { return /^Valorant-DLSS-Setup-[\w.-]+\.exe$/.test(a.name); })[0];
        var ok = asset && String(asset.browser_download_url).indexOf('https://github.com/nildontsleep/val-dlss/releases/download/') === 0;
        dl.forEach(function (a) {
          if (ok) a.href = asset.browser_download_url;
          var v = a.querySelector('b');
          if (v && rel.tag_name) v.textContent = rel.tag_name;
        });
      })
      .catch(function () { /* hors ligne ou limite de l'API : le lien vers la page des releases reste */ });
  }

  // recherche dans la FAQ
  var search = document.getElementById('faq-search');
  if (search) {
    var rows = $$('.faq-all li');
    var empty = document.getElementById('faq-empty');
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (li) {
        var hit = !q || li.getAttribute('data-text').indexOf(q) !== -1;
        li.hidden = !hit;
        if (hit) shown++;
      });
      $$('.faq-all section').forEach(function (s) {
        s.hidden = !$$('li', s).some(function (li) { return !li.hidden; });
      });
      if (empty) empty.hidden = shown !== 0;
    });
  }
})();
