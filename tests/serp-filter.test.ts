// serp-filter.test.ts — 净化分类器的纯逻辑单测 + executePlan/restoreHidden DOM 侧测试
//
// 走 node 内置 test runner（node:test），由 build 脚本经 esbuild 打包成 CJS
// 后用 `node --test` 运行。纯逻辑部分只测 planFilter/classify；DOM 部分
// 用 happy-dom 换入 globalThis.document（executePlan 直接操作全局 document，
// 这是仓库首批 DOM 侧测试）。

import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

import {
  planFilter,
  executePlan,
  restoreHidden,
} from "../src/content/serp-filter";
import {
  hostnameOf,
  YINGXIAOHAO_DOMAINS,
  PAYWALL_DOMAINS,
  type SerpResult,
} from "../src/content/rules";

// 构造一条 SerpResult。node 字段分类阶段不读，传一个最小 stub 即可。
function result(partial: Partial<SerpResult>): SerpResult {
  return {
    engine: "baidu",
    node: { style: {} } as unknown as HTMLElement,
    title: "",
    url: "",
    snippet: "",
    source: "",
    ...partial,
  };
}

test("百家号 + AI 列表文模板 → 死链 (baijiahao-ai-slop)", () => {
  const r = result({
    url: "https://baijiahao.baidu.com/s?id=123",
    title: "一文读懂脱发的原因，建议收藏",
    snippet: "盘点 5 个方法让你告别脱发",
    source: "百家号",
  });
  const plan = planFilter([r]);
  assert.equal(plan.count, 1);
  assert.equal(plan.reasons["baijiahao-ai-slop"], 1);
});

test("百家号但非 AI 模板文 → 保留 (不误杀真人好文)", () => {
  const r = result({
    url: "https://baijiahao.baidu.com/s?id=456",
    title: "一个皮肤科医生关于脱发的临床观察",
    snippet: "门诊数据与治疗路径分析",
    source: "百家号",
  });
  const plan = planFilter([r]);
  assert.equal(plan.count, 0);
  assert.equal(plan.kept.length, 1);
});

test("营销号域名命中 → 死链 (yingxiaohao)", () => {
  const r = result({
    url: "https://www.yixieshi.com/p/99",
    title: "脱发怎么办",
    snippet: "这些方法帮你",
    source: "yixieshi.com",
  });
  const plan = planFilter([r]);
  assert.equal(plan.count, 1);
  assert.equal(plan.reasons["yingxiaohao"], 1);
});

test("snippet 登录墙特征 → 死链 (paywall)", () => {
  const r = result({
    url: "https://36kr.com/p/123",
    title: "脱发产业的生意经",
    snippet: "登录后查看全文全文内容",
    source: "36kr.com",
  });
  const plan = planFilter([r]);
  assert.equal(plan.count, 1);
  assert.equal(plan.reasons["paywall"], 1);
});

test("跳转中间页 URL → 死链 (redirect-middlepage)", () => {
  const r = result({
    url: "https://url.cn/abc123",
    title: "脱发偏方汇总",
    snippet: "点开看看",
    source: "url.cn",
  });
  const plan = planFilter([r]);
  assert.equal(plan.count, 1);
  assert.equal(plan.reasons["redirect-middlepage"], 1);
});

test("正常可读源 → 保留", () => {
  const r = result({
    url: "https://www.derm.org.cn/article/alopecia",
    title: "雄激素性脱发的诊疗指南",
    snippet: "中华医学会皮肤性病学分会",
    source: "derm.org.cn",
  });
  const plan = planFilter([r]);
  assert.equal(plan.count, 0);
  assert.equal(plan.kept.length, 1);
});

test("混合结果：计数与原因聚合正确", () => {
  const results: SerpResult[] = [
    result({ url: "https://baijiahao.baidu.com/s?id=1", title: "一文读懂脱发", snippet: "", source: "百家号" }),
    result({ url: "https://www.yixieshi.com/p/1", title: "脱发营销", snippet: "", source: "yixieshi.com" }),
    result({ url: "https://36kr.com/p/1", title: "脱发产业", snippet: "登录后查看全文", source: "36kr.com" }),
    result({ url: "https://url.cn/x", title: "脱发偏方", snippet: "", source: "url.cn" }),
    result({ url: "https://www.derm.org.cn/a", title: "脱发诊疗指南", snippet: "学会指南", source: "derm.org.cn" }),
  ];
  const plan = planFilter(results);
  assert.equal(plan.total, 5);
  assert.equal(plan.count, 4);
  assert.equal(plan.kept.length, 1);
  assert.equal(plan.reasons["baijiahao-ai-slop"], 1);
  assert.equal(plan.reasons["yingxiaohao"], 1);
  assert.equal(plan.reasons["paywall"], 1);
  assert.equal(plan.reasons["redirect-middlepage"], 1);
});

test("空输入 → 空计划", () => {
  const plan = planFilter([]);
  assert.equal(plan.total, 0);
  assert.equal(plan.count, 0);
  assert.equal(plan.hidden.length, 0);
});

