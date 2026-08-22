// service-worker.ts — MV3 background service worker
//
// m1 职责（已实现）：
//   - 安装时写默认开关（cleanserp_enabled = true）
//   - 接收 content script 上报的过滤计数，按 tab 存 chrome.storage.local
//   - 把计数显示到工具栏徽标文字（chrome.action.setBadgeText）
//   - 响应 popup 的 GET_STATE 查询
//
// m2 职责（存根，未实现）：on/off 开关翻转 + 搜狗 SERP 计数。
//   TOGGLE 处理器返回 { ok:false, reason:"v0.2" }，popup 据此显示路线图提示。

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
      // m2 存根：on/off 开关翻转属于 m2 范围，v0.1 不实现。
      sendResponse?.({ ok: false, reason: "v0.2" });
      break;
    }
  }
});
