/* =====================================================================
 * 平台拾取配置 —— 纯函数：向导产出配置的 schema 校验与归一
 * （白名单字段 / 选择器合法性 / 链长夹取 / 枚举 / 布尔夹取）
 * 配置按域名存 GM 存储（platform.js 门面负责读写），落盘与读取都必须过这里。
 * ===================================================================== */

export const PLATFORM_CONFIG_VERSION = 1;

export const PLATFORM_CONFIG_LIMITS = {
  CHAIN_MAX: 5,            // 每条 fallback 链的最长保留数
  SELECTOR_MAX_LENGTH: 120,
  DOMAIN_MAX_LENGTH: 100,
};

const IDENTITY_MODES = ['sidebar', 'header', 'url'];
const STYLE_PROPS_ALLOWED = ['justifyContent', 'textAlign', 'flexDirection', 'alignSelf', 'marginLeft', 'marginRight'];

// 必填链（缺失即整体非法）；其余链字段可为 null
const REQUIRED_CHAINS = ['messageFlow', 'messageRow', 'inputBox'];
const OPTIONAL_CHAINS = ['textBubble', 'sendButton', 'peerCard', 'accentSample', 'identityEntry', 'identityHeader'];

function normalizeSelector(value) {
  if (typeof value !== 'string') return null;
  const sel = value.trim();
  if (!sel || sel.length > PLATFORM_CONFIG_LIMITS.SELECTOR_MAX_LENGTH) return null;
  if (/[<>{}]/.test(sel)) return null;
  return sel;
}

function normalizeChain(value, required) {
  if (value === null || value === undefined) return required ? null : null;
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  const chain = [];
  for (const item of value) {
    const sel = normalizeSelector(item);
    if (!sel || seen.has(sel)) continue;
    seen.add(sel);
    chain.push(sel);
    if (chain.length >= PLATFORM_CONFIG_LIMITS.CHAIN_MAX) break;
  }
  if (!chain.length) return null;
  return chain;
}

function normalizeSelfMatch(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.kind === 'selector') {
    const selector = normalizeSelector(value.selector);
    return selector ? { kind: 'selector', selector } : null;
  }
  if (value.kind === 'style') {
    if (!STYLE_PROPS_ALLOWED.includes(value.prop)) return null;
    if (typeof value.value !== 'string' || !value.value.trim()) return null;
    return { kind: 'style', prop: value.prop, value: value.value.trim() };
  }
  return null;
}

function normalizeDomain(value) {
  if (typeof value !== 'string') return null;
  const domain = value.trim().toLowerCase();
  if (!domain || domain.length > PLATFORM_CONFIG_LIMITS.DOMAIN_MAX_LENGTH) return null;
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(domain)) return null;
  return domain;
}

// 校验并归一一份拾取配置；expectedDomain 为当前站点 hostname（不匹配则拒绝，
// 防止 A 站点的配置被误用到 B 站点）。非法输入返回 null。
export function normalizePlatformConfig(raw, expectedDomain) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version !== PLATFORM_CONFIG_VERSION) return null;
  const domain = normalizeDomain(raw.domain);
  if (!domain) return null;
  if (expectedDomain && domain !== expectedDomain.trim().toLowerCase()) return null;

  const config = { version: PLATFORM_CONFIG_VERSION, domain };

  for (const field of REQUIRED_CHAINS) {
    const chain = normalizeChain(raw[field], true);
    if (!chain) return null;
    config[field] = chain;
  }
  for (const field of OPTIONAL_CHAINS) {
    const chain = normalizeChain(raw[field], false);
    config[field] = chain || null;
  }

  config.selfMatch = normalizeSelfMatch(raw.selfMatch);

  const identity = raw.identity && typeof raw.identity === 'object' ? raw.identity : null;
  const mode = identity && IDENTITY_MODES.includes(identity.mode) ? identity.mode : null;
  if (!mode) return null;
  config.identity = { mode };
  if (mode === 'sidebar') {
    config.identity.entry = normalizeChain(identity.entry, true);
    config.identity.activeMatch = normalizeSelfMatch(identity.activeMatch);
    if (!config.identity.entry) return null;
  }
  if (mode === 'header') {
    config.identity.header = normalizeChain(identity.header, true);
    if (!config.identity.header) return null;
  }

  const caps = raw.capabilities && typeof raw.capabilities === 'object' ? raw.capabilities : {};
  config.capabilities = {
    stableIdentity: !!caps.stableIdentity,
    roleDetection: !!caps.roleDetection,
    peerProfile: !!caps.peerProfile,
  };
  return config;
}

// 由配置推导能力声明（向导落盘前调用；显式 capabilities 优先生效）
export function deriveCapabilities(config) {
  if (!config || typeof config !== 'object') {
    return { stableIdentity: false, roleDetection: false, peerProfile: false };
  }
  return {
    stableIdentity: config.identity.mode === 'url'
      || (config.identity.mode === 'sidebar' && !!config.identity.activeMatch),
    roleDetection: !!config.selfMatch,
    peerProfile: !!config.peerCard,
  };
}
