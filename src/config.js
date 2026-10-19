/* =====================================================================
 * 配置（⚙ 弹层可修改，存 GM_*Value）
 * ===================================================================== */
import { safeGet, safeSet, STORAGE_KEYS } from './storage.js';

export const DEFAULT_CONFIG = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.8,
  myName: '',
  persona: '你是一个真实、自然的聊天对象，回复口语化、简短（一般不超过30个字），不要使用emoji和书面腔，像朋友一样聊天。',
  maxContextMessages: 30,
  suggestionCount: 3,
  insightEnabled: true,
  thinkingMode: 'auto', // auto=不传参 | enabled | disabled（仅部分模型支持，如 LongCat）
  themeMode: 'auto',    // auto=跟随页面（明暗+主色）| light | dark
  customAccent: '',     // #RRGGBB，留空跟随页面主色
};

export const config = Object.assign({}, DEFAULT_CONFIG, safeGet('config') || {});

export function saveConfig() { safeSet(STORAGE_KEYS.config, config); }
