// service-worker.ts — MV3 background service worker
//
// 职责：
//   - 安装时写默认开关（cleanserp_enabled = true）
//   - 接收 content script 上报的过滤计数（含真实引擎），按 tab 存 chrome.storage.local
//   - 把计数显示到工具栏徽标文字（chrome.action.setBadgeText）
//   - 响应 popup 的 GET_STATE 查询
//   - 响应 popup 的 TOGGLE 翻转（v0.2 起实现）：翻转持久化开关并回传新状态；
//     content script 通过 chrome.storage.onChanged 即时还原/重跑过滤。

type CountMessage = {
  type: "CLEANSERP_REPORT_COUNT";
  count: number;
  engine: "baidu" | "sogou";
};

type GetStateMessage = { type: "CLEANSERP_GET_STATE"; tabId: number };

type ToggleMessage = { type: "CLEANSERP_TOGGLE" };

type Inbound = CountMessage | GetStateMessage | ToggleMessage;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["cleanserp_enabled"], (res) => {
    if (res?.cleanserp_enabled === undefined) {
      chrome.storage.local.set({ cleanserp_enabled: true });
    }
  });
});

chrome.runtime.onMessage.addListener((msg: Inbound, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object" || !("type" in msg)) return;

  switch (msg.type) {
    case "CLEANSERP_REPORT_COUNT": {
      const { count, engine } = msg as CountMessage;
      const tabId = _sender.tab?.id;
      if (typeof tabId === "number") {
        // 按页签存计数，popup 查当前页签计数用
        chrome.storage.local.set({
          [`cleanserp_count_${tabId}`]: count,
          [`cleanserp_engine_${tabId}`]: engine,
        });
        chrome.action.setBadgeText({ tabId, text: count > 0 ? String(count) : "" });
        chrome.action.setBadgeBackgroundColor({ tabId, color: "#0071E3" });
      }
      sendResponse?.({ ok: true });
      break;
    }
    case "CLEANSERP_GET_STATE": {
      const { tabId } = msg as GetStateMessage;
      chrome.storage.local.get(
        ["cleanserp_enabled", `cleanserp_count_${tabId}`, `cleanserp_engine_${tabId}`],
        (res) => {
          sendResponse?.({
            enabled: res?.cleanserp_enabled !== false,
            count: res?.[`cleanserp_count_${tabId}`] ?? 0,
            engine: res?.[`cleanserp_engine_${tabId}`] ?? "baidu",
          });
        },
      );
      return true; // 异步 sendResponse
    }
    case "CLEANSERP_TOGGLE": {
      // 翻转持久化开关。content script 监听 storage.onChanged 即时生效，
      // 无需刷新页面；popup 拿 { ok, enabled } 做乐观渲染。
      chrome.storage.local.get(["cleanserp_enabled"], (res) => {
        const enabled = res?.cleanserp_enabled !== false;
        chrome.storage.local.set({ cleanserp_enabled: !enabled }, () => {
          sendResponse?.({ ok: true, enabled: !enabled });
        });
      });
      return true; // 异步 sendResponse
    }
  }
});
