# Valorant DLSS

**English** · [Français](README.fr.md)

[![build](https://github.com/nildontsleep/val-dlss/actions/workflows/build.yml/badge.svg)](https://github.com/nildontsleep/val-dlss/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-5e9cff.svg)](LICENSE)
![Platform: Windows](https://img.shields.io/badge/platform-Windows%2011-5e9cff.svg)

A **local**, **Windows-only**, deliberately minimal app that applies Neural Rendering to your Valorant clips: drop a clip, pick a style, run. English by default, French one click away.

It is a friendly front-end for the Neural Rendering engine of [Visual Enhancer](https://github.com/Merserk/dlss5-visual-enhancer) by Merserk. It does **not** contain the engine or any NVIDIA file: it drives the Visual Enhancer installed on your machine. The installer also ships FFmpeg, so you don't have to fetch it.

![Home screen](docs/screenshots/home.png)

## Features

- **Drop and run**: drag clips in, choose a style (0, 1 or 2) and a strength, hit Run.
- **Compare**: one export per style, in separate subfolders.
- **Preview one frame** (👁): original vs result with a draggable divider and a timeline scrubber; it refreshes as you change settings.
- **Advanced settings and presets** (⚙): Tone, Detail, Skin, Passes, Auto mask and encode quality, plus your own saved presets.
- **TikTok quality method** by **paschafps**: rewrites timestamps without re-encoding, for 60, 120 or 240 fps clips.
- **English and French** (EN | FR switch, remembered).
- **100% local**: no network calls, no telemetry, no account.

| Running | Advanced settings |
| --- | --- |
| ![Renders as timeline clips](docs/screenshots/running.png) | ![Advanced settings and presets](docs/screenshots/advanced.png) |

*Screenshots are taken with a simulated engine; the preview scene in the advanced screenshot is a synthetic image, not a real render.*

## Requirements

- Windows 11 (64-bit).
- An NVIDIA GeForce RTX GPU supported by Visual Enhancer's Neural Rendering (see its README for the details).
- [Visual Enhancer](https://github.com/Merserk/dlss5-visual-enhancer/releases): download and extract the ZIP.
- [FFmpeg](https://ffmpeg.org/download.html) (`ffmpeg.exe`): needed for the preview and the TikTok method. **Included in the installer**; only the portable version needs you to provide it.

## Install

1. Download from the [Releases](../../releases) page:
   - **`Valorant-DLSS-Setup-x.y.z.exe`** (recommended): installer, FFmpeg included. Per-user install, no admin rights needed, shortcuts created.
   - `Valorant-DLSS-x.y.z-portable.exe`: nothing to install, smaller; you provide `ffmpeg.exe` yourself.
2. Download and extract [Visual Enhancer](https://github.com/Merserk/dlss5-visual-enhancer/releases) separately. It is **not** bundled, on purpose: its license does not allow redistributing it without its author's written permission, and it relies on NVIDIA components that must not be repackaged.
3. Launch the app. It looks for Visual Enhancer (Downloads, Desktop, Documents) and, with the portable version, for `ffmpeg.exe` (Visual Enhancer's folder, then your `PATH`). If it can't find something, it asks you once.
4. Drop a clip and press **Run**. Exports land in `Videos\Valorant DLSS`.

> **Windows SmartScreen / antivirus.** The executable is not code-signed, so SmartScreen may warn you ("More info" → "Run anyway"), and some antivirus tools may flag unsigned Electron apps. The code is public and the release is built by [GitHub Actions](https://github.com/nildontsleep/val-dlss/actions) from this repository; you can also build it yourself (see [Development](#development)).

Your settings live in `%APPDATA%\Valorant DLSS\settings.json`; temporary preview files in `%TEMP%\valorant-dlss` (deleted on exit).

## How the settings work

| Setting | Effect |
| --- | --- |
| Style 0 / 1 / 2 | The engine's three renders |
| Strength | Effect strength (0 to 2) |
| Compare | One export per style |
| TikTok | The TikTok quality method (below) |
| Tone · Detail · Skin | Visual Enhancer's *local tone*, *local structure* and *skin structure* strengths (0 to 1) |
| Passes | How many times the neural pass is applied (1 to 3) |
| Auto mask | The engine's automatic mask (off by default in Visual Enhancer) |
| Quality | Encoding quality of the exported file |

Advanced values are sent to Visual Enhancer through a preset file the app writes in the engine's own format, and validated with `--dry-run` before every run: a rejected preset is reported instead of silently ignored. If your Visual Enhancer is older and refuses the newest preset `schema_version`, the app falls back to older ones. The preset is only written when a value differs from Visual Enhancer's defaults.

**Preview.** The preview extracts one frame with FFmpeg and renders it through Visual Enhancer's *image* pipeline. One frame has no motion (no optical flow), so the final video can differ slightly.

### TikTok quality method

Equivalent of `paschafps_TikTok_Quality_Method_v2.bat`: after the render, FFmpeg rewrites the timestamps of the clip **without re-encoding** (`-itsscale`, streams copied) for **60, 120 or 240 fps** clips (×2, ×6, ×12). The fps are detected automatically.

- The resulting `_tiktok.mp4` is **slowed down** (×2, ×6 or ×12): it is not a file to watch as is.
- If the fps is not 60, 120 or 240, or FFmpeg fails, the Neural Rendering output is kept as is and the app says so.
- The effect of this method on TikTok's quality has not been measured here; the app reproduces the script's command, nothing more. Turn "TikTok" off for a normal-speed file.

## Support policy

This is a free side project maintained by one person. To keep it sustainable:

- **Everything goes through GitHub issues.** Bugs, questions, feature requests, translations: [open an issue](../../issues/new/choose) and pick the matching template. Search existing issues first.
- **No support on Discord** (DMs, servers, friend requests), **except for major bugs.** Even then, please open an issue so it is tracked and others can find the answer.

**What counts as a major bug**

- The app does not start, or crashes right at launch, on a normal Windows 11 install.
- Every render fails even though Visual Enhancer and FFmpeg work fine on their own.
- The app overwrites, corrupts or deletes your original clips or other files.
- The app freezes your computer, or leaves processes (`VE_CLI.exe`, `ffmpeg.exe`) running forever after you close it.
- A security problem. For this one, **do not** post it publicly: see [SECURITY.md](SECURITY.md).

**What is *not* a major bug** (use an issue, no Discord please)

- Interface glitches, wrong or missing translations, small layout problems.
- Feature requests and "it would be nice if…".
- "How do I…?" questions, or the quality of a render, or how the TikTok method behaves on TikTok.
- Problems that come from Visual Enhancer itself (crashes in its render, unsupported GPU, model results): report them in [its repository](https://github.com/Merserk/dlss5-visual-enhancer/issues).
- Problems with Valorant, Riot's Vanguard, or your drivers.

Issues are tagged with labels (`bug`, `major-bug`, `enhancement`, `question`, `i18n`, `ui`, `engine`…): see [Issue labels](#issue-labels). The full policy is in [SUPPORT.md](SUPPORT.md).

## Contributing

Contributions are very welcome: bug reports, feature ideas, translations, documentation, code. Read [CONTRIBUTING.md](CONTRIBUTING.md) first; it explains the setup, the project's philosophy (a minimal app, no options nobody will use, local-first) and the rules (for instance: never bundle Visual Enhancer or NVIDIA files, and FFmpeg only through the pinned download script). Issues labelled [`good first issue`](../../labels/good%20first%20issue) and [`help wanted`](../../labels/help%20wanted) are good places to start. By contributing you agree that your work is released under the [MIT License](LICENSE).

Please also read the [Code of Conduct](CODE_OF_CONDUCT.md).

## Issue labels

| Label | Meaning |
| --- | --- |
| `bug` | Something does not work as expected |
| `major-bug` | Crash at launch, every render failing, data loss… (see above) |
| `enhancement` | Feature request or improvement |
| `question` | Usage question |
| `documentation` | README, guides, tooltips |
| `i18n` | Translations and languages |
| `ui` | Interface and design |
| `engine` | Related to Visual Enhancer (upstream) |
| `tiktok-method` · `preview` · `advanced-settings` · `presets` · `performance` | Area of the app |
| `needs-triage` · `needs-info` | Waiting for review / for more details |
| `good first issue` · `help wanted` | Good places to contribute |
| `duplicate` · `invalid` · `wontfix` | Closed without action |

## Development

```bash
npm ci
npm test        # unit and engine tests (no GPU: a fake engine and a fake ffmpeg are used)
npm start       # run the app (Electron)
npm run dist    # portable executable in dist/portable/ (run on Windows)
npm run dist:installer   # NSIS installer in dist/installer/ (downloads and checks the pinned FFmpeg first)
```

Node.js 22 is used by CI. The tests need neither a GPU nor Windows.

CI ([`build.yml`](.github/workflows/build.yml)) tests and builds on `windows-latest`. To publish the executable as a Release, either push a `v*` tag (`git tag v0.4.0 && git push origin v0.4.0`) or run the **build** workflow manually from the *Actions* tab and fill in `release_tag` (for example `v0.4.0`).

## Disclaimers

- Independent fan project, **not affiliated with, sponsored or endorsed by** Riot Games, NVIDIA or Visual Enhancer. VALORANT, DLSS and RTX belong to their owners. "Valorant DLSS" is a working title.
- **Offline export only.** Do not run neural rendering during an online match: Riot's Vanguard anti-cheat does not like overlays or injection.
- Visual Enhancer exposes Neural Rendering through an NVIDIA model that is not a stable public API. How it works, and its legal status, are that project's business: read its license and NVIDIA's terms. This repository redistributes none of its files. The installer ships an unmodified LGPL build of FFmpeg, as a separate executable (see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).
- Provided "as is", without warranty (see the [MIT License](LICENSE)). Use at your own risk and keep a copy of your original clips.

## Credits

- Interface by **Morpheen**.
- TikTok quality method by **paschafps**.
- Engine: [Visual Enhancer](https://github.com/Merserk/dlss5-visual-enhancer) by Merserk.
- Visual design inspired by [morpheen.dev](https://morpheen.dev).
- Third-party components: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

[MIT](LICENSE) © 2026 Morpheen.
