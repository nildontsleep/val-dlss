# Rendering is slow

[Home](Home) · 🇬🇧 English · [🇫🇷 Français](#français)

## English

Neural Rendering is heavy and the speed depends on your GPU, the clip length and its resolution. What makes it slower:

- **Compare** runs three renders (one per style) at once.
- More **Passes**, and **Quality** *Max*.
- Long clips and high resolutions or frame rates (120 / 240 fps clips contain a lot of frames).
- **Max size** adds a re-encode at the end.

Tips: test a short clip with the **preview** first, render one style rather than Compare, and close other GPU-heavy apps (games, browsers playing video). Speed itself is Visual Enhancer's; the app only shows its progress.

## Français

**Le rendu est lent**

Le Neural Rendering est lourd et la vitesse dépend de ta carte, de la durée du clip et de sa résolution. Ce qui ralentit :

- **Comparer** lance trois rendus (un par style) en même temps.
- Plus de **Passes**, et **Quality** *Max*.
- Les clips longs, les hautes résolutions et fréquences d'images (les clips 120 / 240 fps contiennent beaucoup de frames).
- **Max size** ajoute un ré-encodage à la fin.

Conseils : teste un clip court avec l'**aperçu** d'abord, rends un style plutôt que Comparer, et ferme les autres applis qui sollicitent le GPU (jeux, navigateurs qui lisent de la vidéo). La vitesse elle-même est celle de Visual Enhancer ; l'app n'affiche que sa progression.
