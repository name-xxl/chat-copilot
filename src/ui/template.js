/* =====================================================================
 * UI 模板 —— 图标与 Shadow DOM 根节点的 HTML 结构
 * ===================================================================== */
import { UI_CSS } from './style.js';

const ICONS = {
  sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.1 7.4L21.5 12l-7.4 2.1L12 21.5l-2.1-7.4L2.5 12l7.4-2.1z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-.7 4.5"/><path d="M20 4v7h-7"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="10.5" r="1.8"/><path d="M5.5 16c.7-1.8 1.7-2.7 3-2.7s2.3.9 3 2.7M14 10h4M14 14h4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

export function buildRootHtml() {
  return `
    <style>${UI_CSS}</style>
    <div class="wrap">
      <button type="button" class="mini" title="展开 AI 建议" aria-label="展开 AI 建议">${ICONS.sparkle}<span>AI 建议</span></button>
      <div class="bar">
        <div class="bar-head">
          <span class="brand">${ICONS.sparkle}<span>AI</span></span>
          <div class="insight" role="status"></div>
          <div class="tools">
            <button type="button" class="ibtn" data-a="refresh" title="换一批" aria-label="换一批">${ICONS.refresh}</button>
            <button type="button" class="ibtn" data-a="card" title="角色卡" aria-label="角色卡">${ICONS.profile}</button>
            <button type="button" class="ibtn" data-a="cfg" title="AI 设置" aria-label="AI 设置">${ICONS.settings}</button>
            <button type="button" class="ibtn" data-a="hide" title="收起（输入框上方留 ✦ 可展开）" aria-label="收起">${ICONS.close}</button>
          </div>
        </div>
        <div class="chips-wrap"><div class="chips"></div></div>
      </div>
    </div>
    <div class="modal-layer">
      <div class="pop">
        <div class="pop-head">
          <h4>AI 设置</h4>
          <button type="button" class="pop-close" title="关闭" aria-label="关闭设置">×</button>
        </div>
        <label>Base URL（OpenAI 兼容）</label><input data-cfg="baseUrl">
        <label>API Key</label><input type="password" data-cfg="apiKey" autocomplete="off">
        <label>模型名</label><input data-cfg="model">
        <label>我的昵称（AI 以此身份说话）</label><input data-cfg="myName">
        <label>人设 Prompt（AI 的性格/说话风格）</label><textarea data-cfg="persona"></textarea>
        <label>温度（0~1）</label><input data-cfg="temperature">
        <label>思考模式（仅部分模型支持，如 LongCat）</label>
        <select data-cfg="thinkingMode">
          <option value="auto">自动（不传参，跟随模型默认）</option>
          <option value="enabled">开启</option>
          <option value="disabled">关闭</option>
        </select>
        <label>主题（外观）</label>
        <select data-cfg="themeMode">
          <option value="auto">跟随页面（自动明暗 + 主色）</option>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
        <label>自定义主色（#RRGGBB，留空跟随页面）</label><input data-cfg="customAccent" placeholder="#2f9e8f">
        <label class="check-row"><input type="checkbox" data-cfg="insightEnabled"><span>先判断意图和风险（多一次请求）</span></label>
        <div class="form-error" role="alert"></div>
        <button type="button" class="save">保存</button>
      </div>
      <section class="role-card" aria-label="角色卡">
        <div class="card-tabs">
          <button type="button" class="card-tab active" data-card-tab="peer">对方角色卡</button>
          <button type="button" class="card-tab" data-card-tab="player">我的主角卡</button>
          <span class="card-tabs-spacer"></span>
          <button type="button" class="card-ai" data-action="ai-cards" title="用对话同时提炼两张卡">${ICONS.sparkle}<span>AI 提炼</span></button>
          <button type="button" class="role-action role-close" title="关闭" aria-label="关闭角色卡">${ICONS.close}</button>
        </div>
        <div class="card-pane peer-pane" data-card-pane="peer">
          <div class="role-top">
            <div class="role-avatar"></div>
            <div class="role-meta">
              <div class="role-name"></div>
              <div class="role-sub"><span class="role-stage">角色卡</span><span class="role-hint">正在读取资料</span></div>
            </div>
            <div class="role-actions">
              <button type="button" class="role-action role-refresh" title="重新分析" aria-label="重新分析">${ICONS.refresh}</button>
            </div>
          </div>
          <div class="role-body">
            <div class="role-section">
              <div class="role-label">基础情报</div>
              <div class="role-tags role-basics"></div>
            </div>
            <div class="role-section role-memory-section role-hidden">
              <div class="role-label">长期记忆</div>
              <p class="role-memory-summary"></p>
              <div class="role-tags role-open-loops"></div>
              <div class="card-actions">
                <button type="button" class="export-btn" data-action="clear-memory">清除本会话记忆</button>
              </div>
            </div>
            <div class="role-section">
              <div class="role-label">性格侧写</div>
              <p class="role-summary"></p>
              <div class="role-tags role-personality"></div>
            </div>
            <div class="role-section">
              <div class="role-label">事件记忆</div>
              <ul class="role-events"></ul>
            </div>
            <div class="role-section">
              <div class="role-label">话题偏好</div>
              <div class="role-tags role-likes"></div>
            </div>
            <div class="role-section">
              <div class="role-label">尽量避开</div>
              <div class="role-tags role-avoid"></div>
            </div>
            <div class="role-section">
              <div class="role-label">对话攻略</div>
              <ol class="role-approach"></ol>
            </div>
            <div class="role-status role-hidden">正在整理角色卡…</div>
            <div class="card-actions">
              <button type="button" class="export-btn" data-export="peer-json">导出 JSON</button>
              <button type="button" class="export-btn" data-export="peer-txt">导出 TXT</button>
            </div>
            <div class="role-note">AI 根据当前聊天和资料卡推断；长期记忆会按话题自动整理。仅供辅助参考。</div>
          </div>
        </div>
        <div class="card-pane player-pane role-hidden" data-card-pane="player">
          <div class="player-intro">这份档案跨会话共享，会作为“你”的固定事实和说话风格参与生成，避免编造和语气跳脱。</div>
          <div class="player-field">
            <label class="player-label">姓名 / 昵称</label>
            <input data-player="name" placeholder="例如：小林">
          </div>
          <div class="player-field">
            <label class="player-label">基本身份</label>
            <textarea data-player="identity" placeholder="年龄、城市、职业或学校等稳定信息"></textarea>
          </div>
          <div class="player-field">
            <label class="player-label">背景经历</label>
            <textarea data-player="background" placeholder="可以提到的经历、关系、生活设定"></textarea>
          </div>
          <div class="player-field">
            <label class="player-label">性格标签</label>
            <input data-player="personalityTags" placeholder="用逗号分隔，例如：慢热,嘴硬,细心">
          </div>
          <div class="player-field">
            <label class="player-label">兴趣爱好</label>
            <input data-player="interests" placeholder="用逗号分隔">
          </div>
          <div class="player-field">
            <label class="player-label">说话风格</label>
            <textarea data-player="style" placeholder="例如：短句、口语化、少用感叹号，偶尔冷幽默"></textarea>
          </div>
          <div class="player-field">
            <label class="player-label">常用表达</label>
            <textarea data-player="phrases" placeholder="每行或逗号分隔，例如：行吧 / 有点意思 / 我看看"></textarea>
          </div>
          <div class="player-field">
            <label class="player-label">禁区与不编造</label>
            <textarea data-player="boundaries" placeholder="例如：不编造工作细节；不承诺见面；不谈家庭隐私"></textarea>
          </div>
          <div class="player-field">
            <label class="player-label">稳定事实</label>
            <textarea data-player="facts" placeholder="每行一条，例如：在上海做设计 / 养了一只猫 / 周末常去打球"></textarea>
          </div>
          <div class="player-actions">
            <button type="button" class="player-save">保存主角卡</button>
            <button type="button" class="export-btn" data-export="player-json">导出 JSON</button>
            <button type="button" class="export-btn" data-export="player-txt">导出 TXT</button>
          </div>
          <div class="player-status role-hidden"></div>
        </div>
      </section>
    </div>
  `;
}
