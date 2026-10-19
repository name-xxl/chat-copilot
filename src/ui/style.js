/* =====================================================================
 * UI 样式 —— Shadow DOM 内部 CSS，与宿主页面隔离
 * 色值全部走 :host 上的设计令牌；主题模块（ui/theme.js）按明暗检测与
 * 主色提取结果覆盖令牌。此处 :host 内为浅色默认值。
 * ===================================================================== */
export const UI_CSS = `
  :host {
    --accent: #2f9e8f;
    --accent-strong: #278b7e;
    --accent-deep: #2f7d70;
    --accent-bright: #3b9d8f;
    --accent-soft: #e9f8f4;
    --accent-soft-hover: #dff5ef;
    --accent-border: #d5eee7;
    --accent-focus: #74c9bc;
    --focus-ring: rgba(47,158,143,.42);
    --bg-bar: rgba(255,255,255,.97);
    --bg-card: #ffffff;
    --bg-soft: #f4f8f7;
    --bg-inset: #f8fbfa;
    --bg-overlay: rgba(255,255,255,.65);
    --border: #e3ece8;
    --border-soft: #eef4f2;
    --fg: #35443f;
    --fg-strong: #2e3d39;
    --fg-body: #44534e;
    --fg-muted: #63736f;
    --fg-faint: #85938f;
    --fg-disabled: #9aa7a3;
    --danger: #b4556a;
    --danger-soft: #fff7f9;
    --danger-border: #f0d6dd;
    --watch-bg: #fff9ec;
    --watch-border: #f2e1b9;
    --watch-text: #8a6729;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif; }
  .wrap { font-size: 12px; color: var(--fg); }
  .bar {
    position: relative; padding: 8px 8px 9px; border-radius: 16px;
    background: var(--bg-bar); border: 1px solid var(--border);
    box-shadow: 0 10px 30px rgba(30,73,66,.10), 0 2px 6px rgba(30,73,66,.05);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  }
  .bar.hidden { display: none; }
  .bar-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .brand {
    display: inline-flex; align-items: center; gap: 4px; flex: none; padding-left: 2px;
    color: var(--accent-bright); font-size: 11px; font-weight: 600; letter-spacing: .03em;
  }
  .brand svg { width: 14px; height: 14px; fill: currentColor; }
  .insight {
    display: none; flex: 1; min-width: 0; padding: 4px 8px; border-radius: 999px;
    background: var(--bg-soft); border: 1px solid var(--border-soft); font-size: 10.5px; line-height: 1.45;
    color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .insight.show { display: block; }
  .insight.hidden { display: none; }
  .insight.safe { background: var(--accent-soft); border-color: var(--accent-border); color: var(--accent-deep); }
  .insight.watch { background: var(--watch-bg); border-color: var(--watch-border); color: var(--watch-text); }
  .insight.danger { background: var(--danger-soft); border-color: var(--danger-border); color: var(--danger); }
  .tools { display: flex; gap: 2px; flex: none; margin-left: auto; }
  .ibtn {
    width: 26px; height: 26px; border-radius: 8px; border: none; background: transparent;
    color: var(--fg-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
    padding: 0; transition: background .15s, color .15s, transform .15s;
  }
  .ibtn:hover { background: var(--accent-soft); color: var(--accent-deep); }
  .ibtn:active { transform: scale(.94); }
  .ibtn svg { width: 15px; height: 15px; display: block; }
  button:focus { outline: none; }
  button:focus-visible, .chip:focus-visible {
    outline: 2px solid var(--focus-ring); outline-offset: 1px;
  }
  .chips-wrap {
    margin-top: 7px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
    -ms-overflow-style: none; overscroll-behavior-x: contain;
  }
  .chips-wrap::-webkit-scrollbar { display: none; }
  .chips-wrap.overflowing {
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
    mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
  }
  .chips { display: flex; gap: 6px; width: max-content; min-width: 100%; }
  .chip {
    flex: none; max-width: 310px; min-height: 34px; background: var(--bg-inset);
    border: 1px solid var(--border); border-radius: 10px; padding: 8px 11px;
    font-size: 12px; line-height: 1.45; color: var(--fg); text-align: left; cursor: pointer;
    white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden; transition: background .15s, border-color .15s, transform .15s;
  }
  .chip:hover { background: var(--accent-soft); border-color: var(--accent-border); transform: translateY(-1px); }
  .chip.muted { color: var(--fg-muted); border-style: dashed; cursor: default; background: var(--bg-inset); }
  .chip.err { color: var(--danger); border-color: var(--danger-border); background: var(--danger-soft); cursor: pointer; }
  .mini {
    display: none; width: max-content; height: 28px; margin: 0 0 6px auto; padding: 0 10px;
    align-items: center; gap: 5px; border: 1px solid var(--border); border-radius: 999px;
    background: var(--bg-card); color: var(--accent-deep); font-size: 11px; font-weight: 500; cursor: pointer;
    box-shadow: 0 4px 14px rgba(30,73,66,.08);
  }
  .mini.show { display: flex; }
  .mini svg { width: 12px; height: 12px; fill: currentColor; }
  .modal-layer {
    position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
    padding: 16px; background: rgba(20,48,42,.24); backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px); z-index: 2147483647;
  }
  .modal-layer.open { display: flex; }
  .pop {
    width: min(410px, 100%); max-height: min(86vh, 760px); overflow-y: auto;
    background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px;
    box-shadow: 0 24px 70px rgba(22,55,48,.28); padding: 18px; display: none; color: var(--fg);
  }
  .pop.open { display: block; }
  .role-card {
    width: min(450px, 100%); max-height: min(86vh, 780px); overflow-y: auto;
    background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px;
    box-shadow: 0 24px 70px rgba(22,55,48,.28); display: none; color: var(--fg);
  }
  .role-card.open { display: block; }
  .card-tabs {
    position: sticky; top: 0; z-index: 2;
    display: flex; align-items: center; gap: 2px; padding: 9px 10px;
    border-bottom: 1px solid var(--border-soft); background: var(--bg-card);
  }
  .card-tab {
    border: none; background: transparent; color: var(--fg-faint); font-size: 11.5px;
    padding: 6px 10px; border-radius: 8px; cursor: pointer;
  }
  .card-tab.active { background: var(--accent-soft); color: var(--accent-deep); font-weight: 600; }
  .card-tabs-spacer { flex: 1; }
  .card-ai {
    display: inline-flex; align-items: center; gap: 4px; border: none;
    background: var(--accent-soft); color: var(--accent-deep); border-radius: 8px;
    padding: 6px 9px; font-size: 11px; font-weight: 600; cursor: pointer;
  }
  .card-ai:hover { background: var(--accent-soft-hover); }
  .card-ai svg { width: 13px; height: 13px; fill: currentColor; }
  .player-pane { padding: 16px 18px 18px; }
  .player-intro {
    margin-bottom: 12px; padding: 9px 10px; border-radius: 10px;
    background: var(--bg-soft); color: var(--fg-muted); font-size: 11px; line-height: 1.6;
  }
  .player-field { margin-bottom: 9px; }
  .player-label { display: block; font-size: 11px; color: var(--fg-faint); margin-bottom: 4px; }
  .player-pane input, .player-pane textarea {
    width: 100%; background: var(--bg-inset); border: 1px solid var(--border); border-radius: 9px;
    padding: 8px 10px; font-size: 12px; color: var(--fg); font-family: inherit; outline: none;
    transition: border-color .15s, box-shadow .15s;
  }
  .player-pane textarea { height: 56px; resize: vertical; }
  .player-pane input:focus, .player-pane textarea:focus {
    border-color: var(--accent-focus); box-shadow: 0 0 0 3px var(--focus-ring);
  }
  .player-actions, .card-actions {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 13px;
  }
  .player-save {
    border: none; border-radius: 9px; background: var(--accent); color: #fff;
    padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .player-save:hover { background: var(--accent-strong); }
  .export-btn {
    border: 1px solid var(--border); background: var(--bg-card); color: var(--accent-deep);
    border-radius: 9px; padding: 7px 10px; font-size: 11px; cursor: pointer;
  }
  .export-btn:hover { background: var(--accent-soft); border-color: var(--accent-border); }
  .player-status {
    margin-top: 10px; font-size: 11px; color: var(--accent-deep);
  }
  .player-status.error { color: var(--danger); }
  .role-top {
    position: relative; display: flex; align-items: center; gap: 12px;
    padding: 18px 18px 15px; border-bottom: 1px solid var(--border-soft);
    background: linear-gradient(135deg, var(--accent-soft) 0%, var(--bg-soft) 62%, var(--bg-card) 100%);
  }
  .role-avatar {
    width: 50px; height: 50px; border-radius: 15px; flex: none;
    background: linear-gradient(135deg, var(--accent), #82d7c9); color: #fff;
    display: grid; place-items: center; font-size: 20px; font-weight: 700;
    box-shadow: 0 6px 18px rgba(47,158,143,.28);
  }
  .role-meta { min-width: 0; flex: 1; }
  .role-name {
    font-size: 18px; font-weight: 700; line-height: 1.25; color: var(--fg-strong);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .role-sub { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 11px; color: var(--fg-faint); }
  .role-stage {
    padding: 2px 7px; border-radius: 999px; background: var(--accent-soft-hover);
    color: var(--accent-deep); font-weight: 600;
  }
  .role-actions { display: flex; gap: 2px; align-self: flex-start; }
  .role-action {
    width: 28px; height: 28px; border: none; border-radius: 8px;
    background: var(--bg-overlay); color: var(--fg-faint); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .role-action:hover { background: var(--bg-card); color: var(--accent-deep); }
  .role-action svg { width: 15px; height: 15px; }
  .role-body { padding: 15px 18px 18px; }
  .role-section { margin-top: 14px; }
  .role-section:first-child { margin-top: 0; }
  .role-label {
    margin-bottom: 7px; font-size: 10.5px; font-weight: 600;
    letter-spacing: .12em; color: var(--fg-faint);
  }
  .role-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .role-tag {
    padding: 3px 8px; border-radius: 999px; background: var(--bg-soft);
    border: 1px solid var(--border-soft); color: var(--fg-body); font-size: 11px; line-height: 1.4;
  }
  .role-tag.accent { background: var(--accent-soft); border-color: var(--accent-border); color: var(--accent-deep); }
  .role-tag.avoid { background: var(--danger-soft); border-color: var(--danger-border); color: var(--danger); }
  .role-summary, .role-memory-summary { margin: 0 0 8px; font-size: 12.5px; line-height: 1.7; color: var(--fg-body); }
  .role-events { list-style: none; margin: 0; padding: 0; }
  .role-events li {
    position: relative; padding-left: 15px; margin: 8px 0;
    font-size: 12px; line-height: 1.6; color: var(--fg-body);
  }
  .role-events li::before {
    content: ''; position: absolute; left: 2px; top: 7px; width: 6px; height: 6px;
    border-radius: 50%; background: var(--accent-bright); box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .role-approach { margin: 0; padding-left: 18px; color: var(--fg-body); font-size: 12px; line-height: 1.75; }
  .role-approach li::marker { color: var(--accent-bright); font-weight: 600; }
  .role-empty { font-size: 12px; color: var(--fg-disabled); }
  .role-status {
    margin-top: 14px; padding: 14px; border: 1px dashed var(--border-soft); border-radius: 12px;
    background: var(--bg-inset); text-align: center; font-size: 12px; color: var(--fg-faint);
  }
  .role-status.error { color: var(--danger); border-color: var(--danger-border); background: var(--danger-soft); }
  .role-retry {
    margin-top: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--accent-deep);
    border-radius: 999px; padding: 5px 12px; font-size: 11px; cursor: pointer;
  }
  .role-note {
    margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--border-soft);
    color: var(--fg-disabled); font-size: 10.5px; line-height: 1.6;
  }
  .role-hidden { display: none !important; }
  .pop-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .pop h4 { font-size: 14px; font-weight: 600; color: var(--fg-strong); }
  .pop-close {
    width: 26px; height: 26px; border: none; border-radius: 7px; background: transparent;
    color: var(--fg-faint); font-size: 17px; line-height: 1; cursor: pointer;
  }
  .pop-close:hover { background: var(--bg-soft); color: var(--fg-strong); }
  .pop label { display: block; font-size: 11.5px; color: var(--fg-faint); margin: 9px 0 4px; }
  .pop input, .pop textarea, .pop select {
    width: 100%; background: var(--bg-inset); border: 1px solid var(--border); border-radius: 9px;
    padding: 8px 10px; font-size: 12px; color: var(--fg); font-family: inherit; outline: none;
    transition: border-color .15s, box-shadow .15s;
  }
  .pop textarea { height: 68px; resize: vertical; }
  .pop input:focus, .pop textarea:focus, .pop select:focus {
    border-color: var(--accent-focus); box-shadow: 0 0 0 3px var(--focus-ring);
  }
  .pop .check-row {
    display: flex; align-items: center; gap: 8px; margin-top: 11px;
    color: var(--fg-body); font-size: 12px; cursor: pointer;
  }
  .pop .check-row input { width: auto; margin: 0; accent-color: var(--accent); }
  .form-error { display: none; margin-top: 8px; color: var(--danger); font-size: 12px; line-height: 1.5; }
  .form-error.show { display: block; }
  .pop .save {
    margin-top: 13px; width: 100%; background: var(--accent); color: #fff; border: none;
    border-radius: 10px; padding: 9px; cursor: pointer; font-size: 13px; font-weight: 600;
  }
  .pop .save:hover { background: var(--accent-strong); }
`;
