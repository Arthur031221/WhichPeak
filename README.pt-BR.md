<div align="center">

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md)

<img src="assets/logo.svg" alt="WhichPeak" width="96" height="96">

# WhichPeak

_Que montanha é aquela? Fique em qualquer lugar e receba um panorama de 360 graus com nomes._

**O relevo de um panorama de 150 km em 4,6 segundos.** Mediana de seis execuções com cache vazio no Chrome sem interface, em rede real, a partir do Gornergrat, até o relevo ser desenhado. Os nomes dos picos carregam à parte. O método está em [docs/benchmarks.md](docs/benchmarks.md).

<img src="assets/demo.gif" alt="Girando o panorama do Rigi em direção aos Alpes Berneses, abrindo o cartão da Jungfrau e movendo o sol para a hora dourada" width="800">

[![CI](https://img.shields.io/github/actions/workflow/status/Arthur031221/WhichPeak/ci.yml?branch=main&style=flat-square&color=0a6c8d&label=CI)](https://github.com/Arthur031221/WhichPeak/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0a6c8d?style=flat-square)](LICENSE)
[![Live demo](https://img.shields.io/badge/live%20demo-open-0a6c8d?style=flat-square)](https://arthur031221.github.io/WhichPeak/)

</div>

O WhichPeak desenha o que se veria de um ponto da Terra e dá nome às montanhas. Ele lê tiles de elevação abertos, acrescenta a curvatura da Terra e a refração, sombreia o terreno com o sol real da hora escolhida e rotula cada cume que de fato aparece. Tudo roda no navegador. Não há servidor nem conta, e suas fotos nunca saem do seu dispositivo.

Não quero dar uma resposta errada com toda a confiança, então quando a ferramenta tem dúvida, ela diz. Uma correspondência fraca de foto é informada como correspondência fraca.

## Por que eu criei

> Eu queria uma ferramenta de panoramas cujo método eu pudesse ler, alterar e hospedar por conta própria. O núcleo é TypeScript puro, sem framework, e cada número exibido pode ser rastreado até um tile de elevação.

## O que ele produz

| Você faz isto                       | O WhichPeak entrega                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Abrir um link ou soltar um alfinete | Um panorama de 360 graus até 400 km, montado com tiles de seis níveis de detalhe                       |
| Aumentar a altura dos olhos         | A vista de uma torre ou de um cume, com o horizonte baixando como na realidade                         |
| Mover o controle de hora            | Sol, névoa e linha de neve que seguem a data e a latitude                                              |
| Clicar em um rótulo                 | Altitude, distância, azimute, ângulo acima do horizonte e quanto o cume passa do terreno que o encobre |
| Trocar para linha de visada         | Um perfil entre dois pontos, com a crista que bloqueia a vista                                         |
| Compartilhar a página               | Um link que guarda o lugar, a vista, o alcance e o momento                                             |

Os picos vêm do OpenStreetMap por cinco espelhos do Overpass. Se nenhum responder, uma lista embutida com 35.621 cumes acima de 1800 m assume, e os rótulos continuam aparecendo.

## Experimente

```sh
git clone https://github.com/Arthur031221/WhichPeak.git
cd WhichPeak
npm install
npm run dev
# abra http://localhost:5173/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200
```

Esse link olha do Rigi Kulm para a Jungfrau e o Eiger, a cerca de 70 km. A mesma vista está na [demonstração ao vivo](https://arthur031221.github.io/WhichPeak/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200&t=2026-07-10T14:30Z).

<details>
<summary>Instalação em cada ambiente</summary>

**Página hospedada.** Abra a demonstração ao vivo. Nada é instalado.

**A partir do código-fonte.** Requer Node.js 20.19 ou mais recente. Execute as cinco linhas acima.

**Sua própria hospedagem estática.** Execute `npm run build` e copie `dist/` para qualquer servidor web. Para um subcaminho, compile com `GITHUB_PAGES=1` para obter a base `/WhichPeak/`, ou altere `base` em `vite.config.ts`.

**Um fork no GitHub Pages.** Ative o Pages com GitHub Actions como origem. O fluxo em `.github/workflows/pages.yml` compila e publica depois que a CI de `main` passa.

Mais detalhes em [docs/install.md](docs/install.md).

</details>

## Quanto confiar

A curvatura e a refração foram o que verifiquei com mais rigor. Uma ferramenta de linha de visada que erra por alguns metros erra sobre se um pico é visível, por isso a testei com duas linhas de visada documentadas.

| Linha de visada                     | Distância | Resultado com a refração média (k = 0,13)         |
| ----------------------------------- | --------- | ------------------------------------------------- |
| Pic de Finestrelles até Pic Gaspard | 443 km    | Bloqueada por 48 m. Visível a partir de k = 0,145 |
| Marys Peak até Mount Rainier        | 295.8 km  | Visível com 78 m de folga                         |

A primeira linha foi fotografada em 2016 sob forte refração, então bloqueada no valor médio e aberta em 0,145 é a resposta que eu esperava. O cálculo tende a esconder um pico, porque uma célula de elevação tem cerca de 76 m de largura.

**O modo foto é experimental.** Com oito fotos comuns do Gornergrat, com o local definido e sem informar a direção, uma correspondeu. As outras sete foram marcadas como correspondência fraca, e as que conferi a olho estavam de fato erradas. Nenhuma foi dada como correta estando errada. Use com fotos de horizonte limpo e local conhecido, e ajuste os controles à mão quando errar. Os oito resultados estão em [docs/benchmarks.md](docs/benchmarks.md).

O primeiro plano pode aparecer esticado em terreno muito íngreme, porque cada coluna de pixels guarda apenas a maior inclinação que viu. É um defeito visual conhecido e não afeta os rótulos.

## Idiomas

A interface está em inglês, chinês tradicional, chinês simplificado, japonês, coreano, espanhol, francês, alemão e português do Brasil. Escolha no seletor do cabeçalho. As unidades alternam entre métricas e imperiais, e há um tema escuro e um claro.

## Documentação

- [Instalação](docs/install.md)
- [Uso](docs/usage.md)
- [Configuração e parâmetros de URL](docs/config.md)
- [Arquitetura](docs/architecture.md)
- [Medições](docs/benchmarks.md)

## Contribuir

Relatos de erros e pull requests são bem-vindos. O [CONTRIBUTING.md](CONTRIBUTING.md) descreve as verificações a rodar primeiro: 93 testes unitários, 10 testes de navegador, verificação de tipos e de formato.

## Créditos

Elevação: AWS Terrain Tiles. Picos e mapa base: colaboradores do OpenStreetMap. Busca de lugares: Nominatim. Dados reserva de picos: Wikidata. As licenças dos dados incluídos estão em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Licença MIT. Veja [LICENSE](LICENSE).

Assisted by Claude/Codex.
