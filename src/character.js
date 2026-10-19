/* =====================================================================
 * 对方角色卡 —— 枚举与校验
 * ===================================================================== */
import { collectPeerProfile } from './platform.js';
import { cleanStringList, clampUnit } from './utils.js';

export const CHARACTER_STAGES = ['初识', '熟悉', '暧昧', '拉扯', '稳定', '信息不足'];

// 角色卡各字段的条数/长度上限
const LIMITS = {
  summary: 240,
  tags: 5, tagLength: 12,
  events: 4, eventLength: 60,
  likes: 4, likeLength: 16,
  avoid: 3, avoidLength: 30,
  approach: 4, approachLength: 60,
};

export function normalizeCharacter(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('角色卡格式无效');
  const text = key => typeof raw[key] === 'string' ? raw[key].trim() : '';
  const list = (value, maxItems, maxLength) => cleanStringList(value, maxItems, maxLength);
  const confidence = clampUnit(raw.confidence);
  const stage = text('stage');
  const data = {
    stage: CHARACTER_STAGES.includes(stage) ? stage : '信息不足',
    summary: text('summary').slice(0, LIMITS.summary),
    personalityTags: list(raw.personalityTags, LIMITS.tags, LIMITS.tagLength),
    recentEvents: list(raw.recentEvents, LIMITS.events, LIMITS.eventLength),
    likes: list(raw.likes, LIMITS.likes, LIMITS.likeLength),
    avoid: list(raw.avoid, LIMITS.avoid, LIMITS.avoidLength),
    approach: list(raw.approach, LIMITS.approach, LIMITS.approachLength),
    confidence,
  };
  if (!data.summary && !data.personalityTags.length) throw new Error('角色卡内容为空');
  return data;
}

export function characterCacheKey(info, history) {
  const last = history[history.length - 1];
  return info.key + '|' + (last ? last.id : 'empty') + '|' + collectPeerProfile();
}

// 对方资料卡文本拆成展示用标签
export function peerBasicInfoTags() {
  return collectPeerProfile()
    .split(/[；;\n]/)
    .flatMap(line => line.split('·'))
    .flatMap(part => {
      const value = part.trim();
      const tagList = value.match(/^(?:Ta的)?(?:引力签|标签|兴趣)[：:]\s*(.+)$/);
      return tagList ? tagList[1].split('、').map(s => s.trim()) : [value];
    })
    .filter(Boolean)
    .slice(0, 10);
}
