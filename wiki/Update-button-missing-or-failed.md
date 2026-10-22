# The "Update" button does not appear, or the update fails

[Home](Home) · 🇬🇧 English · [🇫🇷 Français](#français)

## English

- The update check exists **since version 0.5.0**. Older versions never show the button: update by hand from [Releases](https://github.com/nildontsleep/val-dlss/releases).
- It is **one request at launch**. Turn it on again in ⓘ → *Check for updates at launch*. No internet, a firewall or a GitHub hiccup just means no button this time.
- **Installer version**: the button downloads the new installer, checks its **SHA-256** against the one GitHub publishes, then starts it. If the check or the download fails, nothing is installed and the app says so; try again later or download the Setup yourself.
- **Portable version**: the button only **opens the Releases page**; replace the file by hand (an app cannot replace itself while it runs). Use the installer if you want automatic updates.
- "Wait for the render to finish": the update will not interrupt a render in progress.

## Français

**Le bouton « Update » n'apparaît pas, ou la mise à jour échoue**

- La vérification de mise à jour existe **depuis la version 0.5.0**. Les versions plus anciennes n'affichent jamais le bouton : mets à jour à la main depuis [Releases](https://github.com/nildontsleep/val-dlss/releases).
- C'est **une requête au lancement**. Réactive-la dans ⓘ → *Chercher les mises à jour au lancement*. Pas d'internet, un pare-feu ou un souci côté GitHub veut juste dire pas de bouton cette fois.
- **Version installée** : le bouton télécharge le nouvel installeur, vérifie son **SHA-256** par rapport à celui que GitHub publie, puis le lance. Si la vérification ou le téléchargement échoue, rien n'est installé et l'app te le dit ; réessaie plus tard ou télécharge le Setup toi-même.
- **Version portable** : le bouton **ouvre seulement la page Releases** ; remplace le fichier à la main (une app ne peut pas se remplacer pendant qu'elle tourne). Utilise l'installeur pour des mises à jour automatiques.
- « Attends la fin du rendu » : la mise à jour n'interrompt pas un rendu en cours.
