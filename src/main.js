/* =====================================================================
 * 入口 —— 注入 UI 与业务流程的绑定，并启动监测
 * 域名闸门：未适配域名（空适配器）只注册 TM 菜单（拾取向导入口），
 * 不做任何采集/挂载/监听；已适配（内置 Soul / 拾取配置）走完整流程。
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
import { startWizard } from './wizard-flow.js';
import { adapterId, hasCustomConfig, clearPlatformConfig } from './platform.js';
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
  startWizard,
});

// TM 菜单：向导入口对所有域名开放（未适配站点靠它接入）；有拾取配置时提供清除入口
function registerMenuCommands() {
  if (typeof GM_registerMenuCommand !== 'function') return;
  GM_registerMenuCommand('启动拾取向导（教我识别当前站点）', () => startWizard());
  if (hasCustomConfig()) {
    GM_registerMenuCommand('清除本站拾取配置（恢复内置/停用）', () => {
      clearPlatformConfig();
      location.reload();
    });
  }
}

function main() {
  registerMenuCommands();
  if (adapterId === 'null') return; // 未适配域名：只留 TM 菜单，不挂 UI 不监听
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
