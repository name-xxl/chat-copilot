/* =====================================================================
 * 平台门面 —— 消费方统一从这里导入采集/定位接口，不直接碰适配器
 * 适配器按域名选择：拾取配置（soul-ai-platform:<hostname>）> 内置 Soul > 空适配器。
 * 适配器只负责“平台知道的事”；输入写入、滚动保持、健康检查等通用
 * 算法在门面实现，基于适配器提供的原语。
 * ===================================================================== */
import { createSoulPlatform } from './platform/soul.js';
import { createCustomPlatform } from './platform/custom.js';
import { createNullPlatform } from './platform/null.js';
import { normalizePlatformConfig } from './platform-config.js';
import { SOUL_HOSTNAMES } from './selectors.js';
import { safeGet, safeSet, safeDelete, STORAGE_KEYS } from './storage.js';
import { isVisible } from './dom.js';

function currentHostname() {
  return typeof location === 'undefined' ? '' : location.hostname;
}

// 读取并校验当前域名的拾取配置（读取也过 normalize，坏数据当不存在）
function loadCustomConfig(hostname) {
  if (!hostname) return null;
  try {
    const raw = safeGet(STORAGE_KEYS.platformConfigPrefix + hostname);
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizePlatformConfig(parsed, hostname);
  } catch (e) {
    return null;
  }
}

const hostname = currentHostname();
const customConfig = loadCustomConfig(hostname);
const adapter = customConfig
  ? createCustomPlatform(customConfig)
  : (SOUL_HOSTNAMES.includes(hostname) ? createSoulPlatform() : createNullPlatform());

// —— 适配器表面（稳定命名，消费方依赖这些）——
export const adapterId = adapter.id;
export const capabilities = adapter.capabilities;
export const selectors = adapter.selectors;
export const findMessageFlow = adapter.findMessageFlow;
export const collectMessages = adapter.collectMessages;
export const getConversationInfo = adapter.getConversationInfo;
export const describeConversationItem = adapter.describeConversationItem;
export const collectPeerProfile = adapter.collectPeerProfile;
export const peerCardName = adapter.peerCardName;
export const findComposer = adapter.findComposer;

// 当前域名是否已有拾取配置（保存/清除后需刷新页面才会重新选择适配器）
export function hasCustomConfig() { return !!customConfig; }

// 保存拾取配置（强制过 normalize 校验 + 域名匹配当前站点）
export function savePlatformConfig(rawConfig) {
  const normalized = normalizePlatformConfig(rawConfig, currentHostname());
  if (!normalized) return false;
  return safeSet(STORAGE_KEYS.platformConfigPrefix + normalized.domain, normalized);
}

// 清除拾取配置，恢复内置适配器（Soul 域名）或停用（其它域名）
export function clearPlatformConfig(domain) {
  return safeDelete(STORAGE_KEYS.platformConfigPrefix + (domain || currentHostname()));
}

/* ---------- 通用：输入框定位与写入 ---------- */

export function composerInput(composer) {
  if (!composer || !selectors.inputBox) return null;
  return Array.from(composer.querySelectorAll(selectors.inputBox)).find(isVisible) || null;
}

export function setInputText(text, composer) {
  const input = composerInput(composer || findComposer());
  if (!input) return false;
  input.focus();
  const tag = input.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT') {
    // 原生控件走原型 setter（绕过框架劫持的 value 属性）+ input 事件
    const proto = tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(input, text);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return true;
  }
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
// 只在有输入框时判定（会话列表页无从判断）；自定义适配器额外验证消息行命中。
// 结果同时更新 structureBroken，供建议流程在失效期间抑制生成。
export function checkHealth() {
  const failed = [];
  if (findComposer()) {
    const flow = findMessageFlow();
    if (!flow) failed.push('messageFlow');
    else if (typeof adapter.checkStructure === 'function' && !adapter.checkStructure(flow)) failed.push('messageRow');
  }
  structureBroken = failed.length > 0;
  return { ok: failed.length === 0, failed };
}

export function isStructureBroken() { return structureBroken; }
