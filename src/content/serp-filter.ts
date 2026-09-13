// serp-filter.ts — 净化编排：分类 → 隐藏死链 → 注入「已过滤 N 条」徽章 + 隐藏列表
//
// 分层以利于测试与职责清晰：
//   - planFilter()       纯函数：把 SerpResult[] 过一遍 rules.classify，产出
//                        过滤计划（哪些藏、为什么藏、哪些留、计数、按原因聚合）。
//                        不碰 DOM，可单测。
//   - buildHiddenSummary() 纯函数：把计划折叠成隐藏列表摘要（标题 + 中文原因标签）。
//   - executePlan()      DOM 副作用：按计划隐藏死链节点 + 顶部徽章 + 底部
//                        「查看被隐藏内容」折叠条。幂等——重复调用先清掉旧 UI。
//   - restoreHidden()    DOM 副作用：全量还原（撤隐藏 + 撤徽章 + 撤折叠条）。幂等。
//   - runFilter()        便利组合：plan + execute，返回报告。
//
// 隐藏节点的生命周期（藏/还/单条找回）全部住在本文件——一个 owner。
//
// 文件底部是被 content_scripts 直接加载时的运行时入口（chrome 上下文守卫，
// 在 node 测试环境不会执行），负责读 storage 开关、按引擎选解析器、净化、
// 上报计数，并监听开关翻转即时生效（v0.2）。

import { classify, type DeadEndReason, type SerpResult } from "./rules";
import { parseBaiduSerp, parseSogouSerp, detectEngine } from "../lib/serp-dom";

export interface HiddenEntry {
  result: SerpResult;
  reason: DeadEndReason;
}

export interface FilterPlan {
  total: number;
  hidden: HiddenEntry[]; // 命中死链、将被隐藏（带原因，供隐藏列表标注）
  kept: SerpResult[]; // 可读、保留
  count: number;
  reasons: Partial<Record<DeadEndReason, number>>;
}

export interface FilterReport extends FilterPlan {
  engine: "baidu" | "sogou";
}

/**
 * 纯函数过滤计划：分类每条结果，聚合隐藏列表与原因计数。
 * 幂等、无副作用，是单测的稳定接口。
 */
export function planFilter(results: SerpResult[]): FilterPlan {
  const hidden: HiddenEntry[] = [];
  const kept: SerpResult[] = [];
  const reasons: Partial<Record<DeadEndReason, number>> = {};

  for (const r of results) {
    const { verdict, reason } = classify(r);
    if (verdict === "dead-end" && reason) {
      hidden.push({ result: r, reason });
      reasons[reason] = (reasons[reason] ?? 0) + 1;
    } else {
      kept.push(r);
    }
  }

  return {
    total: results.length,
    hidden,
    kept,
    count: hidden.length,
    reasons,
  };
}

// ── 死链原因 → 用户可见中文标签（隐藏列表与 popup 共用的唯一映射） ────
export const REASON_LABELS: Record<DeadEndReason, string> = {
  "baijiahao-ai-slop": "百家号AI文",
  yingxiaohao: "营销号",
  paywall: "付费墙",
  "redirect-middlepage": "跳转中间页",
};

export interface HiddenItemSummary {
  title: string;
  url: string;
  reason: DeadEndReason;
  reasonLabel: string;
}

export interface HiddenSummary {
  count: number;
  items: HiddenItemSummary[];
}

/** 纯函数：把过滤计划折叠成「查看被隐藏内容」所需的最小摘要。 */
export function buildHiddenSummary(plan: FilterPlan): HiddenSummary {
  return {
    count: plan.count,
    items: plan.hidden.map(({ result, reason }) => ({
      title: result.title,
      url: result.url,
      reason,
      reasonLabel: REASON_LABELS[reason],
    })),
  };
}

// ── DOM 注入 UI（徽章 + 隐藏折叠条），全部用内联样式避免污染页面 CSS ──
const BADGE_ID = "cleanserp-filter-badge";
const HIDDEN_STRIP_ID = "cleanserp-hidden-strip";
const HIDDEN_LIST_ID = "cleanserp-hidden-list";
const HIDDEN_ITEM_CLASS = "cleanserp-hidden-item";

const UI_FONT =
  "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif";

