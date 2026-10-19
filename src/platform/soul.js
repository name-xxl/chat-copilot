/* =====================================================================
 * Soul 平台适配器 —— home.soulapp.cn 的定位、采集与会话身份启发式
 * 选择器配置在 ../selectors.js（页面改版优先改那里）
 * ===================================================================== */
import { SELECTORS } from '../selectors.js';
import { firstTextLine, isVisible } from '../dom.js';
import { hash } from '../utils.js';

// 采集时的裁剪上限
const NAME_MAX_CHARS = 30;            // 会话/对方昵称
const FALLBACK_TEXT_MAX_CHARS = 60;   // 无法识别气泡时的兜底文本
const PEER_PROFILE_MAX_CHARS = 1200;  // 资料卡文本

// 侧栏会话条目里“相对时间”行的特征（Soul 为中文时间表述）
const CONV_TIME_LINE_RE = /刚刚|\d+\s*(?:秒|分钟|小时|天|日)前|昨天|\d{1,2}:\d{2}/;

// 平台能力声明：能力不足时流程层自动降级（见 platform.js / 各 flow 的闸门）
const CAPABILITIES = {
  stableIdentity: true,  // 能产出可靠会话身份键（长期记忆/角色卡的前提）
  roleDetection: true,   // 能区分消息角色（自己/对方/系统）
  peerProfile: true,     // 有对方资料卡可采集
};

function findMessageFlow() {
  return document.querySelector(SELECTORS.messageFlow);
}

function peerCardName() {
  const card = document.querySelector(SELECTORS.peerCard);
  return card ? firstTextLine(card) : '';
}

function stableKeyFromNode(node) {
  const idAttributes = ['data-conv-id', 'data-conversation-id', 'data-user-id', 'data-uid', 'data-id', 'data-key'];
  for (const attr of idAttributes) {
    const value = node.getAttribute(attr);
    if (value && value.trim()) return attr + ':' + value.trim();
  }
  if (node.matches('a[href]')) {
    const href = (node.getAttribute('href') || '').trim();
    if (href && href !== '#' && !/^javascript:/i.test(href) && !/^\/chat\/?$/.test(href)) {
      return 'href:' + href;
    }
  }
  return node.id ? 'dom-id:' + node.id : '';
}

function extractStableKey(element) {
  let node = element;
  while (node && node !== document.body) {
    if (node.matches && node.matches(SELECTORS.convList)) break;
    const ownKey = stableKeyFromNode(node);
    if (ownKey) return ownKey;
    if (node === element) {
      for (const child of node.querySelectorAll('[data-conv-id], [data-conversation-id], [data-user-id], [data-uid], [data-id], [data-key], a[href]')) {
        const childKey = stableKeyFromNode(child);
        if (childKey) return childKey;
      }
    }
    node = node.parentElement;
  }
  return '';
}

// 按昵称找侧栏会话条目：优先走 .conv-name 类名，失败则结构化匹配
// （按钮文本首行等于昵称），不依赖条目内部类名
function findSidebarItemByName(list, name) {
  if (!list || !name) return null;
  const byClass = Array.from(list.querySelectorAll(SELECTORS.convName))
    .find(el => el.textContent.trim() === name);
  if (byClass) return byClass;
  return Array.from(list.querySelectorAll('button'))
    .find(btn => firstTextLine(btn) === name) || null;
}

function getConversationInfo() {
  const list = document.querySelector(SELECTORS.convList);
  let active = list ? list.querySelector(SELECTORS.convActive) : null;
  let nameEl = null;
  if (active) {
    nameEl = active.matches(SELECTORS.convName)
      ? active
      : (active.querySelector(SELECTORS.convName) || active.closest(SELECTORS.convName));
  }

  let name = nameEl ? nameEl.textContent.trim() : '';
  let element = active || nameEl;
  if (!name && active) {
    name = peerCardName() || firstTextLine(active);
    element = active;
  }
  if (!name) {
    // 聊天窗固定头部：始终在场、随切换更新，是 DOM 层最可靠的身份来源
    const header = document.querySelector(SELECTORS.chatHeader);
    const headerName = header ? firstTextLine(header) : '';
    if (headerName) {
      // 若侧栏里有同名会话条目，则改用该条目作元素，便于取稳定键与位置
      if (list) {
        const matched = findSidebarItemByName(list, headerName);
        if (matched) {
          nameEl = matched;
          element = matched;
        }
      }
      name = headerName;
      if (!element) element = header;
    }
  }
  if (!name) {
    name = peerCardName();
    element = document.querySelector(SELECTORS.peerCard);
  }
  // 注意：这里不再回退到“列表第一个会话”。找不到 active 项时宁可判定为未识别，
  // 也不要把当前聊天静默归属给错误的会话（会导致加载/写入别人的长期记忆）。
  if (!name || !element) return { key: '', name: '', reliable: false, element: null };

  const stableKey = extractStableKey(element);
  return {
    // 无稳定属性时按昵称归一键：点击/头部/资料卡各识别层得到同一个键，避免身份抖动导致重复激活与重复判断
    key: stableKey || 'peer:' + name,
    name,
    reliable: !!stableKey,
    element,
  };
}

