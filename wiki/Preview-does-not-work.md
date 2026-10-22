# The preview (👁) shows an error or nothing

[Home](Home) · 🇬🇧 English · [🇫🇷 Français](#français)

## English

The preview extracts **one frame with ffmpeg** and renders it with Visual Enhancer's image pipeline. It needs both, and it does not run while a render is in progress.

- "Could not read a frame from this clip": the clip is damaged or its format is unusual.
- Preview error mentioning the engine: see [Engine missing](Engine-not-found).
- ffmpeg message: see [ffmpeg is required](ffmpeg-is-required).
- "Visual Enhancer refused the advanced settings": see [Advanced settings refused](Advanced-settings-refused).
- A finished preview can still differ from the final video: one frame has **no motion** (no optical flow).

## Français

**L'aperçu (👁) affiche une erreur ou rien**

L'aperçu extrait **une frame avec ffmpeg** et la rend avec le pipeline image de Visual Enhancer. Il faut les deux, et il ne tourne pas pendant un rendu.

- « Impossible de lire une frame de ce clip » : le clip est abîmé ou son format est inhabituel.
- Erreur d'aperçu qui parle du moteur : voir [Engine missing](Engine-not-found).
- Message ffmpeg : voir [ffmpeg est nécessaire](ffmpeg-is-required).
- « Visual Enhancer a refusé les réglages avancés » : voir [Réglages avancés refusés](Advanced-settings-refused).
- Un aperçu réussi peut quand même différer de la vidéo finale : une frame n'a **pas de mouvement** (pas de flux optique).
