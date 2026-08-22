// serp-filter.ts — 净化编排：分类 → 隐藏死链 → 注入「已过滤 N 条」徽章
//
// 分两层以利于测试与职责清晰：
//   - planFilter()  纯函数：把 SerpResult[] 过一遍 rules.classify，产出过滤计划
//                       （哪些藏、哪些留、计数、按原因聚合）。不碰 DOM，可单测。
//   - executePlan() DOM 副作用：按计划隐藏死链节点 + 顶部注入徽章。
//   - runFilter()   便利组合：plan + execute，返回报告。
//
// 文件底部是被 content_scripts 直接加载时的运行时入口（chrome 上下文守卫，
// 在 node 测试环境不会执行），负责读 storage 开关、解析、净化、上报计数。

import { classify, type DeadEndReason, type SerpResult } from "./rules";
import { parseBaiduSerp } from "../lib/serp-dom";

export interface FilterPlan {
  total: number;
  hidden: SerpResult[]; // 命中死链、将被隐藏
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
  const hidden: SerpResult[] = [];
  const kept: SerpResult[] = [];
  const reasons: Partial<Record<DeadEndReason, number>> = {};

  for (const r of results) {
    const { verdict, reason } = classify(r);
    if (verdict === "dead-end" && reason) {
      hidden.push(r);
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

const BADGE_ID = "cleanserp-filter-badge";

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
      "font:600 13px/1.4 -apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif",
      "padding:8px 16px",
      "border-radius:0 0 12px 12px",
      "box-shadow:0 2px 10px rgba(0,0,0,0.18)",
      "user-select:none",
      "pointer-events:none",
    ].join(";"),
  );
  return el;
}

/**
 * DOM 副作用：隐藏死链节点 + 顶部注入徽章。幂等——重复调用先移除旧徽章。
 */
export function executePlan(plan: FilterPlan): void {
  // 幂等：移除可能已存在的旧徽章
  document.getElementById(BADGE_ID)?.remove();

  for (const r of plan.hidden) {
    // 节点可能已不在 DOM 中（百度异步重渲染），防御性访问
    if (r.node && r.node.style) {
      r.node.style.setProperty("display", "none", "important");
      r.node.setAttribute("data-cleanserp-hidden", "1");
    }
  }

  if (plan.count > 0) {
    const badge = makeBadge(plan.count);
    // 插到 body 顶部固定显示；body 未就绪时等下次 runFilter 重试即可
    document.body?.prepend(badge);
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
  // v0.1 默认开启；on/off 开关 UI 属于 m2 范围（见路线图）。
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

function reportCount(count: number): void {
  try {
    chrome.runtime.sendMessage({
      type: "CLEANSERP_REPORT_COUNT",
      count,
      engine: "baidu",
    });
  } catch {
    /* service worker 未就绪时静默；下次 runFilter 会重试 */
  }
}

function purgeAndFilter(): void {
  const results = parseBaiduSerp(document);
  if (results.length === 0) return;
  const report = runFilter(results);
  reportCount(report.count);
}

if (IN_EXTENSION) {
  // document_idle 已注入；直接跑一次，并监听百度 SPA 式翻页/重渲染。
  void isEnabled().then((on) => {
    if (!on) return;
    purgeAndFilter();

    // 百度翻页/异步加载会重绘结果——MutationObserver 兜底重跑（去抖）。
    let timer: number | undefined;
    const observer = new MutationObserver(() => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(purgeAndFilter, 400);
    });
    const root = document.getElementById("content_left") || document.body;
    observer.observe(root, { childList: true, subtree: true });
  });
}
