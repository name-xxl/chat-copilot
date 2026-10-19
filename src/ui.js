/* =====================================================================
 * UI 门面 —— Shadow DOM 隔离的建议条 / 设置弹层 / 角色卡 / 拾取向导
 * 实现拆分在 src/ui/ 子模块（共享状态/样式/模板/建议条/弹层/设置/角色卡/挂载/主题/向导），
 * 外部统一从这里导入；业务动作通过 actions 总线调用（main.js 注入）
 * ===================================================================== */
export * from './ui/shared.js';
export * from './ui/core.js';
export * from './ui/bar.js';
export * from './ui/modals.js';
export * from './ui/settings.js';
export * from './ui/card.js';
export * from './ui/wizard.js';
export * from './ui/theme.js';