function makeBadge(count: number): HTMLElement {
  const el = document.createElement("div");
  el.id = BADGE_ID;
  el.textContent = `净搜已过滤 ${count} 条`;
  el.setAttribute(
    "style",
    [
      "position:fixed",
      "top:0",
      "left:50%",
      "transform:translateX(-50%)",
      "z-index:2147483647",
      "background:#0071E3",
      "color:#fff",
      `font:600 13px/1.4 ${UI_FONT}`,
      "padding:8px 16px",
      "border-radius:0 0 12px 12px",
      "box-shadow:0 2px 10px rgba(0,0,0,0.18)",
      "user-select:none",
      "pointer-events:none",
    ].join(";"),
  );
  return el;
}

function hideNode(node: HTMLElement): void {
  node.style.setProperty("display", "none", "important");
  node.setAttribute("data-cleanserp-hidden", "1");
}

function unhideNode(node: HTMLElement): void {
  node.style.removeProperty("display");
  node.removeAttribute("data-cleanserp-hidden");
}

/** 底部「净搜已隐藏 N 条 · 查看」折叠条；展开后逐条标注原因并可单条恢复。 */
function makeHiddenStrip(plan: FilterPlan): HTMLElement {
  const strip = document.createElement("div");
  strip.id = HIDDEN_STRIP_ID;
  strip.setAttribute(
    "style",
    [
      "position:fixed",
      "bottom:0",
      "left:50%",
      "transform:translateX(-50%)",
      "max-width:92vw",
      "z-index:2147483646",
      "background:#1d1d1f",
      "color:#fff",
      `font:600 13px/1.4 ${UI_FONT}`,
      "padding:8px 16px",
      "border-radius:12px 12px 0 0",
      "box-shadow:0 -2px 10px rgba(0,0,0,0.18)",
      "user-select:none",
    ].join(";"),
  );

  const label = document.createElement("span");
  label.textContent = `净搜已隐藏 ${plan.count} 条`;

  const toggleBtn = document.createElement("a");
  toggleBtn.textContent = "查看";
  toggleBtn.setAttribute("role", "button");
  toggleBtn.setAttribute(
    "style",
    "color:#4da3ff;cursor:pointer;margin-left:6px;text-decoration:underline",
  );

  // 展开后的隐藏列表（默认收起）：一行一条，含标题、原因标签、「显示」按钮。
  const list = document.createElement("div");
  list.id = HIDDEN_LIST_ID;
  list.setAttribute("style", "display:none;margin-top:8px;max-height:40vh;overflow-y:auto");

  const rowStyle =
    "display:flex;align-items:center;gap:8px;padding:4px 0;font:400 12px/1.5 " + UI_FONT;

  const makeRow = (entry: HiddenEntry): HTMLElement => {
    const row = document.createElement("div");
    row.className = HIDDEN_ITEM_CLASS;
    row.setAttribute("style", rowStyle);

    const title = document.createElement("span");
    title.textContent = entry.result.title || entry.result.url;
    title.setAttribute(
      "style",
      "flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap",
    );

    const reasonLabel = document.createElement("span");
    reasonLabel.textContent = REASON_LABELS[entry.reason];
    reasonLabel.setAttribute(
      "style",
      "flex:0 0 auto;font-size:11px;color:#ffd60a;border:1px solid #ffd60a;border-radius:6px;padding:0 6px",
    );

    const showBtn = document.createElement("button");
    showBtn.type = "button";
    showBtn.textContent = "显示";
    showBtn.setAttribute(
      "style",
      "flex:0 0 auto;cursor:pointer;border:1px solid #4da3ff;background:transparent;color:#4da3ff;border-radius:6px;padding:1px 8px;font:inherit",
    );
    showBtn.addEventListener("click", () => {
      // 单条恢复：只还这一个节点，其余隐藏保持；清零时整个折叠条撤掉。
      if (entry.result.node && entry.result.node.style) unhideNode(entry.result.node);
      row.remove();
      const remaining = strip.querySelectorAll(`.${HIDDEN_ITEM_CLASS}`).length;
      if (remaining === 0) {
        strip.remove();
        return;
      }
      label.textContent = `净搜已隐藏 ${remaining} 条`;
    });

    row.append(title, reasonLabel, showBtn);
    return row;
  };

  for (const entry of plan.hidden) {
    list.append(makeRow(entry));
  }

  toggleBtn.addEventListener("click", () => {
    const expanded = list.style.display !== "none";
    list.style.display = expanded ? "none" : "block";
    toggleBtn.textContent = expanded ? "查看" : "收起";
  });

  strip.append(label, toggleBtn, list);
  return strip;
}

