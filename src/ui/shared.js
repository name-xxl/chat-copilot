/* =====================================================================
 * UI 共享状态 —— host/root 引用、请求簿记与收起状态，供各 UI 子模块使用
 * ===================================================================== */
export const ui = { host: null, root: null };

let collapsed = false;

export function isCollapsed() { return collapsed; }
export function setCollapsed(value) { collapsed = !!value; }

export function mounted() { return ui.host && ui.host.isConnected; }
export function $bar(sel) { return ui.root && ui.root.querySelector(sel); }
