/* =====================================================================
 * 文字稿 —— 聊天记录 → 带名字的对话文本
 * ===================================================================== */
import { myName } from './state.js';
import { currentPeerName } from './conversation.js';

export function buildTranscript(messages) {
  // 名字在循环外解析一次：currentPeerName 内部会做 DOM 查询
  const self = myName();
  const peer = currentPeerName();
  return messages
    .map(m => (m.role === 'self' ? self : peer) + '：' + m.text)
    .join('\n');
}

// 双卡提炼等需要严格区分双方的场景：每行加 [我]/[对方] 标记，不依赖昵称辨认
export function buildRoleTaggedTranscript(messages) {
  const self = myName();
  const peer = currentPeerName();
  return messages
    .map(m => (m.role === 'self' ? '[我] ' + self : '[对方] ' + peer) + '：' + m.text)
    .join('\n');
}
