/* =====================================================================
 * 自定义平台适配器 —— 由拾取向导产出的配置驱动（platform-config.js 的归一结果）
 * 与 soul.js 实现同一表面；选择器全部走 fallback 链（逐项尝试，首个命中者生效）。
 * 身份来源三种模式：sidebar（侧栏条目+激活差分）/ header（聊天头）/ url（路径即身份）。
 * ===================================================================== */
import { firstTextLine, isVisible, inputAreaWrapper } from '../dom.js';
import { hash } from '../utils.js';

const CUSTOM_LIMITS = {
  NAME_MAX_CHARS: 30,            // 会话/对方昵称
  FALLBACK_TEXT_MAX_CHARS: 60,   // 无法识别文本载体时的兜底文本
  PEER_PROFILE_MAX_CHARS: 1200,  // 资料卡文本
};

// 提取稳定键时认可的 id 类属性（与 soul 适配器同一启发式，通用够用）
const STABLE_ID_ATTRS = ['data-conv-id', 'data-conversation-id', 'data-user-id', 'data-uid', 'data-id', 'data-key'];

const EMPTY_INFO = { key: '', name: '', reliable: false, element: null };

function safeMatches(el, sel) {
  if (!el || !sel) return false;
  try { return el.matches(sel); } catch (e) { return false; }
}

function stableKeyFromNode(node) {
  for (const attr of STABLE_ID_ATTRS) {
    const value = node.getAttribute(attr);
    if (value && value.trim()) return attr + ':' + value.trim();
  }
  if (safeMatches(node, 'a[href]')) {
    const href = (node.getAttribute('href') || '').trim();
    if (href && href !== '#' && !/^javascript:/i.test(href)) return 'href:' + href;
  }
  return node.id ? 'dom-id:' + node.id : '';
}

// 沿父链（到 body 为止）找稳定键；条目自身的后代也查一遍（图标内嵌 id 属性的情况）
function extractStableKey(element) {
  let node = element;
  while (node && node !== document.body) {
    const ownKey = stableKeyFromNode(node);
    if (ownKey) return ownKey;
    if (node === element) {
      for (const child of node.querySelectorAll(STABLE_ID_ATTRS.map(a => '[' + a + ']').join(', ') + ', a[href]')) {
        const childKey = stableKeyFromNode(child);
        if (childKey) return childKey;
      }
    }
    node = node.parentElement;
  }
  return '';
}

function styleMatches(el, rule) {
  try { return getComputedStyle(el)[rule.prop] === rule.value; } catch (e) { return false; }
}

function selfMatchOf(row, rule) {
  if (!rule) return false;
  return rule.kind === 'selector' ? safeMatches(row, rule.selector) : styleMatches(row, rule);
}

