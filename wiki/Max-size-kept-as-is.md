# Max size says "kept as is" or "could not fit"

[Home](Home) · 🇬🇧 English · [🇫🇷 Français](#français)

## English

**Max size** (Advanced settings) is a cap with a **quality floor of 60 Mb/s**:

- Render already under the cap → nothing happens.
- Over the cap, and fitting needs **60 Mb/s or more** → the video is re-encoded with your GPU (NVENC H.264, audio copied) to fit.
- Fitting would need **less than 60 Mb/s** → the render is **kept as is** and the card tells you how many Mb/s it would have needed. The app never lowers the quality below the floor to hit a number.

60 Mb/s is about 7.5 MB per second, so a 10 s clip is already ~75 MB: a 10 or 25 MB cap only works for very short clips. Raise the cap, or leave the field empty.

**"Could not fit the size cap (…)"**: the NVENC re-encode failed (typical: no NVENC-capable NVIDIA GPU, or an old driver; the detail often mentions `nvcuda.dll`). The render is kept as is. Update your NVIDIA driver; if it persists, [open an issue](https://github.com/nildontsleep/val-dlss/issues/new/choose) with the detail. The size is counted in decimal MB with a small safety margin.

## Français

**Max size dit « kept as is » ou « could not fit »**

**Max size** (réglages avancés) est un plafond avec un **plancher de qualité à 60 Mb/s** :

- Rendu déjà sous le plafond → rien ne se passe.
- Au-dessus du plafond, et tenir dedans demande **60 Mb/s ou plus** → la vidéo est ré-encodée avec ta carte graphique (H.264 NVENC, audio copié) pour tenir dedans.
- Tenir dedans demanderait **moins de 60 Mb/s** → le rendu est **gardé tel quel** et la carte t'indique combien de Mb/s il aurait fallu. L'app ne descend jamais sous le plancher pour atteindre un chiffre.

60 Mb/s font environ 7,5 Mo par seconde : un clip de 10 s pèse déjà ~75 Mo, donc un plafond de 10 ou 25 Mo ne marche que pour de très courts clips. Augmente le plafond, ou laisse le champ vide.

**« Could not fit the size cap (…) »** : le ré-encodage NVENC a échoué (typique : pas de carte NVIDIA avec NVENC, ou un vieux pilote ; le détail mentionne souvent `nvcuda.dll`). Le rendu est gardé tel quel. Mets à jour ton pilote NVIDIA ; si ça persiste, [ouvre une issue](https://github.com/nildontsleep/val-dlss/issues/new/choose) avec le détail. La taille est comptée en Mo décimaux avec une petite marge de sécurité.
