import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInsight, riskLabel, riskClass, formatInsight, suggestionStyleInstruction } from '../src/insight.js';

const validRaw = {
  intent: '试探/调侃', risk: 6, needs: '陪伴/倾听', replyTiming: '先别给实质',
  nextStep: '接住情绪', subtext: '是', tension: '还在等你表态', confidence: 85, reason: '对方在等表态',
};

test('normalizeInsight 完整合法输入', () => {
  const insight = normalizeInsight(validRaw);
  assert.equal(insight.intent, '试探/调侃');
  assert.equal(insight.risk, 6);
  assert.equal(insight.confidence, 0.85);
  assert.equal(insight.subtext, true);
  assert.equal(insight.reason, '对方在等表态');
});

test('normalizeInsight 枚举外取值回退“信息不足”，risk 夹取 0~9', () => {
  const insight = normalizeInsight({ risk: 15, intent: '编造的意图' });
  assert.equal(insight.intent, '信息不足');
  assert.equal(insight.needs, '信息不足');
  assert.equal(insight.nextStep, '信息不足');
  assert.equal(insight.risk, 9);
  assert.equal(normalizeInsight({ risk: -3 }).risk, 0);
});

test('normalizeInsight 非法输入抛错', () => {
  assert.throws(() => normalizeInsight(null));
  assert.throws(() => normalizeInsight({ noRisk: 1 }));
});

test('subtext 多种表述归一为布尔', () => {
  assert.equal(normalizeInsight({ risk: 1, subtext: 'yes' }).subtext, true);
  assert.equal(normalizeInsight({ risk: 1, subtext: true }).subtext, true);
  assert.equal(normalizeInsight({ risk: 1, subtext: '否' }).subtext, false);
});

test('riskLabel/riskClass 分档', () => {
  assert.equal(riskLabel(2), '安全');
  assert.equal(riskLabel(6), '留神');
  assert.equal(riskLabel(8), '偏危险');
  assert.equal(riskLabel(9), '很危险');
  assert.equal(riskClass(2), 'safe');
  assert.equal(riskClass(6), 'watch');
  assert.equal(riskClass(7), 'danger');
});

test('formatInsight 汇总各字段', () => {
  const text = formatInsight(normalizeInsight(validRaw));
  assert.ok(text.includes('试探/调侃'));
  assert.ok(text.includes('6/9'));
});

test('suggestionStyleInstruction 按风险分级', () => {
  const high = normalizeInsight({ ...validRaw, risk: 8 });
  const mid = normalizeInsight({ ...validRaw, risk: 4, replyTiming: '可给实质' });
  assert.ok(suggestionStyleInstruction(high).includes('不要讲道理'));
  assert.ok(suggestionStyleInstruction(mid).includes('具体行动'));
  assert.ok(suggestionStyleInstruction(null).includes('幽默'));
});
