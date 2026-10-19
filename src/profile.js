/* =====================================================================
 * 主角档案 —— 数据结构与纯函数（不持有状态）
 * ===================================================================== */
import { cleanStringList } from './utils.js';

// 主角档案各字段的条数/长度上限（表单回显、AI 提炼合并、导出共用）
const LIMITS = {
  name: 20,
  identity: 200,
  background: 400,
  tags: 8, tagLength: 12,
  interests: 10, interestLength: 16,
  style: 300,
  phrases: 10, phraseLength: 30,
  boundaries: 300,
  facts: 15, factLength: 80,
};

export function emptyPlayerProfile() {
  return {
    version: 1,
    name: '',
    identity: '',
    background: '',
    personalityTags: [],
    interests: [],
    style: '',
    phrases: [],
    boundaries: '',
    facts: [],
    updatedAt: 0,
  };
}

export function normalizePlayerProfile(raw) {
  if (!raw || typeof raw !== 'object') return emptyPlayerProfile();
  const text = (key, max) => typeof raw[key] === 'string' ? raw[key].trim().slice(0, max) : '';
  return {
    version: 1,
    name: text('name', LIMITS.name),
    identity: text('identity', LIMITS.identity),
    background: text('background', LIMITS.background),
    personalityTags: cleanStringList(raw.personalityTags, LIMITS.tags, LIMITS.tagLength),
    interests: cleanStringList(raw.interests, LIMITS.interests, LIMITS.interestLength),
    style: text('style', LIMITS.style),
    phrases: cleanStringList(raw.phrases, LIMITS.phrases, LIMITS.phraseLength),
    boundaries: text('boundaries', LIMITS.boundaries),
    facts: cleanStringList(raw.facts, LIMITS.facts, LIMITS.factLength),
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

// AI 提炼结果合并进已有档案：手填字段优先，列表并集去重
export function mergePlayerProfile(existing, suggested) {
  return normalizePlayerProfile({
    name: existing.name,
    identity: existing.identity || suggested.identity,
    background: existing.background || suggested.background,
    personalityTags: cleanStringList([...existing.personalityTags, ...suggested.personalityTags], LIMITS.tags, LIMITS.tagLength),
    interests: cleanStringList([...existing.interests, ...suggested.interests], LIMITS.interests, LIMITS.interestLength),
    style: existing.style || suggested.style,
    phrases: cleanStringList([...existing.phrases, ...suggested.phrases], LIMITS.phrases, LIMITS.phraseLength),
    boundaries: existing.boundaries,
    facts: cleanStringList([...existing.facts, ...suggested.facts], LIMITS.facts, LIMITS.factLength),
    updatedAt: Date.now(),
  });
}

export function playerProfileHasContent(profile) {
  const value = profile;
  return !!(value && (
    value.name || value.identity || value.background || value.style ||
    value.boundaries || value.personalityTags.length || value.interests.length ||
    value.phrases.length || value.facts.length
  ));
}

export function formatPlayerProfileForPrompt(profile) {
  const value = profile;
  if (!playerProfileHasContent(value)) return '';
  const lines = [];
  if (value.name) lines.push('姓名/昵称：' + value.name);
  if (value.identity) lines.push('基本身份：' + value.identity);
  if (value.background) lines.push('背景经历：' + value.background);
  if (value.personalityTags.length) lines.push('性格特点：' + value.personalityTags.join('、'));
  if (value.interests.length) lines.push('兴趣爱好：' + value.interests.join('、'));
  if (value.facts.length) lines.push('稳定事实：' + value.facts.join('；'));
  if (value.style) lines.push('说话风格：' + value.style);
  if (value.phrases.length) lines.push('常用表达：' + value.phrases.join('、'));
  if (value.boundaries) lines.push('禁区与不编造：' + value.boundaries);
  return lines.join('\n');
}

export function buildPlayerCardExport(profile) {
  return {
    type: 'soul-player-card',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
  };
}

export function playerCardText(profile) {
  const lines = [
    'Soul 主角卡',
    '姓名/昵称：' + (profile.name || '未填写'),
    '基本身份：' + (profile.identity || '未填写'),
    '背景经历：' + (profile.background || '未填写'),
    '性格特点：' + (profile.personalityTags.join('、') || '未填写'),
    '兴趣爱好：' + (profile.interests.join('、') || '未填写'),
    '稳定事实：',
    ...(profile.facts.length ? profile.facts.map(item => '- ' + item) : ['- 未填写']),
    '说话风格：' + (profile.style || '未填写'),
    '常用表达：' + (profile.phrases.join('、') || '未填写'),
    '禁区与不编造：' + (profile.boundaries || '未填写'),
  ];
  return lines.join('\n');
}
