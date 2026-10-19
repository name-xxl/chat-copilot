/* =====================================================================
 * UI 挂载 —— Shadow DOM 宿主的创建/卸载、事件接线与收起态、布局同步
 * ===================================================================== */
import { ui, $bar, mounted, isCollapsed, setCollapsed } from './shared.js';
import { buildRootHtml } from './template.js';
import { updateChipOverflow } from './bar.js';
import { closeModal } from './modals.js';
import { renderSettings, openSettingsModal, onSaveSettings } from './settings.js';
import { openCharacterModal, switchCardTab, readPlayerForm } from './card.js';
import { applyTheme } from './theme.js';
import { captureChatScroll, restoreChatScroll, findComposer, adapterId } from '../platform.js';
import { findHostMount } from '../dom.js';
import { exportPeerCard, exportPlayerCard } from '../card-export.js';
import { pendingMemoryMessages } from '../memory.js';
import { actions } from '../actions.js';
import { log } from '../utils.js';
import { HOST_ELEMENT_ID } from '../constants.js';

export function syncHostLayout() {
  if (!mounted()) return;
  applyTheme();
  requestAnimationFrame(updateChipOverflow);
}

function renderCollapse() {
  if (!mounted()) return;
  const chatScroll = captureChatScroll();
  $bar('.bar').classList.toggle('hidden', isCollapsed());
  $bar('.mini').classList.toggle('show', isCollapsed());
  $bar('.insight').classList.toggle('hidden', isCollapsed());
  restoreChatScroll(chatScroll);
}

export function mountUI() {
  if (mounted()) return;
  if (ui.host) actions.cancelSuggestions?.();
  const composer = findComposer();
  if (!composer) return;
  const chatScroll = captureChatScroll();

  const host = document.createElement('div');
  host.id = HOST_ELEMENT_ID;
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = buildRootHtml();
  // 拾取接入的站点启用底栏逃逸（吸附在底栏之上）；Soul 走既有挂载算法，外观不变
  const mountPoint = findHostMount(composer, { dockEscape: adapterId.startsWith('custom:') });
  if (!mountPoint.parent) return;
  host.style.cssText = 'display:block;width:100%;min-width:0;flex:none;align-self:stretch;margin:0 0 8px;';
  mountPoint.parent.insertBefore(host, mountPoint.anchor);
  ui.host = host;
  ui.root = root;
  syncHostLayout();
  restoreChatScroll(chatScroll);

  root.querySelector('[data-a="refresh"]').addEventListener('click', () => actions.loadSuggestions?.(true));
  root.querySelector('[data-a="card"]').addEventListener('click', openCharacterModal);
  root.querySelector('[data-a="cfg"]').addEventListener('click', openSettingsModal);
  root.querySelector('[data-a="hide"]').addEventListener('click', () => {
    setCollapsed(true);
    actions.clearRefreshTimer?.();
    renderCollapse();
  });
  root.querySelector('.mini').addEventListener('click', () => { setCollapsed(false); renderCollapse(); actions.loadSuggestions?.(false); });
  root.querySelector('.modal-layer').addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelector('.pop-close').addEventListener('click', closeModal);
  root.querySelector('.role-close').addEventListener('click', closeModal);
  root.querySelector('.role-refresh').addEventListener('click', () => {
    if (pendingMemoryMessages().length) actions.summarizeMemory?.(true);
    actions.loadCharacterCard?.(true);
  });
  root.querySelector('.role-card').addEventListener('click', event => {
    if (event.target.closest('[data-action="ai-cards"]')) {
      actions.analyzeBothCards?.();
      return;
    }
    const tab = event.target.closest('[data-card-tab]');
    if (tab) {
      switchCardTab(tab.dataset.cardTab);
      return;
    }
    const exportButton = event.target.closest('[data-export]');
    if (exportButton) {
      const [target, format] = exportButton.dataset.export.split('-');
      if (target === 'peer') exportPeerCard(format);
      else exportPlayerCard(readPlayerForm(), format);
      return;
    }
    if (event.target.closest('[data-action="clear-memory"]')) {
      actions.clearConversationMemory?.();
      return;
    }
    if (event.target.closest('.role-retry')) actions.loadCharacterCard?.(true);
    if (event.target.closest('.player-save')) actions.savePlayerCard?.();
  });
  root.querySelector('.save').addEventListener('click', onSaveSettings);
  root.querySelector('.chips-wrap').addEventListener('scroll', updateChipOverflow, { passive: true });

  renderSettings();
  renderCollapse();

  // 首次挂载或宿主被页面重渲染后由建议流程决定是否生成一轮
  actions.onUiMounted?.();
  log('建议条已挂载');
}

export function unmountUI() {
  actions.cancelSuggestions?.();
  actions.clearRefreshTimer?.();
  if (ui.host) ui.host.remove();
  ui.host = null;
  ui.root = null;
}
