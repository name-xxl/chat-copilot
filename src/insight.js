/* =====================================================================
 * 意图判断 —— 枚举、校验与展示格式
 * ===================================================================== */
import { clampUnit } from './utils.js';

const REASON_MAX_CHARS = 60;

export const INSIGHT_INPUTS = {
  intents: ['确认关系/态度', '表达情绪/求安慰', '提出需求/要你行动', '要解释/追问', '闲聊/分享', '试探/调侃', '已经翻篇', '信息不足'],
  needs: ['道歉', '具体行动', '解释', '你的在乎', '陪伴/倾听', '不用做什么', '信息不足'],
  timings: ['可给实质', '先别给实质', '信息不足'],
  nextSteps: ['翻聊天记录', '先道歉', '给承诺', '解释清楚', '接住情绪', '少说两句', '定个安排', '顺着聊', '信息不足'],
  tensions: ['缓和了', '还在等你表态', '不好说'],
};

export function riskLabel(risk) {
  if (risk <= 2) return '安全';
  if (risk <= 6) return '留神';
  if (risk <= 8) return '偏危险';
  return '很危险';
}

export function riskClass(risk) {
  if (risk <= 2) return 'safe';
  return risk >= 7 ? 'danger' : 'watch';
}

export function formatInsight(insight) {
  return [
    '- 真实意图：' + insight.intent,
    '- 风险：' + insight.risk + '/9（' + riskLabel(insight.risk) + '）',
    '- 对方需要：' + insight.needs,
    '- 是否给实质：' + insight.replyTiming,
    '- 建议策略：' + insight.nextStep,
    '- 话里有话：' + (insight.subtext ? '是' : '否'),
    '- 紧张氛围：' + insight.tension,
  ].join('\n');
}

export function normalizeInsight(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('意图判断格式无效');
  const risk = Math.round(parseFloat(raw.risk));
  if (!Number.isFinite(risk)) throw new Error('意图判断缺少风险分数');
  const confidence = clampUnit(raw.confidence);
  const text = key => typeof raw[key] === 'string' ? raw[key].trim() : '';
  const intent = text('intent');
  const needs = text('needs');
  const timing = text('replyTiming');
  const nextStep = text('nextStep');
  const tension = text('tension');
  return {
    intent: INSIGHT_INPUTS.intents.includes(intent) ? intent : '信息不足',
    risk: Math.max(0, Math.min(9, risk)),
    needs: INSIGHT_INPUTS.needs.includes(needs) ? needs : '信息不足',
    replyTiming: INSIGHT_INPUTS.timings.includes(timing) ? timing : '信息不足',
    nextStep: INSIGHT_INPUTS.nextSteps.includes(nextStep) ? nextStep : '信息不足',
    subtext: raw.subtext === true || ['true', '是', 'yes'].includes(String(raw.subtext).toLowerCase()),
    tension: INSIGHT_INPUTS.tensions.includes(tension) ? tension : '不好说',
    confidence,
    reason: typeof raw.reason === 'string' ? raw.reason.trim().slice(0, REASON_MAX_CHARS) : '',
  };
}

export function suggestionStyleInstruction(insight) {
  if (!insight) return '一条随意自然、一条主动推进话题、一条幽默';
  if (insight.risk >= 7 || insight.replyTiming === '先别给实质') {
    return '三条都先处理情绪：一条简短安抚、一条承接对方感受、一条给轻微台阶；不要讲道理、追问、承诺或强行幽默';
  }
  if (insight.risk >= 3) {
    return '一条先回应情绪、一条给出具体行动、一条轻松收尾；避免敷衍和过度解释';
  }
  return '一条随意自然、一条主动推进话题、一条幽默';
}
