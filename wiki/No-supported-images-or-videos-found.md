# "No supported images or videos found"

[Home](Home) · 🇬🇧 English · [🇫🇷 Français](#français)

## English

**Why.** In versions up to **0.5.0**, with the TikTok method off, the render was written straight into the output folder. If that folder is the clip's own folder (for example `Downloads`), Visual Enhancer ignores the clip and answers this error.

**Fix.** Update to **0.5.1 or newer** ([Releases](https://github.com/nildontsleep/val-dlss/releases)). Renders now go through a hidden work folder first.

Still happening on 0.5.1+? The usual cause is then the file itself: the format is not one Visual Enhancer reads (it lists MP4, MKV, MOV, AVI, WebM, M4V, TS/MTS/M2TS, WMV and FLV), or the file is damaged. Try another clip, then [open an issue](https://github.com/nildontsleep/val-dlss/issues/new/choose) with the exact error text.

## Français

**« No supported images or videos found »**

**Pourquoi.** Jusqu'à la **0.5.0**, avec la méthode TikTok désactivée, le rendu était écrit directement dans le dossier de sortie. Si ce dossier est celui du clip (par exemple `Téléchargements`), Visual Enhancer ignore le clip et répond cette erreur.

**Solution.** Passe à la **0.5.1 ou plus récente** ([Releases](https://github.com/nildontsleep/val-dlss/releases)). Les rendus passent maintenant d'abord par un dossier de travail caché.

Ça arrive encore en 0.5.1+ ? La cause est alors le fichier : un format que Visual Enhancer ne lit pas (il liste MP4, MKV, MOV, AVI, WebM, M4V, TS/MTS/M2TS, WMV et FLV), ou un fichier abîmé. Essaie un autre clip, puis [ouvre une issue](https://github.com/nildontsleep/val-dlss/issues/new/choose) avec le texte exact de l'erreur.
