/* =====================================================================
 * 拾取向导流程 —— 七步点选教脚本识别陌生聊天站点（ROADMAP P3）
 * 步骤：消息流容器 → 对方消息×2 → 自己消息×2 → 输入框 → 身份来源
 * （侧栏条目 / 聊天头 / URL）→ 可选资料卡 → 可选主色采样点 → 自检报告。
 * 选择器归纳走 selector-gen，角色/激活差分走 role-diff，配置终校验走
 * platform-config；端到端自检复用 genSuggestions 并遵守请求守卫约定。
 * ===================================================================== */
import {
  mountWizard, unmountWizard, isWizardOpen,
  renderWizardStep, renderWizardChoice, renderWizardReport, extractAccentDeep,
} from './ui.js';
import { serializeElement, countSelectorMatches, isVisible } from './dom.js';
import { pickChain } from './selector-gen.js';
import { diffRole } from './role-diff.js';
import {
  normalizePlatformConfig, deriveCapabilities, PLATFORM_CONFIG_VERSION,
} from './platform-config.js';
import { createCustomPlatform } from './platform/custom.js';
import { savePlatformConfig } from './platform.js';
import { genSuggestions } from './suggestions.js';
import { createRequestGuard } from './request-guard.js';
import { log, logWarn, logError } from './utils.js';
import { TIMING } from './constants.js';

const WIZARD_LIMITS = {
  MESSAGE_SAMPLES: 2,        // 每侧消息的拾取样例数
  FLOW_MAX_MATCHES: 3,       // 消息流容器可接受的命中数上限
  INPUT_MAX_MATCHES: 5,      // 输入框 / 发送按钮可接受的命中数上限
  IDENTITY_ENTRY_MIN: 2,     // 侧栏条目选择器至少命中的条目数（确保是列表）
  HEADER_MAX_MATCHES: 3,     // 聊天头可接受的命中数上限
  OPTIONAL_MAX_MATCHES: 2,   // 可选步（资料卡/主色采样）命中数上限
  SIDEBAR_OTHER_MAX: 6,      // 参与激活差分的其它侧栏条目数上限（对齐 ROLE_DIFF_LIMITS）
  TEXT_BUBBLE_MIN_SAMPLES: 2, // 气泡差分推导至少需要的消息行样例数
};

const STEP_TOTAL = 7;
const IDENTITY_STEP = 5;

const IDENTITY_OPTIONS = [
  { key: 'sidebar', label: '侧栏条目', desc: '点选会话列表里当前激活的条目，自动差分激活状态' },
  { key: 'header', label: '聊天头', desc: '点选顶部的会话标题 / 对方昵称区域' },
  { key: 'url', label: 'URL', desc: '网址路径即会话身份，无需拾取（路径含会话 ID 的站点最稳）' },
];

// 模块级守卫：端到端自检的防竞态与取消（取消向导 / 重新拾取时作废在途请求）
const wizardGuard = createRequestGuard();

// 当前向导会话；null 表示未开启（UI 层 isWizardOpen 负责宿主存活判断）
let wiz = null;

function createSession() {
  return {
    step: 1,
    flowEl: null,
    flowChain: null,
    other: { els: [], descs: [] },
    self: { els: [], descs: [] },
    rowChain: null,
    selfMatch: null,
    inputChain: null,
    sendButtonChain: null,
    identity: null,
    peerCardChain: null,
    accentSampleChain: null,
    finalConfig: null,
    reportView: null,
  };
}

function safeMatches(el, sel) {
  try { return el.matches(sel); } catch (e) { return false; }
}

/* ---------- 视图渲染 ---------- */

