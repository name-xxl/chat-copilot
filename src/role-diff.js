/* =====================================================================
 * 角色差分 —— 纯函数：对"自己消息 / 对方消息"正负样例的描述符做
 * 属性/类名/标签/计算样式差集，产出角色判别规则（自己侧特征）。
 * 无可用判别时返回 null（调用方据此置 roleDetection=false 并在报告标注）。
 * ===================================================================== */

export const ROLE_DIFF_LIMITS = {
  MAX_EXAMPLES: 6, // 每侧最多参与差分的样例数
};

// 参与样式差分的计算样式属性（camelCase，custom 适配器按此读取 getComputedStyle）
export const ROLE_STYLE_PROPS = ['justifyContent', 'textAlign', 'flexDirection', 'alignSelf', 'marginLeft', 'marginRight'];

function capExamples(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(Boolean).slice(0, ROLE_DIFF_LIMITS.MAX_EXAMPLES);
}

// 描述符 → 特征集（class / 属性 / 标签三种离散特征）
function featuresOf(desc) {
  const features = new Set();
  if (!desc || typeof desc !== 'object') return features;
  if (desc.tag) features.add('tag:' + desc.tag);
  for (const name of Array.isArray(desc.classes) ? desc.classes : []) {
    if (typeof name === 'string' && name) features.add('class:' + name);
  }
  for (const attr of Array.isArray(desc.attributes) ? desc.attributes : []) {
    if (!attr || typeof attr.name !== 'string' || typeof attr.value !== 'string') continue;
    if (!attr.name.startsWith('data-') && !attr.name.startsWith('aria-')
      && !['role', 'type', 'dir'].includes(attr.name)) continue;
    if (!attr.value.trim()) continue;
    features.add('attr:' + attr.name + '=' + attr.value.trim());
  }
  return features;
}

function featureSelector(feature) {
  const [kind, rest] = [feature.slice(0, feature.indexOf(':')), feature.slice(feature.indexOf(':') + 1)];
  if (kind === 'class') return '.' + rest;
  if (kind === 'tag') return rest;
  if (kind === 'attr') {
    const eq = rest.indexOf('=');
    return '[' + rest.slice(0, eq) + '="' + rest.slice(eq + 1).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]';
  }
  return null;
}

function featureRank(feature) {
  if (feature.startsWith('attr:data-')) return 0;
  if (feature.startsWith('attr:')) return 1;
  if (feature.startsWith('class:')) return 2;
  return 3; // tag
}

// 计算样式差分：自己侧某属性取值一致，且对方侧取值全部不同
function diffStyle(selfDescs, otherDescs) {
  for (const prop of ROLE_STYLE_PROPS) {
    if (!selfDescs.every(d => d && d.styles && typeof d.styles === 'object')) continue;
    const selfValues = new Set(selfDescs.map(d => d.styles[prop]));
    if (selfValues.size !== 1) continue;
    const value = selfDescs[0].styles[prop];
    if (value === undefined || value === null || value === '') continue;
    const otherValues = new Set(otherDescs.map(d => d && d.styles ? d.styles[prop] : undefined));
    if (otherValues.size >= 1 && !otherValues.has(value)) {
      return { kind: 'style', prop, value };
    }
  }
  return null;
}

// 差分入口：selfDescs / otherDescs 为元素描述符数组（各 ≥1 个）
// 返回 { kind:'selector', selector } | { kind:'style', prop, value } | null
export function diffRole(selfDescs, otherDescs) {
  const self = capExamples(selfDescs);
  const other = capExamples(otherDescs);
  if (!self.length || !other.length) return null;

  let common = featuresOf(self[0]);
  for (const desc of self.slice(1)) {
    const features = featuresOf(desc);
    common = new Set(Array.from(common).filter(f => features.has(f)));
  }
  const otherAny = new Set();
  for (const desc of other) {
    for (const f of featuresOf(desc)) otherAny.add(f);
  }
  const discriminating = Array.from(common)
    .filter(f => !otherAny.has(f))
    .sort((a, b) => featureRank(a) - featureRank(b));
  if (discriminating.length) {
    const selector = featureSelector(discriminating[0]);
    if (selector) return { kind: 'selector', selector };
  }
  return diffStyle(self, other);
}
