/* =====================================================================
 * 长期记忆 —— 数据结构与存取（每个会话独立保存）
 * ===================================================================== */
import { safeGet, safeSet, STORAGE_KEYS } from './storage.js';
import { cleanStringList } from './utils.js';
import { collectMessages } from './platform.js';
import { state } from './state.js';

export const MEMORY_RECENT_MESSAGES = 12;
export const MEMORY_MIN_PENDING = 4;
export const MEMORY_IDLE_MS = 15000;
export const MEMORY_BUSY_IDLE_MS = 3000;
// 新增消息积攒到这个数以上时，用更短的静默时间整理
export const MEMORY_BUSY_PENDING = 8;

// 各字段的条数/长度上限：AI 输出与 UI 展示共用，超限裁剪
export const MEMORY_LIMITS = {
  summary: 240,
  topicTitle: 20,
  topicSummary: 120,
  topicEvents: 3,
  topicEventLength: 60,
  topicMood: 16,
  maxTopics: 8,
  facts: 12,
  factLength: 60,
  openLoops: 5,
  openLoopLength: 60,
  summarizedIds: 24,
  summarizedIdLength: 200,
  firstBatch: 20,
  anchorMissFallback: 12,
  eventItems: 6,
};

export function memoryStorageKey(info) {
  return STORAGE_KEYS.memoryPrefix + info.key;
}

export function emptyMemory() {
  return { version: 1, summary: '', topics: [], facts: [], openLoops: [], summarizedIds: [], updatedAt: 0, lastMessageId: '' };
}

export function normalizeMemory(raw, previous) {
  if (!raw || typeof raw !== 'object') return previous || emptyMemory();
  const text = key => typeof raw[key] === 'string' ? raw[key].trim() : '';
  const previousTopics = previous && Array.isArray(previous.topics) ? previous.topics : [];
  const topics = Array.isArray(raw.topics)
    ? raw.topics
      .filter(topic => topic && typeof topic === 'object')
      .map(topic => ({
        title: typeof topic.title === 'string' ? topic.title.trim().slice(0, MEMORY_LIMITS.topicTitle) : '',
        summary: typeof topic.summary === 'string' ? topic.summary.trim().slice(0, MEMORY_LIMITS.topicSummary) : '',
        events: cleanStringList(topic.events, MEMORY_LIMITS.topicEvents, MEMORY_LIMITS.topicEventLength),
        mood: typeof topic.mood === 'string' ? topic.mood.trim().slice(0, MEMORY_LIMITS.topicMood) : '',
        status: topic.status === '已结束' ? '已结束' : '进行中',
      }))
      .filter(topic => topic.title || topic.summary || topic.events.length)
      .slice(-MEMORY_LIMITS.maxTopics)
    : [];
  const facts = cleanStringList(raw.facts, MEMORY_LIMITS.facts, MEMORY_LIMITS.factLength);
  const openLoops = cleanStringList(raw.openLoops, MEMORY_LIMITS.openLoops, MEMORY_LIMITS.openLoopLength);
  const summarizedIds = cleanStringList(raw.summarizedIds, MEMORY_LIMITS.summarizedIds, MEMORY_LIMITS.summarizedIdLength);
  return {
    version: 1,
    summary: text('summary').slice(0, MEMORY_LIMITS.summary) || (previous && previous.summary) || '',
    topics: topics.length ? topics : previousTopics.slice(-MEMORY_LIMITS.maxTopics),
    facts: facts.length ? facts : (previous && previous.facts) || [],
    openLoops: openLoops.length ? openLoops : (previous && previous.openLoops) || [],
    summarizedIds: summarizedIds.length ? summarizedIds : (previous && previous.summarizedIds) || [],
    updatedAt: Number(raw.updatedAt) || (previous && previous.updatedAt) || 0,
    lastMessageId: text('lastMessageId') || (previous && previous.lastMessageId) || '',
  };
}

export function loadConversationMemory(info) {
  if (!info || !info.key) return emptyMemory();
  return readStoredMemory(info.key) || emptyMemory();
}

function readStoredMemory(storageKey) {
  try {
    const raw = safeGet(memoryStorageKey({ key: storageKey }));
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const memory = normalizeMemory(parsed, emptyMemory());
    return memoryHasContent(memory) ? memory : null;
  } catch (e) {
    return null;
  }
}

export function saveConversationMemory(info, memory) {
  if (!info || !info.key) return;
  safeSet(memoryStorageKey(info), JSON.stringify(memory));
}

export function memoryHasContent(memory) {
  const value = memory;
  return !!(value && (value.summary || value.facts.length || value.topics.length || value.openLoops.length));
}

export function formatMemoryForPrompt(memory) {
  const value = memory;
  if (!memoryHasContent(value)) return '';
  const lines = [];
  if (value.summary) lines.push('整体：' + value.summary);
  if (value.topics.length) {
    lines.push('话题记忆：');
    value.topics.forEach(topic => {
      const title = topic.title || '未命名话题';
      const events = topic.events.length ? '｜事件：' + topic.events.join('；') : '';
      lines.push('- [' + topic.status + '] ' + title + '：' + topic.summary + events);
    });
  }
  if (value.facts.length) lines.push('稳定事实：' + value.facts.join('；'));
  if (value.openLoops.length) lines.push('未完成约定：' + value.openLoops.join('；'));
  return lines.join('\n');
}

// 自上次记忆整理以来的新增消息；传 msgs 可复用已采集的结果
export function pendingMemoryMessages(msgs) {
  const messages = (msgs || collectMessages()).filter(m => m.role !== 'system');
  if (!messages.length) return [];
  const activeMemory = state.activeMemory;
  if (!activeMemory.lastMessageId) return messages.slice(-MEMORY_LIMITS.firstBatch);
  const index = messages.findIndex(m => m.id === activeMemory.lastMessageId);
  if (index >= 0) return messages.slice(index + 1);
  // 锚点失配（如撤回使重复消息的序号平移）：从最近一个仍存在的已整理消息之后继续，
  // 避免整段重复整理；一个都找不到才退回最后几条
  const summarized = activeMemory.summarizedIds || [];
  for (let i = summarized.length - 1; i >= 0; i--) {
    const summarizedIndex = messages.findIndex(m => m.id === summarized[i]);
    if (summarizedIndex >= 0) return messages.slice(summarizedIndex + 1);
  }
  return messages.slice(-MEMORY_LIMITS.anchorMissFallback);
}

// 角色卡「事件记忆」条目：优先用长期记忆里的话题事件
export function memoryEventItems(data) {
  const memoryEvents = [];
  state.activeMemory.topics.forEach(topic => {
    const items = topic.events.length ? topic.events : [topic.summary];
    items.filter(Boolean).forEach(item => {
      memoryEvents.push(topic.title ? topic.title + '：' + item : item);
    });
  });
  return memoryEvents.length ? memoryEvents.slice(-MEMORY_LIMITS.eventItems) : ((data && data.recentEvents) || []);
}
