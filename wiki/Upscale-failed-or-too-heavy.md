# Upscale fails, is slow, or makes a huge file

[Home](Home) · 🇬🇧 English · [🇫🇷 Français](#français)

## English

**What it does.** **Upscale** (Advanced settings, off by default) enlarges the finished video **×2 or ×4** with Visual Enhancer's own `upscale` command. It runs **after** the neural render, then the size cap and the TikTok step apply to the upscaled file. The app does not choose the upscaler: it uses the engine's default.

- **"Visual Enhancer refused the upscale: …"** shows up **before** the render starts: the engine did not accept the request. Update Visual Enhancer and check its README for the GPUs its upscalers support (RTX 20, 30, 40 and 50 series). If the text comes from the engine, report it in [its repository](https://github.com/Merserk/dlss5-visual-enhancer/issues).
- **"Upscale failed (…). Neural render kept as is."**: the upscale step failed, but your neural render is **not lost**: it is in the output folder without the `_x2` / `_x4` suffix.
- **Huge file / out of memory**: ×4 of a 1080p clip is **8K** (7680 × 4320). Use ×2, or upscale shorter clips. Very large sizes may be refused by the encoder.
- **Slow**: it is a second full pass over the video, after the render.
- **Quality**: the clip is encoded twice (the render, then the upscale), and the upscale itself is the engine's. The effect of an upscale on what TikTok or Discord do afterwards has not been measured here. Turn it **off** if you only want the neural render.
- The **Max size** cap still applies after the upscale, with its 60 Mb/s quality floor: see [Max size says "kept as is"](Max-size-kept-as-is).

## Français

**Upscale (agrandissement) : échec, lenteur ou fichier énorme**

**Ce que ça fait.** **Upscale** (réglages avancés, désactivé par défaut) agrandit la vidéo terminée **×2 ou ×4** avec la commande `upscale` de Visual Enhancer. Il tourne **après** le rendu neural, puis le plafond de taille et l'étape TikTok s'appliquent au fichier agrandi. L'app ne choisit pas l'upscaler : elle utilise celui par défaut du moteur.

- **« Visual Enhancer a refusé l'upscale : … »** apparaît **avant** le début du rendu : le moteur n'a pas accepté la demande. Mets à jour Visual Enhancer et regarde dans son README les cartes gérées par ses upscalers (séries RTX 20, 30, 40 et 50). Si le texte vient du moteur, signale-le dans [son dépôt](https://github.com/Merserk/dlss5-visual-enhancer/issues).
- **« Échec de l'upscale (…). Rendu neural conservé tel quel. »** : l'étape d'upscale a échoué, mais ton rendu neural n'est **pas perdu** : il est dans le dossier de sortie, sans le suffixe `_x2` / `_x4`.
- **Fichier énorme / manque de mémoire** : ×4 sur un clip 1080p donne du **8K** (7680 × 4320). Utilise ×2, ou des clips plus courts. L'encodeur peut refuser de très grandes tailles.
- **Lent** : c'est une seconde passe complète sur la vidéo, après le rendu.
- **Qualité** : le clip est encodé deux fois (le rendu, puis l'upscale), et l'upscale lui-même est celui du moteur. L'effet d'un upscale sur ce que TikTok ou Discord font ensuite n'a pas été mesuré ici. Mets-le sur **Off** si tu veux seulement le rendu neural.
- Le plafond **Max size** s'applique toujours après l'upscale, avec son plancher de 60 Mb/s : voir [Max size dit « kept as is »](Max-size-kept-as-is).
