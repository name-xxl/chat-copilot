/* =====================================================================
 * 建议条渲染 —— 候选 chips 与意图判断条
 * ===================================================================== */
import { $bar, isCollapsed } from './shared.js';
import { config } from '../config.js';
import { riskLabel, riskClass } from '../insight.js';
import {
  captureChatScroll, restoreChatScroll, fillInput, getConversationInfo,
} from '../platform.js';
import { sameConversation } from '../dom.js';
import { actions } from '../actions.js';
import { log } from '../utils.js';

export function renderChips(list, cls, convInfo) {
  const chatScroll = captureChatScroll();
  const wrap = $bar('.chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  list.forEach(s => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip ' + (cls || '');
    chip.textContent = s;
    chip.title = '点击填入输入框';
    if (cls === '') {
      chip.addEventListener('click', () => {
        if (convInfo && !sameConversation(convInfo, getConversationInfo())) return;
        fillInput(s);
        log('建议已填入输入框');
      });
    } else if (cls === 'err') {
      chip.addEventListener('click', () => actions.loadSuggestions?.(true));
    }
    wrap.appendChild(chip);
  });
  restoreChatScroll(chatScroll);
  requestAnimationFrame(updateChipOverflow);
}

export function updateChipOverflow() {
  const wrap = $bar('.chips-wrap');
  if (!wrap) return;
  const hasMore = wrap.scrollWidth > wrap.clientWidth + 4
    && wrap.scrollLeft + wrap.clientWidth < wrap.scrollWidth - 4;
  wrap.classList.toggle('overflowing', hasMore);
}

export function renderInsight(insight) {
  const el = $bar('.insight');
  if (!el) return;
  if (!insight || !config.insightEnabled) {
    el.className = 'insight' + (isCollapsed() ? ' hidden' : '');
    el.textContent = '';
    el.removeAttribute('title');
    return;
  }
  const confidence = insight.confidence > 0
    ? '把握 ' + Math.round(insight.confidence * 100) + '%' : '';
  const parts = ['风险 ' + insight.risk + '/9 ' + riskLabel(insight.risk)];
  if (insight.intent !== '信息不足') parts.push(insight.intent);
  if (insight.nextStep !== '信息不足') parts.push(insight.nextStep);
  el.className = 'insight show ' + riskClass(insight.risk) + (isCollapsed() ? ' hidden' : '');
  el.textContent = parts.join(' · ');
  el.title = [
    insight.reason ? '判断依据：' + insight.reason : '',
    '对方需要：' + insight.needs,
    '是否给实质：' + insight.replyTiming,
    '氛围：' + insight.tension,
    confidence,
  ].filter(Boolean).join('\n');
}