// 按步懒构造视图：只求值当前步，避免全量字面量在第 5 步前读取尚未存在的 wiz.identity
function stepView(step) {
  switch (step) {
    case 1:
      return {
        title: '第 1 步 · 拾取消息流容器',
        desc: '点击包住所有聊天消息的滚动区域',
        tip: '选同时包住双方消息的最近公共容器，不要点到单条消息',
      };
    case 2:
      return {
        title: '第 2 步 · 拾取对方消息',
        desc: '点击一条对方发来的消息（已拾取 ' + wiz.other.els.length + '/' + WIZARD_LIMITS.MESSAGE_SAMPLES + '）',
        tip: '两条尽量来自不同位置，帮助归纳通用规则',
      };
    case 3:
      return {
        title: '第 3 步 · 拾取自己的消息',
        desc: '点击一条你自己发过的消息（已拾取 ' + wiz.self.els.length + '/' + WIZARD_LIMITS.MESSAGE_SAMPLES + '）',
        tip: '与对方消息在样式或属性上有差异才能区分角色',
      };
    case 4:
      return {
        title: '第 4 步 · 拾取输入框',
        desc: '点击底部聊天输入框内部',
        tip: '将自动尝试定位发送按钮，供主色采样与主题适配使用',
      };
    case IDENTITY_STEP:
      return wiz.identity && wiz.identity.mode === 'sidebar'
        ? { title: '第 5 步 · 拾取侧栏当前条目', desc: '点击会话列表中当前激活（高亮）的条目' }
        : { title: '第 5 步 · 拾取聊天头', desc: '点击顶部的会话标题 / 对方昵称区域' };
    case 6:
      return {
        title: '第 6 步 · 拾取对方资料卡（可选）',
        desc: '保持资料卡打开，点击卡片本体',
        optional: true,
      };
    case 7:
      return {
        title: '第 7 步 · 拾取主色采样点（可选）',
        desc: '点击一个主色明显的元素（如品牌按钮、高亮图标）',
        optional: true,
      };
  }
  return {};
}

function renderStep(extra = {}) {
  if (!wiz) return;
  if (wiz.step === IDENTITY_STEP && !wiz.identity) {
    renderWizardChoice({
      title: '第 ' + IDENTITY_STEP + ' 步 · 会话身份来源',
      desc: '选择如何识别「当前在和谁聊天」',
      progress: { current: wiz.step, total: STEP_TOTAL },
      options: IDENTITY_OPTIONS,
    });
    return;
  }
  renderWizardStep(Object.assign({
    progress: { current: wiz.step, total: STEP_TOTAL },
    canBack: wiz.step > 1,
  }, stepView(wiz.step), extra));
}

function advance(status) {
  wiz.step++;
  if (wiz.step > STEP_TOTAL) {
    finish();
    return;
  }
  renderStep(status ? { status } : {});
}

function fail(text) {
  renderStep({ status: { ok: false, text } });
}

/* ---------- 各步拾取 ---------- */

function pickFlow(el) {
  const chain = pickChain([serializeElement(el)], sel => countSelectorMatches(sel), {
    min: 1, max: WIZARD_LIMITS.FLOW_MAX_MATCHES,
  });
  if (!chain) return fail('未能生成稳定选择器，请点击包住全部消息的容器重试');
  wiz.flowEl = el;
  wiz.flowChain = chain;
  advance();
}

function pickMessage(el, role) {
  const slot = role === 'other' ? wiz.other : wiz.self;
  slot.els.push(el);
  slot.descs.push(serializeElement(el));
  const chain = pickChain(slot.descs, sel => countSelectorMatches(sel, wiz.flowEl), {
    min: WIZARD_LIMITS.MESSAGE_SAMPLES,
    matchesFn: sel => slot.els.every(sample => safeMatches(sample, sel)),
  });
  if (slot.els.length < WIZARD_LIMITS.MESSAGE_SAMPLES || !chain) {
    if (slot.els.length >= WIZARD_LIMITS.MESSAGE_SAMPLES) {
      slot.els = [];
      slot.descs = [];
      return fail('未能归纳出稳定的选择器，请重新点选两条' + (role === 'other' ? '对方' : '自己') + '消息');
    }
    renderStep();
    return;
  }
  if (role === 'other') {
    wiz.rowChain = chain;
    // 回退重拾对方消息后，若自己消息样例仍在，需要按新样例重算角色差分
    if (wiz.self.descs.length) wiz.selfMatch = diffRole(wiz.self.descs, wiz.other.descs);
    advance();
    return;
  }
  wiz.selfMatch = diffRole(wiz.self.descs, wiz.other.descs);
  advance(wiz.selfMatch
    ? { ok: true, text: '已识别角色判别规则' }
    : { ok: false, text: '无法区分角色，所有消息将视为对方' });
}

