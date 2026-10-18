# Valorant DLSS

Une app **locale**, **Windows uniquement** et volontairement minimale pour appliquer le *Neural Rendering* sur tes clips Valorant : tu déposes un clip, tu choisis un style, tu lances.

Interface par **Morpheen**. Méthode qualité TikTok par **paschafps**. Moteur : [Visual Enhancer](https://github.com/Merserk/dlss5-visual-enhancer) par Merserk.

## Utilisation

Valorant DLSS ne contient **ni le moteur ni ffmpeg** : il pilote ceux de ta machine.

1. Télécharge et extrais [Visual Enhancer](https://github.com/Merserk/dlss5-visual-enhancer/releases).
2. Télécharge `Valorant-DLSS-x.y.z.exe` depuis les [Releases](../../releases) de ce dépôt et lance-le (version portable).
3. L'app cherche seule Visual Enhancer (Téléchargements, Bureau, Documents) et `ffmpeg.exe` (dossier de Visual Enhancer, puis `PATH`). Sinon, elle te demande de les indiquer, une seule fois.
4. Dépose un clip, **Lancer**. Les exports sortent dans `Vidéos\Valorant DLSS`.

Tout reste sur ta machine : aucun réseau, aucune télémétrie.

## Les réglages

| Réglage | Effet |
| --- | --- |
| Style 0 / 1 / 2 | Les trois rendus du moteur |
| Intensité | Force de l'effet (0 à 2) |
| Comparer | Un export par style, rangés dans des sous-dossiers |
| TikTok | Applique la méthode qualité TikTok (voir ci-dessous) |

Les exports sont en H.264/MP4, qualité « very high » de Visual Enhancer. Passe la souris sur un réglage pour voir son infobulle.

### Méthode qualité TikTok

Équivalent de `paschafps_TikTok_Quality_Method_v2.bat` : après le rendu, ffmpeg réécrit les timestamps du clip **sans ré-encoder** (`-itsscale`, flux copiés) pour des clips en **60, 120 ou 240 fps** (×2, ×6, ×12). Les fps sont détectés automatiquement.

- Le fichier `_tiktok.mp4` obtenu est **ralenti** (×2, ×6 ou ×12) : ce n'est pas un clip à regarder tel quel.
- Si les fps ne sont pas 60, 120 ou 240, ou si ffmpeg échoue, le rendu Neural Rendering est conservé tel quel et l'app l'indique.
- Je n'ai pas mesuré l'effet de cette méthode sur la qualité vue par TikTok ; l'app reproduit la commande du script, c'est tout. Désactive « TikTok » pour obtenir le rendu normal.

## Développement

```bash
npm ci
npm test        # tests unitaires et moteur (sans GPU, avec de faux moteur et ffmpeg)
npm start       # lance l'app (Electron)
npm run dist    # portable Windows dans dist/ (à lancer sous Windows)
```

La CI (`.github/workflows/build.yml`) teste et construit sur `windows-latest`. Pousser un tag `v*` publie l'exécutable en Release :

```bash
git tag v0.1.0 && git push origin v0.1.0
```

## Avertissements

- Projet indépendant, **non affilié** à Riot Games, NVIDIA ni à Visual Enhancer. VALORANT, DLSS et RTX appartiennent à leurs propriétaires. Le nom « Valorant DLSS » est un titre de travail : change-le avant une diffusion publique.
- Export hors ligne uniquement. Ne lance pas de rendu neural pendant une partie en ligne : l'anticheat Vanguard n'apprécie pas les overlays ni les injections.
- Visual Enhancer expose le Neural Rendering via un modèle NVIDIA qui n'est pas encore une API publique stable ; son fonctionnement et sa légalité relèvent de ce projet, pas de celui-ci. Ce dépôt ne redistribue aucun de ses fichiers, ni ffmpeg.
- Animations : [GSAP](https://gsap.com). Police : [Inter](https://rsms.me/inter/) (SIL OFL). Les deux sont embarquées localement.
