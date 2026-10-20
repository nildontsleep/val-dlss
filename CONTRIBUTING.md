# Contributing · Contribuer

🇬🇧 **English** · 🇫🇷 [Français plus bas](#français)

## English

Thank you for wanting to help! Contributions of every size are welcome: bug reports, feature ideas, translations,
documentation, design feedback and code. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

### Ways to contribute

- **Report a bug or ask a question**: [open an issue](../../issues/new/choose) with the matching template. See
  [SUPPORT.md](SUPPORT.md) for what to include (and what belongs in the Visual Enhancer repository instead).
- **Suggest a feature**: open a *feature request*. Please explain the problem first, not only the solution.
- **Translate**: the app is English by default with French available. Adding a language is welcome (see
  [i18n](#i18n)).
- **Improve the docs**: README, tooltips, error messages. Both languages are kept in sync.
- **Write code**: pick an issue labelled [`good first issue`](../../labels/good%20first%20issue) or
  [`help wanted`](../../labels/help%20wanted), or comment on the issue you want to take so we don't duplicate work.
  For anything bigger than a small fix, **open an issue to discuss it before writing code.**

### Project philosophy

- **Minimal.** The app does a few things and hides the rest. A setting nobody will ever use does not belong here.
  Before proposing an option, ask: who will change it, and how often?
- **Local first.** No telemetry, no accounts, clips never leave the machine. The app talks to programs on the user's machine; the only network call is the optional update check at launch (`src/main/updater.js`, one GET to this repo's Releases API, off with one switch). Do not add others.
- **Honest.** The UI and docs must not claim more than we have verified. If something is a guess, say so.
- **Readable.** The look follows [morpheen.dev](https://morpheen.dev) (warm/blue near-black, serif italics, mono
  labels) but legibility comes first: contrast, sizes and clear labels.

### Hard rules

- **Never commit or bundle Visual Enhancer, NVIDIA files, DLLs or any third-party binary.** The app drives
  what the user installed. Pull requests that add such files will be closed. The one exception is FFmpeg in the
  installer: it is never committed, it is downloaded by `scripts/fetch-ffmpeg.js` from the exact build and SHA-256
  pinned in `scripts/ffmpeg.json` (an LGPL build, used as a separate executable). To update it, change that pin.
- Do not add code that injects into, hooks or overlays Valorant or any game process.
- Do not add dependencies lightly. Each one must be justified, and its license must be compatible with MIT.
- Keep third-party licenses up to date in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Development setup

You need Node.js 22. The tests need neither Windows nor a GPU.

```bash
git clone https://github.com/nildontsleep/val-dlss.git
cd val-dlss
npm ci
npm test        # unit + engine tests
npm start       # run the app (Electron)
npm run dist    # build the portable exe (on Windows)
npm run dist:installer   # build the installer, with the pinned FFmpeg (on Windows)
```

`npm start` and `npm run dist` first copy GSAP and the fonts into `src/renderer/vendor/` (`scripts/vendor.js`); that
folder is generated and git-ignored.

To try the app without Visual Enhancer, the tests use a **fake engine and a fake ffmpeg**
(`test/fake-cli.js`, `test/fake-ffmpeg.js`). They are a good model if you need to add behaviour that talks to the
real tools.

### Project layout

| Path | What |
| --- | --- |
| `src/main/` | Electron main process: IPC, settings, the engine runner (`engine.js`), the TikTok step (`tiktok.js`), the preview (`preview.js`), Visual Enhancer preset writing (`vepreset.js`), option validation (`args.js`) |
| `src/renderer/` | The interface: `index.html`, `styles.css`, `app.js`, `i18n.js` (dictionaries) |
| `test/` | `node --test` tests and the fake engine/ffmpeg |
| `scripts/vendor.js` | Copies GSAP and fonts from `node_modules` |
| `.github/` | CI, issue/PR templates, labels |

The renderer never talks to the system directly: everything goes through the `window.api` bridge in `src/main/preload.js`,
and every value that reaches a command line is validated in `src/main/args.js`.

### i18n

Texts live in `src/renderer/i18n.js`, in `en` and `fr`. Add every new string to **both** languages: a test fails if
the keys differ or if a key used in `index.html`/`app.js` does not exist. To add a language, add a dictionary with the
same keys, add it to the EN | FR switch (`index.html`, `LANGS` in `src/main/args.js`, `src/main/strings.js`) and mention it
in the README. Errors coming from the main process are *codes* (for example `fps_unsupported`) translated in the
renderer, never hard-coded sentences.

### Pull requests

1. Fork, create a branch from `main` (`fix/…`, `feat/…`, `docs/…`).
2. Keep the change focused. Match the surrounding code style (no formatter is enforced yet).
3. Add or update tests when you change logic in `src/main/`. `npm test` must pass.
4. If you change the UI, include a screenshot (and check the French version: it is often longer).
5. Update the README (EN and FR) and `THIRD_PARTY_NOTICES.md` if relevant.
6. Fill in the pull request template. CI will build the app on Windows.

Commit messages: a short imperative summary, then a few lines of *why* if it is not obvious.

### Licensing of contributions

By submitting a contribution you agree that it is released under the project's [MIT License](LICENSE) and that you have
the right to submit it.

### Maintainer notes

Releases: bump `version` in `package.json`, merge to `main`, then either `git tag vX.Y.Z && git push origin vX.Y.Z`, or run
the `build` workflow from the Actions tab with `release_tag` = `vX.Y.Z`. The workflow publishes the portable exe as a
GitHub Release. Labels are defined in `.github/labels.json` and synced
by the `labels` workflow.

## Français

Merci de vouloir aider ! Toutes les contributions sont les bienvenues : signalements de bugs, idées, traductions,
documentation, retours de design et code. Lis d'abord le [Code de conduite](CODE_OF_CONDUCT.md).

### Comment contribuer

- **Signaler un bug ou poser une question** : [ouvre une issue](../../issues/new/choose) avec le bon modèle. Voir
  [SUPPORT.md](SUPPORT.md) pour ce qu'il faut inclure (et ce qui relève plutôt du dépôt de Visual Enhancer).
- **Proposer une fonctionnalité** : ouvre une *feature request*. Explique d'abord le problème, pas seulement la solution.
- **Traduire** : l'app est en anglais par défaut, avec le français. Ajouter une langue est bienvenu (voir [i18n](#i18n-1)).
- **Améliorer la doc** : README, infobulles, messages d'erreur. Les deux langues sont maintenues en parallèle.
- **Écrire du code** : prends une issue [`good first issue`](../../labels/good%20first%20issue) ou
  [`help wanted`](../../labels/help%20wanted), ou commente celle que tu veux prendre pour éviter les doublons.
  Pour tout ce qui dépasse un petit correctif, **ouvre d'abord une issue pour en discuter avant d'écrire du code.**

### Philosophie du projet

- **Minimal.** L'app fait peu de choses et cache le reste. Un réglage que personne n'utilisera n'a pas sa place ici.
  Avant de proposer une option, demande-toi : qui va la changer, et à quelle fréquence ?
- **Local d'abord.** Aucune télémétrie, aucun compte, les clips ne quittent jamais la machine. L'app parle à des programmes
  présents sur la machine ; le seul appel réseau est la vérification de mise à jour optionnelle au lancement
  (`src/main/updater.js`, un GET vers l'API des Releases de ce dépôt, désactivable). N'en ajoute pas d'autres.
- **Honnête.** L'interface et la doc ne doivent pas affirmer plus que ce qui est vérifié. Une supposition doit être
  présentée comme telle.
- **Lisible.** Le style suit [morpheen.dev](https://morpheen.dev) (noir chaud/bleuté, italiques serif, étiquettes mono)
  mais la lisibilité passe avant : contraste, tailles et libellés clairs.

### Règles strictes

- **Ne jamais commiter ni embarquer Visual Enhancer, des fichiers NVIDIA, des DLL ou tout binaire tiers.**
  L'app pilote ce que l'utilisateur a installé. Les pull requests qui ajoutent de tels fichiers seront fermées.
  Seule exception : FFmpeg dans l'installeur. Il n'est jamais commité, il est téléchargé par
  `scripts/fetch-ffmpeg.js` depuis la build exacte et le SHA-256 épinglés dans `scripts/ffmpeg.json` (build LGPL,
  utilisée comme exécutable séparé). Pour le mettre à jour, modifie cette épingle.
- N'ajoute aucun code qui s'injecte dans Valorant ou un autre jeu, s'y accroche ou s'y superpose.
- N'ajoute pas de dépendances à la légère : chacune doit être justifiée, avec une licence compatible MIT.
- Garde les licences tierces à jour dans [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Mise en place

Il faut Node.js 22. Les tests n'ont besoin ni de Windows ni d'un GPU.

```bash
git clone https://github.com/nildontsleep/val-dlss.git
cd val-dlss
npm ci
npm test        # tests unitaires + moteur
npm start       # lance l'app (Electron)
npm run dist    # construit l'exe portable (sous Windows)
npm run dist:installer   # construit l'installeur, avec le FFmpeg épinglé (sous Windows)
```

`npm start` et `npm run dist` copient d'abord GSAP et les polices dans `src/renderer/vendor/` (`scripts/vendor.js`) ;
ce dossier est généré et ignoré par git.

Pour essayer l'app sans Visual Enhancer, les tests utilisent un **faux moteur et un faux ffmpeg**
(`test/fake-cli.js`, `test/fake-ffmpeg.js`). Ils servent de modèle si tu dois ajouter un comportement qui parle aux
vrais outils.

### Organisation du projet

| Chemin | Contenu |
| --- | --- |
| `src/main/` | Processus principal Electron : IPC, réglages, lanceur du moteur (`engine.js`), étape TikTok (`tiktok.js`), aperçu (`preview.js`), écriture des presets Visual Enhancer (`vepreset.js`), validation des options (`args.js`) |
| `src/renderer/` | L'interface : `index.html`, `styles.css`, `app.js`, `i18n.js` (dictionnaires) |
| `test/` | Tests `node --test` et faux moteur/ffmpeg |
| `scripts/vendor.js` | Copie GSAP et les polices depuis `node_modules` |
| `.github/` | CI, modèles d'issues/PR, étiquettes |

Le rendu ne parle jamais directement au système : tout passe par le pont `window.api` de `src/main/preload.js`, et toute
valeur qui arrive sur une ligne de commande est validée dans `src/main/args.js`.

### i18n

Les textes sont dans `src/renderer/i18n.js`, en `en` et `fr`. Ajoute chaque nouveau texte dans les **deux** langues : un
test échoue si les clés diffèrent ou si une clé utilisée dans `index.html`/`app.js` n'existe pas. Pour ajouter une
langue, ajoute un dictionnaire avec les mêmes clés, ajoute-la au sélecteur (`index.html`, `LANGS` dans
`src/main/args.js`, `src/main/strings.js`) et mentionne-la dans le README. Les erreurs venant du processus principal sont
des *codes* (par exemple `fps_unsupported`) traduits côté rendu, jamais des phrases écrites en dur.

### Pull requests

1. Fork, crée une branche depuis `main` (`fix/…`, `feat/…`, `docs/…`).
2. Garde le changement ciblé. Respecte le style du code environnant (aucun formateur n'est imposé pour l'instant).
3. Ajoute ou mets à jour les tests quand tu changes la logique de `src/main/`. `npm test` doit passer.
4. Si tu changes l'interface, ajoute une capture (et vérifie la version française : elle est souvent plus longue).
5. Mets à jour le README (EN et FR) et `THIRD_PARTY_NOTICES.md` si nécessaire.
6. Remplis le modèle de pull request. La CI construira l'app sous Windows.

Messages de commit : un court résumé à l'impératif, puis quelques lignes sur le *pourquoi* si ce n'est pas évident.

### Licence des contributions

En proposant une contribution, tu acceptes qu'elle soit publiée sous la [licence MIT](LICENSE) du projet et tu confirmes
avoir le droit de la proposer.

### Notes pour le mainteneur

Releases : incrémenter `version` dans `package.json`, fusionner dans `main`, puis soit `git tag vX.Y.Z && git push origin vX.Y.Z`,
soit lancer le workflow `build` depuis l'onglet Actions avec `release_tag` = `vX.Y.Z`. Le workflow publie l'exe portable en
Release GitHub. Les étiquettes sont définies dans `.github/labels.json` et
synchronisées par le workflow `labels`.