// 发送按钮候选：真实 button、role=button、类名含 send 的元素（部分平台的发送键
// 是 SVG 图标，如抖音的 messageMsgInputpublishBtn，不带 button 语义）
const SEND_BUTTON_CANDIDATES = 'button, [role="button"], [class*="send" i]';

// 沿输入框父链找第一个含可见候选的祖先并归纳发送按钮链（失败置 null，不影响
// 主流程）。候选中优先“子树能采到彩色实底”的那个——真发送键几乎必然承平台
// 主色（画在子元素/伪元素层，需深采样），而首个可见候选常是表情/文件键。
function deriveSendButtonChain(inputEl) {
  let node = inputEl.parentElement;
  while (node && node !== document.body) {
    const candidates = Array.from(node.querySelectorAll(SEND_BUTTON_CANDIDATES)).filter(isVisible);
    if (candidates.length) {
      const colorful = candidates.find(el => extractAccentDeep(el));
      const target = colorful || candidates[0];
      return pickChain([serializeElement(target)], sel => countSelectorMatches(sel), {
        min: 1, max: WIZARD_LIMITS.INPUT_MAX_MATCHES,
      });
    }
    node = node.parentElement;
  }
  return null;
}

function pickInput(el) {
  const editable = el.isContentEditable
    || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT';
  if (!editable) return fail('这不是可编辑区域，请点击聊天输入框内部');
  const chain = pickChain([serializeElement(el)], sel => countSelectorMatches(sel), {
    min: 1, max: WIZARD_LIMITS.INPUT_MAX_MATCHES,
  });
  if (!chain) return fail('未能归纳输入框选择器，请重试');
  wiz.inputChain = chain;
  wiz.sendButtonChain = deriveSendButtonChain(el);
  advance({
    ok: true,
    text: wiz.sendButtonChain ? '已定位输入框与发送按钮' : '已定位输入框（未找到发送按钮，不影响使用）',
  });
}

function pickIdentityElement(el) {
  const desc = serializeElement(el);
  if (!desc) return fail('无法识别该元素，请重试');
  if (wiz.identity.mode === 'sidebar') {
    const chain = pickChain([desc], sel => countSelectorMatches(sel), {
      min: WIZARD_LIMITS.IDENTITY_ENTRY_MIN,
      matchesFn: sel => safeMatches(el, sel),
    });
    if (!chain) return fail('未能归纳侧栏条目选择器，请点击会话列表中的一个条目');
    let otherNodes = [];
    try {
      otherNodes = Array.from(document.querySelectorAll(chain[0]))
        .filter(node => node !== el).slice(0, WIZARD_LIMITS.SIDEBAR_OTHER_MAX);
    } catch (e) { otherNodes = []; }
    const otherDescs = otherNodes.map(serializeElement).filter(Boolean);
    const activeMatch = otherDescs.length ? diffRole([desc], otherDescs) : null;
    wiz.identity.entry = chain;
    wiz.identity.activeMatch = activeMatch;
    advance(activeMatch
      ? { ok: true, text: '已识别激活条目的差分规则' }
      : { ok: false, text: '无法差分激活状态，会话身份不可靠（建议返回改用 URL 身份）' });
    return;
  }
  const chain = pickChain([desc], sel => countSelectorMatches(sel), {
    min: 1, max: WIZARD_LIMITS.HEADER_MAX_MATCHES,
  });
  if (!chain) return fail('未能归纳聊天头选择器，请重试');
  wiz.identity.header = chain;
  advance();
}

function pickOptional(el, field) {
  const chain = pickChain([serializeElement(el)], sel => countSelectorMatches(sel), {
    min: 1, max: WIZARD_LIMITS.OPTIONAL_MAX_MATCHES,
  });
  if (!chain) return fail('未能归纳选择器，请重试或跳过此步');
  wiz[field] = chain;
  advance();
}

