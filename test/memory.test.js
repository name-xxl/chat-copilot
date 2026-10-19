import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/state.js';
import {
  emptyMemory, normalizeMemory, memoryStorageKey, memoryHasContent,
  formatMemoryForPrompt, pendingMemoryMessages,
} from '../src/memory.js';

function resetActiveMemory(overrides) {
  state.activeMemory = Object.assign(emptyMemory(), overrides || {});
}

test('emptyMemory 结构完整', () => {
  const memory = emptyMemory();
  assert.equal(memory.version, 1);
  assert.deepEqual(memory.summarizedIds, []);
  assert.equal(memoryHasContent(memory), false);
});

test('normalizeMemory 空输入回退 previous', () => {
  const previous = normalizeMemory({ summary: '已有点滴' });
  const merged = normalizeMemory(null, previous);
  assert.equal(merged.summary, '已有点滴');
});

test('normalizeMemory 话题校验与状态归一', () => {
  const memory = normalizeMemory({
    summary: '轻松',
    topics: [
      { title: '爬山', summary: '约了周末', events: ['提到装备'], mood: '轻松', status: '已结束' },
      { title: '', summary: '', events: [], status: '进行中' },
      { title: '做饭', status: '未知值' },
    ],
  });
  assert.equal(memory.topics.length, 2);
  assert.equal(memory.topics[0].status, '已结束');
  assert.equal(memory.topics[1].status, '进行中');
  assert.equal(memoryHasContent(memory), true);
});

test('memoryStorageKey 使用统一前缀', () => {
  assert.equal(memoryStorageKey({ key: 'peer:小明' }), 'soul-ai-memory:peer:小明');
});

test('formatMemoryForPrompt 输出各分区', () => {
  const text = formatMemoryForPrompt(normalizeMemory({
    summary: '整体', facts: ['在上海'], openLoops: ['周末爬山'],
  }));
  assert.ok(text.includes('整体：整体'));
  assert.ok(text.includes('稳定事实：在上海'));
  assert.ok(text.includes('未完成约定：周末爬山'));
  assert.equal(formatMemoryForPrompt(emptyMemory()), '');
});

test('pendingMemoryMessages 首次整理取最后一批', () => {
  resetActiveMemory();
  const messages = Array.from({ length: 30 }, (_, i) => ({ id: 'm' + i }));
  assert.equal(pendingMemoryMessages(messages).length, 20);
});

test('pendingMemoryMessages 常规路径：锚点之后', () => {
  resetActiveMemory({ lastMessageId: 'm5' });
  const messages = [{ id: 'm5' }, { id: 'm6' }, { id: 'm7' }];
  assert.deepEqual(pendingMemoryMessages(messages).map(m => m.id), ['m6', 'm7']);
});

test('pendingMemoryMessages 锚点失配时回退 summarizedIds 水位线', () => {
  resetActiveMemory({ lastMessageId: 'gone:1', summarizedIds: ['m5', 'gone:1'] });
  const messages = [{ id: 'm5' }, { id: 'm6' }];
  assert.deepEqual(pendingMemoryMessages(messages).map(m => m.id), ['m6']);
});

test('pendingMemoryMessages 水位线也全失配才退回兜底条数', () => {
  resetActiveMemory({ lastMessageId: 'gone:1', summarizedIds: ['gone:0', 'gone:1'] });
  const messages = Array.from({ length: 20 }, (_, i) => ({ id: 'm' + i }));
  const pending = pendingMemoryMessages(messages);
  assert.equal(pending.length, 12);
  assert.equal(pending[pending.length - 1].id, 'm19');
});
