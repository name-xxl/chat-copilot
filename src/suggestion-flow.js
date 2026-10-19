/* =====================================================================
 * 建议流程 —— 生成/取消/调度回复建议（UI 请求的唯一入口）
 * ===================================================================== */
import { mounted, isCollapsed, $bar, renderInsight, renderChips } from './ui.js';
import { collectMessages, isStructureBroken } from './platform.js';
import { sameConversation } from './dom.js';
import { resolveCurrentConversation } from './conversation.js';
import { state, setInsightCache, resetInsightCache } from './state.js';
import { config } from './config.js';
import { genSuggestions } from './suggestions.js';
import { createRequestGuard } from './request-guard.js';
import { TIMING } from './constants.js';
import { log, logError } from './utils.js';

let lastSugConv = '';
let refreshTimer = null;
// 请求簿记：序号/在途请求归属建议流程自身，UI 层只管渲染
const suggestionGuard = createRequestGuard();
let inflightKey = '';
let completedKey = '';

export function hasActiveRequest() { return suggestionGuard.isBusy(); }

export function clearRefreshTimer() {
  clearTimeout(refreshTimer);
  refreshTimer = null;
}

// 切换会话时调用：清定时器并允许重新生成
export function resetSuggestionState() {
  clearRefreshTimer();
  lastSugConv = '';
}

export function cancelSuggestions() {
  suggestionGuard.cancel();
  inflightKey = '';
  completedKey = '';
  const chips = $bar('.chips');
  if (chips) chips.innerHTML = '';
  renderInsight(null);
}

// 生成建议并渲染
export async function loadSuggestions(force) {
  if (!mounted()) return;
  if (isStructureBroken()) {
    cancelSuggestions();
    lastSugConv = '';
    renderChips(['页面结构已变化，建议功能暂时失效；刷新页面通常可恢复'], 'err');
    return;
  }
  const info = resolveCurrentConversation();
  if (!info.key) {
    cancelSuggestions();
    lastSugConv = '';
    log('未识别当前会话，无法生成建议');
    renderChips(['未识别当前会话，请切换会话或点击重试'], 'err');
    return;
  }
  const history = collectMessages();
  const last = history[history.length - 1];
  const requestKey = info.key + '|' + (last ? last.id : 'empty');
  const cachedInsight = config.insightEnabled && state.insightCache.key === requestKey
    ? state.insightCache.insight
    : null;
  if (!force && inflightKey === requestKey) return;
  if (!force && info.key === lastSugConv && completedKey === requestKey && $bar('.chips').childElementCount) return;
  cancelSuggestions();
  lastSugConv = info.key;
  inflightKey = requestKey;
  renderInsight(cachedInsight);
  const waiting = config.insightEnabled && !cachedInsight && last
    ? '正在判断对方意图…'
    : 'AI 正在生成建议…';
  renderChips([waiting], 'muted');
  let handle = null;
  try {
    const pending = genSuggestions(history, cachedInsight, insight => {
      if (!handle || handle.stale()) return;
      if (insight) {
        setInsightCache(requestKey, insight);
        renderInsight(insight);
        renderChips(['AI 正在生成建议…'], 'muted');
      } else {
        resetInsightCache();
        renderInsight(null);
        renderChips(['判断失败，正在直接生成建议…'], 'muted');
      }
    });
    handle = suggestionGuard.track(pending);
    const result = await pending;
    if (handle.stale() || !sameConversation(info, resolveCurrentConversation())) return;
    renderInsight(result.insight);
    renderChips(result.suggestions, '', info);
    completedKey = requestKey;
    log('建议已生成: ' + result.suggestions.length + ' 条' + (result.insight ? '（含意图判断）' : ''));
  } catch (e) {
    if (!handle || handle.stale() || !sameConversation(info, resolveCurrentConversation())) return;
    logError('生成建议失败', e);
    renderChips([e.message + '（点击重试）'], 'err');
  } finally {
    if (handle) handle.done();
    if (!handle || !handle.stale()) inflightKey = '';
  }
}

// 对方来新消息后防抖刷新；基线未确认内容归属时让位给基线建立后的生成
export function scheduleSuggestionRefresh() {
  if (isCollapsed()) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    if (!state.conversation.baselineReady) return;
    loadSuggestions(true);
  }, TIMING.SUGGESTION_REFRESH_DEBOUNCE);
}

// 建议条（重新）挂载后决定是否生成一轮
export function onUiMounted() {
  if (!lastSugConv || lastSugConv !== resolveCurrentConversation().key || !$bar('.chips').childElementCount) {
    loadSuggestions(false);
  }
}