/* ---------- 配置组装与自检 ---------- */

// 行内最外层直接持有文本节点的元素（消息气泡的通用近似）
function firstTextHolder(row) {
  for (const el of row.querySelectorAll('*')) {
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) return el;
    }
  }
  return null;
}

// 气泡链差分推导：由已拾取的消息行取文本载体样例，要求每行都能命中
function deriveTextBubbleChain() {
  const rows = wiz.other.els.filter(el => el.isConnected);
  const samples = rows.slice(0, WIZARD_LIMITS.TEXT_BUBBLE_MIN_SAMPLES);
  if (!wiz.flowEl || !wiz.flowEl.isConnected || samples.length < WIZARD_LIMITS.TEXT_BUBBLE_MIN_SAMPLES) return null;
  const descs = samples.map(firstTextHolder).filter(Boolean).map(serializeElement);
  if (descs.length < WIZARD_LIMITS.TEXT_BUBBLE_MIN_SAMPLES) return null;
  return pickChain(descs, sel => countSelectorMatches(sel, wiz.flowEl), {
    min: 1,
    matchesFn: sel => rows.every(row => row.querySelectorAll(sel).length >= 1),
  });
}

function queryChainElement(chain) {
  if (!chain) return null;
  for (const sel of chain) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch (e) { /* 非法选择器跳过 */ }
  }
  return null;
}

function finish() {
  const raw = {
    version: PLATFORM_CONFIG_VERSION,
    domain: location.hostname,
    messageFlow: wiz.flowChain,
    messageRow: wiz.rowChain,
    textBubble: deriveTextBubbleChain(),
    inputBox: wiz.inputChain,
    sendButton: wiz.sendButtonChain,
    selfMatch: wiz.selfMatch,
    peerCard: wiz.peerCardChain,
    accentSample: wiz.accentSampleChain,
    identity: wiz.identity,
  };
  raw.capabilities = deriveCapabilities(raw);
  const finalConfig = normalizePlatformConfig(raw, location.hostname);
  if (!finalConfig) {
    wiz.finalConfig = null;
    logError('拾取配置未通过 schema 校验（不应发生）');
    renderWizardReport({ items: [], suggestions: [], error: '配置校验未通过（不应发生），请点击「重新拾取」重试' });
    return;
  }
  wiz.finalConfig = finalConfig;
  log('拾取配置已生成，开始自检');
  runSelfCheck();
}

// 结构自检 + 端到端自检；报告视图缓存在 wiz.reportView，供保存后切换 saved/error 态
async function runSelfCheck() {
  const config = wiz.finalConfig;
  const temp = createCustomPlatform(config);
  const msgs = temp.collectMessages();
  const selfCount = msgs.filter(m => m.role === 'self').length;
  const items = [
    {
      label: '消息行识别',
      value: '对方 ' + (msgs.length - selfCount) + ' 条 / 自己 ' + selfCount + ' 条',
      ok: msgs.length > 0,
    },
  ];

  const inputEl = queryChainElement(config.inputBox);
  let inputDesc = '未找到';
  if (inputEl && inputEl.isContentEditable) inputDesc = '富文本 · execCommand 写入';
  else if (inputEl) inputDesc = '原生控件 · 值赋值写入';
  items.push({ label: '输入框', value: inputDesc, ok: !!inputEl });

  const info = temp.getConversationInfo();
  items.push({
    label: '会话身份',
    value: info.key ? (info.reliable ? '稳定' : '不可靠') : '未识别',
    ok: !!(info.key && info.reliable),
  });

  if (!config.accentSample) {
    items.push({ label: '主色采样', value: '未配置（使用默认主色）', ok: null });
  } else {
    const color = extractAccentDeep(queryChainElement(config.accentSample));
    items.push({ label: '主色采样', value: color ? '已采样主色' : '采样点未通过颜色校验', ok: color ? true : false });
  }

  wiz.reportView = { items, suggestions: [] };
  renderWizardReport(Object.assign({}, wiz.reportView, { busy: true }));

  wizardGuard.cancel();
  const pending = genSuggestions(msgs, null, null);
  const handle = wizardGuard.track(pending);
  try {
    const result = await pending;
    if (handle.stale() || !isWizardOpen()) return;
    items.push({ label: '端到端建议生成', value: result.suggestions.length + ' 条', ok: true });
    wiz.reportView = {
      items,
      suggestions: ['示例建议：' + result.suggestions[0]],
    };
    renderWizardReport(wiz.reportView);
    log('向导端到端自检通过');
  } catch (e) {
    if (handle.stale() || !isWizardOpen()) return;
    logWarn('向导端到端自检失败: ' + e.message);
    wiz.reportView = {
      items,
      suggestions: [],
      error: '端到端自检未完成（' + e.message + '）；结构自检仍有效，可在设置中配置 AI 后使用',
    };
    renderWizardReport(wiz.reportView);
  } finally {
    handle.done();
  }
}

