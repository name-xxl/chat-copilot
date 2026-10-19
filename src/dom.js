/* =====================================================================
 * 通用 DOM 工具 —— 平台无关的元素判断/比较/定位，不含页面启发式
 * 平台相关的采集与会话身份识别在 platform/ 适配器里
 * ===================================================================== */

export function firstTextLine(el) {
  if (!el) return '';
  return ((el.innerText || el.textContent || '').split('\n')
    .map(s => s.trim()).find(Boolean)) || '';
}

export function sameConversation(a, b) {
  if (!a || !b || !a.key || !b.key || a.key !== b.key) return false;
  if (a.reliable && b.reliable) {
    if (a.element === b.element) return true;
    // 两个节点都还挂在 DOM 上且不是同一个节点：是两个不同的会话（如同名联系人）
    const bothAlive = !!(a.element && a.element.isConnected && b.element && b.element.isConnected);
    if (bothAlive) return false;
    // 仅当旧节点已被页面重渲染移除时，才退回按名字判断是否同一会话
    return a.name === b.name;
  }
  // 不可靠身份（键由昵称归一而来）：键一致且元素或名字吻合即同一会话，
  // 避免点击层/头部层交替时被误判为切换
  return a.element === b.element || a.name === b.name;
}

export function isVisible(el) {
  return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
}

// 沿父链找到第一个非 flex-row/grid 布局的容器作为挂载父节点
export function findHostMount(composer) {
  let anchor = composer;
  let parent = anchor.parentElement;
  while (parent && parent !== document.body) {
    const style = getComputedStyle(parent);
    const rowFlex = (style.display === 'flex' || style.display === 'inline-flex')
      && style.flexDirection.startsWith('row');
    const grid = style.display === 'grid' || style.display === 'inline-grid';
    if (!rowFlex && !grid && style.display !== 'contents') return { parent, anchor };
    anchor = parent;
    parent = parent.parentElement;
  }
  return { parent: composer.parentElement, anchor: composer };
}
