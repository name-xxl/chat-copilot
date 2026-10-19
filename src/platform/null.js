/* =====================================================================
 * 空适配器 —— 未适配域名上的安全降级：所有定位返回空、capabilities 全关。
 * 保证脚本在没有任何拾取配置的站点上加载时不做采集、不报错、不挂 UI
 * （对齐 P2 验收要求：换空适配器时脚本安全降级）。
 * ===================================================================== */

export function createNullPlatform() {
  return {
    id: 'null',
    capabilities: { stableIdentity: false, roleDetection: false, peerProfile: false },
    selectors: {
      messageFlow: '',
      messageRow: '',
      textBubble: '',
      inputBox: '',
      sendButton: null,
      peerCard: '',
      accentSample: null,
    },
    findMessageFlow: () => null,
    collectMessages: () => [],
    getConversationInfo: () => ({ key: '', name: '', reliable: false, element: null }),
    describeConversationItem: () => null,
    collectPeerProfile: () => '',
    peerCardName: () => '',
    findComposer: () => null,
  };
}
