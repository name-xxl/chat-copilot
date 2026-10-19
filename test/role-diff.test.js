import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffRole, ROLE_DIFF_LIMITS } from '../src/role-diff.js';

const other = [
  { tag: 'div', classes: ['msg', 'left'], attributes: [] },
  { tag: 'div', classes: ['msg', 'left'], attributes: [] },
];
const self = [
  { tag: 'div', classes: ['msg', 'is-self'], attributes: [] },
  { tag: 'div', classes: ['msg', 'is-self'], attributes: [] },
];

test('类名差集产出 selector 规则', () => {
  assert.deepEqual(diffRole(self, other), { kind: 'selector', selector: '.is-self' });
});

test('data-* 属性差集优先于类名', () => {
  const result = diffRole(
    self.map(d => Object.assign({}, d, { attributes: [{ name: 'data-self', value: '1' }] })),
    other,
  );
  assert.deepEqual(result, { kind: 'selector', selector: '[data-self="1"]' });
});

test('无离散差集时退回计算样式差分', () => {
  const selfStyle = [
    { tag: 'div', classes: ['msg'], attributes: [], styles: { justifyContent: 'flex-end' } },
    { tag: 'div', classes: ['msg'], attributes: [], styles: { justifyContent: 'flex-end' } },
  ];
  const otherStyle = [
    { tag: 'div', classes: ['msg'], attributes: [], styles: { justifyContent: 'flex-start' } },
    { tag: 'div', classes: ['msg'], attributes: [], styles: { justifyContent: 'flex-start' } },
  ];
  assert.deepEqual(diffRole(selfStyle, otherStyle), { kind: 'style', prop: 'justifyContent', value: 'flex-end' });
});

test('完全无差集返回 null', () => {
  assert.equal(diffRole(other, other.slice()), null);
});

test('样例过多时截断到上限', () => {
  const many = Array.from({ length: ROLE_DIFF_LIMITS.MAX_EXAMPLES + 3 }, () => self[0]);
  assert.deepEqual(diffRole(many, other), { kind: 'selector', selector: '.is-self' });
});

test('非法输入返回 null', () => {
  assert.equal(diffRole([], other), null);
  assert.equal(diffRole(self, []), null);
  assert.equal(diffRole(null, other), null);
});
