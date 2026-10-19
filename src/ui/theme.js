/* =====================================================================
 * 主题 —— 明暗检测 + 主色提取 + 令牌应用
 * 令牌默认值在 style.js 的 :host 规则里（浅色），运行时按检测结果/用户
 * 覆盖写到宿主元素内联样式上。纯函数（颜色解析、luminance、mixColor、
 * buildAccentFamily）不依赖 DOM，可被 node:test 直测。
 * ===================================================================== */
import { config } from '../config.js';
import { findMessageFlow, findComposer, selectors } from '../platform.js';
import { isVisible } from '../dom.js';
import { ui } from './shared.js';

const DARK_LUMINANCE = 0.35;      // 宿主背景相对亮度低于此判定为深色模式
const ACCENT_MIN_SPREAD = 24;     // RGB 极差低于此视为黑白灰，不作为主色
export const DEFAULT_ACCENT = { r: 47, g: 158, b: 143 }; // Soul 青绿

/* ---------- 纯函数：颜色解析与派生 ---------- */

export function parseHex(value) {
  const m = /^#([0-9a-f]{6})$/i.exec((value || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
}

export function parseColor(text) {
  const m = /^rgba?\(([^)]+)\)$/.exec((text || '').trim());
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some(n => !Number.isFinite(n))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}

export function luminance(color) {
  const channel = c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

// 向白(255)或黑(0)方向混合
export function mixColor(color, target, ratio) {
  const mix = c => Math.round(c + (target - c) * ratio);
  return { r: mix(color.r), g: mix(color.g), b: mix(color.b), a: 1 };
}

function rgb(color) { return `rgb(${color.r}, ${color.g}, ${color.b})`; }
function rgba(color, alpha) { return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`; }

// 由一个主色派生整套 accent 令牌（保证深浅模式下文字可读）
export function buildAccentFamily(color, dark) {
  const accent = dark ? mixColor(color, 255, 0.1) : color;
  const textRatio = dark ? 0.38 : 0.28;
  return {
    '--accent': rgb(accent),
    '--accent-strong': rgb(mixColor(accent, dark ? 255 : 0, dark ? 0.14 : 0.1)),
    '--accent-deep': rgb(mixColor(accent, dark ? 255 : 0, textRatio)),
    '--accent-bright': rgb(mixColor(accent, 255, 0.12)),
    '--accent-soft': rgba(accent, dark ? 0.16 : 0.12),
    '--accent-soft-hover': rgba(accent, dark ? 0.26 : 0.2),
    '--accent-border': rgba(accent, dark ? 0.38 : 0.34),
    '--accent-focus': rgb(mixColor(accent, 255, dark ? 0.35 : 0.3)),
    '--focus-ring': rgba(accent, 0.45),
  };
}

/* ---------- DOM 采样：明暗与主色 ---------- */

// 从消息流容器沿父链找到第一个非透明背景，作为宿主底色
function sampleHostBackground() {
  let el = findMessageFlow();
  while (el && el !== document.documentElement) {
    const color = parseColor(getComputedStyle(el).backgroundColor);
    if (color && color.a >= 0.5) return color;
    el = el.parentElement;
  }
  return null;
}

export function detectDarkMode() {
  const background = sampleHostBackground();
  return !!background && luminance(background) < DARK_LUMINANCE;
}

// 发送按钮的背景色几乎必然是平台主色
function extractAccentColor() {
  const composer = findComposer();
  const button = composer && composer.querySelector(selectors.sendButton);
  if (!button || !isVisible(button)) return null;
  const color = parseColor(getComputedStyle(button).backgroundColor);
  if (!color || color.a < 0.5) return null;
  if (Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b) < ACCENT_MIN_SPREAD) return null;
  return color;
}

/* ---------- 令牌应用 ---------- */

const NEUTRAL_LIGHT = {
  '--bg-bar': 'rgba(255,255,255,.97)',
  '--bg-card': '#ffffff',
  '--bg-soft': '#f4f8f7',
  '--bg-inset': '#f8fbfa',
  '--bg-overlay': 'rgba(255,255,255,.65)',
  '--border': '#e3ece8',
  '--border-soft': '#eef4f2',
  '--fg': '#35443f',
  '--fg-strong': '#2e3d39',
  '--fg-body': '#44534e',
  '--fg-muted': '#63736f',
  '--fg-faint': '#85938f',
  '--fg-disabled': '#9aa7a3',
  '--danger': '#b4556a',
  '--danger-soft': '#fff7f9',
  '--danger-border': '#f0d6dd',
  '--watch-bg': '#fff9ec',
  '--watch-border': '#f2e1b9',
  '--watch-text': '#8a6729',
};

const NEUTRAL_DARK = {
  '--bg-bar': 'rgba(30,41,38,.97)',
  '--bg-card': '#1e2926',
  '--bg-soft': '#26312e',
  '--bg-inset': '#22302c',
  '--bg-overlay': 'rgba(255,255,255,.08)',
  '--border': '#2e3c38',
  '--border-soft': '#293733',
  '--fg': '#c3d2ce',
  '--fg-strong': '#e6efec',
  '--fg-body': '#b1c1bd',
  '--fg-muted': '#8ca09b',
  '--fg-faint': '#74857f',
  '--fg-disabled': '#5c6e68',
  '--danger': '#e0879a',
  '--danger-soft': 'rgba(224,135,154,.14)',
  '--danger-border': 'rgba(224,135,154,.34)',
  '--watch-bg': 'rgba(217,179,106,.14)',
  '--watch-border': 'rgba(217,179,106,.34)',
  '--watch-text': '#d9b36a',
};

export function applyTheme() {
  const host = ui.host;
  if (!host || !host.isConnected) return;
  const mode = config.themeMode === 'light' || config.themeMode === 'dark'
    ? config.themeMode
    : 'auto';
  const dark = mode === 'auto' ? detectDarkMode() : mode === 'dark';
  const tokens = Object.assign({}, dark ? NEUTRAL_DARK : NEUTRAL_LIGHT);
  const custom = parseHex(config.customAccent);
  const accent = custom || extractAccentColor() || DEFAULT_ACCENT;
  Object.assign(tokens, buildAccentFamily(accent, dark));
  for (const [name, value] of Object.entries(tokens)) {
    host.style.setProperty(name, value);
  }
}
