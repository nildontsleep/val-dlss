# Valorant DLSS

A **local**, **Windows-only**, deliberately minimal app that applies Neural Rendering to your Valorant clips: drop a clip, pick a style, run. English by default, French one click away (EN | FR, top right).

Interface by **Morpheen**. TikTok quality method by **paschafps**. Engine: [Visual Enhancer](https://github.com/Merserk/dlss5-visual-enhancer) by Merserk.

## Use it

Valorant DLSS ships **neither the engine nor ffmpeg**: it drives the ones on your machine.

1. Download and extract [Visual Enhancer](https://github.com/Merserk/dlss5-visual-enhancer/releases).
2. Download `Valorant-DLSS-x.y.z.exe` from this repo's [Releases](../../releases) and run it (portable).
3. The app looks for Visual Enhancer (Downloads, Desktop, Documents) and `ffmpeg.exe` (Visual Enhancer's folder, then `PATH`) by itself. Otherwise it asks you once.
4. Drop a clip, **Run**. Exports land in `Videos\Valorant DLSS`.

Everything stays on your machine: no network, no telemetry.

## Settings

| Setting | Effect |
| --- | --- |
| Style 0 / 1 / 2 | The engine's three renders |
| Strength | Effect strength (0 to 2) |
| Compare | One export per style, in subfolders |
| TikTok | The TikTok quality method (below) |
| 👁 Preview | Renders **one frame** (original vs result, draggable divider) and refreshes as you change settings |
| ⚙ Advanced | Tone, Detail, Skin, Passes, Auto mask, encode Quality, and presets |

Hover a setting for its tooltip.

### Advanced and presets

Tone, Detail and Skin map to Visual Enhancer's *local tone strength*, *local structure strength* and *skin structure strength*; Passes to *NR passes*; Auto mask to *automatic mask*. They are passed through a preset file that the app writes in Visual Enhancer's own format (read from its source, `Settings::importPreset`) and checks with `--dry-run` before every run, so a rejected preset is reported instead of silently ignored. If your Visual Enhancer is older and refuses the newest `schema_version`, the app falls back to older ones. The preset is only written when a value differs from Visual Enhancer's defaults.

Presets are your own saved combinations of style, strength and these settings (stored locally). A small dot on the ⚙ button tells you when advanced values are not the defaults.

### Preview

The preview extracts one frame with ffmpeg and renders it through Visual Enhancer's *image* pipeline. A single frame has no motion (no optical flow), so the final video can differ slightly. The slider picks the frame; it needs ffmpeg.

### TikTok quality method

Equivalent of `paschafps_TikTok_Quality_Method_v2.bat`: after the render, ffmpeg rewrites the clip's timestamps **without re-encoding** (`-itsscale`, streams copied) for **60, 120 or 240 fps** clips (×2, ×6, ×12). fps are detected automatically.

- The resulting `_tiktok.mp4` is **slowed down** (×2, ×6 or ×12): it is not a file to watch as is.
- If the fps is not 60, 120 or 240, or ffmpeg fails, the Neural Rendering output is kept as is and the app says so.
- I did not measure this method's effect on TikTok's quality; the app reproduces the script's command, nothing more. Turn "TikTok" off for a normal-speed file.

## Development

```bash
npm ci
npm test        # unit and engine tests (no GPU: fake engine and ffmpeg)
npm start       # run the app (Electron)
npm run dist    # Windows portable in dist/ (run on Windows)
```

CI (`.github/workflows/build.yml`) tests and builds on `windows-latest`. Pushing a `v*` tag publishes the executable as a Release:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

## Disclaimers

- Independent project, **not affiliated** with Riot Games, NVIDIA or Visual Enhancer. VALORANT, DLSS and RTX belong to their owners. "Valorant DLSS" is a working title: change it before any public release.
- Offline export only. Don't run neural rendering during an online match: the Vanguard anti-cheat dislikes overlays and injections.
- Visual Enhancer exposes Neural Rendering through an NVIDIA model that is not a stable public API yet; how it works and its legal status are that project's business, not this one's. This repo redistributes none of its files, nor ffmpeg.
- Look inspired by morpheen.dev. Animations: [GSAP](https://gsap.com). Fonts: [Inter](https://rsms.me/inter/), [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL OFL). All bundled locally.

---

## Français

App **locale**, **Windows uniquement** et minimale pour appliquer le Neural Rendering à tes clips Valorant. L'anglais est la langue par défaut ; passe en français avec le sélecteur **EN | FR** en haut à droite (le choix est mémorisé).

- **Utilisation** : télécharge Visual Enhancer et lance `Valorant-DLSS-x.y.z.exe` (portable). L'app trouve seule Visual Enhancer et ffmpeg, sinon elle te les demande une fois.
- **Aperçu 👁** : rend **une seule frame** (original / résultat avec curseur) et se met à jour quand tu changes un réglage. Une frame n'a pas de mouvement : la vidéo finale peut légèrement différer.
- **Avancé ⚙** : Tonalité, Détails, Peau, Passes, Masque auto, Qualité d'encodage, et **presets** (tes combinaisons enregistrées). Ces réglages passent par un preset au format de Visual Enhancer, validé par `--dry-run` avant chaque rendu.
- **TikTok** : méthode qualité de paschafps (`-itsscale` ×2/×6/×12 pour 60/120/240 fps, sans ré-encodage). Le fichier `_tiktok.mp4` est **ralenti**. Je n'ai pas mesuré son effet sur la qualité côté TikTok.
- **Avertissements** : projet non affilié à Riot Games, NVIDIA ni Visual Enhancer ; export hors ligne uniquement (Vanguard) ; ce dépôt ne redistribue ni le moteur ni ffmpeg.
