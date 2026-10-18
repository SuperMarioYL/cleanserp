# 更新日志 (Changelog)

## [0.3.0] - 2026-10-19

### 修复

- **搜狗页面观察器自触发死循环**：`serp-filter.ts` 的 MutationObserver 在无 `#content_left` 的页面（搜狗）以 `document.body` 为观察根，而 `executePlan` 每轮对徽章/折叠条「删旧建新」——扩展自身的 UI 重建被观察器当作页面重渲染，只要过滤数 >0 就以约 400ms 一次的频率永久重解析、重分类、重上报。观察器回调现在先经自注入 UI 判定（新增导出 `isOwnUiNode` / `hasForeignMutation`）过滤，仅页面真实变更才重跑；新增回归测试以真实 MutationObserver 记录钉死「一轮 executePlan 的全部变更均为自身 UI」。
- **开关生命周期状态一致性**：关闭开关后 content script 现在回报计数 0——此前工具栏徽标与 popup 计数残留旧值，与「已关闭」并排显示；popup 开关新增在途守卫，TOGGLE 往返期间忽略连点（worker 端 read-modify-write 非原子，并发翻转可能互相吞掉）；初始化存储快照与 `storage.onChanged` 竞争时以后到真值为准，过期快照不再回写。

### 维护

- 版本 lockstep 升至 0.3.0（`VERSION` / `package.json` / `manifest.json`）；产品站点文案与已发布能力对齐——移除「manifest 仅面向百度、未支持搜狗」的过时限制声明（搜狗注入与 host_permissions 已随上个版本发布）。

## [0.2.0] - 2026-09-13

### 新增

- **on/off 开关（popup）**：兑现 v0.1.0 popup 承诺的「开关 · v0.2 上线」。service worker 实现 `CLEANSERP_TOGGLE` 翻转并持久化；content script 监听 `chrome.storage.onChanged`，已过滤页面上点开关即时生效（关闭 = 还原全部被隐藏结果并撤掉徽章与折叠条；开启 = 重跑过滤），无需刷新页面。
- **搜狗 SERP 支持**：manifest 向 `www.sogou.com` 注入 content script（桌面 web 自然结果；移动端与垂直 tab 不在范围）；新增 `parseSogouSerp` 适配器（`vrwrap`/`rb` 卡片，多组兜底选择器）与 `detectEngine` 引擎识别；修复 `reportCount` 的 `engine:"baidu"` 硬编码，popup 计数按真实引擎上报。
- **「查看被隐藏内容」展开器**：SERP 底部新增折叠条「净搜已隐藏 N 条 · 查看」，展开后按原因标注（百家号AI文 / 营销号 / 付费墙 / 跳转中间页）逐条列出被隐藏结果，支持单条「显示」恢复，清零后折叠条自动消失——误杀结果有了用户可见的找回出口。
- **CHANGELOG.md 与版本一致性测试**：版本 lockstep 升至 0.2.0（`VERSION` / `package.json` / `manifest.json` 全部在役表面 + `web/site.json` content_version 1→2）。

### 修复

- **营销号域名规则失效（静默放行）**：`rules.ts` 的域名集合曾以 `www.` 前缀存储（`www.chinaz.com` / `www.niaogebiji.com` 等），而 `hostnameOf()` 恒去 `www.` 前缀，导致 chinaz.com、niaogebiji.com 两条营销号规则在 v0.1.0 从未命中。集合键已规范化为 `hostnameOf()` 输出的无 `www.` 规范形式，并新增全量覆盖测试：遍历营销号与付费墙两个集合的每个条目，断言 `https://<域名>/x` 与 `https://www.<域名>/x` 都命中。

### 测试

- 引入 happy-dom（devDependency），补上仓库首批 DOM 侧回归测试：`executePlan` 隐藏/还原/幂等、隐藏列表展开与单条恢复、`parseBaiduSerp` 与 `parseSogouSerp` 的 fixture 解析（此前 v0.1.0 对 SERP DOM 解析零覆盖）。

## [0.1.0] - 2026-08-22

首个发布：百度 SERP 死链分类器（百家号AI文 / 营销号 / 付费墙 / 跳转中间页）+「已过滤 N 条」徽章 + popup 过滤计数 + MV3 打包（load-unpacked）+ 双语 README + 产品站点。

[0.3.0]: https://github.com/SuperMarioYL/cleanserp/releases/tag/v0.3.0
[0.2.0]: https://github.com/SuperMarioYL/cleanserp/releases/tag/v0.2.0
[0.1.0]: https://github.com/SuperMarioYL/cleanserp/releases/tag/v0.1.0
