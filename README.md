<div align="right"><sub>[English](./README.en.md)&nbsp;&nbsp;⇄&nbsp;&nbsp;<b>简体中文</b></sub></div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/hero-light.svg">
  <img src="./assets/hero-light.svg" width="880" alt="净搜 CleanSERP — 零配置百度/搜狗 SERP 净化扩展">
</picture>

<p align="center"><sub>净搜是面向中文搜索用户的零配置 SERP 净化层，一键隐藏营销号死链。</sub></p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license"></a>
  <a href="https://github.com/SuperMarioYL/cleanserp/releases"><img src="https://img.shields.io/github/v/release/SuperMarioYL/cleanserp?label=release" alt="release"></a>
  <img src="https://img.shields.io/github/actions/workflow/status/SuperMarioYL/cleanserp/ci.yml?branch=main&label=CI" alt="CI">
  <img src="https://img.shields.io/badge/TypeScript-5.4-3178c6" alt="TypeScript">
  <img src="https://img.shields.io/badge/Chrome-MV3-0071E3" alt="Chrome MV3">
  <img src="https://img.shields.io/badge/零配置-zero--config-10A37F" alt="零配置">
</p>

**百度/搜狗每次搜索要点开 5+ 个营销号、百家号 AI 文、付费墙死链才能找到一个可读源——净搜装上即用，无需账号、无需换引擎。**

## 目录

