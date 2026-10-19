/* =====================================================================
 * 选择器泛化引擎 —— 纯函数：从元素描述符生成候选选择器并筛选 fallback 链
 * 描述符由采集层 serializeElement（dom.js）产出；命中计数与样例匹配判断
 * 由调用方注入（countFn / matchesFn），保证本模块零 DOM、可 node:test 直测。
 * 候选优先级：data-* > aria/语义属性 > id > class 子集 > 结构路径。
 * ===================================================================== */

export const SELECTOR_GEN_LIMITS = {
  CHAIN_MAX: 5,            // fallback 链最长保留数
  CANDIDATE_MAX: 24,       // 单个描述符生成的候选上限
  SELECTOR_MAX_LENGTH: 120,
  PATH_DEPTH: 6,           // 结构路径候选的最大层级
  CLASS_COMBO_MAX: 3,      // class 组合候选最多参与的 class 数
};

// 哈希味 class（CSS-in-JS 生成，如 css-1q2w3e）：改版必变，排到 class 候选末尾。
// 数字只出现在末尾（row1 / col-2）视作语义类；数字与字母交错才是哈希特征。
function isHashClass(name) {
  if (name.length > 40) return true;
  return /[0-9]/.test(name.replace(/[0-9]+$/, ''));
}

function escapeIdent(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, ch => '\\' + ch);
}

function escapeAttrValue(value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function attrSelector(desc, attr, withTag) {
  const sel = '[' + attr.name + '=' + escapeAttrValue(attr.value) + ']';
  return withTag && desc.tag && desc.tag !== '*' ? desc.tag + sel : sel;
}

// 结构路径候选：沿描述符 path（元素自身在前、祖先在后）自上而下拼选择器；
// 每层优先用 class，其次 nth-child，元素层保留自身特征
function buildPath(desc, depth) {
  const levels = desc.path.slice(0, depth);
  if (!levels.length) return null;
  const parts = [];
  for (let i = levels.length - 1; i >= 0; i--) {
    const level = levels[i];
    const classes = (level.classes || []).filter(c => !isHashClass(c)).slice(0, 2);
    let part = level.tag + classes.map(c => '.' + escapeIdent(c)).join('');
    if (!part) part = level.tag;
    if (i < levels.length - 1 && level.index > 0) part += ':nth-child(' + level.index + ')';
    parts.push(part);
  }
  return parts.join(' > ');
}

// 生成候选（未经命中数筛选）；调用方可用 countFn 逐个验证
export function buildCandidates(desc) {
  const out = [];
  if (!desc || typeof desc !== 'object') return out;

  const attrs = Array.isArray(desc.attributes) ? desc.attributes : [];
  const stableClasses = (Array.isArray(desc.classes) ? desc.classes : []).filter(c => !isHashClass(c));
  const hashClasses = (Array.isArray(desc.classes) ? desc.classes : []).filter(isHashClass);

  // 1) data-* 属性
  for (const attr of attrs) {
    if (!attr || typeof attr.name !== 'string' || !attr.name.startsWith('data-')) continue;
    if (typeof attr.value !== 'string' || !attr.value.trim()) continue;
    out.push(attrSelector(desc, attr, false));
    out.push(attrSelector(desc, attr, true));
  }
  // 2) aria / 语义属性
  const semantic = new Set(['role', 'type', 'name', 'placeholder', 'contenteditable', 'autocomplete', 'dir']);
  for (const attr of attrs) {
    if (!attr || typeof attr.name !== 'string') continue;
    const isSemantic = semantic.has(attr.name) || attr.name.startsWith('aria-');
    if (!isSemantic || typeof attr.value !== 'string' || !attr.value.trim()) continue;
    out.push(attrSelector(desc, attr, false));
    out.push(attrSelector(desc, attr, true));
  }
  // 3) id
  if (desc.id && !isHashClass(desc.id)) out.push('#' + escapeIdent(desc.id));
  // 4) class 子集（裸 class 优先，tag 前缀变体次之；稳定 class 在前，哈希味 class 兜底）
  const ranked = stableClasses.concat(hashClasses);
  for (let size = 1; size <= Math.min(SELECTOR_GEN_LIMITS.CLASS_COMBO_MAX, ranked.length); size++) {
    out.push(ranked.slice(0, size).map(c => '.' + escapeIdent(c)).join(''));
  }
  if (stableClasses.length && desc.tag && desc.tag !== '*') {
    out.push(desc.tag + '.' + escapeIdent(stableClasses[0]));
  }
  // 5) 结构路径（最脆，兜底）：由浅到深
  const depth = Math.min(SELECTOR_GEN_LIMITS.PATH_DEPTH, (desc.path || []).length);
  for (let d = 2; d <= depth; d++) {
    const path = buildPath(desc, d);
    if (path) out.push(path);
  }

  const seen = new Set();
  return out
    .filter(sel => sel && typeof sel === 'string')
    .filter(sel => {
      if (seen.has(sel) || sel.length > SELECTOR_GEN_LIMITS.SELECTOR_MAX_LENGTH) return false;
      seen.add(sel);
      return true;
    })
    .slice(0, SELECTOR_GEN_LIMITS.CANDIDATE_MAX);
}

// 从多个样例描述符筛选 fallback 链：
//   countFn(sel) → number  当前文档（或容器内）的命中数
//   opts.min / opts.max    命中数可接受区间（默认 1 ~ 无上限）
//   opts.matchesFn(sel) → bool  可选：所有样例元素是否都命中该选择器
// 优先返回区间内的候选（按生成优先级）；全部超上限时退回 count 最小者；无可用则 null。
export function pickChain(descriptors, countFn, opts = {}) {
  if (typeof countFn !== 'function') return null;
  if (!Array.isArray(descriptors) || !descriptors.length) return null;
  const min = Number.isFinite(opts.min) ? opts.min : 1;
  const max = Number.isFinite(opts.max) ? opts.max : Infinity;
  const matchesFn = typeof opts.matchesFn === 'function' ? opts.matchesFn : null;

  const seen = new Set();
  const accepted = [];
  const nearMisses = [];
  for (const desc of descriptors) {
    for (const candidate of buildCandidates(desc)) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      let count;
      try { count = countFn(candidate); } catch (e) { continue; }
      if (typeof count !== 'number' || !Number.isFinite(count)) continue;
      if (matchesFn && !matchesFn(candidate)) continue;
      if (count >= min && count <= max) accepted.push(candidate);
      else if (count >= min) nearMisses.push({ sel: candidate, count });
    }
  }
  const chain = accepted.length
    ? accepted
    : nearMisses.sort((a, b) => a.count - b.count).map(item => item.sel);
  return chain.length ? chain.slice(0, SELECTOR_GEN_LIMITS.CHAIN_MAX) : null;
}
