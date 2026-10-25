<div align="center">

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md)

<img src="assets/logo.svg" alt="WhichPeak" width="96" height="96">

# WhichPeak

_저 산은 이름이 뭘까? 어디에 서 있든 이름이 붙은 360도 파노라마를 얻으세요._

**150 km 파노라마의 지형이 4.6초 만에 그려집니다.** 수치는 고르너그라트(Gornergrat)에서 캐시 없이 헤드리스 Chrome으로 실제 네트워크를 통해 여섯 번 측정해 지형이 그려질 때까지 걸린 중앙값입니다. 봉우리 이름은 따로 불러옵니다. 방법은 [docs/benchmarks.md](docs/benchmarks.md)에 있습니다.

<img src="assets/demo.gif" alt="베른 알프스 쪽으로 돌리고, 융프라우 카드를 열고, 태양을 골든 아워로 옮기는 모습" width="800">

[![CI](https://img.shields.io/github/actions/workflow/status/Arthur031221/WhichPeak/ci.yml?branch=main&style=flat-square&color=0a6c8d&label=CI)](https://github.com/Arthur031221/WhichPeak/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0a6c8d?style=flat-square)](LICENSE)
[![Live demo](https://img.shields.io/badge/live%20demo-open-0a6c8d?style=flat-square)](https://arthur031221.github.io/WhichPeak/)

</div>

WhichPeak은 지구 위 한 지점에서 보이는 풍경을 그리고 산에 이름을 붙입니다. 공개 표고 타일을 읽고, 지구 곡률과 대기 굴절을 더하고, 고른 시각의 실제 태양으로 지형에 음영을 입히며, 실제로 보이는 봉우리에만 라벨을 붙입니다. 모든 것이 브라우저 안에서 동작합니다. 서버도 계정도 없고, 사진은 기기 밖으로 나가지 않습니다.

확신에 찬 틀린 답을 내놓고 싶지 않아서, 도구가 확실하지 않으면 그렇게 표시합니다. 사진 대조가 약하면 약한 일치로 보고합니다.

## 만든 이유

> 방법을 읽고, 고치고, 직접 호스팅할 수 있는 파노라마 도구를 원했습니다. 핵심은 프레임워크 없는 순수 TypeScript이고, 화면에 나오는 모든 숫자는 표고 타일까지 거슬러 올라갈 수 있습니다.

## 할 수 있는 일

| 하는 일                   | 얻는 것                                                                          |
| ------------------------- | -------------------------------------------------------------------------------- |
| 링크를 열거나 핀을 놓는다 | 최대 400 km까지의 360도 파노라마. 여섯 단계 세부 수준의 타일로 만듭니다          |
| 눈높이를 올린다           | 탑이나 정상에서 본 풍경. 수평선도 실제처럼 내려갑니다                            |
| 시간 슬라이더를 움직인다  | 날짜와 위도에 따라 태양, 안개, 설선이 달라집니다                                 |
| 라벨을 클릭한다           | 고도, 거리, 방위, 수평선 위 각도, 그리고 지형 위로 얼마나 솟아 있는지            |
| 시선 모드로 바꾼다        | 두 지점 사이의 단면 차트와 시선을 가로막는 능선                                  |
| 이름 일부를 입력한다      | 일치하는 보이는 산을 모두 목록으로 보여 주고 그쪽으로 돌릴 수 있다               |
| 신호가 없는 곳에서 연다   | 이미 불러온 페이지와 지형을 오프라인 캐시에서 보여 준다. 앱으로 설치할 수도 있다 |
| 페이지를 공유한다         | 장소, 방향, 범위, 시각을 담은 링크                                               |

봉우리는 OpenStreetMap에서 Overpass 미러 세 곳을 통해 가져옵니다. 모두 응답하지 않으면 고도 1800 m 이상 35,621개 봉우리가 담긴 내장 목록으로 대체되므로 라벨은 계속 나타납니다.

## 써 보기

```sh
git clone https://github.com/Arthur031221/WhichPeak.git
cd WhichPeak
npm install
npm run dev
# 열기 http://localhost:5173/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200
```

이 링크는 스위스 리기 쿨름에서 약 70 km 떨어진 융프라우와 아이거를 바라봅니다. 같은 장면을 [라이브 데모](https://arthur031221.github.io/WhichPeak/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200&t=2026-07-10T14:30Z)에서도 볼 수 있습니다.

<details>
<summary>환경별 설치</summary>

**공개 페이지.** 라이브 데모를 열면 됩니다. 설치할 것은 없습니다.

**소스에서 실행.** Node.js 20.19 이상이 필요합니다. 위의 다섯 줄을 실행하세요.

**직접 운영하는 정적 호스트.** `npm run build`를 실행하고 `dist/`를 아무 웹 서버에 복사하세요. 하위 경로에 둘 때는 `GITHUB_PAGES=1`로 빌드해 `/WhichPeak/` 기본 경로를 쓰거나 `vite.config.ts`의 `base`를 바꾸세요.

**GitHub Pages의 포크.** Pages를 켜고 소스로 GitHub Actions를 고르세요. `.github/workflows/pages.yml`이 `main`의 CI가 통과한 뒤 빌드하고 배포합니다.

자세한 내용은 [docs/install.md](docs/install.md)를 보세요.

</details>

## 얼마나 믿을 수 있나

곡률과 굴절은 가장 꼼꼼히 확인한 부분입니다. 시선 도구가 몇 미터만 틀려도 봉우리가 보이는지 여부가 틀리기 때문에, 기록이 남아 있는 두 시선으로 검증했습니다.

| 시선                                 | 거리     | 평균 굴절(k = 0.13)에서의 결과  |
| ------------------------------------ | -------- | ------------------------------- |
| Pic de Finestrelles 에서 Pic Gaspard | 443 km   | 48 m 가려짐. k = 0.145부터 보임 |
| Marys Peak 에서 Mount Rainier        | 295.8 km | 보임, 여유 78 m                 |

첫 번째 시선은 2016년에 강한 굴절 아래에서 촬영되었으므로, 평균 설정에서는 가려지고 0.145에서 열리는 것이 제가 예상한 답입니다. 표고 셀 하나가 약 76 m 폭이라서, 계산기는 봉우리를 숨기는 쪽으로 기울어 있습니다.

**사진 모드는 실험 단계입니다.** 고르너그라트에서 찍은 평범한 사진 여덟 장으로, 장소는 정하고 방향은 주지 않은 채 시험했더니 한 장이 일치했습니다. 나머지 일곱 장은 약한 일치로 표시되었고, 눈으로 확인한 것들은 실제로 틀렸습니다. 틀렸는데 일치로 보고된 사진은 없습니다. 스카이라인이 깨끗하고 촬영 장소를 아는 사진에 쓰고, 빗나가면 슬라이더를 손으로 조정하세요. 여덟 장의 전체 결과는 [docs/benchmarks.md](docs/benchmarks.md)에 있습니다.

아주 가파른 지면에서는 전경이 늘어져 보일 수 있습니다. 각 픽셀 열이 지금까지 본 가장 큰 경사만 유지하기 때문입니다. 알려진 외관상 결함이며 라벨에는 영향이 없습니다.

## 언어

인터페이스는 영어, 번체 중국어, 간체 중국어, 일본어, 한국어, 스페인어, 프랑스어, 독일어, 브라질 포르투갈어로 제공됩니다. 헤더의 전환기에서 고르세요. 단위는 미터법과 야드파운드법 사이에서 바꿀 수 있고, 다크와 라이트 테마가 있습니다.

## 문서

- [설치](docs/install.md)
- [사용법](docs/usage.md)
- [설정과 URL 매개변수](docs/config.md)
- [아키텍처](docs/architecture.md)
- [벤치마크](docs/benchmarks.md)

## 기여하기

버그 제보와 풀 리퀘스트를 환영합니다. 먼저 실행할 검사는 [CONTRIBUTING.md](CONTRIBUTING.md)에 있습니다. 단위 테스트 105개, 브라우저 테스트 12개, 타입 검사, 서식 검사입니다.

## 출처

고도: AWS Terrain Tiles. 봉우리와 지도: OpenStreetMap 기여자. 장소 검색: Nominatim. 봉우리 대체 데이터: Wikidata. 내장 데이터의 라이선스는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있습니다.

MIT 라이선스입니다. [LICENSE](LICENSE)를 보세요.

Assisted by Claude/Codex.
