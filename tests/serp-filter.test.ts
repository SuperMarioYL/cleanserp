// serp-filter.test.ts — 净化分类器的纯逻辑单测
//
// 走 node 内置 test runner（node:test），由 build 脚本经 esbuild 打包成 CJS
// 后用 `node --test` 运行。只测 planFilter（纯函数），不触碰 DOM / chrome。

import { test } from "node:test";
import assert from "node:assert/strict";

import { planFilter } from "../src/content/serp-filter";
import type { SerpResult } from "../src/content/rules";

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
