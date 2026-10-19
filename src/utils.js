/* =====================================================================
 * 通用工具 —— 纯函数，无页面/状态依赖，可跨项目复用
 * ===================================================================== */
import { LOG_PREFIX } from './constants.js';

export function log(text) {
  console.log(LOG_PREFIX + ' ' + new Date().toLocaleTimeString() + ' ' + text);
}

export function logWarn(text) {
  console.warn(LOG_PREFIX + ' ' + text);
}

export function logError(text, error) {
  console.error(LOG_PREFIX + ' ' + text, error);
}

export function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

// 字符串数组：过滤非字符串、去空白、去重、限量
export function cleanStringList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .filter(item => typeof item === 'string')
    .map(item => item.trim().slice(0, maxLength))
    .filter(item => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, maxItems);
}

// AI 返回的置信度归一：容错解析、>1 视为百分制、夹取 0~1
export function clampUnit(value) {
  let n = parseFloat(value);
  if (!Number.isFinite(n)) n = 0;
  if (n > 1) n /= 100;
  return Math.max(0, Math.min(1, n));
}

export function parseJsonObject(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('意图判断没有返回 JSON');
  return JSON.parse(m[0]);
}

// JSON 数组解析失败时按行降级，最多取这么多条
const MAX_FALLBACK_LINES = 6;

export function parseJsonArray(text) {
  const m = text.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const arr = JSON.parse(m[0]);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch (e) { /* fallthrough */ }
  }
  const lines = text.split('\n')
    .map(s => s.replace(/^[\d\.、\-\s\*"'"]+|["'"]+$/g, '').trim())
    .filter(s => s && !/^```/.test(s));
  if (lines.length) return lines.slice(0, MAX_FALLBACK_LINES);
  throw new Error('无法解析 AI 返回内容: ' + text.slice(0, 120));
}

// 表单里的多值字段（逗号/顿号/分号/换行分隔）
export function splitList(value) {
  return value.split(/[\n,，、;；]+/).map(item => item.trim()).filter(Boolean);
}

export function fileDate() {
  const now = new Date();
  const pad = number => String(number).padStart(2, '0');
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
}

export function safeFilePart(value) {
  return (value || '未命名').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30);
}

export function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
