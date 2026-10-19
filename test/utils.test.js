import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hash, cleanStringList, clampUnit, parseJsonObject, parseJsonArray, splitList, safeFilePart,
} from '../src/utils.js';

test('hash 对相同输入稳定、不同输入不同', () => {
  assert.equal(hash('abc'), hash('abc'));
  assert.notEqual(hash('abc'), hash('abd'));
});

test('cleanStringList 过滤非字符串/去空白/去重/限量', () => {
  assert.deepEqual(cleanStringList([' a ', 'a', 'b', 3, '', null], 5, 10), ['a', 'b']);
  assert.deepEqual(cleanStringList('x'), []);
  assert.deepEqual(cleanStringList(['超长文本内容'], 5, 2), ['超长']);
  assert.deepEqual(cleanStringList(['a', 'b', 'c'], 2, 10), ['a', 'b']);
});

test('clampUnit 容错解析、百分制归一、夹取 0~1', () => {
  assert.equal(clampUnit(0.5), 0.5);
  assert.equal(clampUnit(80), 0.8);
  assert.equal(clampUnit('0.3'), 0.3);
  assert.equal(clampUnit('abc'), 0);
  assert.equal(clampUnit(-1), 0);
  assert.equal(clampUnit(2), 0.02);
});

test('parseJsonObject 从包裹文本中提取 JSON 对象', () => {
  assert.deepEqual(parseJsonObject('前缀 {"a":1} 后缀'), { a: 1 });
  assert.throws(() => parseJsonObject('没有 JSON'));
});

test('parseJsonArray 优先 JSON、失败按行降级、全空则抛错', () => {
  assert.deepEqual(parseJsonArray('["a","b"]'), ['a', 'b']);
  assert.deepEqual(parseJsonArray('1. 甲\n2. 乙\n```'), ['甲', '乙']);
  assert.throws(() => parseJsonArray(''));
});

test('splitList 按多种分隔符切分并去空', () => {
  assert.deepEqual(splitList('a,b，c、d；e\n f'), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(splitList('，,'), []);
});

test('safeFilePart 清洗文件名非法字符并限长', () => {
  assert.equal(safeFilePart('小 明/测:试'), '小_明_测_试');
  assert.equal(safeFilePart(''), '未命名');
  assert.equal(safeFilePart('a'.repeat(40)).length, 30);
});