/**
 * DOM 副作用：隐藏死链节点 + 顶部注入徽章 + 底部注入隐藏折叠条。
 * 幂等——重复调用先移除旧徽章与旧折叠条（百度 SPA 重渲染会反复触发）。
 */
export function executePlan(plan: FilterPlan): void {
  // 幂等：移除可能已存在的旧徽章与旧折叠条
  document.getElementById(BADGE_ID)?.remove();
  document.getElementById(HIDDEN_STRIP_ID)?.remove();

  for (const { result } of plan.hidden) {
    // 节点可能已不在 DOM 中（搜索页异步重渲染），防御性访问
    if (result.node && result.node.style) {
      hideNode(result.node);
    }
  }

  if (plan.count > 0) {
    // 插到 body 顶部固定显示；body 未就绪时等下次 runFilter 重试即可
    document.body?.prepend(makeBadge(plan.count));
    document.body?.append(makeHiddenStrip(plan));
  }
}

/**
 * DOM 副作用：全量还原被隐藏的结果（开关关闭时调用）。
 * 撤徽章 + 撤折叠条 + 逐节点取消隐藏。幂等。
 */
export function restoreHidden(): void {
  document.getElementById(BADGE_ID)?.remove();
  document.getElementById(HIDDEN_STRIP_ID)?.remove();
  for (const node of Array.from(
    document.querySelectorAll<HTMLElement>("[data-cleanserp-hidden]"),
  )) {
    unhideNode(node);
  }
}

/** 便利组合：plan + execute + 上报。返回报告供调用方（content script）使用。 */
export function runFilter(results: SerpResult[]): FilterReport {
  const plan = planFilter(results);
  executePlan(plan);
  return { ...plan, engine: results[0]?.engine ?? "baidu" };
}

// ─────────────────────────────────────────────────────────────────────
// 运行时入口（content_scripts 上下文）。chrome 未定义时（如 node 单测导入本
// 模块）下方守卫短路，不执行任何 chrome/document 副作用。
// ─────────────────────────────────────────────────────────────────────

const IN_EXTENSION =
  typeof chrome !== "undefined" && typeof chrome.runtime?.id === "string";

async function isEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(["cleanserp_enabled"], (res) => {
        resolve(res?.cleanserp_enabled !== false);
      });
    } catch {
      resolve(true);
    }
  });
}

function reportCount(count: number, engine: "baidu" | "sogou"): void {
  try {
    chrome.runtime.sendMessage({
      type: "CLEANSERP_REPORT_COUNT",
      count,
      engine,
    });
  } catch {
    /* service worker 未就绪时静默；下次 runFilter 会重试 */
  }
}

function purgeAndFilter(): void {
  // 引擎自动识别：百度/搜狗各自选解析器，分类规则引擎无关。
  const parser = detectEngine(location.hostname) === "sogou" ? parseSogouSerp : parseBaiduSerp;
  const results = parser(document);
  if (results.length === 0) return;
  const report = runFilter(results);
  reportCount(report.count, report.engine);
}

if (IN_EXTENSION) {
  // 开关当前值：storage 读取与 onChanged 监听同步维护，供 MutationObserver
  // 去抖回调同步检查（关闭状态下页面重渲染不得重新隐藏）。
  let enabled = true;
  let observerInstalled = false;
  let timer: number | undefined;

  // 搜索页翻页/异步加载会重绘结果——MutationObserver 兜底重跑（去抖）。
  // 只在确认开启后安装：加载时即关闭的用户保持 v0.1 的零副作用语义，
  // 首次切换到开启（无论来自初始读取还是开关翻转）时补装。
  const installObserver = (): void => {
    if (observerInstalled) return;
    observerInstalled = true;
    const observer = new MutationObserver(() => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (enabled) purgeAndFilter();
      }, 400);
    });
    const root = document.getElementById("content_left") || document.body;
    observer.observe(root, { childList: true, subtree: true });
  };

  void isEnabled().then((on) => {
    enabled = on;
    if (on) {
      purgeAndFilter();
      installObserver();
    }
  });

  // 开关翻转即时生效（v0.2）：关 = 全量还原已隐藏卡片 + 撤 UI；开 = 重跑过滤。
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !("cleanserp_enabled" in changes)) return;
    enabled = changes.cleanserp_enabled?.newValue !== false;
    if (enabled) {
      purgeAndFilter();
      installObserver();
    } else {
      restoreHidden();
    }
  });
}