// 结构化识别“被点击的会话条目”：不依赖具体类名。
// 会话条目是按钮，文本含昵称/预览/相对时间（如“3小时前”）多行；首行视为昵称。
// 在点击发生的瞬间调用（DOM 尚未重渲染），资料卡被虚拟列表卸载也不影响。
function describeConversationItem(target) {
  let node = target;
  while (node && node !== document.body) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node = node.parentElement;
      continue;
    }
    if (node.matches('button') || node.matches('[role="button"]')) {
      const lines = (node.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (lines.length >= 2 && lines.slice(1).some(line => CONV_TIME_LINE_RE.test(line))) {
        const nameEl = node.querySelector(SELECTORS.convName);
        const name = (((nameEl && nameEl.textContent.trim()) || lines[0]).slice(0, NAME_MAX_CHARS));
        const stableKey = extractStableKey(node);
        return {
          key: stableKey || 'peer:' + name,
          name,
          reliable: !!stableKey,
          element: node,
        };
      }
      return null; // 是按钮但不是会话条目（导航、发送等）
    }
    node = node.parentElement;
  }
  return null;
}

// 返回 [{role:'self'|'other'|'system', text, id, el}]，按 DOM 顺序（旧→新）
function collectMessages() {
  const flow = findMessageFlow();
  if (!flow) return [];
  const rows = flow.querySelectorAll(SELECTORS.messageRow);
  const occurrences = Object.create(null);
  const out = [];
  rows.forEach(row => {
    const isSystem = row.classList.contains(SELECTORS.rowSystemMark);
    const role = isSystem ? 'system' : (row.classList.contains(SELECTORS.rowSelfMark) ? 'self' : 'other');
    let text;
    if (isSystem) {
      text = (row.querySelector(SELECTORS.systemBubble)?.innerText || row.innerText || '').trim();
    } else {
      text = (row.querySelector(SELECTORS.textBubble)?.innerText
        || row.querySelector(SELECTORS.emojiBubble)?.innerText
        || '').trim();
      if (!text) {
        if (row.querySelector('img')) text = '[图片]';
        else if (row.innerText) text = row.innerText.trim().slice(0, FALLBACK_TEXT_MAX_CHARS);
      }
    }
    if (!text) return;
    const baseId = role + ':' + hash(text).toString(36);
    const occurrence = occurrences[baseId] || 0;
    occurrences[baseId] = occurrence + 1;
    out.push({ role, text, id: baseId + ':' + occurrence, el: row });
  });
  return out;
}

// 提取对方资料卡文本：匹配度、星球、认证、引力签、共同点等
function collectPeerProfile() {
  const card = document.querySelector(SELECTORS.peerCard);
  if (!card) return '';
  const lines = (card.innerText || '')
    .split('\n').map(s => s.trim()).filter(Boolean)
    .filter(l => l !== '查看主页' && l !== '查看对方主页');
  return lines.join('；').slice(0, PEER_PROFILE_MAX_CHARS);
}

// 找到包含输入框+发送按钮的容器（结构化搜索：可见 contenteditable + 祖先含发送按钮）
function findComposer() {
  const input = Array.from(document.querySelectorAll(SELECTORS.inputBox)).find(isVisible);
  if (!input) return null;
  let el = input;
  while (el && el !== document.body) {
    if (el.querySelector(SELECTORS.sendButton)) return el;
    el = el.parentElement;
  }
  return null;
}

export function createSoulPlatform() {
  return {
    id: 'soul',
    capabilities: CAPABILITIES,
    selectors: SELECTORS,
    findMessageFlow,
    collectMessages,
    getConversationInfo,
    describeConversationItem,
    collectPeerProfile,
    peerCardName,
    findComposer,
  };
}
