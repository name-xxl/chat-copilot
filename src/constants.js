/* =====================================================================
 * 全局常量 —— 跨模块共享的时序与标识统一收纳，调优改这里
 * 领域自身的策略阈值（如记忆条数上限）留在各领域模块内
 * ===================================================================== */

// 时序（毫秒）
export const TIMING = {
  // 会话监测
  UI_PATROL_INTERVAL: 1500,        // ensureUIAlive 巡检周期
  MESSAGE_SCAN_DEBOUNCE: 500,      // MutationObserver 新消息批量扫描防抖
  BASELINE_SETTLE_MS: 1500,        // 消息基线确认窗口（会话切换后的内容归属确认）
  STATE_CLEAR_CONFIRM: 3000,       // 身份瞬时抖动的延迟确认，避免误清状态
  UI_UNMOUNT_CONFIRM: 3000,        // 输入框瞬时消失的延迟卸载，避免误拆 UI
  // 建议生成
  SUGGESTION_REFRESH_DEBOUNCE: 1200, // 对方来新消息后的刷新防抖
  // 会话身份
  CLICK_CANDIDATE_TTL: 15000,      // 点击意图候选的有效期
  // 接口
  AI_REQUEST_TIMEOUT: 60000,
  // 拾取向导
  WIZARD_HOVER_THROTTLE: 60,       // 向导悬停高亮的节流间隔
  WIZARD_RELOAD_DELAY: 1200,       // 保存拾取配置后的提示展示时长，随后刷新页面生效
};

export const LOG_PREFIX = '[SoulAI]';
export const HOST_ELEMENT_ID = 'soul-ai-bar-host';
export const WIZARD_HOST_ID = 'soul-ai-wizard-host';
