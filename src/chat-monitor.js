/* =====================================================================
 * 会话监测 —— 消息基线、会话切换、MutationObserver、挂载维持
 * 向导打开期间抑制结构错误提示（不渲染 chips，只取消在途请求）
 * ===================================================================== */
import { sameConversation } from './dom.js';
import {
  findMessageFlow, findComposer, getConversationInfo, collectMessages, selectors, checkHealth,
} from './platform.js';
import { resolveCurrentConversation } from './conversation.js';
import { state, resetInsightCache, resetCharacterCache } from './state.js';
import { loadConversationMemory, emptyMemory } from './memory.js';
import {
  mountUI, unmountUI, syncHostLayout, isCollapsed, ui, refreshCardModal, renderChips,
  isWizardOpen, renderRepickChip,
} from './ui.js';
import {
  cancelSuggestions, resetSuggestionState, loadSuggestions, scheduleSuggestionRefresh, hasActiveRequest,
} from './suggestion-flow.js';
import { cancelCharacterRequest } from './cards-flow.js';
import { cancelMemoryRequest, scheduleMemorySummary } from './memory-flow.js';
import { log, logWarn } from './utils.js';
import { TIMING } from './constants.js';

let msgObserver = null;
let observedFlow = null;
let lastUrl = location.href;
let scanTimer = null;
let baselineTimer = null;
let pendingRows = new Set();

function clearPendingMessageScan() {
  clearTimeout(scanTimer);
  scanTimer = null;
  pendingRows.clear();
}

function updateMessageBaseline() {
  const msgs = collectMessages();
  const last = msgs[msgs.length - 1];
  state.conversation.lastRow = last ? last.el : null;
}

function restartBaselineSettle() {
  clearTimeout(baselineTimer);
  state.conversation.baselineReady = false;
  baselineTimer = setTimeout(() => {
    baselineTimer = null;
    if (!sameConversation(resolveCurrentConversation(), state.conversation)) return;
    updateMessageBaseline();
    state.conversation.baselineReady = true;
    log('消息基线已建立');
    // 基线确认内容归属后再生成本轮建议，避免把上一会话的消息喂给新会话
    if (!isCollapsed()) loadSuggestions(false);
  }, TIMING.BASELINE_SETTLE_MS);
}

function establishMessageBaseline() {
  updateMessageBaseline();
  restartBaselineSettle();
}

export let clearDebounce = null;
let unmountDebounce = null;
let brokenStrikes = 0;
let brokenAnnounced = false;

// 结构健康巡检：聊天窗在而消息流连续两次缺失才判定改版失效（防切换瞬间误报），
// 恢复命中即自动重新生成建议。结构失效的唯一事实来源是 platform 的 isStructureBroken()；
// 向导打开期间只取消在途请求，不渲染任何提示，避免干扰拾取。
function watchStructureHealth() {
  const { ok } = checkHealth();
  if (ok) {
    if (brokenAnnounced) {
      brokenAnnounced = false;
      loadSuggestions(false);
    }
    brokenStrikes = 0;
    return;
  }
  if (brokenAnnounced) return;
  brokenStrikes++;
  if (brokenStrikes >= 2) {
    brokenAnnounced = true;
    logWarn('选择器健康检查未通过：聊天窗在而消息流缺失，页面结构可能已改版');
    cancelSuggestions();
    if (isWizardOpen()) return;
    renderChips(['页面结构已变化，部分功能暂时失效'], 'err');
    renderRepickChip();
  }
}

export function activateConversation(info) {
  clearTimeout(clearDebounce);
  clearDebounce = null;
  cancelSuggestions();
  clearPendingMessageScan();
  resetSuggestionState();
  resetInsightCache();
  resetCharacterCache();
  cancelCharacterRequest();
  cancelMemoryRequest();
  state.activeMemory = loadConversationMemory(info);
  refreshCardModal();
  state.conversation.key = info.key;
  state.conversation.name = info.name;
  state.conversation.reliable = info.reliable;
  state.conversation.element = info.element;
  establishMessageBaseline();
}

function clearConversation() {
  cancelSuggestions();
  clearPendingMessageScan();
  resetSuggestionState();
  clearTimeout(baselineTimer);
  baselineTimer = null;
  resetInsightCache();
  resetCharacterCache();
  cancelCharacterRequest();
  cancelMemoryRequest();
  state.activeMemory = emptyMemory();
  refreshCardModal();
  state.conversation.key = '';
  state.conversation.name = '';
  state.conversation.reliable = false;
  state.conversation.element = null;
  state.conversation.lastRow = null;
  state.conversation.baselineReady = false;
}