- [为什么做这个](#为什么做这个)
- [架构](#架构)
- [安装](#安装)
- [快速开始](#快速开始)
- [用法](#用法)
- [Demo](#demo)
- [配置](#配置)
- [Pro 付费层](#pro-付费层)
- [路线图](#路线图)
- [许可与贡献](#许可与贡献)

## 为什么做这个

百度/搜狗 SERP 已被百家号 AI 文与营销号死链淹没，每次搜索平均要点开 5+ 个无效结果才能找到一个可读源。uBlock 只隐藏广告位，不动有机结果里的垃圾内容；Kagi 要换引擎 + 付费。净搜在你现有的百度上叠加一层**零配置的内容质量过滤**——装上即用，只留下可读源，顶部一枚「净搜已过滤 N 条」徽章告诉你今天清掉了多少噪声。

## 架构

<h2><img src="https://api.iconify.design/tabler/topology-star-3.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 架构</h2>

净搜是单扩展进程：content script 解析已渲染的百度 SERP，把每条结果交给启发式死链分类器（rules.ts），命中四类死链的卡片被即时隐藏，顶部注入过滤徽章；service worker 按页签存计数，popup 显示本次过滤数。规则集独立可替换，为后续 Pro 自定义规则预留接口。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/atlas-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/atlas-light.svg">
  <img src="./assets/atlas-light.svg" width="880" alt="架构：百度 SERP → 死链分类器 → 净化结果+徽章 → popup 计数">
</picture>

分类器原语是规则组合（非 ML），对每条结果给出 `usable` / `dead-end` 判定 + 死链原因：

```typescript
type DeadEndReason = "baijiahao-ai-slop" | "yingxiaohao" | "paywall" | "redirect-middlepage";
function classify(r: SerpResult): { verdict: Verdict; reason?: DeadEndReason };
```

## 安装

<h2><img src="https://api.iconify.design/tabler/stack-2.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 安装</h2>

需要 Node 22+（构建用）。运行时只需 Chrome / Edge（MV3）。

```bash
git clone https://github.com/SuperMarioYL/cleanserp.git
cd cleanserp && npm install && npm run build
```

## 快速开始

<h2><img src="https://api.iconify.design/tabler/rocket.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 快速开始</h2>

1. 打开 `chrome://extensions`，开启右上角「开发者模式」。
2. 点「加载已解包的扩展程序」，选择仓库下的 `dist/` 目录。
3. 打开 [baidu.com](https://www.baidu.com) 搜索「怎么治疗脱发」——死链结果即时消失，顶部出现「净搜已过滤 N 条」徽章。

<details><summary>示例输出（终端构建）</summary>

```
$ npm run build
> cleanserp@0.1.0 build
> node scripts/build.mjs
  dist/src/content/serp-filter.js       2.1kb
  dist/src/background/service-worker.js 1.4kb
  dist/src/popup/popup.js               1.1kb
  dist/tests/serp-filter.test.js        3.0kb
build: dist/ ready for load-unpacked
```

</details>

## 用法

<h2><img src="https://api.iconify.design/tabler/terminal-2.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 用法</h2>

- **净化百度搜索**：安装后访问 `baidu.com/s?wd=...`，content script 自动跑一次分类并隐藏死链，MutationObserver 兜底处理翻页与异步重渲染。
- **查看本次过滤数**：点工具栏净搜图标，popup 显示当前页签的「已过滤 N 条」。
- **重新加载规则**：改 `src/content/rules.ts` → `npm run build` → 在 `chrome://extensions` 点扩展的「重新加载」。

v0.1 的 on/off 开关与搜狗支持属于 v0.2 范围（见 [路线图](#路线图)）。

## Demo

<h2><img src="https://api.iconify.design/tabler/photo.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> Demo</h2>

百度搜索「怎么治疗脱发」，5 条营销号 / 百家号 AI 文 / 付费墙死链即时消失，剩一条干净可读结果，顶部显示「净搜已过滤 5 条」徽章。

![净搜 demo](assets/demo.gif)

> 录制脚本见 [`docs/demo.tape`](./docs/demo.tape)（vhs），`.github/workflows/demo.yml` 可手动重渲染 `assets/demo.gif`。

## 配置

<h2><img src="https://api.iconify.design/tabler/adjustments.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 配置</h2>

净搜无设置页，全部状态存于 `chrome.storage.local`（零配置是核心论点）：

| key | type | default | meaning |
| --- | --- | --- | --- |
| `cleanserp_enabled` | boolean | `true` | 全局开关。v0.1 默认开启；on/off 开关 UI 属于 v0.2 |
| `cleanserp_count_<tabId>` | number | `0` | 该页签本次过滤计数 |
| `cleanserp_engine_<tabId>` | `"baidu"` \| `"sogou"` | `"baidu"` | 该页 tab 命中的搜索引擎（v0.2 起含搜狗） |

## Pro 付费层

净搜 v0.1 完全免费且开源，个人净化功能永久免费。商业化是一个未来的 Pro 层，面向电商运营 / 内容团队（3–10 人）：

- **Pro 能力**：自定义可编辑规则列表（按域名 / 标题模式永久过滤特定竞品营销号）+ 团队规则共享 + 云端同步（换电脑 / 多人）。
- **定价**：¥39 / 用户 / 月，或 ¥199 / 团队 / 月（≤5 人）——低于电商工具的心理门槛，高于个人愿为「隐藏百度广告」付的钱（个人应免费）。
- **最小付费路径**：电商团队 lead 用免费版搜竞品品牌词 → 想把某个营销号域名永久加入过滤 → 命中「Pro: 添加自定义规则」gate → 微信支付 ¥39/月 → 规则云端保存 + 邀请队友。
- **计费栈**：微信支付（或 Lemon Squeezy CN-friendly fallback）+ 自托管规则同步 API（Node 22 + Postgres，与扩展同栈）。

v0.1 不实现 Pro；规则引擎已保持可插拔以便后续接入。

## 路线图

<h2><img src="https://api.iconify.design/tabler/map-2.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 路线图</h2>

- [x] **m1** 百度 SERP 死链分类器（百家号 AI 文 / 营销号 / 付费墙 / 跳转中间页）+「已过滤 N 条」徽章
- [ ] **m2** popup on/off 开关 + 本次过滤计数 + 搜狗 SERP 基础支持（复用 serp-dom 适配器）
- [ ] **m3** Chrome/Edge Web Store MV3 打包（manifest、图标、截图、listing）+ 30s GIF demo + 双语 README
- [ ] **Pro** 自定义可编辑规则列表 + 团队规则共享 + 云端同步
- [ ] 「查看被隐藏内容」逐条展开器（v0.2+）

## 许可与贡献

<h2><img src="https://api.iconify.design/tabler/license.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 许可与贡献</h2>

MIT 许可证，详见 [LICENSE](./LICENSE)。欢迎在 [GitHub Issues](https://github.com/SuperMarioYL/cleanserp/issues) 反馈「哪些查询净化效果不好」或提交规则补丁 PR——百度 SERP DOM 变更后，改 `src/content/rules.ts` 即可。

<p align="center"><sub><a href="./LICENSE">MIT</a> © 2026 SuperMarioYL</sub></p>
