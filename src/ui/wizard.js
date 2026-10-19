/* =====================================================================
 * 拾取向导 UI —— 独立 Shadow DOM 宿主 + 页面拾取模式 + 三种向导视图
 * 只负责渲染与回调分发（handlers 注入），业务流程在 wizard-flow.js；
 * 不 import 任何 *-flow 模块。挂载期间进入拾取模式：document 捕获阶段
 * 拦截 click（面板内除外）交给 onPick，mousemove 节流做悬停高亮。
 * 面板头部（标题/进度/进度条）可拖动重定位，避免遮挡待拾取元素；
 * 双击头部复位到默认停靠位（右侧）。
 * ===================================================================== */
import { UI_CSS, WIZARD_CSS } from './style.js';
import { WIZARD_HOST_ID, TIMING } from '../constants.js';

const wiz = {
  host: null,
  root: null,
  handlers: null,
  listeners: [],
  hoverRaf: 0,
  hoverTs: 0,
};

function $w(sel) {
  return wiz.root && wiz.root.querySelector(sel);
}

function call(name, ...args) {
  if (wiz.handlers && typeof wiz.handlers[name] === 'function') wiz.handlers[name](...args);
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function buildWizardHtml() {
  return `
    <style>${UI_CSS}${WIZARD_CSS}</style>
    <div class="wizard-layer">
      <div class="wizard-panel" role="dialog" aria-label="拾取向导">
        <div class="wizard-head">
          <div class="wizard-title"></div>
          <div class="wizard-progress"></div>
          <div class="wizard-bar"><i></i></div>
        </div>
        <div class="wizard-body"></div>
        <div class="wizard-foot"></div>
      </div>
    </div>
    <div class="wizard-hover"></div>`;
}

function inWizard(event) {
  return !!(wiz.host && event.composedPath && event.composedPath().includes(wiz.host));
}

const DRAG_RESET_PROPS = ['position', 'left', 'top', 'right', 'margin'];

// 头部拖动：首拖时把面板从 flex 停靠位切为 fixed 绝对定位，指针捕获跟手，视口内夹取
function attachDrag(panel, handle) {
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    panel.style.position = 'fixed';
    panel.style.right = 'auto';
    panel.style.margin = '0';
    panel.style.left = Math.max(0, rect.left) + 'px';
    panel.style.top = Math.max(0, rect.top) + 'px';
    const move = ev => {
      const left = Math.min(Math.max(ev.clientX - offsetX, 0), window.innerWidth - rect.width);
      const top = Math.min(Math.max(ev.clientY - offsetY, 0), window.innerHeight - rect.height);
      panel.style.left = Math.max(0, left) + 'px';
      panel.style.top = Math.max(0, top) + 'px';
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('dblclick', () => {
    DRAG_RESET_PROPS.forEach(prop => panel.style.removeProperty(prop));
  });
}

function onDocClick(event) {
  if (!wiz.handlers) return;
  if (inWizard(event)) return;
  event.preventDefault();
  event.stopPropagation();
  call('onPick', event.target);
}

function onDocMove(event) {
  if (!wiz.root) return;
  const now = Date.now();
  if (now - wiz.hoverTs < TIMING.WIZARD_HOVER_THROTTLE) return;
  wiz.hoverTs = now;
  const inPanel = inWizard(event);
  const target = event.target;
  if (wiz.hoverRaf) return;
  wiz.hoverRaf = requestAnimationFrame(() => {
    wiz.hoverRaf = 0;
    renderHover(inPanel ? null : target);
  });
}

function renderHover(target) {
  const box = $w('.wizard-hover');
  if (!box) return;
  const rect = target && target.getBoundingClientRect ? target.getBoundingClientRect() : null;
  if (!rect || (!rect.width && !rect.height)) {
    box.classList.remove('show');
    return;
  }
  box.style.left = rect.left + 'px';
  box.style.top = rect.top + 'px';
  box.style.width = rect.width + 'px';
  box.style.height = rect.height + 'px';
  box.classList.add('show');
}

function onDocKeydown(event) {
  if (event.key !== 'Escape' || !wiz.handlers) return;
  event.preventDefault();
  event.stopPropagation();
  call('onCancel');
}

function attachDocListeners() {
  wiz.listeners = [
    ['click', onDocClick, { capture: true }],
    ['mousemove', onDocMove, { capture: true, passive: true }],
    ['keydown', onDocKeydown, { capture: true }],
  ];
  wiz.listeners.forEach(([type, fn, opts]) => document.addEventListener(type, fn, opts));
}

function detachDocListeners() {
  wiz.listeners.forEach(([type, fn, opts]) => document.removeEventListener(type, fn, opts));
  wiz.listeners = [];
  if (wiz.hoverRaf) {
    cancelAnimationFrame(wiz.hoverRaf);
    wiz.hoverRaf = 0;
  }
}

export function mountWizard(handlers) {
  if (isWizardOpen()) unmountWizard();
  const host = document.createElement('div');
  host.id = WIZARD_HOST_ID;
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = buildWizardHtml();
  document.body.appendChild(host);
  const panel = root.querySelector('.wizard-panel');
  const head = root.querySelector('.wizard-head');
  if (panel && head) attachDrag(panel, head);
  wiz.host = host;
  wiz.root = root;
  wiz.handlers = handlers || {};
  attachDocListeners();
}

export function unmountWizard() {
  detachDocListeners();
  if (wiz.host) wiz.host.remove();
  wiz.host = null;
  wiz.root = null;
  wiz.handlers = null;
}

export function isWizardOpen() {
  return !!(wiz.host && wiz.host.isConnected);
}

function renderHeader(view) {
  const title = $w('.wizard-title');
  if (title) title.textContent = view.title || '';
  const progress = $w('.wizard-progress');
  const bar = $w('.wizard-bar');
  const fill = $w('.wizard-bar i');
  const total = view.progress ? view.progress.total : 0;
  const current = view.progress ? view.progress.current : 0;
  const has = Number.isFinite(total) && total > 0;
  if (progress) progress.textContent = has ? `第 ${Math.max(1, current)} / ${total} 步` : '';
  if (bar) bar.style.display = has ? '' : 'none';
  if (fill) fill.style.width = has ? Math.min(100, Math.round((current / total) * 100)) + '%' : '0';
}

// status 兼容两种形状：字符串（中性）与 { text, ok }（ok=true 成功 / false 失败）
function normalizeStatus(status) {
  if (!status) return null;
  if (typeof status === 'string') return { text: status, ok: null };
  return status.text ? { text: status.text, ok: status.ok } : null;
}

function appendStatus(body, status) {
  const norm = normalizeStatus(status);
  if (!norm) return;
  const cls = norm.ok === true ? ' ok' : norm.ok === false ? ' err' : '';
  body.appendChild(el('div', 'wizard-status' + cls, norm.text));
}

function footerButton(label, handler, cls) {
  const btn = el('button', 'wizard-btn' + (cls ? ' ' + cls : ''), label);
  btn.type = 'button';
  btn.addEventListener('click', handler);
  return btn;
}

function clearBody() {
  const body = $w('.wizard-body');
  const foot = $w('.wizard-foot');
  if (body) body.innerHTML = '';
  if (foot) foot.innerHTML = '';
  return { body, foot };
}

export function renderWizardStep(view) {
  if (!wiz.root || !view) return;
  renderHeader(view);
  const { body, foot } = clearBody();
  if (!body || !foot) return;
  if (view.desc) body.appendChild(el('p', '', view.desc));
  appendStatus(body, view.status);
  if (view.tip) body.appendChild(el('div', 'wizard-tip', view.tip));
  if (view.canBack) foot.appendChild(footerButton('上一步', () => call('onBack')));
  if (view.optional) foot.appendChild(footerButton('跳过此步', () => call('onSkip')));
  foot.appendChild(footerButton('取消', () => call('onCancel')));
}

export function renderWizardChoice(view) {
  if (!wiz.root || !view) return;
  renderHeader(view);
  const { body, foot } = clearBody();
  if (!body || !foot) return;
  if (view.desc) body.appendChild(el('p', '', view.desc));
  (view.options || []).forEach(option => {
    if (!option) return;
    const btn = el('button', 'wizard-option');
    btn.type = 'button';
    btn.appendChild(el('b', '', option.label || option.key));
    if (option.desc) btn.appendChild(el('span', '', option.desc));
    btn.addEventListener('click', () => call('onChooseIdentity', option.key));
    body.appendChild(btn);
  });
  foot.appendChild(footerButton('取消', () => call('onCancel')));
}

export function renderWizardReport(view) {
  if (!wiz.root || !view) return;
  renderHeader(view);
  const { body, foot } = clearBody();
  if (!body || !foot) return;
  if (view.error) body.appendChild(el('div', 'wizard-status err', view.error));
  const report = el('div', 'wizard-report');
  (view.items || []).forEach(item => {
    if (!item) return;
    const cls = item.ok === true ? ' ok' : item.ok === false ? ' bad' : '';
    const row = el('div', 'wizard-item' + cls);
    row.appendChild(el('span', 'k', item.label));
    row.appendChild(el('span', 'v', item.value == null || item.value === '' ? '—' : String(item.value)));
    report.appendChild(row);
  });
  if (report.childNodes.length) body.appendChild(report);
  if (Array.isArray(view.suggestions) && view.suggestions.length) {
    const wrap = el('div', 'wizard-sugg');
    wrap.appendChild(el('div', 'wizard-sugg-label', '自检建议预览'));
    view.suggestions.forEach(text => wrap.appendChild(el('div', 'wizard-sugg-item', text)));
    body.appendChild(wrap);
  }
  if (view.busy) {
    body.appendChild(el('div', 'wizard-status', 'AI 自检中…'));
  } else if (view.saved) {
    body.appendChild(el('div', 'wizard-status ok', '已保存，即将刷新页面生效'));
  }
  const disabled = !!view.busy || !!view.saved;
  const save = footerButton('保存并启用', () => call('onSave'), 'primary');
  const restart = footerButton('重新拾取', () => call('onRestart'));
  save.disabled = disabled;
  restart.disabled = disabled;
  foot.appendChild(save);
  foot.appendChild(restart);
}
