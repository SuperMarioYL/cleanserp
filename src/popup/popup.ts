// popup.ts — 扩展弹窗逻辑
//
// m1：查询当前页签的过滤计数并渲染；on/off 开关属于 m2（按钮 disabled）。
// 全程零配置：无账号、无设置页，开关之外不引入任何配置 UI。

interface StateResponse {
  enabled: boolean;
  count: number;
  engine: "baidu" | "sogou";
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderState(state: StateResponse): void {
  setText("count-num", String(state.count));
  setText("status-text", state.enabled ? "已开启 · 净搜运行中" : "已关闭");
  const dot = document.getElementById("status-dot");
  if (dot) dot.dataset.on = state.enabled ? "1" : "0";
}

async function load(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id ?? 0;
  const state = await send<StateResponse>({ type: "CLEANSERP_GET_STATE", tabId });
  if (state) renderState(state);
  else setText("status-text", "未连接到净搜服务");
}

// sendMessage 的回调形态包成 Promise，避免在消息对象上误用泛型参数。
function send<T = unknown>(message: unknown): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (resp: unknown) => {
        // MV3 回调可能为 undefined（service worker 未就绪 / 无监听器）
        resolve(resp as T | undefined);
      });
    } catch {
      resolve(undefined);
    }
  });
}

document.getElementById("toggle")?.addEventListener("click", () => {
  // m2 存根：开关翻转属于 m2，v0.1 不实现。
  setText("status-text", "开关将于 v0.2 上线");
});

document.getElementById("roadmap-link")?.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "https://github.com/SuperMarioYL/cleanserp" });
});

load();
