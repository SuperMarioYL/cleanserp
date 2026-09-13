// expander.test.ts — 「查看被隐藏内容」展开器（m7）
//
// buildHiddenSummary 是纯函数；折叠条/列表/单条恢复是 serp-filter 的 DOM
// 副作用，用 happy-dom 换入 globalThis.document 做回归。

import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

import {
  planFilter,
  executePlan,
  restoreHidden,
  buildHiddenSummary,
  REASON_LABELS,
} from "../src/content/serp-filter";
import type { SerpResult } from "../src/content/rules";

// ── buildHiddenSummary：纯函数 ────────────────────────────────────────

function stubResult(url: string, title: string, snippet = ""): SerpResult {
  return {
    engine: "baidu",
    node: { style: {} } as unknown as HTMLElement,
    title,
    url,
    snippet,
    source: "",
  };
}

test("buildHiddenSummary：混合计划 → count=3，按序返回条目并映射中文原因标签", () => {
  const plan = planFilter([
    stubResult("https://baijiahao.baidu.com/s?id=1", "一文读懂脱发", "盘点 5 个方法"),
    stubResult("https://www.chinaz.com/a/1", "站长工具怎么用"),
    stubResult("https://url.cn/abc", "脱发偏方汇总"),
    stubResult("https://www.derm.org.cn/a", "可读源（应保留）"),
  ]);

  const summary = buildHiddenSummary(plan);
  assert.equal(summary.count, 3);
  assert.deepEqual(
    summary.items.map((i) => i.title),
    ["一文读懂脱发", "站长工具怎么用", "脱发偏方汇总"],
  );
  assert.deepEqual(
    summary.items.map((i) => i.reasonLabel),
    ["百家号AI文", "营销号", "跳转中间页"],
  );
  assert.deepEqual(
    summary.items.map((i) => i.reason),
    ["baijiahao-ai-slop", "yingxiaohao", "redirect-middlepage"],
  );
});

test("REASON_LABELS：四类死链原因全部有中文标签", () => {
  assert.equal(REASON_LABELS["baijiahao-ai-slop"], "百家号AI文");
  assert.equal(REASON_LABELS["yingxiaohao"], "营销号");
  assert.equal(REASON_LABELS["paywall"], "付费墙");
  assert.equal(REASON_LABELS["redirect-middlepage"], "跳转中间页");
});

// ── 折叠条 DOM 生命周期 ───────────────────────────────────────────────

/** 换入 happy-dom document 并放 3 张结果卡（营销号/百家号AI文/付费墙）。 */
function installDomWithCards(): { doc: Document; cards: HTMLElement[] } {
  const window = new Window();
  // happy-dom 自带一套 DOM 类型；测试按 lib.dom 类型消费（运行时即 happy-dom 实现）
  const doc = window.document as unknown as Document;
  const cards: HTMLElement[] = [];
  for (let i = 0; i < 3; i++) {
    const card = doc.createElement("div");
    card.textContent = `card-${i}`;
    doc.body.append(card);
    cards.push(card);
  }
  (globalThis as Record<string, unknown>).document = doc;
  return { doc, cards };
}

function mixedPlan(cards: HTMLElement[]): ReturnType<typeof planFilter> {
  const results: SerpResult[] = [
    { engine: "baidu", node: cards[0], title: "站长工具怎么用", url: "https://www.chinaz.com/a/1", snippet: "", source: "" },
    { engine: "baidu", node: cards[1], title: "一文读懂脱发", url: "https://baijiahao.baidu.com/s?id=1", snippet: "盘点 5 个方法", source: "百家号" },
    { engine: "baidu", node: cards[2], title: "付费好文", url: "https://36kr.com/p/1", snippet: "登录后查看全文", source: "36kr.com" },
  ];
  return planFilter(results);
}

