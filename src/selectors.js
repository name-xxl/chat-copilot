/* =====================================================================
 * SELECTORS —— Soul 平台适配器（platform/soul.js）的选择器配置
 * （基于 2026-10 实际 DOM 勘察）页面改版只需改这里。
 * ===================================================================== */
export const SELECTORS = {
  // 左侧会话列表（2026-10 实测：类名 .conv-list，直接位于左侧 section 下）
  convList: '.conv-list',
  convActive: '.active',
  convName: '.conv-name',

  // 聊天消息区（.message-flow 内为 .bubble-row，自己发的带 is-self）
  messageFlow: '.message-flow',
  messageRow: '.bubble-row',
  rowSelfMark: 'is-self',
  rowSystemMark: 'is-system',
  textBubble: '.bubble',
  emojiBubble: '.bubble-emoji-wrap',
  systemBubble: '.bubble-system-inner',

  // 对方资料卡（右侧：匹配度/星球/认证/引力签/共同点）
  peerCard: '.chat-card',

  // 聊天窗固定头部（切换会话即更新对方昵称，不随消息滚动/虚拟化消失）
  chatHeader: '.detail-header',

  // 输入区（富文本编辑器为 contenteditable）
  inputBox: '[contenteditable="true"]',
  sendButton: 'button.send-btn',
};
