import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidates, pickChain, SELECTOR_GEN_LIMITS } from '../src/selector-gen.js';

function makeDesc(overrides = {}) {
  return Object.assign({
    tag: 'div',
    id: '',
    classes: ['bubble-row'],
    attributes: [],
    path: [{ tag: 'div', classes: ['message-flow'] }],
    textHead: '',
  }, overrides);
}

test('buildCandidates 按 data-* > 语义属性 > id > class > 路径排序', () => {
  const desc = makeDesc({
    id: 'row1',
    classes: ['bubble-row', 'is-self'],
    attributes: [
      { name: 'data-msg-id', value: 'a1' },
      { name: 'aria-label', value: '消息' },
    ],
    path: [
      { tag: 'div', classes: ['bubble-row', 'is-self'] },
      { tag: 'div', classes: ['message-flow'] },
    ],
  });
  const candidates = buildCandidates(desc);
  assert.ok(candidates.includes('[data-msg-id="a1"]'));
  assert.ok(candidates.includes('[aria-label="消息"]'));
  assert.ok(candidates.includes('#row1'));
  assert.ok(candidates.includes('div.bubble-row'));
  assert.ok(candidates.indexOf('[data-msg-id="a1"]') < candidates.indexOf('[aria-label="消息"]'));
  assert.ok(candidates.indexOf('[aria-label="消息"]') < candidates.indexOf('#row1'));
  assert.ok(candidates.some(sel => sel.includes('>')), '应包含结构路径候选');
  assert.ok(candidates.length <= SELECTOR_GEN_LIMITS.CANDIDATE_MAX);
});

test('buildCandidates 哈希味 class 排在稳定 class 之后', () => {
  const desc = makeDesc({ classes: ['row', 'css-1q2w3e4'] });
  const candidates = buildCandidates(desc);
  assert.ok(!candidates[0].includes('css-'), '首个候选不应是哈希 class');
  assert.ok(candidates.some(sel => sel.includes('css-')), '但仍在兜底候选中');
});

test('buildCandidates 数字结尾的语义 class 不误判为哈希', () => {
  const desc = makeDesc({ classes: ['row1'], id: 'msg2' });
  const candidates = buildCandidates(desc);
  assert.ok(candidates.includes('.row1'));
  assert.ok(candidates.includes('#msg2'));
});

test('buildCandidates 属性值做引号转义', () => {
  const desc = makeDesc({
    attributes: [{ name: 'data-x', value: 'a"b\\c' }],
  });
  const candidates = buildCandidates(desc);
  assert.ok(candidates.includes('[data-x="a\\"b\\\\c"]'));
});

test('pickChain 返回命中数在区间内的候选链', () => {
  const counts = { '.bubble-row': 20, '[data-msg-id="x"]': 1, '#row1': 1 };
  const chain = pickChain([makeDesc({ id: 'row1', attributes: [{ name: 'data-msg-id', value: 'x' }] })],
    sel => counts[sel] || 0, { min: 2, max: 50 });
  assert.deepEqual(chain, ['.bubble-row']);
});

test('pickChain 全部超上限时退回 count 最小者优先的链', () => {
  const counts = { '.a': 50, '.a.b': 30 };
  const chain = pickChain([makeDesc({ classes: ['a', 'b'] })], sel => counts[sel] || 0, { min: 1, max: 5 });
  assert.deepEqual(chain, ['.a.b', '.a']);
});

test('pickChain 多个样例描述符合并去重并限制链长', () => {
  const counts = { '.row': 10, '[data-r="1"]': 3, '[data-r="2"]': 2, '.x': 4, '.y': 5, '.z': 6, '.q': 7 };
  const chain = pickChain([
    makeDesc({ classes: ['row', 'x'], attributes: [{ name: 'data-r', value: '1' }] }),
    makeDesc({ classes: ['row', 'y'], attributes: [{ name: 'data-r', value: '2' }] }),
  ], sel => counts[sel] || 0, { min: 1, max: 100 });
  assert.ok(chain.length <= SELECTOR_GEN_LIMITS.CHAIN_MAX);
  assert.ok(chain.includes('.row'));
  assert.ok(chain.includes('[data-r="1"]'));
});

test('pickChain matchesFn 不通过的候选被排除', () => {
  const chain = pickChain([makeDesc({ classes: ['row'] })], () => 10, {
    min: 1, max: 100, matchesFn: sel => sel !== '.row',
  });
  assert.ok(!chain.includes('.row'));
});

test('pickChain 无可用候选或非法输入返回 null', () => {
  assert.equal(pickChain([], () => 1), null);
  assert.equal(pickChain([makeDesc()], 'not-a-fn'), null);
  assert.equal(pickChain([makeDesc({ classes: [] })], () => 0, { min: 1 }), null);
});
