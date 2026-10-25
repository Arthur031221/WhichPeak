<div align="center">

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md)

<img src="assets/logo.svg" alt="WhichPeak" width="96" height="96">

# WhichPeak

_¿Qué montaña es esa? Ponte en cualquier lugar y obtén un panorama de 360 grados con nombres._

**El terreno de un panorama de 150 km en 4,6 segundos.** Mediana de seis ejecuciones con caché vacía en Chrome sin interfaz y con red real, desde el Gornergrat, hasta que el terreno está dibujado. Los nombres de los picos cargan aparte. El método está en [docs/benchmarks.md](docs/benchmarks.md).

<img src="assets/demo.gif" alt="Girando el panorama del Rigi hacia los Alpes Berneses, abriendo la ficha del Jungfrau y moviendo el sol a la hora dorada" width="800">

[![CI](https://img.shields.io/github/actions/workflow/status/Arthur031221/WhichPeak/ci.yml?branch=main&style=flat-square&color=0a6c8d&label=CI)](https://github.com/Arthur031221/WhichPeak/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0a6c8d?style=flat-square)](LICENSE)
[![Live demo](https://img.shields.io/badge/live%20demo-open-0a6c8d?style=flat-square)](https://arthur031221.github.io/WhichPeak/)

</div>

WhichPeak dibuja lo que se vería desde un punto de la Tierra y pone nombre a las montañas. Lee teselas de elevación abiertas, añade la curvatura terrestre y la refracción, sombrea el terreno con el sol real de la hora que elijas y etiqueta cada cima que de verdad se ve. Funciona en el navegador. No hay servidor ni cuenta, y tus fotos nunca salen de tu dispositivo.

No quiero dar una respuesta equivocada con total seguridad, así que cuando la herramienta duda, lo dice. Una coincidencia débil de una foto se informa como coincidencia débil.

## Por qué lo hice

> Quería una herramienta de panoramas cuyo método pueda leer, cambiar y alojar yo mismo. El núcleo es TypeScript sin frameworks, y cada número que muestra se puede rastrear hasta una tesela de elevación.

## Qué produce

| Tú haces esto                         | WhichPeak te da                                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Abrir un enlace o colocar un marcador | Un panorama de 360 grados hasta 400 km, construido con teselas de seis niveles de detalle           |
| Subir la altura de los ojos           | La vista desde una torre o una cumbre, con el horizonte bajando como lo hace en realidad            |
| Mover el control de hora              | Sol, bruma y una línea de nieve que siguen la fecha y la latitud                                    |
| Pulsar una etiqueta                   | Altitud, distancia, rumbo, ángulo sobre el horizonte y cuánto supera la cima al terreno que la tapa |
| Cambiar a línea de visión             | Un perfil entre dos puntos, con la cresta que bloquea la vista                                      |
| Compartir la página                   | Un enlace que guarda el lugar, la vista, el alcance y el momento                                    |

Las cimas vienen de OpenStreetMap a través de cuatro réplicas de Overpass. Si ninguna responde, toma el relevo una lista incluida de 35 621 cumbres por encima de 1800 m, de modo que las etiquetas siguen apareciendo.

## Pruébalo

```sh
git clone https://github.com/Arthur031221/WhichPeak.git
cd WhichPeak
npm install
npm run dev
# abre http://localhost:5173/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200
```

Ese enlace mira desde el Rigi Kulm hacia el Jungfrau y el Eiger, a unos 70 km. La misma vista está en la [demo en vivo](https://arthur031221.github.io/WhichPeak/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200&t=2026-07-10T14:30Z).

<details>
<summary>Instalación en cada entorno</summary>

**Página alojada.** Abre la demo en vivo. No se instala nada.

**Desde el código fuente.** Necesita Node.js 20.19 o superior. Ejecuta las cinco líneas de arriba.

**Tu propio alojamiento estático.** Ejecuta `npm run build` y copia `dist/` en cualquier servidor web. Para una subruta, compila con `GITHUB_PAGES=1` para obtener la base `/WhichPeak/`, o cambia `base` en `vite.config.ts`.

**Un fork en GitHub Pages.** Activa Pages con GitHub Actions como origen. El flujo de `.github/workflows/pages.yml` compila y despliega cuando la CI de `main` pasa.

Hay más detalle en [docs/install.md](docs/install.md).

</details>

## Cuánto fiarse

La curvatura y la refracción son lo que comprobé con más rigor. Una herramienta de línea de visión que falla por unos metros se equivoca sobre si una cima es visible, así que la probé con dos líneas de visión documentadas.

| Línea de visión                   | Distancia | Resultado con la refracción media (k = 0,13) |
| --------------------------------- | --------- | -------------------------------------------- |
| Pic de Finestrelles a Pic Gaspard | 443 km    | Bloqueada por 48 m. Visible desde k = 0,145  |
| Marys Peak a Mount Rainier        | 295.8 km  | Visible con 78 m de margen                   |

La primera línea se fotografió en 2016 con una refracción fuerte, así que bloqueada con el valor medio y abierta con 0,145 es la respuesta que esperaba. El cálculo se inclina por ocultar una cima, porque una celda de elevación mide unos 76 m de ancho.

**El modo foto es experimental.** Con ocho fotos corrientes del Gornergrat, con el lugar fijado y sin indicar el rumbo, coincidió una. Las otras siete se marcaron como coincidencia débil, y las que revisé a ojo estaban mal. Ninguna se dio por buena estando mal. Úsalo con fotos de horizonte limpio y lugar conocido, y ajusta los deslizadores a mano cuando falle. Los ocho resultados están en [docs/benchmarks.md](docs/benchmarks.md).

El primer plano puede verse estirado en terreno muy empinado, porque cada columna de píxeles guarda solo la mayor pendiente que ha visto. Es un defecto estético conocido y no afecta a las etiquetas.

## Idiomas

La interfaz está en inglés, chino tradicional, chino simplificado, japonés, coreano, español, francés, alemán y portugués de Brasil. Elige uno en el selector de la cabecera. Las unidades cambian entre métricas e imperiales, y hay un tema oscuro y uno claro.

## Documentación

- [Instalación](docs/install.md)
- [Uso](docs/usage.md)
- [Configuración y parámetros de la URL](docs/config.md)
- [Arquitectura](docs/architecture.md)
- [Pruebas de rendimiento](docs/benchmarks.md)

## Contribuir

Se agradecen los informes de errores y los pull requests. [CONTRIBUTING.md](CONTRIBUTING.md) explica las comprobaciones que hay que pasar antes: 97 pruebas unitarias, 10 pruebas de navegador, comprobación de tipos y de formato.

## Créditos

Elevación: AWS Terrain Tiles. Cimas y mapa base: colaboradores de OpenStreetMap. Búsqueda de lugares: Nominatim. Datos de respaldo de cimas: Wikidata. Las licencias de los datos incluidos están en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Con licencia MIT. Consulta [LICENSE](LICENSE).

Assisted by Claude/Codex.
