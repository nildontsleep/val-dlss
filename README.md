# Valorant DLSS

Une interface épurée, **locale** et **Windows uniquement** pour appliquer le *Neural Rendering* sur tes clips Valorant : tu déposes un clip, tu règles quelques curseurs, tu lances.

Interface par **Morpheen**. Moteur : [Visual Enhancer](https://github.com/Merserk/dlss5-visual-enhancer) par Merserk.

## Comment ça marche

Valorant DLSS ne contient **pas** le moteur de rendu : il pilote `VE_CLI.exe` de Visual Enhancer, installé à côté.

1. Télécharge et extrais [Visual Enhancer](https://github.com/Merserk/dlss5-visual-enhancer/releases).
2. Télécharge `Valorant-DLSS-x.y.z.exe` depuis la page [Releases](../../releases) de ce dépôt et lance-le (version portable, rien à installer).
3. Au premier lancement, l'app cherche Visual Enhancer dans Téléchargements, Bureau et Documents. Sinon, choisis son dossier.
4. Dépose un clip, règle, **Lancer**. Les exports sortent dans `Vidéos\Valorant DLSS`.

Tout se passe sur ta machine : aucun réseau, aucune télémétrie.

## Réglages

| Réglage | Effet |
| --- | --- |
| Style 0 / 1 / 2 | Les trois rendus du moteur |
| Intensité | Force de l'effet (0 à 2) |
| Comparer | Un export par style, rangés dans des sous-dossiers |
| Tonalité, Détails, Protection auto | « Réglages fins », voir ci-dessous |

Passe la souris sur un réglage pour voir son infobulle. Qualité, codec, conteneur et exports en parallèle sont dans les réglages (icône en haut à droite).

### Réglages fins

La CLI de Visual Enhancer n'expose que le style et l'intensité. Tonalité, Détails et Protection auto passent par un **preset** exporté depuis l'app Visual Enhancer (avec seulement *Neural Rendering* activé) : importe-le une fois dans les réglages. Valorant DLSS retrouve les clés correspondantes dans le JSON ; si aucune n'est reconnue, l'app te le dit. Le format de ce preset n'est pas documenté, c'est la partie la plus fragile.

## Développement

```bash
npm ci
npm test        # tests unitaires et moteur (sans GPU, avec une fausse CLI)
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
- Visual Enhancer expose le Neural Rendering via un modèle NVIDIA qui n'est pas encore une API publique stable ; son fonctionnement et sa légalité relèvent de ce projet, pas de celui-ci. Ce dépôt ne redistribue aucun de ses fichiers.
- Les animations utilisent [GSAP](https://gsap.com), embarqué localement.
