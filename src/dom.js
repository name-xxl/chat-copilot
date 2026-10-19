/* =====================================================================
 * 通用 DOM 工具 —— 平台无关的元素判断/比较/定位，不含页面启发式
 * 平台相关的采集与会话身份识别在 platform/ 适配器里
 * ===================================================================== */

export function firstTextLine(el) {
  if (!el) return '';
  return ((el.innerText || el.textContent || '').split('\n')
    .map(s => s.trim()).find(Boolean)) || '';
}

export function sameConversation(a, b) {
  if (!a || !b || !a.key || !b.key || a.key !== b.key) return false;
  if (a.reliable && b.reliable) {
    if (a.element === b.element) return true;
    // 两个节点都还挂在 DOM 上且不是同一个节点：是两个不同的会话（如同名联系人）
    const bothAlive = !!(a.element && a.element.isConnected && b.element && b.element.isConnected);
    if (bothAlive) return false;
    // 仅当旧节点已被页面重渲染移除时，才退回按名字判断是否同一会话
    return a.name === b.name;
  }
  // 不可靠身份（键由昵称归一而来）：键一致且元素或名字吻合即同一会话，
  // 避免点击层/头部层交替时被误判为切换
  return a.element === b.element || a.name === b.name;
}

export function isVisible(el) {
  return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
}

/* ---------- 拾取向导：元素序列化与选择器计数 ---------- */

// 序列化采集的裁剪上限（描述符形状由 selector-gen / role-diff 消费）
const SERIALIZE_LIMITS = {
  ATTR_VALUE_MAX: 80,
  ATTRS_MAX: 8,
  CLASSES_MAX: 12,
  PATH_DEPTH: 8,
  PATH_CLASSES_MAX: 4,
  TEXT_HEAD_MAX: 40,
};

const SERIALIZE_ATTR_RE = /^(data-|aria-)/i;
const SERIALIZE_ATTR_NAMES = new Set(['role', 'type', 'name', 'placeholder', 'contenteditable', 'autocomplete', 'dir', 'title', 'alt']);
// 与 role-diff 的 ROLE_STYLE_PROPS 保持一致（参与角色样式差分的计算样式属性）
const SERIALIZE_STYLE_PROPS = ['justifyContent', 'textAlign', 'flexDirection', 'alignSelf', 'marginLeft', 'marginRight'];

// 把元素压成纯对象描述符：标签/类名/属性/少量计算样式/父链路径/首行文本，
// 供选择器泛化引擎与角色差分（纯函数）离线计算，避免它们直接碰 DOM。
export function serializeElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
  const attributes = [];
  for (const attr of Array.from(el.attributes || [])) {
    const keep = SERIALIZE_ATTR_RE.test(attr.name) || SERIALIZE_ATTR_NAMES.has(attr.name.toLowerCase());
    if (!keep || !attr.value || !attr.value.trim()) continue;
    attributes.push({ name: attr.name.toLowerCase(), value: attr.value.trim().slice(0, SERIALIZE_LIMITS.ATTR_VALUE_MAX) });
    if (attributes.length >= SERIALIZE_LIMITS.ATTRS_MAX) break;
  }
  const styles = {};
  try {
    const computed = getComputedStyle(el);
    for (const prop of SERIALIZE_STYLE_PROPS) styles[prop] = computed[prop];
  } catch (e) { /* 无样式环境（测试）时留空 */ }
  const path = [];
  let node = el;
  while (node && node.nodeType === Node.ELEMENT_NODE && path.length < SERIALIZE_LIMITS.PATH_DEPTH) {
    const siblings = node.parentElement ? Array.prototype.slice.call(node.parentElement.children) : [];
    path.push({
      tag: node.tagName.toLowerCase(),
      id: node.id || '',
      classes: Array.from(node.classList || []).slice(0, SERIALIZE_LIMITS.PATH_CLASSES_MAX),
      index: 1 + siblings.indexOf(node),
    });
    node = node.parentElement;
  }
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    classes: Array.from(el.classList || []).slice(0, SERIALIZE_LIMITS.CLASSES_MAX),
    attributes,
    styles,
    path,
    textHead: firstTextLine(el).slice(0, SERIALIZE_LIMITS.TEXT_HEAD_MAX),
  };
}

