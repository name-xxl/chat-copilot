/* =====================================================================
 * 角色卡弹层 —— 对方角色卡与主角卡表单的渲染、切换与打开
 * ===================================================================== */
import { $bar, mounted } from './shared.js';
import { state, getPlayerProfile } from '../state.js';
import { currentPeerName } from '../conversation.js';
import { peerBasicInfoTags } from '../character.js';
import {
  pendingMemoryMessages, memoryHasContent, memoryEventItems, MEMORY_MIN_PENDING,
} from '../memory.js';
import { normalizePlayerProfile } from '../profile.js';
import { splitList } from '../utils.js';
import { actions } from '../actions.js';
import { openModal } from './modals.js';

export function openCharacterModal() {
  openModal('card');
  switchCardTab('peer');
  renderPlayerForm();
  renderCharacterBasics();
  actions.renderCachedCharacterCard?.();
  if (pendingMemoryMessages().length >= MEMORY_MIN_PENDING) actions.summarizeMemory?.(false);
}

// 会话切换/后台刷新时调用：已打开的角色卡弹窗只刷新内容，不再强制关闭
export function refreshCardModal() {
  const layer = $bar('.modal-layer');
  const card = $bar('.role-card');
  if (!layer || !layer.classList.contains('open') || !card || !card.classList.contains('open')) return;
  switchCardTab('peer');
  renderPlayerForm();
  renderCharacterBasics();
  actions.renderCachedCharacterCard?.();
}

export function renderTagList(selector, items, tagClass, emptyText) {
  const wrap = $bar(selector);
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('span');
    empty.className = 'role-empty';
    empty.textContent = emptyText || '暂无';
    wrap.appendChild(empty);
    return;
  }
  items.forEach(item => {
    const tag = document.createElement('span');
    tag.className = 'role-tag' + (tagClass ? ' ' + tagClass : '');
    tag.textContent = item;
    wrap.appendChild(tag);
  });
}

export function setRoleStatus(text, isError) {
  const el = $bar('.role-status');
  if (!el) return;
  el.innerHTML = '';
  el.textContent = text;
  el.classList.remove('role-hidden');
  el.classList.toggle('error', !!isError);
  if (isError) {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'role-retry';
    retry.textContent = '重试';
    el.appendChild(retry);
  }
}

export function renderCharacterBasics() {
  if (!mounted()) return;
  const name = currentPeerName();
  $bar('.role-avatar').textContent = Array.from(name)[0] || '?';
  $bar('.role-name').textContent = name;
  $bar('.role-stage').textContent = '角色卡';
  $bar('.role-hint').textContent = '点击刷新可重新分析';
  renderTagList('.role-basics', peerBasicInfoTags(), '', '暂无资料卡信息');
  renderMemorySection();
  renderRoleEvents(null);
}

export function renderCharacterData(data) {
  if (!mounted() || !data) return;
  $bar('.role-stage').textContent = data.stage;
  $bar('.role-hint').textContent = data.confidence > 0
    ? 'AI 推断 · 把握 ' + Math.round(data.confidence * 100) + '%'
    : 'AI 推断';
  $bar('.role-summary').textContent = data.summary || '暂时无法稳定判断对方性格。';
  renderTagList('.role-personality', data.personalityTags, 'accent', '暂无明确标签');
  renderTagList('.role-likes', data.likes, '', '暂无明确偏好');
  renderTagList('.role-avoid', data.avoid, 'avoid', '暂无明确雷区');
  renderMemorySection();
  renderRoleEvents(data);

  const approach = $bar('.role-approach');
  approach.innerHTML = '';
  if (data.approach.length) {
    data.approach.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      approach.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.className = 'role-empty';
    li.textContent = '暂无具体攻略建议';
    approach.appendChild(li);
  }
  $bar('.role-status').classList.add('role-hidden');
  $bar('.role-status').classList.remove('error');
}

export function renderMemorySection() {
  const section = $bar('.role-memory-section');
  if (!section) return;
  if (!memoryHasContent(state.activeMemory)) {
    section.classList.add('role-hidden');
    return;
  }
  section.classList.remove('role-hidden');
  $bar('.role-memory-summary').textContent = state.activeMemory.summary || '已整理最近聊天记忆。';
  const loops = state.activeMemory.openLoops.map(item => '待完成 · ' + item);
  renderTagList('.role-open-loops', loops, 'accent', '暂无未完成事项');
}

export function renderRoleEvents(data) {
  const events = $bar('.role-events');
  if (!events) return;
  const list = memoryEventItems(data);
  events.innerHTML = '';
  if (list.length) {
    list.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      events.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.className = 'role-empty';
    li.textContent = '聊天里还没有提取到明确事件';
    events.appendChild(li);
  }
}

export function updateRoleMemoryUI() {
  if (!mounted()) return;
  renderMemorySection();
  renderRoleEvents(state.characterCache.data || null);
}

/* ---------------------------------------------------------------------
 * 主角卡表单
 * --------------------------------------------------------------------- */
export function renderPlayerForm() {
  if (!mounted()) return;
  const profile = getPlayerProfile();
  const set = (key, value) => {
    const field = $bar('[data-player="' + key + '"]');
    if (field) field.value = value || '';
  };
  set('name', profile.name);
  set('identity', profile.identity);
  set('background', profile.background);
  set('personalityTags', profile.personalityTags.join('、'));
  set('interests', profile.interests.join('、'));
  set('style', profile.style);
  set('phrases', profile.phrases.join('\n'));
  set('boundaries', profile.boundaries);
  set('facts', profile.facts.join('\n'));
  setPlayerStatus('');
}

export function setPlayerStatus(text, isError) {
  const el = $bar('.player-status');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('role-hidden', !text);
  el.classList.toggle('error', !!isError);
}

export function readPlayerForm() {
  const value = key => {
    const field = $bar('[data-player="' + key + '"]');
    return field ? field.value.trim() : '';
  };
  return normalizePlayerProfile({
    name: value('name'),
    identity: value('identity'),
    background: value('background'),
    personalityTags: splitList(value('personalityTags')),
    interests: splitList(value('interests')),
    style: value('style'),
    phrases: splitList(value('phrases')),
    boundaries: value('boundaries'),
    facts: splitList(value('facts')),
    updatedAt: Date.now(),
  });
}

export function switchCardTab(tab) {
  const card = $bar('.role-card');
  if (!card) return;
  card.querySelectorAll('[data-card-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.cardTab === tab);
  });
  card.querySelectorAll('[data-card-pane]').forEach(pane => {
    pane.classList.toggle('role-hidden', pane.dataset.cardPane !== tab);
  });
}
