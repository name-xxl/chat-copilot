/* =====================================================================
 * 卡片流程 —— 对方角色卡加载、双卡 AI 提炼、主角卡保存
 * ===================================================================== */
import {
  mounted, setRoleStatus, setPlayerStatus, renderCharacterData,
  renderCharacterBasics, renderPlayerForm, readPlayerForm,
} from './ui.js';
import { collectMessages, collectPeerProfile, capabilities } from './platform.js';
import { sameConversation } from './dom.js';
import { resolveCurrentConversation } from './conversation.js';
import {
  state, getPlayerProfile, setPlayerProfile, applyProfileNameToConfig,
  savePlayerProfile, resetInsightCache, setCharacterCache,
} from './state.js';
import { saveConfig } from './config.js';
import { buildCharacterMessages, buildBothCardsMessages, contextMessages } from './prompts.js';
import { normalizeCharacter, characterCacheKey } from './character.js';
import { callAI } from './ai-client.js';
import { normalizePlayerProfile, mergePlayerProfile, playerProfileHasContent } from './profile.js';
import { parseJsonObject, log, logWarn, logError } from './utils.js';
import { loadSuggestions } from './suggestion-flow.js';
import { createRequestGuard } from './request-guard.js';

const characterGuard = createRequestGuard();

export function cancelCharacterRequest() {
  characterGuard.cancel();
}

// 打开角色卡时调用：只展示已有缓存，绝不发起请求（提炼一律手动）
export function renderCachedCharacterCard() {
  if (!mounted()) return;
  if (state.characterCache.data) {
    renderCharacterData(state.characterCache.data);
    return;
  }
  setRoleStatus('尚未生成角色卡：点右上角 ↻ 手动提炼；判定不准时可随时重新分析', false);
}

export async function loadCharacterCard(force) {
  if (!mounted()) return;
  if (!capabilities.stableIdentity) {
    setRoleStatus('当前平台无法稳定识别会话，角色卡不可用', true);
    return;
  }
  const info = resolveCurrentConversation();
  if (!info.key) {
    setRoleStatus('未识别当前会话，无法生成角色卡', true);
    return;
  }
  const history = collectMessages();
  const key = characterCacheKey(info, history);
  if (!force && state.characterCache.key === key && state.characterCache.data) {
    renderCharacterData(state.characterCache.data);
    return;
  }
  cancelCharacterRequest();
  setRoleStatus('正在整理角色卡…', false);
  let handle = null;
  try {
    const request = callAI(buildCharacterMessages(history), { temperature: 0.25, maxTokens: 900 });
    handle = characterGuard.track(request);
    const text = await request;
    if (handle.stale() || !sameConversation(info, resolveCurrentConversation())) return;
    const data = normalizeCharacter(parseJsonObject(text));
    setCharacterCache(key, data);
    renderCharacterData(data);
  } catch (e) {
    if (!handle || handle.stale()) return;
    logError('角色卡生成失败', e);
    setRoleStatus('角色卡生成失败：' + e.message, true);
  } finally {
    if (handle) handle.done();
  }
}

export async function analyzeBothCards() {
  if (!mounted()) return;
  if (!capabilities.stableIdentity) {
    setRoleStatus('当前平台无法稳定识别会话，双卡提炼不可用', true);
    return;
  }
  const info = resolveCurrentConversation();
  if (!info.key) {
    setRoleStatus('未识别当前会话，无法提炼双卡', true);
    return;
  }
  const history = collectMessages();
  // 与提示词使用同一条上下文切片：其中连一条自己的消息都没有时，主角卡内容必然是编造的
  const selfMessageCount = contextMessages(history).filter(m => m.role === 'self').length;
  if (!history.length && !collectPeerProfile() && !playerProfileHasContent(getPlayerProfile())) {
    setRoleStatus('没有足够信息提炼双卡', true);
    return;
  }
  cancelCharacterRequest();
  setRoleStatus('正在从对话中提炼两张卡…', false);
  setPlayerStatus('正在从用户自己的消息中提炼…');
  let handle = null;
  try {
    const request = callAI(buildBothCardsMessages(history), { temperature: 0.3, maxTokens: 1500 });
    handle = characterGuard.track(request);
    const text = await request;
    if (handle.stale() || !sameConversation(info, resolveCurrentConversation())) return;
    const raw = parseJsonObject(text);
    let peerUpdated = false;
    let playerUpdated = false;
    let playerSkipped = false;
    if (raw.player) {
      if (!selfMessageCount) {
        // 一条自己的消息都没识别到：player 内容必属编造，拒绝写入，避免污染主角档案
        playerSkipped = true;
        logWarn('未识别到用户自己发出的消息，跳过主角卡提炼');
      } else {
        const suggested = normalizePlayerProfile(raw.player);
        setPlayerProfile(mergePlayerProfile(getPlayerProfile(), suggested));
        applyProfileNameToConfig();
        saveConfig();
        savePlayerProfile();
        renderPlayerForm();
        resetInsightCache();
        playerUpdated = true;
      }
    }
    if (raw.peer) {
      try {
        const peer = normalizeCharacter(raw.peer);
        setCharacterCache(characterCacheKey(info, history), peer);
        renderCharacterData(peer);
        peerUpdated = true;
      } catch (peerError) {
        logError('对方卡提炼失败', peerError);
      }
    }
    if (playerUpdated) setPlayerStatus(peerUpdated ? 'AI 已同时更新两张卡。' : 'AI 已更新主角卡。');
    else if (playerSkipped) setPlayerStatus('当前聊天里没有识别到你自己发出的消息，已跳过主角卡更新，防止把对方信息写进你的档案。');
    else setPlayerStatus(peerUpdated ? 'AI 已更新对方卡，本次没有新的主角信息。' : '本次没有提炼出新的信息。');
    if (!peerUpdated) setRoleStatus('对方卡本次提炼失败，可稍后重试', true);
    log('双卡提炼完成');
    loadSuggestions(true);
  } catch (e) {
    if (!handle || handle.stale()) return;
    logError('双卡提炼失败', e);
    setRoleStatus('双卡提炼失败：' + e.message, true);
    setPlayerStatus('双卡提炼失败：' + e.message, true);
  } finally {
    if (handle) handle.done();
  }
}

export function savePlayerCard() {
  setPlayerProfile(readPlayerForm());
  applyProfileNameToConfig();
  saveConfig();
  savePlayerProfile();
  resetInsightCache();
  setPlayerStatus('已保存。后续生成会使用这份主角档案。');
  loadSuggestions(true);
}
