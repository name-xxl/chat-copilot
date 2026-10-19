# Soul AI 聊天助手 — 项目约定

适用于所有参与本项目的开发者与 AI 助手。改动前先读本文；发现与本文冲突的旧代码，以本文为准并顺手修正。

## 架构分层与依赖方向

```
环境层    selectors / config / storage / constants
工具层    utils / request-guard / state / actions（动作总线）
平台层    platform.js（门面：稳定接口 + 输入写入/滚动/健康检查等通用算法）
          platform/soul.js（Soul 适配器：定位、采集、会话身份启发式）
通用 DOM  dom（firstTextLine / isVisible / sameConversation / findHostMount）
采集逻辑  conversation（三层身份解析，基于平台接口）/ transcript
领域层    ai-client / prompts / insight / character / profile / memory / card-export
流程层    suggestion-flow / cards-flow / memory-flow / chat-monitor
UI 层     ui.js（门面）+ ui/（shared/style/template/bar/modals/settings/card/core/theme）
入口      main.js（唯一的装配点：setActions 注入 + 事件绑定 + 启动）
```

依赖只允许自上而下（UI → 流程 → 领域 → 采集/平台 → 工具 → 环境），禁止反向。例外仅限：
- `main.js` 可以 import 一切（它是装配点）；
- UI 通过 `actions` 总线间接调用流程，**不得直接 import 任何 `*-flow` 模块**；
- 流程层之间的调用保持现有方向（`cards-flow → suggestion-flow`），新增前先想清楚归属。

**平台耦合只允许出现在 `selectors.js` + `platform/soul.js` + `prompts.js` 的平台语义文案里**。消费方一律从 `platform.js` 门面导入采集/定位接口（`collectMessages / getConversationInfo / findComposer / fillInput / captureChatScroll` 等），不得直接 import 适配器或 `selectors.js`。接入新平台 = 新增 `platform/<name>.js` 并在门面绑定，不许把平台判断散进流程层。适配器须声明 `capabilities`（stableIdentity / roleDetection / peerProfile），能力不足时由流程层闸门自动降级（如禁用长期记忆与角色卡）。

## 归一约定（强约束）

1. **魔法值归一**：跨模块时序/标识写进 `constants.js`（`TIMING`、`LOG_PREFIX`、`HOST_ELEMENT_ID`）；领域阈值留在领域模块的 `LIMITS` 对象里（跨模块使用的要导出，如 `MEMORY_LIMITS`）。禁止在逻辑代码里出现裸数字阈值/毫秒数。
2. **存储归一**：所有 GM 存储访问必须走 `storage.js`（`STORAGE_KEYS` 注册键名 + `safeGet/safeSet/safeDelete`）。禁止在其它模块直接调用 `GM_*Value`，禁止硬编码存储键字符串。不做旧版本键迁移（单用户项目，已确认）。
3. **日志归一**：统一使用 `utils.js` 的 `log / logWarn / logError`，禁止硬编码 `'[SoulAI]'` 前缀。用户可见的错误文案走 UI 状态区（`setRoleStatus` 等），console 只给开发者。
4. **版本归一**：版本号唯一来源是 `package.json`。`build.mjs` 自动注入 userscript 头 `@version` 与运行时 `__VERSION__`，禁止手改 `userscript-header.js` 的版本行或在代码里写死版本号。
5. **请求归一**：任何“发起 AI 请求 + 异步写回”的流程必须使用 `request-guard.js` 的 `createRequestGuard()`；禁止手写 seq/request 簿记。规则：
   - 发起前若需作废上一轮，先 `guard.cancel()`；
   - `const handle = guard.track(promise)`，`await` 之后第一件事 `if (handle.stale() || !sameConversation(...)) return;`；
   - `finally` 里 `handle.done()`；
   - 需要轮询在途状态的用 `guard.isBusy()`，不暴露内部变量。
6. **AI 输出归一**：模型返回的一切 JSON 必须过对应领域模块的 `normalize*` 校验（白名单/枚举/夹取/限长）后才能进入 state 或 UI，禁止直接使用原始解析结果。

## 五维度质量标准（评审基准）

- **便于维护**：单一职责，文件超过 ~300 行就该考虑拆分；页面耦合只允许出现在采集层；新代码必须带中文模块头注释（`=====` banner）说明职责。
- **可复用**：领域校验层保持纯函数（不读 state、不碰 DOM）；往 `memory.js`/`character.js` 这类模块加“顺手读一下 DOM”的函数属于违规，应上移到采集层或流程层。
- **可扩展**：新增数据域的固定模式 = prompts 构建器 + 领域 normalize 模块 + flow（用请求守卫）+ main.js 注册 action + `ui/` 新子模块；不允许把新功能塞进 `ui.js` 门面或既有无关模块。
- **强灵活性**：承认本项目是单平台油猴脚本；平台相关假设（中文时间正则、Soul 文案、DOM 启发式）只允许存在于 `selectors.js`/`dom.js`/`conversation.js`/`prompts.js`，为未来多平台化（见 ROADMAP）保留替换边界。
- **健壮性**：所有异步写回必须双复核（守卫 stale + `sameConversation`）；存储读写必须容错；任何失败路径要有降级（如意图判断失败退化为直接生成），不允许“失败就静默挂起”。

## 可测试性约定（易于测试）

- 分层本身就是可测试性的边界：**领域层与工具层必须是纯函数**——不读 `state`、不碰 `document/window/GM_*`，保证 `node --test` 无环境直跑；需要副作用的逻辑上移到采集层/流程层。
- 新代码默认写成"可测形状"：输入→输出的函数、依赖注入（actions 总线、请求守卫是范例），而不是读全局可变量或隐式单例。
- 副作用收口在三处：DOM（`dom.js`/`ui/`）、存储（`storage.js`）、网络（`ai-client.js`）。mock 这三处即可覆盖全部流程层测试，别把副作用撒到第四个模块。
- 测试放在 `test/`，命名 `<模块>.test.js`，默认只用 `node --test`（零依赖）；引入 DOM 仿真或浏览器自动化依赖前必须先讨论（见 ROADMAP P5）。
- 测试体系就位后：修 bug 先写失败用例再修；新领域模块的 `normalize*`/解析函数随功能一起提交测试，不允许"以后补"。

## 领域红线（不可触碰）

- **永不自动发送**：脚本只填入输入框，绝不触发发送动作。
- **记忆写入防线不可绕过**：基线未建立、锚点消息失联、记忆锚点不在消息流中——任一命中即拒绝写入（`memory-flow.js` 的三道闸）。修改这些条件前必须有明确的故障案例。
- **draft 身份不落盘**：临时会话身份不写长期记忆。
- **主角卡防污染**：上下文里没有用户自己的消息时，拒绝写入 AI 提炼的主角卡内容。

## 开发流程约束

- **改完必须 `npm run build`** 且产物生成无报错；涉及行为的改动在 Tampermonkey 里人工过一遍基本流程：开对话生成 → 点建议填入 → 切换会话 → 角色卡/双卡提炼 → 收起/展开。
- **不新增依赖**（当前仅 esbuild）；确需新增先讨论。
- **测试**：`node --test test/`（自 P1 起随纯函数覆盖增长，完整体系按 ROADMAP P5 落地）；期间修 bug 尽量补回归用例，改动 `utils`/领域 normalize 纯函数时优先保证可推断的正确性。
- **页面改版**：优先只改 `selectors.js`；若结构启发式失效（`dom.js` 的识别函数），必须同步更新文件头注释里的勘察说明。
- **注释与文档**：改动若影响 README 或本文描述的行为，同步更新对应文档。
