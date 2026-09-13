// rules.ts — CN-SERP 死链分类器（启发式规则，非 ML）
//
// 这是净搜的核心原语：对一条 SERP 结果给出 usable / dead-end 判定 + 死链原因。
// 判定完全基于 url / title / snippet / source 文本特征，不触碰 DOM，因此可独立单测。
//
// 规则集刻意保持保守、可插拔：v0.1 只覆盖四类死链（百家号AI文 / 营销号 /
// 付费墙 / 跳转中间页）。域名列表短小、避免误杀；v0.2 / Pro 层会扩充并允许
// 用户自定义。百度 SERP DOM 频繁变更属于结构性维护成本——改 rules.ts 即可。

export type Engine = "baidu" | "sogou";
export type Verdict = "usable" | "dead-end";
export type DeadEndReason =
  | "baijiahao-ai-slop"
  | "yingxiaohao"
  | "paywall"
  | "redirect-middlepage";

/** 一条 SERP 结果的最小判定输入。node 仅用于后续隐藏，分类阶段不读它。 */
export interface SerpResult {
  engine: Engine;
  node: HTMLElement;
  title: string;
  url: string;
  snippet: string;
  source: string; // 可见来源/域名标签，如「百家号」「xx说科技」
}

export interface Classification {
  verdict: Verdict;
  reason?: DeadEndReason;
}

/** 从 URL 字符串中提取 host（小写、去 www 前缀的辅助归一）。 */
export function hostnameOf(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    // 可见 cite 文本常常只是裸域名，按裸域名兜底
    return url.toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  }
}

// ── 百家号 AI 文体特征 ───────────────────────────────────────────────
// 文心一言之后的百家号被大量 AI 模板化「盘点 / 一文读懂」列表文淹没——
// 这类文 SEO 到 SERP 顶部、点进去是凑字数的死链。匹配 title + snippet。
const AI_LISTICLE_PATTERNS: RegExp[] = [
  /一文读懂/,
  /一文看懂/,
  /盘点\s*\d/,
  /\d+\s*个(方法|技巧|原因|方式|真相|误区|建议)/,
  /建议(你)?收藏/,
  /赶紧收藏/,
  /看完这篇/,
  /保姆级/,
  /超全(整理|汇总|盘点)/,
  /全网最全/,
];

// ── 营销号域名（保守列表，仅作信号；source 标签优先） ───────────────
// 这里只放公认的、以营销号内容农场为主要产出的小站，避免误杀主站。
// 大平台（搜狐/新浪/百家号）不整站封，只按 source/特征规则处理。
//
// 不变式：所有域名集合一律存 hostnameOf() 输出的规范形式（小写、无 www.
// 前缀）——classify() 只按规范 host 查集合，写带 www. 的键等于死规则
//（v0.1 的 chinaz.com / niaogebiji.com 即此缺陷），全量覆盖测试钉死它。
export const YINGXIAOHAO_DOMAINS = new Set<string>([
  "yixieshi.com",
  "chinaz.com",
  "sanv.cn",
  "niaogebiji.com",
]);

const YINGXIAOHAO_SOURCE_HINTS = ["营销号", "广告", "推广"];

// ── 付费墙 ───────────────────────────────────────────────────────────
// 以可见 cite 域名 + snippet 登录墙特征双信号判定，避免误杀。
export const PAYWALL_DOMAINS = new Set<string>([
  "36kr.com",
  "jianshu.com",
]);

const PAYWALL_SNIPPET_HINTS = [
  "登录后查看",
  "登录查看全文",
  "开通会员",
  "VIP专享",
  "付费阅读",
  "立即开通",
  "加入会员",
];

// ── 跳转中间页 ───────────────────────────────────────────────────────
// 结果链接本身指向一个跳转/短链服务（非百度 link 包装，而是终态仍是中间页）。
const REDIRECT_MIDDLEPAGE_PATTERNS: RegExp[] = [
  /^https?:\/\/(jump\.bdimg\.com|go\.baidu\.com)\//,
  /^https?:\/\/(url\.cn|dwz\.cn|t\.cn|mr\.baidu\.com)\//,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/** 核心分类器。纯函数：相同输入恒定输出，无副作用。 */
export function classify(r: SerpResult): Classification {
  const host = hostnameOf(r.url);
  const haystack = `${r.title} ${r.snippet}`;

  // 1. 百家号 AI 文：百家号域名 + AI 列表文模板
  if (host === "baijiahao.baidu.com" && matchesAny(haystack, AI_LISTICLE_PATTERNS)) {
    return { verdict: "dead-end", reason: "baijiahao-ai-slop" };
  }

  // 2. 营销号：域名命中 或 source 标签命中
  if (
    YINGXIAOHAO_DOMAINS.has(host) ||
    YINGXIAOHAO_SOURCE_HINTS.some((h) => r.source.includes(h))
  ) {
    return { verdict: "dead-end", reason: "yingxiaohao" };
  }

  // 3. 付费墙：域名命中 或 snippet 登录墙特征
  if (
    PAYWALL_DOMAINS.has(host) ||
    PAYWALL_SNIPPET_HINTS.some((h) => r.snippet.includes(h))
  ) {
    return { verdict: "dead-end", reason: "paywall" };
  }

  // 4. 跳转中间页：URL 本身是已知跳转/短链服务
  if (matchesAny(r.url, REDIRECT_MIDDLEPAGE_PATTERNS)) {
    return { verdict: "dead-end", reason: "redirect-middlepage" };
  }

  return { verdict: "usable" };
}
