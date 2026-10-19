/* =====================================================================
 * 回复建议 —— 生成流程（判断 → 候选）与结果校验
 * ===================================================================== */
import { collectMessages } from './platform.js';
import { myName } from './state.js';
import { config, DEFAULT_CONFIG } from './config.js';
import { callAI } from './ai-client.js';
import { buildContext, buildInsightMessages, contextMessages } from './prompts.js';
import { normalizeInsight, suggestionStyleInstruction } from './insight.js';
import { parseJsonObject, parseJsonArray, logError } from './utils.js';

export function desiredSuggestionCount() {
  const configured = Number(config.suggestionCount);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured) : DEFAULT_CONFIG.suggestionCount;
}

export function genSuggestions(history, cachedInsight, onInsight) {
  const snapshot = history || collectMessages();
  // 全新会话没有消息也能用：跳过意图判断，直接生成打招呼建议
  const isEmptyChat = !contextMessages(snapshot).length;
  let aborted = false;
  let currentRequest = null;
  const promise = (async () => {
    let insight = cachedInsight || null;
    if (!isEmptyChat && config.insightEnabled && !insight) {
      try {
        currentRequest = callAI(buildInsightMessages(snapshot), { temperature: 0.1, maxTokens: 500 });
        const analysisText = await currentRequest;
        if (aborted) throw new Error('请求已取消');
        insight = normalizeInsight(parseJsonObject(analysisText));
        if (onInsight) onInsight(insight);
      } catch (e) {
        if (aborted) throw e;
        logError('意图判断失败，改为直接生成建议', e);
        insight = null;
        if (onInsight) onInsight(null);
      }
    }
    const instruction = isEmptyChat
      ? '本次特殊任务：请生成 ' + desiredSuggestionCount() + ' 条你（「' + myName() + '」）打招呼的第一句话：一条简单自然的问候、一条结合对方资料兴趣点开话题、一条轻松有梗；都不要查户口、不要一次问多个问题。'
        + '\n\n## 本次输出要求（覆盖上方输出要求）'
        + '\n- 只输出一个 JSON 数组，元素是候选回复字符串，不要任何其他文字'
        + '\n- 例如：["你好呀，看到你也喜欢爬山","嗨，匹配到你好巧","早，今天过得怎么样"]'
      : '本次特殊任务：请生成 ' + desiredSuggestionCount() + ' 条你（「' + myName() + '」）可以发送的回复建议：' + suggestionStyleInstruction(insight) + '；如果对方提问则直接回应问题。'
        + '\n\n## 本次输出要求（覆盖上方输出要求）'
        + '\n- 只输出一个 JSON 数组，元素是候选回复字符串，不要任何其他文字'
        + '\n- 例如：["你好呀","刚看到消息啦，在忙什么","哈哈可以啊"]';
    const ctx = buildContext(snapshot, insight);
    ctx[1].content += '\n' + instruction;
    currentRequest = callAI(ctx);
    const text = await currentRequest;
    if (aborted) throw new Error('请求已取消');
    const suggestions = normalizeSuggestions(parseJsonArray(text));
    if (!suggestions.length) throw new Error('AI 没有返回可用的回复建议');
    return { suggestions, insight };
  })();
  promise.abort = function () {
    aborted = true;
    if (currentRequest && typeof currentRequest.abort === 'function') currentRequest.abort();
  };
  return promise;
}

export function normalizeSuggestions(list) {
  const seen = new Set();
  return list
    .filter(s => typeof s === 'string')
    .map(s => s.trim())
    .filter(s => {
      if (!s || seen.has(s)) return false;
      seen.add(s);
      return true;
    })
    .slice(0, desiredSuggestionCount());
}
