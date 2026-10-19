/* =====================================================================
 * 存储访问 —— GM_*Value 的安全封装与存储键注册表（键名统一在这里）
 * ===================================================================== */
import { LOG_PREFIX } from './constants.js';

export const STORAGE_KEYS = {
  config: 'config',
  playerProfile: 'soul-ai-player-profile',
  memoryPrefix: 'soul-ai-memory:',
};

export function safeGet(key) {
  try { return GM_getValue(key, null); } catch (e) { return null; }
}

export function safeSet(key, value) {
  try {
    GM_setValue(key, value);
    return true;
  } catch (e) {
    console.error(LOG_PREFIX + ' 存储写入失败: ' + key, e);
    return false;
  }
}

export function safeDelete(key) {
  try {
    if (typeof GM_deleteValue === 'function') GM_deleteValue(key);
    else GM_setValue(key, '');
    return true;
  } catch (e) {
    console.error(LOG_PREFIX + ' 存储删除失败: ' + key, e);
    return false;
  }
}
