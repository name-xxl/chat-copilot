import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHex, parseColor, luminance, mixColor, buildAccentFamily, DEFAULT_ACCENT } from '../src/ui/theme.js';

test('parseHex 只接受 6 位十六进制', () => {
  assert.deepEqual(parseHex('#2f9e8f'), { r: 47, g: 158, b: 143, a: 1 });
  assert.equal(parseHex('#fff'), null);
  assert.equal(parseHex('2f9e8f'), null);
  assert.equal(parseHex(''), null);
});

test('parseColor 解析 rgb/rgba，拒绝非法输入', () => {
  assert.deepEqual(parseColor('rgb(1, 2, 3)'), { r: 1, g: 2, b: 3, a: 1 });
  assert.equal(parseColor('rgba(1,2,3,.5)').a, 0.5);
  assert.equal(parseColor('red'), null);
  assert.equal(parseColor(''), null);
});

test('luminance 白色接近 1、黑色接近 0', () => {
  assert.ok(luminance({ r: 255, g: 255, b: 255 }) > 0.9);
  assert.ok(luminance({ r: 0, g: 0, b: 0 }) < 0.05);
});

test('mixColor 向白/黑混合', () => {
  assert.deepEqual(mixColor({ r: 0, g: 0, b: 0, a: 1 }, 255, 0.5), { r: 128, g: 128, b: 128, a: 1 });
  assert.deepEqual(mixColor({ r: 200, g: 100, b: 50, a: 1 }, 0, 1), { r: 0, g: 0, b: 0, a: 1 });
});

test('buildAccentFamily 生成完整令牌且深浅模式可读性相反', () => {
  const light = buildAccentFamily(DEFAULT_ACCENT, false);
  const dark = buildAccentFamily(DEFAULT_ACCENT, true);
  const names = ['--accent', '--accent-strong', '--accent-deep', '--accent-bright',
    '--accent-soft', '--accent-soft-hover', '--accent-border', '--accent-focus', '--focus-ring'];
  for (const name of names) {
    assert.ok(name in light, name);
    assert.ok(name in dark, name);
  }
  // 深色模式下正文用色应比浅色模式更亮
  assert.ok(luminance(parseColor(dark['--accent-deep'])) > luminance(parseColor(light['--accent-deep'])));
});
