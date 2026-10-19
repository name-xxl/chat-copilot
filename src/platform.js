/* =====================================================================
 * 平台门面 —— 消费方统一从这里导入采集/定位接口，不直接碰适配器
 * 当前绑定 Soul 适配器；多平台化后按域名选择适配器（见 ROADMAP P3/P4）
 * 适配器只负责“平台知道的事”；输入写入、滚动保持、健康检查等通用
 * 算法在门面实现，基于适配器提供的原语。
 * ===================================================================== */
import { createSoulPlatform } from './platform/soul.js';
import { isVisible } from './dom.js';

const adapter = createSoulPlatform();

// —— 适配器表面（稳定命名，消费方依赖这些）——
export const capabilities = adapter.capabilities;
export const selectors = adapter.selectors;
export const findMessageFlow = adapter.findMessageFlow;
export const collectMessages = adapter.collectMessages;
export const getConversationInfo = adapter.getConversationInfo;
export const describeConversationItem = adapter.describeConversationItem;
export const collectPeerProfile = adapter.collectPeerProfile;
export const peerCardName = adapter.peerCardName;
export const findComposer = adapter.findComposer;

/* ---------- 通用：输入框定位与写入 ---------- */

export function composerInput(composer) {
  if (!composer) return null;
  return Array.from(composer.querySelectorAll(selectors.inputBox)).find(isVisible) || null;
}

export function setInputText(text, composer) {
  const input = composerInput(composer || findComposer());
  if (!input) return false;
  input.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(input);
  sel.removeAllRanges();
  sel.addRange(range);
  if (!document.execCommand('insertText', false, text)) {
    input.innerHTML = '';
    input.textContent = text;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
  return true;
}

export function fillInput(text) { return setInputText(text); }

/* ---------- 通用：聊天滚动保持 ---------- */

function findChatScroller() {
  let el = findMessageFlow();
  while (el && el !== document.body) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
    el = el.parentElement;
  }
  return null;
}

export function captureChatScroll() {
  const el = findChatScroller();
  if (!el) return null;
  return {
    el,
    pinned: el.scrollHeight - el.scrollTop - el.clientHeight < 120,
  };
}

export function restoreChatScroll(state) {
  if (!state || !state.pinned) return;
  requestAnimationFrame(() => { state.el.scrollTop = state.el.scrollHeight; });
}

/* ---------- 选择器健康检查 ---------- */

let structureBroken = false;

// 聊天窗在而消息流缺失 → 页面结构大概率已改版。
// 只在有输入框时判定（会话列表页无从判断）；结果同时更新 structureBroken，
// 供建议流程在失效期间抑制生成。
export function checkHealth() {
  const ok = !findComposer() || !!findMessageFlow();
  structureBroken = !ok;
  return { ok, failed: ok ? [] : ['messageFlow'] };
}

export function isStructureBroken() { return structureBroken; }