// ── m4: 域名集合全量生效（fail-before/pass-after） ──────────────────────
// v0.1 的 chinaz.com / niaogebiji.com 以 www. 前缀存储而 hostnameOf() 恒去
// www.，两条营销号规则从未命中。此测试遍历两个集合的每个条目，钉死
// 「集合键必须存 hostnameOf() 的规范形式」这一不变式，防未来漂移。

test("hostnameOf：同域名的 www 前缀与裸域名输入产出相同 host（单一规范形式）", () => {
  for (const d of [...YINGXIAOHAO_DOMAINS, ...PAYWALL_DOMAINS]) {
    assert.equal(hostnameOf(`https://${d}/a`), d, `bare ${d}`);
    assert.equal(hostnameOf(`https://www.${d}/a`), d, `www ${d}`);
  }
  assert.equal(hostnameOf("www.chinaz.com"), "chinaz.com");
  assert.equal(hostnameOf("https://WWW.NiaogeBiji.COM/x"), "niaogebiji.com");
});

test("营销号/付费墙域名集合全量生效：每个条目的裸域名与 www 域名都命中", () => {
  for (const d of YINGXIAOHAO_DOMAINS) {
    for (const host of [`https://${d}/a`, `https://www.${d}/a`]) {
      const plan = planFilter([
        result({ url: host, title: "x", snippet: "y", source: "" }),
      ]);
      assert.equal(plan.count, 1, `${host} 应命中营销号规则`);
      assert.equal(plan.reasons["yingxiaohao"], 1, `${host} reason=yingxiaohao`);
    }
  }
  for (const d of PAYWALL_DOMAINS) {
    for (const host of [`https://${d}/a`, `https://www.${d}/a`]) {
      const plan = planFilter([
        result({ url: host, title: "x", snippet: "y", source: "" }),
      ]);
      assert.equal(plan.count, 1, `${host} 应命中付费墙规则`);
      assert.equal(plan.reasons["paywall"], 1, `${host} reason=paywall`);
    }
  }
});

// ── m5: executePlan / restoreHidden 的 DOM 生命周期（happy-dom） ────────

/** 换入一个带 N 张结果卡的 happy-dom document（executePlan 直接操作全局 document）。 */
function installDom(cards: number): HTMLElement[] {
  const window = new Window();
  // happy-dom 自带一套 DOM 类型；测试按 lib.dom 类型消费（运行时即 happy-dom 实现）
  const doc = window.document as unknown as Document;
  doc.body.innerHTML = "";
  const nodes: HTMLElement[] = [];
  for (let i = 0; i < cards; i++) {
    const card = doc.createElement("div");
    card.textContent = `card-${i}`;
    doc.body.append(card);
    nodes.push(card);
  }
  (globalThis as Record<string, unknown>).document = doc;
  return nodes;
}

function domResults(nodes: HTMLElement[], urls: string[]): SerpResult[] {
  return urls.map((url, i) => ({
    engine: "baidu" as const,
    node: nodes[i],
    title: `t${i}`,
    url,
    snippet: "",
    source: "",
  }));
}

test("executePlan：隐藏节点打标记 + 注入徽章；restoreHidden：全量还原 + 撤徽章", () => {
  const nodes = installDom(2);
  const plan = planFilter(domResults(nodes, ["https://www.yixieshi.com/a", "https://36kr.com/a"]));
  assert.equal(plan.count, 2);

  executePlan(plan);
  for (const n of nodes) {
    assert.equal(n.style.display, "none");
    assert.equal(n.getAttribute("data-cleanserp-hidden"), "1");
  }
  assert.ok(document.getElementById("cleanserp-filter-badge"));

  restoreHidden();
  for (const n of nodes) {
    assert.equal(n.style.display, "");
    assert.equal(n.hasAttribute("data-cleanserp-hidden"), false);
  }
  assert.equal(document.getElementById("cleanserp-filter-badge"), null);
});

test("executePlan 幂等：重复调用不重复注入徽章/折叠条", () => {
  const nodes = installDom(2);
  const plan = planFilter(domResults(nodes, ["https://www.yixieshi.com/a", "https://36kr.com/a"]));

  executePlan(plan);
  executePlan(plan);
  assert.equal(document.querySelectorAll("#cleanserp-filter-badge").length, 1);
  assert.equal(document.querySelectorAll("#cleanserp-hidden-strip").length, 1);
});

test("count=0 的计划：不注入任何 UI，restoreHidden 仍安全（幂等）", () => {
  const nodes = installDom(1);
  const plan = planFilter(domResults(nodes, ["https://www.derm.org.cn/a"]));
  assert.equal(plan.count, 0);

  executePlan(plan);
  assert.equal(document.getElementById("cleanserp-filter-badge"), null);
  assert.equal(document.getElementById("cleanserp-hidden-strip"), null);

  restoreHidden();
  assert.equal(nodes[0].style.display, "");
});
