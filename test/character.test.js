import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCharacter, CHARACTER_STAGES } from '../src/character.js';

const validRaw = {
  stage: '暧昧',
  summary: '外冷内热，喜欢被主动推进',
  personalityTags: ['慢热', '嘴硬', '细心'],
  recentEvents: ['一起打了游戏'],
  likes: ['爬山'],
  avoid: ['讲道理'],
  approach: ['多接情绪'],
  confidence: 0.7,
};

test('normalizeCharacter 完整合法输入', () => {
  const data = normalizeCharacter(validRaw);
  assert.equal(data.stage, '暧昧');
  assert.deepEqual(data.personalityTags, ['慢热', '嘴硬', '细心']);
  assert.equal(data.confidence, 0.7);
});

test('normalizeCharacter 枚举外 stage 回退、列表清洗去重限长', () => {
  const data = normalizeCharacter({
    ...validRaw,
    stage: '不存在',
    personalityTags: ['慢热', '慢热', 'a'.repeat(20), 3],
  });
  assert.equal(data.stage, '信息不足');
  assert.deepEqual(data.personalityTags, ['慢热', 'a'.repeat(12)]);
});

test('normalizeCharacter 非法/空内容抛错', () => {
  assert.throws(() => normalizeCharacter(null));
  assert.throws(() => normalizeCharacter({ stage: '初识' }));
});

test('阶段枚举包含回退值', () => {
  assert.ok(CHARACTER_STAGES.includes('信息不足'));
});
