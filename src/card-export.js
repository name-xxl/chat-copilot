/* =====================================================================
 * 卡片导出 —— 对方角色卡 / 主角卡的 JSON 与 TXT 导出
 * ===================================================================== */
import { currentPeerName } from './conversation.js';
import { state } from './state.js';
import { memoryEventItems } from './memory.js';
import { peerBasicInfoTags } from './character.js';
import { buildPlayerCardExport, playerCardText } from './profile.js';
import { fileDate, safeFilePart, downloadText } from './utils.js';

function buildPeerCardExport() {
  const data = state.characterCache.data || {};
  return {
    type: 'soul-peer-card',
    version: 1,
    exportedAt: new Date().toISOString(),
    name: currentPeerName(),
    basicInfo: peerBasicInfoTags(),
    stage: data.stage || '',
    summary: data.summary || '',
    personalityTags: data.personalityTags || [],
    recentEvents: memoryEventItems(data),
    likes: data.likes || [],
    avoid: data.avoid || [],
    approach: data.approach || [],
    memory: {
      summary: state.activeMemory.summary,
      topics: state.activeMemory.topics,
      facts: state.activeMemory.facts,
      openLoops: state.activeMemory.openLoops,
      updatedAt: state.activeMemory.updatedAt,
    },
  };
}

function peerCardText(card) {
  const lines = [
    'Soul 对方角色卡',
    '姓名：' + card.name,
    '关系阶段：' + (card.stage || '未知'),
    '基础情报：' + (card.basicInfo.join('；') || '暂无'),
    '',
    '性格侧写：',
    card.summary || '暂无',
    card.personalityTags.length ? '性格标签：' + card.personalityTags.join('、') : '',
    '',
    '事件记忆：',
    ...(card.recentEvents.length ? card.recentEvents.map(item => '- ' + item) : ['- 暂无']),
    '',
    '话题偏好：' + (card.likes.join('、') || '暂无'),
    '尽量避开：' + (card.avoid.join('、') || '暂无'),
    '对话攻略：',
    ...(card.approach.length ? card.approach.map(item => '- ' + item) : ['- 暂无']),
    '',
    '长期记忆：',
    card.memory.summary || '暂无',
    ...(card.memory.openLoops.length ? ['待完成：' + card.memory.openLoops.join('；')] : []),
    ...(card.memory.facts.length ? ['稳定事实：' + card.memory.facts.join('；')] : []),
  ];
  return lines.filter(line => line !== '').join('\n');
}

export function exportPeerCard(format) {
  const card = buildPeerCardExport();
  const base = 'Soul对方角色卡_' + safeFilePart(card.name) + '_' + fileDate();
  if (format === 'json') {
    downloadText(base + '.json', JSON.stringify(card, null, 2), 'application/json;charset=utf-8');
  } else {
    downloadText(base + '.txt', peerCardText(card), 'text/plain;charset=utf-8');
  }
}

export function exportPlayerCard(profile, format) {
  const data = buildPlayerCardExport(profile);
  const base = 'Soul主角卡_' + safeFilePart(profile.name) + '_' + fileDate();
  if (format === 'json') {
    downloadText(base + '.json', JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
  } else {
    downloadText(base + '.txt', playerCardText(profile), 'text/plain;charset=utf-8');
  }
}
