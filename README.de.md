<div align="center">

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md)

<img src="assets/logo.svg" alt="WhichPeak" width="96" height="96">

# WhichPeak

_Welcher Gipfel ist das? Stell dich irgendwohin und erhalte ein beschriftetes 360-Grad-Panorama._

**Das Gelände eines 150-km-Panoramas in 4,6 Sekunden.** Median aus sechs Läufen mit leerem Cache in Chrome ohne Oberfläche über das echte Netz, vom Gornergrat aus, bis das Gelände gezeichnet ist. Die Gipfelnamen laden getrennt. Die Methode steht in [docs/benchmarks.md](docs/benchmarks.md).

<img src="assets/demo.gif" alt="Das Rigi-Panorama zu den Berner Alpen drehen, die Karte der Jungfrau öffnen und die Sonne auf die goldene Stunde stellen" width="800">

[![CI](https://img.shields.io/github/actions/workflow/status/Arthur031221/WhichPeak/ci.yml?branch=main&style=flat-square&color=0a6c8d&label=CI)](https://github.com/Arthur031221/WhichPeak/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0a6c8d?style=flat-square)](LICENSE)
[![Live demo](https://img.shields.io/badge/live%20demo-open-0a6c8d?style=flat-square)](https://arthur031221.github.io/WhichPeak/)

</div>

WhichPeak zeichnet, was man von einem Punkt der Erde aus sehen würde, und benennt die Berge. Es liest offene Höhenkacheln, berücksichtigt Erdkrümmung und Refraktion, schattiert das Gelände mit der echten Sonne zur gewählten Uhrzeit und beschriftet jeden Gipfel, der tatsächlich sichtbar ist. Alles läuft im Browser. Es gibt keinen Server und kein Konto, und deine Fotos verlassen nie dein Gerät.

Ich möchte keine selbstsichere falsche Antwort geben, deshalb sagt das Werkzeug es, wenn es unsicher ist. Ein schwacher Fototreffer wird als schwacher Treffer gemeldet.

## Warum ich es gebaut habe

> Ich wollte ein Panorama-Werkzeug, dessen Methode ich lesen, ändern und selbst hosten kann. Der Kern ist TypeScript ohne Framework, und jede angezeigte Zahl lässt sich auf eine Höhenkachel zurückführen.

## Was es erzeugt

| Du tust das                              | WhichPeak liefert                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Einen Link öffnen oder eine Nadel setzen | Ein 360-Grad-Panorama bis 400 km, aus Kacheln in sechs Detailstufen aufgebaut                                |
| Die Augenhöhe erhöhen                    | Die Aussicht von einem Turm oder Gipfel, mit einem Horizont, der sich senkt wie in Wirklichkeit              |
| Den Zeitregler bewegen                   | Sonne, Dunst und Schneegrenze, die Datum und Breitengrad folgen                                              |
| Auf ein Label klicken                    | Höhe, Entfernung, Peilung, Winkel über dem Horizont und wie weit der Gipfel das verdeckende Gelände überragt |
| Zur Sichtlinie wechseln                  | Ein Profil zwischen zwei Punkten, mit dem Grat, der die Sicht versperrt                                      |
| Die Seite teilen                         | Ein Link, der Ort, Blickrichtung, Reichweite und Zeitpunkt enthält                                           |

Die Gipfel stammen aus OpenStreetMap über vier Overpass-Spiegel. Antwortet keiner, springt eine mitgelieferte Liste mit 35.621 Gipfeln über 1800 m ein, sodass weiterhin Labels erscheinen.

## Ausprobieren

```sh
git clone https://github.com/Arthur031221/WhichPeak.git
cd WhichPeak
npm install
npm run dev
# öffne http://localhost:5173/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200
```

Dieser Link blickt von der Rigi Kulm zur Jungfrau und zum Eiger, etwa 70 km entfernt. Dieselbe Ansicht gibt es in der [Live-Demo](https://arthur031221.github.io/WhichPeak/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200&t=2026-07-10T14:30Z).

<details>
<summary>Installation je nach Umgebung</summary>

**Gehostete Seite.** Öffne die Live-Demo. Es wird nichts installiert.

**Aus dem Quellcode.** Erfordert Node.js 20.19 oder neuer. Führe die fünf Zeilen oben aus.

**Dein eigener statischer Host.** Führe `npm run build` aus und kopiere `dist/` auf einen beliebigen Webserver. Für einen Unterpfad baust du mit `GITHUB_PAGES=1`, um die Basis `/WhichPeak/` zu erhalten, oder änderst `base` in `vite.config.ts`.

**Ein Fork auf GitHub Pages.** Aktiviere Pages mit GitHub Actions als Quelle. Der Workflow in `.github/workflows/pages.yml` baut und veröffentlicht, nachdem die CI auf `main` bestanden hat.

Mehr dazu in [docs/install.md](docs/install.md).

</details>

## Wie weit man ihm trauen kann

Krümmung und Refraktion habe ich am gründlichsten geprüft. Ein Sichtlinien-Werkzeug, das um wenige Meter danebenliegt, irrt sich darüber, ob ein Gipfel sichtbar ist. Deshalb habe ich es an zwei dokumentierten Sichtlinien getestet.

| Sichtlinie                           | Entfernung | Ergebnis bei mittlerer Refraktion (k = 0,13) |
| ------------------------------------ | ---------- | -------------------------------------------- |
| Pic de Finestrelles nach Pic Gaspard | 443 km     | Um 48 m blockiert. Sichtbar ab k = 0,145     |
| Marys Peak nach Mount Rainier        | 295.8 km   | Sichtbar mit 78 m Abstand                    |

Die erste Sichtlinie wurde 2016 bei starker Refraktion fotografiert. Blockiert beim Mittelwert und offen bei 0,145 ist also die Antwort, die ich erwartet habe. Der Löser neigt dazu, einen Gipfel zu verbergen, denn eine Höhenzelle ist etwa 76 m breit.

**Der Fotomodus ist experimentell.** Bei acht gewöhnlichen Fotos vom Gornergrat, mit gesetztem Ort und ohne Blickrichtung, passte eines. Die anderen sieben wurden als schwacher Treffer markiert, und die, die ich mit dem Auge geprüft habe, waren tatsächlich falsch. Kein falsches Foto wurde als Treffer gemeldet. Nutze ihn für Fotos mit sauberer Horizontlinie und bekanntem Ort und stelle die Regler von Hand nach, wenn er danebenliegt. Alle acht Ergebnisse stehen in [docs/benchmarks.md](docs/benchmarks.md).

Auf sehr steilem Gelände kann der Vordergrund verschmiert wirken, weil jede Pixelspalte nur die größte bisher gesehene Steigung behält. Das ist ein bekannter optischer Mangel und betrifft die Labels nicht.

## Sprachen

Die Oberfläche gibt es auf Englisch, Traditionellem Chinesisch, Vereinfachtem Chinesisch, Japanisch, Koreanisch, Spanisch, Französisch, Deutsch und brasilianischem Portugiesisch. Wähle im Umschalter in der Kopfzeile. Die Einheiten wechseln zwischen metrisch und imperial, und es gibt ein dunkles und ein helles Design.

## Dokumentation

- [Installation](docs/install.md)
- [Nutzung](docs/usage.md)
- [Konfiguration und URL-Parameter](docs/config.md)
- [Architektur](docs/architecture.md)
- [Messungen](docs/benchmarks.md)

## Mitwirken

Fehlerberichte und Pull Requests sind willkommen. [CONTRIBUTING.md](CONTRIBUTING.md) beschreibt die Prüfungen, die du zuerst ausführen solltest: 97 Unit-Tests, 10 Browser-Tests, Typprüfung und Formatprüfung.

## Quellen

Höhe: AWS Terrain Tiles. Gipfel und Basiskarte: OpenStreetMap-Mitwirkende. Ortssuche: Nominatim. Ausweichdaten für Gipfel: Wikidata. Die Lizenzen der mitgelieferten Daten stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

MIT-Lizenz. Siehe [LICENSE](LICENSE).

Assisted by Claude/Codex.