test("executePlan：count>0 注入折叠条且文本携带计数；count=0 不注入", () => {
  const { doc, cards } = installDomWithCards();
  executePlan(mixedPlan(cards));

  const strip = doc.getElementById("cleanserp-hidden-strip");
  assert.ok(strip, "count=3 时应注入折叠条");
  assert.match(strip!.textContent ?? "", /净搜已隐藏 3 条/);

  // 全保留的计划：不注入折叠条
  const clean = planFilter([
    { engine: "baidu", node: cards[0], title: "可读", url: "https://www.derm.org.cn/a", snippet: "", source: "" },
  ]);
  executePlan(clean);
  assert.equal(doc.getElementById("cleanserp-hidden-strip"), null);
});

test("展开：点击「查看」渲染每个隐藏条目一行，标注对应中文原因", () => {
  const { doc, cards } = installDomWithCards();
  executePlan(mixedPlan(cards));

  const strip = doc.getElementById("cleanserp-hidden-strip")!;
  const list = doc.getElementById("cleanserp-hidden-list")!;
  assert.equal(list.style.display, "none", "列表默认收起");

  (strip.querySelector('[role="button"]') as HTMLElement).click();
  assert.notEqual(list.style.display, "none", "点击后展开");

  const rows = Array.from(list.querySelectorAll(".cleanserp-hidden-item"));
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r) => (r.querySelector("span:nth-child(2)") as HTMLElement).textContent),
    ["营销号", "百家号AI文", "付费墙"],
  );
  assert.deepEqual(
    rows.map((r) => (r.querySelector("span:first-child") as HTMLElement).textContent),
    ["站长工具怎么用", "一文读懂脱发", "付费好文"],
  );
});

test("单条恢复：点「显示」只还原该节点、更新计数，清零后折叠条消失", () => {
  const { doc, cards } = installDomWithCards();
  executePlan(mixedPlan(cards));
  const strip = doc.getElementById("cleanserp-hidden-strip")!;

  // 所有三张卡都应已被隐藏
  for (const c of cards) {
    assert.equal(c.style.display, "none");
    assert.equal(c.getAttribute("data-cleanserp-hidden"), "1");
  }

  // 恢复第 1 条（card-0 营销号）
  const firstShow = strip.querySelector(
    ".cleanserp-hidden-item button",
  ) as HTMLElement;
  firstShow.click();

  assert.equal(cards[0].style.display, "", "被恢复的节点取消隐藏");
  assert.equal(cards[0].hasAttribute("data-cleanserp-hidden"), false);
  assert.equal(cards[1].style.display, "none", "其余节点保持隐藏");
  assert.equal(cards[2].style.display, "none");
  assert.match(strip.textContent ?? "", /净搜已隐藏 2 条/);
  assert.equal(
    strip.querySelectorAll(".cleanserp-hidden-item").length,
    2,
    "被恢复的行从列表移除",
  );

  // 恢复剩余两条 → 折叠条整体消失
  for (const btn of Array.from(
    strip.querySelectorAll(".cleanserp-hidden-item button"),
  )) {
    (btn as HTMLElement).click();
  }
  assert.equal(doc.getElementById("cleanserp-hidden-strip"), null);
  for (const c of cards) {
    assert.equal(c.style.display, "");
    assert.equal(c.hasAttribute("data-cleanserp-hidden"), false);
  }
});

test("restoreHidden：移除折叠条与列表，全量还原被隐藏节点（与 m5 开关联动）", () => {
  const { doc, cards } = installDomWithCards();
  executePlan(mixedPlan(cards));
  assert.ok(doc.getElementById("cleanserp-hidden-strip"));
  assert.ok(doc.getElementById("cleanserp-hidden-list"));

  restoreHidden();
  assert.equal(doc.getElementById("cleanserp-hidden-strip"), null);
  assert.equal(doc.getElementById("cleanserp-hidden-list"), null);
  assert.equal(doc.getElementById("cleanserp-filter-badge"), null);
  for (const c of cards) {
    assert.equal(c.style.display, "");
    assert.equal(c.hasAttribute("data-cleanserp-hidden"), false);
  }
});