export function createCustomPlatform(config) {
  // 链 → 首个当前命中的选择器（消费方按单字符串使用，如 chat-monitor 的 matches）
  function pickFromChain(chain) {
    if (!chain) return '';
    for (const sel of chain) {
      try { if (document.querySelector(sel)) return sel; } catch (e) { /* 非法选择器跳过 */ }
    }
    return chain[0];
  }

  function chainQuery(chain, root) {
    if (!chain) return null;
    for (const sel of chain) {
      try {
        const el = (root || document).querySelector(sel);
        if (el) return el;
      } catch (e) { /* 非法选择器跳过 */ }
    }
    return null;
  }

  function firstVisible(chain) {
    if (!chain) return null;
    for (const sel of chain) {
      try {
        const input = Array.from(document.querySelectorAll(sel)).find(isVisible);
        if (input) return input;
      } catch (e) { /* 非法选择器跳过 */ }
    }
    return null;
  }

  function findMessageFlow() { return chainQuery(config.messageFlow); }

  // 侧栏当前激活的会话条目：有 activeMatch 差分规则时按规则找；
  // 没有规则则无法判定激活项——宁可判未识别，也不要归属到错误会话（对齐 soul 的防串记忆原则）
  function activeEntry() {
    if (!config.identity.entry) return null;
    let entries = [];
    try { entries = Array.from(document.querySelectorAll(pickFromChain(config.identity.entry))); } catch (e) { return null; }
    const rule = config.identity.activeMatch;
    if (!rule) return null;
    return entries.find(entry => selfMatchOf(entry, rule)) || null;
  }

  function infoFromNode(node) {
    const name = firstTextLine(node).slice(0, CUSTOM_LIMITS.NAME_MAX_CHARS);
    const stableKey = extractStableKey(node);
    return { key: stableKey || 'peer:' + name, name, reliable: !!stableKey, element: node };
  }

  function getConversationInfo() {
    const identity = config.identity;
    if (identity.mode === 'url') {
      // URL 即身份：路径含会话 ID 的平台最可靠（ROADMAP P4 的第二平台选型依据）
      return { key: 'url:' + location.pathname + location.search, name: headerName(), reliable: true, element: null };
    }
    if (identity.mode === 'header') {
      const header = chainQuery(identity.header);
      if (!header || !firstTextLine(header)) return EMPTY_INFO;
      return infoFromNode(header);
    }
    const entry = activeEntry();
    if (!entry || !firstTextLine(entry)) return EMPTY_INFO;
    return infoFromNode(entry);
  }

  function headerName() {
    const header = config.identity.header ? chainQuery(config.identity.header) : null;
    return header ? firstTextLine(header).slice(0, CUSTOM_LIMITS.NAME_MAX_CHARS) : '';
  }

  // 点击瞬间沿父链找会话条目（点击意图采集，对齐 soul 的 describeConversationItem）
  function describeConversationItem(target) {
    if (config.identity.mode !== 'sidebar' || !config.identity.entry) return null;
    const entrySel = pickFromChain(config.identity.entry);
    let node = target;
    while (node && node !== document.body) {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        node = node.parentElement;
        continue;
      }
      if (safeMatches(node, entrySel)) return infoFromNode(node);
      node = node.parentElement;
    }
    return null;
  }

  // 返回 [{role:'self'|'other', text, id, el}]，按 DOM 顺序（旧→新）；自定义平台无 system 角色
  function collectMessages() {
    const flow = findMessageFlow();
    if (!flow) return [];
    const rows = flow.querySelectorAll(pickFromChain(config.messageRow));
    const occurrences = Object.create(null);
    const out = [];
    rows.forEach(row => {
      const role = selfMatchOf(row, config.selfMatch) ? 'self' : 'other';
      let text = '';
      if (config.textBubble) {
        for (const sel of config.textBubble) {
          const bubble = row.querySelector(sel);
          if (bubble && bubble.innerText && bubble.innerText.trim()) {
            text = bubble.innerText.trim();
            break;
          }
        }
      }
      if (!text) {
        if (row.querySelector('img')) text = '[图片]';
        else if (row.innerText) text = row.innerText.trim().slice(0, CUSTOM_LIMITS.FALLBACK_TEXT_MAX_CHARS);
      }
      if (!text) return;
      const baseId = role + ':' + hash(text).toString(36);
      const occurrence = occurrences[baseId] || 0;
      occurrences[baseId] = occurrence + 1;
      out.push({ role, text, id: baseId + ':' + occurrence, el: row });
    });
    return out;
  }

  function collectPeerProfile() {
    const card = chainQuery(config.peerCard);
    if (!card) return '';
    return (card.innerText || '')
      .split('\n').map(s => s.trim()).filter(Boolean)
      .join('；').slice(0, CUSTOM_LIMITS.PEER_PROFILE_MAX_CHARS);
  }

  function peerCardName() {
    const card = chainQuery(config.peerCard);
    return card ? firstTextLine(card) : '';
  }

  // 输入区：配置了发送按钮时走"祖先含发送按钮"结构启发式；否则按高度同量级向上
  // 取输入区外壳（含编辑器盒子/操作列/底栏的多层包装）——只返回输入框本身会把
  // 建议条挂进编辑器盒子内部，主色采样也看不到旁边的发送键（抖音的发送键是 SVG）
  function findComposer() {
    const input = firstVisible(config.inputBox);
    if (!input) return null;
    if (config.sendButton) {
      const sendSel = pickFromChain(config.sendButton);
      let el = input;
      while (el && el !== document.body) {
        try { if (el.querySelector(sendSel)) return el; } catch (e) { break; }
        el = el.parentElement;
      }
    }
    return inputAreaWrapper(input);
  }

  // 结构自检：消息流容器里能找到消息行（门面 checkHealth 的自定义适配器扩展）
  function checkStructure(flow) {
    try { return !!flow.querySelector(pickFromChain(config.messageRow)); } catch (e) { return false; }
  }

  return {
    id: 'custom:' + config.domain,
    capabilities: config.capabilities,
    // 消费方按单字符串使用选择器（chat-monitor 的 matches / theme 的采样点定位）
    selectors: {
      get messageFlow() { return pickFromChain(config.messageFlow); },
      get messageRow() { return pickFromChain(config.messageRow); },
      get textBubble() { return pickFromChain(config.textBubble); },
      get inputBox() { return pickFromChain(config.inputBox); },
      get sendButton() { return config.sendButton ? pickFromChain(config.sendButton) : null; },
      get peerCard() { return pickFromChain(config.peerCard); },
      get accentSample() { return config.accentSample ? pickFromChain(config.accentSample) : null; },
    },
    findMessageFlow,
    collectMessages,
    getConversationInfo,
    describeConversationItem,
    collectPeerProfile,
    peerCardName,
    findComposer,
    checkStructure,
  };
}
