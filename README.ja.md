<div align="center">

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md)

<img src="assets/logo.svg" alt="WhichPeak" width="96" height="96">

# WhichPeak

_あの山の名前は？どこに立っても、名前付きの360度パノラマが手に入ります。_

**150 km パノラマの地形が 4.6 秒で描き終わります。** 数値はゴルナーグラート（Gornergrat）で、キャッシュなしのヘッドレス Chrome から実際のネットワークで 6 回測り、地形が描き終わるまでの中央値です。山名は別に読み込まれます。方法は [docs/benchmarks.md](docs/benchmarks.md) にあります。

<img src="assets/demo.gif" alt="ベルナーアルプスへ向きを変え、ユングフラウのカードを開き、太陽をゴールデンアワーに動かす" width="800">

[![CI](https://img.shields.io/github/actions/workflow/status/Arthur031221/WhichPeak/ci.yml?branch=main&style=flat-square&color=0a6c8d&label=CI)](https://github.com/Arthur031221/WhichPeak/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0a6c8d?style=flat-square)](LICENSE)
[![Live demo](https://img.shields.io/badge/live%20demo-open-0a6c8d?style=flat-square)](https://arthur031221.github.io/WhichPeak/)

</div>

WhichPeak は、地球上の一点から見える景色を描き、山に名前を付けます。オープンな標高タイルを読み込み、地球の曲率と大気の屈折を加え、選んだ時刻の本物の太陽で地形に陰影を付け、実際に見える山頂にだけラベルを置きます。すべてブラウザ内で動きます。サーバーもアカウントも不要で、写真が端末の外に出ることはありません。

自信満々の間違った答えを出したくないので、自信がないときはそう表示します。写真の照合が弱ければ、弱い一致として報告します。

## 作った理由

> 仕組みを読めて、変更できて、自分でホストできるパノラマツールがほしいと思いました。中核はフレームワークを使わない素の TypeScript で、画面に出る数値はすべて標高タイルまで辿れます。

## できること

| やること                       | 得られるもの                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| リンクを開く、またはピンを置く | 最大 400 km までの 360 度パノラマ。6 段階の詳細度のタイルから作ります                            |
| 視点の高さを上げる             | 塔や山頂からの眺め。地平線も実際と同じように下がります                                           |
| 時刻スライダーを動かす         | 日付と緯度に合わせて、太陽、霞、雪線が変わります                                                 |
| ラベルをクリックする           | 標高、距離、方位、地平線からの仰角、そして地形の上にどれだけ出ているか                           |
| 視線モードに切り替える         | 2 点間の断面図と、視線をさえぎる尾根                                                             |
| 名前の一部を入力する           | 一致する見える山をすべて一覧にし、そちらへ向きを変えられる                                       |
| 電波がない場所で開く           | 読み込み済みのページと地形をオフラインのキャッシュから表示する。アプリとしてインストールもできる |
| ページを共有する               | 場所、向き、範囲、時刻を保持したリンク                                                           |

山の情報は OpenStreetMap から、3 つの Overpass ミラー経由で取得します。どれも応答しない場合は、標高 1800 m 以上の 35,621 座を収めた同梱リストに切り替わるので、ラベルは表示されます。

## 試してみる

```sh
git clone https://github.com/Arthur031221/WhichPeak.git
cd WhichPeak
npm install
npm run dev
# 開く http://localhost:5173/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200
```

このリンクは、スイスのリギ・クルムから約 70 km 先のユングフラウとアイガーを望みます。同じ景色は[ライブデモ](https://arthur031221.github.io/WhichPeak/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200&t=2026-07-10T14:30Z)でも見られます。

<details>
<summary>環境ごとのインストール</summary>

**公開ページ。** ライブデモを開くだけです。何もインストールしません。

**ソースから。** Node.js 20.19 以上が必要です。上の 5 行を実行してください。

**自前の静的ホスト。** `npm run build` を実行し、`dist/` を任意のウェブサーバーにコピーします。サブパスに置く場合は `GITHUB_PAGES=1` でビルドして `/WhichPeak/` のベースにするか、`vite.config.ts` の `base` を変更してください。

**GitHub Pages 上のフォーク。** Pages を有効にし、ソースに GitHub Actions を選びます。`.github/workflows/pages.yml` が、`main` の CI が通ったあとにビルドとデプロイを行います。

詳しくは [docs/install.md](docs/install.md) を参照してください。

</details>

## どこまで信頼できるか

曲率と屈折は、いちばん念入りに確かめた部分です。視線ツールが数メートルずれると、山が見えるかどうかの判定が変わってしまうため、記録のある 2 本の視線で検証しました。

| 視線                                 | 距離     | 平均的な屈折（k = 0.13）での結果            |
| ------------------------------------ | -------- | ------------------------------------------- |
| Pic de Finestrelles から Pic Gaspard | 443 km   | 48 m さえぎられます。k = 0.145 から見えます |
| Marys Peak から Mount Rainier        | 295.8 km | 見えます。余裕は 78 m                       |

1 本目の視線は 2016 年に強い屈折のもとで撮影されたので、平均設定ではさえぎられ、0.145 で開くという結果は想定どおりです。標高セル 1 つがおよそ 76 m 幅なので、ソルバーは山を隠す側に倒してあります。

**写真モードは実験的です。** ゴルナーグラートで撮った 8 枚の一般的な写真で、場所は指定し、向きは与えずに試したところ、一致したのは 1 枚でした。残る 7 枚は弱い一致と表示され、目で確認した分は実際に間違っていました。間違っているのに一致と報告されたものはありません。天際線がはっきりしていて、撮影場所が分かっている写真に使い、外れたらスライダーを手で調整してください。8 枚すべての結果は [docs/benchmarks.md](docs/benchmarks.md) にあります。

非常に急な斜面では、手前の地形が引き伸ばされて見えることがあります。各ピクセル列が見えた中で最大の勾配だけを保つためです。既知の見た目の欠点で、ラベルには影響しません。

## 言語

インターフェースは英語、繁体字中国語、簡体字中国語、日本語、韓国語、スペイン語、フランス語、ドイツ語、ブラジルポルトガル語で使えます。ヘッダーの切り替えから選べます。単位はメートル法とヤード・ポンド法を切り替えられ、ダークとライトのテーマもあります。

## ドキュメント

- [インストール](docs/install.md)
- [使い方](docs/usage.md)
- [設定と URL パラメータ](docs/config.md)
- [アーキテクチャ](docs/architecture.md)
- [ベンチマーク](docs/benchmarks.md)

## コントリビュート

バグ報告とプルリクエストを歓迎します。最初に実行するチェックは [CONTRIBUTING.md](CONTRIBUTING.md) にあります。105 件のユニットテスト、12 件のブラウザテスト、型チェック、書式チェックです。

## クレジット

標高: AWS Terrain Tiles。山と地図: OpenStreetMap の貢献者。地名検索: Nominatim。山のフォールバックデータ: Wikidata。同梱データのライセンスは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) にあります。

MIT ライセンスです。[LICENSE](LICENSE) を参照してください。

Assisted by Claude/Codex.
