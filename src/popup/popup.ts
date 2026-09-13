// popup.ts — 扩展弹窗逻辑
//
// 查询当前页签的过滤计数并渲染；on/off 开关（v0.2 起可用）翻转持久化
// 状态，content script 监听 storage 变更即时还原/重跑过滤。
// 全程零配置：无账号、无设置页，开关之外不引入任何配置 UI。

interface StateResponse {
  enabled: boolean;
  count: number;
  engine: "baidu" | "sogou";
}

interface ToggleResponse {
  ok: boolean;
  enabled: boolean;
}

let lastState: StateResponse | undefined;

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderState(state: StateResponse): void {
  lastState = state;
  setText("count-num", String(state.count));
  setText("status-text", state.enabled ? "已开启 · 净搜运行中" : "已关闭");
  setText("toggle-label", state.enabled ? "净化开关 · 开" : "净化开关 · 关");
  const dot = document.getElementById("status-dot");
  if (dot) dot.dataset.on = state.enabled ? "1" : "0";
  const toggle = document.getElementById("toggle");
  if (toggle) toggle.setAttribute("aria-pressed", state.enabled ? "true" : "false");
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

document.getElementById("toggle")?.addEventListener("click", async () => {
  // 乐观更新：TOGGLE 往返期间先按目标态渲染；响应到达后以 worker 回传的真值纠正。
  if (lastState) renderState({ ...lastState, enabled: !lastState.enabled });
  const resp = await send<ToggleResponse>({ type: "CLEANSERP_TOGGLE" });
  if (resp?.ok && lastState) renderState({ ...lastState, enabled: resp.enabled });
});

document.getElementById("roadmap-link")?.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "https://github.com/SuperMarioYL/cleanserp" });
});

load();
