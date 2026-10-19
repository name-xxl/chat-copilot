/* =====================================================================
 * 设置弹层 —— 打开、表单回显、校验与保存
 * ===================================================================== */
import { $bar, mounted } from './shared.js';
import { config, saveConfig } from '../config.js';
import {
  getPlayerProfile, setPlayerName, savePlayerProfile, resetInsightCache, resetCharacterCache,
} from '../state.js';
import { actions } from '../actions.js';
import { renderInsight } from './bar.js';
import { openModal, closeModal } from './modals.js';
import { applyTheme } from './theme.js';

export function openSettingsModal() {
  openModal('settings');
  renderSettings();
}

export function renderSettings() {
  if (!mounted()) return;
  $bar('.pop').querySelectorAll('[data-cfg]').forEach(inp => {
    const key = inp.dataset.cfg;
    if (inp.type === 'checkbox') inp.checked = !!config[key];
    else if (inp.tagName === 'SELECT') inp.value = config[key] || 'auto';
    else inp.value = config[key] != null ? config[key] : '';
  });
  showSettingsError('');
}

function showSettingsError(text) {
  const el = $bar('.form-error');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('show', !!text);
}

export function onSaveSettings() {
  const next = Object.assign({}, config);
  for (const inp of $bar('.pop').querySelectorAll('[data-cfg]')) {
    const key = inp.dataset.cfg;
    if (inp.type === 'checkbox') {
      next[key] = inp.checked;
      continue;
    }
    const value = inp.value.trim();
    if (key === 'temperature') {
      const temperature = Number(value);
      if (value === '' || !Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
        showSettingsError('温度必须是 0~1 之间的数字');
        return;
      }
      next[key] = temperature;
    } else if (key === 'thinkingMode') {
      if (!['auto', 'enabled', 'disabled'].includes(value)) {
        showSettingsError('思考模式取值无效');
        return;
      }
      next[key] = value;
    } else if (key === 'themeMode') {
      if (!['auto', 'light', 'dark'].includes(value)) {
        showSettingsError('主题模式取值无效');
        return;
      }
      next[key] = value;
    } else if (key === 'customAccent') {
      if (value && !/^#[0-9a-fA-F]{6}$/.test(value)) {
        showSettingsError('主色格式为 #RRGGBB，如 #2f9e8f');
        return;
      }
      next[key] = value.toLowerCase();
    } else {
      next[key] = value;
    }
  }
  if (!next.baseUrl) {
    showSettingsError('Base URL 不能为空');
    return;
  }
  let parsedUrl;
  try { parsedUrl = new URL(next.baseUrl); } catch (e) {
    showSettingsError('Base URL 格式无效');
    return;
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    showSettingsError('Base URL 只支持 http 或 https');
    return;
  }
  if (!next.model) {
    showSettingsError('模型名不能为空');
    return;
  }
  Object.assign(config, next);
  if (next.myName !== getPlayerProfile().name) {
    setPlayerName(next.myName);
    savePlayerProfile();
  }
  resetInsightCache();
  resetCharacterCache();
  actions.cancelCharacterRequest?.();
  renderInsight(null);
  saveConfig();
  applyTheme();
  closeModal();
  actions.loadSuggestions?.(true);
}
