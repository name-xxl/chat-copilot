/* =====================================================================
 * 入口 —— 注入 UI 与业务流程的绑定，并启动监测
 * ===================================================================== */
import { setActions } from './actions.js';
import { mountUI, syncHostLayout, closeModal, $bar, ui } from './ui.js';
import { resolveCurrentConversation, installClickCapture } from './conversation.js';
import { activateConversation, watchMessages, ensureUIAlive } from './chat-monitor.js';
import {
  loadSuggestions, cancelSuggestions, clearRefreshTimer, onUiMounted,
} from './suggestion-flow.js';
import {
  loadCharacterCard, cancelCharacterRequest, analyzeBothCards, savePlayerCard, renderCachedCharacterCard,
} from './cards-flow.js';
import { summarizeMemory, clearConversationMemory } from './memory-flow.js';
import { log } from './utils.js';
import { TIMING } from './constants.js';

// UI 层只认 actions 总线；在这里完成 UI ↔ 流程的解耦绑定
setActions({
  loadSuggestions,
  cancelSuggestions,
  clearRefreshTimer,
  onUiMounted,
  loadCharacterCard,
  renderCachedCharacterCard,
  cancelCharacterRequest,
  analyzeBothCards,
  savePlayerCard,
  summarizeMemory,
  clearConversationMemory,
});

function main() {
  installClickCapture();
  const info = resolveCurrentConversation();
  if (info.key) activateConversation(info);
  mountUI();
  watchMessages();
  window.addEventListener('popstate', ensureUIAlive);
  window.addEventListener('hashchange', ensureUIAlive);
  window.addEventListener('resize', syncHostLayout);
  document.addEventListener('pointerdown', event => {
    const layer = $bar('.modal-layer');
    if (!layer || !layer.classList.contains('open')) return;
    if (!event.composedPath().includes(ui.host)) closeModal();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal();
  });
  setInterval(ensureUIAlive, TIMING.UI_PATROL_INTERVAL);
  // __VERSION__ 由构建时从 package.json 注入
  log('Soul AI 助手 v' + __VERSION__ + ' 已加载');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
