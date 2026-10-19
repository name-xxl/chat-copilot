/* =====================================================================
 * 弹层开关 —— 通用打开/关闭逻辑（设置与角色卡共用一个遮罩层）
 * 视图各自的初始化渲染由调用方（settings/card 模块）负责
 * ===================================================================== */
import { $bar } from './shared.js';
import { actions } from '../actions.js';

export function openModal(view) {
  const layer = $bar('.modal-layer');
  const pop = $bar('.pop');
  const card = $bar('.role-card');
  if (!layer || !pop || !card) return;
  const settingsView = view === 'settings';
  if (!settingsView) actions.cancelCharacterRequest?.();
  pop.classList.toggle('open', settingsView);
  card.classList.toggle('open', !settingsView);
  layer.classList.add('open');
}

export function closeModal() {
  const layer = $bar('.modal-layer');
  if (!layer) return;
  layer.classList.remove('open');
  $bar('.pop')?.classList.remove('open');
  $bar('.role-card')?.classList.remove('open');
  actions.cancelCharacterRequest?.();
}
