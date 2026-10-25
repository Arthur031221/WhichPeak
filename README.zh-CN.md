<div align="center">

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português (Brasil)](README.pt-BR.md)

<img src="assets/logo.svg" alt="WhichPeak" width="96" height="96">

# WhichPeak

_那座山叫什么名字？站在任何地方，都能得到标好名称的 360 度全景。_

**150 公里全景的地形在 4.6 秒内绘制完成。** 数字取自戈尔内格拉特（Gornergrat）冷缓存下在无头 Chrome 中通过真实网络连续六次、到地形绘制完成的中位数。山峰名称单独加载。方法见 [docs/benchmarks.md](docs/benchmarks.md)。

<img src="assets/demo.gif" alt="转向伯尔尼阿尔卑斯山，打开少女峰的信息卡，再把太阳调到黄金时刻" width="800">

[![CI](https://img.shields.io/github/actions/workflow/status/Arthur031221/WhichPeak/ci.yml?branch=main&style=flat-square&color=0a6c8d&label=CI)](https://github.com/Arthur031221/WhichPeak/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0a6c8d?style=flat-square)](LICENSE)
[![Live demo](https://img.shields.io/badge/live%20demo-open-0a6c8d?style=flat-square)](https://arthur031221.github.io/WhichPeak/)

</div>

WhichPeak 会画出你站在地球上某一点所能看到的景象，并给山峰标上名字。它读取开放的高程图块，加入地球曲率与大气折射，按你选的时刻用真实的太阳为地形着色，并且只为真正看得到的山顶添加标签。整个程序在浏览器内运行，没有服务器、不需要账号，照片也不会离开你的设备。

我不想给出一个很有把握却是错的答案，所以工具不确定时会直接说出来。照片匹配不准，就会标示为匹配不佳。

## 为什么做这个

> 我想要一个方法可以读懂、可以修改、也能自己部署的全景工具。核心是不用框架的纯 TypeScript，界面上的每个数字都能追溯到一块高程图块。

## 它能做什么

| 你做这件事         | WhichPeak 给你                                                 |
| ------------------ | -------------------------------------------------------------- |
| 打开链接或放下图钉 | 最远 400 公里的 360 度全景，由六个细节层级的图块组成           |
| 调高视点高度       | 从高塔或山顶望出去的景色，地平线会像真实情况一样下沉           |
| 拖动时间滑块       | 太阳、雾气与雪线会随日期和纬度变化                             |
| 点击标签           | 海拔、距离、方位角、地平线以上的仰角，以及山峰高出遮挡地形多少 |
| 切换到视线模式     | 两点之间的剖面图，并标出挡住视线的山脊                         |
| 分享页面           | 一个记录地点、视角、范围与时刻的链接                           |

山峰数据来自 OpenStreetMap，通过五个 Overpass 镜像获取。如果全部没有响应，会改用内置的 35,621 座海拔 1800 米以上山顶的列表，因此标签仍然会出现。

## 试一试

```sh
git clone https://github.com/Arthur031221/WhichPeak.git
cd WhichPeak
npm install
npm run dev
# 打开 http://localhost:5173/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200
```

这个链接是从瑞士的 Rigi Kulm 望向约 70 公里外的少女峰和艾格峰。同样的画面也在[在线演示](https://arthur031221.github.io/WhichPeak/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200&t=2026-07-10T14:30Z)中。

<details>
<summary>各种环境的安装方式</summary>

**在线页面。** 打开在线演示即可，不需要安装任何东西。

**从源码运行。** 需要 Node.js 20.19 或更高版本。执行上面的五行命令。

**自己的静态主机。** 执行 `npm run build`，把 `dist/` 复制到任何网页服务器。如果放在子路径，请用 `GITHUB_PAGES=1` 构建以获得 `/WhichPeak/` 基础路径，或修改 `vite.config.ts` 中的 `base`。

**GitHub Pages 上的分支。** 启用 Pages 并选择 GitHub Actions 作为来源。`.github/workflows/pages.yml` 会在 `main` 的 CI 通过后构建并部署。

更多说明见 [docs/install.md](docs/install.md)。

</details>

## 能信任到什么程度

曲率与折射是我检查得最严格的部分。视线工具只要差几米，就会误判山峰是否可见，所以我用两条有人记录过的视线来测试。

| 视线                               | 距离     | 平均折射（k = 0.13）下的结果      |
| ---------------------------------- | -------- | --------------------------------- |
| Pic de Finestrelles 到 Pic Gaspard | 443 km   | 被挡住 48 米。k 达到 0.145 时可见 |
| Marys Peak 到 Mount Rainier        | 295.8 km | 可见，余量 78 米                  |

第一条视线是 2016 年在强折射下拍到的，所以在平均设置下被挡住、在 0.145 时打开，正是我预期的答案。求解器宁可把山峰判为看不到，因为一个高程格大约有 76 米宽。

**照片模式仍是实验性质。** 我用八张在戈尔内格拉特拍的普通照片测试，设好地点但不给方位，结果只有一张匹配成功。其余七张被标为匹配不佳，我用肉眼检查过的几张确实是错的。没有任何一张在错误时被报告为成功。请用在天际线干净且知道拍摄地点的照片，没对上时可以手动微调滑块。八张的完整结果在 [docs/benchmarks.md](docs/benchmarks.md)。

在非常陡的地面上，前景可能出现拖影，因为每一列像素只保留见过的最大坡度。这是已知的外观瑕疵，不影响标签。

## 语言

界面提供英文、繁体中文、简体中文、日文、韩文、西班牙文、法文、德文和巴西葡萄牙文，可从标题栏的切换器选择。单位可在公制与英制之间切换，也有深色和浅色主题。

## 文档

- [安装](docs/install.md)
- [使用方法](docs/usage.md)
- [配置与网址参数](docs/config.md)
- [架构](docs/architecture.md)
- [基准测试](docs/benchmarks.md)

## 参与贡献

欢迎反馈问题和提交 pull request。[CONTRIBUTING.md](CONTRIBUTING.md) 列出了要先运行的检查：93 个单元测试、10 个浏览器测试、类型检查和格式检查。

## 数据来源

高程：AWS Terrain Tiles。山峰与底图：OpenStreetMap 贡献者。地点搜索：Nominatim。山峰备用数据：Wikidata。内置数据的许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

以 MIT 许可发布，见 [LICENSE](LICENSE)。

Assisted by Claude/Codex.
