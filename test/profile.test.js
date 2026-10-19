import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyPlayerProfile, normalizePlayerProfile, mergePlayerProfile,
  playerProfileHasContent, formatPlayerProfileForPrompt,
} from '../src/profile.js';

test('normalizePlayerProfile 空输入返回空档案', () => {
  assert.deepEqual(normalizePlayerProfile(null), emptyPlayerProfile());
});

test('normalizePlayerProfile 裁剪与限长', () => {
  const profile = normalizePlayerProfile({
    name: 'a'.repeat(30),
    personalityTags: ['慢热', '慢热', 'b'.repeat(20)],
  });
  assert.equal(profile.name.length, 20);
  assert.deepEqual(profile.personalityTags, ['慢热', 'b'.repeat(12)]);
});

test('mergePlayerProfile 手填字段优先、列表并集去重', () => {
  const existing = normalizePlayerProfile({
    name: '小林', identity: '设计师', phrases: ['行吧'],
  });
  const suggested = normalizePlayerProfile({
    name: 'AI 起的', identity: 'AI 编的', phrases: ['行吧', '有点意思'],
  });
  const merged = mergePlayerProfile(existing, suggested);
  assert.equal(merged.name, '小林');
  assert.equal(merged.identity, '设计师');
  assert.deepEqual(merged.phrases, ['行吧', '有点意思']);
});

test('playerProfileHasContent 判定', () => {
  assert.equal(playerProfileHasContent(emptyPlayerProfile()), false);
  assert.equal(playerProfileHasContent(normalizePlayerProfile({ name: '小林' })), true);
});

test('formatPlayerProfileForPrompt 空档案为空串、有内容按行输出', () => {
  assert.equal(formatPlayerProfileForPrompt(emptyPlayerProfile()), '');
  const text = formatPlayerProfileForPrompt(normalizePlayerProfile({
    name: '小林', style: '短句', facts: ['养了一只猫'],
  }));
  assert.ok(text.includes('姓名/昵称：小林'));
  assert.ok(text.includes('稳定事实：养了一只猫'));
});
