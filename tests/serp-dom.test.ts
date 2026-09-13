// serp-dom.test.ts — 百度/搜狗 SERP 解析适配器的 fixture 回归测试（m6）
//
// 两个适配器都只对仓库内 fixture 断言（README 的「独立验证」标准）；实时
// SERP DOM 的 A/B 变更无法进 CI，兼容性作为诚实声明的限制（见 README）。
// 这是 parseBaiduSerp 的首个 DOM 侧回归测试——v0.1 对 SERP 解析零覆盖。

import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

import {
  parseBaiduSerp,
  parseSogouSerp,
  detectEngine,
} from "../src/lib/serp-dom";
import { planFilter, runFilter } from "../src/content/serp-filter";

/** 用 happy-dom 解析一段 SERP HTML，返回其 document（按 lib.dom 类型消费，运行时是 happy-dom）。 */
function domOf(html: string): Document {
  const window = new Window();
  window.document.body.innerHTML = html;
  return window.document as unknown as Document;
}

// ── detectEngine：引擎识别的唯一 owner ────────────────────────────────

test("detectEngine：搜狗系 host → sogou，其余（百度系/未知）→ baidu", () => {
  assert.equal(detectEngine("www.sogou.com"), "sogou");
  assert.equal(detectEngine("sogou.com"), "sogou");
  assert.equal(detectEngine("www.baidu.com"), "baidu");
  assert.equal(detectEngine("m.baidu.com"), "baidu");
  assert.equal(detectEngine("baidu.com"), "baidu");
  assert.equal(detectEngine("unknown.example.com"), "baidu");
});

// ── parseSogouSerp：对文档化的当前搜狗桌面版结构做回归 ────────────────

const SOGOU_FIXTURE = `
<div class="results">
  <div class="vrwrap">
    <h3><a href="https://www.chinaz.com/a/1.html">站长工具怎么用</a></h3>
    <div class="str_text_info">帮你查数据</div>
    <div class="citeurl">chinaz.com</div>
  </div>
  <div class="vrwrap">
    <h3><a href="https://baijiahao.baidu.com/s?id=123">一文读懂脱发治疗</a></h3>
    <div class="str_text_info">盘点 5 个方法让你告别脱发</div>
    <div class="citeurl">baijiahao.baidu.com</div>
  </div>
  <div class="rb">
    <h3><a href="https://www.derm.org.cn/article/alopecia">雄激素性脱发诊疗指南</a></h3>
    <div class="str-text-info">中华医学会皮肤性病学分会</div>
    <cite>derm.org.cn</cite>
  </div>
  <!-- 无标题链接的噪声卡：应被跳过 -->
  <div class="vrwrap"><div>侧栏推荐位</div></div>
</div>
`;

test("parseSogouSerp：3 条结果解析为 engine=sogou，标题/来源正确", () => {
  const doc = domOf(SOGOU_FIXTURE);
  const results = parseSogouSerp(doc);

  assert.equal(results.length, 3);
  assert.ok(results.every((r) => r.engine === "sogou"));
  assert.deepEqual(
    results.map((r) => r.title),
    ["站长工具怎么用", "一文读懂脱发治疗", "雄激素性脱发诊疗指南"],
  );
  // 真实 URL 优先取可见 cite 文本（href 可能是 sogou.com/link 跳转包装）
  assert.equal(results[0].url, "chinaz.com");
  assert.equal(results[0].source, "chinaz.com");
  assert.equal(results[2].source, "derm.org.cn");
  assert.equal(results[2].snippet, "中华医学会皮肤性病学分会");
});

test("parseSogouSerp + planFilter：分类器引擎无关——恰好隐藏营销号与百家号AI文 2 条", () => {
  const doc = domOf(SOGOU_FIXTURE);
  const results = parseSogouSerp(doc);
  const plan = planFilter(results);

  assert.equal(plan.total, 3);
  assert.equal(plan.count, 2);
  assert.equal(plan.reasons["yingxiaohao"], 1);
  assert.equal(plan.reasons["baijiahao-ai-slop"], 1);
  assert.equal(plan.kept.length, 1);
  assert.equal(plan.kept[0].url, "derm.org.cn");
});

test("runFilter：搜狗结果返回 engine=sogou 的报告（计数上报不再硬编码 baidu）", () => {
  const doc = domOf(SOGOU_FIXTURE);
  // runFilter → executePlan 操作全局 document，换入 happy-dom 实例
  (globalThis as Record<string, unknown>).document = doc;
  const report = runFilter(parseSogouSerp(doc));

  assert.equal(report.engine, "sogou");
  assert.equal(report.count, 2);
});

// ── parseBaiduSerp：首个 DOM 回归测试（v0.1 只有纯逻辑单测） ────────

const BAIDU_FIXTURE = `
<div id="content_left">
  <div class="result c-container" data-url="https://www.yixieshi.com/p/99">
    <h3><a href="https://www.baidu.com/link?url=xyz">脱发怎么办</a></h3>
    <div class="c-abstract">这些方法帮你</div>
    <span class="c-showurl">yixieshi.com</span>
  </div>
  <div class="result c-container" data-url="https://baijiahao.baidu.com/s?id=1">
    <h3><a href="https://www.baidu.com/link?url=abc">一文读懂脱发</a></h3>
    <div class="c-abstract">盘点 5 个方法</div>
    <span class="c-showurl">百家号</span>
  </div>
  <div class="result c-container" data-url="https://www.derm.org.cn/a">
    <h3><a href="https://www.derm.org.cn/a">脱发诊疗指南</a></h3>
    <div class="c-abstract">学会指南</div>
    <span class="c-showurl">derm.org.cn</span>
  </div>
  <!-- 无标题链接的噪声卡：应被跳过 -->
  <div class="result c-container"><div>广告推荐位</div></div>
</div>
`;

test("parseBaiduSerp：3 条结果解析为 engine=baidu，真实 URL 取 data-url 而非跳转 href", () => {
  const doc = domOf(BAIDU_FIXTURE);
  const results = parseBaiduSerp(doc);

  assert.equal(results.length, 3);
  assert.ok(results.every((r) => r.engine === "baidu"));
  assert.equal(results[0].url, "https://www.yixieshi.com/p/99");
  assert.equal(results[1].url, "https://baijiahao.baidu.com/s?id=1");
  assert.deepEqual(
    results.map((r) => r.title),
    ["脱发怎么办", "一文读懂脱发", "脱发诊疗指南"],
  );
});

test("parseBaiduSerp + planFilter：恰好隐藏营销号与百家号AI文 2 条", () => {
  const doc = domOf(BAIDU_FIXTURE);
  const plan = planFilter(parseBaiduSerp(doc));

  assert.equal(plan.total, 3);
  assert.equal(plan.count, 2);
  assert.equal(plan.reasons["yingxiaohao"], 1);
  assert.equal(plan.reasons["baijiahao-ai-slop"], 1);
  assert.equal(plan.kept.length, 1);
});