/* ---------- handlers ---------- */

function onPick(el) {
  if (!wiz || wiz.step > STEP_TOTAL || !el || el.nodeType !== Node.ELEMENT_NODE) return;
  if (wiz.step === IDENTITY_STEP && !wiz.identity) return;
  switch (wiz.step) {
    case 1: pickFlow(el); break;
    case 2: pickMessage(el, 'other'); break;
    case 3: pickMessage(el, 'self'); break;
    case 4: pickInput(el); break;
    case IDENTITY_STEP: pickIdentityElement(el); break;
    case 6: pickOptional(el, 'peerCardChain'); break;
    case 7: pickOptional(el, 'accentSampleChain'); break;
  }
}

function onChooseIdentity(mode) {
  if (!wiz || wiz.step !== IDENTITY_STEP || wiz.identity) return;
  if (!IDENTITY_OPTIONS.some(option => option.key === mode)) return;
  wiz.identity = { mode };
  if (mode === 'url') {
    advance();
    return;
  }
  renderStep();
}

function onSkip() {
  if (!wiz) return;
  if (wiz.step === 6) { wiz.peerCardChain = null; advance(); }
  else if (wiz.step === 7) { wiz.accentSampleChain = null; advance(); }
}

function resetStepData(step) {
  switch (step) {
    case 2: wiz.other = { els: [], descs: [] }; wiz.rowChain = null; break;
    case 3: wiz.self = { els: [], descs: [] }; wiz.selfMatch = null; break;
    case 4: wiz.inputChain = null; wiz.sendButtonChain = null; break;
    case IDENTITY_STEP: wiz.identity = null; break;
    case 6: wiz.peerCardChain = null; break;
    case 7: wiz.accentSampleChain = null; break;
  }
}

function onBack() {
  if (!wiz || wiz.step <= 1 || wiz.step > STEP_TOTAL) return;
  wiz.step--;
  resetStepData(wiz.step);
  renderStep();
}

function onCancel() {
  wizardGuard.cancel();
  wiz = null;
  unmountWizard();
  log('拾取向导已关闭');
}

function onRestart() {
  wizardGuard.cancel();
  wiz = createSession();
  renderStep();
}

function onSave() {
  if (!wiz || !wiz.finalConfig) return;
  const base = wiz.reportView || { items: [], suggestions: [] };
  if (savePlatformConfig(wiz.finalConfig)) {
    wiz.reportView = Object.assign({}, base, { error: undefined, saved: true });
    renderWizardReport(wiz.reportView);
    log('拾取配置已保存，即将刷新页面生效');
    setTimeout(() => location.reload(), TIMING.WIZARD_RELOAD_DELAY);
    return;
  }
  wiz.reportView = Object.assign({}, base, { error: '保存失败：配置未通过校验，请「重新拾取」' });
  renderWizardReport(wiz.reportView);
}

/* ---------- 入口 ---------- */

export function startWizard() {
  if (isWizardOpen()) return;
  wiz = createSession();
  mountWizard({
    onPick, onChooseIdentity, onSkip, onBack, onCancel, onSave, onRestart,
  });
  renderStep();
  log('拾取向导已启动');
}
