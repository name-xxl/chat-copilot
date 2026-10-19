import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDockStop } from '../src/dom.js';

// 底栏状：高度与输入区同量级、父级最后一个在流子级、非 fixed/sticky。
// 不区分布局方向——行布局的输入条（如"编辑器+操作按钮"的 row）本身也可能是底栏。
test('isDockStop 命中同量级高度 + 末子级的容器', () => {
  assert.equal(isDockStop({ position: 'static', heightRatio: 1.8, lastInFlow: true }), true);
  assert.equal(isDockStop({ position: 'static', heightRatio: 4, lastInFlow: true }), true);
});

test('isDockStop 不命中超高容器（页面主列，高度远超输入区）', () => {
  assert.equal(isDockStop({ position: 'static', heightRatio: 4.5, lastInFlow: true }), false);
  // 高度为 0/缺失（display:contents 或无布局环境）：不采纳
  assert.equal(isDockStop({ position: 'static', heightRatio: 0, lastInFlow: true }), false);
  assert.equal(isDockStop({ position: 'static', heightRatio: Number.NaN, lastInFlow: true }), false);
});

test('isDockStop 不命中非末子级（其后还有在流内容，如编辑器盒子旁边还有操作列）', () => {
  assert.equal(isDockStop({ position: 'static', heightRatio: 1.5, lastInFlow: false }), false);
});

test('isDockStop 不命中 fixed/sticky 容器（悬浮底栏维持旧挂载行为）', () => {
  for (const position of ['fixed', 'sticky']) {
    assert.equal(isDockStop({ position, heightRatio: 1.5, lastInFlow: true }), false, position);
  }
});

test('isDockStop 对非法输入返回 false', () => {
  assert.equal(isDockStop(null), false);
  assert.equal(isDockStop({}), false);
});
