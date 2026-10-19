/* =====================================================================
 * 会话身份解析 —— 三层机制，不再依赖资料卡是否在 DOM 里：
 *   1) 点击意图：用户点开会话的瞬间抓取条目身份（最可靠）
 *   2) DOM 识别：资料卡 / 会话列表标记（可见时使用）
 *   3) 连续性：现有身份的消息锚点还在，就沿用
 * ===================================================================== */
import { getConversationInfo, describeConversationItem, findComposer } from './platform.js';
import { state } from './state.js';
import { log } from './utils.js';
import { TIMING } from './constants.js';

let clickCandidate = null;

export function installClickCapture() {
  document.addEventListener('click', event => {
    try {
      const item = describeConversationItem(event.target);
      if (!item) return;
      clickCandidate = Object.assign({ at: Date.now() }, item);
      log('点击会话: ' + item.name);
    } catch (e) { /* 不影响页面点击 */ }
  }, true);
}

function freshCandidate() {
  if (!clickCandidate) return null;
  if (Date.now() - clickCandidate.at > TIMING.CLICK_CANDIDATE_TTL) {
    clickCandidate = null;
    return null;
  }
  return clickCandidate;
}

// 连续性：已知最后一条消息仍挂在消息流里，说明当前视图仍是这个会话
function identityAnchored() {
  if (!state.conversation.key) return false;
  return !state.conversation.lastRow || state.conversation.lastRow.isConnected;
}

export function resolveCurrentConversation() {
  const candidate = freshCandidate();
  if (candidate && candidate.key) {
    return {
      key: candidate.key,
      name: candidate.name,
      reliable: candidate.reliable,
      element: candidate.element,
    };
  }
  const info = getConversationInfo();
  if (info.key) return info;
  if (identityAnchored()) {
    return {
      key: state.conversation.key,
      name: state.conversation.name,
      reliable: state.conversation.reliable,
      element: state.conversation.element,
    };
  }
  // 新会话兜底：聊天窗已打开（有输入框）但所有识别层都未命中——
  // 典型场景是从匹配页直接进入的新对话。给临时身份让打招呼建议可用；
  // 正式身份出现后自动切换，draft 身份不写长期记忆。
  if (findComposer()) {
    return { key: 'draft', name: '', reliable: false, element: null };
  }
  return info;
}

export function currentPeerName() {
  return resolveCurrentConversation().name || '对方';
}
