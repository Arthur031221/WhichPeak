<div align="center">

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md)

<img src="assets/logo.svg" alt="WhichPeak" width="96" height="96">

# WhichPeak

_Quel sommet est-ce ? Placez-vous n'importe où et obtenez un panorama à 360 degrés avec les noms._

**Le relief d'un panorama de 150 km en 4,6 secondes.** Médiane de six exécutions à cache vide dans Chrome sans interface, sur un vrai réseau, depuis le Gornergrat, jusqu'à ce que le relief soit tracé. Les noms des sommets se chargent à part. La méthode est dans [docs/benchmarks.md](docs/benchmarks.md).

<img src="assets/demo.gif" alt="Rotation du panorama du Rigi vers les Alpes bernoises, ouverture de la fiche de la Jungfrau, puis déplacement du soleil à l'heure dorée" width="800">

[![CI](https://img.shields.io/github/actions/workflow/status/Arthur031221/WhichPeak/ci.yml?branch=main&style=flat-square&color=0a6c8d&label=CI)](https://github.com/Arthur031221/WhichPeak/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0a6c8d?style=flat-square)](LICENSE)
[![Live demo](https://img.shields.io/badge/live%20demo-open-0a6c8d?style=flat-square)](https://arthur031221.github.io/WhichPeak/)

</div>

WhichPeak dessine ce que l'on verrait depuis un point de la Terre et nomme les montagnes. Il lit des tuiles d'altitude ouvertes, ajoute la courbure terrestre et la réfraction, ombre le terrain avec le vrai soleil de l'heure choisie et étiquette chaque sommet réellement visible. Tout fonctionne dans le navigateur. Il n'y a ni serveur ni compte, et vos photos ne quittent jamais votre appareil.

Je ne veux pas donner une réponse fausse avec aplomb, alors quand l'outil hésite, il le dit. Une correspondance faible pour une photo est signalée comme une correspondance faible.

## Pourquoi je l'ai construit

> Je voulais un outil de panoramas dont je peux lire la méthode, la modifier et l'héberger moi-même. Le cœur est du TypeScript sans framework, et chaque chiffre affiché remonte à une tuile d'altitude.

## Ce qu'il produit

| Vous faites ceci                    | WhichPeak vous donne                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Ouvrir un lien ou poser une épingle | Un panorama à 360 degrés jusqu'à 400 km, construit à partir de tuiles de six niveaux de détail                      |
| Augmenter la hauteur des yeux       | La vue depuis une tour ou un sommet, avec un horizon qui s'abaisse comme dans la réalité                            |
| Déplacer le curseur d'heure         | Soleil, brume et limite des neiges qui suivent la date et la latitude                                               |
| Cliquer sur une étiquette           | Altitude, distance, azimut, angle au-dessus de l'horizon et hauteur dont le sommet dépasse le terrain qui le masque |
| Passer en ligne de vue              | Un profil entre deux points, avec la crête qui bloque la vue                                                        |
| Partager la page                    | Un lien qui garde le lieu, la vue, la portée et le moment                                                           |

Les sommets viennent d'OpenStreetMap par quatre miroirs Overpass. Si aucun ne répond, une liste intégrée de 35 621 sommets au-dessus de 1800 m prend le relais, de sorte que les étiquettes apparaissent toujours.

## Essayer

```sh
git clone https://github.com/Arthur031221/WhichPeak.git
cd WhichPeak
npm install
npm run dev
# ouvrez http://localhost:5173/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200
```

Ce lien regarde depuis le Rigi Kulm vers la Jungfrau et l'Eiger, à environ 70 km. La même vue est dans la [démo en ligne](https://arthur031221.github.io/WhichPeak/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200&t=2026-07-10T14:30Z).

<details>
<summary>Installation selon l'environnement</summary>

**Page hébergée.** Ouvrez la démo en ligne. Rien n'est installé.

**Depuis les sources.** Node.js 20.19 ou plus récent est requis. Exécutez les cinq lignes ci-dessus.

**Votre propre hébergement statique.** Exécutez `npm run build` et copiez `dist/` sur n'importe quel serveur web. Pour un sous-chemin, compilez avec `GITHUB_PAGES=1` afin d'obtenir la base `/WhichPeak/`, ou modifiez `base` dans `vite.config.ts`.

**Un fork sur GitHub Pages.** Activez Pages avec GitHub Actions comme source. Le workflow de `.github/workflows/pages.yml` compile et déploie une fois la CI de `main` réussie.

Plus de détails dans [docs/install.md](docs/install.md).

</details>

## Quelle confiance accorder

La courbure et la réfraction sont ce que j'ai vérifié le plus soigneusement. Un outil de ligne de vue qui se trompe de quelques mètres se trompe sur la visibilité d'un sommet, je l'ai donc testé sur deux lignes de vue documentées.

| Ligne de vue                         | Distance | Résultat avec la réfraction moyenne (k = 0,13) |
| ------------------------------------ | -------- | ---------------------------------------------- |
| Pic de Finestrelles vers Pic Gaspard | 443 km   | Bloquée de 48 m. Visible à partir de k = 0,145 |
| Marys Peak vers Mount Rainier        | 295.8 km | Visible avec 78 m de marge                     |

La première ligne de vue a été photographiée en 2016 avec une forte réfraction, donc bloquée à la valeur moyenne et ouverte à 0,145 est la réponse que j'attendais. Le calcul penche du côté de cacher un sommet, car une cellule d'altitude fait environ 76 m de large.

**Le mode photo est expérimental.** Sur huit photos ordinaires prises au Gornergrat, avec le lieu fixé et sans indiquer le cap, une seule a correspondu. Les sept autres ont été signalées comme correspondance faible, et celles que j'ai vérifiées à l'œil étaient bien fausses. Aucune n'a été donnée pour bonne alors qu'elle était fausse. Utilisez-le pour des photos à ligne de crête nette et au lieu connu, et réglez les curseurs à la main quand il se trompe. Les huit résultats sont dans [docs/benchmarks.md](docs/benchmarks.md).

L'avant-plan peut paraître étiré sur un terrain très raide, parce que chaque colonne de pixels ne garde que la plus forte pente rencontrée. C'est un défaut d'apparence connu, sans effet sur les étiquettes.

## Langues

L'interface existe en anglais, chinois traditionnel, chinois simplifié, japonais, coréen, espagnol, français, allemand et portugais du Brésil. Choisissez dans le sélecteur de l'en-tête. Les unités passent du métrique à l'impérial, et il y a un thème sombre et un thème clair.

## Documentation

- [Installation](docs/install.md)
- [Utilisation](docs/usage.md)
- [Configuration et paramètres d'URL](docs/config.md)
- [Architecture](docs/architecture.md)
- [Mesures de performance](docs/benchmarks.md)

## Contribuer

Les rapports de bogues et les pull requests sont les bienvenus. [CONTRIBUTING.md](CONTRIBUTING.md) décrit les vérifications à passer d'abord : 97 tests unitaires, 10 tests de navigateur, vérification des types et du format.

## Crédits

Altitude : AWS Terrain Tiles. Sommets et fond de carte : contributeurs d'OpenStreetMap. Recherche de lieux : Nominatim. Données de secours des sommets : Wikidata. Les licences des données incluses sont dans [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Sous licence MIT. Voir [LICENSE](LICENSE).

Assisted by Claude/Codex.
