/* =====================================================================
 * AI 调用（OpenAI 兼容 /chat/completions）—— 可替换的接口客户端
 * ===================================================================== */
import { config } from './config.js';
import { TIMING } from './constants.js';

export function chatCompletionsUrl() {
  const base = (config.baseUrl || '').trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return base + '/chat/completions';
  return base + '/v1/chat/completions';
}

export function callAI(messages, opts) {
  opts = opts || {};
  if (!config.apiKey) return Promise.reject(new Error('点 ⚙ 填写 API Key 后可用'));
  const body = {
    model: config.model,
    temperature: opts.temperature != null ? opts.temperature : Number(config.temperature),
    messages,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (config.thinkingMode === 'enabled' || config.thinkingMode === 'disabled') {
    body.thinking = { type: config.thinkingMode };
  }
  let request = null;
  const promise = new Promise((resolve, reject) => {
    request = GM_xmlhttpRequest({
      method: 'POST',
      url: chatCompletionsUrl(),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.apiKey,
      },
      data: JSON.stringify(body),
      timeout: TIMING.AI_REQUEST_TIMEOUT,
      onload(res) {
        const text = res.responseText || '';
        let data = null;
        let parseFailed = false;
        if (text) {
          try { data = JSON.parse(text); } catch (e) { parseFailed = true; }
        }
        if (res.status < 200 || res.status >= 300) {
          const apiError = data && data.error;
          const detail = (apiError && (apiError.message || apiError.code))
            || text.slice(0, 200) || res.statusText || '未知错误';
          reject(new Error('API 错误 ' + res.status + ': ' + detail));
          return;
        }
        if (parseFailed || !data) {
          reject(new Error('响应解析失败: ' + text.slice(0, 200)));
          return;
        }
        const choice = data.choices && data.choices[0];
        const content = choice && choice.message && choice.message.content;
        if (typeof content !== 'string') {
          reject(new Error('响应格式错误: 未找到 choices[0].message.content'));
          return;
        }
        resolve(content);
      },
      onerror() { reject(new Error('网络错误，请检查 ⚙ 里的 Base URL / 网络')); },
      ontimeout() { reject(new Error('请求超时')); },
      onabort() { reject(new Error('请求已取消')); },
    });
  });
  promise.abort = function () {
    if (request && typeof request.abort === 'function') request.abort();
  };
  return promise;
}
