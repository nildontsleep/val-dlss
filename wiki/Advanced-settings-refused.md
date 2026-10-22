# "Your Visual Enhancer refused the advanced settings"

[Home](Home) · 🇬🇧 English · [🇫🇷 Français](#français)

## English

The app sends Tone, Detail, Skin, Passes and Auto mask to Visual Enhancer as a **preset file** in its own format, and checks it with `--dry-run` before every run. If your Visual Enhancer rejects it, the app tells you instead of silently ignoring your settings.

**Fix**
1. **Update Visual Enhancer** to its latest release (the preset format changes between versions; the app already falls back to older formats automatically).
2. Still refused? Put the Advanced settings back to their defaults (a preset named *Default*) and run again. If it works, one value is the problem.
3. [Open an issue](https://github.com/nildontsleep/val-dlss/issues/new/choose) with the text after the colon.

## Français

**« Ta version de Visual Enhancer a refusé les réglages avancés »**

L'app envoie Tone, Detail, Skin, Passes et Masque auto à Visual Enhancer sous forme de **fichier preset** dans son propre format, et le vérifie avec `--dry-run` avant chaque rendu. Si ton Visual Enhancer le rejette, l'app te le dit au lieu d'ignorer tes réglages en silence.

**Solution**
1. **Mets à jour Visual Enhancer** vers sa dernière release (le format de preset change d'une version à l'autre ; l'app essaie déjà automatiquement des formats plus anciens).
2. Toujours refusé ? Remets les réglages avancés par défaut (un preset nommé *Default*) et relance. Si ça marche, une valeur pose problème.
3. [Ouvre une issue](https://github.com/nildontsleep/val-dlss/issues/new/choose) avec le texte après les deux-points.
