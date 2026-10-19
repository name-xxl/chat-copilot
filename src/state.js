/* =====================================================================
 * 全局状态 —— 唯一的可变状态中心，其余模块只读或经由此处写入
 * ===================================================================== */
import { safeGet, safeSet, STORAGE_KEYS } from './storage.js';
import { config } from './config.js';
import { normalizePlayerProfile } from './profile.js';

export const state = {
  // 当前激活的会话（由 chat-monitor 维护）
  conversation: { key: '', name: '', reliable: false, element: null, lastRow: null, baselineReady: false },
  // 当前会话的长期记忆
  activeMemory: { version: 1, summary: '', topics: [], facts: [], openLoops: [], summarizedIds: [], updatedAt: 0, lastMessageId: '' },
  // 意图判断缓存（key = 会话key|最后消息id）
  insightCache: { key: '', insight: null },
  // 角色卡缓存
  characterCache: { key: '', data: null },
};

let playerProfile = loadPlayerProfile();

function loadPlayerProfile() {
  try {
    const raw = safeGet(STORAGE_KEYS.playerProfile);
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const profile = normalizePlayerProfile(parsed);
    if (profile.name) config.myName = profile.name;
    else if (config.myName) profile.name = config.myName;
    return profile;
  } catch (e) {
    return normalizePlayerProfile(null);
  }
}

export function getPlayerProfile() { return playerProfile; }

export function setPlayerProfile(profile) { playerProfile = profile; }

export function setPlayerName(name) { playerProfile.name = name || ''; }

export function savePlayerProfile() {
  safeSet(STORAGE_KEYS.playerProfile, JSON.stringify(playerProfile));
}

// 档案姓名与配置昵称保持镜像：清空也会同步清空，避免互相"复活"
export function applyProfileNameToConfig() {
  config.myName = playerProfile.name;
}

export function myName() {
  return (playerProfile.name || config.myName || '').trim() || '我';
}

export function setInsightCache(key, insight) {
  state.insightCache.key = key;
  state.insightCache.insight = insight;
}

export function resetInsightCache() {
  setInsightCache('', null);
}

export function setCharacterCache(key, data) {
  state.characterCache.key = key;
  state.characterCache.data = data;
}

export function resetCharacterCache() {
  setCharacterCache('', null);
}
