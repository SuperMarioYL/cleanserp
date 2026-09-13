// serp-dom.ts — 百度/搜狗 SERP 结果卡解析器（只读，不修改 DOM）
//
// 职责：从已渲染的搜索结果页抽出 SerpResult[]，把分类与隐藏交给上层。
// 两家 SERP DOM 都频繁 A/B 变更——每个适配器用多组兜底选择器，挂了改
// selectors 即可，不影响 rules / serp-filter 的纯逻辑。适配器对仓库内
// fixture 回归测试（README 的「独立验证」标准）；实时页面兼容性是
// 诚实声明的限制。解析失败 = 可见 no-op（0 卡 ⇒ 不过滤、无徽章）。

import type { Engine, SerpResult } from "../content/rules";

/**
 * 引擎识别的唯一 owner：hostname → "baidu" | "sogou"。
 * content script 入口据此选解析器，reportCount 据此上报真实引擎。
 */
export function detectEngine(hostname: string): Engine {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return host === "sogou.com" || host.endsWith(".sogou.com") ? "sogou" : "baidu";
}

// ── 百度 ─────────────────────────────────────────────────────────────

// 结果卡候选容器选择器（多兜底）。新布局的 .result-op / 老布局的 .c-container。
const RESULT_SELECTORS = "div.c-container, div.result-op, div.result";

// 标题链接选择器（多兜底）。
const TITLE_LINK_SELECTORS = [
  "h3 a",
  "h3 > a",
  ".t a",
  "a[data-click]",
  "a",
];

// 可见 cite / 来源域名选择器（多兜底）。百度把真实域名藏在 .c-showurl / cite。
const SOURCE_SELECTORS = [
  ".c-showurl",
  "span.c-color-gray",
  ".c-color-gray2",
  "cite",
  ".c-icon-bear-circle", // 百家号标识
];

// 摘要选择器。
const SNIPPET_SELECTORS = [".c-abstract", "div.c-abstract", ".c-span-last"];

function firstText(root: HTMLElement, selectors: string[]): string {
  for (const sel of selectors) {
    const el = root.querySelector(sel) as HTMLElement | null;
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

/**
 * 解析百度 SERP。只读 DOM，返回带 node 引用的结果列表供上层隐藏。
 * 健壮性说明：百度经常把真实 URL 放在容器 data-url/mu 属性或可见 cite 文本里，
 * 而 <a href> 是 baidu.com/link?url= 跳转包装——优先取真实 URL 用于分类。
 */
export function parseBaiduSerp(doc: Document | HTMLElement): SerpResult[] {
  const root = doc as HTMLElement;
  const cards = Array.from(root.querySelectorAll(RESULT_SELECTORS)) as HTMLElement[];
  const results: SerpResult[] = [];

  for (const card of cards) {
    // 只保留真正带标题链接的结果卡（过滤掉侧栏/推荐位噪声）
    const titleLink = card.querySelector(TITLE_LINK_SELECTORS.join(", ")) as
      | HTMLAnchorElement
      | null;
    if (!titleLink) continue;

    const title = titleLink.textContent?.trim() ?? "";
    if (!title) continue;

    // 真实 URL 优先级：容器 data-url/mu → cite/showurl 文本 → href 兜底
    const url =
      card.getAttribute("data-url") ||
      card.getAttribute("mu") ||
      firstText(card, SOURCE_SELECTORS) ||
      titleLink.href ||
      "";

    const snippet = firstText(card, SNIPPET_SELECTORS);
    const source = firstText(card, SOURCE_SELECTORS) || hostnameOf(url);

    results.push({
      engine: "baidu" as Engine,
      node: card,
      title,
      url,
      snippet,
      source,
    });
  }

  return results;
}

// 引入 hostnameOf 仅供 source 兜底使用——从 rules 复用，避免重复实现。
import { hostnameOf } from "../content/rules";

// ── 搜狗（www.sogou.com/web 自然结果；移动端与垂直 tab 不在范围） ─────

// 结果卡候选容器（多兜底）：新版 .vrwrap / 老版 .rb。
const SOGOU_RESULT_SELECTORS = "div.vrwrap, div.rb";

// 标题链接选择器（多兜底）：h3 a 为主，带 data-md 属性的链接次之。
const SOGOU_TITLE_LINK_SELECTORS = ["h3 a", "h3 > a", "a[data-md]", "a"];

// 可见 cite / 来源选择器（多兜底）。
const SOGOU_SOURCE_SELECTORS = [".citeurl", ".str_info", ".str-info", "cite"];

// 摘要选择器（多兜底，新旧 class 命名并存）。
const SOGOU_SNIPPET_SELECTORS = [
  ".str_text_info",
  ".str-text-info",
  ".str_info",
  ".str-info",
];

/**
 * 解析搜狗 SERP。结构与 parseBaiduSerp 对齐：只读 DOM，返回带 node 引用
 * 的结果列表供上层隐藏；真实 URL 优先取 cite 文本，跳转包装兜底。
 */
export function parseSogouSerp(doc: Document | HTMLElement): SerpResult[] {
  const root = doc as HTMLElement;
  const cards = Array.from(root.querySelectorAll(SOGOU_RESULT_SELECTORS)) as HTMLElement[];
  const results: SerpResult[] = [];

  for (const card of cards) {
    // 只保留真正带标题链接的结果卡（过滤掉侧栏/推荐位噪声）
    const titleLink = card.querySelector(SOGOU_TITLE_LINK_SELECTORS.join(", ")) as
      | HTMLAnchorElement
      | null;
    if (!titleLink) continue;

    const title = titleLink.textContent?.trim() ?? "";
    if (!title) continue;

    // 搜狗把真实域名放在可见 cite 文本里；<a href> 可能是 sogou.com/link 跳转包装。
    const url =
      firstText(card, SOGOU_SOURCE_SELECTORS) || titleLink.href || "";

    const snippet = firstText(card, SOGOU_SNIPPET_SELECTORS);
    const source = firstText(card, SOGOU_SOURCE_SELECTORS) || hostnameOf(url);

    results.push({
      engine: "sogou" as Engine,
      node: card,
      title,
      url,
      snippet,
      source,
    });
  }

  return results;
}
