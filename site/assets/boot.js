// Chargé avant le rendu : choisit la langue (choix mémorisé, sinon celle du navigateur) et signale que le JavaScript tourne.
(function () {
  var d = document.documentElement;
  var lang = 'en';
  try {
    var saved = localStorage.getItem('vdlss-lang');
    if (saved === 'en' || saved === 'fr') lang = saved;
    else if (/^fr/i.test(navigator.language || '')) lang = 'fr';
  } catch (e) {
    if (/^fr/i.test(navigator.language || '')) lang = 'fr';
  }
  d.setAttribute('data-lang', lang);
  d.setAttribute('lang', lang);
  d.classList.add('js');
})();
