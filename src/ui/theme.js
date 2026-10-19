/* =====================================================================
 * 主题 —— 明暗检测 + 主色提取 + 令牌应用
 * 令牌默认值在 style.js 的 :host 规则里（浅色），运行时按检测结果/用户
 * 覆盖写到宿主元素内联样式上。纯函数（颜色解析、luminance、mixColor、
 * buildAccentFamily）不依赖 DOM，可被 node:test 直测。
 * 主色来源优先级：用户自定义色 > 发送按钮背景（内置 Soul / 自定义适配器
 * 的 sendButton，含子树深采样）> 拾取的主色采样点（accentSample，仅自定义
 * 适配器）> 默认主色（Soul 用品牌青绿，自定义平台用中性钢蓝以免跳色）。
 * 暗色底板：自定义适配器下由页面表面色派生（deriveSurfaceDarkTokens），
 * Soul/采样失败时回退内置 NEUTRAL_DARK。单元素校验收口在 extractAccentFrom(el)。
 * ===================================================================== */
import { config } from '../config.js';
import { adapterId, findMessageFlow, findComposer, selectors } from '../platform.js';
import { isVisible } from '../dom.js';
import { ui } from './shared.js';

const DARK_LUMINANCE = 0.35;      // 宿主背景相对亮度低于此判定为深色模式
const ACCENT_MIN_SPREAD = 24;     // RGB 极差低于此视为黑白灰，不作为主色
export const DEFAULT_ACCENT = { r: 47, g: 158, b: 143 }; // Soul 青绿
export const NEUTRAL_FALLBACK_ACCENT = { r: 125, g: 143, b: 163 }; // 自定义平台回退主色（中性钢蓝）

const THEME_LIMITS = {
  ACCENT_DEEP_MAX_DEPTH: 6,   // 主色深采样的最大后代深度
  ACCENT_DEEP_MAX_NODES: 60,  // 主色深采样的最大遍历节点数
  SURFACE_SPREAD_MAX: 24,     // 表面色 RGB 极差超过此视为彩色面板，不采纳
  SURFACE_LUMINANCE_MAX: 0.55, // 表面色过亮（实为浅色页）不采纳
};

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

// 单元素主色采样：可见 + 颜色可解析 + alpha 足够 + RGB 极差足够，缺一即 null。
// 颜色来源：普通元素读背景色；SVG 图形（发送键常是 SVG，颜色画在 fill 上）读填充色。
export function extractAccentFrom(el) {
  if (!el || !isVisible(el)) return null;
  const computed = getComputedStyle(el);
  const color = parseColor(computed.backgroundColor)
    || (typeof SVGElement !== 'undefined' && el instanceof SVGElement ? parseColor(computed.fill) : null);
  if (!color || color.a < 0.5) return null;
  if (Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b) < ACCENT_MIN_SPREAD) return null;
  return color;
}

// 深采样：元素自身 + 逐层后代中第一个通过单元素校验的彩色实底。
// 平台按钮的颜色常画在子元素/伪元素层（如抖音的红色发送键），只看按钮自身
// 会采不到而退化为默认主色；深度与遍历数有上限，避免在大子树上逐个算样式。
export function extractAccentDeep(rootEl) {
  const own = extractAccentFrom(rootEl);
  if (own) return own;
  if (!rootEl) return null;
  let frontier = Array.from(rootEl.children);
  let depth = 1;
  let seen = 0;
  while (frontier.length && depth <= THEME_LIMITS.ACCENT_DEEP_MAX_DEPTH
    && seen < THEME_LIMITS.ACCENT_DEEP_MAX_NODES) {
    const next = [];
    for (const el of frontier) {
      if (++seen > THEME_LIMITS.ACCENT_DEEP_MAX_NODES) break;
      const color = extractAccentFrom(el);
      if (color) return color;
      next.push(...el.children);
    }
    frontier = next;
    depth++;
  }
  return null;
}

// 发送按钮的背景色几乎必然是平台主色；自定义适配器可退到 accentSample 采样点，
// 最后兜底深扫整条输入行（含旁边的 SVG 图标——抖音的红色发送键就画在那里）。
// selectors.sendButton / accentSample 为 null/undefined（空适配器 / Soul）时跳过对应来源。
function extractAccentColor() {
  if (selectors.sendButton) {
    const composer = findComposer();
    const button = composer && composer.querySelector(selectors.sendButton);
    const color = extractAccentDeep(button);
    if (color) return color;
  }
  if (selectors.accentSample) {
    const color = extractAccentDeep(document.querySelector(selectors.accentSample));
    if (color) return color;
  }
  if (isCustomAdapter()) {
    const color = extractAccentDeep(findComposer());
    if (color) return color;
  }
  return null;
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

// 纯函数：由页面表面色派生暗色底板令牌（--bg-bar/--bg-card/--bg-soft/--bg-inset/
// --border/--border-soft），让建议条底色家族与平台一致（内置 NEUTRAL_DARK 是照
// Soul 调的绿相灰，套到抖音这类中性深色页会发绿）。表面色须为近中性暗色：
// 彩色面板/过亮（实为浅色页）一律返回 null，调用方回退 NEUTRAL_DARK。
export function deriveSurfaceDarkTokens(bg) {
  if (!bg || ![bg.r, bg.g, bg.b].every(Number.isFinite)) return null;
  if (Math.max(bg.r, bg.g, bg.b) - Math.min(bg.r, bg.g, bg.b) > THEME_LIMITS.SURFACE_SPREAD_MAX) return null;
  if (luminance(bg) > THEME_LIMITS.SURFACE_LUMINANCE_MAX) return null;
  const base = { r: Math.round(bg.r), g: Math.round(bg.g), b: Math.round(bg.b) };
  const lift = ratio => mixColor(base, 255, ratio);
  return {
    '--bg-bar': rgba(base, 0.97),
    '--bg-card': rgb(base),
    '--bg-soft': rgb(lift(0.06)),
    '--bg-inset': rgb(lift(0.03)),
    '--border': rgb(lift(0.14)),
    '--border-soft': rgb(lift(0.08)),
  };
}

function isCustomAdapter() {
  return typeof adapterId === 'string' && adapterId.startsWith('custom:');
}

export function applyTheme() {
  const host = ui.host;
  if (!host || !host.isConnected) return;
  const mode = config.themeMode === 'light' || config.themeMode === 'dark'
    ? config.themeMode
    : 'auto';
  const dark = mode === 'auto' ? detectDarkMode() : mode === 'dark';
  const tokens = Object.assign({}, dark ? NEUTRAL_DARK : NEUTRAL_LIGHT);
  if (dark && isCustomAdapter()) {
    // 自定义平台：暗色底板跟随页面表面色，采样不可采纳时回退内置色板
    const surface = deriveSurfaceDarkTokens(sampleHostBackground());
    if (surface) Object.assign(tokens, surface);
  }
  const custom = parseHex(config.customAccent);
  const fallback = isCustomAdapter() ? NEUTRAL_FALLBACK_ACCENT : DEFAULT_ACCENT;
  const accent = custom || extractAccentColor() || fallback;
  Object.assign(tokens, buildAccentFamily(accent, dark));
  for (const [name, value] of Object.entries(tokens)) {
    host.style.setProperty(name, value);
  }
}
