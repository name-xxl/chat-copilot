/* =====================================================================
 * 记忆流程 —— 静默定时 + 增量总结 + UI 同步
 * ===================================================================== */
import { updateRoleMemoryUI } from './ui.js';
import { collectMessages, capabilities } from './platform.js';
import { sameConversation } from './dom.js';
import { resolveCurrentConversation } from './conversation.js';
import { state } from './state.js';
import { callAI } from './ai-client.js';
import { buildMemoryMessages } from './prompts.js';
import {
  normalizeMemory, saveConversationMemory, pendingMemoryMessages, emptyMemory, memoryStorageKey,
  MEMORY_MIN_PENDING, MEMORY_IDLE_MS, MEMORY_BUSY_IDLE_MS, MEMORY_BUSY_PENDING, MEMORY_LIMITS,
} from './memory.js';
import { parseJsonObject, cleanStringList, log, logWarn, logError } from './utils.js';
import { setRoleStatus } from './ui.js';
import { resetCharacterCache } from './state.js';
import { createRequestGuard } from './request-guard.js';
import { safeDelete } from './storage.js';

let memoryTimer = null;
const memoryGuard = createRequestGuard();

export function scheduleMemorySummary(delayOverride) {
  clearTimeout(memoryTimer);
  memoryTimer = null;
  if (!state.conversation.key) return;
  if (!capabilities.stableIdentity) return;
  const pending = pendingMemoryMessages().length;
  if (pending < MEMORY_MIN_PENDING) return;
  const delay = delayOverride != null
    ? delayOverride
    : (pending >= MEMORY_BUSY_PENDING ? MEMORY_BUSY_IDLE_MS : MEMORY_IDLE_MS);
  memoryTimer = setTimeout(() => {
    memoryTimer = null;
    summarizeMemory(false);
  }, delay);
}

export function cancelMemoryRequest() {
  clearTimeout(memoryTimer);
  memoryTimer = null;
  memoryGuard.cancel();
}

export function clearConversationMemory() {
  const info = resolveCurrentConversation();
  if (!info.key) {
    setRoleStatus('未识别当前会话，无法清除记忆', true);
    return;
  }
  if (!safeDelete(memoryStorageKey(info))) {
    setRoleStatus('记忆清除失败：' + memoryStorageKey(info), true);
    return;
  }
  state.activeMemory = emptyMemory();
  resetCharacterCache();
  updateRoleMemoryUI();
  setRoleStatus('已清除本会话记忆。点 ↻ 重新提炼，角色卡将按当前聊天重建。', false);
  log('长期记忆已清除: ' + info.name);
}

export async function summarizeMemory(force) {
  if (!state.conversation.key) return;
  if (!capabilities.stableIdentity) return;
  // draft 是新会话的临时身份：不落地记忆，识别层恢复后切到正式身份再积累
  if (state.conversation.key === 'draft') return;
  const info = resolveCurrentConversation();
  if (!sameConversation(info, state.conversation)) return;
  if (memoryGuard.isBusy()) {
    scheduleMemorySummary(MEMORY_BUSY_IDLE_MS);
    return;
  }
  const messages = collectMessages();
  // —— 写入防线：以下任一情况说明“当前消息流”与“已激活会话”可能不是同一个会话，
  //    拒绝写入，防止把 A 会话的记忆合并进 B 会话（跨会话污染）——
  // 1) 基线未建立：会话刚切换或正处于过渡期
  if (!state.conversation.baselineReady) return;
  // 2) 基线锚点消息已被整体替换：内容换了来源
  const anchorRow = state.conversation.lastRow;
  if (anchorRow && !anchorRow.isConnected) return;
  // 3) 上次记忆截止的消息不在当前消息流里：记忆与消息流不属同一会话
  if (state.activeMemory.lastMessageId
    && !messages.some(m => m.id === state.activeMemory.lastMessageId)) {
    logWarn('记忆锚点不在当前消息流中，跳过本次整理以防跨会话污染');
    return;
  }
  const pending = pendingMemoryMessages(messages);
  if (!pending.length) return;
  if (!force && pending.length < MEMORY_MIN_PENDING) return;
  const last = pending[pending.length - 1];
  let handle = null;
  try {
    const request = callAI(buildMemoryMessages(state.activeMemory, pending), {
      temperature: 0.2,
      maxTokens: 900,
    });
    handle = memoryGuard.track(request);
    const text = await request;
    if (handle.stale() || !sameConversation(info, resolveCurrentConversation())) return;
    const merged = normalizeMemory(parseJsonObject(text), state.activeMemory);
    merged.lastMessageId = last.id;
    merged.summarizedIds = cleanStringList(
      [...(state.activeMemory.summarizedIds || []), ...pending.map(m => m.id)],
      MEMORY_LIMITS.summarizedIds, MEMORY_LIMITS.summarizedIdLength
    );
    merged.updatedAt = Date.now();
    state.activeMemory = merged;
    saveConversationMemory(info, state.activeMemory);
    updateRoleMemoryUI();
    log('长期记忆已更新：' + pending.length + ' 条新消息');
    if (pendingMemoryMessages().length >= MEMORY_MIN_PENDING) {
      scheduleMemorySummary(MEMORY_BUSY_IDLE_MS);
    }
  } catch (e) {
    if (!handle || handle.stale()) return;
    logError('长期记忆更新失败', e);
  } finally {
    if (handle) handle.done();
  }
}