export function countSelectorMatches(sel, root) {
  try { return (root || document).querySelectorAll(sel).length; } catch (e) { return 0; }
}

/* ---------- 建议条挂载点：穿透行布局 + 底栏逃逸 ---------- */

const MOUNT_LIMITS = {
  DOCK_HEIGHT_RATIO: 4,   // “底栏状”容器高度不超过输入区高度的倍数上限
};

// 纯函数：容器是否是“底栏状”——高度与输入区同量级、是父级最后一个在流子级、
// 非 fixed/sticky（不区分布局方向：行布局的输入条本身也可能是底栏）。命中则
// 建议条应挂到它之外（吸附在底栏之上），否则会被底栏背景二次包裹。
export function isDockStop(desc) {
  if (!desc || !desc.lastInFlow) return false;
  if (desc.position === 'fixed' || desc.position === 'sticky') return false;
  return desc.heightRatio > 0 && desc.heightRatio <= MOUNT_LIMITS.DOCK_HEIGHT_RATIO;
}

// 其后是否还存在在流（非 fixed/absolute）且可见的兄弟元素
function isLastInFlowChild(el) {
  let sib = el.nextElementSibling;
  while (sib) {
    if (isVisible(sib) && !['fixed', 'absolute'].includes(getComputedStyle(sib).position)) return false;
    sib = sib.nextElementSibling;
  }
  return true;
}

function dockStopDesc(el, composer) {
  const elH = el.getBoundingClientRect().height;
  const composerH = composer.getBoundingClientRect().height;
  return {
    position: getComputedStyle(el).position,
    heightRatio: composerH > 0 ? elH / composerH : 0,
    lastInFlow: isLastInFlowChild(el),
  };
}

// 旧算法：沿父链穿透 row-flex/grid/contents，取第一个非此类布局的容器作挂载父级
function legacyHostMount(composer) {
  let anchor = composer;
  let parent = anchor.parentElement;
  while (parent && parent !== document.body) {
    const style = getComputedStyle(parent);
    const rowFlex = (style.display === 'flex' || style.display === 'inline-flex')
      && style.flexDirection.startsWith('row');
    const grid = style.display === 'grid' || style.display === 'inline-grid';
    if (!rowFlex && !grid && style.display !== 'contents') return { parent, anchor };
    anchor = parent;
    parent = parent.parentElement;
  }
  return { parent: composer.parentElement, anchor: composer };
}

// 沿父链向上取“输入区外壳”：高度与输入框同量级（≤ 底栏高度倍数上限）的最外层
// 祖先。输入框外常有多层包装——块级编辑器盒子、行布局输入条、底栏（如抖音的
// messageEditorimChatEditorContainer → inputRow → 底栏），只取输入框本身会让
// 挂载落进编辑器盒子里、主色采样也看不到旁边的发送键。无合适祖先时返回自身。
export function inputAreaWrapper(el) {
  const base = el && el.getBoundingClientRect().height;
  if (!base) return el;
  let outer = el;
  let node = el.parentElement;
  while (node && node !== document.body) {
    if (node.getBoundingClientRect().height > base * MOUNT_LIMITS.DOCK_HEIGHT_RATIO) break;
    outer = node;
    node = node.parentElement;
  }
  return outer;
}

// 找挂载点。默认走旧算法（插到第一个非行布局容器内部、锚点之前）。
// opts.dockEscape 开启时（拾取接入的站点）：沿全祖先链找最外层“底栏状”容器
// （含输入区、高度同量级、父级最后在流子级），把宿主插到它之外、它之上，
// 对齐 Soul 上“吸附在底栏之上”的观感；无候选时回退旧算法。旧算法只看
// 非行布局的停留点，输入框外还有块级编辑器盒子时会停进盒子内部（抖音实测），
// 因此逃逸扫描必须逐级评估全部祖先，行布局输入条本身也可能是底栏。
export function findHostMount(composer, opts) {
  const legacy = legacyHostMount(composer);
  if (!opts || !opts.dockEscape) return legacy;
  let dock = null;
  let node = composer.parentElement;
  while (node && node !== document.body) {
    if (isDockStop(dockStopDesc(node, composer))) dock = node;
    node = node.parentElement;
  }
  return dock && dock.parentElement ? { parent: dock.parentElement, anchor: dock } : legacy;
}