function onNewMessages(addedRows) {
  const info = resolveCurrentConversation();
  if (!sameConversation(info, state.conversation)) return;
  const candidates = new Set(addedRows || []);
  const hasFreshPeerMessage = () => collectMessages()
    .some(m => candidates.has(m.el) && m.role === 'other');

  if (!state.conversation.baselineReady) {
    if (hasFreshPeerMessage()) scheduleSuggestionRefresh();
    updateMessageBaseline();
    restartBaselineSettle();
    return;
  }
  const msgs = collectMessages();
  const last = msgs[msgs.length - 1];
  const previousRow = state.conversation.lastRow;
  // 已知的最后一条消息被整体移除：说明消息区内容被替换（切换会话或整区重渲染）。
  // 先重判身份：确实切换则激活流程会重建基线并阻断本轮写入；只是同会话重渲染则仅重同步锚点。
  if (previousRow && !previousRow.isConnected) {
    const switched = ensureUIAlive();
    updateMessageBaseline();
    if (switched) restartBaselineSettle();
    return;
  }
  const fresh = msgs.filter(m => {
    if (!candidates.has(m.el) || m.el === previousRow) return false;
    if (!previousRow) return true;
    if (!previousRow.isConnected) return false;
    return !!(previousRow.compareDocumentPosition(m.el) & Node.DOCUMENT_POSITION_FOLLOWING);
  });

  state.conversation.lastRow = last ? last.el : null;
  if (fresh.some(m => m.role === 'other')) scheduleSuggestionRefresh();
  if (fresh.length) scheduleMemorySummary();
}

export function watchMessages() {
  const flow = findMessageFlow();
  if (flow === observedFlow && (msgObserver || !flow)) return;
  if (msgObserver) msgObserver.disconnect();
  clearPendingMessageScan();
  observedFlow = flow;
  msgObserver = null;
  if (!flow) {
    clearTimeout(baselineTimer);
    baselineTimer = null;
    state.conversation.baselineReady = false;
    state.conversation.lastRow = null;
    return;
  }
  establishMessageBaseline();
  msgObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches(selectors.messageRow)) {
          pendingRows.add(node);
        } else {
          node.querySelectorAll(selectors.messageRow).forEach(row => pendingRows.add(row));
          const row = node.parentElement && node.parentElement.closest(selectors.messageRow);
          if (row) pendingRows.add(row);
        }
      });
    });
    if (!pendingRows.size) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      const rows = Array.from(pendingRows);
      pendingRows.clear();
      scanTimer = null;
      ensureUIAlive();
      onNewMessages(rows);
    }, TIMING.MESSAGE_SCAN_DEBOUNCE);
  });
  msgObserver.observe(flow, { childList: true, subtree: true });
}

export function ensureUIAlive() {
  const routeChanged = location.href !== lastUrl;
  const info = resolveCurrentConversation();
  watchStructureHealth();
  let activated = false;
  if (routeChanged) {
    lastUrl = location.href;
    log('路由切换: ' + location.pathname);
  }
  if (info.key && (routeChanged || !sameConversation(info, state.conversation))) {
    activateConversation(info);
    activated = true;
    log('会话切换: ' + info.name);
  } else if (!info.key && (state.conversation.key || routeChanged)) {
    if (routeChanged) {
      clearConversation();
    } else {
      // 身份瞬时抖动（页面重渲染的一瞬间识别层全空）：延迟确认再清理，
      // 避免误清状态、误刷建议，也避免把用户打开的弹窗关掉
      clearTimeout(clearDebounce);
      clearDebounce = setTimeout(() => {
        clearDebounce = null;
        if (!resolveCurrentConversation().key) clearConversation();
      }, TIMING.STATE_CLEAR_CONFIRM);
    }
  }

  if (!findComposer()) {
    if (ui.host || hasActiveRequest()) {
      // 输入框瞬时不可见（重渲染）：延迟确认再卸载，避免把建议条和弹窗一起拆掉
      clearTimeout(unmountDebounce);
      unmountDebounce = setTimeout(() => {
        unmountDebounce = null;
        if (!findComposer() && (ui.host || hasActiveRequest())) unmountUI();
      }, TIMING.UI_UNMOUNT_CONFIRM);
    }
    watchMessages();
    return activated;
  }
  clearTimeout(unmountDebounce);
  unmountDebounce = null;
  mountUI();
  syncHostLayout();
  watchMessages();
  if (info.key && sameConversation(info, state.conversation) && !state.conversation.baselineReady && !baselineTimer) {
    restartBaselineSettle();
  }
  return activated;
}
